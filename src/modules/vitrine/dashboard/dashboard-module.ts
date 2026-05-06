import type { EventBus } from '../../../ui/core/event-bus';
import type { ModuleDefinition, PanelFactory, PanelInstance } from '../../../ui/core/module-registry';
import { getVitrineDashboardViewModel } from './provider';
import { VitrinePanel } from './vitrine-panel';
import type { VitrineCanal } from './view-model';

const createVitrineDashboardPanel: PanelFactory = async (
  container: HTMLElement,
  _eventBus: EventBus,
): Promise<PanelInstance> => {
  let ui: VitrinePanel | null = null;
  let canalAtivo: VitrineCanal = 'whatsapp';

  const rerender = async (): Promise<void> => {
    const vm = await getVitrineDashboardViewModel();
    if (ui) ui.destroy();
    container.innerHTML = '';
    ui = new VitrinePanel({
      onAction: async (actionId, payload): Promise<void> => {
        if (actionId === 'vitrine:refresh') {
          try {
            ui?.setError(null);
            ui?.setLoading(true);
            await rerender();
          } catch (error) {
            ui?.setError(error instanceof Error ? error.message : 'Erro ao atualizar vitrine.');
          } finally {
            ui?.setLoading(false);
          }
          return;
        }

        if (actionId === 'vitrine:set-channel') {
          const maybeChannel = String((payload as { channel?: unknown } | undefined)?.channel || '').trim() as VitrineCanal;
          if (maybeChannel === 'whatsapp' || maybeChannel === 'instagram' || maybeChannel === 'site' || maybeChannel === 'site_ofertas') {
            canalAtivo = maybeChannel;
            ui?.setCanalAtivo(canalAtivo);
          }
          return;
        }

        if (actionId === 'vitrine:toggle-json') {
          // Ação intencionalmente local neste MVP (somente visualização).
          return;
        }
      },
    });
    const root = await ui.render(vm);
    container.appendChild(root);
    ui.setCanalAtivo(canalAtivo);
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

export const VitrineDashboardModule: ModuleDefinition = {
  id: 'vitrine.dashboard',
  name: 'Vitrine',
  parent: 'vitrine',
  icon: '🧩',
  dependencies: [],
  panelFactory: createVitrineDashboardPanel,
  lazy: true,
};

