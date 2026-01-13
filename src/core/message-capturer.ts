import type { CapturedMessage } from '../types';
import { CapturedMessageSchema } from '../types/schemas';
import { messageDB } from '../storage/message-db';
import { DataScraper } from '../infrastructure/data-scraper';
import { z } from 'zod';

type MessageCallback = (message: CapturedMessage) => void;

/**
 * MessageCapturer
 * 
 * Captura mensagens do WhatsApp Web via interceptação webpack.
 * Segue padrão do reverse.txt para acessar módulos internos.
 */
export class MessageCapturer {
  private dataScraper: DataScraper | null = null;
  private callbacks: MessageCallback[] = [];
  private processedIds = new Set<string>();
  private isRunning = false;
  private isUsingWebpack = false;
  
  // Contadores de estatísticas
  private webpackMessageCount = 0;
  private webpackEventCount = 0;

  constructor() {
    // Focado apenas em webpack, sem dependências de seletores ou DOM
  }

  /**
   * Inicia a captura de mensagens via webpack.
   * 
   * @throws Error se webpack não estiver disponível
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // Verificar disponibilidade webpack ANTES de tentar inicializar
    const { WhatsAppInterceptors } = await import('../infrastructure/whatsapp-interceptors');
    const interceptors = new WhatsAppInterceptors();
    
    if (!interceptors.isWebpackAvailable()) {
      console.error('Mettri: Webpack não disponível. WhatsApp Web pode não estar totalmente carregado.');
      this.isRunning = false;
      throw new Error('Webpack não disponível');
    }

    try {
      // Timeout de 5s para inicialização do webpack
      const initPromise = this.initializeWebpack();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Webpack initialization timeout')), 5000)
      );
      
      await Promise.race([initPromise, timeoutPromise]);
      
      this.isUsingWebpack = true;
      console.log('Mettri: Usando interceptação webpack para captura');
    } catch (error) {
      this.isRunning = false;
      console.error('Mettri: Erro ao inicializar webpack:', error);
      throw error;
    }
  }

  /**
   * Inicializa interceptação webpack.
   */
  private async initializeWebpack(): Promise<void> {
    this.dataScraper = new DataScraper();
    await this.dataScraper.start();

    // Registrar callback para mensagens interceptadas
    this.dataScraper.onMessage((msg: any) => {
      this.processInterceptedMessage(msg);
    });
  }

  /**
   * Processa mensagem interceptada via webpack.
   * Converte formato webpack para CapturedMessage e valida com Zod.
   */
  private processInterceptedMessage(msg: any): void {
    try {
      // Converter mensagem interceptada para formato CapturedMessage
      const chatId = msg.__x_from?._serialized || msg.id?.remote || 'unknown';
      const chatName = msg.__x_senderObj?.name || msg.__x_senderObj?.pushname || 'Unknown';
      const sender = msg.__x_senderObj?.name || msg.__x_senderObj?.pushname || chatName;
      const text = msg.__x_body || msg.__x_text || '';
      const timestamp = msg.__x_t ? new Date(msg.__x_t * 1000) : new Date();
      const isOutgoing = msg.id?.fromMe || msg.self === 'out';

      // Gerar ID único baseado no ID serializado do WhatsApp
      const messageId = msg.id?._serialized || `webpack-${Date.now()}-${Math.random()}`;

      // Skip se já processado
      if (this.processedIds.has(messageId)) return;
      this.processedIds.add(messageId);

      const captured: CapturedMessage = {
        id: messageId,
        chatId,
        chatName,
        sender,
        text,
        timestamp,
        isOutgoing,
        type: 'text', // Por enquanto apenas texto, expandir depois
      };

      // Validar com Zod
      const validated = CapturedMessageSchema.parse(captured);

      // Salvar no banco
      messageDB.saveMessage(validated).catch(error => {
        console.error('Mettri: Erro ao salvar mensagem interceptada:', error);
      });

      // Incrementar contador webpack
      this.webpackMessageCount++;
      this.webpackEventCount++;

      // Notificar callbacks
      this.callbacks.forEach(cb => cb(validated));
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.warn('Mettri: Erro ao validar mensagem interceptada:', error.errors);
      } else {
        console.error('Mettri: Erro ao processar mensagem interceptada:', error);
      }
    }
  }

  /**
   * Para a captura de mensagens.
   */
  public stop(): void {
    // Parar webpack se estiver usando
    if (this.dataScraper) {
      this.dataScraper.stop();
      this.dataScraper = null;
    }

    this.isRunning = false;
    this.isUsingWebpack = false;
    console.log('Mettri: Message capturer stopped');
  }

  /**
   * Registra callback para novas mensagens.
   */
  public onMessage(callback: MessageCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Retorna estatísticas de captura.
   */
  public getStats(): {
    isUsingWebpack: boolean;
    webpackMessages: number;
    webpackEvents: number;
  } {
    return {
      isUsingWebpack: this.isUsingWebpack,
      webpackMessages: this.webpackMessageCount,
      webpackEvents: this.webpackEventCount,
    };
  }

  /**
   * Reseta estado e tenta novamente.
   */
  public async resetAndRetry(): Promise<void> {
    console.log('Mettri: Resetando e tentando novamente...');
    this.stop();
    await this.start();
  }
}
