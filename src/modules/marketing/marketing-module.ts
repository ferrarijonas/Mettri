/**
 * Marketing Module - Módulo pai para agrupar funcionalidades de marketing
 * 
 * Este é um módulo "container" que não tem UI própria,
 * apenas agrupa sub-módulos como reativação, testes A/B, imagens, etc.
 */

import type { ModuleDefinition } from '../../ui/core/module-registry';

/**
 * Definição do módulo pai de marketing
 */
export const MarketingModule: ModuleDefinition = {
  id: 'marketing',
  name: 'Marketing',
  // Sem parent (é módulo de nível superior)
  icon: '📢',
  dependencies: [],
  // Módulo container não tem UI própria
  panelFactory: () => {
    throw new Error('MarketingModule é apenas um container, não tem UI própria');
  },
  lazy: false,
};

/**
 * Função de registro
 */
export function register(registry: { register: (module: ModuleDefinition) => void }): void {
  registry.register(MarketingModule);
}
