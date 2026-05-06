# Relatório — T-002: Filtrar itens sem match no catálogo no buildPedidoAuto

**Status:** CONCLUÍDO  
**Concluído em:** 2026-05-05T16:01:00Z  
**Duração:** ~6min

---

## Sumário

1 linha adicionada em `provider.ts:1030`: `if (!match) continue`

Isso faz com que itens extraídos do DOM que não tenham correspondência no catálogo sejam descartados antes de aparecer no pedido automático do painel de atendimento.

### O que muda na prática

- Timestamps, "15 mensagens não lidas", durações de áudio → **descartados** (sem match no catálogo)
- "italiano", "abóbora", "multigrãos" → **aparecem** se estiverem no catálogo
- Caso `atendente: "tenho abóbora" → cliente: "quero um"` → **funciona** porque "abóbora" tem match

---

## Gates

| Gate | Resultado |
|------|-----------|
| lint | ✅ 0 erros |
| typecheck | ✅ 0 erros novos (todos pré-existentes) |
| build | ✅ esbuild OK |
| test:unit | ✅ 152+ testes (0 falhas) |
| SPEC compliance | ✅ 1/1 linha implementada |

---

## Aprendizados

1. O DOM fallback (`document.querySelectorAll('[data-id]')`) é necessário para o caso cross-talk (atendente oferece, cliente confirma) — filtrar por catálogo é a correção certa, não restringir o seletor.
2. O `PedidoItemAuto.produtoCatalogo` é opcional justamente pra sinalizar "tem ou não tem match" — a UI pode usar isso no futuro pra mostrar itens com/sem preço.
