# Editar campanha (`editarCampanha`)

Esta feature existe para alterar campanha existente sem quebrar contrato, preservando histórico lógico e segurança operacional.

---

## Conceito

Editar campanha é como ajustar uma rota no GPS: você muda parâmetros, mas mantém o mesmo destino de identidade (`campaignId`).

---

## Contrato

### Entrada

```text
{
  campaignId: string
  patch:
    {
      nome?: string
      tipo?: CampaignType
      modo?: CampaignMode
      objetivo?: string
      publico?: Campaign.publico
      janela?: Campaign.janela | null
      guardrails?: Campaign.guardrails
    }
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

- `campaignId` deve existir.
- `status = ended` permite só edição descritiva (`nome`, `objetivo`), sem reativação implícita.
- Troca de `modo` para `periodo` exige `janela` válida.
- Troca de `modo` para `always_on` pode aceitar `janela = null`.
- `guardrails.requireHumanApproval` continua obrigatório `true`.
- `updatedAtIso` e `updatedBy` sempre atualizados.

---

## Edge cases

- Patch vazio (`{}`) → rejeitar.
- Mudar para `periodo` com `endsAtIso < startsAtIso` → rejeitar.
- Tentar editar campanha inexistente → erro explícito `not_found`.

---

## Critérios de aceitação

- O retorno preserva `campaignId` e `createdAtIso`.
- Mudanças inválidas não persistem parcialmente.
- Após edição válida, elegibilidade passa a refletir os novos campos na próxima avaliação.

---

## Integrações

- Regras de leitura por consumidores em [../retomar/spec.md](../retomar/spec.md) e [../atendimento/spec.md](../atendimento/spec.md).
- Elegibilidade pós-edição delegada para `avaliarElegibilidadeDeCampanha`.

---

## Escopo fora

- Versionamento completo de diffs de campanha.
- Workflow de aprovação em etapas.
