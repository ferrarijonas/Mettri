import type { ModuleDefinition } from '../../../ui/core/module-registry';
import type { EventBus } from '../../../ui/core/event-bus';
import type { PanelFactory, PanelInstance } from '../../../ui/core/module-registry';
import { PedidosPanel } from './pedidos-panel';
import { getPedidosViewModel } from './provider';
import type { FiltroStatus } from './view-model';
import { emitPanelNavigate } from '../../../ui/core/panel-navigation';
import { orderDB } from '../../../storage/order-db';
import { deliveryService } from '../../../infrastructure/delivery/delivery-service';

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
        if (actionId === 'delivery:quote') {
          const orderId = String((payload as { orderId: string }).orderId || '');
          const endereco = String((payload as { endereco: string }).endereco || '');
          if (!orderId || !endereco) return;

          const infoEl = container.querySelector(`[data-order-id="${orderId}"]`)?.closest('.pedidos-card')?.querySelector('.bee-delivery-info');
          const orderBtn = container.querySelector(`[data-order-id="${orderId}"]`)?.closest('.pedidos-card')?.querySelector('.bee-order-btn');

          if (infoEl) infoEl.textContent = '🔄 Calculando frete...';

          try {
            // Extrair parts do endereço
            const parts = endereco.split(',').map(s => s.trim());
            const logradouro = parts[0] || '';
            const numero = parts[1]?.split('—')[0]?.trim() || parts[1] || '';
            let bairro = '';
            let cidade = 'Uberlândia';
            let estado = 'MG';

            for (const p of parts) {
              const lower = p.toLowerCase();
              if (lower.includes('uberlândia') || lower.includes('uberlandia')) {
                cidade = 'Uberlândia';
                const estadoMatch = p.match(/[A-Z]{2}/);
                if (estadoMatch) estado = estadoMatch[0];
              } else if (lower.includes('mg') || lower.includes('minas')) {
                estado = 'MG';
              } else if (p.includes('-')) {
                // Provável bairro
                bairro = p;
              }
            }

            const cotacao = await deliveryService.cotarFrete('bee-delivery', {
              origem: { cep: '', logradouro: 'Rua Exemplo', numero: '123', bairro: 'Santa Mônica', cidade: 'Uberlândia', estado: 'MG' },
              destino: { cep: '', logradouro, numero, bairro, cidade, estado },
              items: [],
            });

            if (infoEl) {
              infoEl.textContent = `🐝 Frete: R$ ${cotacao.valorFrete.toFixed(2)} (entrega em ~${cotacao.prazoEstimadoMin}-${cotacao.prazoEstimadoMax} min)`;
              infoEl.className = 'bee-delivery-info text-[10px] text-green-400/80 mt-1';
            }
            if (orderBtn) {
              orderBtn.classList.remove('hidden');
              orderBtn.setAttribute('data-frete', String(cotacao.valorFrete));
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao calcular frete';
            if (infoEl) {
              infoEl.textContent = `❌ ${message}`;
              infoEl.className = 'bee-delivery-info text-[10px] text-red-400/60 mt-1';
            }
            console.error('[Pedidos] Erro delivery quote:', err);
          }
          return;
        }
        if (actionId === 'delivery:order') {
          const orderId = String((payload as { orderId: string }).orderId || '');
          const endereco = String((payload as { endereco: string }).endereco || '');
          const freteStr = String((payload as { frete: string }).frete || '0');
          if (!orderId || !endereco) return;

          const infoEl = container.querySelector(`[data-order-id="${orderId}"]`)?.closest('.pedidos-card')?.querySelector('.bee-delivery-info');
          if (infoEl) infoEl.textContent = '🔄 Solicitando entrega...';

          try {
            // Extrair endereço igual no quote
            const parts = endereco.split(',').map(s => s.trim());
            const logradouro = parts[0] || '';
            const numero = parts[1]?.split('—')[0]?.trim() || parts[1] || '';

            // Buscar dados do pedido
            await orderDB.ensureReady();
            const order = await orderDB.getByOrderId(orderId);

            const resultado = await deliveryService.solicitarEntrega('bee-delivery', {
              origem: { cep: '', logradouro: 'Rua Exemplo', numero: '123', bairro: 'Santa Mônica', cidade: 'Uberlândia', estado: 'MG' },
              destino: { cep: '', logradouro, numero, bairro: '', cidade: 'Uberlândia', estado: 'MG' },
              items: (order?.itens || []).map((i: any) => ({ nome: i.nome || '', quantidade: i.quantidade || 1 })),
              valorTotal: order?.totalCents || 0,
              contatoDestinatario: {
                nome: order?.clientKey || 'Cliente',
                telefone: '', // Será preenchido depois
              },
            });

            // Registrar entrega no histórico do pedido
            if (orderDB.advanceStatus) {
              await orderDB.advanceStatus(orderId, 'awaiting_payment', `🐝 Entrega solicitada Bee Delivery (ID: ${resultado.entregaId}, Frete: R$ ${resultado.valorFrete.toFixed(2)})`).catch(() => {});
            }

            if (infoEl) {
              infoEl.textContent = `✅ Entrega solicitada! ID: ${resultado.entregaId}`;
              infoEl.className = 'bee-delivery-info text-[10px] text-green-400/80 mt-1';
            }

            // Esconder botões após solicitar
            const quoteBtn = container.querySelector(`[data-order-id="${orderId}"]`)?.closest('.pedidos-card')?.querySelector('[data-action="delivery:quote"]');
            const orderBtn = container.querySelector(`[data-order-id="${orderId}"]`)?.closest('.pedidos-card')?.querySelector('[data-action="delivery:order"]');
            if (quoteBtn) (quoteBtn as HTMLElement).style.display = 'none';
            if (orderBtn) (orderBtn as HTMLElement).style.display = 'none';
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao solicitar entrega';
            if (infoEl) {
              infoEl.textContent = `❌ ${message}`;
              infoEl.className = 'bee-delivery-info text-[10px] text-red-400/60 mt-1';
            }
            console.error('[Pedidos] Erro delivery order:', err);
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
