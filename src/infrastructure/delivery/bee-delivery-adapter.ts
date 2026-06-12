/**
 * Bee Delivery Adapter
 *
 * Skeleton preparado para quando as credenciais da API Bee Delivery estiverem disponíveis.
 *
 * API base: https://integrationtest.beedelivery.com.br/api/v1/public/
 * Documentação: https://beedeliveryapi.docs.apiary.io/ (requer login)
 *
 * TODO T-050: Substituir throws por implementação real quando houver credenciais.
 */
import type { DeliveryAdapter } from './delivery-adapter';
import type {
  CotacaoParams,
  ResultadoCotacao,
  EntregaParams,
  ResultadoEntrega,
  StatusEntrega,
} from '../../types/delivery';

// TODO: obter do settings quando configurado
const BEE_DELIVERY_API_BASE = 'https://integrationtest.beedelivery.com.br/api/v1/public/';

export class BeeDeliveryAdapter implements DeliveryAdapter {
  id = 'bee-delivery' as const;
  nome = 'Bee Delivery';
  habilitado = false;

  private apiKey = '';

  /**
   * Configura a chave de API da Bee Delivery.
   * Chamado quando o usuário configura as credenciais no settings.
   */
  configurar(apiKey: string, endpoint?: string): void {
    this.apiKey = apiKey;
    this.habilitado = true;
  }

  /**
   * Cota frete com a Bee Delivery.
   *
   * Endpoint esperado: POST /api/v1/public/quote
   * Body: { origem, destino, items }
   * Response: { valorFrete, prazoEstimado, moeda, validaAte }
   */
  async cotarFrete(params: CotacaoParams): Promise<ResultadoCotacao> {
    if (!this.habilitado) {
      throw new Error(
        'Bee Delivery: credenciais não configuradas. ' +
          'Configure a API key no painel de Configurações > Delivery.'
      );
    }
    // TODO T-050: implementar chamada real
    throw new Error('Bee Delivery: adapter pendente de implementação (T-050).');
  }

  /**
   * Solicita uma entrega.
   *
   * Endpoint esperado: POST /api/v1/public/order
   * Body: { origem, destino, items, valorTotal }
   * Response: { entregaId, status, valorFrete, prazoEstimado }
   */
  async solicitarEntrega(params: EntregaParams): Promise<ResultadoEntrega> {
    if (!this.habilitado) {
      throw new Error('Bee Delivery: credenciais não configuradas.');
    }
    throw new Error('Bee Delivery: adapter pendente de implementação (T-050).');
  }

  /**
   * Rastreia uma entrega.
   *
   * Endpoint esperado: GET /api/v1/public/order/{id}
   * Response: { status, historico[], previsaoEntrega }
   */
  async rastrear(entregaId: string): Promise<StatusEntrega> {
    if (!this.habilitado) {
      throw new Error('Bee Delivery: credenciais não configuradas.');
    }
    throw new Error('Bee Delivery: adapter pendente de implementação (T-050).');
  }

  /**
   * Cancela uma entrega.
   *
   * Endpoint esperado: DELETE /api/v1/public/order/{id}
   */
  async cancelar(entregaId: string, motivo: string): Promise<boolean> {
    if (!this.habilitado) {
      throw new Error('Bee Delivery: credenciais não configuradas.');
    }
    throw new Error('Bee Delivery: adapter pendente de implementação (T-050).');
  }
}
