import type { ModuleDefinition } from '../../ui/core/module-registry';

export const PedidosModule: ModuleDefinition = {
  id: 'pedidos',
  name: 'Pedidos',
  icon: '📦',
  dependencies: [],
  defaultSubModuleId: 'pedidos.dashboard',
  panelFactory: () => {
    throw new Error('PedidosModule é apenas container, não tem UI própria.');
  },
  lazy: false,
};
