/**
 * Dashboard Delivery — visão geral das entregas
 *
 * Exibe:
 * - Saldo Bee Delivery (pro dono ver)
 * - Taxa dinâmica atual + histórico em gráfico
 * - Status dos carriers
 */
import type { ModuleDefinition } from '../../../ui/core/module-registry';
import type { EventBus } from '../../../ui/core/event-bus';
import type { PanelInstance } from '../../../ui/core/module-registry';
import { deliveryService } from '../../../infrastructure/delivery/delivery-service';
import { BeeDeliveryAdapter } from '../../../infrastructure/delivery/bee-delivery-adapter';

const STORAGE_KEY = 'mettri_bee_dinamica_history';

function esc(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function formatHora(iso: string): string {
  try {
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, '0') + 'h' + String(d.getMinutes()).padStart(2, '0');
  } catch {
    return iso;
  }
}

function barraCor(valor: number): string {
  if (valor >= 2.5) return '#d32f2f';
  if (valor >= 1.5) return '#f57f17';
  return '#2e7d32';
}

function barraLabel(valor: number): string {
  if (valor >= 2.5) return '🔴 Alta';
  if (valor >= 1.5) return '🟡 Média';
  return '🟢 Baixa';
}

function carregarHistorico(): Array<{ valor: number; timestamp: string }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function salvarHistorico(historico: Array<{ valor: number; timestamp: string }>): void {
  try {
    const recente = historico.slice(-48);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recente));
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export const DeliveryDashboardModule: ModuleDefinition = {
  id: 'delivery.dashboard',
  name: 'Dashboard',
  parent: 'delivery',
  icon: '📊',
  dependencies: [],
  panelFactory: (container: HTMLElement, eventBus: EventBus) => {
    let destroyed = false;

    function atualizarSaldo(saldo: number): void {
      const el = container.querySelector('#bee-saldo');
      if (!el) return;
      const cor = saldo < 10 ? '#d32f2f' : saldo < 30 ? '#f57f17' : '#2e7d32';
      el.innerHTML = `
        <h3 style="font-size: 13px; margin: 0 0 8px; color: #666;">🐝 Bee Delivery</h3>
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

    function renderizarHistorico(): void {
      const chartEl = container.querySelector('#bee-dinamica-chart');
      if (!chartEl) return;

      const historico = carregarHistorico();
      const rodapeEl = container.querySelector('.dinamica-rodape');

      if (historico.length === 0) {
        chartEl.innerHTML = '<span style="font-size: 11px; color: #999;">Ainda sem dados — aparece automaticamente quando você usar o delivery.</span>';
        if (rodapeEl) rodapeEl.innerHTML = '';
        return;
      }

      const ultimo = historico[historico.length - 1];
      const maxValor = Math.max(...historico.map(h => h.valor), 0.01);
      const altMax = 50;

      const barras = historico.slice(-24).map(h => {
        const alt = Math.max(4, (h.valor / maxValor) * altMax);
        const cor = barraCor(h.valor);
        const hora = formatHora(h.timestamp);
        return `<div title="${hora} — R$ ${h.valor.toFixed(2)}" style="
          width: 14px; height: ${alt}px;
          background: ${cor};
          border-radius: 2px 2px 0 0;
          flex-shrink: 0; cursor: pointer;
          opacity: 0.85; transition: opacity .2s;
        " onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.85"></div>`;
      }).join('');

      chartEl.innerHTML = barras;

      if (rodapeEl) {
        rodapeEl.innerHTML = `
          <span style="font-size: 12px; font-weight: 600; color: ${barraCor(ultimo.valor)};">
            Agora: R$ ${ultimo.valor.toFixed(2)} ${barraLabel(ultimo.valor)}
          </span>
          <span style="font-size: 10px; color: #999;"> · ${historico.length} medições</span>
          <span style="font-size: 10px; color: #999; margin-left: auto;">
            Mín: R$ ${Math.min(...historico.map(h => h.valor)).toFixed(2)}
            · Máx: R$ ${Math.max(...historico.map(h => h.valor)).toFixed(2)}
          </span>
        `;
      }
    }

    const instance: PanelInstance = {
      render: async () => {
        container.innerHTML = `
          <div style="padding: 16px; font-family: system-ui, sans-serif;">
            <h2 style="font-size: 16px; margin: 0 0 12px;">🚚 Delivery</h2>

            <div id="bee-saldo" style="margin-bottom: 16px;">
              <h3 style="font-size: 13px; margin: 0 0 8px; color: #666;">🐝 Bee Delivery</h3>
              <div style="
                display: flex; align-items: center; gap: 12px;
                padding: 12px 16px;
                background: #f5f5f5;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
              ">
                <span style="font-size: 18px;">🐝</span>
                <div style="flex: 1;">
                  <div style="font-size: 13px; font-weight: 500;">Carregando...</div>
                  <div style="font-size: 11px; color: #999;">Saldo e taxa dinâmica</div>
                </div>
              </div>
            </div>

            <div id="bee-dinamica" style="margin-bottom: 16px;">
              <h3 style="font-size: 13px; margin: 0 0 8px; color: #666;">📈 Taxa Dinâmica</h3>
              <div style="
                padding: 12px 16px;
                background: #fafafa;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
              ">
                <div id="bee-dinamica-chart" style="display: flex; align-items: flex-end; gap: 3px; height: 55px; margin-bottom: 6px;">
                  <span style="font-size: 11px; color: #999;">Carregando histórico...</span>
                </div>
                <div class="dinamica-rodape" style="display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 0;"></div>
              </div>
            </div>

            <div style="margin-bottom: 16px;">
              <h3 style="font-size: 13px; margin: 0 0 8px; color: #666;">Transportadoras</h3>
              ${deliveryService.listarAdapters().map(a => `
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
                </div>`).join('')}
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

        // Renderizar histórico antes de buscar novo
        renderizarHistorico();

        // Buscar dados ao vivo
        if (!destroyed) {
          try {
            const bee = deliveryService.getAdapter('bee-delivery');
            if (bee && bee instanceof BeeDeliveryAdapter) {
              const saldo = await bee.consultarSaldo();
              if (!destroyed) atualizarSaldo(saldo);

              const taxa = await bee.consultarTaxaDinamica();
              if (!destroyed) {
                const hist = carregarHistorico();
                hist.push({ valor: taxa.valorEmpresa, timestamp: taxa.timestamp });
                salvarHistorico(hist);
                renderizarHistorico();
              }
            }
          } catch {
            if (!destroyed) {
              const el = container.querySelector('#bee-saldo');
              if (el) {
                el.innerHTML = `
                  <h3 style="font-size: 13px; margin: 0 0 8px; color: #666;">🐝 Bee Delivery</h3>
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
