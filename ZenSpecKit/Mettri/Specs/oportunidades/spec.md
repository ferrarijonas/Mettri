# Oportunidades no Atendimento (vitrine assistida)

Este domínio existe para transformar sinais de conversa + campanhas + vitrine em **sugestões explicáveis** para o atendente, sem autoenvio.

Referências de costura:

- Atendimento comercial: [../atendimento/spec.md](../atendimento/spec.md)
- Retomar (elegibilidade/cadência): [../retomar/spec.md](../retomar/spec.md)

---

## Conceito

Metáfora: pense numa "mesa de sugestões" de loja.  
As campanhas colocam etiquetas de prioridade, o atendimento traz o contexto da conversa, e este módulo organiza a vitrine por ordem de melhor oportunidade.

O domínio `oportunidades` não envia mensagem no WhatsApp. Ele devolve:

1. contexto canônico de oportunidade por chat;
2. lista de oportunidades detectadas e ranqueadas;
3. sugestão de oferta pronta para humano revisar/enviar.

---

## Contratos canônicos

### `CampaignEligibility`

Contrato importado do domínio Campanhas (resultado de elegibilidade por campanha):  
[../campanhas/spec.md](../campanhas/spec.md) → `CampaignEligibilityOutput`.

### `OpportunityContext`

```ts
type OpportunityContext = {
  chatId: string;
  accountId: string;
  instanteIso: string;
  turnoAtual: {
    clienteTexto: string;
    atendenteTexto?: string;
  };
  cliente: {
    customerId?: string;
    nome?: string;
    perfilFactual?: Record<string, unknown>;
    aderenciaScore: number; // 0..1
  };
  campanhasAtivasElegiveis: CampaignEligibility[];
  vitrine: {
    recomendacoes: Array<{
      sku: string;
      nome: string;
      preco: number;
      margemScore: number; // 0..1
      pressaoEstoqueScore: number; // 0..1
      vantagemLogisticaScore: number; // 0..1
      validadeAteIso?: string;
      urgenciaValidadeScore: number; // 0..1
    }>;
  };
  metadados: {
    source: "atendimento";
    version: "1";
  };
};
```

### `Opportunity`

```ts
type Opportunity = {
  opportunityId: string; // determinístico
  sku: string;
  titulo: string;
  campanhaId?: string;
  campanhaPrioridadeScore: number; // 0..1
  urgenciaValidadeScore: number; // 0..1
  margemScore: number; // 0..1
  pressaoEstoqueScore: number; // 0..1
  vantagemLogisticaScore: number; // 0..1
  aderenciaClienteScore: number; // 0..1
  rankingScore: number; // 0..1 (normalizado)
  rankingTuple: [number, number, number, number, number, number, string];
  rationale: string[];
};
```

### `OfferSuggestion`

```ts
type OfferSuggestion = {
  chatId: string;
  opportunityId: string;
  textoSugerido: string;
  explicacaoCurta: string;
  campanhaAplicada?: {
    campanhaId: string;
    nome: string;
  };
  guardrails: {
    requireHumanSend: true;
    autoSendAllowed: false;
  };
};
```

---

## Lógica

### Pipeline

```
Atendimento (chat atual + vitrine) -> montarContextoDeOportunidade
-> detectarOportunidadesPorChat -> rankearOportunidades
-> explicarSugestao -> orquestrarVitrineNoAtendimento -> UI (somente sugestão)
```

### Regras globais

- Sem `chatId` válido: falha explícita (`INVALID_INPUT`).
- Sem campanhas ativas elegíveis: continuar com `campanhasAtivasElegiveis = []`.
- Sem vitrine/recomendação: retornar lista vazia (não inventar produto).
- Saída final é sempre assistida: humano revisa e envia.
- Mesmo input canônico produz mesma ordem de ranking (determinismo).

---

## Costura com outros domínios

- Campanhas entram por elegibilidade ativa no contexto.
- Atendimento consome `OfferSuggestion` na área de vitrine comercial.
- Retomar pode reutilizar fatores de aderência e histórico para enriquecer contexto, sem mudar a regra "sem autoenvio".

---

## ZenSpecs filhas (`Specs/oportunidades/`)

- [montar-contexto-de-oportunidade.zenspec.md](montar-contexto-de-oportunidade.zenspec.md) — `montarContextoDeOportunidade`
- [detectar-oportunidades-por-chat.zenspec.md](detectar-oportunidades-por-chat.zenspec.md) — `detectarOportunidadesPorChat`
- [rankear-oportunidades.zenspec.md](rankear-oportunidades.zenspec.md) — `rankearOportunidades`
- [explicar-sugestao.zenspec.md](explicar-sugestao.zenspec.md) — `explicarSugestao`
- [orquestrar-vitrine-no-atendimento.zenspec.md](orquestrar-vitrine-no-atendimento.zenspec.md) — `orquestrarVitrineNoAtendimento`

---

## Edge cases

- Campanha ativa, mas cliente inelegível na regra da campanha -> oportunidade sem campanha aplicada.
- Produto com margem alta e estoque baixo crítico -> permitido, mas explicação deve evidenciar o trade-off.
- Dois itens empatados em score -> desempate determinístico por `opportunityId` (ordem lexicográfica).

---

## Critérios de aceitação

- Contratos canônicos publicados e usados em todas as filhas.
- Ranking usa exatamente os 6 fatores pedidos.
- Integração com atendimento via vitrine e com campanhas via elegibilidade ativa.
- Nenhum fluxo desta spec dispara autoenvio.
