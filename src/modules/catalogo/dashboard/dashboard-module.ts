import type { EventBus } from '../../../ui/core/event-bus';
import type { ModuleDefinition, PanelFactory, PanelInstance } from '../../../ui/core/module-registry';
import { CatalogoPanel } from './catalogo-panel';
import {
  atualizarProdutoCatalogoInline,
  criarProdutoCatalogo,
  duplicarProdutoCatalogo,
  ensureCatalogoSeedOnFirstAccess,
  excluirProdutoCatalogo,
  getCatalogoDashboardViewModel,
} from './provider';

function toNumberOrZero(value: string): number {
  const normalized = String(value || '').replace(',', '.').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

const createCatalogoDashboardPanel: PanelFactory = async (
  container: HTMLElement,
  _eventBus: EventBus,
): Promise<PanelInstance> => {
  let ui: CatalogoPanel | null = null;
  let isSeedChecked = false;

  const rerender = async (): Promise<void> => {
    if (!isSeedChecked) {
      isSeedChecked = true;
      await ensureCatalogoSeedOnFirstAccess();
    }
    const vm = await getCatalogoDashboardViewModel();
    if (ui) ui.destroy();
    container.innerHTML = '';
    ui = new CatalogoPanel({
      onAction: async (actionId, payload): Promise<void> => {
        try {
          if (actionId === 'produto:new') {
            const nome = prompt('Nome do produto:');
            if (!nome || !nome.trim()) return;
            const precoRaw = prompt('Preco (ex.: 29,90):', '0');
            if (precoRaw === null) return;
            await criarProdutoCatalogo({ nome: nome.trim(), precoReais: toNumberOrZero(precoRaw) });
            await rerender();
            return;
          }

          if (actionId === 'produto:update-inline') {
            const produtoId = String((payload as { produtoId?: string } | undefined)?.produtoId || '').trim();
            if (!produtoId) return;
            const p = payload as {
              produtoId: string;
              field: 'nome' | 'precoCentavos' | 'estoqueDisponivel' | 'categoria';
              value: string;
            };
            if (!p.field) return;
            if (p.field === 'nome') {
              await atualizarProdutoCatalogoInline({
                id: produtoId,
                nome: p.value,
              });
            } else if (p.field === 'precoCentavos') {
              await atualizarProdutoCatalogoInline({
                id: produtoId,
                precoCentavos: Math.max(0, Math.round(toNumberOrZero(p.value) * 100)),
              });
            } else if (p.field === 'estoqueDisponivel') {
              const raw = p.value.trim().toLowerCase();
              const value = raw === '' || raw === 'null' ? null : Math.max(0, Math.round(toNumberOrZero(raw)));
              await atualizarProdutoCatalogoInline({
                id: produtoId,
                estoqueDisponivel: value,
              });
            } else if (p.field === 'categoria') {
              await atualizarProdutoCatalogoInline({
              id: produtoId,
                categoria: p.value,
              });
            }
            await rerender();
            return;
          }

          if (actionId === 'produto:toggle') {
            const produtoId = String((payload as { produtoId?: string } | undefined)?.produtoId || '').trim();
            if (!produtoId) return;
            const ativo = Boolean((payload as { ativo?: boolean } | undefined)?.ativo);
            await atualizarProdutoCatalogoInline({ id: produtoId, ativo });
            await rerender();
            return;
          }

          if (actionId === 'produto:duplicate') {
            const produtoId = String((payload as { produtoId?: string } | undefined)?.produtoId || '').trim();
            if (!produtoId) return;
            await duplicarProdutoCatalogo(produtoId);
            await rerender();
            return;
          }

          if (actionId === 'produto:delete') {
            const produtoId = String((payload as { produtoId?: string } | undefined)?.produtoId || '').trim();
            if (!produtoId) return;
            const shouldDelete = confirm('Excluir este produto? Essa ação não pode ser desfeita.');
            if (!shouldDelete) return;
            await excluirProdutoCatalogo(produtoId);
            await rerender();
          }
        } catch (error) {
          alert(error instanceof Error ? error.message : 'Erro ao salvar produto.');
        }
      },
    });
    const root = await ui.render(vm);
    container.appendChild(root);
  };

  return {
    async render(): Promise<void> {
      await rerender();
    },
    destroy(): void {
      if (ui) ui.destroy();
      container.innerHTML = '';
    },
  };
};

export const CatalogoDashboardModule: ModuleDefinition = {
  id: 'catalogo.dashboard',
  name: 'Catalogo',
  parent: 'catalogo',
  icon: '🏷️',
  dependencies: [],
  panelFactory: createCatalogoDashboardPanel,
  lazy: true,
};
