# Modelo de pedido unificado (`OrderRecordV2`)

Esta feature existe para que **todos** os programas do domínio de atendimento — `ClassificarIntencao`, `Venda`, `Produtos`, `RegistrarPedido`, `Pagamentos`, o módulo `pedidos` e o painel de atendimento — partilhem **um único contrato de pedido** com ciclo de vida completo (`lead` → `draft` → `open` → `completed`), substituindo a fragmentação atual (`OrderDB` atual + `PurchaseDB` separado).

---

## Conceito

`OrderRecordV2` é a **única fonte de verdade** sobre pedidos no Mettri. Um registro cobre desde a primeira intenção detectada numa conversa até o pedido entregue ou cancelado. O campo `timeline[]` garante rastro imutável de cada transição. O campo `intencao` classifica o tipo de conversa que originou o pedido (compra nova, pós-venda, orçamento, dúvida).

**Número sequencial**: gerado pelo `OrderDB`, sequencial por conta (`PED-0001` … `PED-N`), nunca reutilizado, atribuído na criação do registro em `lead`.

**Mutabilidade**: `lead` e `draft` são mutáveis (itens, quantidades, observações). A partir de `open`, o registro é imutável — qualquer alteração gera um novo pedido.

Panorama: [spec.md](spec.md) (Comercial + Pedidos). Alinha-se com [project_context.md §3.5](../../project_context.md) (entidade `Order` canónica).

---

## Pipeline & fluxos

```
ClassificarIntencao (compra_nova)
       │
       ▼
  OrderRecordV2 (status: 'lead')
       │
       │  Ouvinte detecta produto → status: 'draft'
       ▼
  OrderRecordV2 (status: 'draft')  ← mutável: addItem, removeItem, updateQty
       │
       │  Atendente confirma → status: 'open'
       ▼
  OrderRecordV2 (status: 'open')   ← imutável
       │
       ├─ Cliente cancela → status: 'cancelled'
       ├─ Pagamento confirmado → status: 'awaiting_payment'
       └─ Sem atividade 7d (draft) → status: 'lost'
              │
              ▼
       OrderRecordV2 (status: 'awaiting_payment')
              │
              ▼
       OrderRecordV2 (status: 'completed')
```

| Programa | Recebe | Faz | Manda para |
| --- | --- | --- | --- |
| `OrderDB.createOrder` | `chatId`, `clientKey`, `intencao` | Cria registro com `numeroSequencial`, status `lead`, timeline inicial | `getAtendimentoViewModel` |
| `OrderDB.advanceStatus` | `orderId`, `nextStatus`, `motivo?` | Valida transição; atualiza status, timeline | re-render da UI |
| `OrderDB.addItem / removeItem / updateQty` | `orderId`, item | Só em `draft`; recalcula totais | re-render da UI |
| `OrderDB.substituteItem` | `orderId`, `oldSkuId`, `newItem` | Remove antigo + adiciona novo atòmicamente | re-render da UI |

---

## Lógica

### Linha do fluxo

```
intencao detectada  →  OrderDB  →  OrderRecordV2 (lead)
mensagens + Ouvinte →  OrderDB  →  draft (mutável)
humano confirma     →  OrderDB  →  open (imutável)
pagamento           →  OrderDB  →  completed
```

### Contrato

**Tipo `IntencaoTipo`**

```typescript
type IntencaoTipo = 'compra_nova' | 'suporte_pos_venda' | 'orcamento' | 'duvida' | 'outro'
```

Ver [classificar-intencao-conversa.zenspec.md](classificar-intencao-conversa.zenspec.md).

**Tipo `OrderStatusUnificado`**

```typescript
type OrderStatusUnificado =
  | 'lead'              // intenção detectada, sem itens ainda
  | 'draft'             // itens sendo montados (mutável pelo atendente)
  | 'open'              // pedido confirmado (imutável)
  | 'awaiting_payment'  // aguardando pagamento
  | 'completed'         // pago/entregue
  | 'cancelled'         // cancelado (com motivo)
  | 'lost'              // draft sem atividade >7 dias (automático)
```

**Entidade `OrderRecordV2`**

```typescript
interface OrderTimelineEntry {
  statusAnterior: OrderStatusUnificado | null  // null = criação inicial
  statusNovo: OrderStatusUnificado
  iso: string      // ISO 8601 UTC
  motivo?: string  // ex.: "cliente desistiu", "pagamento confirmado"
}

interface OrderItemStruct {
  skuId: string
  nome: string
  quantidade: number
  precoUnitarioCentavos: number
  precoTotalCentavos: number  // = quantidade × precoUnitarioCentavos
}

interface OrderRecordV2 {
  orderId: string                // ex.: "ord_1234567890_abc123" (interno)
  numeroSequencial: number       // ex.: 42 (global por conta, display "PED-0042")
  clientKey: string              // do ClientDB
  chatId: string                 // conversa WhatsApp de origem
  intencao: IntencaoTipo         // classificação do 1º turno
  status: OrderStatusUnificado   // estado atual

  itens: OrderItemStruct[]       // vazio em 'lead'

  // Totais
  subtotalCentavos: number
  entregaCentavos: number
  totalCentavos: number

  // Funil (5 etapas, preenchidas pelo Ouvinte)
  funil: {
    produto:   { estado: 'ok' | 'pendente'; valor: string | null }
    endereco:  { estado: 'ok' | 'pendente'; valor: string | null }
    pagamento: { estado: 'ok' | 'pendente'; valor: string | null }
    prazo:     { estado: 'ok' | 'pendente'; valor: string | null }
    fechar:    { estado: 'ok' | 'pendente'; valor: string | null }
  }

  observacoes?: string           // texto livre do atendente

  // Timeline imutável de transições
  timeline: OrderTimelineEntry[]

  // Pagamento (opcional, preenchido por Pagamentos)
  pagamentoStatus?: 'pendente' | 'pago' | 'recusado'
  pagamentoMetodo?: string       // "PIX", "cartão", etc.

  createdAtIso: string           // ISO 8601 UTC
  updatedAtIso: string           // ISO 8601 UTC
}
```

**Erros**

- `INVALID_TRANSITION` → transição não permitida (ex.: `completed` → `draft`).
- `IMMUTABLE` → tentativa de alterar itens em status `open`+.
- `ORDER_NOT_FOUND` → `orderId` inexistente.
- `DUPLICATE_ITEM` → `skuId` já existe nos itens (usar `updateQty` ou `substitute`).

### Regras

- R1 — **`numeroSequencial`**: gerado pelo `OrderDB` na criação (`lead`), sequencial, global por conta, nunca reutilizado. Mesmo pedidos `cancelled` ou `lost` mantêm o número. `orderId` interno é independente (formato `ord_ts_random`).
- R2 — **`lead → draft`**: **se** `classificarIntencao` retorna `compra_nova` e o Ouvinte detecta pelo menos 1 produto com match no catálogo **então** o status avança para `draft`. Itens do pedido automático são persistidos via `addItem`.
- R3 — **`draft → open`**: **se** o atendente clica "Confirmar pedido" **então** status avança para `open`. A partir deste ponto, itens são imutáveis.
- R4 — **`draft → lost`**: **se** `status === 'draft'` e `updatedAtIso` é mais antigo que 7 dias e não houve mensagem nova no chat neste período **então** status avança para `lost`. Verificação ocorre no `getAtendimentoViewModel()` ou job de limpeza.
- R5 — **`open → awaiting_payment`**: **se** pagamento é registrado via `Pagamentos` **então** status avança.
- R6 — **`awaiting_payment → completed`**: **se** pagamento é confirmado (manual ou API) **então** status avança.
- R7 — **`open → cancelled`**: **se** atendente cancela com motivo **então** status avança. Motivo obrigatório na `timeline`.
- R8 — **`draft → cancelled`**: **se** atendente cancela draft com motivo **então** status avança.
- R9 — **Mutabilidade**: `addItem`, `removeItem`, `updateQty`, `substituteItem`, `addObservacao` só aceitos em `lead` e `draft`. Em `open`+ retornam `IMMUTABLE`.
- R10 — **Recálculo de totais**: `subtotalCentavos = Σ(itens[].precoTotalCentavos)`. `totalCentavos = subtotalCentavos + entregaCentavos`. Recalculados a cada `addItem`, `removeItem`, `updateQty`, `substituteItem`.
- R11 — **Timeline imutável**: cada transição de status gera uma entrada na `timeline[]`. Entradas nunca são removidas ou alteradas.
- R12 — **Sequencial zero**: se não houver pedidos anteriores na conta, o primeiro `numeroSequencial` é `1`.

### Transições válidas

| De | Para | Quem dispara |
| --- | --- | --- |
| — (criação) | `lead` | `ClassificarIntencao` (automático) |
| `lead` | `draft` | Ouvinte detecta produto (automático) |
| `draft` | `open` | Atendente confirma (manual) |
| `draft` | `cancelled` | Atendente cancela (manual) |
| `draft` | `lost` | Sistema, 7d sem atividade (automático) |
| `open` | `awaiting_payment` | `Pagamentos` (manual ou automático) |
| `open` | `cancelled` | Atendente cancela (manual) |
| `awaiting_payment` | `completed` | Pagamento confirmado (manual ou API) |
| `awaiting_payment` | `cancelled` | Atendente cancela (manual) |

Qualquer transição não listada → `INVALID_TRANSITION`.

### Edge cases (Se X → Y)

- Pedido `lead` sem produto por 3 turnos → permanece `lead`; não avança automaticamente.
- Cliente com múltiplos pedidos `draft` concorrentes → permitido (ex.: cliente pede coisas diferentes em dias diferentes). Cada pedido é independente.
- Pedido `completed` precisa de alteração → criar novo pedido `lead` com referência ao anterior (campo `pedidoOrigem?` — v2 futura).
- `substituteItem` em `draft` quando `oldSkuId` não existe → `ORDER_NOT_FOUND` para o item.
- `addItem` com `skuId` já presente → `DUPLICATE_ITEM` (usar `updateQty` para alterar quantidade).
- `updateQty` com valor `0` → equivale a `removeItem`.
- `updateQty` com valor negativo → erro de validação.
- Catálogo indisponível durante `buildPedidoAuto` → itens entram sem `precoUnitarioCentavos` (0), nome extraído do texto.
- Dois atendentes modificando o mesmo `draft` simultaneamente → última escrita vence (IndexedDB). Fora do escopo para MVP.
- Migração retroativa de `OrderRecord` antigo → `status` mapeado (`open` → `open`, `awaiting_payment` → `awaiting_payment`, `closed` → `completed`), `numeroSequencial` gerado por `createdAtIso`, `itens` vazio (preencher de `itemsSummary` se possível).

### Critérios de aceitação

- `OrderRecordV2` contém todos os campos definidos no contrato.
- `numeroSequencial` é sequencial, global, nunca reutilizado.
- Transição inválida lança `INVALID_TRANSITION` com mensagem.
- `addItem` em `open` lança `IMMUTABLE`.
- Timeline contém entrada para cada transição de status.
- `subtotalCentavos` é recalculado corretamente após `addItem`, `removeItem`, `updateQty`.
- Testes cobrem todas as transições válidas e pelo menos 3 inválidas.

### Escopo fora

- Referência a `pedidoOrigem` em novo pedido pós-alteração (v2).
- Conciliação com PurchaseDB (migração é job único, não parte do contrato).
- Lock otimista para edição concorrente (IndexedDB single-writer por design).
- Integração com nota fiscal / ERP.
