/**
 * WebhookService
 * 
 * Serviço para exportação em tempo real de mensagens via webhook/API.
 * Segue padrão WA-Sync para exportação instantânea.
 */

import type { CapturedMessage } from '../types';

export interface WebhookConfig {
  url: string;
  secret?: string;
  enabled: boolean;
  events: string[]; // ['message', 'message_ack', 'message_edit', etc.]
}

export interface WebhookPayload {
  event: string;
  timestamp: number;
  instanceId: string;
  data: {
    message: CapturedMessage;
    chat?: {
      id: string;
      name: string;
      isGroup: boolean;
    };
  };
}

/**
 * Serializa dados para evitar referências circulares.
 */
function serializeData(data: any): any {
  try {
    return JSON.parse(JSON.stringify(data));
  } catch (error) {
    console.error('Mettri: Erro ao serializar dados para webhook:', error);
    return { error: 'Serialization failed', message: String(error) };
  }
}

export class WebhookService {
  private config: WebhookConfig | null = null;
  private pendingQueue: WebhookPayload[] = [];
  private isProcessing = false;
  private retryAttempts = 3;
  private retryDelay = 1000; // 1s

  /**
   * Configura o webhook.
   */
  public setConfig(config: WebhookConfig): void {
    this.config = config;
    console.log('Mettri: Webhook configurado:', { url: config.url, enabled: config.enabled });
  }

  /**
   * Obtém a configuração atual do webhook.
   */
  public getConfig(): WebhookConfig | null {
    return this.config;
  }

  /**
   * Verifica se o webhook está habilitado e configurado.
   */
  public isEnabled(): boolean {
    return this.config?.enabled === true && !!this.config?.url;
  }

  /**
   * Envia mensagem para webhook (padrão WA-Sync).
   */
  public async sendMessage(message: CapturedMessage, eventType: string = 'message'): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    // Verificar se o evento está na lista de eventos habilitados
    if (this.config?.events && !this.config.events.includes(eventType)) {
      return;
    }

    const payload: WebhookPayload = {
      event: eventType,
      timestamp: Date.now(),
      instanceId: 'mettri-instance-1',
      data: {
        message: serializeData(message),
        chat: {
          id: message.chatId,
          name: message.chatName,
          isGroup: message.chatId.includes('@g.us'),
        },
      },
    };

    await this.sendToWebhook(payload);
  }

  /**
   * Envia payload para o webhook com retry automático.
   */
  private async sendToWebhook(payload: WebhookPayload): Promise<void> {
    if (!this.config?.url) {
      return;
    }

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < this.retryAttempts) {
      try {
        const response = await fetch(this.config.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.secret && { 'X-Webhook-Secret': this.config.secret }),
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          console.log('Mettri: ✅ Mensagem enviada para webhook com sucesso');
          return;
        }

        // Se não foi OK, tentar novamente
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;
        
        if (attempt < this.retryAttempts) {
          // Delay exponencial: 1s, 2s, 4s
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          console.warn(`Mettri: Tentativa ${attempt}/${this.retryAttempts} falhou, tentando novamente em ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // Se todas as tentativas falharam, logar erro
    console.error('Mettri: ❌ Falha ao enviar para webhook após todas as tentativas:', lastError);
    
    // Adicionar à fila de pendências para processar depois
    this.pendingQueue.push(payload);
  }

  /**
   * Processa fila de mensagens pendentes.
   */
  public async processPendingQueue(): Promise<void> {
    if (this.isProcessing || this.pendingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`Mettri: Processando ${this.pendingQueue.length} mensagens pendentes...`);

    while (this.pendingQueue.length > 0) {
      const payload = this.pendingQueue.shift();
      if (payload) {
        await this.sendToWebhook(payload);
        // Delay de 500ms entre mensagens pendentes
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    this.isProcessing = false;
    console.log('Mettri: Fila de pendências processada');
  }

  /**
   * Limpa a fila de mensagens pendentes.
   */
  public clearPendingQueue(): void {
    this.pendingQueue = [];
  }

  /**
   * Desabilita o webhook.
   */
  public disable(): void {
    if (this.config) {
      this.config.enabled = false;
    }
  }

  /**
   * Envia mensagens em batches (padrão WA-Sync).
   * Processa em lotes de 50 mensagens com delay de 2s entre batches.
   */
  public async sendBatch(messages: CapturedMessage[], batchSize: number = 50): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    console.log(`Mettri: Enviando ${messages.length} mensagens em batches de ${batchSize}...`);

    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      
      // Criar payload de batch
      const batchPayload = {
        event: 'batch_message',
        timestamp: Date.now(),
        instanceId: 'mettri-instance-1',
        data: {
          messages: batch.map(msg => serializeData(msg)),
          batchNumber: Math.floor(i / batchSize) + 1,
          totalBatches: Math.ceil(messages.length / batchSize),
        },
      };

      await this.sendBatchToWebhook(batchPayload);

      // Delay de 2s entre batches (padrão WA-Sync)
      if (i + batchSize < messages.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`Mettri: ✅ Enviadas ${messages.length} mensagens em batches`);
  }

  /**
   * Envia batch para webhook com retry automático.
   */
  private async sendBatchToWebhook(payload: any): Promise<void> {
    if (!this.config?.url) {
      return;
    }

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < this.retryAttempts) {
      try {
        const response = await fetch(this.config.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.secret && { 'X-Webhook-Secret': this.config.secret }),
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          return;
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;
        
        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error('Mettri: ❌ Falha ao enviar batch para webhook após todas as tentativas:', lastError);
  }
}

// Singleton instance
export const webhookService = new WebhookService();
