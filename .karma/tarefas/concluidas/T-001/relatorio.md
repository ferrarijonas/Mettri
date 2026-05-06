# Relatório — T-001: Validar itens de pedido contra catálogo

**Status:** CONCLUÍDO  
**Concluído em:** 2026-05-05T15:55:00Z  
**Duração:** ~15min (estimado 30min)

---

## Sumário

Adicionada validação de catálogo em 3 pontos do fluxo de captura de pedidos:

1. `orderDB.addItem()` — rejeita `skuId` inexistente no catálogo
2. `orderDB.advanceStatus()` — valida todos os itens ao transicionar `lead→draft` e `draft→open`
3. Handler `order:addItem` no dashboard — alerta na UI se produto não está no catálogo

~25 linhas novas, 2 arquivos modificados.

---

## Gates

| Gate | Resultado |
|------|-----------|
| lint | ✅ 0 erros novos |
| typecheck | ✅ 0 erros |
| build | ✅ esbuild OK |
| test:unit | ✅ 292/292 |
| SPEC compliance | ✅ 9/9 |
| Sabotagens | ✅ 0 detectadas |
| Escopo | ✅ Respeitado |

---

## Veredito

**@avaliador: PASS** — implementação cumpre contrato, nenhuma sabotagem, escopo respeitado.

---

## Aprendizados

1. **accountId descentralizado** — OrderDB e CatalogoDB têm `currentUserWid` independentes. Tarefas futuras devem unificar via `UserContext`.
2. **Validação pontual funciona** — `getBySku()` + throw/erro genérico cobre o caso sem overengineering.
3. **ZenSpec R2 é cross-domínio** — a validação do OrderDB cobre uma camada; a detecção de produto pelo Ouvinte requer tarefa separada no domínio OUVIR.
