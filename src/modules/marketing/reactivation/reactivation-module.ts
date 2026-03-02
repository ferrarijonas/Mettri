/**
 * Reactivation Module - Módulo de reativação de clientes
 * 
 * Permite configurar régua de cadência, visualizar clientes elegíveis,
 * gerar mensagens personalizadas e enviar em massa.
 */

import type { ModuleDefinition, PanelFactory } from '../../../ui/core/module-registry';
import type { EventBus } from '../../../ui/core/event-bus';
import type { PanelInstance } from '../../../ui/core/module-registry';
import { ReactivationPanel } from './reactivation-panel';

/**
 * Factory que cria instância do ReactivationPanel
 */
const createReactivationPanel: PanelFactory = async (container: HTMLElement, _eventBus: EventBus): Promise<PanelInstance> => {
  const panel = new ReactivationPanel();
  
  // Adapter para compatibilidade com PanelInstance
  return {
    async render() {
      try {
        const element = await panel.render();
        container.appendChild(element);
      } catch (error) {
        console.error('[REACTIVATION MODULE] Erro ao renderizar:', error);
        container.innerHTML = `
          <div class="mettri-error">
            <p>Erro ao carregar painel de reativação.</p>
            <p>Verifique o console para mais detalhes.</p>
          </div>
        `;
      }
    },
    destroy() {
      panel.destroy();
      if (container) {
        container.innerHTML = '';
      }
    }
  };
};

/**
 * Definição do módulo de reativação
 */
export const ReactivationModule: ModuleDefinition = {
  id: 'marketing.reactivation',
  name: 'Reativação',
  parent: 'marketing', // Módulo filho de marketing
  icon: '🔄',
  dependencies: [],
  panelFactory: createReactivationPanel,
  lazy: true,
  // modulePath será usado para lazy loading dinâmico no futuro
  // modulePath: '../../modules/marketing/reactivation/reactivation-module',
};

/**
 * Função de registro para descoberta automática
 */
export function register(registry: { register: (module: ModuleDefinition) => void }): void {
  registry.register(ReactivationModule);
}
