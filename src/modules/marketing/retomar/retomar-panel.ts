/**
 * RetomarPanel
 *
 * Painel de retomada de clientes inativos (Marketing > Retomar).
 * - Régua de cadência (dias inativos: 21, 35, 56, 84).
 * - Modo dia: clientes elegíveis por dia; modo etiqueta: membros de Bloqueados/CNPJ ou listas customizadas.
 * - Etiquetas: adicionar/remover/mover clientes; listas padrão (Bloqueados, CNPJ) editáveis.
 * - Geração de mensagens, Simular envio e envio em massa.
 */

import { messageDB } from '../../../storage/message-db';
import { clientDB, digitsOnly, normalizePhoneDigitsWithAliases } from '../../../storage/client-db';
import { daysBetweenByCalendar } from './inactive-days';
import { classifyNameCandidate } from '../../clientes/name-likelihood';
import { MettriBridgeClient } from '../../../content/bridge-client';
import { sendMessageService } from '../../../infrastructure/services';
import { RateLimiter } from './rate-limiter';
import { RetomarListsManager, type RetomarList } from './retomar-lists';

interface InactiveClient {
  chatId: string;
  chatName: string;
  phone: string;
  lastMessageTime: Date;
  daysInactive: number;
  cadenceDay: number;
  status: 'pending' | 'sent' | 'responded' | 'blocked' | 'skipped-today' | 'excluded';
  generatedMessage?: string;
  firstName?: string; // Primeiro nome formatado
  isSpecialList?: boolean; // CNPJ ou lista especial
  listIds?: string[]; // IDs das listas que contêm este cliente
  isTestContact?: boolean; // Contato de Simular envio
}

interface LogEntry {
  timestamp: Date;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

/** Nomes de exibição para etiquetas padrão (compatibilidade com listas já criadas). */
const ETIQUETA_DISPLAY_NAMES: Record<string, string> = {
  'never-send': 'Bloqueados',
  'exclusivos': 'CNPJ',
};

export class RetomarPanel {
  private container: HTMLElement | null = null;
  private cadenceDays: number[] = [21, 35, 56, 84];
  private eligibleClients: InactiveClient[] = [];
  /** Cache de clientes por chatId para preservar nomes entre modos (evita alteração ao alternar). */
  private clientsCache: Map<string, InactiveClient> = new Map();
  private selectedClients: Set<string> = new Set();
  private selectedInactiveDay: number | null = null;
  private logs: LogEntry[] = [];
  private stats = {
    totalEligible: 0,
    selected: 0,
    sentToday: 0,
    responseRate: 0,
  };

  // Propriedades para novo design
  private totalContacts: number = 0;
  private eligibleCount: number = 0;
  private periodFilters: Array<{
    range: string;
    count: number;
    selected: boolean;
    variant: 'outline' | 'filled';
  }> = [];
  private isFiltersExpanded: boolean = true;
  private isContactsExpanded: boolean = true;
  private openMenuId: string | null = null;
  private messageText: string = "";
  private closeMenusHandler: ((e: MouseEvent) => void) | null = null;
  private closeDropdownHandler: ((e: MouseEvent) => void) | null = null;
  private repositionDropdownHandler: (() => void) | null = null;

  private testContact: { phone: string; name: string } | null = null;
  private testModeEnabled: boolean = false;
  private bridge = new MettriBridgeClient(2500);
  private sendButtonClickHandler: ((e: MouseEvent) => void) | null = null;

  // Rate limiting e controle de envio
  private rateLimiter = new RateLimiter();
  private isPaused = false;
  private isSending = false;
  private sendingQueue: string[] = [];
  private backgroundIntervalId: number | null = null;
  private readonly STORAGE_KEY_QUEUE = 'retomarSendingQueue';
  private readonly STORAGE_KEY_PAUSED = 'retomarIsPaused';

  // Sistema de listas
  private listsManager: RetomarListsManager | null = null;
  private lists: RetomarList[] = [];
  private listsExpanded: boolean = false;
  private creatingList: boolean = false;
  private listMenuOpenId: string | null = null;
  /** Modo etiqueta: id da lista selecionada (Bloqueados/CNPJ) ou null = modo dia. */
  private selectedListId: string | null = null;
  /** Clientes da etiqueta selecionada (quando selectedListId !== null). */
  private labelModeClients: InactiveClient[] = [];
  private readonly SHOW_CREATE_LIST = true; // + e Nova lista visíveis

  // UI de progresso
  private sendingProgress = {
    total: 0,
    sent: 0,
    skipped: 0,
    errors: 0,
    current: null as string | null, // Nome do cliente atual
    startTime: null as number | null,
  };

  constructor() {
    // Constructor vazio - render() será chamado externamente
  }

  /**
   * Renderiza o painel de retomada completo.
   * Reseta estado ao renderizar para garantir sincronização.
   */
  public async render(): Promise<HTMLElement> {
    const panel = document.createElement('div');
    panel.className = 'flex flex-col gap-4 min-w-0 overflow-x-hidden overflow-y-visible';
    this.container = panel;

    // Resetar estado ao renderizar novamente
    this.selectedListId = null;
    this.labelModeClients = [];
    this.openMenuId = null;
    this.listMenuOpenId = null;

    try {
      await this.loadConfig();
      await this.loadInactiveClients();
      // Inicializar dia selecionado com o primeiro da régua
      if (!this.selectedInactiveDay) {
        this.selectedInactiveDay = this.cadenceDays[0] || 21;
      }
      this.renderContent();
      // Atualizar stats após renderizar
      this.updateStats();
    } catch (error) {
      console.error('[RETOMAR] Erro ao renderizar painel:', error);
      panel.innerHTML = `
        <div class="mettri-error">
          <p>Erro ao carregar painel de retomada.</p>
          <p>Verifique o console para mais detalhes.</p>
          <pre>${error instanceof Error ? error.message : String(error)}</pre>
        </div>
      `;
    }

    return panel;
  }

  /**
   * Obtém o accountId atual (WID do usuário) para isolar listas por conta.
   */
  private async getAccountId(): Promise<string> {
    try {
      // Tentar obter do storage (mesma chave usada por UserSessionManager)
      const result = await this.bridge.storageGet(['mettri_current_user_wid']);
      const wid = result.mettri_current_user_wid as string | undefined;
      if (wid && typeof wid === 'string') {
        // Sanitizar WID para usar como chave (remover caracteres especiais)
        return wid.replace(/[^a-zA-Z0-9]/g, '_');
      }
    } catch (error) {
      console.error('[RETOMAR] Erro ao obter accountId:', error);
    }
    // Fallback: usar 'default' se não conseguir obter WID
    return 'default';
  }

  /**
   * Carrega configuração da régua via bridge (chrome.storage não disponível em world: MAIN).
   */
  private async loadConfig(): Promise<void> {
    try {
      const result = await this.bridge.storageGet([
        'retomarCadence',
        'retomarTestContact',
        'retomarTestModeEnabled',
      ]);

      if (result.retomarCadence && Array.isArray(result.retomarCadence)) {
        this.cadenceDays = result.retomarCadence;
      }

      if (result.retomarTestContact && typeof result.retomarTestContact === 'object') {
        const t = result.retomarTestContact as { phone?: string; name?: string };
        if (typeof t.phone === 'string' && typeof t.name === 'string') {
          this.testContact = { phone: t.phone, name: t.name };
        }
      }

      if (typeof result.retomarTestModeEnabled === 'boolean') {
        this.testModeEnabled = result.retomarTestModeEnabled;
      }

      // Inicializar gerenciador de listas
      const accountId = await this.getAccountId();
      this.listsManager = new RetomarListsManager(accountId);
      await this.listsManager.initialize();
      this.lists = this.listsManager.getLists();

      // Carregar estado de envio em background
      const queueResult = await this.bridge.storageGet([
        this.STORAGE_KEY_QUEUE,
        this.STORAGE_KEY_PAUSED,
      ]);

      if (queueResult[this.STORAGE_KEY_QUEUE] && Array.isArray(queueResult[this.STORAGE_KEY_QUEUE])) {
        this.sendingQueue = queueResult[this.STORAGE_KEY_QUEUE] as string[];
      }

      if (typeof queueResult[this.STORAGE_KEY_PAUSED] === 'boolean') {
        this.isPaused = queueResult[this.STORAGE_KEY_PAUSED];
      }

      // Se há fila pendente, iniciar processamento em background
      if (this.sendingQueue.length > 0 && !this.isPaused) {
        this.startBackgroundProcessing();
      }
    } catch (error) {
      console.error('[RETOMAR] Erro ao carregar configuração:', error);
      // Não chamar addLog aqui pois o container ainda não foi renderizado
    }
  }

  /**
   * Salva configuração da régua via bridge (chrome.storage não disponível em world: MAIN).
   */
  private async saveConfig(): Promise<void> {
    try {
      await this.bridge.storageSet({
        retomarCadence: this.cadenceDays,
        retomarTestContact: this.testContact,
        retomarTestModeEnabled: this.testModeEnabled,
      });
      if (this.container) {
        this.addLog('success', 'Configuração salva com sucesso');
      }
    } catch (error) {
      console.error('[RETOMAR] Erro ao salvar configuração:', error);
      if (this.container) {
        this.addLog('error', 'Erro ao salvar configuração');
      }
    }
  }

  /**
   * Carrega clientes inativos (REAL via IndexedDB).
   *
   * Regra atual (simples):
   * - última atividade = última mensagem RECEBIDA (incoming)
   * - elegível quando daysInactive é exatamente um valor da régua (21/35/56/84)
   * - clientes em etiquetas são filtrados (não aparecem no modo dia)
   * - cache de clientes preserva nomes originais para evitar alteração ao alternar modos
   */
  private async loadInactiveClients(): Promise<void> {
    const now = new Date();

    const lastIncomingByContact = await messageDB.getLastIncomingByContact();

    // Métrica simples (contatos que têm ao menos 1 mensagem recebida)
    this.totalContacts = lastIncomingByContact.size;

    let clients: InactiveClient[] = [];

    // Resolver nome via ClientDB (fonte forte) + fallback WhatsApp com “peneira”
    for (const value of lastIncomingByContact.values()) {
      const daysInactive = daysBetweenByCalendar(now, value.lastIncomingAt);
      if (!this.cadenceDays.includes(daysInactive)) continue;

      const rawBeforeAt = value.chatId.split('@')[0] || '';
      const phone = rawBeforeAt.replace(/\D+/g, '');
      let firstName = '';

      // 1) Fonte forte: cadastro
      try {
        // Tentar bater com/sem 55 e com/sem 9.
        const normalized = normalizePhoneDigitsWithAliases(phone);
        const candidates = Array.from(new Set([normalized.phoneDigits, ...normalized.aliasesDigits].filter(Boolean)));

        let record = null as any;
        for (const d of candidates) {
          record = (await clientDB.getByPhoneDigits(d)) || (await clientDB.getByKey(d));
          if (record) break;
        }

        const candidate = (record?.firstName || record?.fullName || record?.nickname || '').trim();
        if (candidate) {
          const classified = classifyNameCandidate(candidate);
          firstName = classified.kind === 'person' ? this.extractFirstName(classified.firstName) : '';
        }
      } catch {
        // ignore
      }

      // 2) Fonte fraca: WhatsApp (com peneira)
      if (!firstName) {
        const classified = classifyNameCandidate(value.chatName);
        if (classified.kind === 'person') {
          firstName = this.extractFirstName(classified.firstName);
        } else {
          firstName = ''; // empresa/ruído -> não usar nome
        }
      }

      const client: InactiveClient = {
        chatId: value.chatId,
        chatName: value.chatName,
        phone,
        lastMessageTime: value.lastIncomingAt,
        daysInactive,
        cadenceDay: daysInactive, // semântica: dia exato
        status: 'pending',
        firstName,
      };
      clients.push(client);
      // Cache: preservar nome original para evitar alteração ao alternar modos
      this.clientsCache.set(value.chatId, { ...client });
    }

    // Filtrar clientes que estão em listas
    clients = this.filterClientsInLists(clients);

    // Ordenar por mais “frios” primeiro (opcional, mas útil)
    clients.sort((a, b) => b.daysInactive - a.daysInactive);

    this.eligibleClients = clients;

    // Default de seleção de dia
    if (!this.selectedInactiveDay) {
      this.selectedInactiveDay = this.cadenceDays[0] || 21;
    }

    this.eligibleCount = this.eligibleClients.filter(c => c.status === 'pending' && !c.isSpecialList).length;
    this.calculatePeriodFilters();
    // Por padrão já vêm selecionados: todos do dia ativo entram no envio
    const day = this.selectedInactiveDay ?? this.cadenceDays[0] ?? 21;
    this.eligibleClients
      .filter(c => c.daysInactive === day && c.status === 'pending' && !c.isSpecialList)
      .forEach(c => this.selectedClients.add(c.chatId));
    this.updateStats();
  }

  /**
   * Busca clientes a partir dos membros de uma lista (modo etiqueta).
   * Preserva nome original do cache quando disponível para evitar alteração ao alternar modos.
   */
  private async getClientsFromListMembers(listId: string): Promise<InactiveClient[]> {
    if (!this.listsManager) return [];
    const chatIds = this.listsManager.getMembers(listId);
    const result: InactiveClient[] = [];
    const now = new Date();
    for (const chatId of chatIds) {
      // Tentar usar cache primeiro para preservar nome original
      const cached = this.clientsCache.get(chatId);
      if (cached) {
        result.push({
          ...cached,
          listIds: [listId],
          daysInactive: 0, // Modo etiqueta não usa dias
          cadenceDay: 0,
        });
        continue;
      }
      
      // Fallback: buscar do ClientDB se não estiver no cache
      const rawBeforeAt = chatId.split('@')[0] || '';
      const phone = rawBeforeAt.replace(/\D+/g, '');
      let chatName = phone || chatId;
      let firstName = '';
      try {
        const record = await clientDB.getByWhatsAppChatId(chatId);
        if (record) {
          const candidate = (record.firstName || record.fullName || record.nickname || '').trim();
          if (candidate) {
            const classified = classifyNameCandidate(candidate);
            firstName = classified.kind === 'person' ? this.extractFirstName(classified.firstName) : '';
          }
          chatName = (record.fullName || record.nickname || record.firstName || chatName).trim() || chatName;
        }
      } catch {
        // ignore
      }
      const client: InactiveClient = {
        chatId,
        chatName,
        phone,
        lastMessageTime: now,
        daysInactive: 0,
        cadenceDay: 0,
        status: 'pending',
        firstName: firstName || undefined,
        listIds: [listId],
      };
      result.push(client);
      // Atualizar cache
      this.clientsCache.set(chatId, { ...client });
    }
    return result;
  }

  /**
   * Filtra clientes que estão em listas (modo dia).
   * Regra: clientes em qualquer etiqueta não aparecem no modo dia, apenas quando a etiqueta é selecionada.
   * Adiciona listIds a cada cliente para referência futura.
   */
  private filterClientsInLists(clients: InactiveClient[]): InactiveClient[] {
    if (!this.listsManager) return clients;

    const clientsInLists = new Set<string>();
    for (const list of this.lists) {
      const members = this.listsManager.getMembers(list.id);
      members.forEach(chatId => clientsInLists.add(chatId));
    }

    // Aplicar filtro: se cliente está em lista, não aparece no modo dia
    const filtered = clients.filter(client => {
      if (clientsInLists.has(client.chatId)) {
        // Cliente em lista: não aparece nos filtros de dias (só aparece quando etiqueta é selecionada)
        return false;
      }
      // Cliente não está em lista: aplica filtro de dias normalmente
      return true;
    });

    // Adicionar listIds a cada cliente para exibição (mesmo que filtrado, mantém referência)
    filtered.forEach(client => {
      client.listIds = this.listsManager!.getListsForClient(client.chatId);
    });

    return filtered;
  }

  /**
   * Converte telefone para chatId (formato WhatsApp: 5511999999999@c.us).
   */
  private phoneToChatId(phone: string): string {
    const d = digitsOnly(phone);
    if (!d) return '';
    let digits = d;
    if ((d.length === 10 || d.length === 11) && !d.startsWith('55')) {
      digits = '55' + d;
    }
    return `${digits}@c.us`;
  }


  /**
   * Atualiza estatísticas e visão geral.
   */
  private updateStats(): void {
    this.stats.totalEligible = this.eligibleClients.length;
    this.stats.selected = this.selectedClients.size;

    // MOCK: Calcular estatísticas dos dados mock
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Contar mensagens enviadas hoje (mock: baseado em status 'sent')
    this.stats.sentToday = this.eligibleClients.filter(c => c.status === 'sent').length;

    // Calcular taxa de resposta (mock: baseado em status 'responded')
    const respondedCount = this.eligibleClients.filter(c => c.status === 'responded').length;
    const sentCount = this.eligibleClients.filter(c => c.status === 'sent' || c.status === 'responded').length;
    this.stats.responseRate = sentCount > 0 ? Math.round((respondedCount / sentCount) * 100) : 0;

    // TODO: Implementar contagem real de mensagens enviadas hoje (buscar no IndexedDB)
    // TODO: Implementar cálculo real de taxa de resposta (buscar histórico de envios/respostas)

    // Atualizar fluxo unificado
    this.updateUnifiedFlow();
  }

  /**
   * Atualiza seção unificada de inativos (mantido para compatibilidade).
   */
  public updateUnifiedInactive(): void {
    this.updateUnifiedFlow();
  }

  /**
   * Atualiza o fluxo unificado completo (inativos + régua + lista + ações).
   */
  private updateUnifiedFlow(): void {
    if (!this.container) return;

    // Usar seletor mais específico para evitar conflitos
    const unifiedContainer = this.container.querySelector('.mettri-retomar-unified-flow') ||
      this.container.querySelector('.flex.flex-col.gap-4');
    if (unifiedContainer) {
      unifiedContainer.innerHTML = this.renderUnifiedFlow();
      // Reconfigurar listeners após atualizar HTML
      this.setupUnifiedFlowListeners();
      // Posicionar dropdowns abertos usando position: fixed
      this.positionKebabDropdowns();
      this.positionListMenus();
    }
  }

  /**
   * Posiciona dropdowns do kebab menu usando position: fixed para evitar scroll.
   */
  private positionKebabDropdowns(): void {
    if (!this.openMenuId || !this.container) return;

    const kebabButton = this.container.querySelector(`[data-kebab-menu="${this.openMenuId}"]`) as HTMLElement;
    const dropdown = this.container.querySelector(`[data-kebab-dropdown="${this.openMenuId}"]`) as HTMLElement;

    if (kebabButton && dropdown) {
      const buttonRect = kebabButton.getBoundingClientRect();
      
      // Calcular posição fixa relativa à viewport
      const top = buttonRect.bottom + 4; // mt-1 = 4px
      const right = window.innerWidth - buttonRect.right;
      
      dropdown.style.position = 'fixed';
      dropdown.style.top = `${top}px`;
      dropdown.style.right = `${right}px`;
      dropdown.style.left = 'auto';
      dropdown.style.bottom = 'auto';
      dropdown.style.margin = '0';
      dropdown.style.zIndex = '9999';
    }
  }

  /**
   * Posiciona menus de lista (etiquetas) usando position: fixed para evitar scroll.
   */
  private positionListMenus(): void {
    if (!this.listMenuOpenId || !this.container) return;

    const listMenuButton = this.container.querySelector(`[data-list-menu="${this.listMenuOpenId}"]`) as HTMLElement;
    const dropdown = this.container.querySelector(`[data-list-menu-dropdown="${this.listMenuOpenId}"]`) as HTMLElement;

    if (listMenuButton && dropdown) {
      const buttonRect = listMenuButton.getBoundingClientRect();
      
      // Calcular posição fixa relativa à viewport
      const top = buttonRect.bottom + 4; // mt-1 = 4px
      const right = window.innerWidth - buttonRect.right;
      
      dropdown.style.position = 'fixed';
      dropdown.style.top = `${top}px`;
      dropdown.style.right = `${right}px`;
      dropdown.style.left = 'auto';
      dropdown.style.bottom = 'auto';
      dropdown.style.margin = '0';
      dropdown.style.zIndex = '9999';
    }
  }

  /**
   * Configura listeners do fluxo unificado completo.
   */
  private setupUnifiedFlowListeners(): void {
    this.setupPeriodFiltersListeners();
    this.setupContactsListeners();
    this.setupMessageInputListeners();
    this.setupHeaderActionsListeners();
    this.setupTestSectionListeners();
    this.setupSendButtonListener();
    this.setupListsListeners();
  }

  /**
   * Configura listener do botão de enviar.
   */
  private setupSendButtonListener(): void {
    const sendBtn = this.container?.querySelector('#retomar-send-selected');
    sendBtn?.addEventListener('click', async () => {
      if (sendBtn.hasAttribute('disabled')) return;

      const btn = sendBtn as HTMLButtonElement;
      btn.disabled = true;
      try {
        await this.sendSelectedClients();
      } catch (error) {
        this.addLog('error', `Erro ao enviar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      } finally {
        btn.disabled = false;
      }
    });

    const pauseBtn = this.container?.querySelector('#retomar-pause-resume');
    pauseBtn?.addEventListener('click', () => {
      if (this.isPaused) {
        this.resumeSending();
      } else {
        this.pauseSending();
      }
    });
  }

  /**
   * Configura listeners da seção de listas.
   */
  private setupListsListeners(): void {
    // Toggle expandir/colapsar listas (título/área do header)
    const listsToggle = this.container?.querySelector('[data-lists-toggle]');
    listsToggle?.addEventListener('click', () => {
      this.listsExpanded = !this.listsExpanded;
      this.updateUnifiedFlow();
    });

    /**
     * Clique no chip da etiqueta: alternar entre modo dia e modo etiqueta.
     * - Clicar na mesma etiqueta novamente volta ao modo dia.
     * - Modo etiqueta: carrega membros da etiqueta selecionada.
     * - Modo dia: recarrega clientes elegíveis para garantir sincronização.
     */
    const listChips = this.container?.querySelectorAll('[data-list-select]');
    listChips?.forEach((el) => {
      el.addEventListener('click', async (e) => {
        // Não alternar se clicar no kebab menu (⋯)
        if ((e.target as HTMLElement).closest('[data-list-menu]')) return;
        const listId = (el as HTMLElement).dataset.listSelect ?? null;
        if (!listId) return;
        const next = this.selectedListId === listId ? null : listId;
        this.selectedListId = next;
        if (this.selectedListId && this.listsManager) {
          // Modo etiqueta: carregar membros da etiqueta
          this.labelModeClients = await this.getClientsFromListMembers(this.selectedListId);
        } else {
          // Modo dia: limpar lista de etiqueta e garantir que eligibleClients está atualizado
          this.labelModeClients = [];
          await this.loadInactiveClients();
        }
        this.updateUnifiedFlow();
      });
    });

    // Criar nova lista (header + botão "Nova lista" — ambos abrem o mesmo diálogo)
    const createListBtns = this.container?.querySelectorAll('[data-create-list]');
    createListBtns?.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.showCreateListDialog();
      });
    });

    // Menu de lista (kebab)
    const listMenuButtons = this.container?.querySelectorAll('[data-list-menu]');
    listMenuButtons?.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const listId = (btn as HTMLElement).dataset.listMenu;
        if (listId) {
          // Toggle menu
          if (this.listMenuOpenId === listId) {
            this.listMenuOpenId = null;
          } else {
            this.listMenuOpenId = listId;
          }
          this.updateUnifiedFlow();
          // Aguardar próximo frame para garantir que o DOM foi atualizado
          requestAnimationFrame(() => {
            this.positionListMenus();
          });
        }
      });
    });

    // Ações do menu de lista
    const viewMembersBtn = this.container?.querySelector('[data-list-action="view-members"]');
    viewMembersBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const listId = (e.currentTarget as HTMLElement).dataset.listId;
      if (listId && this.listsManager) {
        const members = this.listsManager.getMembers(listId);
        const list = this.lists.find(l => l.id === listId);
        alert(`${list?.name || 'Lista'}: ${members.length} membro(s)`);
        this.listMenuOpenId = null;
        this.updateUnifiedFlow();
      }
    });

    const renameBtn = this.container?.querySelector('[data-list-action="rename"]');
    renameBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const listId = (e.currentTarget as HTMLElement).dataset.listId;
      if (listId) {
        const list = this.lists.find(l => l.id === listId);
        const newName = prompt('Novo nome da lista:', list?.name || '');
        if (newName && newName.trim() && this.listsManager) {
          try {
            await this.listsManager.renameList(listId, newName.trim());
            this.lists = this.listsManager.getLists();
            this.addLog('success', `Lista renomeada: ${newName.trim()}`);
            this.updateUnifiedFlow();
          } catch (error) {
            this.addLog('error', error instanceof Error ? error.message : 'Erro ao renomear lista');
          }
        }
        this.listMenuOpenId = null;
        this.updateUnifiedFlow();
      }
    });

    const deleteBtn = this.container?.querySelector('[data-list-action="delete"]');
    deleteBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const listId = (e.currentTarget as HTMLElement).dataset.listId;
      if (listId && this.listsManager) {
        const list = this.lists.find(l => l.id === listId);
        if (!list) return;
        
        const memberCount = list.memberCount || 0;
        const memberText = memberCount === 1 ? '1 pessoa' : `${memberCount} pessoas`;
        const message = memberCount > 0
          ? `Tem certeza que deseja excluir a etiqueta "${list.name}"?\n\nOs ${memberText} nesta etiqueta voltarão ao estado normal (não serão deletados, apenas removidos desta etiqueta).`
          : `Tem certeza que deseja excluir a etiqueta "${list.name}"?`;
        
        if (confirm(message)) {
          try {
            await this.listsManager.deleteList(listId);
            this.lists = this.listsManager.getLists();
            // Se estava visualizando esta etiqueta, voltar ao modo dia
            if (this.selectedListId === listId) {
              this.selectedListId = null;
              this.labelModeClients = [];
            }
            // Recarregar clientes elegíveis para que membros removidos apareçam em Pessoas
            await this.loadInactiveClients();
            this.addLog('success', `Etiqueta "${list.name}" excluída. ${memberCount > 0 ? `${memberText} removida(s) da etiqueta.` : ''}`);
            this.updateUnifiedFlow();
          } catch (error) {
            this.addLog('error', error instanceof Error ? error.message : 'Erro ao excluir etiqueta');
          }
        }
        this.listMenuOpenId = null;
        this.updateUnifiedFlow();
      }
    });

    // Fechar menu ao clicar fora
    document.addEventListener('click', (e) => {
      if (this.listMenuOpenId && !(e.target as HTMLElement).closest('[data-list-menu]') && !(e.target as HTMLElement).closest('[data-list-menu-dropdown]')) {
        this.listMenuOpenId = null;
        this.updateUnifiedFlow();
      }
    });
  }

  /**
   * Mostra diálogo para criar nova lista.
   */
  private async showCreateListDialog(): Promise<void> {
    const name = prompt('Nome da lista:');
    if (!name || !name.trim()) return;

    // Cores disponíveis (8 opções)
    const colors = [
      { var: '--tag-color-1', name: 'Verde' },
      { var: '--tag-color-2', name: 'Azul' },
      { var: '--tag-color-3', name: 'Roxo' },
      { var: '--tag-color-4', name: 'Amarelo' },
      { var: '--tag-color-5', name: 'Laranja' },
      { var: '--tag-color-6', name: 'Vermelho' },
      { var: '--tag-color-7', name: 'Índigo' },
      { var: '--tag-color-8', name: 'Verde-água' },
    ];

    const colorChoice = prompt(`Escolha uma cor (1-8):\n${colors.map((c, i) => `${i + 1}. ${c.name}`).join('\n')}`);
    const colorIndex = parseInt(colorChoice || '1', 10) - 1;
    const selectedColor = colors[colorIndex >= 0 && colorIndex < colors.length ? colorIndex : 0];

    if (this.listsManager) {
      try {
        await this.listsManager.createList(name.trim(), selectedColor.var);
        this.lists = this.listsManager.getLists();
        this.addLog('success', `Lista criada: ${name.trim()}`);
        this.updateUnifiedFlow();
      } catch (error) {
        this.addLog('error', error instanceof Error ? error.message : 'Erro ao criar lista');
      }
    }
  }

  /**
   * Configura listeners da seção de envio de teste.
   */
  private setupTestSectionListeners(): void {
    const checkbox = this.container?.querySelector('#retomar-test-mode') as HTMLInputElement;
    checkbox?.addEventListener('change', () => {
      this.testModeEnabled = !!checkbox.checked;
      this.saveConfig();
      this.updateUnifiedFlow();
    });

    // Salvar automaticamente ao digitar nos campos de teste
    const phoneInput = this.container?.querySelector('#retomar-test-phone') as HTMLInputElement;
    phoneInput?.addEventListener('blur', () => {
      const phone = phoneInput?.value?.trim() ?? '';
      const nameInput = this.container?.querySelector('#retomar-test-name') as HTMLInputElement;
      const name = nameInput?.value?.trim() ?? '';
      const digits = digitsOnly(phone);
      if (digits.length >= 10) {
        this.testContact = { phone, name };
        this.saveConfig();
        this.updateUnifiedFlow();
      }
    });

    const nameInput = this.container?.querySelector('#retomar-test-name') as HTMLInputElement;
    nameInput?.addEventListener('blur', () => {
      const phoneInput = this.container?.querySelector('#retomar-test-phone') as HTMLInputElement;
      const phone = phoneInput?.value?.trim() ?? '';
      const name = nameInput?.value?.trim() ?? '';
      const digits = digitsOnly(phone);
      if (digits.length >= 10) {
        this.testContact = { phone, name };
        this.saveConfig();
        this.updateUnifiedFlow();
      }
    });
  }

  /**
   * Configura listeners dos filtros de período (Última interação há…).
   */
  private setupPeriodFiltersListeners(): void {
    const periodButtons = this.container?.querySelectorAll('[data-period-range]');
    periodButtons?.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const range = (e.currentTarget as HTMLElement).dataset.periodRange;
        if (range) {
          this.togglePeriodFilter(range);
        }
      });
    });
  }

  /**
   * Alterna seleção de um período (Última interação há…).
   * Limpa modo etiqueta e faz toggle: se todos do dia estão selecionados, desmarca todos; senão, marca todos.
   * Não chama loadInactiveClients() aqui para não alterar selectedClients e quebrar o toggle.
   */
  private togglePeriodFilter(range: string): void {
    const day = parseInt(range, 10);
    if (!Number.isFinite(day)) return;

    // Modo dia: limpar seleção de etiqueta
    this.selectedListId = null;
    this.labelModeClients = [];
    this.selectedInactiveDay = day;

    // Encontrar clientes exatamente nesse dia
    const clientsInRange = this.eligibleClients.filter(c =>
      c.daysInactive === day &&
      c.status === 'pending' &&
      !c.isSpecialList
    );

    // Verificar se todos estão selecionados
    const allSelected = clientsInRange.every(c => this.selectedClients.has(c.chatId));

    // Toggle: se todos selecionados, deselecionar; senão, selecionar todos
    clientsInRange.forEach(client => {
      if (allSelected) {
        this.selectedClients.delete(client.chatId);
      } else {
        this.selectedClients.add(client.chatId);
      }
    });

    this.calculatePeriodFilters();
    this.updateUnifiedFlow();
    this.addLog('info', `${allSelected ? 'Deselecionados' : 'Selecionados'} ${clientsInRange.length} cliente(s) do dia ${day}`);
  }

  /**
   * Configura listeners da lista de contatos.
   */
  private setupContactsListeners(): void {
    // Checkboxes de contatos
    const checkboxes = this.container?.querySelectorAll('#retomar-contacts-list input[type="checkbox"]');
    checkboxes?.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const chatId = (e.target as HTMLInputElement).dataset.chatId;
        const checked = (e.target as HTMLInputElement).checked;
        if (chatId) {
          if (checked) {
            this.selectedClients.add(chatId);
          } else {
            this.selectedClients.delete(chatId);
          }
          this.calculatePeriodFilters();
          this.updateUnifiedFlow();
        }
      });
    });

    // Permitir clicar no item do contato para toggle (exceto kebab menu)
    const contactItems = this.container?.querySelectorAll('#retomar-contacts-list [data-chat-id]');
    contactItems?.forEach(item => {
      item.addEventListener('click', (e) => {
        // Não toggle se clicar no kebab menu
        if ((e.target as HTMLElement).closest('[data-kebab-menu]') || (e.target as HTMLElement).closest('[data-kebab-dropdown]')) {
          return;
        }
        const chatId = (item as HTMLElement).dataset.chatId;
        if (chatId) {
          const checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement;
          if (checkbox) {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
          }
        }
      });
    });

    // Kebab menus
    const kebabButtons = this.container?.querySelectorAll('[data-kebab-menu]');
    kebabButtons?.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const chatId = (btn as HTMLElement).dataset.kebabMenu;
        if (chatId) {
          // Toggle menu: se já está aberto, fecha; senão, abre
          if (this.openMenuId === chatId) {
            this.openMenuId = null;
          } else {
            this.openMenuId = chatId;
          }
          this.updateUnifiedFlow();
          // Aguardar próximo frame para garantir que o DOM foi atualizado
          requestAnimationFrame(() => {
            this.positionKebabDropdowns();
            this.positionListMenus();
          });
        }
      });
    });

    /**
     * Ações do kebab menu (modo dia) — adicionar cliente a qualquer etiqueta.
     * Após adicionar, recarrega clientes elegíveis para que o cliente desapareça da lista de Pessoas
     * (clientes em etiquetas não aparecem no modo dia).
     */
    this.container?.querySelectorAll('[data-action="add-to-list"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const chatId = (e.currentTarget as HTMLElement).dataset.chatId;
        const listId = (e.currentTarget as HTMLElement).dataset.listId;
        if (chatId && listId && this.listsManager) {
          await this.listsManager.addMember(listId, chatId);
          this.selectedClients.delete(chatId);
          this.openMenuId = null;
          // Recarregar clientes elegíveis para remover da lista de Pessoas (modo dia)
          await this.loadInactiveClients();
          this.calculatePeriodFilters();
          this.lists = this.listsManager.getLists();
          this.updateUnifiedFlow();
          const list = this.lists.find(l => l.id === listId);
          const displayName = list ? (ETIQUETA_DISPLAY_NAMES[list.id] ?? list.name) : 'etiqueta';
          this.addLog('info', `Adicionado à ${displayName}`);
        }
      });
    });

    /**
     * Ações do kebab menu (modo etiqueta) — remover cliente da etiqueta atual.
     * Após remover, recarrega clientes elegíveis para que o cliente apareça em Pessoas (modo dia).
     */
    this.container?.querySelectorAll('[data-action="remove-from-label"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const chatId = (e.currentTarget as HTMLElement).dataset.chatId;
        if (chatId && this.selectedListId && this.listsManager) {
          await this.listsManager.removeMember(this.selectedListId, chatId);
          // Atualizar lista de membros da etiqueta atual
          this.labelModeClients = await this.getClientsFromListMembers(this.selectedListId);
          // Recarregar clientes elegíveis para que apareça em Pessoas (modo dia)
          await this.loadInactiveClients();
          this.openMenuId = null;
          this.lists = this.listsManager.getLists();
          this.updateUnifiedFlow();
          this.addLog('info', 'Removido da etiqueta');
        }
      });
    });

    /**
     * Ações do kebab menu (modo etiqueta) — mover cliente para outra etiqueta.
     * Remove da etiqueta atual e adiciona à etiqueta destino.
     */
    this.container?.querySelectorAll('[data-action="move-to-list"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const chatId = (e.currentTarget as HTMLElement).dataset.chatId;
        const targetListId = (e.currentTarget as HTMLElement).dataset.listId;
        if (chatId && targetListId && this.selectedListId && this.listsManager) {
          await this.listsManager.removeMember(this.selectedListId, chatId);
          await this.listsManager.addMember(targetListId, chatId);
          // Atualizar lista de membros da etiqueta atual (cliente foi removido)
          this.labelModeClients = await this.getClientsFromListMembers(this.selectedListId);
          this.openMenuId = null;
          this.lists = this.listsManager.getLists();
          this.updateUnifiedFlow();
          const targetList = this.lists.find(l => l.id === targetListId);
          const displayName = targetList ? (ETIQUETA_DISPLAY_NAMES[targetList.id] ?? targetList.name) : 'etiqueta';
          this.addLog('info', `Movido para ${displayName}`);
        }
      });
    });

    // Botão expandir/colapsar lista
    const expandBtn = this.container?.querySelector('#retomar-expand-contacts');
    expandBtn?.addEventListener('click', () => {
      this.isContactsExpanded = !this.isContactsExpanded;
      this.updateUnifiedFlow();
    });

    // Fechar menus ao clicar fora
    // Remover listener anterior para evitar vazamento em re-renders
    if (this.closeMenusHandler) {
      document.removeEventListener('click', this.closeMenusHandler);
      this.closeMenusHandler = null;
    }

    const closeMenusHandler = (e: MouseEvent) => {
      if (this.openMenuId && !(e.target as HTMLElement).closest('[data-kebab-menu]') && !(e.target as HTMLElement).closest('[data-kebab-dropdown]')) {
        this.openMenuId = null;
        this.updateUnifiedFlow();
      }
    };
    this.closeMenusHandler = closeMenusHandler;
    document.addEventListener('click', closeMenusHandler);

    // Reposicionar dropdown em caso de scroll ou resize
    if (this.repositionDropdownHandler) {
      window.removeEventListener('scroll', this.repositionDropdownHandler, true);
      window.removeEventListener('resize', this.repositionDropdownHandler);
    }
    const repositionHandler = () => {
      if (this.openMenuId) {
        this.positionKebabDropdowns();
      }
      if (this.listMenuOpenId) {
        this.positionListMenus();
      }
    };
    this.repositionDropdownHandler = repositionHandler;
    window.addEventListener('scroll', repositionHandler, true);
    window.addEventListener('resize', repositionHandler);
  }

  /**
   * Configura listeners do input de mensagem.
   */
  private setupMessageInputListeners(): void {
    const messageInput = this.container?.querySelector('#retomar-message-input') as HTMLTextAreaElement;
    messageInput?.addEventListener('input', (e) => {
      this.messageText = (e.target as HTMLTextAreaElement).value;
    });
  }

  /**
   * Configura listeners dos headers colapsáveis e kebab menus.
   */
  private setupHeaderActionsListeners(): void {
    // Toggle filtros
    const filtersToggle = this.container?.querySelector('#retomar-filters-toggle');
    filtersToggle?.addEventListener('click', () => {
      this.isFiltersExpanded = !this.isFiltersExpanded;
      this.updateUnifiedFlow();
    });

    // Toggle contatos
    const contactsToggle = this.container?.querySelector('#retomar-contacts-toggle');
    contactsToggle?.addEventListener('click', () => {
      this.isContactsExpanded = !this.isContactsExpanded;
      this.updateUnifiedFlow();
    });
  }

  /**
   * Configura listeners da seção unificada de inativos.
   */
  public setupUnifiedInactiveListeners(): void {
    const daySelector = this.container?.querySelector('#retomar-day-selector') as HTMLElement | null;
    const dropdown = this.container?.querySelector('#retomar-cadence-dropdown') as HTMLElement | null;

    // Toggle dropdown (agora dropdown pode ser customizado via Tailwind)
    daySelector?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = dropdown && dropdown.style.display !== 'none';
      if (dropdown) {
        dropdown.style.display = isVisible ? 'none' : 'block';
        dropdown.className = isVisible
          ? 'hidden'
          : 'glass rounded-xl border-border/30 min-w-[90px] p-1 absolute z-50 mt-1';
      }
    });

    // Fechar dropdown ao clicar fora
    // Remover listener anterior para evitar vazamento em re-renders
    if (this.closeDropdownHandler) {
      document.removeEventListener('click', this.closeDropdownHandler);
      this.closeDropdownHandler = null;
    }

    const closeDropdown = (e: MouseEvent) => {
      if (dropdown && daySelector &&
        !dropdown.contains(e.target as Node) &&
        !daySelector.contains(e.target as Node)) {
        dropdown.style.display = 'none';
      }
    };

    // Adicionar listener global (será removido quando o painel for destruído)
    this.closeDropdownHandler = closeDropdown;
    document.addEventListener('click', closeDropdown);

    // Selecionar dia do dropdown
    const dropdownItems = this.container?.querySelectorAll('#retomar-cadence-dropdown button[data-day]');
    dropdownItems?.forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const day = parseInt((e.target as HTMLElement).getAttribute('data-day') || '0');
        if (day > 0) {
          this.selectedInactiveDay = day;
          if (dropdown) {
            dropdown.classList.add('hidden');
            dropdown.style.display = 'none';
          }
          this.updateUnifiedFlow();
        }
      });
    });

    // Selecionar dia das opções rápidas (grid de botões)
    const cadenceOptions = this.container?.querySelectorAll('button[data-day]:not(#retomar-day-selector)');
    cadenceOptions?.forEach(option => {
      option.addEventListener('click', (e) => {
        const day = parseInt((e.target as HTMLElement).getAttribute('data-day') || '0');
        if (day > 0 && (e.target as HTMLElement).id.startsWith('retomar-select-day-')) {
          // Este é um botão de seleção, não o grid
          return;
        }
        if (day > 0 && !(e.target as HTMLElement).id.startsWith('retomar-')) {
          // Grid de períodos
          this.selectedInactiveDay = day;
          this.updateUnifiedFlow();
        }
      });
    });

    // Editar régua
    const editCadenceBtn = this.container?.querySelector('#retomar-edit-cadence');
    editCadenceBtn?.addEventListener('click', async () => {
      await this.showEditCadenceDialog();
    });
  }

  /**
   * Configura listeners das ações de seleção (Todos, por dia, limpar).
   */
  public setupUnifiedFlowActions(): void {
    // Selecionar todos
    const selectAllBtn = this.container?.querySelector('#retomar-select-all-days');
    selectAllBtn?.addEventListener('click', () => {
      const selectedDay = this.selectedInactiveDay || this.cadenceDays[0] || 21;
      this.eligibleClients
        .filter(c => c.daysInactive >= selectedDay && c.status === 'pending' && !c.isSpecialList)
        .forEach(client => {
          this.selectedClients.add(client.chatId);
        });
      this.updateUnifiedFlow();
      this.addLog('info', `Selecionados todos os clientes elegíveis (${this.selectedClients.size})`);
    });

    // Selecionar por dia específico
    this.cadenceDays.forEach(day => {
      const selectDayBtn = this.container?.querySelector(`#retomar-select-day-${day}`);
      selectDayBtn?.addEventListener('click', () => {
        const dayClients = this.eligibleClients.filter(c =>
          c.daysInactive >= day &&
          c.daysInactive < (this.cadenceDays[this.cadenceDays.indexOf(day) + 1] || Infinity) &&
          c.status === 'pending' &&
          !c.isSpecialList
        );
        dayClients.forEach(client => {
          this.selectedClients.add(client.chatId);
        });
        this.updateUnifiedFlow();
        this.addLog('info', `Selecionados ${dayClients.length} cliente(s) do ${day}º dia`);
      });
    });

    // Limpar seleção
    const clearBtn = this.container?.querySelector('#retomar-clear-selection');
    clearBtn?.addEventListener('click', () => {
      this.selectedClients.clear();
      this.updateUnifiedFlow();
      this.addLog('info', 'Seleção limpa');
    });
  }

  /**
   * Configura listeners da lista de destinatários.
   */
  public setupUnifiedRecipients(): void {
    // Checkboxes individuais (agora dentro de glass-subtle cards)
    const checkboxes = this.container?.querySelectorAll('input[type="checkbox"][data-chat-id]');
    checkboxes?.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const chatId = (e.target as HTMLInputElement).dataset.chatId;
        const checked = (e.target as HTMLInputElement).checked;
        if (chatId) {
          if (checked) {
            this.selectedClients.add(chatId);
          } else {
            this.selectedClients.delete(chatId);
          }
          this.updateUnifiedFlow();
        }
      });
    });

    // Ações dos cards (Hoje, Remover, Especial)
    const actionButtons = this.container?.querySelectorAll('button[data-action][data-chat-id]');
    actionButtons?.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = (e.target as HTMLElement).dataset.action;
        const chatId = (e.target as HTMLElement).dataset.chatId;
        if (chatId && action) {
          this.handleClientAction(action, chatId);
          this.updateUnifiedFlow();
        }
      });
    });

    // Botão enviar - REMOVIDO: agora usa event delegation em setupUnifiedFlowListeners()
    // Não precisa mais configurar aqui, pois o event delegation captura todos os cliques
  }

  /**
   * Adiciona entrada ao log.
   */
  private addLog(type: LogEntry['type'], message: string): void {
    if (type === 'error') {
      console.error('[RETOMAR]', message);
    }
    this.logs.push({
      timestamp: new Date(),
      type,
      message,
    });
    // Manter apenas últimos 100 logs
    if (this.logs.length > 100) {
      this.logs.shift();
    }
    // Só renderizar se o container já existir
    if (this.container) {
      this.renderLogs();
    }
  }

  /**
   * Renderiza todo o conteúdo do painel.
   */
  private renderContent(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <!-- INTERFACE UNIFICADA: INATIVOS + RÉGUA + ENVIOS -->
      <div class="mettri-retomar-unified-flow flex flex-col gap-5 min-w-0 max-w-full overflow-y-visible">
        ${this.renderUnifiedFlow()}
      </div>

      <!-- MONITORAMENTO -->
      <div class="space-y-2 pt-1">
        <div class="flex items-center justify-between py-2 border-b border-border/50">
          <span class="text-sm font-medium text-foreground">Monitoramento</span>
          <button class="h-7 px-2.5 text-xs text-primary hover:bg-primary/10 rounded-lg transition-colors" id="retomar-clear-logs">Limpar</button>
        </div>
        <div class="glass-subtle rounded-xl p-3 max-h-48 overflow-y-auto text-xs text-muted-foreground border border-border/50" id="retomar-logs">
          ${this.logs.length === 0 ? '<div class="text-center py-4 text-[11px] text-muted-foreground/60">Nenhum log ainda. Os eventos aparecerão aqui.</div>' : ''}
        </div>
      </div>
    `;

    this.setupEventListeners();
  }

  /**
   * Extrai primeiro nome formatado do nome completo.
   */
  private extractFirstName(fullName: string): string {
    const firstName = fullName.trim().split(/\s+/)[0] || fullName;
    // Primeira letra maiúscula, resto minúsculo
    return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  }

  /**
   * Renderiza visão geral compacta com breakdown por dias.
   */
  public renderOverview(): string {
    const totalInactive = this.eligibleClients.length;
    const countsByDay = this.getCadenceCounts();

    const breakdown = this.cadenceDays.map(day => {
      const count = countsByDay[day] || 0;
      return `<span class="mettri-overview-day-compact">${count} a ${day} dias</span>`;
    }).join('');

    return `
      <div class="mettri-overview-compact">
        <span class="mettri-overview-total-compact">${totalInactive} inativos</span>
        <div class="mettri-overview-breakdown-compact">
          ${breakdown}
        </div>
      </div>
    `;
  }

  /**
   * Renderiza seção de preparação de envios.
   */
  public renderPrepareSection(): string {
    const selectedCount = this.selectedClients.size;
    const selectedClients = this.eligibleClients.filter(c => this.selectedClients.has(c.chatId));

    return `
      <div class="mettri-prepare-actions">
        <button class="mettri-btn-link" id="retomar-select-all-days">Todos</button>
        ${this.cadenceDays.map(day => `
          <button class="mettri-btn-link" data-day="${day}" id="retomar-select-day-${day}">
            ${day} dias
          </button>
        `).join('')}
        <button class="mettri-btn-link" id="retomar-clear-selection">Limpar</button>
      </div>
      
      <div class="mettri-prepare-selected">
        <div class="mettri-prepare-selected-header">
          <span class="mettri-section-title-small">Clientes Selecionados (${selectedCount})</span>
        </div>
        <div class="mettri-prepare-clients-list">
          ${this.renderSelectedClientsList(selectedClients)}
        </div>
        <div class="mettri-prepare-send-footer">
          <button class="mettri-btn-primary mettri-btn-send" id="retomar-send-selected" ${selectedCount === 0 ? 'disabled' : ''}>
            Enviar ${selectedCount > 0 ? `(${selectedCount})` : ''}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Renderiza lista de clientes selecionados formatada.
   */
  private renderSelectedClientsList(clients: InactiveClient[]): string {
    if (clients.length === 0) {
      return `
        <div class="mettri-prepare-empty">
          <p>Nenhum cliente selecionado.</p>
          <p>Use os botões acima para selecionar clientes por dia da régua.</p>
        </div>
      `;
    }

    return clients.map(client => {
      const firstName = client.firstName || '';
      const displayLabel = firstName || client.phone || 'Sem nome';
      const message = this.messageText || 'Olá! Sentimos sua falta por aqui.';

      return `
        <div class="mettri-prepare-client-card" data-chat-id="${client.chatId}">
          <div class="mettri-prepare-client-main">
            <input type="checkbox" class="mettri-prepare-client-checkbox" 
                   checked data-chat-id="${client.chatId}">
            <div class="mettri-prepare-client-info">
              <div class="mettri-prepare-client-name">${this.escapeHtml(displayLabel)}</div>
              <div class="mettri-prepare-client-preview" title="${this.escapeHtml(message)}">
                ${this.escapeHtml(message.substring(0, 50))}${message.length > 50 ? '...' : ''}
              </div>
            </div>
          </div>
          <div class="mettri-prepare-client-actions">
            <button class="mettri-btn-link mettri-btn-small" 
                    data-action="skip-today" 
                    data-chat-id="${client.chatId}"
                    title="Pular para hoje">
              Hoje
            </button>
            <button class="mettri-btn-link mettri-btn-small" 
                    data-action="exclude" 
                    data-chat-id="${client.chatId}"
                    title="Remover da lista">
              Remover
            </button>
            <button class="mettri-btn-link mettri-btn-small mettri-btn-special-list" 
                    data-action="special-list" 
                    data-chat-id="${client.chatId}"
                    title="Mover para lista especial (CNPJ, etc)">
              Especial
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Renderiza fluxo unificado completo com novo design.
   */
  private renderUnifiedFlow(): string {
    const selectedCount = this.selectedClients.size;
    const selectedClients = this.eligibleClients.filter(c =>
      this.selectedClients.has(c.chatId) &&
      c.status === 'pending' && !c.isSpecialList
    );

    // Clientes elegíveis para exibição
    const eligibleClients = this.eligibleClients.filter(c =>
      c.status === 'pending' && !c.isSpecialList
    );

    return `
      <!-- Bloco único: Retomar conversas (objetivo + estado + métricas) -->
      <div class="glass rounded-2xl p-4 border border-border/50 shadow-sm">
        <div class="text-sm font-medium text-foreground tracking-tight">Retomar conversas</div>
        <div class="mt-2 text-sm text-muted-foreground">
          <span class="tabular-nums font-semibold text-foreground">${this.eligibleCount}</span>
          <span class="ml-1">oportunidades no momento</span>
        </div>
        <div class="mt-3 pt-3 border-t border-border/50 flex items-baseline flex-wrap gap-x-3 gap-y-0 text-xs">
          <span class="text-muted-foreground">Abertura</span>
          <span class="font-medium text-foreground tabular-nums">78%</span>
          <span class="text-muted-foreground"> · </span>
          <span class="text-muted-foreground">Resposta</span>
          <span class="font-medium text-foreground tabular-nums">32%</span>
          <span class="text-muted-foreground"> · </span>
          <span class="text-muted-foreground">Conversão</span>
          <span class="font-medium text-foreground tabular-nums">14%</span>
          <span class="text-muted-foreground"> · </span>
          <span class="text-muted-foreground">Últimos 7 dias</span>
        </div>
      </div>

      <!-- SEÇÃO DE FILTROS (Colapsável) -->
      <div class="space-y-2 mb-0">
        <div class="flex items-center justify-between py-2.5 border-b border-border/50 min-w-0">
          <button 
            class="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
            id="retomar-filters-toggle"
            type="button"
          >
            Última Interação há
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="transition-transform shrink-0 ${this.isFiltersExpanded ? 'rotate-180' : ''}" id="retomar-filters-chevron">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button 
            class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-accent/50 transition-colors shrink-0"
            id="retomar-filters-kebab"
            type="button"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="3.5" r="1.5" fill="currentColor" class="text-muted-foreground"/>
              <circle cx="7" cy="7" r="1.5" fill="currentColor" class="text-muted-foreground"/>
              <circle cx="7" cy="10.5" r="1.5" fill="currentColor" class="text-muted-foreground"/>
            </svg>
          </button>
        </div>
        ${this.isFiltersExpanded ? `
          <div id="retomar-period-filters" class="pt-2">
            ${this.renderPeriodFilters()}
          </div>
        ` : ''}
      </div>

      <!-- SEÇÃO DE ETIQUETAS (Colapsável) -->
      ${this.renderLists()}

      <!-- SEÇÃO DE PESSOAS (Colapsável) - min-w-0 evita alargar e manter scroll -->
      <div class="space-y-1 mb-0 min-w-0 w-full overflow-x-hidden overflow-y-visible">
        <div class="flex items-center justify-between py-2.5 border-b border-border/50 min-w-0">
          <button 
            class="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors min-w-0"
            id="retomar-contacts-toggle"
            type="button"
          >
            Pessoas
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="transition-transform shrink-0 ${this.isContactsExpanded ? 'rotate-180' : ''}" id="retomar-contacts-chevron">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button 
            class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-accent/50 transition-colors shrink-0"
            id="retomar-contacts-kebab"
            type="button"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="3.5" r="1.5" fill="currentColor" class="text-muted-foreground"/>
              <circle cx="7" cy="7" r="1.5" fill="currentColor" class="text-muted-foreground"/>
              <circle cx="7" cy="10.5" r="1.5" fill="currentColor" class="text-muted-foreground"/>
            </svg>
          </button>
        </div>
        ${this.isContactsExpanded ? `
          <div class="space-y-0.5 min-w-0 max-w-full overflow-x-hidden overflow-y-visible pt-2" id="retomar-contacts-list">
            ${this.renderPeopleSectionContent(selectedCount, selectedClients, eligibleClients)}
          </div>
          
          ${selectedClients.length > 6 ? `
            <button 
              class="w-full h-8 rounded-lg text-xs text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-1"
              id="retomar-expand-contacts"
              type="button"
            >
              ${this.isContactsExpanded ? 'Ver menos' : 'Ver todos >'}
            </button>
          ` : ''}
        ` : ''}
      </div>

      <!-- UI DE PROGRESSO -->
      ${this.renderProgressUI()}

      <!-- INPUT DE MENSAGEM -->
      <div class="flex items-start gap-3 p-3 rounded-xl border border-border bg-background shadow-sm min-w-0">
        <span class="text-lg mt-0.5 shrink-0">😊</span>
        <textarea 
          rows="3"
          class="flex-1 min-w-0 bg-transparent text-sm placeholder:text-muted-foreground outline-none resize-none"
          placeholder="Escreva uma mensagem..."
          id="retomar-message-input"
        >${this.escapeHtml(this.messageText)}</textarea>
      </div>

      <!-- MODO TESTE -->
      <div class="mt-0.5">
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" id="retomar-test-mode" ${this.testModeEnabled ? 'checked' : ''} />
          <span class="text-[11px] text-muted-foreground">Simular envio</span>
        </label>
      </div>

      <!-- BOTÕES DE CONTROLE -->
      <div class="mt-3 flex gap-2">
        ${this.isSending ? `
          <button 
            class="flex-1 h-11 rounded-xl bg-yellow-500 text-white font-medium hover:bg-yellow-600 transition-colors flex items-center justify-center gap-2 shadow-sm"
            id="retomar-pause-resume"
            type="button"
          >
            ${this.isPaused ? '▶ Retomar' : '⏸ Pausar'}
          </button>
          <div class="flex items-center px-3 text-xs text-muted-foreground">
            ${this.sendingQueue.length} restantes
          </div>
        ` : `
          <button 
            class="w-full h-11 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            id="retomar-send-selected"
            type="button"
            ${selectedCount === 0 && !this.testModeEnabled ? 'disabled' : ''}
          >
            ${this.testModeEnabled ? 'Enviar Teste' : selectedCount > 0 ? `Enviar (${selectedCount})` : 'Enviar'}
          </button>
        `}
      </div>

      <!-- CAMPOS DE TESTE (quando modo teste ativo) -->
      ${this.testModeEnabled ? `
        <div class="mt-2 p-2 rounded-lg border border-border/50 bg-accent/30">
          <div class="grid grid-cols-2 gap-2">
            <div class="relative">
              <input 
                type="text"
                class="w-full px-2 pr-7 py-1.5 rounded-lg border border-border bg-background text-sm outline-none"
                id="retomar-test-phone" 
                placeholder="Número (ex: 5511999999999)" 
                value="${this.testContact ? this.escapeHtml(this.testContact.phone) : ''}"
              />
              ${this.testContact?.phone ? `
                <span class="absolute right-2 top-1/2 -translate-y-1/2 text-green-500/70 pointer-events-none">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </span>
              ` : ''}
            </div>
            <div class="relative">
              <input 
                type="text"
                class="w-full px-2 pr-7 py-1.5 rounded-lg border border-border bg-background text-sm outline-none"
                id="retomar-test-name" 
                placeholder="Nome" 
                value="${this.testContact ? this.escapeHtml(this.testContact.name) : ''}"
              />
              ${this.testContact?.name ? `
                <span class="absolute right-2 top-1/2 -translate-y-1/2 text-green-500/70 pointer-events-none">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </span>
              ` : ''}
            </div>
          </div>
        </div>
      ` : ''}

    `;
  }

  /**
   * Renderiza chips de período em grid 2x2 com checkbox.
   */
  private renderPeriodFilters(): string {
    return `
      <div class="grid grid-cols-2 gap-2">
        ${this.periodFilters.map(filter => {
      const isSelected = filter.selected;
      const isFilled = filter.variant === 'filled';

      return `
            <button 
              class="flex items-center gap-2 px-3 py-2 rounded-xl transition-colors cursor-pointer ${isFilled
          ? 'bg-primary text-primary-foreground'
          : 'border border-border bg-background hover:bg-accent/50'
        }"
              data-period-range="${filter.range}"
              type="button"
            >
              <div class="w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected
          ? 'border-primary bg-primary'
          : 'border-border bg-background'
        }">
                ${isSelected ? `
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M10 3L4.5 8.5L2 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                ` : ''}
              </div>
              <span class="text-xs font-medium">${filter.range} dias</span>
              <span class="text-[11px] opacity-70">(${filter.count})</span>
            </button>
          `;
    }).join('')}
      </div>
    `;
  }

  /**
   * Contato de teste como InactiveClient para aparecer na lista de Pessoas (Simular envio).
   * Não aparece se estiver em alguma etiqueta (só aparece em modo dia, não em modo etiqueta).
   */
  private getTestContactAsClient(): InactiveClient | null {
    if (!this.testModeEnabled || !this.testContact?.phone || !digitsOnly(this.testContact.phone)) return null;
    const chatId = this.phoneToChatId(this.testContact.phone);
    if (!chatId) return null;
    // Não mostrar contato de teste se estiver em alguma lista (em modo dia, pessoas em listas não aparecem)
    if (this.listsManager && this.listsManager.isInList(chatId)) return null;
    const name = (this.testContact.name || '').trim() || this.testContact.phone;
    return {
      chatId,
      chatName: name,
      phone: this.testContact.phone,
      lastMessageTime: new Date(),
      daysInactive: 0,
      cadenceDay: 0,
      status: 'pending',
      firstName: name || undefined,
      isTestContact: true,
    };
  }

  /**
   * Conteúdo da seção Pessoas: modo dia (selecionados/empty) ou modo etiqueta (membros da lista).
   * 
   * - Modo etiqueta (selectedListId !== null): mostra membros da etiqueta selecionada
   * - Modo dia (selectedListId === null): mostra clientes elegíveis filtrados por dia
   * - Simular envio: contato de teste aparece na lista quando ativo
   */
  private renderPeopleSectionContent(selectedCount: number, selectedClients: InactiveClient[], eligibleClients: InactiveClient[]): string {
    // Modo etiqueta: mostrar membros da etiqueta selecionada
    if (this.selectedListId !== null) {
      const labelName = ETIQUETA_DISPLAY_NAMES[this.selectedListId] ?? 'Etiqueta';
      return this.renderContactsList(this.labelModeClients, `(${labelName})`);
    }
    
    // Modo dia: mostrar clientes elegíveis ou contato de teste
    const testClient = this.getTestContactAsClient();
    if (this.testModeEnabled && testClient) {
      const withTest = this.selectedClients.has(testClient.chatId)
        ? selectedClients
        : [testClient, ...selectedClients.filter(c => c.chatId !== testClient.chatId)];
      if (withTest.length > 0) return this.renderContactsList(withTest);
      return this.renderContactsList([testClient]);
    }
    if (selectedCount > 0) return this.renderContactsList(selectedClients);
    return this.renderEmptyRecipients(eligibleClients);
  }

  /**
   * Renderiza lista de contatos: checkbox + nome + (dias ou etiqueta) + kebab menu.
   * @param labelSuffix - Se definido (modo etiqueta), exibe em vez de "Xd".
   */
  private renderContactsList(clients: InactiveClient[], labelSuffix?: string): string {
    // Limitar a 6 itens quando não expandida
    const displayClients = this.isContactsExpanded ? clients : clients.slice(0, 6);

    return displayClients.map(client => {
      const firstName = client.firstName || '';
      const displayLabel = firstName || client.phone || 'Sem nome';
      const isSelected = this.selectedClients.has(client.chatId);
      const isMenuOpen = this.openMenuId === client.chatId;
      const rightLabel = client.isTestContact ? '(Teste)' : (labelSuffix ?? `${client.daysInactive}d`);
      const kebabContent = this.selectedListId !== null
        ? this.renderKebabMenuLabelMode(client.chatId, this.selectedListId)
        : this.renderKebabMenu(client.chatId);

      return `
        <div class="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent/30 transition-colors relative overflow-visible" data-chat-id="${client.chatId}">
          <label class="cursor-pointer flex items-center">
            <input 
              type="checkbox" 
              class="sr-only" 
              ${isSelected ? 'checked' : ''} 
              data-chat-id="${client.chatId}"
            >
            <div class="w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected
          ? 'border-primary bg-primary'
          : 'border-border bg-background'
        }">
              ${isSelected ? `
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M10 3L4.5 8.5L2 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              ` : ''}
            </div>
          </label>
          <span class="text-xs font-medium text-foreground flex-1">${this.escapeHtml(displayLabel)}</span>
          <span class="text-[11px] text-muted-foreground">${this.escapeHtml(rightLabel)}</span>
          <div class="relative" style="overflow: visible; z-index: 1;">
            <button 
              class="w-6 h-6 rounded flex items-center justify-center hover:bg-accent/50 transition-colors" 
              data-kebab-menu="${client.chatId}"
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="3.5" r="1.5" fill="currentColor" class="text-muted-foreground"/>
                <circle cx="7" cy="7" r="1.5" fill="currentColor" class="text-muted-foreground"/>
                <circle cx="7" cy="10.5" r="1.5" fill="currentColor" class="text-muted-foreground"/>
              </svg>
            </button>
            ${isMenuOpen ? kebabContent : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Renderiza menu kebab dropdown para um contato (modo dia). Mostra todas as etiquetas disponíveis.
   */
  private renderKebabMenu(chatId: string): string {
    const allLists = this.lists.filter(l => l.id === 'never-send' || l.id === 'exclusivos' || l.type === 'custom');
    const etiquetaButtons = allLists.map(list => {
      const displayName = ETIQUETA_DISPLAY_NAMES[list.id] ?? list.name;
      return `
        <button 
          class="w-full rounded-lg cursor-pointer gap-2.5 text-xs flex items-center px-2 py-1.5 text-muted-foreground focus:bg-accent transition-colors"
          data-action="add-to-list"
          data-list-id="${list.id}"
          data-chat-id="${chatId}"
        >
          <span>${this.escapeHtml(displayName)}</span>
        </button>
      `;
    }).join('');
    
    return `
      <div class="w-48 rounded-xl glass border border-border shadow-xl z-[9999]" data-kebab-dropdown="${chatId}">
        <div class="px-2 py-1.5 text-[11px] font-medium text-muted-foreground/70">
          Adicionar a:
        </div>
        <div class="bg-border/30 my-1 h-px"></div>
        ${etiquetaButtons}
      </div>
    `;
  }

  /**
   * Renderiza menu kebab no modo etiqueta: remover da etiqueta ou mover para outra.
   */
  private renderKebabMenuLabelMode(chatId: string, currentListId: string): string {
    const allLists = this.lists.filter(l => l.id !== currentListId && (l.id === 'never-send' || l.id === 'exclusivos' || l.type === 'custom'));
    const moveButtons = allLists.map(list => {
      const displayName = ETIQUETA_DISPLAY_NAMES[list.id] ?? list.name;
      return `
        <button 
          class="w-full rounded-lg cursor-pointer gap-2.5 text-xs flex items-center px-2 py-1.5 text-muted-foreground focus:bg-accent transition-colors"
          data-action="move-to-list"
          data-list-id="${list.id}"
          data-chat-id="${chatId}"
        >
          <span>Mover para ${this.escapeHtml(displayName)}</span>
        </button>
      `;
    }).join('');
    
    return `
      <div class="w-48 rounded-xl glass border border-border shadow-xl z-[9999]" data-kebab-dropdown="${chatId}">
        <button 
          class="w-full rounded-lg cursor-pointer gap-2.5 text-xs flex items-center px-2 py-1.5 text-muted-foreground focus:bg-accent transition-colors"
          data-action="remove-from-label"
          data-chat-id="${chatId}"
        >
          <span>Remover desta etiqueta</span>
        </button>
        ${moveButtons ? `
        <div class="bg-border/30 my-1 h-px"></div>
        ${moveButtons}
        ` : ''}
      </div>
    `;
  }

  /**
   * Renderiza lista de destinatários no formato unificado (mantido para compatibilidade).
   */
  public renderUnifiedRecipientsList(clients: InactiveClient[]): string {
    return this.renderContactsList(clients);
  }

  /**
   * Renderiza estado vazio da lista de destinatários.
   */
  private renderEmptyRecipients(eligibleClients: InactiveClient[]): string {
    if (eligibleClients.length === 0) {
      return `
        <div class="glass-subtle rounded-xl p-3 text-center space-y-1">
          <p class="text-[11px] text-muted-foreground">Nenhum cliente inativo encontrado para este período.</p>
        </div>
      `;
    }

    return `
              <div class="glass-subtle rounded-xl p-3 text-center space-y-1">
                <p class="text-[11px] text-muted-foreground">Selecione clientes usando os botões acima.</p>
                <p class="text-[11px] text-primary font-medium">${eligibleClients.length} disponível${eligibleClients.length !== 1 ? 'eis' : ''} para ${this.selectedInactiveDay || this.cadenceDays[0]}d</p>
              </div>
    `;
  }

  /**
   * Calcula quantos clientes estão inativos há mais de X dias.
   */
  public getInactiveCountForDay(day: number): number {
    return this.eligibleClients.filter(client => client.daysInactive === day).length;
  }

  /**
   * Calcula filtros por dia exato (21, 35, 56, 84) com contagens e estado.
   */
  private calculatePeriodFilters(): void {
    this.periodFilters = this.cadenceDays.map((day) => {
      const count = this.eligibleClients.filter(c =>
        c.daysInactive === day &&
        c.status === 'pending' &&
        !c.isSpecialList
      ).length;
      const selected = this.eligibleClients.some(c =>
        c.daysInactive === day && this.selectedClients.has(c.chatId)
      );
      return {
        range: String(day),
        count,
        selected,
        variant: selected ? 'filled' : 'outline',
      };
    });
  }

  /**
   * Retorna contagem de clientes por dia da régua.
   */
  private getCadenceCounts(): Record<number, number> {
    const counts: Record<number, number> = {};
    this.cadenceDays.forEach(day => {
      counts[day] = this.eligibleClients.filter(c => c.cadenceDay === day).length;
    });
    return counts;
  }

  /**
   * Renderiza cards de estatísticas.
   */
  public renderStats(): void {
    if (!this.container) return;

    const statsContainer = this.container.querySelector('#retomar-stats');
    if (!statsContainer) return;

    statsContainer.innerHTML = `
      <div class="mettri-stat-card">
        <div class="stat-value">${this.stats.totalEligible}</div>
        <div class="stat-label">Elegíveis</div>
      </div>
      <div class="mettri-stat-card">
        <div class="stat-value">${this.stats.selected}</div>
        <div class="stat-label">Selecionados</div>
      </div>
      <div class="mettri-stat-card">
        <div class="stat-value">${this.stats.sentToday}</div>
        <div class="stat-label">Enviadas Hoje</div>
      </div>
      <div class="mettri-stat-card">
        <div class="stat-value">${this.stats.responseRate}%</div>
        <div class="stat-label">Taxa de Resposta</div>
      </div>
    `;
  }

  /**
   * Renderiza logs de monitoramento.
   */
  private renderLogs(): void {
    if (!this.container) return;

    const logsContainer = this.container.querySelector('#retomar-logs');
    if (!logsContainer) return;

    if (this.logs.length === 0) {
      logsContainer.innerHTML = '<div class="mettri-logs-empty">Nenhum log ainda. Os eventos aparecerão aqui.</div>';
      return;
    }

    logsContainer.innerHTML = this.logs.map(log => {
      const time = log.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const icon = {
        success: '✓',
        error: '✗',
        info: '→',
        warning: '⚠',
      }[log.type] || '•';

      return `
        <div class="mettri-log-entry mettri-log-${log.type}">
          <span class="mettri-log-time">[${time}]</span>
          <span class="mettri-log-icon">${icon}</span>
          <span class="mettri-log-message">${this.escapeHtml(log.message)}</span>
        </div>
      `;
    }).join('');

    // Scroll para o final
    logsContainer.scrollTop = logsContainer.scrollHeight;
  }

  /**
   * Configura event listeners.
   */
  private setupEventListeners(): void {
    // Configurar listeners do fluxo unificado
    this.setupUnifiedFlowListeners();

    // Limpar logs
    const clearLogsBtn = this.container?.querySelector('#retomar-clear-logs');
    clearLogsBtn?.addEventListener('click', () => {
      this.logs = [];
      this.renderLogs();
    });

  }

  /**
   * Mostra diálogo para editar régua.
   */
  private async showEditCadenceDialog(): Promise<void> {
    const input = prompt('Digite os dias da régua separados por vírgula (ex: 21,35,56,84):', this.cadenceDays.join(','));
    if (input) {
      const days = input.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d) && d > 0);
      if (days.length > 0) {
        this.cadenceDays = days.sort((a, b) => a - b);
        await this.saveConfig();
        await this.loadInactiveClients();
        // Resetar dia selecionado para o primeiro da nova régua
        this.selectedInactiveDay = this.cadenceDays[0] || 21;
        this.renderContent();
        this.addLog('success', `Régua atualizada: ${this.cadenceDays.join(', ')} dias`);
        this.updateUnifiedFlow();
      }
    }
  }


  /**
   * Manipula ações dos cards de clientes.
   */
  private handleClientAction(action: string, chatId: string): void {
    const client = this.eligibleClients.find(c => c.chatId === chatId);
    if (!client) return;

    switch (action) {
      case 'skip-today':
        client.status = 'skipped-today';
        this.selectedClients.delete(chatId);
        this.addLog('info', `${client.firstName || client.phone || 'Sem nome'} - Pulado para hoje`);
        break;

      case 'exclude':
        client.status = 'excluded';
        this.selectedClients.delete(chatId);
        this.addLog('info', `${client.firstName || client.phone || 'Sem nome'} - Removido da lista`);
        break;

      case 'special-list':
        client.isSpecialList = true;
        this.selectedClients.delete(chatId);
        this.addLog('info', `${client.firstName || client.phone || 'Sem nome'} - Movido para lista especial`);
        break;
    }

    this.updateUnifiedFlow();
  }

  /**
   * Deseleciona todos os clientes.
   */
  public deselectAllClients(): void {
    this.selectedClients.clear();
    this.updateUnifiedFlow();
  }



  /**
   * Envia mensagens para clientes selecionados.
   */
  private async sendSelectedClients(): Promise<void> {
    if (this.testModeEnabled && this.testContact?.phone) {
      if (!this.messageText.trim()) {
        this.addLog('warning', 'Digite uma mensagem para o teste');
        return;
      }
      
      const chatId = this.phoneToChatId(this.testContact.phone);
      if (!chatId) {
        this.addLog('warning', 'Número de teste inválido');
        return;
      }
      
      try {
        const message = this.messageText.trim();
        if (!message) {
          this.addLog('warning', 'Digite uma mensagem para o teste');
          return;
        }
        await this.sendRawToChatId(chatId, message);
        const label = this.testContact.name || this.testContact.phone;
        this.addLog('success', `Teste enviado para ${label}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.addLog('error', `Teste: ${msg}`);
      }
      return;
    }

    if (this.selectedClients.size === 0) {
      this.addLog('warning', 'Nenhum cliente selecionado');
      return;
    }

    // Adicionar à fila
    this.sendingQueue = Array.from(this.selectedClients);
    this.selectedClients.clear();
    await this.saveQueueState();

    // Inicializar progresso
    this.sendingProgress = {
      total: this.sendingQueue.length,
      sent: 0,
      skipped: 0,
      errors: 0,
      current: null,
      startTime: Date.now(),
    };

    this.isSending = true;
    this.addLog('info', `Iniciando envio para ${this.sendingQueue.length} cliente(s)...`);
    this.updateUnifiedFlow();

    await this.processQueue();
  }

  private async processQueue(): Promise<void> {
    this.sendingProgress.startTime = Date.now();
    
    while (this.sendingQueue.length > 0) {
      if (this.isPaused) {
        await this.waitForResume();
        continue;
      }
      
      const chatId = this.sendingQueue[0];
      const client = this.eligibleClients.find(c => c.chatId === chatId);
      
      // Atualizar progresso ANTES de processar
      this.sendingProgress.current = client?.chatName || 'Desconhecido';
      this.updateProgressUI();
      
      // Verificar se está em lista (listas bloqueiam envio)
      if (this.listsManager && this.listsManager.isInList(chatId)) {
        this.sendingProgress.skipped++;
        this.logSkip(chatId, 'Cliente em lista bloqueada');
        this.sendingQueue.shift();
        this.updateProgressUI();
        await this.saveQueueState();
        continue;
      }
      
      // Verificar rate limit
      const check = this.rateLimiter.canSend();
      if (!check.allowed) {
        const waitMs = check.waitMs ?? this.rateLimiter.getDelay();
        this.addLog('info', `Aguardando limite: ${check.reason ?? 'rate limit'} (${Math.round(waitMs / 1000)}s)`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }

      // Pausa aleatória (10-30% chance a cada 10 mensagens)
      if (this.rateLimiter.shouldRandomPause()) {
        const pauseMs = Math.random() * 30000 + 10000; // 10-40s
        this.addLog('info', `Pausa aleatória: ${Math.round(pauseMs / 1000)}s`);
        await new Promise(resolve => setTimeout(resolve, pauseMs));
      }

      try {
        await this.sendToClient(chatId);
        this.sendingProgress.sent++;
        this.rateLimiter.recordSent();
      } catch (error) {
        this.sendingProgress.errors++;
        this.logError(error);
      }
      
      // Atualizar progresso DEPOIS de processar
      this.updateProgressUI();
      
      // Delay aleatório
      const delay = this.rateLimiter.getDelay();
      await new Promise(resolve => setTimeout(resolve, delay));
      
      this.sendingQueue.shift();
      await this.saveQueueState();
    }
    
    this.isSending = false;
    this.sendingProgress.current = null;
    this.updateProgressUI();
    
    if (this.sendingQueue.length === 0) {
      this.addLog('success', 'Envio concluído');
      await this.clearQueueState();
    } else if (this.isPaused) {
      this.addLog('info', 'Envio pausado');
    }
    this.updateUnifiedFlow();
  }

  /**
   * Aguarda retomada do envio (quando pausado).
   */
  private async waitForResume(): Promise<void> {
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (!this.isPaused) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Registra log de cliente pulado.
   */
  private logSkip(chatId: string, reason: string): void {
    const client = this.eligibleClients.find(c => c.chatId === chatId);
    const label = client?.firstName || client?.phone || chatId;
    this.addLog('info', `${label} - Pulado: ${reason}`);
  }

  /**
   * Registra log de erro.
   */
  private logError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.addLog('error', `Erro: ${message}`);
  }

  private async saveQueueState(): Promise<void> {
    try {
      await this.bridge.storageSet({
        [this.STORAGE_KEY_QUEUE]: this.sendingQueue,
        [this.STORAGE_KEY_PAUSED]: this.isPaused,
      });
    } catch (error) {
      console.error('[RETOMAR] Erro ao salvar fila:', error);
    }
  }

  private async clearQueueState(): Promise<void> {
    try {
      await this.bridge.storageRemove([this.STORAGE_KEY_QUEUE, this.STORAGE_KEY_PAUSED]);
    } catch (error) {
      console.error('[RETOMAR] Erro ao limpar fila:', error);
    }
  }

  private startBackgroundProcessing(): void {
    if (this.backgroundIntervalId !== null) return;

    this.backgroundIntervalId = window.setInterval(async () => {
      if (this.sendingQueue.length > 0 && !this.isPaused && !this.isSending) {
        this.isSending = true;
        await this.processQueue();
        this.isSending = false;
      }
    }, 5000);
  }

  private stopBackgroundProcessing(): void {
    if (this.backgroundIntervalId !== null) {
      clearInterval(this.backgroundIntervalId);
      this.backgroundIntervalId = null;
    }
  }

  public pauseSending(): void {
    this.isPaused = true;
    this.saveQueueState();
    this.addLog('info', 'Envio pausado');
    this.updateUnifiedFlow();
  }

  public resumeSending(): void {
    this.isPaused = false;
    this.saveQueueState();
    this.addLog('info', 'Envio retomado');
    this.updateUnifiedFlow();

    if (this.sendingQueue.length > 0 && !this.isSending) {
      this.isSending = true;
      this.processQueue().finally(() => {
        this.isSending = false;
      });
    }
  }

  /**
   * Envia mensagem bruta para um chatId via WhatsApp Web.
   */
  private async sendRawToChatId(chatId: string, message: string): Promise<void> {
    await sendMessageService.sendText(chatId, message);
  }

  /**
   * Envia mensagem para um cliente específico.
   */
  private async sendToClient(chatId: string): Promise<void> {
    const client = this.eligibleClients.find(c => c.chatId === chatId);
    if (!client) {
      this.addLog('error', `Cliente não encontrado: ${chatId}`);
      throw new Error(`Cliente não encontrado: ${chatId}`);
    }

    try {
      const message = this.messageText.trim() || 'Olá! Sentimos sua falta por aqui.';
      await this.sendRawToChatId(chatId, message);

      client.status = 'sent';
      client.generatedMessage = message;
      this.addLog('success', `${client.firstName || client.phone || 'Sem nome'} - Enviado`);
      this.updateUnifiedFlow();
    } catch (error) {
      this.addLog('error', `${client.firstName || client.phone || 'Sem nome'} - Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Todas as listas para exibição: padrão (Bloqueados e CNPJ) + customizadas.
   * Garante que todas as etiquetas apareçam na lista.
   */
  private getEtiquetaListsForDisplay(): RetomarList[] {
    // Listas padrão sempre exibidas primeiro
    const defaultIds: Array<{ id: string; color: string }> = [
      { id: 'never-send', color: '--tag-color-6' },
      { id: 'exclusivos', color: '--tag-color-2' },
    ];
    
    const defaultLists = defaultIds.map(({ id, color }) => {
      const existing = this.lists.find(l => l.id === id);
      if (existing) return existing;
      const memberCount = this.listsManager ? this.listsManager.getMembers(id).length : 0;
      return {
        id,
        name: ETIQUETA_DISPLAY_NAMES[id] ?? id,
        type: 'default' as const,
        color,
        isDefault: true,
        memberCount,
        createdAt: 0,
        updatedAt: 0,
      };
    });
    
    // Listas customizadas (todas as outras)
    const customLists = this.lists.filter(l => l.type === 'custom');
    
    // Combinar: padrão primeiro, depois customizadas
    return [...defaultLists, ...customLists];
  }

  /**
   * Renderiza seção de listas (colapsável).
   * Só exibe Bloqueados e CNPJ; chips clicáveis para modo etiqueta.
   */
  private renderLists(): string {
    const headerTitle = this.listsExpanded ? 'Etiquetas Mettri' : 'Etiquetas';
    const etiquetaLists = this.getEtiquetaListsForDisplay();
    return `
      <div class="space-y-2 mb-0 min-w-0">
        <div class="flex items-center justify-between py-2.5 border-b border-border/50 min-w-0">
          <button 
            class="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors min-w-0"
            id="retomar-lists-toggle"
            data-lists-toggle
            type="button"
          >
            <span class="text-sm font-medium">${headerTitle}</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="transition-transform shrink-0 ${this.listsExpanded ? 'rotate-180' : ''}" id="retomar-lists-chevron">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          ${this.SHOW_CREATE_LIST ? `
          <button 
            class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-accent/50 transition-colors shrink-0"
            data-create-list
            title="Nova lista"
            type="button"
          >+</button>
          ` : ''}
        </div>
        ${this.listsExpanded ? `
          <div class="flex flex-col gap-2 min-w-0 pt-2">
            ${etiquetaLists.map(list => this.renderListTag(list)).join('')}
          </div>
          ${this.SHOW_CREATE_LIST ? `
          <button class="mettri-etiquetas-add-row w-full py-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors flex items-center justify-center gap-1" data-create-list type="button">
            <span>+</span>
            <span>Nova lista</span>
          </button>
          ` : ''}
        ` : ''}
      </div>
    `;
  }

  /**
   * Renderiza chip de uma lista (dot + nome + contagem). Clicável para modo etiqueta.
   */
  private renderListTag(list: RetomarList): string {
    const colorVar = list.color;
    const isDefault = list.isDefault;
    const isMenuOpen = this.listMenuOpenId === list.id;
    const memberCount = list.memberCount;
    const displayName = ETIQUETA_DISPLAY_NAMES[list.id] ?? list.name;
    const isSelected = this.selectedListId === list.id;

    return `
      <div 
        class="flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors group relative cursor-pointer overflow-visible ${isSelected ? 'border-primary bg-primary/10' : 'border-border bg-background hover:bg-accent/50'}"
        data-list-id="${list.id}"
        data-list-select="${list.id}"
      >
        <span class="w-3 h-3 rounded-full shrink-0" style="background-color: var(${colorVar})"></span>
        <span class="text-xs font-medium flex-1 min-w-0">${this.escapeHtml(displayName)}</span>
        <span class="text-[11px] opacity-70 shrink-0">(${memberCount})</span>
        <div class="relative shrink-0" style="overflow: visible;">
          <button 
            class="w-5 h-5 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity flex items-center justify-center"
            data-list-menu="${list.id}"
            title="Menu"
            type="button"
          >
            <span class="text-[11px]">⋯</span>
          </button>
          ${isMenuOpen ? this.renderListMenu(list.id) : ''}
        </div>
      </div>
    `;
  }

  /**
   * Renderiza menu de uma lista customizada.
   */
  private renderListMenu(listId: string): string {
    return `
      <div class="w-48 rounded-xl glass border border-border shadow-xl z-[9999]" data-list-menu-dropdown="${listId}">
        <button 
          class="w-full rounded-lg cursor-pointer gap-2.5 text-xs flex items-center px-2 py-1.5 focus:bg-accent transition-colors"
          data-list-action="view-members"
          data-list-id="${listId}"
        >
          <span>Ver membros</span>
        </button>
        <button 
          class="w-full rounded-lg cursor-pointer gap-2.5 text-xs flex items-center px-2 py-1.5 focus:bg-accent transition-colors"
          data-list-action="rename"
          data-list-id="${listId}"
        >
          <span>Renomear</span>
        </button>
        <div class="bg-border/30 my-1 h-px"></div>
        <button 
          class="w-full rounded-lg cursor-pointer gap-2.5 text-xs flex items-center px-2 py-1.5 text-destructive focus:bg-destructive/10 focus:text-destructive transition-colors"
          data-list-action="delete"
          data-list-id="${listId}"
        >
          <span>Excluir</span>
        </button>
      </div>
    `;
  }

  /**
   * Renderiza UI de progresso durante envio.
   */
  private renderProgressUI(): string {
    if (!this.isSending) return '';
    
    const progress = this.sendingProgress.total > 0 
      ? (this.sendingProgress.sent / this.sendingProgress.total) * 100 
      : 0;
    
    const elapsed = this.sendingProgress.startTime 
      ? Math.floor((Date.now() - this.sendingProgress.startTime) / 1000)
      : 0;
    const rate = elapsed > 0 ? Math.floor((this.sendingProgress.sent / elapsed) * 60) : 0;
    
    return `
      <div class="border border-border/50 rounded-xl bg-background p-3 space-y-2 shadow-sm">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-foreground">Enviando mensagens</span>
          ${this.isPaused ? `
            <span class="text-[11px] text-muted-foreground">Pausado</span>
          ` : `
            <span class="text-[11px] text-muted-foreground">${rate} msg/min</span>
          `}
        </div>
        
        <!-- Progress bar -->
        <div class="relative h-2 rounded-full overflow-hidden" style="background-color: var(--progress-bg)">
          <div 
            class="h-full rounded-full transition-all duration-300 ease-out"
            style="background-color: var(--progress-fill); width: ${progress}%"
            data-progress-bar
          ></div>
        </div>
        
        <!-- Contadores -->
        <div class="flex items-center justify-between text-[11px]">
          <div class="flex items-center gap-3">
            <span style="color: var(--progress-text)" data-sent-count>
              ${this.sendingProgress.sent} de ${this.sendingProgress.total} enviadas
            </span>
            ${this.sendingProgress.skipped > 0 ? `
              <span class="text-muted-foreground">
                ${this.sendingProgress.skipped} puladas
              </span>
            ` : ''}
            ${this.sendingProgress.errors > 0 ? `
              <span class="text-destructive">
                ${this.sendingProgress.errors} erros
              </span>
            ` : ''}
          </div>
          <span class="text-muted-foreground">${Math.round(progress)}%</span>
        </div>
        
        <!-- Cliente atual -->
        ${this.sendingProgress.current ? `
          <div class="text-[11px] text-muted-foreground truncate" data-current-client>
            Enviando para: ${this.escapeHtml(this.sendingProgress.current)}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Atualiza elementos específicos da UI de progresso (não re-renderiza tudo).
   */
  private updateProgressUI(): void {
    if (!this.container) return;

    const progressBar = this.container.querySelector('[data-progress-bar]') as HTMLElement;
    const sentCount = this.container.querySelector('[data-sent-count]');
    const currentClient = this.container.querySelector('[data-current-client]');
    
    if (progressBar) {
      const progress = this.sendingProgress.total > 0 
        ? (this.sendingProgress.sent / this.sendingProgress.total) * 100 
        : 0;
      progressBar.style.width = `${progress}%`;
    }
    
    if (sentCount) {
      sentCount.textContent = `${this.sendingProgress.sent} de ${this.sendingProgress.total} enviadas`;
    }
    
    if (currentClient && this.sendingProgress.current) {
      currentClient.textContent = `Enviando para: ${this.escapeHtml(this.sendingProgress.current)}`;
    }
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
   * Libera recursos (especialmente listeners globais em document).
   * Importante para navegação entre módulos sem vazamentos.
   */
  public destroy(): void {
    this.stopBackgroundProcessing();
    if (this.closeMenusHandler) {
      document.removeEventListener('click', this.closeMenusHandler);
      this.closeMenusHandler = null;
    }
    if (this.closeDropdownHandler) {
      document.removeEventListener('click', this.closeDropdownHandler);
      this.closeDropdownHandler = null;
    }
    if (this.repositionDropdownHandler) {
      window.removeEventListener('scroll', this.repositionDropdownHandler, true);
      window.removeEventListener('resize', this.repositionDropdownHandler);
      this.repositionDropdownHandler = null;
    }
    if (this.sendButtonClickHandler && this.container) {
      this.container.removeEventListener('click', this.sendButtonClickHandler);
      this.sendButtonClickHandler = null;
    }

    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
  }
}
