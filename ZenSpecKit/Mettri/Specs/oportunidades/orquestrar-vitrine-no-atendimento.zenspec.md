# Orquestrar vitrine no atendimento (`orquestrarVitrineNoAtendimento`)

Esta ZenSpec define a cadeia completa do domínio `oportunidades` dentro do fluxo de atendimento, com integração explícita de campanhas.

Panorama: [spec.md](spec.md)  
Referências: [../atendimento/spec.md](../atendimento/spec.md), [../retomar/spec.md](../retomar/spec.md)

---

## Conceito

Metáfora: é o maestro da banda.  
Cada instrumento (contexto, detecção, ranking, explicação) entra na hora certa para entregar uma sugestão única na UI.

---

## Pipeline

```
chat atual do atendimento
-> montarContextoDeOportunidade
-> detectarOportunidadesPorChat
-> rankearOportunidades
-> explicarSugestao
-> payload para bloco de vitrine no atendimento
```

---

## Contrato

### Entrada

- `input`
  - `chatId: string`
  - `accountId: string`
  - `instanteIso: string`
  - `turnoAtual`
  - `deps`
    - `montarContextoDeOportunidade`
    - `detectarOportunidadesPorChat`
    - `rankearOportunidades`
    - `explicarSugestao`

### Saída

- `output`
  - `context: OpportunityContext`
  - `opportunitiesRanked: Opportunity[]`
  - `suggestion: OfferSuggestion | null`

### Erros

- `INVALID_INPUT`
- `UPSTREAM_ERROR`

---

## Regras

- **Se** qualquer etapa falhar **então** falha explícita; não devolver sucesso parcial silencioso.
- **Se** ranking devolver vazio **então** `suggestion = null` e UI mantém estado neutro de oportunidades.
- Integração com campanhas deve vir do contexto (campanha ativa/elegível), não de inferência local no orquestrador.
- Integração com atendimento deve alimentar somente bloco de vitrine/sugestão assistida.
- É proibido autoenvio nesta orquestração.

---

## Edge cases

- Conversa válida com catálogo vazio -> pipeline válido com `opportunitiesRanked = []`.
- Dependência de campanhas indisponível -> `UPSTREAM_ERROR` (sem priorização fictícia).
- Mudança rápida de chat no atendimento -> chamada antiga não deve sobrescrever estado do chat atual (chave por `chatId` no consumidor).

---

## Critérios de aceitação

- Execução válida entrega contexto + ranking + sugestão (ou nulo) no contrato canônico.
- Saída é utilizável pelo atendimento sem transformação estrutural adicional.
- Nenhuma etapa executa envio automático para WhatsApp.
