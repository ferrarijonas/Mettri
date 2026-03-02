/**
 * Atendimento Module - Módulo pai para agrupar funcionalidades de atendimento.
 *
 * Metáfora: é a "pasta" do Atendimento. Ela não mostra conteúdo sozinha,
 * só organiza as telas-filhas (ex.: atendimento.dashboard).
 */
import type { ModuleDefinition } from '../../ui/core/module-registry';

export const AtendimentoModule: ModuleDefinition = {
  id: 'atendimento',
  name: 'Atendimento',
  // Sem parent (é módulo de nível superior)
  icon: '💬',
  dependencies: [],
  // Filho padrão do container (não depender de ordem alfabética)
  defaultSubModuleId: 'atendimento.dashboard',
  // Módulo container não tem UI própria
  panelFactory: () => {
    throw new Error('AtendimentoModule é apenas um container, não tem UI própria');
  },
  lazy: false,
};

export function register(registry: { register: (module: ModuleDefinition) => void }): void {
  registry.register(AtendimentoModule);
}

