/**
 * Infrastructure Module - Módulo pai para agrupar funcionalidades de infraestrutura
 * 
 * Este é um módulo "container" que não tem UI própria,
 * apenas agrupa sub-módulos como testes, seletores, etc.
 */

import type { ModuleDefinition } from '../../ui/core/module-registry';

/**
 * Definição do módulo pai de infraestrutura
 */
export const InfrastructureModule: ModuleDefinition = {
  id: 'infrastructure',
  name: 'Infraestrutura',
  // Sem parent (é módulo de nível superior)
  icon: '⚙️',
  dependencies: [],
  // Módulo container não tem UI própria
  panelFactory: () => {
    throw new Error('InfrastructureModule é apenas um container, não tem UI própria');
  },
  lazy: false,
};

/**
 * Função de registro
 */
export function register(registry: { register: (module: ModuleDefinition) => void }): void {
  registry.register(InfrastructureModule);
}
