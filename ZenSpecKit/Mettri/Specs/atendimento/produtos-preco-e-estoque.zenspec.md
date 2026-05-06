# Produtos, preço e estoque (`Produtos`)

Esta feature existe para que a vitrine, `ContextoResposta` e `Venda` recebam **match de produto**, **preço de referência** e **confiança** a partir do texto do turno e do catálogo, sem o LLM inventar preço como fato.

---

## Conceito

Transforma texto + catálogo (quando existir) em zero ou mais candidatos com **score de confiança**. MVP: catálogo pode estar **ausente** → saída vazia com `catalogoDisponivel = false`.

Panorama: [spec.md](spec.md) (Comercial).

---

## Pipeline & fluxos

```
turno + clienteResolvido + catálogo?  →  Produtos  →  ProdutosSaida
```

| Programa | Recebe | Faz | Manda para |
| --- | --- | --- | --- |
| `Produtos` | `textoTurno`, `clienteResolvido`, `catalogo?` | Match, snapshot de preço, confiança | `fornecerVitrineParaPipelineComercial` (via orquestrador) |

---

## Lógica

### Linha do fluxo

```
textoTurno + catalogoOpcional  →  Produtos  →  ProdutosSaida
```

### Contrato

**Entrada**

- `textoTurno`: `string` — mensagem atual do cliente (trim aplicado pelo chamador ou aqui; documentar uma política única).
- `clienteResolvido`: `ClienteResolvido` — ver [identificar-cliente.zenspec.md](identificar-cliente.zenspec.md).
- `catalogo`: `CatalogoConta | null` — **(opcional)** lista de SKU/preço/stock da conta; tipo `CatalogoConta` definido na implementação; `null` em MVP.

**Saída**

- `saida`: `ProdutosSaida` — tipo:
  - `matches`: `MatchProduto[]` — pode ser `[]`.
  - `confiancaMaxima`: `number` — em `[0,1]`; se sem matches, `0`.
  - `catalogoDisponivel`: `boolean`

`MatchProduto` (mínimo):

- `skuId`: `string`
- `label`: `string`
- `precoUnitario`: `number | null`
- `stockDisponivel`: `number | null`
- `confianca`: `number`

**Erros**

- `INVALID_INPUT` → `textoTurno` vazio após política de trim.

### Regras

- **Se** `catalogo` for `null` **então** `matches = []`, `catalogoDisponivel = false`, `confiancaMaxima = 0`.
- **Se** `confianca` de melhor match `< limiar` (constante na implementação) **então** `ContextoResposta` / prompt **não** deve afirmar preço como fato (reforçado na filha `ContextoResposta`).

### Edge cases (Se X → Y)

- Texto ambíguo com vários matches → devolver lista ordenada por `confianca` descendente; não escolher silenciosamente um único produto sem regra explícita na implementação.

### Critérios de aceitação

- Sem catálogo, saída válida e determinística.
- Com catálogo fixo e texto fixo, saída idêntica entre execuções.

### Escopo fora

- Importação de catálogo.
- Lista factual de promoções (programa `Promo`, invocado **dentro** da vitrine — ver [orquestrar-pipeline-comercial-whatsapp.zenspec.md](orquestrar-pipeline-comercial-whatsapp.zenspec.md)).
