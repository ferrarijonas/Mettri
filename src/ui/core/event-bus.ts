/**
 * Event Bus - Sistema de comunicação assíncrona entre módulos
 * 
 * Permite que módulos se comuniquem sem acoplamento direto.
 * Eventos são namespaced: 'module:event' (ex: 'history:contact-selected')
 */
export type EventHandler<T = unknown> = (data: T) => void;

export class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  /**
   * Registra um handler para um evento
   * @param event Nome do evento (ex: 'history:contact-selected')
   * @param handler Função que será chamada quando o evento for emitido
   */
  on<T = unknown>(event: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler);
  }

  /**
   * Remove um handler de um evento
   * @param event Nome do evento
   * @param handler Handler a ser removido
   */
  off<T = unknown>(event: string, handler: EventHandler<T>): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler as EventHandler);
      if (handlers.size === 0) {
        this.handlers.delete(event);
      }
    }
  }

  /**
   * Emite um evento, chamando todos os handlers registrados
   * @param event Nome do evento
   * @param data Dados a serem passados para os handlers
   */
  emit<T = unknown>(event: string, data?: T): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[EventBus] Erro ao executar handler para evento "${event}":`, error);
        }
      });
    }
  }

  /**
   * Remove todos os handlers de um evento
   * @param event Nome do evento (opcional, se não fornecido remove todos)
   */
  clear(event?: string): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }

  /**
   * Retorna o número de handlers registrados para um evento
   * @param event Nome do evento
   */
  listenerCount(event: string): number {
    return this.handlers.get(event)?.size ?? 0;
  }
}
