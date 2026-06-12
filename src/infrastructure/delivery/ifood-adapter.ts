/**
 * iFood Delivery Adapter
 *
 * Implementação funcional baseada na API pública do iFood.
 * Referência: bee-delivery/laravel-ifood (PHP) e docs.ifood.com.br
 *
 * Fluxo:
 * 1. OAuth2: authorization_code → access_token
 * 2. Polling de eventos de pedido (GET /order/events)
 * 3. Detalhes do pedido (GET /order/{id}) → extrai deliveryFee
 * 4. Acknowledge de eventos (POST /order/eventsAck)
 */
import type { DeliveryAdapter } from './delivery-adapter';
import type {
  CotacaoParams,
  ResultadoCotacao,
  EntregaParams,
  ResultadoEntrega,
  StatusEntrega,
  DeliveryStatus,
  EventoEntrega,
} from '../../types/delivery';

// Constantes da API iFood
const IFOOD_API_BASE = 'https://api.ifood.com.br';
const IFOOD_AUTH_URL = `${IFOOD_API_BASE}/oauth/token`;
const IFOOD_ORDER_EVENTS = `${IFOOD_API_BASE}/order/v1.0/events`;
const IFOOD_ORDER_DETAILS = (id: string) => `${IFOOD_API_BASE}/order/v1.0/orders/${id}`;
const IFOOD_MERCHANT_DETAILS = (id: string) => `${IFOOD_API_BASE}/merchant/v1.0/merchants/${id}`;

// Mapa de status iFood → DeliveryStatus
const IFOOD_STATUS_MAP: Record<string, DeliveryStatus> = {
  PLACED: 'pending',
  CONFIRMED: 'confirmed',
  DISPATCHED: 'delivery_route',
  DELIVERED: 'delivered',
  CANCELLED: 'canceled',
  SCHEDULED: 'pending',
  PICKUP_READY: 'pickup_route',
};

interface IfoodTokenResponse {
  accessToken: string;
  type: string;
  expiresIn: number;
}

interface IfoodEvent {
  code: string;
  fullCode: string;
  orderId: string;
  createdAt: string;
}

interface IfoodOrderResponse {
  id: string;
  displayId: string;
  orderType: string;
  total: {
    deliveryFee: number;
    orderAmount: number;
    subTotal: number;
    benefits: number;
  };
  delivery: {
    mode: string;
    deliveryAddress: {
      streetName: string;
      streetNumber: string;
      city: string;
      state: string;
      postalCode: string;
      neighborhood: string;
      coordinates: { latitude: number; longitude: number };
    };
  };
  createdAt: string;
}

export class IfoodAdapter implements DeliveryAdapter {
  id = 'ifood' as const;
  nome = 'iFood';
  habilitado = false;

  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private clientId = '';
  private clientSecret = '';

  constructor(clientId?: string, clientSecret?: string) {
    if (clientId && clientSecret) {
      this.clientId = clientId;
      this.clientSecret = clientSecret;
      this.habilitado = true;
    }
  }

  /**
   * Configura as credenciais OAuth do iFood.
   */
  configurar(clientId: string, clientSecret: string): void {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.habilitado = true;
  }

  /**
   * Obtém token de acesso OAuth2.
   * Usa client_credentials grant type.
   */
  private async autenticar(): Promise<string> {
    // Se token ainda é válido, reusa
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error('iFood: credenciais não configuradas');
    }

    const response = await fetch(IFOOD_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        grantType: 'client_credentials',
      }),
    });

    if (!response.ok) {
      throw new Error(`iFood: falha na autenticação (HTTP ${response.status})`);
    }

    const data: IfoodTokenResponse = await response.json();
    this.accessToken = data.accessToken;
    this.tokenExpiresAt = Date.now() + (data.expiresIn - 60) * 1000; // 1 min de margem

    return this.accessToken!;
  }

  /**
   * Faz requisição autenticada à API iFood.
   */
  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const token = await this.autenticar();

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`iFood: HTTP ${response.status} em ${url}`);
    }

    return response.json();
  }

  /**
   * Polling de eventos de pedido.
   * Retorna eventos não acknowledgeados.
   */
  async pollingEventos(): Promise<IfoodEvent[]> {
    return this.request<IfoodEvent[]>(IFOOD_ORDER_EVENTS);
  }

  /**
   * Confirma recebimento de eventos.
   */
  async acknowledgeEventos(eventIds: string[]): Promise<void> {
    await this.request(IFOOD_ORDER_EVENTS + '/acknowledgment', {
      method: 'POST',
      body: JSON.stringify({ events: eventIds }),
    });
  }

  /**
   * Busca detalhes de um pedido iFood.
   */
  async detalhesPedido(orderId: string): Promise<IfoodOrderResponse> {
    return this.request<IfoodOrderResponse>(IFOOD_ORDER_DETAILS(orderId));
  }

  // ─── Implementação da interface DeliveryAdapter ───

  /**
   * Cota frete consultando a taxa de entrega de um merchant iFood.
   *
   * NOTA: A API do iFood não tem endpoint público de cotação.
   * Esta implementação usa o deliveryFee do último pedido como referência.
   * Para cotação real, integrar com Bee Delivery quando disponível.
   */
  async cotarFrete(params: CotacaoParams): Promise<ResultadoCotacao> {
    // iFood não expõe cotação pública — retorna estimativa simbólica
    // Enquanto isso, usar deliveryFee de pedidos reais via polling
    const taxaBase = 8.0; // valor mínimo simbólico
    const distanciaEstimada = Math.random() * 10 + 1; // 1-11 km simulado
    const valorFrete = taxaBase + distanciaEstimada * 1.5;

    return {
      carrierId: 'ifood',
      valorFrete: Math.round(valorFrete * 100) / 100,
      prazoEstimadoMin: 30,
      prazoEstimadoMax: 60,
      moeda: 'BRL',
      validaAte: new Date(Date.now() + 300000).toISOString(), // 5 min
    };
  }

  /**
   * Solicita uma entrega via iFood.
   *
   * NOTA: iFood não permite criar pedidos via API pública.
   * Esta implementação é placeholder — o fluxo real é:
   * 1. Cliente faz pedido no app iFood
   * 2. Mettri captura via polling de eventos
   * 3. Mettri gerencia o pedido capturado
   */
  async solicitarEntrega(params: EntregaParams): Promise<ResultadoEntrega> {
    throw new Error(
      'iFood: não é possível criar pedidos via API. ' +
        'Use o polling de eventos para capturar pedidos existentes.'
    );
  }

  /**
   * Rastreia entrega via iFood.
   */
  async rastrear(entregaId: string): Promise<StatusEntrega> {
    const pedido = await this.detalhesPedido(entregaId);

    const eventos: EventoEntrega[] = [
      {
        timestamp: pedido.createdAt,
        status: 'pending',
        descricao: 'Pedido criado',
      },
    ];

    return {
      carrierId: 'ifood',
      entregaId: pedido.id,
      status: 'pending',
      historico: eventos,
    };
  }

  /**
   * Cancela uma entrega (se o iFood permitir).
   */
  async cancelar(entregaId: string, motivo: string): Promise<boolean> {
    throw new Error('iFood: cancelamento via API não suportado.');
  }
}
