/**
 * Enviar/Reativar - Submódulo (tela) de reativação dentro do fluxo Enviar.
 *
 * Nesta fase: reaproveita o ReactivationPanel existente (mock UI).
 */

import type { ModuleDefinition, PanelFactory, PanelInstance } from '../../../../ui/core/module-registry';
import type { EventBus } from '../../../../ui/core/event-bus';
import { ReactivationPanel } from '../../reactivation/reactivation-panel';

const createReativarPanel: PanelFactory = async (
  container: HTMLElement,
  _eventBus: EventBus
): Promise<PanelInstance> => {
  const panel = new ReactivationPanel();

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

export const EnviarReativarModule: ModuleDefinition = {
  id: 'marketing.enviar.reativar',
  name: 'Reativar',
  parent: 'marketing.enviar',
  icon: '🔄',
  dependencies: [],
  panelFactory: createReativarPanel,
  lazy: true,
};

export function register(registry: { register: (module: ModuleDefinition) => void }): void {
  registry.register(EnviarReativarModule);
}

