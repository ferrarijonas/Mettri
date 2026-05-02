# Fornecer snapshot de catálogo para agentes (`fornecerCatalogoParaAgentes`)

Esta feature existe para que os agentes recebam uma visão simples, estável e segura do catálogo ativo, sem depender de tela e sem risco de inventar disponibilidade.

---

## Conceito

`fornecerCatalogoParaAgentes` transforma produtos ativos em um snapshot leve para consumo de IA.  
O snapshot é determinístico e somente leitura.

Panorama: [spec.md](spec.md).

---

## Lógica

### Linha do fluxo

```
accountId  →  fornecerCatalogoParaAgentes  →  CatalogoSnapshotIA
```

### Contrato

**Entrada**

- `accountId: string`
- `deps`: `CatalogSnapshotDeps`
  - `catalogoRepository.listByAccount`
  - `clock.nowIso`

**Saída**

- `saida`: `CatalogoSnapshotIA`
  - `accountId: string`
  - `generatedAt: string` (ISO)
  - `catalogoDisponivel: boolean`
  - `produtosAtivos: ProdutoSnapshotIA[]`

`ProdutoSnapshotIA`:

- `productId: string`
- `sku: string`
- `nome: string`
- `precoCentavos: number`
- `estoqueDisponivel: number | null`
- `confiancaBase: number` (valor fixo `1` para dados catalogados)

**Erros**

- `INVALID_INPUT` -> `accountId` vazio.
- `REPOSITORY_ERROR` -> falha de leitura.

### Regras

- **Se** `accountId` vier vazio após trim **então** falhar com `INVALID_INPUT`.
- **Se** não houver produto ativo **então** retornar `catalogoDisponivel = false` e `produtosAtivos = []`.
- **Se** houver produto ativo **então** retornar `catalogoDisponivel = true`.
- **Se** produto estiver `ativo = false` **então** ele não entra no snapshot.
- **Se** houver múltiplos produtos ativos **então** ordenar por `nome` asc, depois `sku` asc.

### Edge cases (Se X -> Y)

- `estoqueDisponivel = null` -> manter `null` no snapshot.
- Produto com nome igual e SKU diferente -> ambos entram, mantendo ordenação estável.
- Produto com `ativo = false` -> não entra no snapshot, mesmo que tenha preço válido.

### Critérios de aceitação

- Snapshot de mesma conta e mesmo estado retorna payload idêntico (exceto `generatedAt`).
- Pipeline comercial consegue consumir `produtosAtivos` sem transformação adicional obrigatória.

### Escopo fora

- Match semântico de texto (vive no programa `Produtos` do atendimento).
