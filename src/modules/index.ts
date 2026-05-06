/**
 * Modules Index - Registro centralizado de todos os módulos
 * 
 * Por enquanto, módulos são registrados manualmente aqui.
 * No futuro, pode ser substituído por descoberta automática.
 */

import type { ModuleRegistry } from '../ui/core/module-registry';
import { AtendimentoModule } from './atendimento/atendimento-module';
import { ClientesModule } from './clientes/clientes-module';
import { ClientesDirectoryModule } from './clientes/directory/directory-module';
import { HistoryModule } from './clientes/history/history-module';
import { InfrastructureModule } from './infrastructure/infrastructure-module';
import { TestsModule } from './infrastructure/tests/tests-module';
import { MarketingModule } from './marketing/marketing-module';
import { RetomarModule } from './marketing/retomar/retomar-module';
import { EnviarModule } from './marketing/enviar/enviar-module';
import { EnviarRetomarModule } from './marketing/enviar/retomar/retomar-module';
import { EnviarResponderModule } from './marketing/enviar/responder/responder-module';
import { EnviarDivulgarModule } from './marketing/enviar/divulgar/divulgar-module';
import { AtendimentoDashboardModule } from './atendimento/dashboard/dashboard-module';
import { CadastroModule } from './cadastro/cadastro-module';
import { PurchaseMappingModule } from './cadastro/purchase-mapping/purchase-mapping-module';
import { ClienteProfileModule } from './cadastro/cliente-profile';
import { CatalogoModule } from './catalogo/catalogo-module';
import { CatalogoDashboardModule } from './catalogo/dashboard/dashboard-module';
import { VitrineModule } from './vitrine/vitrine-module';
import { VitrineDashboardModule } from './vitrine/dashboard/dashboard-module';
import { CampanhasModule } from './campanhas/campanhas-module';
import { CampanhasDashboardModule } from './campanhas/dashboard/dashboard-module';
import { PedidosModule } from './pedidos/pedidos-module';
import { PedidosDashboardModule } from './pedidos/dashboard/dashboard-module';

/**
 * Registra todos os módulos no registry
 * IMPORTANTE: Registrar módulos pais ANTES dos filhos
 */
export function registerAllModules(registry: ModuleRegistry): void {
  // Registrar módulos pais primeiro
  registry.register(AtendimentoModule);
  registry.register(ClientesModule);
  registry.register(InfrastructureModule);
  registry.register(MarketingModule);
  registry.register(CadastroModule);
  registry.register(CatalogoModule);
  registry.register(VitrineModule);
  registry.register(CampanhasModule);
  registry.register(PedidosModule);

  // Depois registrar módulos filhos
  registry.register(AtendimentoDashboardModule);
  registry.register(ClienteProfileModule);
  registry.register(PurchaseMappingModule);
  registry.register(CatalogoDashboardModule);
  registry.register(VitrineDashboardModule);
  registry.register(CampanhasDashboardModule);
  registry.register(ClientesDirectoryModule);
  registry.register(HistoryModule);
  registry.register(TestsModule);
  registry.register(RetomarModule);
  registry.register(EnviarModule);
  registry.register(EnviarRetomarModule);
  registry.register(EnviarResponderModule);
  registry.register(EnviarDivulgarModule);
  registry.register(PedidosDashboardModule);
}
