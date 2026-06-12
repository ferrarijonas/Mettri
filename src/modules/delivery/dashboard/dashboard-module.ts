/**
 * Dashboard Delivery — visão geral de entregas
 *
 * Exibe:
 * - Status dos carriers configurados (iFood, Bee Delivery)
 * - Últimas cotações
 * - Entregas ativas
 *
 * UI mínima — o foco agora é lógica, não visual.
 * UI refinada é tarefa futura.
 */
import type { ModuleDefinition } from '../../../ui/core/module-registry';
import type { EventBus } from '../../../ui/core/event-bus';
import { deliveryService } from '../../../infrastructure/delivery/delivery-service';

export const DeliveryDashboardModule: ModuleDefinition = {
  id: 'delivery.dashboard',
  name: 'Dashboard',
  parent: 'delivery',
  icon: '📊',
  dependencies: [],
  panelFactory: (container: HTMLElement, eventBus: EventBus) => {
    return {
      render: () => {
        container.innerHTML = `
          <div style="padding: 16px; font-family: system-ui, sans-serif;">
            <h2 style="font-size: 16px; margin: 0 0 12px;">🚚 Delivery</h2>

            <div style="margin-bottom: 16px;">
              <h3 style="font-size: 13px; margin: 0 0 8px; color: #666;">Carriers</h3>
              ${deliveryService
                .listarAdapters()
                .map(
                  (a) => `
                <div style="
                  display: flex; align-items: center; gap: 8px;
                  padding: 8px 12px; margin-bottom: 4px;
                  background: ${a.habilitado ? '#e8f5e9' : '#f5f5f5'};
                  border: 1px solid ${a.habilitado ? '#c8e6c9' : '#e0e0e0'};
                  border-radius: 6px;
                ">
                  <span style="font-size: 14px;">${a.habilitado ? '✅' : '⏳'}</span>
                  <span style="flex: 1; font-size: 13px;">${a.nome}</span>
                  <span style="font-size: 11px; color: ${a.habilitado ? '#2e7d32' : '#999'};">
                    ${a.habilitado ? 'Ativo' : 'Configurar'}
                  </span>
                </div>
              `
                )
                .join('')}
            </div>

            <div style="margin-bottom: 16px;">
              <h3 style="font-size: 13px; margin: 0 0 8px; color: #666;">Cotação Rápida</h3>
              <p style="font-size: 12px; color: #999; margin: 0;">
                Selecione um chat com endereço para cotar frete.
              </p>
            </div>

            <div style="border-top: 1px solid #eee; padding-top: 12px;">
              <h3 style="font-size: 13px; margin: 0 0 8px; color: #666;">Próximos passos</h3>
              <ul style="font-size: 12px; color: #666; margin: 0; padding-left: 16px;">
                <li>Solicitar API key da Bee Delivery</li>
                <li>Configurar credenciais no Settings</li>
                <li>Integrar com módulo Pedidos</li>
              </ul>
            </div>
          </div>
        `;
      },
      destroy: () => {
        container.innerHTML = '';
      },
    };
  },
  lazy: false,
};
