import type { CapturedMessage } from '../types';
import { CapturedMessageSchema } from '../types/schemas';
import { messageDB } from '../storage/message-db';
import { DataScraper } from '../infrastructure/data-scraper';
import { webhookService } from '../infrastructure/webhook-service';
import { whatsappInterceptors } from '../infrastructure/whatsapp-interceptors';
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
    if (!whatsappInterceptors.isWebpackAvailable()) {
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

      // CORREÇÃO: Tentar diferentes formas de extrair chatId
      // Na referência (reverse.txt linha 839), veem N.Chat.getActive().id._serialized comparado com n.__x_from._serialized
      // Mas isso é para comparar se é o chat ativo, não para pegar o chatId
      // Para mensagens recebidas: chatId é quem enviou (from)
      // Para mensagens enviadas: chatId é quem recebe (to)
      // Vamos tentar pegar do contexto correto
      let chatId: string | undefined;
      
      if (msg.id?.fromMe) {
        // Mensagem enviada: chatId está em 'to'
        chatId = msg.to?._serialized || msg.__x_to?._serialized || msg.id?.remote;
      } else {
        // Mensagem recebida: chatId está em 'from' 
        chatId = msg.from?._serialized || msg.__x_from?._serialized || msg.id?.remote;
      }
      
      // Fallback: tentar outras propriedades
      if (!chatId) {
        chatId = msg.chatId?._serialized || msg.chat?._serialized || msg.__x_from?._serialized || msg.id?.remote || 'unknown';
      }

      // Garantir que chatId seja sempre uma string
      const finalChatId: string = chatId || 'unknown';

      const chatName = msg.__x_senderObj?.name || msg.__x_senderObj?.pushname || 'Unknown';
      const sender = msg.__x_senderObj?.name || msg.__x_senderObj?.pushname || chatName;
      const text = msg.__x_body || msg.__x_text || '';
      const timestamp = msg.__x_t ? new Date(msg.__x_t * 1000) : new Date();
      const isOutgoing = msg.id?.fromMe || msg.self === 'out';
      
      // ChatId extraído da mensagem

      // Gerar ID único baseado no ID serializado do WhatsApp
      const messageId = msg.id?._serialized || `webpack-${Date.now()}-${Math.random()}`;

      // Skip se já processado
      if (this.processedIds.has(messageId)) return;
      this.processedIds.add(messageId);

      const captured: CapturedMessage = {
        id: messageId,
        chatId: finalChatId,
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
      messageDB.saveMessage(validated)
        .then(() => {
          console.log('[METTRI] ✅ Mensagem salva no banco:', {
            id: validated.id.substring(0, 20) + '...',
            chatId: validated.chatId.substring(0, 20) + '...',
            text: validated.text.substring(0, 30) + (validated.text.length > 30 ? '...' : ''),
            timestamp: validated.timestamp.toISOString(),
          });
        })
        .catch(error => {
          console.error('[METTRI] ❌ Erro ao salvar mensagem interceptada:', error);
          console.error('[METTRI] Mensagem que falhou:', captured);
        });

      // Exportar para webhook em tempo real (padrão WA-Sync)
      if (msg.isNewMsg !== false) {
        webhookService.sendMessage(validated, 'message').catch(error => {
          console.warn('Mettri: Erro ao enviar mensagem para webhook:', error);
        });
      }

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

  /**
   * Raspa histórico completo de um chat.
   * Usa loadEarlierMsgs() em loop até não ter mais mensagens (padrão WA-Sync).
   */
  public async scrapeChatHistory(chatId: string): Promise<CapturedMessage[]> {
    try {
      const interceptors = this.dataScraper?.getInterceptors();
      if (!interceptors) {
        throw new Error('Interceptors não inicializados');
      }

      // 1. Encontrar chat
      const Chat = interceptors.Chat;
      const chat = await this.findChat(Chat, chatId);
      if (!chat) {
        throw new Error(`Chat ${chatId} não encontrado`);
      }

      // 2. Carregar mensagens antigas em loop (paginação)
      const ConversationMsgs = interceptors.ConversationMsgs;
      if (!ConversationMsgs || !ConversationMsgs.loadEarlierMsgs) {
        throw new Error('ConversationMsgs.loadEarlierMsgs não disponível');
      }

      let hasMore = true;
      let loadAttempts = 0;
      const maxAttempts = 1000; // Proteção contra loop infinito

      while (hasMore && loadAttempts < maxAttempts) {
        const earlierMsgs = await ConversationMsgs.loadEarlierMsgs(chat);
        hasMore = !!(earlierMsgs && earlierMsgs.length > 0);
        loadAttempts++;
        
        // Delay de 100ms entre carregamentos (respeitoso)
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // 3. Obter todas as mensagens carregadas
      const getAllMsgs = chat.getAllMsgs || chat.getAllMessages;
      if (!getAllMsgs || typeof getAllMsgs !== 'function') {
        throw new Error('chat.getAllMsgs() não disponível');
      }

      const allMsgs = getAllMsgs.call(chat) || [];
      console.log(`Mettri: Carregadas ${allMsgs.length} mensagens do chat ${chatId}`);

      // 4. Converter e salvar no IndexedDB
      const capturedMessages: CapturedMessage[] = [];
      for (const msg of allMsgs) {
        try {
          const captured = await this.convertToCapturedMessage(msg, chatId);
          await messageDB.saveMessage(captured);
          capturedMessages.push(captured);
        } catch (error) {
          console.warn('Mettri: Erro ao processar mensagem histórica:', error);
        }
      }

      return capturedMessages;
    } catch (error) {
      console.error('Mettri: Erro ao raspar histórico:', error);
      throw error;
    }
  }

  /**
   * Encontra chat por ID.
   */
  private async findChat(Chat: any, chatId: string): Promise<any> {
    // Tentar Chat.find()
    if (Chat && typeof Chat.find === 'function') {
      try {
        const chat = await Chat.find(chatId);
        if (chat) return chat;
      } catch (error) {
        console.warn('Mettri: Chat.find() falhou:', error);
      }
    }

    // Tentar Chat.get() (método comum de coleções)
    if (Chat && typeof Chat.get === 'function') {
      try {
        const chat = Chat.get(chatId);
        if (chat) return chat;
      } catch (error) {
        console.warn('Mettri: Chat.get() falhou:', error);
      }
    }

    // Tentar Chat._models
    if (Chat && Chat._models && Array.isArray(Chat._models)) {
      const chat = Chat._models.find((c: any) => {
        const id = c.id?._serialized || c.id?.toString();
        return id === chatId;
      });
      if (chat) return chat;
    }

    // Tentar via getModelsArray()
    if (Chat && typeof Chat.getModelsArray === 'function') {
      const chats = Chat.getModelsArray();
      const chat = chats.find((c: any) => {
        const id = c.id?._serialized || c.id?.toString();
        return id === chatId;
      });
      if (chat) return chat;
    }

    return null;
  }

  /**
   * Converte mensagem do formato WhatsApp para CapturedMessage.
   */
  private async convertToCapturedMessage(msg: any, chatId: string): Promise<CapturedMessage> {
    // Extrair chatId corretamente
    let finalChatId = chatId;
    if (!finalChatId) {
      if (msg.id?.fromMe) {
        finalChatId = msg.to?._serialized || msg.__x_to?._serialized || msg.id?.remote || 'unknown';
      } else {
        finalChatId = msg.from?._serialized || msg.__x_from?._serialized || msg.id?.remote || 'unknown';
      }
    }

    const chatName = msg.__x_senderObj?.name || msg.__x_senderObj?.pushname || msg.chat?.name || 'Unknown';
    const sender = msg.__x_senderObj?.name || msg.__x_senderObj?.pushname || chatName;
    const text = msg.__x_body || msg.__x_text || msg.body || '';
    
    // Converter timestamp
    let timestamp: Date;
    if (msg.__x_t) {
      timestamp = new Date(msg.__x_t * 1000);
    } else if (msg.t) {
      timestamp = new Date(msg.t * 1000);
    } else if (msg.timestamp) {
      timestamp = msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp);
    } else {
      timestamp = new Date();
    }

    const isOutgoing = msg.id?.fromMe || msg.self === 'out' || msg.fromMe === true;

    // Gerar ID único
    const messageId = msg.id?._serialized || `historical-${chatId}-${timestamp.getTime()}-${Math.random()}`;

    const captured: CapturedMessage = {
      id: messageId,
      chatId: finalChatId,
      chatName,
      sender,
      text,
      timestamp,
      isOutgoing,
      type: msg.type || 'text',
    };

    // Validar com Zod
    return CapturedMessageSchema.parse(captured);
  }

  /**
   * Raspa histórico completo de todos os chats.
   */
  public async scrapeAllChatsHistory(): Promise<Map<string, CapturedMessage[]>> {
    const interceptors = this.dataScraper?.getInterceptors();
    if (!interceptors) {
      throw new Error('Interceptors não inicializados');
    }

    const Chat = interceptors.Chat;
    let chatIds: string[] = [];

    // Obter lista de chats via getModelsArray() ou _models
    if (Chat && typeof Chat.getModelsArray === 'function') {
      const chats = Chat.getModelsArray();
      chatIds = chats.map((chat: any) => 
        chat.id?._serialized || chat.id?.toString()
      ).filter(Boolean);
    } else if (Chat && Chat._models) {
      chatIds = Chat._models.map((chat: any) =>
        chat.id?._serialized || chat.id?.toString()
      ).filter(Boolean);
    }

    const results = new Map<string, CapturedMessage[]>();

    // Processar em batches de 5 chats (evitar sobrecarga)
    const batchSize = 5;
    for (let i = 0; i < chatIds.length; i += batchSize) {
      const batch = chatIds.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (chatId) => {
          try {
            console.log(`Mettri: Raspando histórico do chat ${chatId}...`);
            const messages = await this.scrapeChatHistory(chatId);
            results.set(chatId, messages);
            console.log(`Mettri: ✅ Raspado ${messages.length} mensagens do chat ${chatId}`);
          } catch (error) {
            console.error(`Mettri: ❌ Erro ao raspar chat ${chatId}:`, error);
            results.set(chatId, []);
          }
        })
      );

      // Delay de 2s entre batches (respeitoso)
      if (i + batchSize < chatIds.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return results;
  }
}
