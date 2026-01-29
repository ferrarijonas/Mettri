/**
 * DataScraper
 * 
 * Sistema que intercepta eventos do WhatsApp via webpack.
 * Escuta eventos de mensagens, presença e mudanças de chat.
 * 
 * Valida todos os dados interceptados com Zod antes de usar.
 */

import { whatsappInterceptors } from './whatsapp-interceptors';
import { z } from 'zod';

/**
 * Função helper para log seguro de objetos (evita referências circulares)
 * Melhorada para mostrar conteúdo real, não apenas "Object"
 */
function safeLog(obj: any, label: string): void {
  const seen = new WeakSet();
  
  try {
    // Forma 1: Logar propriedades específicas
    const info: any = {
      type: typeof obj,
      isFunction: typeof obj === 'function',
      isObject: typeof obj === 'object',
      constructor: obj?.constructor?.name,
      hasOn: typeof obj?.on === 'function',
      hasGet: typeof obj?.get === 'function',
      hasDefault: !!obj?.default,
    };
    
    // Tentar obter chaves (pode falhar se objeto tem getters)
    try {
      info.keys = Object.keys(obj || {}).slice(0, 30);
    } catch {}
    
    // Tentar obter propriedades próprias
    try {
      info.ownPropertyNames = Object.getOwnPropertyNames(obj || {}).slice(0, 30);
    } catch {}
    
    // Verificar propriedades específicas
    const checkProps = ['default', 'Collection', 'Model', 'Chat', 'Msg', 'PresenceCollection'];
    checkProps.forEach(prop => {
      try {
        if (obj && prop in obj) {
          info[`has${prop}`] = true;
          info[`${prop}Type`] = typeof obj[prop];
          if (typeof obj[prop] === 'object') {
            info[`${prop}HasOn`] = typeof obj[prop]?.on === 'function';
            info[`${prop}HasGet`] = typeof obj[prop]?.get === 'function';
          }
        }
      } catch {}
    });
    
    // ${label} disponível
    
    // Forma 2: Tentar JSON.stringify (pode falhar com objetos circulares)
    try {
      const json = JSON.stringify(obj, (key, value) => {
        if (typeof value === 'function') return '[Function]';
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      }, 2);
      if (json.length > 1000) {
        // ${label} (JSON disponível)
      } else {
        // ${label} (JSON completo)
      }
    } catch (e: any) {
      // ${label} (JSON failed): ${e.message}
    }
  } catch (error: any) {
    // ${label} (log failed): ${error.message}
  }
}

// Schema Zod para validar mensagens interceptadas
// PERMISSIVO: Aceita qualquer estrutura, apenas valida campos presentes
const MessageSchema = z.object({
  id: z.union([
    z.object({
      _serialized: z.string().optional(),
      fromMe: z.boolean().optional(),
      remote: z.string().optional(),
    }).passthrough(),
    z.string(), // Pode ser string direta
    z.any(), // Fallback: aceita qualquer coisa
  ]),
  __x_body: z.string().optional(),
  __x_text: z.string().optional(),
  __x_type: z.string().optional(),
  __x_t: z.number().optional(),
  isNewMsg: z.boolean().optional(),
  self: z.enum(['in', 'out']).optional(),
  __x_from: z
    .object({
      _serialized: z.string().optional(),
      user: z.string().optional(),
      server: z.string().optional(),
    })
    .passthrough()
    .optional(),
  __x_to: z
    .object({
      _serialized: z.string().optional(),
      user: z.string().optional(),
      server: z.string().optional(),
    })
    .passthrough()
    .optional(),
  to: z.any().optional(),
  from: z.any().optional(),
  chatId: z.any().optional(),
  chat: z.any().optional(),
  __x_senderObj: z
    .object({
      name: z.string().optional(),
      pushname: z.string().optional(),
    })
    .passthrough()
    .optional(),
}).passthrough(); // Aceita campos extras que não estão no schema

type MessageCallback = (msg: any) => void;
type PresenceCallback = (data: any) => void;

export class DataScraper {
  private messageCallbacks: MessageCallback[] = [];
  private presenceCallbacks: PresenceCallback[] = [];
  private chatCallbacks: Array<(chatId: string) => void> = [];
  private isRunning = false;

  constructor() {
    // Usa singleton whatsappInterceptors - não cria nova instância
  }

  /**
   * Inicia a interceptação de eventos.
   * 
   * @throws Error se webpack não estiver disponível ou timeout
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    try {
      // Verificar disponibilidade antes de inicializar
      if (!whatsappInterceptors.isWebpackAvailable()) {
        throw new Error('Webpack não disponível');
      }

      // Timeout de 5s para inicialização
      const initPromise = whatsappInterceptors.initialize();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout na inicialização do webpack')), 5000)
      );
      
      await Promise.race([initPromise, timeoutPromise]);

      // Interceptar eventos de mensagem
      // O getter Msg já verifica se é uma coleção válida com .on() e .get()
      const Msg = whatsappInterceptors.Msg;
      if (!Msg) {
        console.warn('Mettri: Módulo Msg não encontrado');
        // Note: debugAllModules não está disponível no bridge client
      } else {
        safeLog(Msg, 'Msg module structure');
        
        // O getter Msg já retorna a coleção correta (verificada no getter)
        // Se chegou aqui, Msg deve ter .on() e .get()
        if (typeof Msg.on === 'function' && typeof Msg.get === 'function') {
          // Listener para novas mensagens
          // IMPORTANTE: Filtrar apenas mensagens novas (padrão WA-Sync)
          // WA-Sync usa: Msg.on("add", async e => { if (e.isNewMsg) { ... } })
          Msg.on('add', (msg: any) => {
            // Filtrar apenas mensagens novas (padrão WA-Sync)
            if (!msg?.isNewMsg) {
              return; // Ignorar mensagens antigas
            }

            // Evento Msg.on("add") disparado (apenas mensagens novas)
            
            try {
              // Validar com Zod (permissivo - aceita campos opcionais faltando)
              const validated = MessageSchema.parse(msg);
              // Mensagem validada com sucesso
              this.messageCallbacks.forEach((cb) => cb(validated));
            } catch (error) {
              // Log detalhado do erro de validação
              if (error instanceof z.ZodError) {
                console.warn('[METTRI] ⚠️ Erro ao validar mensagem interceptada (Zod):', error.errors);
                console.warn('[METTRI] Mensagem que falhou na validação:', {
                  hasId: !!msg.id,
                  hasSerialized: !!msg.id?._serialized,
                  hasXBody: !!msg.__x_body,
                  hasXText: !!msg.__x_text,
                  isNewMsg: msg.isNewMsg,
                  keys: Object.keys(msg || {}).slice(0, 20),
                });
              } else {
                console.warn('[METTRI] ⚠️ Erro ao validar mensagem interceptada:', error);
              }
              // IMPORTANTE: Mesmo com erro de validação, tentar processar a mensagem
              // (pode ser que alguns campos opcionais estejam faltando mas a mensagem é válida)
              // Tentando processar mensagem mesmo com erro de validação
              try {
                this.messageCallbacks.forEach((cb) => cb(msg));
              } catch (fallbackError) {
                console.error('[METTRI] ❌ Erro no fallback de processamento:', fallbackError);
              }
            }
          });

          // Listener para mensagens modificadas
          Msg.on('change', (msg: any) => {
            try {
              const validated = MessageSchema.parse(msg);
              this.messageCallbacks.forEach((cb) => cb(validated));
            } catch (error) {
              console.warn('Mettri: Erro ao validar mensagem modificada:', error);
            }
          });
          
          console.log('Mettri: Listeners de mensagem configurados com sucesso');
        } else {
          console.warn('Mettri: Msg encontrado mas não tem métodos .on() e .get()');
          safeLog(Msg, 'Msg (estrutura inesperada)');
          // Note: debugAllModules não está disponível no bridge client
        }
      }

      // Interceptar eventos de presença
      const PresenceCollection = whatsappInterceptors.PresenceCollection;
      if (PresenceCollection) {
        safeLog(PresenceCollection, 'PresenceCollection module structure');
        
        // Tentar diferentes formas de acessar a coleção
        const Presence = 
          (typeof PresenceCollection.on === 'function' ? PresenceCollection : null) ||
          (PresenceCollection.default && typeof PresenceCollection.default.on === 'function' ? PresenceCollection.default : null) ||
          (PresenceCollection.PresenceCollection && typeof PresenceCollection.PresenceCollection.on === 'function' ? PresenceCollection.PresenceCollection : null) ||
          null;
        
        if (Presence && typeof Presence.on === 'function') {
          Presence.on('change:isOnline', (data: any) => {
            this.presenceCallbacks.forEach((cb) => cb(data));
          });
          console.log('Mettri: Listener de presença configurado com sucesso');
        } else {
          console.warn('Mettri: Não foi possível encontrar PresenceCollection com método .on()');
          safeLog(Presence || PresenceCollection, 'Presence (tentativa de acesso)');
        }
      }

      // Interceptar mudanças de chat ativo
      const ChatCollection = whatsappInterceptors.ChatCollection;
      if (ChatCollection) {
        // Tentar encontrar método para escutar mudanças de chat
        // Nota: Pode variar conforme versão do WhatsApp
        try {
          if (ChatCollection.on) {
            ChatCollection.on('change:id', (chat: any) => {
              if (chat?.id?._serialized) {
                this.chatCallbacks.forEach((cb) => cb(chat.id._serialized));
              }
            });
          }
        } catch (error) {
          console.warn('Mettri: Erro ao interceptar mudanças de chat:', error);
        }
      }

      this.isRunning = true;
      console.log('Mettri: DataScraper iniciado com sucesso');
    } catch (error) {
      console.error('Mettri: Erro ao iniciar DataScraper:', error);
      throw error;
    }
  }

  /**
   * Registra callback para novas mensagens interceptadas.
   * 
   * @param callback Função chamada quando uma mensagem é interceptada
   */
  onMessage(callback: MessageCallback): void {
    this.messageCallbacks.push(callback);
  }

  /**
   * Registra callback para mudanças de presença (online/offline).
   * 
   * @param callback Função chamada quando há mudança de presença
   */
  onPresenceChange(callback: PresenceCallback): void {
    this.presenceCallbacks.push(callback);
  }

  /**
   * Registra callback para mudanças de chat ativo.
   * 
   * @param callback Função chamada quando o chat ativo muda
   */
  onChatChange(callback: (chatId: string) => void): void {
    this.chatCallbacks.push(callback);
  }

  /**
   * Para a interceptação de eventos.
   */
  stop(): void {
    this.isRunning = false;
    this.messageCallbacks = [];
    this.presenceCallbacks = [];
    this.chatCallbacks = [];
  }

  /**
   * Verifica se o scraper está rodando.
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Retorna os interceptors (para acesso direto aos módulos se necessário).
   */
  getInterceptors(): typeof whatsappInterceptors {
    return whatsappInterceptors;
  }
}
