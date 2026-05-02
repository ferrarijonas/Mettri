# Explicar sugestão (`explicarSugestao`)

Esta ZenSpec converte a melhor oportunidade ranqueada em texto sugerido + explicação curta para o atendente.

Panorama: [spec.md](spec.md)

---

## Conceito

Metáfora: é como o vendedor experiente dizendo "por que esse item está no topo" em linguagem simples e verificável.

---

## Contrato

### Entrada

- `input`
  - `context: OpportunityContext`
  - `ranked: Opportunity[]`
  - `persona?: string`

### Saída

- `output: OfferSuggestion | null`

### Erros

- `INVALID_INPUT`

---

## Lógica

```
context + ranked
-> escolher top1 (se existir)
-> gerar texto sugerido para humano enviar
-> anexar explicacaoCurta com fatores do ranking
-> aplicar guardrails (sem autoenvio)
-> OfferSuggestion
```

---

## Regras

- **Se** `ranked` vazio **então** retornar `null`.
- `textoSugerido` deve ser coerente com campanha aplicada quando houver.
- `explicacaoCurta` deve mencionar no mínimo 2 fatores do topo (ex.: validade + campanha).
- Guardrail obrigatório:
  - `requireHumanSend = true`
  - `autoSendAllowed = false`
- Não prometer condição comercial inexistente no `Opportunity`.

---

## Edge cases

- Top1 sem campanha -> gerar sugestão sem linguagem de campanha.
- Top1 com alta urgência de validade e baixa aderência -> explicação deve reconhecer trade-off.
- Persona ausente -> usar tom padrão de atendimento comercial.

---

## Critérios de aceitação

- Sempre que houver oportunidade, há `OfferSuggestion` explicável.
- Quando não houver oportunidade, retorno é `null` sem erro.
- Nenhuma saída desta etapa autoriza envio automático.
