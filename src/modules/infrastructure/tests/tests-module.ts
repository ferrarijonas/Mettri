/**
 * Tests Module - Módulo de testes da Sentinela
 * 
 * Permite testar todos os módulos do WhatsApp Web
 * organizados hierarquicamente.
 */

import type { ModuleDefinition, PanelFactory } from '../../../ui/core/module-registry';
import type { EventBus } from '../../../ui/core/event-bus';
import type { PanelInstance } from '../../../ui/core/module-registry';
import { TestPanel } from './test-panel';
import { whatsappInterceptors } from '../../../infrastructure/whatsapp-interceptors';

/**
 * Factory que cria instância do TestPanel
 */
const createTestPanel: PanelFactory = async (container: HTMLElement, _eventBus: EventBus): Promise<PanelInstance> => {
  // Inicializa interceptores se necessário
  await whatsappInterceptors.initialize();

  const testPanel = new TestPanel(whatsappInterceptors);

  // Adapter para compatibilidade com PanelInstance
  return {
    async render() {
      const element = await testPanel.render();
      container.appendChild(element);
    },
    destroy() {
      // TestPanel não tem destroy explícito ainda
    }
  };
};

/**
 * Definição do módulo de testes
 */
export const TestsModule: ModuleDefinition = {
  id: 'infrastructure.tests',
  name: 'Testes',
  parent: 'infrastructure', // Módulo filho de infrastructure
  icon: '🧪',
  dependencies: [],
  panelFactory: createTestPanel,
  lazy: true,
  // modulePath será usado para lazy loading dinâmico no futuro
  // modulePath: '../../modules/infrastructure/tests/tests-module',
};

/**
 * Função de registro para descoberta automática
 */
export function register(registry: { register: (module: ModuleDefinition) => void }): void {
  registry.register(TestsModule);
}
