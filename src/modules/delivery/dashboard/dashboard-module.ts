/**
 * Dashboard Delivery — visão geral das entregas
 *
 * Exibe:
 * - Saldo Bee Delivery (pro dono ver)
 * - Status dos carriers
 * - Últimas entregas
 */
import type { ModuleDefinition } from '../../../ui/core/module-registry';
import type { EventBus } from '../../../ui/core/event-bus';
import type { PanelInstance } from '../../../ui/core/module-registry';
import { deliveryService } from '../../../infrastructure/delivery/delivery-service';
import { BeeDeliveryAdapter } from '../../../infrastructure/delivery/bee-delivery-adapter';

function esc(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

export const DeliveryDashboardModule: ModuleDefinition = {
  id: 'delivery.dashboard',
  name: 'Dashboard',
  parent: 'delivery',
  icon: '📊',
  dependencies: [],
  panelFactory: (container: HTMLElement, eventBus: EventBus) => {
    let destroyed = false;

    const instance: PanelInstance = {
      render: async () => {
        container.innerHTML = `
          <div style="padding: 16px; font-family: system-ui, sans-serif;">
            <h2 style="font-size: 16px; margin: 0 0 12px;">🚚 Delivery</h2>
            <div id="bee-saldo" style="margin-bottom: 16px;">
              <h3 style="font-size: 13px; margin: 0 0 8px; color: #666;">Bee Delivery</h3>
              <div style="
                display: flex; align-items: center; gap: 12px;
                padding: 12px 16px;
                background: #f5f5f5;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
              ">
                <span style="font-size: 18px;">🐝</span>
                <div style="flex: 1;">
                  <div style="font-size: 13px; font-weight: 500;">Carregando saldo...</div>
                  <div style="font-size: 11px; color: #999;">Consulte o saldo atual</div>
                </div>
              </div>
            </div>
            <div style="margin-bottom: 16px;">
              <h3 style="font-size: 13px; margin: 0 0 8px; color: #666;">Transportadoras</h3>
              ${deliveryService
                .listarAdapters()
                .map(
                  (a) => `
                <div style="
                  display: flex; align-items: center; gap: 8px;
                  padding: 8px 12px; margin-bottom: 4px;
                  background: ${a.habilitado ? '#e8f5e9' : '#fff8e1'};
                  border: 1px solid ${a.habilitado ? '#c8e6c9' : '#ffe082'};
                  border-radius: 6px;
                ">
                  <span style="font-size: 14px;">${a.habilitado ? '✅' : '⏳'}</span>
                  <span style="flex: 1; font-size: 13px;">${esc(a.nome)}</span>
                  <span style="font-size: 11px; color: ${a.habilitado ? '#2e7d32' : '#f57f17'};">
                    ${a.habilitado ? 'Conectado' : 'Aguardando login'}
                  </span>
                </div>
              `
                )
                .join('')}
            </div>
            <div style="border-top: 1px solid #eee; padding-top: 12px;">
              <h3 style="font-size: 13px; margin: 0 0 8px; color: #666;">Links rápidos</h3>
              <ul style="font-size: 12px; color: #666; margin: 0; padding-left: 16px;">
                <li><a href="https://www.beedelivery.com.br/central/financeiro" target="_blank" style="color: #1976d2;">Recarregar saldo →</a></li>
                <li><a href="https://www.beedelivery.com.br/central/entregas" target="_blank" style="color: #1976d2;">Histórico de entregas →</a></li>
              </ul>
            </div>
          </div>
        `;

        // Buscar saldo em segundo plano
        if (!destroyed) {
          try {
            const bee = deliveryService.getAdapter('bee-delivery');
            if (bee && bee instanceof BeeDeliveryAdapter) {
              const saldo = await bee.consultarSaldo();
              if (!destroyed) {
                const el = container.querySelector('#bee-saldo');
                if (el) {
                  const cor = saldo < 10 ? '#d32f2f' : saldo < 30 ? '#f57f17' : '#2e7d32';
                  el.innerHTML = `
                    <h3 style="font-size: 13px; margin: 0 0 8px; color: #666;">Bee Delivery</h3>
                    <div style="
                      display: flex; align-items: center; gap: 12px;
                      padding: 12px 16px;
                      background: ${saldo < 10 ? '#ffebee' : '#e8f5e9'};
                      border: 1px solid ${saldo < 10 ? '#ffcdd2' : '#c8e6c9'};
                      border-radius: 8px;
                    ">
                      <span style="font-size: 24px;">🐝</span>
                      <div style="flex: 1;">
                        <div style="font-size: 18px; font-weight: 700; color: ${cor};">
                          R$ ${saldo.toFixed(2)}
                        </div>
                        <div style="font-size: 11px; color: ${saldo < 10 ? '#c62828' : '#558b2f'};">
                          ${saldo < 5 ? '🔴 Crítico — recarregue agora!' : saldo < 10 ? '🟡 Saldo baixo' : '✅ Saldo OK'}
                        </div>
                      </div>
                      <a href="https://www.beedelivery.com.br/central/financeiro" target="_blank" style="
                        font-size: 11px; color: #1976d2; text-decoration: none;
                        padding: 4px 10px; border: 1px solid #1976d2; border-radius: 4px;
                      ">Recarregar</a>
                    </div>
                  `;
                }
              }
            }
          } catch {
            // Saldo indisponível (não logado) — manter estado padrão
            if (!destroyed) {
              const el = container.querySelector('#bee-saldo');
              if (el) {
                el.innerHTML = `
                  <h3 style="font-size: 13px; margin: 0 0 8px; color: #666;">Bee Delivery</h3>
                  <div style="
                    display: flex; align-items: center; gap: 12px;
                    padding: 12px 16px;
                    background: #fff8e1;
                    border: 1px solid #ffe082;
                    border-radius: 8px;
                  ">
                    <span style="font-size: 18px;">🐝</span>
                    <div style="flex: 1;">
                      <div style="font-size: 13px; font-weight: 500;">Não conectado</div>
                      <div style="font-size: 11px; color: #999;">
                        Faça login em www.beedelivery.com.br no navegador
                      </div>
                    </div>
                  </div>
                `;
              }
            }
          }
        }
      },
      destroy: () => {
        destroyed = true;
        container.innerHTML = '';
      },
    };

    return instance;
  },
  lazy: false,
};
