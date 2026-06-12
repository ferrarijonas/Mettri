/**
 * Interface genérica para adapters de delivery.
 *
 * Cada parceiro (iFood, Bee Delivery) implementa esta interface.
 * O DeliveryService orquestra os adapters registrados.
 */
import type {
  CotacaoParams,
  ResultadoCotacao,
  EntregaParams,
  ResultadoEntrega,
  StatusEntrega,
} from '../../types/delivery';

export interface DeliveryAdapter {
  /** ID único do carrier (ex: 'ifood', 'bee-delivery') */
  id: string;

  /** Nome exibível */
  nome: string;

  /** Se está habilitado (requer credenciais configuradas) */
  habilitado: boolean;

  /** Cota frete com base em origem/destino/itens */
  cotarFrete(params: CotacaoParams): Promise<ResultadoCotacao>;

  /** Solicita uma entrega */
  solicitarEntrega(params: EntregaParams): Promise<ResultadoEntrega>;

  /** Rastreia uma entrega pelo ID */
  rastrear(entregaId: string): Promise<StatusEntrega>;

  /** Cancela uma entrega */
  cancelar(entregaId: string, motivo: string): Promise<boolean>;
}
