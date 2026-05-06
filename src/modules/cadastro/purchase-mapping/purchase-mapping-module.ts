/**
 * Purchase Mapping Module - Mapear compras já existentes.
 * Spec: specs/cadastro/spec.md
 */

import type { ModuleDefinition, PanelFactory, PanelInstance } from '../../../ui/core/module-registry';
import type { EventBus } from '../../../ui/core/event-bus';
import { PurchaseMappingPanel } from './purchase-mapping-panel';

const createPanel: PanelFactory = async (
  container: HTMLElement,
  _eventBus: EventBus
): Promise<PanelInstance> => {
  const panel = new PurchaseMappingPanel();
  const root = await panel.render();
  container.appendChild(root);
  return {
    render: () => {},
    destroy: () => {
      panel.destroy();
    },
  };
};

export const PurchaseMappingModule: ModuleDefinition = {
  id: 'cadastro.purchase-mapping',
  name: 'Mapear compras já existentes',
  parent: 'cadastro',
  icon: '🛒',
  dependencies: [],
  panelFactory: createPanel,
  lazy: false,
};
