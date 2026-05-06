# Painel Campanhas

Esta feature existe para organizar campanhas comerciais de forma simples e segura, com execução **WhatsApp-first** e decisão final humana (**human-in-the-loop**).

---

## Conceito

Uma campanha é como uma "receita de contato": define **quem pode receber**, **quando pode receber** e **qual objetivo comercial**.

- Quem usa a receita no dia a dia é o `retomar` e o `atendimento`.
- O sistema sugere e filtra; a pessoa confirma antes de enviar.

---

## Tipos de campanha (canónicos)

- `giro_validade`
- `giro_estoque`
- `margem_inteligente`
- `promo_comercial`
- `lancamento_produto`
- `oportunidade_hiperlocal`
- `recompra_prevista`
- `upsell_cross_sell`

## Modos de campanha (canónicos)

- `always_on` — campanha contínua (sem data final obrigatória).
- `periodo` — campanha com janela explícita de início e fim.

---

## Contratos canónicos

### `Campaign`

```text
{
  campaignId: string
  nome: string
  tipo: CampaignType
  modo: CampaignMode
  status: "draft" | "active" | "paused" | "ended"
  objetivo: string
  canais: ["whatsapp"]
  publico:
    {
      includeTags?: string[]
      excludeTags?: string[]
      minDaysInactive?: number
      maxDaysInactive?: number
      minRecencyDaysFromPurchase?: number
      maxRecencyDaysFromPurchase?: number
      bairrosPermitidos?: string[]
    }
  janela?:
    {
      startsAtIso: string
      endsAtIso: string
      timezone: string
    }
  guardrails:
    {
      requireHumanApproval: true
      dedupeByChatWindowHours: number
      maxSendsPerChatInPeriod: number
    }
  createdAtIso: string
  updatedAtIso: string
  createdBy: string
  updatedBy: string
}
```

### `CampaignEligibilityInput`

```text
{
  campaign: Campaign
  chatId: string
  accountId: string
  nowIso: string
  contactSnapshot:
    {
      tags: string[]
      bairro?: string
      daysInactive?: number
      daysFromLastPurchase?: number
      blocked?: boolean
    }
  retomarSnapshot?:
    {
      contadorAtual?: 0 | 1 | 2 | 3 | 4
      lastOutgoingAtIso?: string
    }
  atendimentoSnapshot?:
    {
      chatAberto: boolean
      operadorDisponivel: boolean
    }
}
```

### `CampaignEligibilityOutput`

```text
{
  eligible: boolean
  reasons: string[]
  gates:
    {
      statusGate: "ok" | "blocked"
      modeGate: "ok" | "blocked"
      audienceGate: "ok" | "blocked"
      frequencyGate: "ok" | "blocked"
      humanGate: "ok" | "blocked"
    }
  nextCheckAtIso?: string
}
```

---

## Lógica (alto nível)

```
Retomar/Atendimento → listarCampanhas → avaliarElegibilidadeDeCampanha → humano aprova → envio WhatsApp
```

- `retomar` consome campanhas para priorizar ciclos e copy.
- `atendimento` consome campanhas para contexto de conversa e oferta.
- Sem aprovação humana, não existe envio automático silencioso.

---

## Regras

- Se `campaign.status != active` então não elegível.
- Se `campaign.modo = periodo` e `nowIso` fora da janela então não elegível.
- Se `blocked = true` no contato então não elegível.
- Se campanha não tiver `canais` contendo `whatsapp` então não elegível.
- Se `guardrails.requireHumanApproval != true` então configuração inválida.

---

## Edge cases

- Janela invertida (`endsAtIso < startsAtIso`) → rejeitar campanha.
- `always_on` com `janela` preenchida → permitido, mas `janela` é ignorada.
- Contato sem dados de inatividade/compra quando o filtro exige esses dados → inelegível explícito.
- Campanha em `paused` voltando para `active` → elegibilidade recalculada sem reaproveitar cache antigo.

---

## Critérios de aceitação

- Contratos `Campaign`, `CampaignEligibilityInput` e `CampaignEligibilityOutput` são únicos e partilhados pelas filhas.
- `retomar` e `atendimento` conseguem consumir a mesma estrutura sem adaptadores ad-hoc.
- Toda decisão de elegibilidade devolve `reasons` legíveis.
- O fluxo mantém aprovação humana antes do envio no WhatsApp.

---

## Integrações

- Consumidor principal de retomada: [../retomar/spec.md](../retomar/spec.md)
- Consumidor principal de atendimento: [../atendimento/spec.md](../atendimento/spec.md)

---

## Escopo fora

- Definição de copy de cada mensagem.
- Execução técnica de envio WhatsApp.
- Métricas financeiras avançadas e atribuição de receita.
