# Registrar pedido obrigatório (`RegistrarPedido`)

Esta feature existe para que um **pedido confirmado** vire **registo persistente** com dados mínimos auditáveis, sem depender só do texto do WhatsApp ou do **Registro manual de compra** (secção em [spec.md](spec.md)).

---

## Conceito

`RegistrarPedido` corre **fora** da linha principal texto→UI quando o gatilho de negócio dispara: `estadoVenda.pedidoConfirmado === true` e dados mínimos presentes. Falha explícita se faltar campo obrigatório.

---

## Pipeline & fluxos

```
PedidoConfirmado + OrderDraft  →  RegistrarPedido  →  OrderRecordV2 (draft → open)
```

| Programa | Recebe | Faz | Manda para |
| --- | --- | --- | --- |
| `RegistrarPedido` | `chatId`, `orderDraft` | Valida; transiciona `OrderRecordV2` de `draft` para `open` | eventos downstream ou — |

---

## Lógica

### Linha do fluxo

```
gatilho + OrderDraft  →  RegistrarPedido  →  OrderRecordV2 (open)
```

### Contrato

**Entrada**

- `chatId`: `string`
- `orderDraft`: `OrderRecordV2` em status `draft` — mínimo 1 item. Ver [modelo-pedido-unificado.zenspec.md](modelo-pedido-unificado.zenspec.md).

**Dependência externa (agrupada)**

- `deps`: `{ orderDB: OrderDB }`

**Implementação atual (MVP)**

O botão "Confirmar pedido" no painel de atendimento dispara `order:confirm` no `DashboardModule`, que:

1. Obtém `orderId` do `pedidoAtual` do ViewModel
2. Chama `orderDB.advanceStatus(orderId, 'open')`
3. Dispara `rerender()` para refletir o novo estado (controles de edição ocultos, status `open`)

**Saída**

- `orderRecord`: `OrderRecordV2` — agora com status `open`, timeline atualizada.

**Erros**

- `MISSING_MIN_FIELDS` → falta item (pedido sem itens).
- `IMMUTABLE` → status não é `draft` (já foi confirmado ou cancelado).
- `PERSIST_ERROR` → falha de escrita no OrderDB.

### Regras

- **Se** `estadoVenda.pedidoConfirmado !== true` **então** não chamar (pré-condição no orquestrador ou serviço).
- **Se** `OrderRecordV2.status !== 'draft'` **então** `IMMUTABLE` — pedido já foi confirmado ou cancelado.
- **Se** `OrderRecordV2.itens.length === 0` **então** `MISSING_MIN_FIELDS`.

### Edge cases (Se X → Y)

- Coexistência com **Registro manual de compra** → ambos coexistem. `RegistrarPedido` transiciona `OrderRecordV2.draft → open`. Registro manual (`PurchaseDB`) é independente.
- Migração futura: PurchaseDB legado pode eventualmente ser convertido para OrderRecordV2 `completed`, mantendo rastro.

### Critérios de aceitação

- Pedido persistido reproduzível a partir do `OrderDraft` validado.
- Erros nunca retornam `record` “meio gravado”.

### Escopo fora

- Pagamento (filha `Pagamentos`).
- Emissão de nota fiscal.
