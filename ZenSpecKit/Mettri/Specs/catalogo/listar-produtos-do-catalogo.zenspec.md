# Listar produtos do catálogo (`listarProdutosCatalogo`)

Esta feature existe para que o painel mostre produtos da conta de forma determinística e para que o operador veja status de disponibilidade sem cálculo manual.

---

## Conceito

`listarProdutosCatalogo` é leitura pura do catálogo.  
Ele devolve uma lista ordenada, sem alterar estado.

Panorama: [spec.md](spec.md).

---

## Lógica

### Linha do fluxo

```
accountId + filtro?  →  listarProdutosCatalogo  →  lista de produtos
```

### Contrato

**Entrada**

- `accountId: string`
- `filtro`: `CatalogoListFilter | null`
  - `search?: string`
  - `ativo?: boolean`
- `deps`: `CatalogoListDeps`
  - `catalogoRepository.listByAccount`

**Saída**

- `saida`: `CatalogoListOutput`
  - `products: CatalogProduct[]`
  - `total: number`

**Erros**

- `INVALID_INPUT` -> `accountId` vazio.
- `REPOSITORY_ERROR` -> erro de leitura.

### Regras

- **Se** `accountId` for vazio após trim **então** falhar com `INVALID_INPUT`.
- **Se** não houver produtos **então** retornar `products = []` e `total = 0`.
- **Se** houver filtro por `ativo` **então** aplicar filtro exato.
- **Se** houver `search` **então** filtrar por `nome` ou `sku` (case-insensitive).
- **Se** houver produtos no resultado **então** ordenar por `updatedAt` desc, depois `nome` asc.

### Edge cases (Se X -> Y)

- `search` com apenas espaços -> ignorar busca textual.
- Produto com `descricao = null` -> manter no resultado sem transformação.

### Critérios de aceitação

- Duas execuções com mesmo estado retornam mesma ordem e mesmo total.
- Filtro de `ativo` não altera registros; só leitura.

### Escopo fora

- Paginação remota.
- Busca semântica por IA.
