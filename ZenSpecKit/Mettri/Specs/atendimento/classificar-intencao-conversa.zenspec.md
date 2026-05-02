# Classificar intenção da conversa (`ClassificarIntencao`)

Esta feature existe para que, **ao abrir uma conversa** (e reavaliado a cada novo turno de mensagem), o sistema determine o **tipo de intenção** do cliente — `compra_nova`, `suporte_pos_venda`, `orcamento`, `duvida`, `outro` — para que o pipeline comercial saiba se deve criar um pedido (`lead`), carregar um pedido existente, sugerir preço ou responder com FAQ. Sem esta classificação, toda conversa nova é tratada como genérica e o atendente perde contexto.

---

## Conceito

`ClassificarIntencao` é o **passo zero** do pipeline comercial. Consome:
- A primeira mensagem do turno (ou a mais recente, se reclassificando)
- O histórico do cliente (`PurchaseDB` + `CustomerProfileDB`)
- Os pedidos ativos do cliente (`OrderDB`)
- Os sinais extraídos pelo Ouvinte

Não chama LLM, não altera estado. É uma função **determinística** baseada em heurísticas textuais e dados factuais.

Reavaliação: a cada novo turno de mensagem do cliente, a classificação é re-executada. Se o cliente mudar de assunto (`compra_nova` → `suporte_pos_venda`), a UI reflete o novo tipo.

Panorama: [spec.md](spec.md) (Comercial). Tipo `IntencaoTipo`: [modelo-pedido-unificado.zenspec.md](modelo-pedido-unificado.zenspec.md).

---

## Pipeline & fluxos

```
1ª msg do turno + histórico + pedidos ativos + sinais Ouvinte
       │
       ▼
  ClassificarIntencao  →  { tipo, confianca, orderRelacionada? }
       │
       ├─ compra_nova         →  orquestrador cria OrderRecord (lead)
       ├─ suporte_pos_venda   →  orquestrador carrega orderRelacionada
       ├─ orcamento           →  UI mostra preços, sem criar pedido
       ├─ duvida              →  UI sugere FAQ, sem criar pedido
       └─ outro               →  UI modo livre, sem pipeline
```

| Programa | Recebe | Faz | Manda para |
| --- | --- | --- | --- |
| `ClassificarIntencao` | `chatId`, `textoUltimaMensagem`, `historicoCliente`, `pedidosAtivos`, `sinaisOuvinte` | Determina `tipo` + `confianca`; se pós-venda, identifica `orderRelacionada` | `comercialPipelineOrchestrator` (passo 0) |

---

## Lógica

### Linha do fluxo

```
texto + fatos do cliente  →  ClassificarIntencao  →  { tipo, confianca, orderRelacionada? }
```

### Contrato

**Entrada**

- `chatId`: `string` — conversa ativa.
- `textoUltimaMensagem`: `string` — última mensagem do cliente (trim, lowercase). Pode ser vazio se mensagem for mídia (foto, áudio, emoji).
- `historicoCliente`:
  - `comprasAtivas`: `number` — quantidade de compras registradas (PurchaseDB ACTIVE).
  - `ultimaCompra`: `{ purchaseDate: Date; items: string[] } | null`
  - `temMensagensCapturadas`: `boolean` — se MessageDB tem mensagens deste chat.
- `pedidosAtivos`: `OrderRecordV2[]` — pedidos com status `open` ou `awaiting_payment` deste cliente.
- `sinaisOuvinte`: do `CustomerProfileDB`:
  - `preferenciasProduto?`: `string[]` — produtos extraídos pelo Ouvinte.
  - `enderecoEntrega?`: `string`
  - `formaPagamentoPreferida?`: `string[]`

**Dependência externa (agrupada)**

- Nenhuma além das entradas acima. O programa é puro (sem I/O).

**Saída**

- `resultado`: `ClassificacaoIntencao`
  - `tipo`: `IntencaoTipo`
  - `confianca`: `'alta' | 'media' | 'baixa'`
  - `orderRelacionada?`: `OrderRecordV2` — preenchido se `tipo === 'suporte_pos_venda'` e há exatamente 1 pedido ativo.

**Erros**

- `INVALID_INPUT` → `chatId` vazio.
- `MULTIPLE_ACTIVE_ORDERS` → `suporte_pos_venda` com mais de 1 pedido ativo (ambiguidade). Devolve `tipo = 'suporte_pos_venda'` mas sem `orderRelacionada`; a UI deve listar os pedidos para o atendente escolher.

### Regras (em ordem de prioridade)

#### R1 — Pós-venda

**Se** `pedidosAtivos.length > 0` **e** o texto contém ao menos um trigger de pós-venda **então** `tipo = 'suporte_pos_venda'`.

Triggers de pós-venda (case-insensitive, sem acento):

| Categoria | Palavras/expressões |
|---|---|
| Status | `status`, `cadê`, `cade`, `onde está`, `onde ta`, `chegou`, `chega`, `saiu`, `saiu pra entrega`, `demorando`, `atrasou`, `atrasado` |
| Entrega | `entrega`, `entregador`, `entregue`, `moto`, `motoqueiro`, `endereço`, `endereco`, `bairro`, `rua` |
| Pagamento | `paguei`, `pagamento`, `pix`, `comprovante`, `comprovou`, `transferi`, `depositei`, `crédito`, `credito`, `débito`, `debito` |
| Reclamação | `veio errado`, `faltou`, `trocar`, `troca`, `devolver`, `devolução`, `reembolso`, `problema`, `errado`, `estragado` |
| Confirmação | `já paguei`, `ja paguei`, `ta pago`, `tá pago`, `conforme`, `ok`, `certo` |

**Se** houver mais de 1 pedido ativo → `MULTIPLE_ACTIVE_ORDERS` (sem `orderRelacionada`).  
**Se** exatamente 1 pedido ativo → `orderRelacionada` populado.

**Confiança**: `media` (sempre — requer revisão do atendente para confirmar).

#### R2 — Compra nova

**Se** R1 não disparou **e** (`sinaisOuvinte.preferenciasProduto` tem ao menos 1 item com match no catálogo **ou** texto contém trigger de compra + produto identificável por regex) **então** `tipo = 'compra_nova'`.

Triggers de compra (case-insensitive, sem acento):

| Padrão | Exemplo |
|---|---|
| `(quero\|queria\|gostaria\|vou querer\|vou pedir\|pedir\|quisesse)\s+(.+)` | `"quero dois pães"` |
| `(me vê\|me ve\|me da\|me dá)\s+(.+)` | `"me vê um café"` |
| `(manda\|envia)\s+(.+)` | `"manda 3 integral"` |
| `(tem como\|você tem\|voces tem\|tu tem)\s+(.+)` com produto | `"tem como fazer 2 de abobora?"` |
| `(quanto é\|qual o preço\|preço do\|preço da)\s+(.+)` **e** texto tem verbo de querer em seguida | `"quanto é o integral? vou querer 2"` |

Produto identificável = uma das condições:
- Ouvinte já extraiu `preferenciasProduto` deste chat.
- Regex detecta substantivo após trigger (mínimo 3 caracteres, sem ser stop word: `uma coisa`, `algo`, `nada`, `isso`, `aquilo`).

**Confiança**:  
- `alta`: trigger word + produto com match no catálogo.  
- `media`: trigger word ou produto, mas não ambos.  
- `baixa`: apenas regex, produto ambíguo.

#### R3 — Orçamento

**Se** R1 e R2 não dispararam **e** texto contém pergunta de preço/valor sem trigger de compra explícito **então** `tipo = 'orcamento'`.

Triggers de orçamento:

| Padrão | Exemplo |
|---|---|
| `(quanto é\|qual o valor\|qual o preço\|ta quanto\|tá quanto)\s+(.+)` sem verbo de querer | `"quanto é o pão?"` |
| `(preço\|valor\|custa)\s+(.+)` no fim da frase | `"o preço do café"` |
| `(faz orçamento\|orçamento\|orcar\|orçar)` | `"faz orçamento pra festa?"` |
| `(qual o valor\|valor do)\s+(.+)` sem intenção clara | `"qual o valor do integral?"` |

**Confiança**: `media` (pergunta de preço, não necessariamente compra).

#### R4 — Dúvida

**Se** R1, R2 e R3 não dispararam **e** texto tem estrutura de pergunta sem produto OU é pergunta genérica sobre o negócio **então** `tipo = 'duvida'`.

Triggers de dúvida:

| Padrão | Exemplo |
|---|---|
| Termina com `?` e não tem produto | `"vocês abrem amanhã?"` |
| `(como\|onde\|qual\|quem\|quando\|por que\|pq)\s+` sem produto | `"como funciona o pedido?"` |
| `(vocês\|voce\|tem\|faz\|fazem)\s+(.+)` sem produto alimentício | `"vocês entregam aqui?"` |
| Pergunta curta < 20 caracteres | `"aceita VR?"` |

**Confiança**: `baixa` (requer interpretação do atendente).

#### R5 — Outro (fallback)

**Se** nenhuma regra anterior disparou **então** `tipo = 'outro'`.

Inclui: emoji, foto, áudio, sticker, saudação (`oi`, `bom dia`, `boa tarde`), texto genérico sem intenção identificável.

**Confiança**: `baixa`.

---

### Regras de reclassificação

- **Reclassificação a cada turno**: `ClassificarIntencao` é chamada sempre que uma nova mensagem do cliente é capturada.
- **Se** `tipo` muda entre turnos (ex.: `compra_nova` → `suporte_pos_venda`) **então** a UI reflete o novo tipo. O pedido em `draft` **não** é descartado — permanece no histórico do cliente.
- **Se** a nova mensagem é vazia (mídia sem texto) **então** mantém a classificação anterior (não reclassificar como `outro`).

### Edge cases (Se X → Y)

- Mensagem vazia (foto/áudio/emoji sem legenda) → mantém classificação anterior. Se for a primeira mensagem → `outro`.
- Cliente com 3 pedidos ativos e manda "cadê?" → `suporte_pos_venda` + `MULTIPLE_ACTIVE_ORDERS`. UI lista opções.
- Cliente diz "quero 2 integral" mas Ouvinte ainda não processou → R2 dispara por trigger word + regex, confiança `media`.
- "Quanto é?" sem produto → R4 (`duvida`), não R3 (`orcamento`).
- "Bom dia, quero café" → R2 (`compra_nova`), trigger word prevalece sobre saudação.
- "Paguei, olha o comprovante" + pedido ativo → R1 (`suporte_pos_venda`), mesmo sem "cadê" ou "status".
- Texto com múltiplas intenções ("queria 2 pães e cadê meu pedido de ontem?") → primeira regra que casa vence (R1 → `suporte_pos_venda`).
- Cliente novo (0 compras, 0 mensagens) manda primeira msg → R2 a R5 conforme texto. Sempre `lead` se R2.

### Critérios de aceitação

- `"quero 2 integral e 1 café"` com Ouvinte tendo `preferenciasProduto` → `compra_nova`, `alta`.
- `"cadê meu pedido?"` com 1 pedido ativo → `suporte_pos_venda`, `media`, `orderRelacionada` populado.
- `"quanto é o pão?"` sem trigger de compra → `orcamento`, `media`.
- `"vocês abrem amanhã?"` → `duvida`, `baixa`.
- `"bom dia"` → `outro`, `baixa`.
- Foto sem legenda → `outro` (se primeira msg) ou mantém anterior (se reclassificação).
- Função determinística: mesmas entradas → mesma saída.
- Testes unitários cobrem todas as 5 regras + 3 edge cases.

### Escopo fora

- Classificação por LLM (v2, com embedding da conversa).
- Análise de sentimento do cliente.
- Detecção de urgência.
- Integração com base de conhecimento para resposta automática a dúvidas.
