# Ativar, pausar e encerrar campanha (`setCampaignStatus`)

Esta feature existe para controlar o ciclo de vida da campanha com transições claras e reversíveis só quando permitido.

---

## Conceito

Status de campanha é como semáforo: `active` (verde), `paused` (amarelo), `ended` (vermelho final).

---

## Contrato

### Entrada

```text
{
  campaignId: string
  nextStatus: "active" | "paused" | "ended"
  actorUserId: string
  nowIso: string
}
```

### Saída

```text
{
  campaign: Campaign
}
```

---

## Regras

- `draft -> active` permitido se campanha válida.
- `active -> paused` permitido.
- `paused -> active` permitido.
- `active -> ended` permitido.
- `paused -> ended` permitido.
- `ended` é terminal (não volta para `active` nem `paused`).
- Ativação valida `modo` e janela (`periodo` dentro da janela atual).

---

## Edge cases

- Pedir mesmo status atual → operação idempotente (retorna campanha sem erro).
- Ativar campanha `periodo` fora da janela atual → rejeitar com motivo explícito.
- Encerrar durante execução de lote → novos envios bloqueados; envios já confirmados seguem política do orquestrador.

---

## Critérios de aceitação

- Máquina de estados respeita transições válidas e inválidas.
- `ended` nunca reabre por este programa.
- Toda mudança atualiza `updatedAtIso` e `updatedBy`.

---

## Integrações

- `retomar` e `atendimento` consomem somente campanhas em `active` (ver [spec.md](spec.md)).
- Consumidores integradores: [../retomar/spec.md](../retomar/spec.md), [../atendimento/spec.md](../atendimento/spec.md).

---

## Escopo fora

- Agendamento futuro de mudança de status.
- Aprovação multiusuário para encerramento.
