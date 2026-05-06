import type { ModuleDefinition } from '../../../ui/core/module-registry';
import type { EventBus } from '../../../ui/core/event-bus';
import type { PanelFactory, PanelInstance } from '../../../ui/core/module-registry';
import { PedidosPanel } from './pedidos-panel';
import { getPedidosViewModel } from './provider';
import type { FiltroStatus } from './view-model';
import { emitPanelNavigate } from '../../../ui/core/panel-navigation';
import { orderDB } from '../../../storage/order-db';

const createPedidosDashboardPanel: PanelFactory = async (
  container: HTMLElement,
  eventBus: EventBus,
): Promise<PanelInstance> => {
  let panel: PedidosPanel | null = null;
  let filtroAtual: FiltroStatus = 'todos';
  let buscaAtual = '';

  const rerender = async (): Promise<void> => {
    await orderDB.ensureReady();
    const vm = await getPedidosViewModel({
      filtroStatus: filtroAtual,
      busca: buscaAtual,
    });
    if (panel) panel.destroy();
    container.innerHTML = '';
    panel = new PedidosPanel({
      onAction: async (actionId, payload) => {
        if (actionId === 'filtro:change') {
          filtroAtual = (payload as { filtro: FiltroStatus }).filtro;
          await rerender();
          return;
        }
        if (actionId === 'busca:change') {
          buscaAtual = (payload as { busca: string }).busca;
          await rerender();
          return;
        }
        if (actionId === 'pedido:toggle') {
          await rerender();
          return;
        }
        if (actionId === 'pedido:complete') {
          const orderId = String((payload as { orderId: string }).orderId || '');
          if (!orderId) return;
          try {
            await orderDB.advanceStatus(orderId, 'completed', 'Pagamento confirmado');
          } catch (err) {
            console.error('[Pedidos] Erro ao marcar como pago:', err);
            alert('Erro ao confirmar pagamento.');
          }
          await rerender();
          return;
        }
        if (actionId === 'pedido:cancel') {
          const orderId = String((payload as { orderId: string }).orderId || '');
          if (!orderId) return;
          const motivo = prompt('Motivo do cancelamento:') || '';
          if (!motivo.trim()) return;
          try {
            await orderDB.advanceStatus(orderId, 'cancelled', motivo.trim());
          } catch (err) {
            console.error('[Pedidos] Erro ao cancelar:', err);
            alert('Erro ao cancelar pedido.');
          }
          await rerender();
          return;
        }
        if (actionId === 'pedido:open-atendimento') {
          const chatId = String((payload as { chatId: string }).chatId || '');
          if (chatId) {
            emitPanelNavigate(eventBus, 'atendimento.dashboard');
          }
          return;
        }
        if (actionId === 'retry') {
          await rerender();
          return;
        }
      },
    });
    const el = await panel.render(vm);
    container.appendChild(el);
  };

  await rerender();

  return {
    render: async () => {
      await rerender();
    },
    destroy: () => {
      if (panel) panel.destroy();
      panel = null;
    },
  };
};

export const PedidosDashboardModule: ModuleDefinition = {
  id: 'pedidos.dashboard',
  name: 'Pedidos',
  parent: 'pedidos',
  icon: '📦',
  dependencies: [],
  panelFactory: createPedidosDashboardPanel,
  lazy: false,
};
