# Briefing — T-001: Validar itens de pedido contra catálogo

**Domínio:** ATENDIMENTO  
**Prioridade:** 1 (CRÍTICO)  
**Arquivos a modificar:** `src/storage/order-db.ts`, `src/modules/atendimento/dashboard/dashboard-module.ts`

---

## Problema

`orderDB.addItem()` e o handler `order:addItem` aceitam qualquer `skuId` (string) sem verificar se o produto existe no catálogo. Isso permite registrar pedidos com itens inexistentes, preços zerados, e nomes arbitrários.

A ZenSpec `modelo-pedido-unificado.zenspec.md` (Regra R2) diz que `lead → draft` só deve acontecer com pelo menos 1 produto com match no catálogo — isso não está implementado.

---

## O que implementar

### 1. `src/storage/order-db.ts` — `addItem()` (linha 339)

**Adicionar validação de catálogo após as validações existentes (status + duplicata) e antes de inserir o item:**

```typescript
// Após validar status e duplicata, ANTES de push():
const accountId = this.currentUserWid || 'default';
const catalogItem = await catalogoDB.getBySku(accountId, item.skuId);
if (!catalogItem) {
  throw new Error(`OrderDB: produto ${item.skuId} não encontrado no catálogo`);
}
```

**Necessário:** adicionar `import { catalogoDB } from './catalogo-db';` no topo do arquivo.

### 2. `src/storage/order-db.ts` — `advanceStatus()` (linha 311)

**Adicionar validação de catálogo ao transicionar para `open` (draft→open) ou `draft` (lead→draft):**

Depois de validar a transição e antes de criar o `updated` record, verificar todos os itens:

```typescript
// Validar itens contra catálogo nas transições lead→draft e draft→open
if ((currentStatus === 'lead' && next === 'draft') || (currentStatus === 'draft' && next === 'open')) {
  const accountId = this.currentUserWid || 'default';
  const itens = existing.itens || [];
  for (const item of itens) {
    const catItem = await catalogoDB.getBySku(accountId, item.skuId);
    if (!catItem) {
      throw new Error(`OrderDB: produto ${item.skuId} não encontrado no catálogo`);
    }
  }
}
```

### 3. `src/modules/atendimento/dashboard/dashboard-module.ts` — handler `order:addItem` (linha 434)

**Adicionar validação com `catalogoDB` antes de chamar `orderDB.addItem()`:**

```typescript
if (actionId === 'order:addItem') {
  const p = payload as { orderId?: string; skuId?: string; nome?: string; quantidade?: number; precoUnitarioCentavos?: number };
  const orderId = String(p?.orderId || '').trim();
  if (!orderId || !p?.skuId) return;
  
  // Validar produto no catálogo
  const accountId = catalogoDB.getCurrentUserWid() || 'default';
  const catalogItem = await catalogoDB.getBySku(accountId, p.skuId);
  if (!catalogItem) {
    alert(`Produto "${p.skuId}" não encontrado no catálogo.`);
    return;
  }
  
  try {
    await orderDB.addItem(orderId, {
      skuId: p.skuId,
      nome: String(p.nome || p.skuId),
      quantidade: p.quantidade || 1,
      precoUnitarioCentavos: p.precoUnitarioCentavos || 0,
    });
    await rerender();
  } catch (err) { /* ... existente ... */ }
  return;
}
```

**Necessário:** adicionar `import { catalogoDB } from '../../../storage/catalogo-db';` no topo do arquivo.

---

## Arquivos envolvidos

| Arquivo | Linhas | Mudança |
|---------|--------|---------|
| `src/storage/order-db.ts` | 1 (imports) | Adicionar `import { catalogoDB } from './catalogo-db';` |
| `src/storage/order-db.ts` | 339-369 (`addItem`) | Validar `skuId` contra catalogoDB antes de push |
| `src/storage/order-db.ts` | 311-335 (`advanceStatus`) | Validar todos os itens ao transicionar para draft/open |
| `src/modules/atendimento/dashboard/dashboard-module.ts` | 5 (imports) | Adicionar `import { catalogoDB }` |
| `src/modules/atendimento/dashboard/dashboard-module.ts` | 434-451 (`order:addItem`) | Validar com catalogoDB.getBySku antes de addItem |

---

## Sabotagens do Domínio

### ATENDIMENTO
- ⚠️ **Overengineering de Pipeline** — Mudança é < 50 linhas. Não refatorar o OrderDB inteiro. Apenas adicionar as validações pontuais.
- ⚠️ **Fuga para Módulo Errado** — NÃO tocar em `src/modules/ouvir/validador-catalogo.ts`. Esta validação é do domínio COMERCIAL, não OUVIR.

### Global
- ⚠️ **Overengineering** — "O suficiente para testar é suficiente." Uma chamada a `getBySku()` + erro claro. Sem abstrações, sem cache layer.
- ⚠️ **Genericidade prematura** — Não criar interface genérica de validação. Validar pontualmente.

---

## Gate-Runner

Após implementar, rodar nesta ordem:
```bash
cd C:\Mettri4 && npm run lint
cd C:\Mettri4 && npm run type-check
cd C:\Mettri4 && npm run build
cd C:\Mettri4 && npm run test:unit
```

## Critério de Sucesso

- [ ] `addItem()` com skuId existente → sucesso (comportamento preservado)
- [ ] `addItem()` com skuId inexistente → erro claro
- [ ] `advanceStatus(draft→open)` com itens válidos → sucesso
- [ ] `advanceStatus(draft→open)` com item inválido → erro
- [ ] Handler `order:addItem` exibe alerta para skuId inválido
- [ ] lint: 0 erros
- [ ] typecheck: 0 erros
- [ ] build: passa
- [ ] test:unit: passa
