import { whatsappInterceptors } from './whatsapp-interceptors';

type ChatChangedCallback = (chatId: string | null) => void;

function extractChatId(chatLike: any): string | null {
  if (!chatLike) return null;
  const id =
    chatLike?.id?._serialized ??
    (typeof chatLike?.id === 'string' ? chatLike.id : null) ??
    (typeof chatLike?.id?.toString === 'function' ? chatLike.id.toString() : null) ??
    (typeof chatLike?._serialized === 'string' ? chatLike._serialized : null);
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

/**
 * ActiveChatService
 *
 * Metáfora: é a “campainha” que toca quando você troca de conversa.
 * Ele tenta várias estratégias e faz fallback para polling leve.
 */
export class ActiveChatService {
  private callbacks: ChatChangedCallback[] = [];
  private currentChatId: string | null = null;
  private started = false;

  private pollTimer: number | null = null;
  private readonly pollMs: number;

  private boundCollectionHandler: ((chat: any) => void) | null = null;

  constructor(options?: { pollMs?: number }) {
    this.pollMs = Math.max(250, Number(options?.pollMs ?? 750));
  }

  public onChange(callback: ChatChangedCallback): void {
    this.callbacks.push(callback);
  }

  public getCurrent(): string | null {
    return this.currentChatId;
  }

  public async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    try {
      await whatsappInterceptors.initialize();
    } catch {
      // continuar mesmo assim (fallback)
    }

    // 1) Estado inicial (uma leitura)
    await this.refreshOnce();

    // 2) Listener se existir (melhor que polling)
    this.tryAttachCollectionListener();

    // 3) Polling leve como rede de segurança
    this.startPolling();
  }

  public stop(): void {
    this.started = false;

    if (this.pollTimer != null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // Tentar remover listener se a lib suportar off()
    try {
      const ChatCollection: any = whatsappInterceptors.ChatCollection;
      const handler = this.boundCollectionHandler;
      if (ChatCollection && handler && typeof ChatCollection.off === 'function') {
        ChatCollection.off('change:id', handler);
      }
    } catch {
      // ignore
    }

    this.boundCollectionHandler = null;
    this.callbacks = [];
  }

  public async getActiveChatId(): Promise<string | null> {
    // Estratégia 1: window.Store.Chat.getActive() (padrão WA-Sync em muitos lugares)
    try {
      const storeChat = (window as any)?.Store?.Chat;
      if (storeChat && typeof storeChat.getActive === 'function') {
        const active = storeChat.getActive();
        const id = extractChatId(active);
        if (id) return id;
      }
    } catch {
      // ignore
    }

    // Estratégia 2: Interceptors.Chat.getActive()
    try {
      const Chat: any = whatsappInterceptors.Chat;
      if (Chat && typeof Chat.getActive === 'function') {
        const active = Chat.getActive();
        const id = extractChatId(active);
        if (id) return id;
      }
    } catch {
      // ignore
    }

    // Estratégia 3: Interceptors.ChatCollection.getActive()
    try {
      const ChatCollection: any = whatsappInterceptors.ChatCollection;
      if (ChatCollection && typeof ChatCollection.getActive === 'function') {
        const active = ChatCollection.getActive();
        const id = extractChatId(active);
        if (id) return id;
      }
    } catch {
      // ignore
    }

    return null;
  }

  private async refreshOnce(): Promise<void> {
    const next = await this.getActiveChatId();
    this.setCurrent(next);
  }

  private setCurrent(next: string | null): void {
    if (next === this.currentChatId) return;
    this.currentChatId = next;
    this.callbacks.forEach((cb) => {
      try {
        cb(next);
      } catch {
        // ignore
      }
    });
  }

  private tryAttachCollectionListener(): void {
    try {
      const ChatCollection: any = whatsappInterceptors.ChatCollection;
      if (!ChatCollection || typeof ChatCollection.on !== 'function') return;
      if (this.boundCollectionHandler) return;

      const handler = (chat: any) => {
        const id = extractChatId(chat);
        if (id) this.setCurrent(id);
      };

      this.boundCollectionHandler = handler;
      // Mesmo evento que o DataScraper usa hoje (compatibilidade)
      ChatCollection.on('change:id', handler);
    } catch {
      // ignore
    }
  }

  private startPolling(): void {
    if (this.pollTimer != null) return;

    this.pollTimer = window.setInterval(() => {
      if (!this.started) return;
      this.getActiveChatId()
        .then((id) => this.setCurrent(id))
        .catch(() => {});
    }, this.pollMs);
  }
}

