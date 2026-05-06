# Integração futura: campanhas, oportunidades, atendimento e retomar

Este ficheiro é um **mapa de encaixe** (como instruções de LEGO): o que já existe em contrato e onde ligar depois.

## O que já existe (preview)

- **Campanhas:** CRUD + elegibilidade + `chrome.storage` por `accountId` (`src/modules/campanhas/`).
- **Oportunidades:** `montarContextoDeOportunidade` → `detectarOportunidadesPorChat` → `rankearOportunidades` → `explicarSugestao` → `orquestrarVitrinePreview` (`src/modules/oportunidades/`).
- **UI:** módulo **`campanhas.dashboard`** — lista/edição de campanhas + aba **Simulador** (motor de ofertas), com aviso de **não integrado** ao Atendimento/Retomar.

## Contrato de saída para o atendimento

- Importar `orquestrarVitrinePreview` (ou passos isolados) e passar um `MettriBridgeClient`.
- Entrada: alinhar `MontarContextoInput` com dados reais do chat:
  - `contactSnapshot`, `frequencySnapshot`, `atendimentoSnapshot`, `retomarSnapshot` quando existirem.
- Saída: `VitrinePreviewResult` com `suggestion.guardrails.requireHumanSend === true` e `autoSendAllowed === false` — **nunca** enviar mensagem automaticamente a partir disto.

## Onde plugar

1. **Atendimento:** após identificar `chatId` e texto do cliente, chamar o orquestrador e mostrar `OfferSuggestion` ao operador (copiar/colar ou botão que só preenche o campo, sem `sendMessage`).
2. **Retomar:** consumidor futuro; reutilizar a mesma montagem de contexto com snapshots de retomar e regras de frequência já previstas em `CampaignEligibilityInput`.

## Toggle / feature flag (recomendado)

- Manter um flag em settings ou remote config: `oportunidadesNoAtendimentoEnabled`.
- Enquanto `false`, apenas o painel **Oportunidades (preview)** usa o pipeline; o atendimento não chama o orquestrador.
