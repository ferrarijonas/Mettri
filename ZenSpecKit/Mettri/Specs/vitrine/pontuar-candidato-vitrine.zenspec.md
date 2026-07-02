---
status: obsoleto
---

# Pontuar candidato da vitrine (`pontuarCandidatoVitrine`)

Esta ZenSpec define como calcular o score de um candidato da vitrine de forma simples, explicável e determinística.

---

## Contrato

### Entrada

- `input`
  - `candidato: { skuId: string }`
  - `sinais`
    - `afinidadeCliente: number` (`0..1`)
    - `promoAtiva: boolean`
    - `urgenciaEstoque: number` (`0..1`)
    - `intencaoTurno: number` (`0..1`)
    - `riscoMargem: number` (`0..1`)
    - `saturacaoRecente: number` (`0..1`)
  - `pesos`
    - `pesoAfinidadeCliente: number`
    - `pesoPromoAtiva: number`
    - `pesoUrgenciaEstoque: number`
    - `pesoIntencaoTurno: number`
    - `pesoRiscoMargem: number`
    - `pesoSaturacaoRecente: number`

### Saída

- `output`
  - `skuId: string`
  - `score: number`
  - `motivos: VitrineMotivo[]`

### Erros

- `INVALID_INPUT`

---

## Fórmula base (MVP)

```
score =
  (afinidadeCliente * pesoAfinidadeCliente) +
  ((promoAtiva ? 1 : 0) * pesoPromoAtiva) +
  (urgenciaEstoque * pesoUrgenciaEstoque) +
  (intencaoTurno * pesoIntencaoTurno) -
  (riscoMargem * pesoRiscoMargem) -
  (saturacaoRecente * pesoSaturacaoRecente)
```

---

## Regras

- **Se** qualquer sinal vier fora de `0..1` **então** normalizar para o intervalo.
- **Se** `promoAtiva = true` **então** incluir motivo `PROMO_ATIVA`.
- **Se** `urgenciaEstoque > 0` **então** incluir motivo `ESTOQUE_BAIXO`.
- **Se** `afinidadeCliente > 0` **então** incluir motivo `MATCH_CATEGORIA_CLIENTE`.
- **Se** `intencaoTurno > 0` **então** incluir motivo `INTENCAO_COMPRA_AGORA`.
- **Se** `riscoMargem > 0` **então** incluir motivo `RISCO_MARGEM`.
- **Se** `saturacaoRecente > 0` **então** incluir motivo `SATURACAO_RECENTE`.

---

## Invariantes

- Mesmo input -> mesmo `score`.
- `motivos` não pode ser vazio.

---

## Edge cases

- Todos sinais = 0 -> `score = 0` e motivo default `INTENCAO_COMPRA_AGORA` não deve ser adicionado automaticamente.
- Score negativo é permitido; ordenação global decide corte posterior.
