/**
 * Clientes Module - Módulo pai para agrupar funcionalidades de clientes
 * 
 * Este é um módulo "container" que não tem UI própria,
 * apenas agrupa sub-módulos como histórico, recomendação, etc.
 */

import type { ModuleDefinition } from '../../ui/core/module-registry';

/**
 * Definição do módulo pai de clientes
 * Não tem panelFactory porque não tem UI própria
 */
export const ClientesModule: ModuleDefinition = {
  id: 'clientes',
  name: 'Clientes',
  // Sem parent (é módulo de nível superior)
  icon: '👥',
  dependencies: [],
  defaultSubModuleId: 'clientes.directory',
  // Módulo container não tem UI própria
  panelFactory: () => {
    throw new Error('ClientesModule é apenas um container, não tem UI própria');
  },
  lazy: false, // Não precisa lazy loading (não tem UI)
};

/**
 * Função de registro
 */
export function register(registry: { register: (module: ModuleDefinition) => void }): void {
  registry.register(ClientesModule);
}
