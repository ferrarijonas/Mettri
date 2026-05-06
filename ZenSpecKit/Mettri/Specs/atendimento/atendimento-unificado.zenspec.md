# Atendimento unificado (nova UI)

>Spec de interface que unifica Ouvinte + Funil + Pedido + Vitrine + Sugestão num painel de atendimento sem toggles desnecessários.

## 1. Propósito

Esta feature existe para que o atendente tenha, numa única tela e em tempo real, **tudo o que precisa para conduzir uma venda no WhatsApp**: quem é o cliente, o que ele está pedindo, o que já foi extraído da conversa, o que falta confirmar, o que a vitrine recomenda oferecer e qual a próxima ação — sem precisar expandir seções, trocar de painel ou alternar entre abas.

---

## 2. Conceito

O painel de atendimento atual tem 7 seções com toggles independentes. Esta spec define uma **UI unificada** onde:

- **Classificação de intenção** identifica se a conversa é compra nova, pós-venda, orçamento ou dúvida (ver [classificar-intencao-conversa.zenspec.md](classificar-intencao-conversa.zenspec.md)).
- **Pedido** é persistido como `OrderRecordV2` no `OrderDB` com ciclo de vida completo (ver [modelo-pedido-unificado.zenspec.md](modelo-pedido-unificado.zenspec.md)), substituindo o pedido automático volátil anterior.
- **Ouvinte** alimenta o **Funil** (cada dado extraído acende uma etapa automaticamente)
- **Funil** guia o que falta perguntar
- **Vitrine** aparece inline como "Oferecer também" com scores e motivos
- **Sugestão** usa LLM com o contexto completo (cliente + pedido + vitrine + etapa do funil)
- **Histórico de pedidos** mostra os últimos pedidos do cliente com ticket médio e frequência

Metáfora: é a "mesa de operação" do vendedor — tudo visível, nada escondido atrás de toggle.

---

## 3. Pipeline & fluxos

```
Ouvinte (persistiu)  →  eventBus.emit('ouvir:profile-updated')  →  DashboardModule  →  rerender()
  →  ViewModel (enriquecido com funil + pedido + vitrine)  →  AtendimentoPanel.render()
```

| Programa | Recebe | Faz | Manda para |
| -------- | ------ | --- | ---------- |
| `DashboardModule` | evento `ouvir:profile-updated` | Constrói ViewModel com `estadoFunil`, `pedidoAuto`, `vitrineItems`, `proximaAcao` | `AtendimentoPanel.render(vm)` |
| `AtendimentoPanel` | `AtendimentoViewModelUnificado` | Renderiza layout único com todas as seções visíveis | — (UI local) |

---

## 4. Lógica

### 4.1 ViewModel unificado

```typescript
interface AtendimentoViewModelUnificado {
  kind: 'ready'
  chatId: string
  customer: {
    displayName: string
    phoneLabel: string
    badges: string[]
    tipoCliente: 'novo' | 'contato' | 'ativo' | 'recorrente' | null
    /** Timeline resumida do cliente (do CustomerProfileDB + PurchaseDB) */
    timeline: string[]  // ["comprou 5x", "PIX", "tarde", "pão sem gluten"]
    confiancaPerfil: number
  }
  /** Classificação da intenção da conversa (ClassificarIntencao) */
  tipoConversa: IntencaoTipo | null
  /** Pedido atual do cliente (lead, draft, open, awaiting_payment), persistido no OrderDB */
  pedidoAtual: OrderRecordV2 | null
  /** Últimos N pedidos do cliente (completed, cancelled) */
  historicoPedidos: OrderRecordV2[]
  /** Métricas agregadas do cliente */
  metricaCliente: {
    ticketMedioCentavos: number
    frequencia: string
    totalPedidos: number
  }
  funil: {
    etapas: FunilEtapa[]
    progresso: number  // 0..100
  }
  pedido: {
    itens: PedidoItemAuto[]
    subtotalCentavos: number
    entregaCentavos: number | null
    totalCentavos: number
    status: 'aberto' | 'fechado'
  }
  vitrine: VitrineItemUi[]
  sugestao: {
    texto: string
    loading: boolean
  }
  proximaAcao: {
    label: string
    sugestaoTexto: string
  } | null
}
```

### 4.2 Funil automático

5 etapas, cada uma acende automaticamente quando o Ouvinte captura o dado correspondente:

| Etapa | Quando acende | Campo ouvido |
|-------|---------------|-------------|
| `produto` | Ouvinte extraiu `preferenciasProduto` com match no catálogo | `preferenciasProduto` |
| `endereco` | Ouvinte extraiu `enderecoEntrega` | `enderecoEntrega` |
| `pagamento` | Ouvinte extraiu `formaPagamentoPreferida` | `formaPagamentoPreferida` |
| `prazo` | Ouvinte extraiu `urgenciaEntrega` | `urgenciaEntrega` |
| `fechar` | Atendente clicou em "Registrar pedido" | manual |

**Se** o Ouvinte extrai um dado **então** a etapa correspondente passa de `pendente` para `ok`.
**Se** o cliente disser "na verdade" (release) **então** a etapa volta para `pendente`.

Progresso: `(etapasOK / totalEtapas) * 100`.

### 4.3 Pedido automático

O pedido é montado automaticamente a partir de **duas fontes de dados**:

| Fonte | O que fornece | Persistência |
|---|---|---|
| Perfil operacional | `preferenciasProduto[]` acumulado pelo Ouvinte | `CustomerProfileDB` |
| Histórico de mensagens | Varredura direta de `messageDB.getMessages(chatId, 100)` | `MessageDB` |

As duas fontes são unidas via `Set` (deduplicação natural). Para cada menção de produto, o sistema aplica:

#### 4.3.1 Parse de quantidade

**Se** o texto começa com dígito **então** `quantidade = dígitos`, nome = resto.  
**Se** o texto começa com numeral por extenso (`um, uma, dois, duas, três, …, dez, meia, meio`) **então** `quantidade = numeral`, nome = resto (`de` inicial removido).  
**Senão** `quantidade = 1`, nome = texto original.

Exemplos:
| Entrada | qty | nome |
|---|---|---|
| `dois de abobora` | 2 | `abobora` |
| `1 100% integral` | 1 | `100% integral` |
| `10 de abobra` | 10 | `abobra` |

#### 4.3.2 Match no catálogo (fuzzy, 3 tiers)

Para cada nome extraído, busca no catálogo (`catalogoDB.listByAccount`):

| Tier | Condição | Exemplo |
|---|---|---|
| 1 — exato | Normalizado igual | `"abobora"` ≠ `"pão de abóbora & girassol"` |
| 2 — contém | Um contém o outro | `"abobora"` ⊂ `"pão de abóbora & girassol"` ✓ |
| 3 — parcial | ≥50% das palavras >3 chars batem | `"integral 100"` → 1/2 palavras batem → ✓ |

**Se** há match no catálogo **então** o item entra no pedido com `produtoCatalogo` populado e `precoTotalCentavos = precoCatalogo × quantidade`.  
**Se** não há match **então** o item **não aparece** no pedido (filtrado, sem item fantasma).

#### 4.3.3 Janela temporal (message windowing)

A varredura de mensagens respeita a **última compra registrada**:

**Se** existe `purchaseDB.getLastActiveByChatId(chatId)` **então** só escaneia mensagens com `timestamp > purchaseDate`.  
**Senão** escaneia todas as mensagens (conversa inteira, primeiro pedido).

Isso garante que produtos de pedidos já fechados não reapareçam — cada ciclo de compra nasce um novo pedido limpo.

#### 4.3.4 Ciclo de vida do pedido

```
Cliente escreve → pedido.status = 'aberto' (automático)
                 → itens acumulam de mensagens + perfil
Atendente clica [Registrar] → salva em purchaseDB (source: 'AI_DETECTED')
                            → pedido.status = 'fechado'
                            → próxima carga só escaneia mensagens pós-compra
```

Subtotal = soma dos `precoTotalCentavos` de todos os itens.  
Entrega = valor fixo cadastrado ou null.  
Total = subtotal + entrega ou subtotal.

### 4.4 Vitrine inline (cross-sell)

A vitrine exibe **até 3 produtos ativos do catálogo que NÃO estão no pedido atual**:

- Produtos do catálogo (`catalogoDB.listByAccount`) filtrados por `ativo = true`
- Exclui produtos cujo `productId` já aparece em algum `PedidoItemAuto.produtoCatalogo`
- Score fixo 5 (MVP; substituir por `VitrineSaida` do motor de recomendação quando disponível)
- Motivo: `"Também disponível no catálogo"`

Cada card mostra:
- Nome do produto, preço
- Score (0–10)
- Motivo curto
- Botão `"➕ add ao pedido"` (mock — integração futura)

**Se** não há produtos fora do pedido **então** seção oculta.

### 4.5 Próxima ação

Derivada do funil: qual é a **primeira etapa pendente**?

| Etapa pendente | Próxima ação sugerida |
|---|---|
| `produto` | "Perguntar o que a cliente quer" |
| `endereco` | "Perguntar endereço de entrega" |
| `pagamento` | "Confirmar forma de pagamento (PIX detectado)" |
| `prazo` | "Confirmar dia e horário de entrega" |
| `fechar` | "Fechar pedido — total R$ XX" |

### 4.6 Sugestão LLM

A sugestão (LLM) recebe o contexto completo:
```
system: persona do atendente
user:
  cliente: { nome, tipo, timeline }
  funil: { etapas concluídas, etapa atual }
  pedido: { itens, total }
  vitrine: { recomendações top 2 }
  última mensagem do cliente: "..."

gere próxima mensagem curta e natural
```

Rascunho aparece inline, com botões `[Copiar]` e `[Enviar]`.

---

## 5. Interface

```
┌─ Roberta ──────────────────────────────────────────────────┐
│ Timeline: 🟢 5 compras | PIX | pão sem gluten              │
│                                                            │
│ ┌─ Funil ──────────────────────────────────────────────────┐
│ │ ● Produto  ● Endereço  ● Pgto  ○ Prazo  ○ Fechar       │
│ │ ████████████████████░░░░░ 60%                           │
│ └──────────────────────────────────────────────────────────┘
│                                                            │
│ ┌─ Pedido ─────────────────────────────────────────────────┐
│ │ 🍞 Pão de Abóbora   2x  R$16,00  = R$32,00  catálogo ✓ │
│ │ 📍 Rua Gloria, 100 — B. Patrimônio              🟢 alta  │
│ │ 💳 PIX                                          🟡 media  │
│ │ 🕐 —                                            ○ vazio   │
│ │                                                          │
│ │ 🚚 Entrega: R$ 8,00                                     │
│ │ Total: R$ 40,00     ○ Aberto                            │
│ │ [Registrar pedido]                                       │
│ └──────────────────────────────────────────────────────────┘
│                                                            │
│ ┌─ Oferecer também ────────────────────────────────────────┐
│ │ ☕ Café 250g  R$ 22  "compra toda quinta"  7.1  [+ add] │
│ │ 🥖 Integral  R$ 10  "estoque alto"         6.3  [+ add] │
│ └──────────────────────────────────────────────────────────┘
│                                                            │
│ ┌─ Próxima ação ───────────────────────────────────────────┐
│ │ ⚡ Confirmar dia e horário de entrega                    │
│ │ 💬 "Certo Roberta! 2 pães + entrega = R$40.             │
│ │     Que horário funciona melhor pra você?"               │
│ │                                    [📋 Copiar] [📤 Enviar]│
│ └──────────────────────────────────────────────────────────┘
└────────────────────────────────────────────────────────────┘
```

### 5.1 Seções e visibilidade

| Seção | Sempre visível? | Condição |
|---|---|---|
| Timeline | Sim (se houver dados) | `customer.timeline.length > 0` |
| Funil | Sim | Sempre |
| Pedido | Sim | Sempre (vazio até primeiro item) |
| Vitrine | Sim (se houver recomendações) | `vitrine.length > 0` |
| Próxima ação | Sim | Sempre |

### 5.2 Estados do funil

| Estado | CSS |
|---|---|
| `ok` (preenchido) | `bg-green-500/20 text-green-400 border-green-500/30` + ícone ✓ |
| `pendente` (falta) | `bg-gray-500/10 text-gray-400 border-gray-500/20` + ○ vazio |
| `ok` + recém-atualizado | mesma cor + `animate-pulse` por 2s |

### 5.3 Estados do pedido

| Estado | Quando | Aparência |
|---|---|---|
| `vazio` | Nenhum item ainda | "Nenhum item no pedido" |
| `aberto` | Itens mas não registrado | Status ○ Aberto |
| `fechado` | Pedido registrado | Status ● Fechado com badge verde |

### 5.4 Renderização de itens do pedido

Cada item do pedido é renderizado com:

- **Prefixo de quantidade**: sempre visível, inclusive para `1×`. Fonte `font-mono`, tamanho `text-[10px]`, cor `text-muted-foreground/60`. Símbolo `×` (multiplication sign, U+00D7).
- **Nome do produto**: `produtoCatalogo.nome` se disponível, senão `nomeExtraido` (fallback). Fonte normal `font-medium`, truncado.
- **Preço**: alinhado à direita, formato `R$ X,XX` (tabular-nums). Só exibido se `precoTotalCentavos > 0`.
- **Badge "novo"**: aparece quando `updatedFields` inclui `'preferenciasProduto'`, animação `fadeOutBadge 4s`.
- **Flash verde**: classe `campo-atualizado` aplicada ao container do item quando `updatedFields` inclui `'preferenciasProduto'`, animação `flash-update 1.5s`.

Exemplo:
```
• 2× Pão de Abóbora & Girassol    novo    R$ 52,00
• 1× Pão 100% Integral            novo    R$ 32,00
• 5× Pão Multigrãos               novo    R$ 130,00
```

---

## 6. Casos de borda

| Cenário | Comportamento |
|---------|---------------|
| Ouvinte extrai mas catálogo não tem match | Item **não aparece** no pedido (filtrado) |
| Texto sem match no catálogo (ex: "qte pedir uma coisa") | Descartado silenciosamente |
| Cliente muda de ideia (release) | Etapa volta a `pendente`, item é removido |
| Múltiplos produtos extraídos | Cada vira um item de pedido separado |
| Produto repetido em mensagens diferentes | Deduplicado via `productId` |
| Vitrine vazia (sem recomendações) | Seção oculta |
| Atendente troca de chat | Funil reseta para novo cliente |
| Pedido sem endereço | Próx ação = "Perguntar endereço" |
| Pedido completo (todas etapas ok) | Próx ação = "Fechar pedido" |
| LLM falha ao gerar sugestão | Campo de sugestão mostra "Gerar sugestão" manualmente |
| Pedido registrado (compra salva) | Próxima carga só escaneia mensagens após `purchaseDate` |
| Mensagem sem intenção de compra explícita | Fallback de regex tenta capturar padrão "número + produto" |

---

## 7. Critérios de aceitação

- Ao enviar msg do cliente, funil avança automaticamente quando Ouvinte captura dado.
- Etapa que muda de `pendente` para `ok` pisca por 2s.
- Produto com match no catálogo mostra nome e preço reais.
- Vitrine recomenda produtos com score > 5 e mostra motivo.
- Próxima ação reflete a primeira etapa pendente do funil.
- Sugestão LLM inclui contexto de todas as seções visíveis.
- Total do pedido é recalculado quando itens são adicionados/removidos.

---

## 8. Dependências

- Ouvinte: emite `ouvir:profile-updated` (campos extraídos + confiança)
- Catálogo (`ProdutoDB`): match de produto + preço
- Vitrine (`gerarRecomendacoesVitrine`): recomendações ranqueadas
- CustomerProfileDB: timeline + perfil operacional
- PurchaseDB: histórico de compras para timeline
- LLM (infrastructure-llm ou chamada direta): geração de sugestão
- EventBus: `ouvir:profile-updated`, `chat:active-changed`

---

## 9. Escopo fora

- Chatbot automático (sempre com humano revisando)
- Pagamento integrado (PIX, cartão)
- Carrinho com múltiplos clientes simultâneos
- Edição inline de preços do catálogo
- Drag-and-drop do funil

---

## 10. Referências

- ouvinte/spec.md: pipeline de extração
- vitrine/spec.md: motor de recomendação
- oportunidades/spec.md: vitrine assistida (unificada aqui)
- atendimento/spec.md: módulo mãe do atendimento
- classificar-intencao-conversa.zenspec.md: classificação de intenção (passo 0 do pipeline)
- modelo-pedido-unificado.zenspec.md: contrato `OrderRecordV2`
- bloco-pedidos-no-painel.zenspec.md: bloco de pedidos dentro do painel Atendimento
- atualizar-perfil-operacional-do-cliente.zenspec.md: persistência do perfil
- extrator.zenspec.md: extração de sinais
- orquestrar-pipeline-comercial-whatsapp.zenspec.md: pipeline canônico
- extrair-produtos-do-texto.zenspec.md: varredura de mensagens para pedido
- registrar-pedido-obrigatorio.zenspec.md: persistência do pedido fechado
- produtos-preco-e-estoque.zenspec.md: match de catálogo
- ../pedidos/spec.md: módulo de pedidos (visão global)
