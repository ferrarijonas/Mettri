/**
 * Tipos compartilhados do módulo Delivery
 *
 * Define os contratos para integração com serviços de entrega
 * (iFood, Bee Delivery, etc.)
 */

// Status possíveis de uma entrega
export type DeliveryStatus =
  | 'pending'
  | 'quoted'
  | 'confirmed'
  | 'pickup_route'
  | 'picked_up'
  | 'delivery_route'
  | 'delivered'
  | 'canceled'
  | 'returned'
  | 'failed';

// Transportadora/parceiro
export type CarrierId = 'bee-delivery';

// Endereço de entrega
export interface EnderecoEntrega {
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  latitude?: number;
  longitude?: number;
}

// Item para entrega
export interface ItemEntrega {
  nome: string;
  quantidade: number;
  pesoG?: number;
  volumeCm3?: number;
}

// Parâmetros para cotação de frete
export interface CotacaoParams {
  origem: EnderecoEntrega;
  destino: EnderecoEntrega;
  items: ItemEntrega[];
}

// Resultado de cotação
export interface ResultadoCotacao {
  carrierId: CarrierId;
  valorFrete: number;
  prazoEstimadoMin: number; // minutos
  prazoEstimadoMax: number;
  moeda: string;
  validaAte: string; // ISO datetime
}

// Parâmetros para solicitar entrega
export interface EntregaParams {
  origem: EnderecoEntrega;
  destino: EnderecoEntrega;
  items: ItemEntrega[];
  valorTotal: number;
  observacao?: string;
  contatoDestinatario?: {
    nome: string;
    telefone: string;
  };
}

// Resultado da solicitação de entrega
export interface ResultadoEntrega {
  carrierId: CarrierId;
  entregaId: string;
  status: DeliveryStatus;
  valorFrete: number;
  prazoEstimado: number; // minutos
  criadoEm: string; // ISO datetime
}

// Status atual de uma entrega em andamento
export interface StatusEntrega {
  carrierId: CarrierId;
  entregaId: string;
  status: DeliveryStatus;
  historico: EventoEntrega[];
  previsaoEntrega?: string; // ISO datetime
}

// Evento do histórico de rastreio
export interface EventoEntrega {
  timestamp: string; // ISO datetime
  status: DeliveryStatus;
  descricao: string;
  localizacao?: { lat: number; lng: number };
}
