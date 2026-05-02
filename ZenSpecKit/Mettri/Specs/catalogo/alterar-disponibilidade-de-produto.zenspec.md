# Alterar disponibilidade de produto (`alterarDisponibilidadeProdutoCatalogo`)

Esta feature existe para que o operador ligue ou desligue um produto para venda sem apagar histórico e sem quebrar referência de agentes.

---

## Conceito

`alterarDisponibilidadeProdutoCatalogo` muda apenas o estado `ativo` do produto.  
É uma atualização focal: não mexe em preço, nome ou SKU.

Panorama: [spec.md](spec.md).

---

## Lógica

### Linha do fluxo

```
productId + ativo  →  alterarDisponibilidadeProdutoCatalogo  →  produto atualizado
```

### Contrato

**Entrada**

- `input`: `SetActiveInput`
  - `accountId: string`
  - `productId: string`
  - `ativo: boolean`
- `deps`: `CatalogoSetActiveDeps`
  - `catalogoRepository.getById`
  - `catalogoRepository.update`
  - `clock.nowIso`

**Saída**

- `saida`: `CatalogProduct`

**Erros**

- `INVALID_INPUT` -> `accountId` ou `productId` vazio.
- `NOT_FOUND` -> produto não encontrado para a conta.
- `REPOSITORY_ERROR` -> falha de persistência.

### Regras

- **Se** `accountId` ou `productId` vier vazio após trim **então** falhar com `INVALID_INPUT`.
- **Se** o produto não existir na conta **então** falhar com `NOT_FOUND`.
- **Se** `ativo` já for igual ao valor atual **então** retornar produto sem nova persistência.
- **Se** `ativo` mudar **então** persistir atualização com `updatedAt` novo e `version + 1`.

### Edge cases (Se X -> Y)

- Produto já inativo e comando para inativar -> retorno idempotente sem erro.
- Produto já ativo e comando para ativar -> retorno idempotente sem erro.

### Critérios de aceitação

- Alterar `ativo` não modifica `sku`, `nome`, `precoCentavos` ou `estoqueDisponivel`.
- Produto desativado deixa de aparecer no snapshot de agentes.

### Escopo fora

- Exclusão física de produto.
