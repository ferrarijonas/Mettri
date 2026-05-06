/**
 * Enviar Module (container) - Agrupa fluxos de envio dentro de Marketing
 *
 * IMPORTANTE: Este módulo é um "container" (sem UI própria).
 * O PanelShell detecta filhos via parent/child e renderiza o primeiro filho (ou default) automaticamente.
 */

import type { ModuleDefinition } from '../../../ui/core/module-registry';

export const EnviarModule: ModuleDefinition = {
  id: 'marketing.enviar',
  name: 'Enviar',
  parent: 'marketing',
  icon: '✉️',
  dependencies: [],
  // Filho padrão do container (não depender de ordem alfabética)
  defaultSubModuleId: 'marketing.enviar.retomar',
  panelFactory: () => {
    throw new Error('EnviarModule é apenas um container, não tem UI própria');
  },
  lazy: false,
};

export function register(registry: { register: (module: ModuleDefinition) => void }): void {
  registry.register(EnviarModule);
}

