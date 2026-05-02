import type { ModuleDefinition } from '../../ui/core/module-registry';

export const CatalogoModule: ModuleDefinition = {
  id: 'catalogo',
  name: 'Catalogo',
  icon: '🏷️',
  dependencies: [],
  defaultSubModuleId: 'catalogo.dashboard',
  panelFactory: () => {
    throw new Error('CatalogoModule é apenas container.');
  },
  lazy: false,
};
