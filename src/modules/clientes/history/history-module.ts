/**
 * History Module - Módulo de histórico de conversas
 * 
 * Exibe histórico completo de mensagens por contato,
 * com ordenação 1/1 com WhatsApp e busca/filtros.
 */

import type { ModuleDefinition, PanelFactory } from '../../../ui/core/module-registry';
import type { EventBus } from '../../../ui/core/event-bus';
import type { PanelInstance } from '../../../ui/core/module-registry';
import { HistoryPanel } from './history-panel';
import { MettriBridgeClient } from '../../../content/bridge-client';

/**
 * Factory que cria instância do HistoryPanel
 */
const createHistoryPanel: PanelFactory = async (container: HTMLElement, eventBus: EventBus): Promise<PanelInstance> => {
  const bridge = new MettriBridgeClient(2500);

  let historyEnabled = false;
  try {
    const result = await bridge.storageGet(['settings']);
    const settings = result?.settings as unknown;
    historyEnabled = typeof settings === 'object' && settings !== null && (settings as Record<string, unknown>).historyEnabled === true;
  } catch {
    historyEnabled = false;
  }

  const panel = new HistoryPanel({ enabled: historyEnabled });

  const onSettingsChanged = (data: { enabled: boolean }) => {
    historyEnabled = data.enabled === true;
    panel.setEnabled(historyEnabled);
  };

  const onMessageNew = async () => {
    if (!historyEnabled) return;
    setTimeout(async () => {
      try {
        await panel.refresh();
      } catch (error) {
        console.error('[HistoryModule] Erro ao atualizar histórico:', error);
      }
    }, 100); // 100ms é suficiente para WhatsApp atualizar ordem
  };

  // Escutar mudanças de config e novas mensagens (apenas enquanto painel está ativo)
  eventBus.on('settings:history-enabled', onSettingsChanged);
  eventBus.on('message:new', onMessageNew);

  return {
    async render() {
      const element = await panel.render();
      container.appendChild(element);
    },
    destroy() {
      eventBus.off('settings:history-enabled', onSettingsChanged);
      eventBus.off('message:new', onMessageNew);
      panel.destroy();
    },
  };
};

/**
 * Definição do módulo de histórico
 */
export const HistoryModule: ModuleDefinition = {
  id: 'clientes.history',
  name: 'Histórico',
  parent: 'clientes', // Módulo filho de clientes
  icon: '📜',
  dependencies: [],
  panelFactory: createHistoryPanel,
  lazy: true,
  // modulePath será usado para lazy loading dinâmico no futuro
  // modulePath: '../../modules/clientes/history/history-module',
};

/**
 * Função de registro para descoberta automática
 */
export function register(registry: { register: (module: ModuleDefinition) => void }): void {
  registry.register(HistoryModule);
}
