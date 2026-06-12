/**
 * DeliveryService — Orquestrador de entregas
 *
 * Mantém registro de adapters de delivery e roteia chamadas.
 * Suporta cotação múltipla (todos os adapters habilitados) e seleção do mais barato.
 */
import type { DeliveryAdapter } from './delivery-adapter';
import type {
  CotacaoParams,
  ResultadoCotacao,
  EntregaParams,
  ResultadoEntrega,
  StatusEntrega,
  CarrierId,
} from '../../types/delivery';
import { BeeDeliveryAdapter } from './bee-delivery-adapter';

export class DeliveryService {
  private adapters = new Map<string, DeliveryAdapter>();

  constructor() {
    this.registrarAdapter(new BeeDeliveryAdapter());
  }

  /**
   * Registra um adapter de delivery.
   */
  registrarAdapter(adapter: DeliveryAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  /**
   * Retorna um adapter pelo ID.
   */
  getAdapter(id: CarrierId): DeliveryAdapter | undefined {
    return this.adapters.get(id);
  }

  /**
   * Lista todos os adapters registrados.
   */
  listarAdapters(): DeliveryAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Lista apenas adapters habilitados.
   */
  listarHabilitados(): DeliveryAdapter[] {
    return this.listarAdapters().filter((a) => a.habilitado);
  }

  /**
   * Cota frete com UM adapter específico.
   */
  async cotarFrete(
    carrierId: CarrierId,
    params: CotacaoParams
  ): Promise<ResultadoCotacao> {
    const adapter = this.adapters.get(carrierId);
    if (!adapter) {
      throw new Error(`Delivery: carrier "${carrierId}" não registrado.`);
    }
    return adapter.cotarFrete(params);
  }

  /**
   * Cota frete com TODOS os adapters habilitados.
   * Retorna array com resultados (apenas os que não falharam).
   */
  async cotarTodas(params: CotacaoParams): Promise<ResultadoCotacao[]> {
    const habilitados = this.listarHabilitados();
    const resultados: ResultadoCotacao[] = [];

    await Promise.all(
      habilitados.map(async (adapter) => {
        try {
          const resultado = await adapter.cotarFrete(params);
          resultados.push(resultado);
        } catch (error) {
          console.warn(
            `[Delivery] ${adapter.nome}: falha na cotação —`,
            error instanceof Error ? error.message : String(error)
          );
        }
      })
    );

    return resultados;
  }

  /**
   * Cota com todos e retorna o mais barato.
   */
  async cotarMaisBarato(params: CotacaoParams): Promise<ResultadoCotacao | null> {
    const resultados = await this.cotarTodas(params);
    if (resultados.length === 0) return null;

    return resultados.reduce((maisBarato, atual) =>
      atual.valorFrete < maisBarato.valorFrete ? atual : maisBarato
    );
  }

  /**
   * Solicita entrega com um carrier específico.
   */
  async solicitarEntrega(
    carrierId: CarrierId,
    params: EntregaParams
  ): Promise<ResultadoEntrega> {
    const adapter = this.adapters.get(carrierId);
    if (!adapter) {
      throw new Error(`Delivery: carrier "${carrierId}" não registrado.`);
    }
    return adapter.solicitarEntrega(params);
  }

  /**
   * Rastreia entrega.
   */
  async rastrear(
    carrierId: CarrierId,
    entregaId: string
  ): Promise<StatusEntrega> {
    const adapter = this.adapters.get(carrierId);
    if (!adapter) {
      throw new Error(`Delivery: carrier "${carrierId}" não registrado.`);
    }
    return adapter.rastrear(entregaId);
  }

  /**
   * Cancela entrega.
   */
  async cancelar(
    carrierId: CarrierId,
    entregaId: string,
    motivo: string
  ): Promise<boolean> {
    const adapter = this.adapters.get(carrierId);
    if (!adapter) {
      throw new Error(`Delivery: carrier "${carrierId}" não registrado.`);
    }
    return adapter.cancelar(entregaId, motivo);
  }
}

// Singleton
export const deliveryService = new DeliveryService();
