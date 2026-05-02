import type { EventBus } from '../../../ui/core/event-bus';
import type { ModuleDefinition, PanelFactory, PanelInstance } from '../../../ui/core/module-registry';
import { MettriBridgeClient } from '../../../content/bridge-client';
import { mountSimuladorOportunidades, type SimuladorOportunidadesHandle } from '../../oportunidades/preview/simulador-mount';
import { ativarPausarEncerrarCampanha, criarCampanha, editarCampanha, listarCampanhas } from '../campaign-crud';
import type { Campaign } from '../types';
import { CampanhasPanel } from './campanhas-panel';
import {
  campaignToEditor,
  defaultEditor,
  editorToNewCampaignPayload,
  editorToPatch,
  getCampanhasAccountId,
  getCampanhasDashboardViewModel,
  getUiActor,
} from './provider';
import type { CampanhasEditorVm } from './view-model';

const createCampanhasDashboardPanel: PanelFactory = async (
  container: HTMLElement,
  _eventBus: EventBus,
): Promise<PanelInstance> => {
  const bridge = new MettriBridgeClient(2500);
  let panel: CampanhasPanel | null = null;
  let simHandle: SimuladorOportunidadesHandle | null = null;

  let activeTab: 'lista' | 'simulador' = 'lista';
  let editor: CampanhasEditorVm = defaultEditor();
  let operationError: string | null = null;
  let campaignsCache: Campaign[] = [];

  const syncCache = async (): Promise<void> => {
    const list = await listarCampanhas(bridge, getCampanhasAccountId());
    campaignsCache = list.ok ? list.data : [];
  };

  const buildVm = async (): Promise<void> => {
    await syncCache();
    const vm = await getCampanhasDashboardViewModel(bridge, {
      activeTab,
      editor,
      operationError,
    });
    panel?.update(vm);
  };

  const handleAction = async (actionId: string, payload?: unknown): Promise<void> => {
    const accountId = getCampanhasAccountId();
    const actor = getUiActor();

    if (actionId === 'campanhas:tab') {
      operationError = null;
      activeTab = (payload as { tab: 'lista' | 'simulador' }).tab;
      await buildVm();
      if (activeTab === 'simulador') {
        requestAnimationFrame(() => {
          const host = panel?.getSimuladorHost();
          if (host && !simHandle) {
            simHandle = mountSimuladorOportunidades(host, bridge);
          }
        });
      }
      return;
    }

    operationError = null;

    if (actionId === 'campanhas:refresh') {
      await buildVm();
      return;
    }

    if (actionId === 'campanhas:new') {
      editor = defaultEditor();
      await buildVm();
      return;
    }

    if (actionId === 'campanhas:select') {
      const id = (payload as { campaignId: string }).campaignId;
      const c = campaignsCache.find(x => x.campaignId === id);
      if (c) editor = campaignToEditor(c);
      await buildVm();
      return;
    }

    if (actionId === 'campanhas:save') {
      editor = (payload as { editor: CampanhasEditorVm }).editor;
      if (editor.mode === 'new') {
        const draft = editorToNewCampaignPayload(editor);
        const r = await criarCampanha(bridge, { accountId, draft, actor });
        if (!r.ok) {
          operationError = r.message;
        } else {
          editor = campaignToEditor(r.data);
        }
      } else if (editor.campaignId) {
        const r = await editarCampanha(bridge, {
          accountId,
          campaignId: editor.campaignId,
          patch: editorToPatch(editor),
          actor,
        });
        if (!r.ok) {
          operationError = r.message;
        } else {
          editor = campaignToEditor(r.data);
        }
      }
      await buildVm();
      return;
    }

    if (actionId === 'campanhas:status') {
      const { campaignId, status } = payload as { campaignId: string; status: Campaign['status'] };
      const r = await ativarPausarEncerrarCampanha(bridge, {
        accountId,
        campaignId,
        status,
        actor,
      });
      if (!r.ok) {
        operationError = r.message;
      } else {
        editor = campaignToEditor(r.data);
      }
      await buildVm();
    }
  };

  return {
    async render(): Promise<void> {
      container.innerHTML = '';
      simHandle?.destroy();
      simHandle = null;

      await syncCache();

      panel = new CampanhasPanel({
        onAction: async (id, p): Promise<void> => {
          await handleAction(id, p);
        },
      });

      const vm = await getCampanhasDashboardViewModel(bridge, {
        activeTab,
        editor,
        operationError,
      });
      container.appendChild(panel.render(vm));
    },
    destroy(): void {
      simHandle?.destroy();
      simHandle = null;
      panel?.destroy();
      panel = null;
      container.innerHTML = '';
    },
  };
};

export const CampanhasDashboardModule: ModuleDefinition = {
  id: 'campanhas.dashboard',
  name: 'Campanhas',
  parent: 'campanhas',
  icon: '📣',
  dependencies: [],
  panelFactory: createCampanhasDashboardPanel,
  lazy: true,
};
