# Listar campanhas (`listarCampanhas`)

Esta feature existe para devolver campanhas de forma previsível para UI e orquestradores de `retomar` e `atendimento`.

---

## Conceito

Listar campanhas é como abrir uma estante com filtros: você escolhe a prateleira (`status`, `tipo`, `modo`) e recebe itens ordenados.

---

## Contrato

### Entrada

```text
{
  accountId: string
  filter?:
    {
      status?: "draft" | "active" | "paused" | "ended"
      tipo?: CampaignType
      modo?: CampaignMode
      q?: string
    }
  page?: number
  pageSize?: number
}
```

### Saída

```text
{
  items: Campaign[]
  total: number
  page: number
  pageSize: number
}
```

---

## Regras

- Ordenação padrão: `updatedAtIso` desc (mais recentes primeiro).
- Filtro por `q` aplica em `nome` e `objetivo` (case-insensitive).
- `page` padrão `1`; `pageSize` padrão `20`.
- `pageSize` máximo `100`.
- Sem filtros, retorna todos os status.

---

## Edge cases

- Página fora do intervalo → `items` vazio com `total` correto.
- Filtros incompatíveis (sem match) → `items` vazio, sem erro.
- `accountId` vazio → erro explícito.

---

## Critérios de aceitação

- Resposta paginada sempre consistente.
- Mesmo filtro + mesmos dados = mesma saída (determinismo).
- `retomar` e `atendimento` conseguem filtrar apenas `active` sem lógica extra.

---

## Integrações

- Consumidores: [../retomar/spec.md](../retomar/spec.md) e [../atendimento/spec.md](../atendimento/spec.md).
- Contrato de item usa `Campaign` canónico de [spec.md](spec.md).

---

## Escopo fora

- Ordenação por performance de campanha.
- Busca semântica por IA.
