# Matriz de Rastreabilidade — Campanhas e Oportunidades

Esta matriz mostra a costura entre os domínios `campanhas`, `oportunidades`, `atendimento` e `retomar`.

Objetivo: deixar claro **quem produz**, **quem consome**, **qual contrato trafega** e **qual comportamento esperado**.

---

## 1) Mapa macro (domínio para domínio)

| Origem | Destino | Contrato principal | Papel |
| --- | --- | --- | --- |
| `campanhas` | `oportunidades` | `CampaignEligibilityOutput` | Informar quais campanhas estão ativas/elegíveis para o chat. |
| `oportunidades` | `atendimento` | `OfferSuggestion` | Exibir vitrine assistida no chat atual (sem autoenvio). |
| `retomar` | `campanhas` | `CampaignEligibilityInput` | Avaliar se contato pode entrar na ação sem violar guardrails. |
| `atendimento` | `campanhas` | `CampaignEligibilityInput` | Validar elegibilidade por contexto operacional do chat/operador. |
| `atendimento` | `oportunidades` | `OpportunityContext` (entrada) | Fornecer contexto do chat atual para detectar/ranquear ofertas. |

---

## 2) Contratos canônicos e consumidores

| Contrato canônico | Definido em | Produzido por | Consumido por | Uso no fluxo |
| --- | --- | --- | --- | --- |
| `Campaign` | `Specs/campanhas/spec.md` | `criar-campanha`, `editar-campanha`, `ativar-pausar-encerrar-campanha` | `listar-campanhas`, `avaliar-elegibilidade-de-campanha`, `oportunidades` | Modelo oficial de campanha. |
| `CampaignEligibilityInput` | `Specs/campanhas/spec.md` | `atendimento`, `retomar` (adaptadores de contexto) | `avaliar-elegibilidade-de-campanha` | Pedido de validação por chat/contato. |
| `CampaignEligibilityOutput` | `Specs/campanhas/spec.md` | `avaliar-elegibilidade-de-campanha` | `oportunidades` (`montar-contexto`, `detectar`) | Gate de campanha ativa/elegível. |
| `OpportunityContext` | `Specs/oportunidades/spec.md` | `montar-contexto-de-oportunidade` | `detectar-oportunidades-por-chat`, `orquestrar-vitrine-no-atendimento` | Snapshot completo para decisão. |
| `Opportunity` | `Specs/oportunidades/spec.md` | `detectar-oportunidades-por-chat` e `rankear-oportunidades` | `explicar-sugestao`, `orquestrar-vitrine-no-atendimento` | Candidato de oferta com score/rationale. |
| `OfferSuggestion` | `Specs/oportunidades/spec.md` | `explicar-sugestao` | `orquestrar-vitrine-no-atendimento`, `atendimento` | Sugestão final para humano revisar/enviar. |

---

## 3) Rastreabilidade por ZenSpec (arquivo a arquivo)

| ZenSpec | Entrada principal | Saída principal | Dependências diretas | Consumidor final |
| --- | --- | --- | --- | --- |
| `Specs/campanhas/criar-campanha.zenspec.md` | dados de campanha | `Campaign` | contratos de `campanhas/spec.md` | operadores de campanha e listagem |
| `Specs/campanhas/editar-campanha.zenspec.md` | `campaignId` + patch | `Campaign` atualizado | `Campaign` existente | operadores de campanha |
| `Specs/campanhas/ativar-pausar-encerrar-campanha.zenspec.md` | `campaignId` + transição | `Campaign` com novo status | regras de ciclo de vida | `retomar`, `atendimento`, `oportunidades` |
| `Specs/campanhas/listar-campanhas.zenspec.md` | filtros + conta | lista `Campaign[]` | repositório de campanhas | `atendimento`, `retomar`, backoffice |
| `Specs/campanhas/avaliar-elegibilidade-de-campanha.zenspec.md` | `CampaignEligibilityInput` | `CampaignEligibilityOutput` | guardrails + contexto de chat | `oportunidades` e fluxos assistidos |
| `Specs/oportunidades/montar-contexto-de-oportunidade.zenspec.md` | chat + sinais + elegibilidade | `OpportunityContext` | campanhas elegíveis + vitrine/catalogo | detecção de oportunidades |
| `Specs/oportunidades/detectar-oportunidades-por-chat.zenspec.md` | `OpportunityContext` | `Opportunity[]` (candidatas) | campanhas ativas/elegíveis + sinais de produto/cliente | ranking |
| `Specs/oportunidades/rankear-oportunidades.zenspec.md` | `Opportunity[]` | `Opportunity[]` ordenada | 6 fatores determinísticos | explicação + orquestração |
| `Specs/oportunidades/explicar-sugestao.zenspec.md` | top oportunidade + contexto | `OfferSuggestion` | oportunidade ranqueada + guardrails | atendimento (UI assistida) |
| `Specs/oportunidades/orquestrar-vitrine-no-atendimento.zenspec.md` | chat atual + deps | contexto + ranking + sugestão | pipeline completo de oportunidades | bloco de vitrine no atendimento |

---

## 4) Invariantes de costura (checagem rápida)

| Invariante | Regra |
| --- | --- |
| Human-in-the-loop | Nenhum contrato permite autoenvio (`requireHumanSend: true`, `autoSendAllowed: false`). |
| WhatsApp-first | Campanhas e sugestões são desenhadas para fluxo assistido no WhatsApp. |
| Determinismo | Elegibilidade e ranking devem repetir o mesmo resultado com o mesmo input. |
| Falha explícita | Sem sucesso parcial silencioso entre etapas do pipeline. |
| Contrato único | `CampaignEligibilityOutput` é a referência única de elegibilidade consumida por `oportunidades`. |

---

## 5) Checklist de implementação (quando virar código)

- Implementar adaptadores de contexto de `atendimento` e `retomar` para `CampaignEligibilityInput`.
- Implementar persistência de campanhas alinhada ao `Campaign`.
- Garantir que `oportunidades` só use campanha via `CampaignEligibilityOutput`.
- Garantir que UI do `atendimento` renderize `OfferSuggestion` sem enviar automaticamente.
- Adicionar testes de integração cobrindo: campanha ativa + oportunidade detectada + sugestão assistida.
