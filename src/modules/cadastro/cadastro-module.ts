/**
 * Cadastro Module - Módulo pai para área de cadastro (ex.: mapear compras).
 */

import type { ModuleDefinition } from '../../ui/core/module-registry';

export const CadastroModule: ModuleDefinition = {
  id: 'cadastro',
  name: 'Cadastro',
  icon: '📋',
  dependencies: [],
  defaultSubModuleId: 'cadastro.cliente-profile',
  panelFactory: () => {
    throw new Error('CadastroModule é apenas um container, não tem UI própria');
  },
  lazy: false,
};
