/**
 * Modules Index - Registro centralizado de todos os módulos
 * 
 * Por enquanto, módulos são registrados manualmente aqui.
 * No futuro, pode ser substituído por descoberta automática.
 */

import type { ModuleRegistry } from '../ui/core/module-registry';
import type { EventBus } from '../ui/core/event-bus';
import type { MettriModule } from './harness/types';
import { ToolRegistry } from './harness/tool-registry';
import { AgentLoop } from './harness/agent-loop';
import { consultarCatalogo } from './harness/tools/consultar-catalogo';
import { consultarPerfil } from './harness/tools/consultar-perfil';
import { consultarHistorico } from './harness/tools/consultar-historico';
import { registrarPedido } from './harness/tools/registrar-pedido';
import { enviarMensagem } from './harness/tools/enviar-mensagem';
import { AtendimentoModule } from './atendimento/atendimento-module';
import { ClientesModule } from './clientes/clientes-module';
import { InspectorPopup } from './harness/inspector-popup';
import { memoryStore } from './harness/memory-store';
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
import { DeliveryModule } from './delivery/delivery-module';
import { DeliveryDashboardModule } from './delivery/dashboard/dashboard-module';

// Global augmentation para expor harness no console (sem as any)
declare global {
  interface Window {
    __mettriHarness?: {
      registry: ToolRegistry;
      loop: AgentLoop;
      memoryStore: typeof memoryStore;
    };
  }
}

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
  registry.register(DeliveryModule);

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
  registry.register(DeliveryDashboardModule);
}

/**
 * Harness Module - Módulo de infraestrutura (sem UI) para o Agent Harness.
 *
 * Expõe ToolRegistry e AgentLoop como singleton em window.__mettriHarness
 * para acesso via console do navegador durante desenvolvimento.
 *
 * Uso:
 *   import { harnessModule } from './modules'
 *   const cleanup = await harnessModule.init(eventBus)
 */
export const harnessModule: MettriModule = {
  id: 'harness',
  init: async (eventBus: EventBus) => {
    const registry = new ToolRegistry(eventBus);

    // Registra as 5 ferramentas de negócio iniciais
    registry.registrar(consultarCatalogo);
    registry.registrar(consultarPerfil);
    registry.registrar(consultarHistorico);
    registry.registrar(registrarPedido);
    registry.registrar(enviarMensagem);

    const loop = new AgentLoop(registry, eventBus);

    // Inicializa inspector popup
    const inspector = new InspectorPopup();
    const disposeInspector = inspector.init(eventBus, (chatId) => {
      try {
        const store = (window as any).Store;
        if (store?.Chat) {
          const chat = typeof store.Chat.get === 'function' ? store.Chat.get(chatId) : null;
          if (chat) return chat.name || chat.formattedTitle || chat.pushname || chatId;
          // Fallback: percorrer modelos
          if (typeof store.Chat.getModelsArray === 'function') {
            const chats = store.Chat.getModelsArray();
            if (Array.isArray(chats)) {
              const found = chats.find((c: any) => {
                const id = typeof c.id === 'string' ? c.id : c.id?._serialized;
                return id === chatId;
              });
              if (found) return found.name || found.formattedTitle || found.pushname || chatId;
            }
          }
        }
      } catch {}
      return chatId;
    });

    // Registra como singleton para debug no console
    window.__mettriHarness = { registry, loop, memoryStore };

    return () => {
      disposeInspector();
      delete window.__mettriHarness;
    };
  },
};
