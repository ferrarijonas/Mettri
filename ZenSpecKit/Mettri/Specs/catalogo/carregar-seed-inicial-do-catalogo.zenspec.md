# Carregar seed inicial do catálogo (`carregarSeedInicialCatalogo`)

Esta feature existe para que o Mettri comece com produtos mockados úteis para teste do pipeline comercial, sem depender de cadastro manual no primeiro uso.

---

## Conceito

`carregarSeedInicialCatalogo` popula o catálogo com um pacote mínimo de produtos quando a conta ainda não possui itens.  
Metáfora: é como montar a vitrine com 3 pães antes de abrir a padaria.

Panorama: [spec.md](spec.md).

---

## Lógica

### Linha do fluxo

```
accountId + catálogo vazio?  →  carregarSeedInicialCatalogo  →  produtos mock persistidos
```

### Contrato

**Entrada**

- `accountId: string`
- `deps`: `CatalogoSeedDeps`
  - `catalogoRepository.listByAccount`
  - `catalogoRepository.insert`
  - `clock.nowIso`
  - `idFactory.newId`

**Saída**

- `saida`: `CatalogoSeedOutput`
  - `seedApplied: boolean`
  - `insertedCount: number`
  - `products: CatalogProduct[]`

**Erros**

- `INVALID_INPUT` -> `accountId` vazio.
- `REPOSITORY_ERROR` -> falha de leitura ou escrita.

### Regras

- **Se** `accountId` vier vazio após trim **então** falhar com `INVALID_INPUT`.
- **Se** já existir pelo menos 1 produto na conta **então** não aplicar seed (`seedApplied = false`, `insertedCount = 0`).
- **Se** catálogo da conta estiver vazio **então** inserir exatamente 3 produtos mock com `ativo = true`.
- **Se** seed for aplicada **então** retornar `seedApplied = true` e `insertedCount = 3`.
- **Se** ocorrer erro em qualquer inserção **então** falhar explicitamente (sem sucesso parcial silencioso).

### Seed oficial (v1)

Todos os produtos abaixo usam:

- `estoqueDisponivel = null` (estoque não controlado).
- `ativo = true`.
- `version = 1`.

Produtos:

1. `sku = "PAO-MULTIGRAOS"`  
   `nome = "Pão Multigrãos"`  
   `precoCentavos = 2600`

2. `sku = "PAO-ABOBORA-GIRASSOL"`  
   `nome = "Pão de Abóbora & Girassol"`  
   `precoCentavos = 2600`

3. `sku = "PAO-100-INTEGRAL"`  
   `nome = "Pão 100% Integral"`  
   `precoCentavos = 3200`

### Edge cases (Se X -> Y)

- Conta já tem produtos e seed é chamada novamente -> não duplica produtos.
- Reexecução após seed aplicada -> saída idempotente (`seedApplied = false`).

### Critérios de aceitação

- Em conta nova, após execução válida, existem exatamente 3 produtos seed.
- Em conta já populada, seed não altera catálogo existente.

### Escopo fora

- Atualizar preço automaticamente.
- Troca dinâmica de seed por segmento de negócio.
