# Avaliar elegibilidade de campanha (`avaliarElegibilidadeDeCampanha`)

Esta feature existe para decidir, com regras determinísticas, se um contato pode entrar em uma campanha ativa sem violar guardrails.

---

## Conceito

Elegibilidade é um "porteiro com checklist": só passa quem cumprir todos os portões (`gates`).

---

## Contrato

### Entrada

`CampaignEligibilityInput` (definido em [spec.md](spec.md)).

### Saída

`CampaignEligibilityOutput` (definido em [spec.md](spec.md)).

---

## Lógica dos gates

1. `statusGate`
   - `ok` só com `campaign.status = active`.
2. `modeGate`
   - `always_on` passa por padrão.
   - `periodo` exige `nowIso` dentro de `startsAtIso..endsAtIso`.
3. `audienceGate`
   - aplica include/exclude tags, bairro, faixas de inatividade e compra.
4. `frequencyGate`
   - bloqueia se houver envio recente dentro de `dedupeByChatWindowHours`.
   - bloqueia se ultrapassar `maxSendsPerChatInPeriod`.
5. `humanGate`
   - exige `requireHumanApproval = true`.
   - exige `atendimentoSnapshot.operadorDisponivel = true` para disparo assistido.

`eligible = true` apenas se todos os gates forem `ok`.

---

## Regras

- Retornar `reasons` com linguagem clara para cada gate bloqueado.
- Se faltar dado necessário para filtro ativo, gate correspondente bloqueia (fail-safe).
- `contadorAtual = 4` vindo de `retomarSnapshot` bloqueia por regra de desistência.
- `contactSnapshot.blocked = true` bloqueia imediatamente.

---

## Edge cases

- Campanha `periodo` sem janela válida → `modeGate = blocked`.
- `nowIso` inválido → todos gates `blocked` com motivo de contrato inválido.
- `atendimentoSnapshot` ausente em fluxo que exige operador → `humanGate = blocked`.

---

## Critérios de aceitação

- Mesma entrada sempre gera a mesma saída.
- Saída sempre devolve os 5 gates e `reasons`.
- Integração com `retomar` respeita bloqueio por contador 4.
- Integração com `atendimento` respeita bloqueio sem operador disponível.

---

## Integrações

- Consumidor no funil de retomada: [../retomar/spec.md](../retomar/spec.md)
- Consumidor no fluxo assistido de atendimento: [../atendimento/spec.md](../atendimento/spec.md)

---

## Escopo fora

- Cálculo de melhor horário de envio.
- Escolha de copy da mensagem por IA.
