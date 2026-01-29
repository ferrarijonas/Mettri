/**
 * Modules Index - Registro centralizado de todos os módulos
 * 
 * Por enquanto, módulos são registrados manualmente aqui.
 * No futuro, pode ser substituído por descoberta automática.
 */

import type { ModuleRegistry } from '../ui/core/module-registry';
import { ClientesModule } from './clientes/clientes-module';
import { HistoryModule } from './clientes/history/history-module';
import { InfrastructureModule } from './infrastructure/infrastructure-module';
import { TestsModule } from './infrastructure/tests/tests-module';
import { MarketingModule } from './marketing/marketing-module';
import { ReactivationModule } from './marketing/reactivation/reactivation-module';

/**
 * Registra todos os módulos no registry
 * IMPORTANTE: Registrar módulos pais ANTES dos filhos
 */
export function registerAllModules(registry: ModuleRegistry): void {
  // Registrar módulos pais primeiro
  registry.register(ClientesModule);
  registry.register(InfrastructureModule);
  registry.register(MarketingModule);
  
  // Depois registrar módulos filhos
  registry.register(HistoryModule);
  registry.register(TestsModule);
  registry.register(ReactivationModule);
}
