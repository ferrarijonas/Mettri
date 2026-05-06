# Salvar produto do catálogo (`salvarProdutoCatalogo`)

Esta feature existe para que o operador consiga criar ou atualizar produto com validação determinística, sem deixar dados quebrados para os agentes.

---

## Conceito

`salvarProdutoCatalogo` faz upsert de produto: cria quando não existe e atualiza quando existe.  
Ele valida os campos mínimos antes de persistir.

Panorama: [spec.md](spec.md).

---

## Lógica

### Linha do fluxo

```
ProductInput  →  salvarProdutoCatalogo  →  produto persistido
```

### Contrato

**Entrada**

- `input`: `ProductInput`
  - `productId?: string`
  - `accountId: string`
  - `sku: string`
  - `nome: string`
  - `descricao?: string | null`
  - `precoCentavos: number`
  - `estoqueDisponivel?: number | null`
  - `ativo?: boolean`
- `deps`: `CatalogoSaveDeps`
  - `catalogoRepository.getById`
  - `catalogoRepository.getBySku`
  - `catalogoRepository.insert`
  - `catalogoRepository.update`
  - `clock.nowIso`
  - `idFactory.newId`

**Saída**

- `saida`: `CatalogProduct`

**Erros**

- `INVALID_INPUT` -> campo obrigatório inválido.
- `DUPLICATE_SKU` -> SKU já existe na conta para outro `productId`.
- `NOT_FOUND` -> `productId` informado não existe para atualizar.
- `REPOSITORY_ERROR` -> falha de persistência.

### Regras

- **Se** `accountId`, `sku` ou `nome` vier vazio após trim **então** falhar com `INVALID_INPUT`.
- **Se** `precoCentavos < 0` **então** falhar com `INVALID_INPUT`.
- **Se** `estoqueDisponivel` existir e for `< 0` **então** falhar com `INVALID_STOCK`.
- **Se** `sku` já existir para outro produto da mesma conta **então** falhar com `DUPLICATE_SKU`.
- **Se** `productId` não for informado **então** criar novo registro com `version = 1`.
- **Se** `productId` for informado e existir **então** atualizar registro e incrementar `version` em `+1`.

### Edge cases (Se X -> Y)

- `descricao` ausente -> persistir `null`.
- `ativo` ausente na criação -> assumir `true`.
- `estoqueDisponivel` ausente -> persistir `null`.

### Critérios de aceitação

- Criação válida retorna `productId` novo e `version = 1`.
- Atualização válida preserva `productId` e incrementa `version`.
- SKU duplicado nunca é persistido.

### Escopo fora

- Conversão de moeda.
- Regras fiscais.
