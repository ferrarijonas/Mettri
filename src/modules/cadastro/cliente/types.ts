import type { ClientRecord } from '../../../storage/client-db';
import type { CustomerOperationalProfile } from '../../../storage/customer-profile-db';
export type CadastroClienteErrorCode = 'INVALID_INPUT' | 'STORE_ERROR';

export type CadastroClienteResult<T> =
  | { ok: true; data: T }
  | { ok: false; errorCode: CadastroClienteErrorCode; message: string };

export type OperationalWindow = 'manha' | 'tarde' | 'noite';
export type OfferSensitivity = 'baixa' | 'media' | 'alta';

export type CampoConfianca = 'desconhecido' | 'baixa' | 'media' | 'alta';

export interface CamposConfianca {
  preferenciasProduto?: CampoConfianca;
  aversoesProduto?: CampoConfianca;
  enderecoEntrega?: CampoConfianca;
  formaPagamentoPreferida?: CampoConfianca;
  urgenciaEntrega?: CampoConfianca;
  observacoesLogisticas?: CampoConfianca;
}

export interface OuvinteCampos {
  aversoesProduto?: string[];
  enderecoEntrega?: string;
  formaPagamentoPreferida?: string[];
  urgenciaEntrega?: string;
  observacoesLogisticas?: string[];
  camposConfianca?: CamposConfianca;
}

export interface CustomerOperationalSignals {
  frequenciaContato7d?: number;
  diasDesdeUltimaCompra?: number | null;
  compras90d?: number;
  janelaAtiva?: OperationalWindow;
  preferenciasProduto?: string[];
  preferenciasLogistica?: string[];
  sensibilidadeOferta?: OfferSensitivity;
  segmentos?: string[];
  nomeConfiavel?: string;
  cadastroUtil?: boolean;
  proximidadeScore?: number;
  proximidadeBand?: 'frio' | 'morno' | 'quente';
  lastRecomputeReason?: 'turn_end' | 'purchase_event' | 'scheduled';
  lastRecomputeAtIso?: string;
  aversoesProduto?: string[];
  formaPagamentoPreferida?: string[];
  observacoesLogisticas?: string[];
  enderecoEntrega?: string;
}

export interface PurchaseSummary {
  purchaseId: string;
  purchaseDateIso: string;
  value: number | null;
  items: string[] | null;
  notes: string | null;
  source: 'MANUAL' | 'AI_DETECTED';
}

export interface FichaClienteAtendimento {
  chatId: string;
  isGroup?: boolean;
  phoneDigits?: string | null;
  cadastro: ClientRecord | null;
  ultimaCompra: PurchaseSummary | null;
  perfilOperacional: CustomerOperationalProfile | null;
  flags: {
    cadastroUtil: boolean;
  };
}
