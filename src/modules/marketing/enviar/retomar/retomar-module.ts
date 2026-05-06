/**
 * Enviar/Retomar - Submódulo (tela) de retomada dentro do fluxo Enviar.
 *
 * Nesta fase: reaproveita o RetomarPanel existente (mock UI).
 */

import type { ModuleDefinition, PanelFactory, PanelInstance } from '../../../../ui/core/module-registry';
import type { EventBus } from '../../../../ui/core/event-bus';
import { RetomarPanel } from '../../retomar/retomar-panel';

const createRetomarPanel: PanelFactory = async (
  container: HTMLElement,
  _eventBus: EventBus
): Promise<PanelInstance> => {
  const panel = new RetomarPanel();

  return {
    async render() {
      const element = await panel.render();
      container.appendChild(element);
    },
    destroy() {
      panel.destroy();
      if (container) container.innerHTML = '';
    },
  };
};

export const EnviarRetomarModule: ModuleDefinition = {
  id: 'marketing.enviar.retomar',
  name: 'Retomar',
  parent: 'marketing.enviar',
  icon: '🔄',
  dependencies: [],
  panelFactory: createRetomarPanel,
  lazy: true,
};

export function register(registry: { register: (module: ModuleDefinition) => void }): void {
  registry.register(EnviarRetomarModule);
}
