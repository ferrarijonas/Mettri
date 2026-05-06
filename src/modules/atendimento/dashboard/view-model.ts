/**
 * ViewModel do Atendimento (UI-first).
 *
 * Metáfora: é a "lista de ingredientes" pronta para cozinhar.
 * A UI só lê isso; não sabe de WhatsApp, DB, ou regras de negócio.
 */
import type { ClienteContextoVitrine } from '../../cadastro';

export type IntencaoTipo = 'compra_nova' | 'suporte_pos_venda' | 'orcamento' | 'duvida' | 'outro';

export type OrderStatusUnificado =
  | 'lead' | 'draft' | 'open' | 'awaiting_payment' | 'completed' | 'cancelled' | 'lost';

/** Espelho de `estadoVenda` para o bloco Comercial (funil). Fase 1: mock do provider. */
export type ComercialModoVm = 'pre_venda' | 'pedido_ativo';

export interface ComercialPanelVm {
  modo: ComercialModoVm;
  faltantes: string[];
  pedidoConfirmado: boolean;
  slotsResumo?: string;
  mockLabel?: string;
}

export type CampoConfianca = 'desconhecido' | 'baixa' | 'media' | 'alta';

export interface CamposConfianca {
  preferenciasProduto?: CampoConfianca;
  aversoesProduto?: CampoConfianca;
  enderecoEntrega?: CampoConfianca;
  formaPagamentoPreferida?: CampoConfianca;
  urgenciaEntrega?: CampoConfianca;
  observacoesLogisticas?: CampoConfianca;
}

export interface OuvinteVmFields {
  preferenciasProduto?: string[];
  aversoesProduto?: string[];
  enderecoEntrega?: string;
  formaPagamentoPreferida?: string[];
  urgenciaEntrega?: string;
  observacoesLogisticas?: string[];
  camposConfianca?: CamposConfianca;
}

/** Etapa do funil de vendas (5 etapas) */
export interface FunilEtapa {
  id: 'produto' | 'endereco' | 'pagamento' | 'prazo' | 'fechar';
  label: string;
  estado: 'ok' | 'pendente';
  valor: string | null;
}

/** Item de pedido montado automaticamente */
export interface PedidoItemAuto {
  produtoCatalogo?: { productId: string; nome: string; precoCentavos: number };
  nomeExtraido: string;
  quantidade: number;
  precoTotalCentavos: number;
}

/** Vitrine inline: recomendação com motivo */
export interface VitrineItemUi {
  productId: string;
  nome: string;
  precoCentavos: number;
  score: number;
  motivo: string;
}

export interface ProximaAcao {
  label: string;
  sugestaoTexto: string;
}

/** Resumo de pedido vindo do OrderDB (para `pedidoAtual` e `historicoPedidos`) */
export interface PedidoResumoVm {
  orderId: string;
  numeroSequencial: number;
  status: OrderStatusUnificado;
  intencao: IntencaoTipo;
  itens: { skuId: string; nome: string; quantidade: number; precoUnitarioCentavos: number; precoTotalCentavos: number }[];
  subtotalCentavos: number;
  entregaCentavos: number;
  totalCentavos: number;
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
  createdAtIso: string;
  updatedAtIso: string;
}

export interface MetricaClienteVm {
  ticketMedioCentavos: number;
  frequencia: string;
  totalPedidos: number;
}

export type AtendimentoViewModel =
  | {
      kind: 'noChat';
      title: string;
      hint: string;
    }
  | {
      kind: 'ready';
      demoBadge?: string;
      customer: {
        displayName: string;
        phoneLabel: string;
        chatId: string;
        clientKey?: string;
        phoneDigits?: string;
        badges: string[];
        hasCadastro: boolean;
        tipoCliente: 'novo' | 'contato' | 'ativo' | 'recorrente' | null;
        relacionamentoInicialParaAgente?: boolean;
        /** Campos que foram recém-atualizados pelo Ouvinte. */
        updatedFields?: string[];
        /** Confiança do perfil (0-1) para exibição na UI. */
        confiancaPerfil?: number;
        /** Timeline resumida (do CustomerProfileDB + PurchaseDB). */
        timeline?: string[];
      } & OuvinteVmFields;
      /** Classificação da intenção da conversa (ClassificarIntencao) */
      tipoConversa: IntencaoTipo | null;
      /** Pedido atual do cliente, persistido no OrderDB */
      pedidoAtual: PedidoResumoVm | null;
      /** Últimos N pedidos do cliente (completed, cancelled) */
      historicoPedidos: PedidoResumoVm[];
      /** Métricas agregadas do cliente */
      metricaCliente: MetricaClienteVm;
      /** Funil de vendas: 5 etapas preenchidas pelo Ouvinte */
      funil: {
        etapas: FunilEtapa[];
        progresso: number;
      };
      /** Pedido automático com itens do catálogo */
      pedido: {
        itens: PedidoItemAuto[];
        subtotalCentavos: number;
        entregaCentavos: number | null;
        totalCentavos: number;
        status: 'aberto' | 'fechado';
      };
      /** Vitrine inline */
      vitrine: VitrineItemUi[];
      /** Pendências de confirmação (ex: produto com qtd conflitante) */
      pendentesConfirmacao: {
        campo: string;
        produto?: string;
        atual?: string | string[];
        proposto: string | string[];
        evidencias: string[];
        confianca: number;
      }[];
      /** Próxima ação derivada do funil */
      proximaAcao: ProximaAcao | null;
      /** Sugestão de texto (LLM) */
      sugestaoTexto: string;
      sugestaoLoading: boolean;
      kpis: { label: string; value: string }[];
      actions: { id: string; label: string; disabled?: boolean }[];
      products: { id: string; name: string; priceLabel: string; stockLabel?: string; offerText: string }[];
      offers: { id: string; title: string; subtitle?: string; text: string }[];
      orders: { id: string; title: string; subtitle: string; status: string }[];
      phrases: { id: string; label: string; text: string }[];
      notes: {
        value: string;
        placeholder: string;
      };
      retomar: {
        contador: number;
        etiquetas: {
          id: string;
          name: string;
          isMember: boolean;
          isDefault: boolean;
          color: string;
          memberCount: number;
        }[];
      };
      lastPurchase: {
        purchaseId: string;
        purchaseDate: string;
        value: number | null;
        items: string[] | null;
        notes: string | null;
        source: 'MANUAL' | 'AI_DETECTED';
      } | null;
      clienteContextoVitrine?: ClienteContextoVitrine;
      comercial: ComercialPanelVm;
    };


