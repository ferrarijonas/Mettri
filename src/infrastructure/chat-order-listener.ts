/**
 * ChatOrderListener
 * 
 * Escuta eventos do WhatsApp para atualizar ordem dos chats em tempo real.
 * Usa WhatsAppInterceptors para acessar Chat e Msg (em vez de window.Store antigo).
 */

type OrderUpdateCallback = () => void;

export class ChatOrderListener {
  private callbacks: OrderUpdateCallback[] = [];
  private isListening = false;
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_MS = 500; // Debounce de 500ms para evitar muitas atualizações

  /**
   * Registra callback para ser chamado quando a ordem dos chats mudar.
   */
  public onOrderChange(callback: OrderUpdateCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Remove callback.
   */
  public offOrderChange(callback: OrderUpdateCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index > -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Inicia escuta de eventos do WhatsApp.
   * IMPORTANTE: Deve ser chamado após WhatsApp estar totalmente carregado.
   * 
   * @param maxAttempts Número máximo de tentativas (padrão: 5)
   * @param interceptors Instância de WhatsAppInterceptors (opcional, tenta buscar globalmente)
   */
  public start(maxAttempts: number = 5, interceptors?: any): void {
    if (this.isListening) {
      return; // Já está escutando
    }

    // Tentar obter interceptors se não foram fornecidos
    if (!interceptors) {
      // Verificar se há instância global (exposta para debug)
      interceptors = (window as any).__mettriInterceptors;
      if (!interceptors) {
        // Aguardar um pouco e tentar novamente, mas limitar tentativas
        if (maxAttempts > 0) {
          setTimeout(() => this.start(maxAttempts - 1), 2000);
        }
        return;
      }
    }

    // Tentar acessar Chat e Msg via interceptors
    try {
      const Chat = interceptors.Chat;
      const Msg = interceptors.Msg;

      if (!Chat || !Msg) {
        if (maxAttempts > 0) {
          setTimeout(() => this.start(maxAttempts - 1, interceptors), 2000);
        }
        return;
      }

      // Escutar eventos que podem mudar a ordem dos chats
      // Padrão WA-Sync: Msg.on("add") - quando nova mensagem chega
      if (typeof Msg.on === 'function') {
        Msg.on('add', (msg: any) => {
          // Apenas processar mensagens novas (isNewMsg)
          if (msg?.isNewMsg) {
            this.notifyOrderChange();
          }
        });
      }

      // Escutar mudanças em chats que podem afetar ordem
      // Padrão WA-Sync: Chat.on("change:unreadCount") - quando contagem muda
      if (typeof Chat.on === 'function') {
        // Mudança de contagem de não lidas pode mudar ordem
        Chat.on('change:unreadCount', () => {
          this.notifyOrderChange();
        });

        // Chat removido pode mudar ordem
        Chat.on('remove', () => {
          this.notifyOrderChange();
        });

        // Chat arquivado pode mudar ordem
        Chat.on('change:archive', () => {
          this.notifyOrderChange();
        });

        // Mudança de timestamp (propriedade 't') - afeta ordem diretamente
        // IMPORTANTE: WhatsApp pode não disparar evento específico para 't'
        // Então escutamos mudanças genéricas mas verificamos se é relevante
        Chat.on('change', (chat: any) => {
          // Quando qualquer chat muda, pode ter afetado a ordem
          // O WhatsApp reordena automaticamente quando 't' muda
          // Então sempre notificamos (com debounce para evitar spam)
          this.notifyOrderChange();
        });
      }

      this.isListening = true;
    } catch (error) {
      // Silenciar erro - interceptors podem não estar prontos ainda
      if (maxAttempts > 0) {
        setTimeout(() => this.start(maxAttempts - 1), 2000);
      }
      return;
    }
  }

  /**
   * Para escuta de eventos.
   */
  public stop(): void {
    if (!this.isListening) return;

    // Nota: Não removemos listeners porque não temos referência direta
    // O WhatsApp gerencia isso internamente
    this.isListening = false;
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Notifica callbacks sobre mudança de ordem (com debounce).
   */
  private notifyOrderChange(): void {
    // Debounce para evitar muitas atualizações seguidas
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.callbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('ChatOrderListener: Erro ao executar callback:', error);
        }
      });
      this.debounceTimer = null;
    }, this.DEBOUNCE_MS);
  }
}
