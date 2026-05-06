# Montar contexto de oportunidade (`montarContextoDeOportunidade`)

Esta feature monta o "quadro da partida" para oportunidades: quem é o cliente, o que está na vitrine e quais campanhas estão ativas/elegíveis.

Panorama: [spec.md](spec.md)  
Costura: [../atendimento/spec.md](../atendimento/spec.md), [../retomar/spec.md](../retomar/spec.md)

---

## Conceito

Metáfora: é como separar os ingredientes antes de cozinhar.  
Sem esse mise en place, o ranking fica inconsistente.

---

## Contrato

### Entrada

- `input`
  - `chatId: string`
  - `accountId: string`
  - `instanteIso: string`
  - `turnoAtual`
    - `clienteTexto: string`
    - `atendenteTexto?: string`
  - `deps`
    - `fornecerVitrineParaPipelineComercial`
    - `listarCampanhasAtivasElegiveis`
    - `fornecerFichaClienteParaAtendimento` (quando disponível)

### Saída

- `output: OpportunityContext` (contrato canônico em [spec.md](spec.md))

### Erros

- `INVALID_INPUT`
- `UPSTREAM_ERROR`

---

## Lógica

```
input + deps
-> resolve cliente (ficha/perfil factual)
-> resolve campanhas ativas e elegíveis
-> resolve vitrine recomendada para o chat
-> normaliza scores [0..1]
-> OpportunityContext
```

---

## Regras

- **Se** `chatId` vazio **então** `INVALID_INPUT`.
- **Se** `clienteTexto` vazio após `trim` **então** `INVALID_INPUT`.
- **Se** campanha estiver ativa mas não elegível para o cliente **então** não entra em `campanhasAtivasElegiveis`.
- **Se** vitrine falhar **então** `UPSTREAM_ERROR` (sem fallback oculto com produtos fictícios).
- **Se** perfil factual não estiver disponível **então** `aderenciaScore` padrão = `0.5` com warning rastreável.
- **Se** um score vier fora de faixa **então** clamping determinístico para `[0,1]`.

---

## Edge cases

- Cliente novo sem histórico: permitido, com `aderenciaScore` neutro.
- Campanhas vazias no período: permitido, lista vazia.
- Vitrine com itens duplicados por SKU: deduplicar por SKU mantendo o item com maior `urgenciaValidadeScore`.

---

## Critérios de aceitação

- Toda execução válida gera `OpportunityContext` completo e canônico.
- Ausência de campanha não bloqueia o contexto.
- Fonte principal de produto vem da vitrine usada pelo atendimento.
