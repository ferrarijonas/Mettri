/**
 * Directory Module - Cadastro de clientes (MVP)
 *
 * Mostra uma lista simples e permite editar nome/telefone/endereço.
 */

import type { ModuleDefinition, PanelFactory } from '../../../ui/core/module-registry';
import type { EventBus } from '../../../ui/core/event-bus';
import type { PanelInstance } from '../../../ui/core/module-registry';
import { ClientesDirectoryPanel } from './directory-panel';

const createDirectoryPanel: PanelFactory = async (
  container: HTMLElement,
  eventBus: EventBus
): Promise<PanelInstance> => {
  const panel = new ClientesDirectoryPanel(eventBus);

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

export const ClientesDirectoryModule: ModuleDefinition = {
  id: 'clientes.directory',
  name: 'Cadastro',
  parent: 'clientes',
  icon: '🪪',
  dependencies: [],
  panelFactory: createDirectoryPanel,
  lazy: true,
};

export function register(registry: { register: (module: ModuleDefinition) => void }): void {
  registry.register(ClientesDirectoryModule);
}

