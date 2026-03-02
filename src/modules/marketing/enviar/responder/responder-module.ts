/**
 * Enviar/Responder - Submódulo (tela) dentro do fluxo Enviar.
 */

import type { ModuleDefinition, PanelFactory, PanelInstance } from '../../../../ui/core/module-registry';
import type { EventBus } from '../../../../ui/core/event-bus';
import { ResponderPanel } from './responder-panel';

const createResponderPanel: PanelFactory = async (
  container: HTMLElement,
  _eventBus: EventBus
): Promise<PanelInstance> => {
  const panel = new ResponderPanel();

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

export const EnviarResponderModule: ModuleDefinition = {
  id: 'marketing.enviar.responder',
  name: 'Responder',
  parent: 'marketing.enviar',
  icon: '💬',
  dependencies: [],
  panelFactory: createResponderPanel,
  lazy: true,
};

export function register(registry: { register: (module: ModuleDefinition) => void }): void {
  registry.register(EnviarResponderModule);
}

