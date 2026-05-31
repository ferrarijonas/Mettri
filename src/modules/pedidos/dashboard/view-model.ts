/**
 * Tipos do ViewModel do módulo Pedidos.
 */

export type IntencaoTipo = 'compra_nova' | 'suporte_pos_venda' | 'orcamento' | 'outro';

export type OrderStatusUnificado =
  | 'lead'
  | 'draft'
  | 'open'
  | 'awaiting_payment'
  | 'completed'
  | 'cancelled'
  | 'lost';

export type FiltroStatus = 'todos' | 'lead' | 'draft' | 'open' | 'awaiting_payment' | 'completed' | 'cancelled' | 'lost';

export interface PedidoCardVm {
  orderId: string;
  numeroSequencial: number;
  clientKey: string;
  clienteNome: string;
  chatId: string;
  status: OrderStatusUnificado;
  intencao: IntencaoTipo;
  itensResumo: string;
  totalCentavos: number;
  createdAtIso: string;
  updatedAtIso: string;
  itens: { skuId: string; nome: string; quantidade: number; precoUnitarioCentavos: number; precoTotalCentavos: number }[];
  funil: {
    produto: { estado: 'ok' | 'pendente'; valor: string | null };
    endereco: { estado: 'ok' | 'pendente'; valor: string | null };
    pagamento: { estado: 'ok' | 'pendente'; valor: string | null };
    prazo: { estado: 'ok' | 'pendente'; valor: string | null };
    fechar: { estado: 'ok' | 'pendente'; valor: string | null };
  };
  timeline: { statusAnterior: OrderStatusUnificado | null; statusNovo: OrderStatusUnificado; iso: string; motivo?: string }[];
  observacoes?: string;
  pagamentoStatus?: 'pendente' | 'pago' | 'recusado';
  pagamentoMetodo?: string;
}

export interface PedidosMetricasVm {
  totalAbertos: number;
  aguardandoPagamento: number;
  totalHojeCentavos: number;
  ticketMedioCentavos: number;
}

export type PedidosViewModel =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
      filtroStatus: FiltroStatus;
      metricas: PedidosMetricasVm;
      pedidos: PedidoCardVm[];
      busca: string;
    };
