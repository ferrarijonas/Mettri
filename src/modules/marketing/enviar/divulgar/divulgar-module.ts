/**
 * Enviar/Divulgar - Submódulo (tela) dentro do fluxo Enviar.
 */

import type { ModuleDefinition, PanelFactory, PanelInstance } from '../../../../ui/core/module-registry';
import type { EventBus } from '../../../../ui/core/event-bus';
import { DivulgarPanel } from './divulgar-panel';

const createDivulgarPanel: PanelFactory = async (
  container: HTMLElement,
  _eventBus: EventBus
): Promise<PanelInstance> => {
  const panel = new DivulgarPanel();

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

export const EnviarDivulgarModule: ModuleDefinition = {
  id: 'marketing.enviar.divulgar',
  name: 'Divulgar',
  parent: 'marketing.enviar',
  icon: '📢',
  dependencies: [],
  panelFactory: createDivulgarPanel,
  lazy: true,
};

export function register(registry: { register: (module: ModuleDefinition) => void }): void {
  registry.register(EnviarDivulgarModule);
}

