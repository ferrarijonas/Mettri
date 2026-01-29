import type { CapturedMessage } from '../../../types';
import { messageDB } from '../../../storage/message-db';
import { whatsappInterceptors } from '../../../infrastructure/whatsapp-interceptors';
import { ChatOrderListener } from '../../../infrastructure/chat-order-listener';

export interface ContactGroup {
  chatId: string;
  chatName: string;
  messageCount: number;
  lastMessage: CapturedMessage | null;
  lastMessageTime: Date | null;
}

export class HistoryPanel {
  private container: HTMLElement | null = null;
  private currentView: 'contacts' | 'contact-detail' = 'contacts';
  private currentContactId: string | null = null;
  private contacts: ContactGroup[] = [];
  private contactMessages: CapturedMessage[] = [];
  private searchQuery: string = '';
  private filterDate: 'all' | 'today' | 'week' | 'month' = 'all';
  private filterType: 'all' | 'received' | 'sent' = 'all';
  private sortBy: 'recent' | 'oldest' | 'most-messages' = 'recent';
  private orderListener: ChatOrderListener | null = null;

  constructor() {
    // Constructor vazio - render() será chamado externamente
  }

  /**
   * Renderiza o painel de histórico completo.
   */
  public async render(): Promise<HTMLElement> {
    const panel = document.createElement('div');
    panel.className = 'flex flex-col gap-4';
    this.container = panel;

    await this.loadContacts();
    this.renderContactsView();
    this.startOrderListener();

    return panel;
  }

  /**
   * Inicia escuta de eventos para atualizar ordem em tempo real.
   */
  private startOrderListener(): void {
    if (this.orderListener) {
      return; // Já está escutando
    }

    this.orderListener = new ChatOrderListener();

    // Callback para reordenar quando ordem do WhatsApp mudar
    this.orderListener.onOrderChange(async () => {
      // Apenas reordenar se estamos na view de contatos e sortBy é 'recent'
      if (this.currentView === 'contacts' && this.sortBy === 'recent') {
        // Reordenar contatos quando ordem do WhatsApp mudar
        await this.reorderContacts();
        this.renderContactsView();
      }
    });

    // Iniciar escuta (aguardar um pouco para garantir que WhatsApp está pronto)
    // Passar interceptors para o listener
    setTimeout(() => {
      this.orderListener?.start(5, whatsappInterceptors);
    }, 2000);
  }

  /**
   * Reordena contatos usando ordem atual do WhatsApp (sem recarregar do banco).
   */
  private async reorderContacts(): Promise<void> {
    try {
      // Obter ordem atual do WhatsApp
      const whatsappOrder = await this.getWhatsAppChatOrder();

      if (whatsappOrder.length > 0) {
        // Criar mapa de índice para ordenação rápida
        const orderMap = new Map<string, number>();
        whatsappOrder.forEach((chatId, index) => {
          orderMap.set(chatId, index);
        });

        // Reordenar contatos existentes pela ordem do WhatsApp
        this.contacts.sort((a, b) => {
          const orderA = orderMap.get(a.chatId) ?? Infinity;
          const orderB = orderMap.get(b.chatId) ?? Infinity;
          return orderA - orderB;
        });

        // Contatos reordenados
      }
    } catch (error) {
      console.error('Mettri: Erro ao reordenar contatos em tempo real:', error);
    }
  }

  /**
   * Obtém a ordem real dos chats do WhatsApp via Chat.getModelsArray().
   * 
   * IMPORTANTE: Segue padrão WA-Sync - usa getModelsArray() que já vem ordenado.
   * Não ordena manualmente - confia no WhatsApp (padrão WA-Sync).
   */
  private async getWhatsAppChatOrder(): Promise<string[]> {
    try {
      // Inicializar interceptors se ainda não estiverem inicializados
      if (!whatsappInterceptors.isWebpackAvailable()) {
        return []; // Fallback: sem ordem do WhatsApp
      }

      await whatsappInterceptors.initialize();
      const Chat = whatsappInterceptors.Chat;

      // Prioridade 1: getModelsArray() (já vem ordenado - padrão WA-Sync)
      // IMPORTANTE: Segue exatamente padrão WA-Sync - window.Store.Chat.getModelsArray()

      // Tentar window.Store.Chat diretamente primeiro (como WA-Sync faz)
      if (typeof window !== 'undefined' && (window as any).Store?.Chat) {
        const storeChat = (window as any).Store.Chat;
        if (typeof storeChat.getModelsArray === 'function') {
          try {
            const chats = await storeChat.getModelsArray();
            if (chats && Array.isArray(chats) && chats.length > 0) {
              // Extrair chatId: pode ser string direta ou objeto com _serialized
              const chatOrder = chats.map((chat: any) => {
                // Prioridade: id como string > id._serialized > id.toString()
                let id: string | null = null;
                if (typeof chat.id === 'string') {
                  id = chat.id;
                } else if (chat.id?._serialized) {
                  id = chat.id._serialized;
                } else if (chat.id?.toString && typeof chat.id.toString === 'function') {
                  id = chat.id.toString();
                }
                return id;
              }).filter(Boolean) as string[];

              console.log(`Mettri: ✅ Ordenados ${chatOrder.length} chats via window.Store.Chat.getModelsArray() (padrão WA-Sync)`);
              // console.log('[METTRI DEBUG] Primeiros 10 chatIds do WhatsApp:', chatOrder.slice(0, 10));
              return chatOrder;
            }
          } catch (error) {
            console.error('Mettri: Erro ao chamar window.Store.Chat.getModelsArray():', error);
          }
        }
      }

      // Fallback: usar Chat do interceptor
      if (Chat && typeof Chat.getModelsArray === 'function') {
        try {
          const chats = await Chat.getModelsArray();
          if (chats && Array.isArray(chats) && chats.length > 0) {
            // Extrair chatId: pode ser string direta ou objeto com _serialized
            const chatOrder = chats.map((chat: any) => {
              // Prioridade: id como string > id._serialized > id.toString()
              let id: string | null = null;
              if (typeof chat.id === 'string') {
                id = chat.id;
              } else if (chat.id?._serialized) {
                id = chat.id._serialized;
              } else if (chat.id?.toString && typeof chat.id.toString === 'function') {
                id = chat.id.toString();
              }
              return id;
            }).filter(Boolean) as string[];

            console.log(`Mettri: ✅ Ordenados ${chatOrder.length} chats via Chat.getModelsArray() (padrão WA-Sync)`);
            // Ordem obtida via Chat.getModelsArray()
            return chatOrder;
          }
        } catch (error) {
          console.error('Mettri: Erro ao chamar Chat.getModelsArray():', error);
        }
      }

      // Fallback: manter ordenação manual se não disponível
      const ChatCollection = whatsappInterceptors.ChatCollection;
      let chatModels: any[] = [];

      if (Chat && Chat._models && Array.isArray(Chat._models)) {
        chatModels = Chat._models;
      } else if (ChatCollection && ChatCollection._models && Array.isArray(ChatCollection._models)) {
        chatModels = ChatCollection._models;
      }
      // Nota: ChatCollection não tem método getAll() - é uma coleção, não uma função

      if (chatModels.length === 0) {
        return [];
      }

      // Fallback: Ordenar por timestamp - mais recente primeiro
      const sortedChats = chatModels
        .filter((chat: any) => {
          return (chat.t != null && chat.t > 0) ||
            (chat.conversationTimestamp != null && chat.conversationTimestamp > 0) ||
            (chat.lastMessage?.timestamp != null);
        })
        .sort((a: any, b: any) => {
          const timeA = a.t || a.conversationTimestamp || (a.lastMessage?.timestamp?.getTime?.() || a.lastMessage?.timestamp || 0);
          const timeB = b.t || b.conversationTimestamp || (b.lastMessage?.timestamp?.getTime?.() || b.lastMessage?.timestamp || 0);
          return timeB - timeA;
        });

      const chatOrder: string[] = [];
      for (const chat of sortedChats) {
        try {
          let chatId: string | null = null;

          if (chat.id?._serialized) {
            chatId = chat.id._serialized;
          } else if (chat.id?.toString) {
            chatId = chat.id.toString();
          } else if (typeof chat.id === 'string') {
            chatId = chat.id;
          } else if (chat._serialized) {
            chatId = chat._serialized;
          }

          if (chatId) {
            chatOrder.push(chatId);
          }
        } catch (error) {
          continue;
        }
      }

      console.log(`Mettri: Ordenados ${chatOrder.length} chats via fallback (ordenação manual)`);
      return chatOrder;
    } catch (error) {
      console.warn('Mettri: Erro ao obter ordem do WhatsApp, usando fallback:', error);
      return []; // Fallback: sem ordem do WhatsApp
    }
  }

  /**
   * Carrega lista de contatos do banco e ordena pela ordem real do WhatsApp.
   */
  private async loadContacts(): Promise<void> {
    try {
      const contactsMap = await messageDB.groupMessagesByContact();
      this.contacts = Array.from(contactsMap.values());

      // Log: chatIds do banco
      const bankChatIds = this.contacts.map(c => c.chatId);
      // console.log('[METTRI DEBUG] ChatIds do banco (primeiros 10):', bankChatIds.slice(0, 10));

      // Obter ordem real do WhatsApp
      const whatsappOrder = await this.getWhatsAppChatOrder();

      if (whatsappOrder.length > 0) {
        // Log: comparar chatIds
        const matchingChatIds = whatsappOrder.filter(id => bankChatIds.includes(id));
        const missingInBank = whatsappOrder.filter(id => !bankChatIds.includes(id));
        const missingInWhatsApp = bankChatIds.filter(id => !whatsappOrder.includes(id));

        // console.log('[METTRI DEBUG] Comparação de chatIds:', {
        //   totalWhatsApp: whatsappOrder.length,
        //   totalBanco: bankChatIds.length,
        //   matching: matchingChatIds.length,
        //   missingInBank: missingInBank.slice(0, 5),
        //   missingInWhatsApp: missingInWhatsApp.slice(0, 5),
        // });

        // Ordenar pela ordem do WhatsApp (1/1 igual ao feed real)
        // Criar mapa de índice para ordenação rápida
        const orderMap = new Map<string, number>();
        whatsappOrder.forEach((chatId, index) => {
          orderMap.set(chatId, index);
        });

        // Ordenar contatos pela ordem do WhatsApp
        this.contacts.sort((a, b) => {
          const orderA = orderMap.get(a.chatId) ?? Infinity; // Chats não encontrados vão para o final
          const orderB = orderMap.get(b.chatId) ?? Infinity;
          return orderA - orderB; // Ordem crescente (primeiro no WhatsApp = menor índice)
        });

        // Log: ordem final
        // console.log('[METTRI DEBUG] Ordem final dos contatos (primeiros 10):', this.contacts.slice(0, 10).map(c => c.chatId));
      } else {
        // Fallback: ordenar por timestamp se não conseguir ordem do WhatsApp
        // Ordem do WhatsApp não disponível, usando ordenação por timestamp
        this.contacts.sort((a, b) => {
          const timeA = a.lastMessageTime?.getTime() || 0;
          const timeB = b.lastMessageTime?.getTime() || 0;
          return timeB - timeA; // Mais recente primeiro
        });
      }

      // IMPORTANTE: Se temos ordem do WhatsApp E sortBy é 'recent', manter ordem do WhatsApp
      // Se sortBy é diferente de 'recent', aplicar ordenação customizada
      // Se não temos ordem do WhatsApp, sempre aplicar ordenação customizada
      if (whatsappOrder.length === 0 || this.sortBy !== 'recent') {
        this.sortContacts();
      } else {
        // console.log('[METTRI DEBUG] Mantendo ordem do WhatsApp (sortBy = recent)');
      }
    } catch (error) {
      console.error('Mettri: Erro ao carregar contatos:', error);
      this.contacts = [];
    }
  }

  /**
   * Ordena contatos conforme critério selecionado.
   * Por padrão, ordena por última mensagem (mais recente primeiro), igual ao WhatsApp.
   */
  private sortContacts(): void {
    // Sempre garantir que a ordenação seja estável e correta
    switch (this.sortBy) {
      case 'recent':
        // Ordenação padrão: última mensagem primeiro (igual WhatsApp)
        // Esta é a ordem padrão do WhatsApp - mais recente no topo
        this.contacts.sort((a, b) => {
          const timeA = a.lastMessageTime?.getTime() || 0;
          const timeB = b.lastMessageTime?.getTime() || 0;
          // Se timestamps são iguais, manter ordem original (estabilidade)
          if (timeA === timeB) return 0;
          return timeB - timeA; // Mais recente primeiro (ordem do WhatsApp)
        });
        break;
      case 'oldest':
        this.contacts.sort((a, b) => {
          const timeA = a.lastMessageTime?.getTime() || 0;
          const timeB = b.lastMessageTime?.getTime() || 0;
          if (timeA === timeB) return 0;
          return timeA - timeB; // Mais antigo primeiro
        });
        break;
      case 'most-messages':
        this.contacts.sort((a, b) => {
          const diff = b.messageCount - a.messageCount;
          // Se contagem é igual, ordenar por última mensagem (mais recente primeiro)
          if (diff === 0) {
            const timeA = a.lastMessageTime?.getTime() || 0;
            const timeB = b.lastMessageTime?.getTime() || 0;
            return timeB - timeA;
          }
          return diff;
        });
        break;
    }
  }

  /**
   * Filtra contatos conforme busca e filtros.
   */
  private getFilteredContacts(): ContactGroup[] {
    let filtered = [...this.contacts];

    // Busca por nome
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(contact =>
        contact.chatName.toLowerCase().includes(query) ||
        contact.chatId.toLowerCase().includes(query)
      );
    }

    // Filtro por data
    if (this.filterDate !== 'all') {
      const now = new Date();
      let cutoffDate: Date;

      switch (this.filterDate) {
        case 'today':
          cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffDate = new Date(0);
      }

      filtered = filtered.filter(contact => {
        if (!contact.lastMessageTime) return false;
        return contact.lastMessageTime >= cutoffDate;
      });
    }

    // IMPORTANTE: NÃO reordenar - manter ordem do WhatsApp já aplicada em loadContacts()
    // A ordem do WhatsApp (via getModelsArray()) já está correta e foi aplicada
    // Reordenar aqui quebraria a ordem 1/1 com o feed real
    return filtered;
  }

  /**
   * Renderiza a view de lista de contatos.
   */
  private renderContactsView(): void {
    if (!this.container) return;

    const filteredContacts = this.getFilteredContacts();

    this.container.innerHTML = `
      <!-- Search Bar -->
      <div class="relative">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input 
          type="text" 
          id="mettri-history-search-input" 
          placeholder="Buscar contato..." 
          class="pl-9 h-8 w-full text-xs rounded-xl bg-secondary/50 border-border/30 focus:border-primary/50 px-3"
          value="${this.escapeHtml(this.searchQuery)}"
        />
      </div>

      <!-- Filters -->
      <div class="flex gap-1.5">
        <button class="h-7 rounded-full text-[11px] flex-1 ${this.filterDate === 'all' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground hover:bg-secondary'}" data-filter="all">
          Todas
        </button>
        <button class="h-7 rounded-full text-[11px] flex-1 ${this.filterDate === 'today' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground hover:bg-secondary'}" data-filter="recent">
          Recentes
        </button>
      </div>

      <!-- Contacts List -->
      <div class="space-y-0.5" id="mettri-history-contacts-list">
        ${this.renderContactsList(filteredContacts)}
      </div>
    `;

    this.setupContactsListeners();
  }

  /**
   * Renderiza lista de contatos.
   */
  private renderContactsList(contacts: ContactGroup[]): string {
    if (contacts.length === 0) {
      return `
        <div class="text-center py-8 px-4">
          <p class="text-sm text-muted-foreground">Nenhum contato encontrado.</p>
          <p class="text-xs text-muted-foreground/60 mt-1">${this.searchQuery ? 'Tente outra busca.' : 'As conversas aparecerão aqui quando houver mensagens.'}</p>
        </div>
      `;
    }

    return contacts.map(contact => {
      // Remover emojis do preview
      let lastMessagePreview = contact.lastMessage
        ? this.truncateText(contact.lastMessage.text, 50)
        : '';

      // Remover emojis
      if (lastMessagePreview) {
        lastMessagePreview = lastMessagePreview.replace(/[\u{1F600}-\u{1F64F}]/gu, '').replace(/[\u{1F300}-\u{1F5FF}]/gu, '').replace(/[\u{1F680}-\u{1F6FF}]/gu, '').replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '').replace(/[\u{2600}-\u{26FF}]/gu, '').replace(/[\u{2700}-\u{27BF}]/gu, '').trim();
      }
      const timeAgo = contact.lastMessageTime
        ? this.formatTimeAgo(contact.lastMessageTime)
        : '';

      // Avatar: primeira letra do nome em maiúscula
      const avatarLetter = contact.chatName.charAt(0).toUpperCase();

      return `
        <div class="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-accent/50 cursor-pointer transition-all duration-200 group" data-chat-id="${this.escapeHtml(contact.chatId)}">
          <div class="w-9 h-9 rounded-full bg-primary/15 text-primary text-[10px] font-medium flex items-center justify-center ring-1 ring-border/20 flex-shrink-0">
            ${avatarLetter}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-medium text-foreground truncate">${this.escapeHtml(contact.chatName)}</span>
              <span class="text-[10px] text-muted-foreground shrink-0">${this.escapeHtml(timeAgo)}</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="text-[10px] text-muted-foreground">${contact.messageCount} msg</span>
            </div>
            ${lastMessagePreview ? `<p class="text-[10px] text-muted-foreground/60 truncate">${this.escapeHtml(lastMessagePreview)}</p>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Configura listeners da view de contatos.
   */
  private setupContactsListeners(): void {
    // Busca
    const searchInput = this.container?.querySelector('#mettri-history-search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = (e.target as HTMLInputElement).value;
        this.renderContactsView();
      });
    }

    // Filtros de data (botões pílula)
    const filterButtons = this.container?.querySelectorAll('.mettri-filter-btn');
    filterButtons?.forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.getAttribute('data-filter');
        if (filter === 'all') {
          this.filterDate = 'all';
        } else if (filter === 'recent') {
          this.filterDate = 'today'; // "Recentes" usa filtro de hoje
        }
        this.renderContactsView();
      });
    });

    // Clique em contato
    const contactCards = this.container?.querySelectorAll('.mettri-contact-card');
    contactCards?.forEach(card => {
      card.addEventListener('click', () => {
        const chatId = card.getAttribute('data-chat-id');
        if (chatId) {
          this.openContactDetail(chatId);
        }
      });
    });
  }

  /**
   * Abre view de detalhes do contato.
   */
  private async openContactDetail(chatId: string): Promise<void> {
    this.currentContactId = chatId;
    this.currentView = 'contact-detail';

    try {
      this.contactMessages = await messageDB.getContactMessages(chatId);
      this.renderContactDetailView();
    } catch (error) {
      console.error('Mettri: Erro ao carregar mensagens do contato:', error);
      this.contactMessages = [];
      this.renderContactDetailView();
    }
  }

  /**
   * Renderiza view de detalhes do contato.
   */
  private renderContactDetailView(): void {
    if (!this.container || !this.currentContactId) return;

    const contact = this.contacts.find(c => c.chatId === this.currentContactId);
    const contactName = contact?.chatName || this.currentContactId;

    // Filtrar mensagens por tipo se necessário
    let messages = [...this.contactMessages];
    if (this.filterType === 'received') {
      messages = messages.filter(m => !m.isOutgoing);
    } else if (this.filterType === 'sent') {
      messages = messages.filter(m => m.isOutgoing);
    }

    // Agrupar mensagens por data
    const groupedMessages = this.groupMessagesByDate(messages);

    this.container.innerHTML = `
      <div class="mettri-history-header">
        <button class="mettri-btn-back" id="mettri-history-back">← Voltar</button>
        <h2>${this.escapeHtml(contactName)}</h2>
      </div>
      <div class="mettri-history-actions">
        <button class="mettri-btn" id="mettri-history-export">Exportar para IA</button>
        <select id="mettri-history-filter-type" class="mettri-select">
          <option value="all" ${this.filterType === 'all' ? 'selected' : ''}>Todas</option>
          <option value="received" ${this.filterType === 'received' ? 'selected' : ''}>Só recebidas</option>
          <option value="sent" ${this.filterType === 'sent' ? 'selected' : ''}>Só enviadas</option>
        </select>
      </div>
      <div class="mettri-history-messages" id="mettri-history-messages-list">
        ${this.renderMessagesGrouped(groupedMessages)}
      </div>
    `;

    this.setupDetailListeners();
  }

  /**
   * Agrupa mensagens por data.
   */
  private groupMessagesByDate(messages: CapturedMessage[]): Map<string, CapturedMessage[]> {
    const grouped = new Map<string, CapturedMessage[]>();

    messages.forEach(message => {
      const dateKey = this.getDateKey(message.timestamp);
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(message);
    });

    // Ordenar mensagens dentro de cada grupo (mais recente primeiro)
    grouped.forEach((msgs, key) => {
      msgs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    });

    return grouped;
  }

  /**
   * Obtém chave de data para agrupamento (hoje, ontem, ou data específica).
   */
  private getDateKey(timestamp: Date): string {
    const now = new Date();
    const msgDate = new Date(timestamp);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDay = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate());

    if (msgDay.getTime() === today.getTime()) {
      return 'today';
    }

    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    if (msgDay.getTime() === yesterday.getTime()) {
      return 'yesterday';
    }

    return msgDay.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  /**
   * Renderiza mensagens agrupadas por data.
   */
  private renderMessagesGrouped(groupedMessages: Map<string, CapturedMessage[]>): string {
    if (groupedMessages.size === 0) {
      return `
        <div class="mettri-empty">
          <div class="mettri-empty-icon">💬</div>
          <p>Nenhuma mensagem encontrada.</p>
        </div>
      `;
    }

    const dateKeys = Array.from(groupedMessages.keys()).sort((a, b) => {
      // Ordenar: hoje primeiro, depois ontem, depois datas específicas (mais recente primeiro)
      if (a === 'today') return -1;
      if (b === 'today') return 1;
      if (a === 'yesterday') return -1;
      if (b === 'yesterday') return 1;
      return b.localeCompare(a); // Datas específicas: mais recente primeiro
    });

    return dateKeys.map(dateKey => {
      const messages = groupedMessages.get(dateKey)!;
      const dateLabel = this.getDateLabel(dateKey);

      return `
        <div class="mettri-messages-date-group">
          <div class="mettri-messages-date-header">${dateLabel}</div>
          ${messages.map(msg => this.renderMessage(msg)).join('')}
        </div>
      `;
    }).join('');
  }

  /**
   * Obtém label de data para exibição.
   */
  private getDateLabel(dateKey: string): string {
    if (dateKey === 'today') {
      return 'Hoje';
    }
    if (dateKey === 'yesterday') {
      return 'Ontem';
    }
    return dateKey;
  }

  /**
   * Renderiza uma mensagem individual.
   */
  private renderMessage(message: CapturedMessage): string {
    const time = message.timestamp.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const sender = message.isOutgoing ? 'Você' : this.escapeHtml(message.sender);
    const direction = message.isOutgoing ? 'outgoing' : 'incoming';

    return `
      <div class="mettri-history-message ${direction}">
        ${!message.isOutgoing ? `<div class="mettri-history-message-sender">${sender}</div>` : ''}
        <div class="mettri-history-message-text">${this.escapeHtml(message.text)}</div>
        <div class="mettri-history-message-time">${time}</div>
      </div>
    `;
  }

  /**
   * Configura listeners da view de detalhes.
   */
  private setupDetailListeners(): void {
    // Botão voltar
    const backBtn = this.container?.querySelector('#mettri-history-back');
    backBtn?.addEventListener('click', () => {
      this.currentView = 'contacts';
      this.currentContactId = null;
      this.renderContactsView();
    });

    // Filtro de tipo
    const filterType = this.container?.querySelector('#mettri-history-filter-type') as HTMLSelectElement;
    if (filterType) {
      filterType.addEventListener('change', (e) => {
        this.filterType = (e.target as HTMLSelectElement).value as typeof this.filterType;
        this.renderContactDetailView();
      });
    }

    // Exportar para IA
    const exportBtn = this.container?.querySelector('#mettri-history-export');
    exportBtn?.addEventListener('click', () => {
      this.exportToAI();
    });
  }

  /**
   * Exporta mensagens do contato para formato IA-friendly (JSON).
   */
  private async exportToAI(): Promise<void> {
    if (!this.currentContactId) return;

    try {
      const messages = await messageDB.getContactMessages(this.currentContactId);
      const contact = this.contacts.find(c => c.chatId === this.currentContactId);

      const exportData = {
        contact: {
          chatId: this.currentContactId,
          chatName: contact?.chatName || this.currentContactId,
          totalMessages: messages.length,
        },
        messages: messages.map(msg => ({
          id: msg.id,
          sender: msg.sender,
          text: msg.text,
          timestamp: msg.timestamp.toISOString(),
          isOutgoing: msg.isOutgoing,
          type: msg.type,
        })),
        exportedAt: new Date().toISOString(),
      };

      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mettri-export-${this.currentContactId}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Mettri: Erro ao exportar mensagens:', error);
      alert('Erro ao exportar mensagens. Verifique o console para mais detalhes.');
    }
  }

  /**
   * Formata tempo relativo (há X tempo).
   */
  private formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'agora';
    if (diffMins < 60) return `há ${diffMins} minuto${diffMins !== 1 ? 's' : ''}`;
    if (diffHours < 24) return `há ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
    if (diffDays < 7) return `há ${diffDays} dia${diffDays !== 1 ? 's' : ''}`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  /**
   * Trunca texto para preview.
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Escapa HTML para prevenir XSS.
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Atualiza lista de contatos (chamado quando nova mensagem é capturada).
   * Reordena automaticamente pela ordem do WhatsApp (1/1 igual ao feed real).
   * IMPORTANTE: Sempre recarrega do banco e reordena pela ordem atual do WhatsApp.
   */
  public async refresh(): Promise<void> {
    // Se estiver na view de contatos, recarregar e reordenar
    if (this.currentView === 'contacts') {
      await this.loadContacts();
      // loadContacts já ordena pela ordem do WhatsApp (1/1 igual ao feed real)
      this.renderContactsView();
    } else if (this.currentView === 'contact-detail' && this.currentContactId) {
      // Se estiver na view de detalhes, recarregar mensagens do contato atual
      await this.openContactDetail(this.currentContactId);
    }
  }

  /**
   * Limpa recursos quando o painel é destruído.
   */
  public destroy(): void {
    if (this.orderListener) {
      this.orderListener.stop();
      this.orderListener = null;
    }
  }
}
