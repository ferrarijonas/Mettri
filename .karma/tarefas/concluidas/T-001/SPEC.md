---
id: "T-001"
titulo: "Validar itens de pedido contra catálogo antes de registrar"
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
criado_em: "2026-05-05T15:29:00Z"
iniciado_em: "2026-05-05T15:40:00Z"
concluido_em: "2026-05-05T15:55:00Z"
heartbeat_ultimo: "2026-05-05T15:55:00Z"
estimativa_min: 30
timeout_min: 90
escopo:
  modulos:
    - "src/storage/order-db.ts"
    - "src/modules/atendimento/dashboard/dashboard-module.ts"
  nao_tocar:
    - "src/modules/ouvir/"
    - "src/modules/atendimento/dashboard/provider.ts"
    - "src/ui/"
spec_ref: "ZenSpecKit/Mettri/Specs/atendimento/modelo-pedido-unificado.zenspec.md"
tipo_output: "codigo"
migracao_necessaria: false
---

# T-001: Validar itens de pedido contra catálogo antes de registrar

## Propósito

Impedir que pedidos capturem itens que não existem no catálogo, garantindo integridade referencial entre `OrderItemStruct.skuId` e `CatalogProductSchema`.

## Escopo

- **Toca:**
  - `src/storage/order-db.ts` — método `addItem()`: validar `skuId` contra `CatalogoDB` antes de inserir
  - `src/modules/atendimento/dashboard/dashboard-module.ts` — handler `order:addItem`: validar antes de chamar `orderDB.addItem()`
  - `src/storage/order-db.ts` — novo tipo de erro `PRODUCT_NOT_IN_CATALOG`
- **NÃO toca:**
  - `src/modules/ouvir/` — o validador-catalogo do Ouvinte é outro domínio
  - `src/modules/atendimento/dashboard/provider.ts` — `buildPedidoAuto` é problema separado
  - UI — sem mudanças visuais no painel

## O que já existe

- `src/storage/order-db.ts` — `OrderDB.addItem()` (linha 339) aceita qualquer `skuId` string, sem validação
- `src/storage/order-db.ts` — `OrderDB.advanceStatus()` (linha 311) confirma pedidos com itens potencialmente inválidos
- `src/storage/catalogo-db.ts` — `CatalogoDB` com `getBySku()`, `getById()`, `listByAccount()`
- `src/modules/atendimento/dashboard/dashboard-module.ts` — handler `order:addItem` (linha 434) pega `skuId` do payload e chama `orderDB.addItem()` sem validação
- `ZenSpecKit/Mettri/Specs/atendimento/modelo-pedido-unificado.zenspec.md` — Regra R2: `lead → draft` exige "pelo menos 1 produto com match no catálogo"

## Onde verificar / input

- `src/storage/order-db.ts` — assinatura de `addItem()`, imports existentes, como `CatalogoDB` é ou não injetado
- `src/storage/catalogo-db.ts` — métodos disponíveis para busca por `skuId`: `getBySku(accountId, sku)` ou `getById(productId)`
- `src/modules/atendimento/dashboard/dashboard-module.ts` — handler `order:addItem`, como `catalogoDB` é acessado (ou não)
- `src/storage/order-db.ts` — como `accountId` está disponível no contexto de `addItem()`

## O que produzir / output

1. **`order-db.ts`**: `addItem()` valida `skuId` contra catálogo antes de inserir; se não existir, lança `PRODUCT_NOT_IN_CATALOG`
2. **`order-db.ts`**: `advanceStatus()` (draft → open) verifica se todos os itens têm match no catálogo; se algum não tiver, lança `PRODUCT_NOT_IN_CATALOG`
3. **`dashboard-module.ts`**: handler `order:addItem` valida via `catalogoDB` antes de chamar `orderDB.addItem()`, com feedback de erro na UI (alerta)
4. **Schema de erro**: novo código `PRODUCT_NOT_IN_CATALOG` nos tipos de erro do OrderDB

## Onde salvar

- `src/storage/order-db.ts` (edição)
- `src/modules/atendimento/dashboard/dashboard-module.ts` (edição)

## Como validar

- [ ] `orderDB.addItem()` com `skuId` existente no catálogo → sucesso (comportamento atual preservado)
- [ ] `orderDB.addItem()` com `skuId` inexistente → lança `PRODUCT_NOT_IN_CATALOG`
- [ ] `orderDB.advanceStatus('draft', 'open')` com todos os itens válidos → sucesso
- [ ] `orderDB.advanceStatus('draft', 'open')` com item inválido → lança `PRODUCT_NOT_IN_CATALOG`
- [ ] handler `order:addItem` exibe alerta quando `skuId` não está no catálogo
- [ ] lint passa (0 erros)
- [ ] typecheck passa (0 erros)
- [ ] build passa
- [ ] testes passam
- [ ] Nenhum arquivo fora do escopo modificado

## Sabotagens Herdadas

> domínio: ATENDIMENTO — catálogo: `sabotagens/ATENDIMENTO.md`

- ⚠️ **Overengineering de Pipeline** → Não refatorar o OrderDB inteiro. A mudança é pontual em `addItem()` e `advanceStatus()`. Se a mudança for > 50 linhas, parar e reavaliar.
- ⚠️ **Fuga para Módulo Errado** → Não mexer no `validador-catalogo.ts` do Ouvinte. Essa validação é do domínio ATENDIMENTO/COMERCIAL, não OUVIR.
- ⚠️ **Preciosismo de UI** → Sem mudanças visuais. Apenas validação de backend + alerta simples.

> domínio: global — catálogo: `sabotagens/_global.md`

- ⚠️ **Overengineering** → "O suficiente para testar é suficiente." Uma validação simples de `getBySku()` + erro claro. Sem sistema de plugins, sem cache layer, sem abstrações.
- ⚠️ **Genericidade prematura** → Não criar interface genérica de validação. Validar pontualmente onde o dado entra.
- ⚠️ **Paralisia por pré-requisito** → Não esperar resolver `buildPedidoAuto` ou migração de PurchaseDB primeiro. Essa tarefa é autocontida.

## Memória Herdada

> buscado em `memory.md` por tags do domínio `ATENDIMENTO`

- **Generator-Evaluator (GAN pattern)**: Avaliador separado é mais cético. Após implementar, o @avaliador vai verificar se a validação realmente cobre todos os pontos de entrada de itens no pedido.
- **Symphony SPEC.md como orquestrador**: State machine formal de tarefa. Esta SPEC define o contrato; o implementador segue; o avaliador verifica.
