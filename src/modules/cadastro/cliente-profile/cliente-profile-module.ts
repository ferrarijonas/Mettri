import type { EventBus } from '../../../ui/core/event-bus';
import type { ModuleDefinition, PanelFactory, PanelInstance } from '../../../ui/core/module-registry';
import { ClienteProfilePanel } from './cliente-profile-panel';

const createPanel: PanelFactory = async (
  container: HTMLElement,
  eventBus: EventBus
): Promise<PanelInstance> => {
  const panel = new ClienteProfilePanel(eventBus);
  const root = await panel.render();
  container.appendChild(root);
  return {
    render: (): void => undefined,
    destroy: (): void => {
      panel.destroy();
    },
  };
};

export const ClienteProfileModule: ModuleDefinition = {
  id: 'cadastro.cliente-profile',
  name: 'Perfil do cliente',
  parent: 'cadastro',
  icon: '👤',
  dependencies: [],
  panelFactory: createPanel,
  lazy: false,
};
