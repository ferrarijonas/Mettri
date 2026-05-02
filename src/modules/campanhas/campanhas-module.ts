import type { ModuleDefinition } from '../../ui/core/module-registry';

export const CampanhasModule: ModuleDefinition = {
  id: 'campanhas',
  name: 'Campanhas',
  icon: '📣',
  dependencies: [],
  defaultSubModuleId: 'campanhas.dashboard',
  panelFactory: () => {
    throw new Error('CampanhasModule é apenas container.');
  },
  lazy: false,
};
