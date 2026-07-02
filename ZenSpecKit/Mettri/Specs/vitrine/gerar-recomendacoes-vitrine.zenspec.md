---
status: obsoleto
---

# Gerar recomendações da vitrine (`gerarRecomendacoesVitrine`)

Esta ZenSpec define o programa principal do módulo `vitrine`: montar candidatos, pontuar, aplicar guardrails e devolver ranking final.

---

## Contrato

### Entrada

- `input: VitrineEntrada`
  - `accountId: string`
  - `chatId: string`
  - `instanteIso: string`
  - `catalogoSnapshot: CatalogoSnapshotIA`
  - `promocoesAtivas: PromoSaida`
  - `clienteContexto: object`
  - `turnoContexto: object`
  - `politicas: object`
  - `topN?: number` (default `3`)

### Saída

- `output: VitrineSaida`
  - `generatedAtIso: string`
  - `version: string`
  - `recomendacoes: VitrineItem[]`

### Erros

- `INVALID_INPUT`
- `UPSTREAM_ERROR`

---

## Regras

- **Se** `accountId` ou `chatId` vier vazio **então** retornar `INVALID_INPUT`.
- **Se** `topN` não for informado **então** usar `3`.
- **Se** catálogo estiver vazio **então** retornar `recomendacoes = []` sem erro.
- **Se** nenhum candidato passar guardrails **então** retornar lista vazia determinística.
- **Se** dois itens empatam no score **então** desempatar por `skuId` asc.

---

## Pipeline interno

```
VitrineEntrada
  -> montar candidatos
  -> pontuarCandidatoVitrine (por item)
  -> aplicarGuardrailsVitrine
  -> ordenar e limitar topN
  -> VitrineSaida
```

---

## Invariantes

- Toda recomendação deve ter `skuId`, `score` e ao menos 1 `motivo`.
- `recomendacoes.length <= topN`.
- Saída sempre serializável em JSON simples.

---

## Edge cases

- Promo ativa para SKU inexistente no catálogo -> ignorar promo para esse SKU.
- `validUntilIso` vencido no instante da chamada -> item não entra.
- Campo opcional ausente em `clienteContexto` -> usar fallback neutro (peso 0 para esse sinal).

---

## Costura pendente

- Falta contrato de shape mínimo de `clienteContexto` vindo de `cadastro/spec.md`.
- O `EnriquecimentoComercial` já transporta `ProdutosSaida` (incl. `confiancaMaxima` / matches); falta **afinar** o uso de confiança por SKU no `pontuarCandidatoVitrine` quando a implementação existir.
