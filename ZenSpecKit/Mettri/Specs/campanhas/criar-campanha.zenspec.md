# Criar campanha (`criarCampanha`)

Esta feature existe para cadastrar uma nova campanha com contrato estável, validação determinística e guardrails de segurança.

---

## Conceito

Criar campanha é como registrar uma nova "regra de jogo" antes da partida começar: ela nasce em `draft`, revisável e sem disparo automático.

---

## Contrato

### Entrada

```text
{
  nome: string
  tipo: CampaignType
  modo: CampaignMode
  objetivo: string
  canais?: ["whatsapp"]
  publico?: Campaign.publico
  janela?: Campaign.janela
  guardrails?: Campaign.guardrails
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

- `tipo` deve ser um dos 8 tipos canónicos.
- `modo` deve ser `always_on` ou `periodo`.
- `nome` e `objetivo` obrigatórios após `trim()`.
- Campanha nasce com `status = "draft"`.
- `canais` padrão é `["whatsapp"]`.
- `guardrails.requireHumanApproval` deve ser sempre `true`.
- Se `modo = periodo`, `janela` é obrigatória e válida.
- Se `modo = always_on`, `janela` é opcional e não governa elegibilidade.

---

## Edge cases

- Nome duplicado na mesma conta (normalização case-insensitive) → erro explícito.
- `periodo` com data final passada no momento da criação → permitido, mas campanha nasce não elegível até edição.
- `actorUserId` vazio → rejeitar.

---

## Critérios de aceitação

- Retorna um `Campaign` completo com `campaignId`, `createdAtIso`, `updatedAtIso`, `createdBy`, `updatedBy`.
- Campanha criada nunca inicia como `active`.
- Campos inválidos falham antes de persistir.

---

## Integrações

- Consumida por fluxos de operação no [spec.md](spec.md).
- Disponibilizada para consumo em [../retomar/spec.md](../retomar/spec.md) e [../atendimento/spec.md](../atendimento/spec.md).

---

## Escopo fora

- Tela de criação no painel.
- Aprovação formal por múltiplos revisores.
