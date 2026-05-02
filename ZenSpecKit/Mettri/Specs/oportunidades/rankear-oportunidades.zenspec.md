# Rankear oportunidades (`rankearOportunidades`)

Esta ZenSpec define o ranking determinístico das oportunidades com seis fatores obrigatórios.

Panorama: [spec.md](spec.md)

---

## Conceito

Metáfora: é uma "fila de prioridade" de hospital.  
Quem tem maior urgência e melhor encaixe entra antes, usando critérios fixos.

---

## Contrato

### Entrada

- `input`
  - `opportunities: Opportunity[]`

### Saída

- `output`
  - `ranked: Opportunity[]` (ordem final determinística)

### Erros

- `INVALID_INPUT`

---

## Lógica

Para cada `Opportunity`, calcular:

```
rankingScore =
  0.24 * urgenciaValidadeScore +
  0.22 * campanhaPrioridadeScore +
  0.16 * margemScore +
  0.14 * pressaoEstoqueScore +
  0.12 * vantagemLogisticaScore +
  0.12 * aderenciaClienteScore
```

Depois ordenar por `rankingTuple`:

```
[
  rankingScore,
  urgenciaValidadeScore,
  campanhaPrioridadeScore,
  margemScore,
  pressaoEstoqueScore,
  vantagemLogisticaScore,
  opportunityId
]
```

Ordem: decrescente nos seis primeiros campos; no último (`opportunityId`), crescente lexicográfico para desempate final.

---

## Regras

- Todos os seis fatores são obrigatórios no ranking.
- Score fora de faixa em qualquer fator -> aplicar clamping `[0..1]` antes do cálculo.
- Mesmo conjunto de oportunidades com mesmos fatores -> mesma ordem final.
- Não usar aleatoriedade, timestamp de processamento, ou estado global para ordenar.

---

## Edge cases

- Lista vazia -> retorna vazia.
- Score `NaN` em fator -> tratar como `0` e registrar warning.
- Empate total dos seis fatores -> desempatar por `opportunityId`.

---

## Critérios de aceitação

- Ranking reproduzível entre execuções com mesmo input.
- Os seis fatores pedidos influenciam o resultado.
- Saída preserva contrato canônico `Opportunity` com `rankingScore` e `rankingTuple` preenchidos.
