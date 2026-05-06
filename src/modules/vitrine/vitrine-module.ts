import type { ModuleDefinition } from '../../ui/core/module-registry';

export const VitrineModule: ModuleDefinition = {
  id: 'vitrine',
  name: 'Vitrine',
  icon: '🧩',
  dependencies: [],
  defaultSubModuleId: 'vitrine.dashboard',
  panelFactory: () => {
    throw new Error('VitrineModule é apenas container.');
  },
  lazy: false,
};

