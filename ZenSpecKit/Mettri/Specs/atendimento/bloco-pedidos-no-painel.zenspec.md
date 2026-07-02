---
status: obsoleto
---

# Bloco de pedidos no painel de atendimento

Esta feature existe para que, **dentro do painel de atendimento** (chat ativo), o atendente veja o pedido atual do cliente em destaque, com controles inline para editar itens (só em `draft`), confirmar ou cancelar, além de um resumo do histórico de pedidos daquele cliente e métricas como ticket médio e frequência.

---

## 1. Propósito

Substituir o bloco de "pedido automático" volátil atual (que não persiste) por uma seção conectada ao `OrderRecordV2` persistido no `OrderDB`. A classificação de intenção (`ClassificarIntencao`) determina se um pedido é criado automaticamente (`lead`) e o Ouvinte o preenche com itens (`draft`).

Panorama: [atendimento-unificado.zenspec.md](atendimento-unificado.zenspec.md). Modelo: [modelo-pedido-unificado.zenspec.md](modelo-pedido-unificado.zenspec.md).

---

## 2. Conceito

Três zonas no painel de atendimento:

| Zona | Posição | Conteúdo |
|---|---|---|
| **Chip de intenção** | Abaixo do cabeçalho do cliente | Tipo de conversa detectado + resumo |
| **Bloco PED-00XX** | Abaixo do chip de intenção | Pedido atual em destaque, itens editáveis, funil, totais, ações |
| **Histórico resumido** | Abaixo do bloco de pedido | Últimos N pedidos + ticket médio + frequência |

Metáfora: é a **"comanda"** da mesa — tudo que o cliente já pediu e está pedindo agora, num só lugar.

---

## 3. Pipeline & fluxos

```
getAtendimentoViewModel()
       │
       ├─ classificarIntencao() → tipoConversa
       ├─ orderDB.listActiveByClientKey() → pedidoAtual
       ├─ orderDB.listByClientKey(completed/cancelled) → historicoPedidos
       └─ buildPedidoAuto() → persiste itens como draft (se compra_nova)
              │
              ▼
       AtendimentoPanel.render(vm)
              │
              ├─ Renderiza chip de intenção
              ├─ Renderiza bloco PED-00XX
              └─ Renderiza histórico resumido
```

---

## 4. Lógica

### 4.1 ViewModel (extensão do existente)

Adições ao `AtendimentoViewModel` (kind `'ready'`):

```typescript
// NOVO: classificação da conversa
tipoConversa: IntencaoTipo | null

// NOVO: pedido atual do cliente (lead, draft, open, ou awaiting_payment)
pedidoAtual: OrderRecordV2 | null

// NOVO: últimos N pedidos do cliente (completed ou cancelled)
historicoPedidos: OrderRecordV2[]

// NOVO: métricas do cliente
metricasCliente: {
  ticketMedioCentavos: number
  frequencia: string          // ex.: "2x/semana", "1x/mês", "—" (se <2 pedidos)
  totalPedidos: number
}
```

### 4.2 Chip de intenção

Renderizado **apenas** quando `tipoConversa` não é `null` e não é `'outro'`.

| `tipoConversa` | Ícone | Texto | Cor do chip |
|---|---|---|---|
| `compra_nova` | 🛒 | "Compra nova — 'trecho da msg'" | `bg-blue-500/20 text-blue-400 border-blue-500/30` |
| `suporte_pos_venda` | 📦 | "Pós-venda — PED-00XX" | `bg-yellow-500/20 text-yellow-400 border-yellow-500/30` |
| `orcamento` | 💰 | "Orçamento — 'trecho da msg'" | `bg-purple-500/20 text-purple-400 border-purple-500/30` |
| `duvida` | ❓ | "Dúvida — 'trecho da msg'" | `bg-gray-500/20 text-gray-400 border-gray-500/30` |

Trecho da msg: truncado em 40 caracteres, com `"..."` no final se exceder.

Confiança: badge inline à direita do texto:

| Confiança | Badge |
|---|---|
| `alta` | `✓ alta` (verde) |
| `media` | `~ media` (amarelo) |
| `baixa` | `? baixa` (cinza) |

Chip inteiro é uma linha: `ícone Tipo — "trecho"  badge`.

### 4.3 Bloco PED-00XX (Pedido atual)

Renderizado **apenas** quando `pedidoAtual` não é `null`.

#### 4.3.1 Cabeçalho do bloco

```
PED-0042  ○ Draft
```

- `PED-0042`: `font-mono text-sm font-bold`.
- Status: chip colorido conforme tabela abaixo.
- À direita: data de criação (`text-xs text-muted`).

| Status | Chip | Cor |
|---|---|---|
| `lead` | ○ Lead | cinza |
| `draft` | ○ Draft | azul |
| `open` | ○ Aberto | verde |
| `awaiting_payment` | ◷ Aguardando | amarelo |
| `completed` | ✓ Completo | verde escuro |
| `cancelled` | ✗ Cancelado | vermelho |
| `lost` | ◌ Perdido | cinza escuro |

#### 4.3.2 Itens do pedido

Cada item renderizado como linha editável (em `draft`) ou somente leitura (em `open`+):

```
2× Integral 100%    R$ 20,00  [−] [+] [✕]
1× Café 250g        R$ 22,00  [−] [+] [✕]
```

Regras:
- **Prefixo de quantidade**: `font-mono text-[13px]`, sempre visível. Símbolo `×` (U+00D7).
- **Nome do produto**: `produtoCatalogo.nome` ou fallback `nomeExtraido`. `font-medium`, truncado se >25 caracteres.
- **Preço**: alinhado à direita, formato `R$ X,XX`, `font-mono tabular-nums`. Só exibido se `precoTotalCentavos > 0`.
- **Controles `[−] [+] [✕]`**: visíveis **apenas** se `status === 'draft'`. 
  - `[−]` diminui quantidade em 1. Se qty chegar a 0, remove o item.
  - `[+]` aumenta quantidade em 1.
  - `[✕]` remove o item.
  - Mudança dispara `order:updateQty` ou `order:removeItem` no `DashboardModule`, que persiste no `OrderDB` e rerenderiza.
- **Badge "novo"**: aparece quando item foi recém-adicionado pelo Ouvinte, animação `fadeOutBadge 4s` (análogo ao existente em `atendimento-unificado.zenspec.md` §5.4).
- **Flash verde**: classe `campo-atualizado` quando o Ouvinte atualiza `preferenciasProduto`, animação `flash-update 1.5s`.

#### 4.3.3 Totais

Exibidos abaixo dos itens:

```
Subtotal: R$ 42,00
Entrega:  R$  8,00
Total:    R$ 50,00
```

- `font-mono text-sm`, alinhado à direita.
- Recalculados automaticamente a cada mudança de item (via `OrderDB`).
- `Entrega` só exibido se `entregaCentavos > 0`.

#### 4.3.4 Funil inline (mini)

5 bolinhas horizontais abaixo dos totais:

```
● Produto  ● Endereço  ○ Pgto  ○ Prazo  ○ Fechar  ██████░░ 40%
```

- `●` verde = etapa `ok`.
- `○` cinza = etapa `pendente`.
- Barra de progresso horizontal: `okCount / 5 * 100`.
- Dados vêm do `pedidoAtual.funil`, preenchido pelo Ouvinte.

#### 4.3.5 Observações (se houver)

Exibido como bloco de texto somente leitura (ou editável se `draft`):

```
Obs: "sem açúcar no café"                              [editar]
```

- `text-xs text-muted italic`.
- Botão `[editar]` abre textarea inline; `[salvar]` persiste.

#### 4.3.6 Ações

Botões alinhados à direita, visibilidade depende do status:

| Botão | Visível em | Ação |
|---|---|---|
| `[Confirmar pedido]` | `draft` com ≥1 item | `draft → open` |
| `[Cancelar]` | `draft` ou `open` | Prompt de motivo → `cancelled` |
| `[Marcar como pago]` | `awaiting_payment` | `awaiting_payment → completed` |
| `[💬 Gerar rascunho]` | Qualquer status (opcional) | Dispara orquestrador comercial |

- `[Confirmar pedido]`: `bg-green-600 text-white`, desabilitado se `pedidoAtual.itens.length === 0`.
- `[Cancelar]`: `bg-red-600/10 text-red-400 border-red-500/30`, sempre habilitado.

### 4.4 Histórico resumido

Renderizado **apenas** quando `historicoPedidos.length > 0`.

```
Últimos pedidos:
PED-0039 ✓ R$ 38 — PED-0038 ✓ R$ 22 — PED-0037 ✗ Cancelado
Ticket médio: R$ 34,00  │  2x/semana  │  8 pedidos no total
```

- Últimos 5 pedidos (completed ou cancelled), ordenados por `updatedAtIso` desc.
- Cada pedido: `PED-00XX status-chip-mini R$ total`.
- Chips mini: sem label, só ícone e cor.
- Ticket médio: média dos totais dos pedidos `completed` nos últimos 90 dias.
- Frequência: calculada como `dias entre último e primeiro pedido / totalPedidos`. Formatos:
  - `< 1 dia` → `"hoje"`
  - `1-6 dias` → `"Xx/semana"` (ex.: `2x/semana`)
  - `7-30 dias` → `"Xx/mês"` (ex.: `1x/mês`)
  - `> 30 dias` → `"esporádico"`
  - `< 2 pedidos` → `"—"`
- Total de pedidos: quantidade de `OrderRecordV2` com status `completed` deste cliente.
- Linha separadora (`text-muted/20`) entre cada pedido.

---

## 5. Interface

### 5.1 Posição no painel

O chip de intenção e o bloco de pedidos substituem a seção atual de "Pedido automático" no layout unificado definido em `atendimento-unificado.zenspec.md` §5. A ordem das seções no painel fica:

1. Cabeçalho do cliente (existente)
2. **Chip de intenção** (novo)
3. **Bloco PED-00XX** (substitui pedido automático)
4. Vitrine inline (existente)
5. Próxima ação (existente)
6. **Histórico resumido** (novo)
7. RAG / Sugestão (existente)
8. Registro de compra (existente)
9. Bloco Comercial + Ouvinte (existente)

### 5.2 Wireframe

```
┌─ Roberta ───────────────────────────────────────────────────────────┐
│ 🟢 Timeline: 5 compras │ PIX │ tarde │ pão sem glúten              │
│                                                                     │
│ ┌─ 🛒 Compra nova — "quero 2 integral e 1 café"  ✓ alta ──────────┐│
│ └──────────────────────────────────────────────────────────────────┘│
│                                                                     │
│ ┌─ PED-0042 ○ Draft ──────────────────────────────────────────────┐│
│ │                                                                  ││
│ │  2× Integral 100%    R$ 20,00  [−] [+] [✕]                     ││
│ │  1× Café 250g        R$ 22,00  [−] [+] [✕]                     ││
│ │                                                                  ││
│ │  ─────────────────────────────────────────                      ││
│ │  Subtotal: R$ 42,00                                             ││
│ │  Entrega:  R$  8,00                                             ││
│ │  Total:    R$ 50,00                                             ││
│ │                                                                  ││
│ │  ● Produto  ● Endereço  ○ Pgto  ○ Prazo  ○ Fechar  40%         ││
│ │                                                                  ││
│ │  Obs: "sem açúcar no café"                             [editar] ││
│ │                                                                  ││
│ │  [Cancelar]                              [Confirmar pedido]     ││
│ └──────────────────────────────────────────────────────────────────┘│
│                                                                     │
│ ┌─ Oferecer também ────────────────────────────────────────────────┐│
│ │  🥖 Multigrãos  R$ 8  "compra toda quinta"  7.1  [+ add]       ││
│ └──────────────────────────────────────────────────────────────────┘│
│                                                                     │
│ ┌─ Próxima ação ───────────────────────────────────────────────────┐│
│ │  ⚡ Confirmar endereço de entrega                                ││
│ │  💬 "Certo Roberta! Qual o endereço?"                            ││
│ │                                         [📋 Copiar] [📤 Enviar]  ││
│ └──────────────────────────────────────────────────────────────────┘│
│                                                                     │
│ ┌─ Histórico ──────────────────────────────────────────────────────┐│
│ │  PED-0039 ✓ R$ 38 — PED-0038 ✓ R$ 22 — PED-0037 ✗ Cancelado    ││
│ │  ─────────────────────────────────────────                       ││
│ │  Ticket médio: R$ 34,00  │  2x/semana  │  8 pedidos             ││
│ └──────────────────────────────────────────────────────────────────┘│
│                                                                     │
│ [RAG] [Comercial] [Registro de compra] ...                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Casos de borda

| Cenário | Comportamento |
|---|---|
| Conversa sem pedido ativo (`pedidoAtual === null`) | Bloco PED oculto. Só chip de intenção e histórico visíveis (se houver). |
| `tipoConversa === 'outro'` | Chip de intenção oculto. |
| `tipoConversa === 'orcamento'` + cliente sem pedido | Chip visível, bloco PED oculto. Próx ação sugere enviar preços. |
| `tipoConversa === 'suporte_pos_venda'` + múltiplos pedidos ativos | Chip mostra "Pós-venda — múltiplos pedidos". Bloco PED mostra o mais recente. |
| Cliente sem histórico (`historicoPedidos === []`) | Seção de histórico oculta. |
| `Confirmar pedido` com 0 itens | Botão desabilitado. |
| `[−]` em item com qty 1 | Remove o item (confirmação implícita). |
| Ouvinte detecta novo produto enquanto pedido está `draft` | Item adicionado com badge "novo" + flash verde. |
| Ouvinte remove preferência (release) | Item removido do pedido automaticamente. |
| Pedido em `lead` sem itens | Bloco mostra só cabeçalho: "PED-0042 ○ Lead — aguardando intenção de compra". |
| Atendente troca de chat | Bloco reseta para o novo cliente (novo ViewModel). |
| 2 pedidos `draft` do mesmo cliente | Mostrar o mais recente. Link "Ver todos (2) →" que navega para módulo pedidos. |

---

## 7. Critérios de aceitação

- Ao abrir chat de cliente com pedido `draft`, o bloco PED aparece com itens e controles editáveis.
- `[+]` `[−]` `[✕]` funcionam e persistem no OrderDB.
- `[Confirmar pedido]` muda status para `open` e oculta controles de edição.
- `[Cancelar]` abre prompt, pede motivo, muda status para `cancelled`.
- Chip de intenção reflete `tipoConversa` com cor e badge de confiança corretos.
- Histórico mostra últimos pedidos com ticket médio calculado.
- Ao trocar de chat, o bloco atualiza para o novo cliente.
- Total é recalculado após cada mudança de item.

---

## 8. Dependências

- `OrderDB` (`addItem`, `removeItem`, `updateQty`, `advanceStatus`, `listByClientKey`).
- `ClassificarIntencao` (definido em [classificar-intencao-conversa.zenspec.md](classificar-intencao-conversa.zenspec.md)).
- `buildPedidoAuto` (provider.ts — agora persiste como draft).
- `AtendimentoViewModel` (extensão dos campos existentes).
- `DashboardModule` (wire de ações `order:confirm`, `order:cancel`, etc.).
- `EventBus` (`ouvir:profile-updated` → atualizar itens do pedido).

---

## 9. Escopo fora

- Vitrine inline com "add ao pedido" (já existe, mock).
- Pagamento integrado (PIX, cartão).
- Chatbot automático.
- Múltiplos pedidos simultâneos no mesmo bloco (mostrar só o mais recente; link para módulo pedidos).

---

## 10. Referências

- [modelo-pedido-unificado.zenspec.md](modelo-pedido-unificado.zenspec.md): contrato `OrderRecordV2`.
- [classificar-intencao-conversa.zenspec.md](classificar-intencao-conversa.zenspec.md): como `tipoConversa` é determinado.
- [atendimento-unificado.zenspec.md](atendimento-unificado.zenspec.md): layout atual do painel (que esta spec estende).
- [../pedidos/spec.md](../pedidos/spec.md): módulo de pedidos global.
