---
id: "T-002"
titulo: "Filtrar itens sem match no catálogo no buildPedidoAuto"
dominio: "ATENDIMENTO"
status: "concluido"
prioridade: 1
dependencias: []
bloqueado_por: []
bloqueia: []
tentativas: 1
max_tentativas: 3
nivel_auto_cura: null
backoff_ms: 10000
max_backoff_ms: 300000
criado_em: "2026-05-05T15:50:00Z"
iniciado_em: "2026-05-05T15:55:00Z"
concluido_em: "2026-05-05T16:01:00Z"
heartbeat_ultimo: "2026-05-05T16:01:00Z"
estimativa_min: 5
timeout_min: 15
escopo:
  modulos:
    - "src/modules/atendimento/dashboard/provider.ts"
  nao_tocar:
    - "src/storage/order-db.ts"
    - "src/modules/atendimento/dashboard/dashboard-module.ts"
    - "src/ui/"
spec_ref: "ZenSpecKit/Mettri/Specs/atendimento/atendimento-unificado.zenspec.md"
tipo_output: "codigo"
migracao_necessaria: false
---

# T-002: Filtrar itens sem match no catálogo no buildPedidoAuto

## Propósito

Impedir que o painel de atendimento exiba itens extraídos do DOM que não correspondem a nenhum produto do catálogo. O DOM fallback captura timestamps, contadores, durações e outros lixos textuais e os trata como "produtos" — filtrar por catálogo elimina esse ruído sem perder capturas legítimas (ex: atendente diz "tenho abóbora", cliente diz "quero um").

## Problema

`buildPedidoAuto()` (provider.ts, linha 1047-1060) varre TODOS os elementos `[data-id]` do WhatsApp Web e extrai possíveis produtos. O regex de extração (`extrairProdutosDeTexto()`) pega qualquer padrão "número + palavra" — incluindo timestamps, "15 mensagens não lidas", durações de áudio, etc.

Na linha 1068-1081, itens são inseridos no pedido **mesmo quando `buscarProdutoCatalogo()` retorna null** (sem match no catálogo). Isso faz com que lixo textual apareça como "item do pedido" no painel.

## Causa-raiz

```typescript
// Linha 1068 — atual: insere item mesmo sem match
if (!catalogados.has(match?.productId ?? nome)) {
```

O `?.` e `?? nome` permitem que itens sem `match` (null) entrem no pedido.

## Fix

```typescript
// Novo: pula itens sem match no catálogo
if (!match) continue
if (!catalogados.has(match.productId)) {
```

Isso faz com que APENAS produtos reconhecidos no catálogo apareçam no pedido automático. O DOM misto (in + out) continua capturando mensagens de ambos os lados — essencial para o caso "atendente oferece, cliente confirma".

## Escopo

- **Toca:**
  - `src/modules/atendimento/dashboard/provider.ts` — `buildPedidoAuto()`, 1 linha de mudança
- **NÃO toca:**
  - `src/storage/order-db.ts` (já tratado em T-001)
  - `src/modules/atendimento/dashboard/dashboard-module.ts`
  - DOM fallback (selector `[data-id]`) — continua funcionando como está
  - Lógica de extração de produtos (regex) — continua como está
  - UI

## Componentes envolvidos

- `src/modules/atendimento/dashboard/provider.ts` — function `buildPedidoAuto()`, linha ~1068

## O que produzir

1. **`provider.ts`**: Adicionar `if (!match) continue` no loop de montagem de itens
2. Itens sem `produtoCatalogo` não aparecem mais no `pedidoAuto`

## Como validar

- [ ] Chat com "1 italiano" → extrai "italiano" → se no catálogo, aparece; se não, some
- [ ] DOM com timestamp "03:15" → descartado (sem match)
- [ ] DOM com "15 mensagens não lidas" → descartado
- [ ] Atendente diz "tenho abóbora" → "abóbora" aparece (se no catálogo)
- [ ] Cliente diz "quero um" → "um" sozinho não vira produto (precisa de match)
- [ ] lint passa
- [ ] typecheck passa  
- [ ] build passa
- [ ] test:unit passa

## Sabotagens

- ⚠️ **Overengineering** — 1 linha de mudança. Não refatorar o DOM fallback. Não mexer nas regex.
- ⚠️ **Fuga de escopo** — Só filtrar. A extração e o DOM continuam como estão.
