# Detectar oportunidades por chat (`detectarOportunidadesPorChat`)

Esta ZenSpec transforma `OpportunityContext` em oportunidades candidatas por item da vitrine, costurando campanha ativa/elegível.

Panorama: [spec.md](spec.md)

---

## Conceito

Metáfora: imagine um detector de "boas chances" que passa produto por produto e marca os que fazem sentido para aquele cliente naquele momento.

---

## Contrato

### Entrada

- `input`
  - `context: OpportunityContext`

### Saída

- `output`
  - `opportunities: Opportunity[]` (ainda sem ordem final obrigatória)
  - `warnings: string[]`

### Erros

- `INVALID_INPUT`

---

## Lógica

```
OpportunityContext
-> iterar vitrine.recomendacoes
-> cruzar campanha ativa/elegível por SKU/categoria/regra
-> montar Opportunity por candidato
-> devolver lista
```

---

## Regras

- **Se** `context.vitrine.recomendacoes` vazio **então** `opportunities = []`.
- Cada recomendação válida gera no máximo uma `Opportunity` por `sku`.
- `opportunityId` determinístico: `chatId + sku + campanhaId(ou "none")`.
- `campanhaPrioridadeScore`:
  - campanha ativa/elegível encontrada -> score da prioridade da campanha normalizado `[0..1]`;
  - sem campanha aplicável -> `0`.
- `rationale` deve conter fatos observáveis (campanha, validade, estoque, logística, aderência), sem inferência sensível.

---

## Edge cases

- Múltiplas campanhas elegíveis para o mesmo SKU -> escolher a de maior prioridade; empate por `campanhaId` lexicográfico.
- Campanha ativa expirada no `instanteIso` -> ignorar.
- Produto sem `validadeAteIso` -> `urgenciaValidadeScore = 0`.

---

## Critérios de aceitação

- A lista de oportunidades é derivada apenas de dados do contexto.
- Relação com campanha é explícita (com ou sem campanha aplicada).
- Saída está pronta para o módulo de ranking sem mutações adicionais obrigatórias.
