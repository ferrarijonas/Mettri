# Confirmar pagamento (`Pagamentos`)

Esta feature existe para que o estado **pendente / pago / recusado** de um pedido seja atualizado **em paralelo** ao fluxo de rascunho de mensagem, sem bloquear `SugestaoWhatsApp`.

---

## Conceito

Recebe identificador de pedido e evidência (manual hoje; API futura). Não altera `estadoVenda` nem mensagens.

Panorama: [spec.md](spec.md) (Comercial).

---

## Pipeline & fluxos

```
pedidoId + evidencia  →  Pagamentos  →  PagamentoEstado
```

| Programa | Recebe | Faz | Manda para |
| --- | --- | --- | --- |
| `Pagamentos` | `orderId`, `evidencia` | Atualiza estado | integração financeira opcional |

---

## Lógica

### Linha do fluxo

```
orderId + evidencia  →  Pagamentos  →  estado
```

### Contrato

**Entrada**

- `orderId`: `string`
- `evidencia`: `{ tipo: 'manual' | 'api'; payload: string }`

**Dependência externa**

- `deps`: `{ orderDB: OrderDB }` — carrega e atualiza `OrderRecordV2` (ver [modelo-pedido-unificado.zenspec.md](modelo-pedido-unificado.zenspec.md)).

**Saída**

- `estado`: `'pendente' | 'pago' | 'recusado' | 'em_analise'`
- Transição de status no `OrderRecordV2`: `awaiting_payment → completed` quando estado é `'pago'`. Campos `pagamentoStatus` e `pagamentoMetodo` atualizados.

**Erros**

- `ORDER_NOT_FOUND` → `orderId` inexistente.
- `INVALID_EVIDENCE` → payload vazio quando obrigatório.

### Regras

- **Se** `ORDER_NOT_FOUND` **então** falha explícita; não alterar outros pedidos.

### Edge cases (Se X → Y)

- Chamada duplicada com mesma evidência → idempotência **ou** segunda gravação rejeitada — política única documentada na implementação.

### Critérios de aceitação

- Transições válidas enumeradas num único mapa na implementação.
- Não bloqueia orquestrador comercial quando invocado em paralelo.

### Escopo fora

- Gateway de cartão / Pix automático.
- Conciliação bancária.
