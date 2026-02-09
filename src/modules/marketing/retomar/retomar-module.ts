/**
 * Retomar Module - Módulo de retomada de clientes
 * 
 * Permite configurar régua de cadência, visualizar clientes elegíveis,
 * gerar mensagens personalizadas e enviar em massa.
 */

import type { ModuleDefinition, PanelFactory } from '../../../ui/core/module-registry';
import type { EventBus } from '../../../ui/core/event-bus';
import type { PanelInstance } from '../../../ui/core/module-registry';
import { RetomarPanel } from './retomar-panel';

/**
 * Factory que cria instância do RetomarPanel
 */
const createRetomarPanel: PanelFactory = async (container: HTMLElement, _eventBus: EventBus): Promise<PanelInstance> => {
  const panel = new RetomarPanel();
  
  // Adapter para compatibilidade com PanelInstance
  return {
    async render() {
      try {
        const element = await panel.render();
        container.appendChild(element);
      } catch (error) {
        console.error('[RETOMAR MODULE] Erro ao renderizar:', error);
        container.innerHTML = `
          <div class="mettri-error">
            <p>Erro ao carregar painel de retomada.</p>
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
 * Definição do módulo de retomada
 */
export const RetomarModule: ModuleDefinition = {
  id: 'marketing.retomar',
  name: 'Retomar',
  parent: 'marketing', // Módulo filho de marketing
  icon: '🔄',
  dependencies: [],
  panelFactory: createRetomarPanel,
  lazy: true,
  // modulePath será usado para lazy loading dinâmico no futuro
  // modulePath: '../../modules/marketing/retomar/retomar-module',
};

/**
 * Função de registro para descoberta automática
 */
export function register(registry: { register: (module: ModuleDefinition) => void }): void {
  registry.register(RetomarModule);
}
