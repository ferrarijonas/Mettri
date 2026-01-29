/**
 * ReactivationPanel
 * 
 * Painel de reativação de clientes inativos.
 * Permite configurar régua de cadência, visualizar clientes elegíveis,
 * gerar mensagens personalizadas e enviar em massa.
 */

import { getIcon } from '../../../ui/icons/lucide-icons';

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
}

interface LogEntry {
  timestamp: Date;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}


export class ReactivationPanel {
  private container: HTMLElement | null = null;
  private cadenceDays: number[] = [21, 35, 56, 84];
  private eligibleClients: InactiveClient[] = [];
  private selectedClients: Set<string> = new Set();
  private selectedInactiveDay: number | null = null;
  private logs: LogEntry[] = [];
  private templates: Record<string, string> = {};
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

  constructor() {
    // Constructor vazio - render() será chamado externamente
  }

  /**
   * Renderiza o painel de reativação completo.
   */
  public async render(): Promise<HTMLElement> {
    const panel = document.createElement('div');
    panel.className = 'flex flex-col gap-4';
    this.container = panel;

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
      console.error('[REACTIVATION] Erro ao renderizar painel:', error);
      panel.innerHTML = `
        <div class="mettri-error">
          <p>Erro ao carregar painel de reativação.</p>
          <p>Verifique o console para mais detalhes.</p>
          <pre>${error instanceof Error ? error.message : String(error)}</pre>
        </div>
      `;
    }

    return panel;
  }

  /**
   * Carrega configuração da régua do chrome.storage.
   */
  private async loadConfig(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['reactivationCadence', 'reactivationTemplates']);

      if (result.reactivationCadence && Array.isArray(result.reactivationCadence)) {
        this.cadenceDays = result.reactivationCadence;
      }

      if (result.reactivationTemplates) {
        this.templates = result.reactivationTemplates;
      }
    } catch (error) {
      console.error('[REACTIVATION] Erro ao carregar configuração:', error);
      // Não chamar addLog aqui pois o container ainda não foi renderizado
    }
  }

  /**
   * Salva configuração da régua no chrome.storage.
   */
  private async saveConfig(): Promise<void> {
    try {
      await chrome.storage.local.set({
        reactivationCadence: this.cadenceDays,
        reactivationTemplates: this.templates,
      });
      if (this.container) {
        this.addLog('success', 'Configuração salva com sucesso');
      }
    } catch (error) {
      console.error('[REACTIVATION] Erro ao salvar configuração:', error);
      if (this.container) {
        this.addLog('error', 'Erro ao salvar configuração');
      }
    }
  }

  /**
   * Carrega clientes inativos (MOCK - será implementado depois).
   * 
   * TODO: Implementar busca real no IndexedDB
   * - Buscar mensagens agrupadas por chatId
   * - Calcular última mensagem por chat
   * - Filtrar por dias inativos baseado na régua
   * - Calcular cadenceDay (qual dia da régua o cliente está)
   */
  private async loadInactiveClients(): Promise<void> {
    // Dados mock para testar UI
    const now = Date.now();
    const mockClients: InactiveClient[] = [
      {
        chatId: '5511999991111@c.us',
        chatName: 'João Silva',
        phone: '+55 11 99999-1111',
        lastMessageTime: new Date(now - 21 * 24 * 60 * 60 * 1000), // 21 dias atrás
        daysInactive: 21,
        cadenceDay: 21,
        status: 'pending',
      },
      {
        chatId: '5511999992222@c.us',
        chatName: 'Maria Santos',
        phone: '+55 11 99999-2222',
        lastMessageTime: new Date(now - 25 * 24 * 60 * 60 * 1000), // 25 dias atrás
        daysInactive: 25,
        cadenceDay: 21, // Ainda no primeiro dia da régua
        status: 'pending',
      },
      {
        chatId: '5511999993333@c.us',
        chatName: 'Pedro Oliveira',
        phone: '+55 11 99999-3333',
        lastMessageTime: new Date(now - 35 * 24 * 60 * 60 * 1000), // 35 dias atrás
        daysInactive: 35,
        cadenceDay: 35,
        status: 'pending',
      },
      {
        chatId: '5511999994444@c.us',
        chatName: 'Ana Costa',
        phone: '+55 11 99999-4444',
        lastMessageTime: new Date(now - 40 * 24 * 60 * 60 * 1000), // 40 dias atrás
        daysInactive: 40,
        cadenceDay: 35, // Ainda no segundo dia da régua
        status: 'pending',
      },
      {
        chatId: '5511999995555@c.us',
        chatName: 'Carlos Ferreira',
        phone: '+55 11 99999-5555',
        lastMessageTime: new Date(now - 56 * 24 * 60 * 60 * 1000), // 56 dias atrás
        daysInactive: 56,
        cadenceDay: 56,
        status: 'pending',
      },
      {
        chatId: '5511999996666@c.us',
        chatName: 'Juliana Alves',
        phone: '+55 11 99999-6666',
        lastMessageTime: new Date(now - 60 * 24 * 60 * 60 * 1000), // 60 dias atrás
        daysInactive: 60,
        cadenceDay: 56, // Ainda no terceiro dia da régua
        status: 'pending',
      },
      {
        chatId: '5511999997777@c.us',
        chatName: 'Roberto Lima',
        phone: '+55 11 99999-7777',
        lastMessageTime: new Date(now - 84 * 24 * 60 * 60 * 1000), // 84 dias atrás
        daysInactive: 84,
        cadenceDay: 84,
        status: 'pending',
      },
      {
        chatId: '5511999998888@c.us',
        chatName: 'Fernanda Rocha',
        phone: '+55 11 99999-8888',
        lastMessageTime: new Date(now - 90 * 24 * 60 * 60 * 1000), // 90 dias atrás
        daysInactive: 90,
        cadenceDay: 84, // Ainda no último dia da régua
        status: 'pending',
      },
      {
        chatId: '5511999999999@c.us',
        chatName: 'Lucas Martins',
        phone: '+55 11 99999-9999',
        lastMessageTime: new Date(now - 22 * 24 * 60 * 60 * 1000), // 22 dias atrás
        daysInactive: 22,
        cadenceDay: 21,
        status: 'sent', // Já enviado anteriormente
        generatedMessage: 'Olá Lucas Martins! Sentimos sua falta por aqui.',
      },
      {
        chatId: '5511888881111@c.us',
        chatName: 'Patricia Souza',
        phone: '+55 11 88888-1111',
        lastMessageTime: new Date(now - 36 * 24 * 60 * 60 * 1000), // 36 dias atrás
        daysInactive: 36,
        cadenceDay: 35,
        status: 'responded', // Cliente respondeu
        generatedMessage: 'Olá Patricia Souza! Sentimos sua falta por aqui.',
      },
    ];

    // Filtrar apenas clientes que estão em um dia da régua
    this.eligibleClients = mockClients.filter(client => {
      return this.cadenceDays.includes(client.cadenceDay);
    });

    // Calcular cadenceDay correto e primeiro nome formatado para cada cliente
    this.eligibleClients = this.eligibleClients.map(client => {
      const cadenceDay = this.calculateCadenceDay(client.daysInactive);
      const firstName = this.extractFirstName(client.chatName);
      return {
        ...client,
        cadenceDay,
        firstName,
      };
    });

    // Calcular métricas para novo design
    this.totalContacts = 33232; // TODO: Buscar do banco real
    this.eligibleCount = this.eligibleClients.filter(c =>
      c.status === 'pending' && !c.isSpecialList && c.status !== 'excluded'
    ).length;

    // Calcular filtros de período
    this.calculatePeriodFilters();

    this.updateStats();
  }

  /**
   * Gera mensagem personalizada a partir do template.
   */
  private generateMessage(template: string, name: string): string {
    return template.replace(/{{\s*name\s*}}/g, name);
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
  private updateUnifiedInactive(): void {
    this.updateUnifiedFlow();
  }

  /**
   * Atualiza o fluxo unificado completo (inativos + régua + lista + ações).
   */
  private updateUnifiedFlow(): void {
    if (!this.container) return;

    // Usar seletor mais específico para evitar conflitos
    const unifiedContainer = this.container.querySelector('.mettri-reactivation-unified-flow') ||
      this.container.querySelector('.flex.flex-col.gap-4');
    if (unifiedContainer) {
      unifiedContainer.innerHTML = this.renderUnifiedFlow();
      // Reconfigurar listeners após atualizar HTML
      this.setupUnifiedFlowListeners();
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

    // Botão CTA principal de envio
    const sendBtn = this.container?.querySelector('#reactivation-send-selected');
    sendBtn?.addEventListener('click', () => this.sendSelectedClients());
  }

  /**
   * Configura listeners dos filtros de período.
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
   * Alterna seleção de um período.
   */
  private togglePeriodFilter(range: string): void {
    // Determinar range de dias baseado no período
    let minDays = 0;
    let maxDays = Infinity;

    if (range === '21-35') {
      minDays = 21;
      maxDays = 35;
    } else if (range === '36-55') {
      minDays = 36;
      maxDays = 55;
    } else if (range === '56-83') {
      minDays = 56;
      maxDays = 83;
    } else if (range === '+84') {
      minDays = 84;
      maxDays = Infinity;
    }

    // Encontrar clientes no período
    const clientsInRange = this.eligibleClients.filter(c =>
      c.daysInactive >= minDays &&
      c.daysInactive < maxDays &&
      c.status === 'pending' &&
      !c.isSpecialList &&
      c.status !== 'excluded'
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
    this.addLog('info', `${allSelected ? 'Deselecionados' : 'Selecionados'} ${clientsInRange.length} cliente(s) do período ${range}`);
  }

  /**
   * Configura listeners da lista de contatos.
   */
  private setupContactsListeners(): void {
    // Checkboxes de contatos
    const checkboxes = this.container?.querySelectorAll('#reactivation-contacts-list input[type="checkbox"]');
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
    const contactItems = this.container?.querySelectorAll('#reactivation-contacts-list [data-chat-id]');
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
        }
      });
    });

    // Ações do kebab menu
    const excludeBtn = this.container?.querySelector('[data-action="exclude-from-send"]');
    excludeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const chatId = (e.currentTarget as HTMLElement).dataset.chatId;
      if (chatId) {
        this.selectedClients.delete(chatId);
        this.openMenuId = null;
        this.calculatePeriodFilters();
        this.updateUnifiedFlow();
        this.addLog('info', 'Cliente excluído deste envio');
      }
    });

    const blockBtn = this.container?.querySelector('[data-action="block-forever"]');
    blockBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const chatId = (e.currentTarget as HTMLElement).dataset.chatId;
      if (chatId) {
        const client = this.eligibleClients.find(c => c.chatId === chatId);
        if (client) {
          client.status = 'excluded';
          this.selectedClients.delete(chatId);
          this.openMenuId = null;
          this.calculatePeriodFilters();
          this.updateUnifiedFlow();
          this.addLog('warning', `${client.firstName || client.chatName} bloqueado permanentemente`);
        }
      }
    });

    // Botão expandir/colapsar lista
    const expandBtn = this.container?.querySelector('#reactivation-expand-contacts');
    expandBtn?.addEventListener('click', () => {
      this.isContactsExpanded = !this.isContactsExpanded;
      this.updateUnifiedFlow();
    });

    // Fechar menus ao clicar fora
    const closeMenusHandler = (e: MouseEvent) => {
      if (this.openMenuId && !(e.target as HTMLElement).closest('[data-kebab-menu]') && !(e.target as HTMLElement).closest('[data-kebab-dropdown]')) {
        this.openMenuId = null;
        this.updateUnifiedFlow();
      }
    };
    document.addEventListener('click', closeMenusHandler);
  }

  /**
   * Configura listeners do input de mensagem.
   */
  private setupMessageInputListeners(): void {
    const messageInput = this.container?.querySelector('#reactivation-message-input') as HTMLInputElement;
    messageInput?.addEventListener('input', (e) => {
      this.messageText = (e.target as HTMLInputElement).value;
    });

    const sendMessageBtn = this.container?.querySelector('#reactivation-send-message');
    sendMessageBtn?.addEventListener('click', () => {
      if (this.messageText.trim()) {
        // Atualizar templates com a mensagem personalizada
        this.cadenceDays.forEach(day => {
          this.templates[String(day)] = this.messageText;
        });
        this.saveConfig();
        this.addLog('success', 'Mensagem personalizada salva');
        this.messageText = '';
        this.updateUnifiedFlow();
      }
    });
  }

  /**
   * Configura listeners dos headers colapsáveis e kebab menus.
   */
  private setupHeaderActionsListeners(): void {
    // Toggle filtros
    const filtersToggle = this.container?.querySelector('#reactivation-filters-toggle');
    filtersToggle?.addEventListener('click', () => {
      this.isFiltersExpanded = !this.isFiltersExpanded;
      this.updateUnifiedFlow();
    });

    // Toggle contatos
    const contactsToggle = this.container?.querySelector('#reactivation-contacts-toggle');
    contactsToggle?.addEventListener('click', () => {
      this.isContactsExpanded = !this.isContactsExpanded;
      this.updateUnifiedFlow();
    });
  }

  /**
   * Configura listeners da seção unificada de inativos.
   */
  private setupUnifiedInactiveListeners(): void {
    const daySelector = this.container?.querySelector('#reactivation-day-selector');
    const dropdown = this.container?.querySelector('#reactivation-cadence-dropdown');

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
    const closeDropdown = (e: MouseEvent) => {
      if (dropdown && daySelector &&
        !dropdown.contains(e.target as Node) &&
        !daySelector.contains(e.target as Node)) {
        dropdown.style.display = 'none';
      }
    };

    // Adicionar listener global (será removido quando o painel for destruído)
    document.addEventListener('click', closeDropdown);

    // Selecionar dia do dropdown
    const dropdownItems = this.container?.querySelectorAll('#reactivation-cadence-dropdown button[data-day]');
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
    const cadenceOptions = this.container?.querySelectorAll('button[data-day]:not(#reactivation-day-selector)');
    cadenceOptions?.forEach(option => {
      option.addEventListener('click', (e) => {
        const day = parseInt((e.target as HTMLElement).getAttribute('data-day') || '0');
        if (day > 0 && (e.target as HTMLElement).id.startsWith('reactivation-select-day-')) {
          // Este é um botão de seleção, não o grid
          return;
        }
        if (day > 0 && !(e.target as HTMLElement).id.startsWith('reactivation-')) {
          // Grid de períodos
          this.selectedInactiveDay = day;
          this.updateUnifiedFlow();
        }
      });
    });

    // Editar régua
    const editCadenceBtn = this.container?.querySelector('#reactivation-edit-cadence');
    editCadenceBtn?.addEventListener('click', async () => {
      await this.showEditCadenceDialog();
    });
  }

  /**
   * Configura listeners das ações de seleção (Todos, por dia, limpar).
   */
  private setupUnifiedFlowActions(): void {
    // Selecionar todos
    const selectAllBtn = this.container?.querySelector('#reactivation-select-all-days');
    selectAllBtn?.addEventListener('click', () => {
      const selectedDay = this.selectedInactiveDay || this.cadenceDays[0] || 21;
      this.eligibleClients
        .filter(c => c.daysInactive >= selectedDay && c.status === 'pending' && !c.isSpecialList && c.status !== 'excluded')
        .forEach(client => {
          this.selectedClients.add(client.chatId);
        });
      this.updateUnifiedFlow();
      this.addLog('info', `Selecionados todos os clientes elegíveis (${this.selectedClients.size})`);
    });

    // Selecionar por dia específico
    this.cadenceDays.forEach(day => {
      const selectDayBtn = this.container?.querySelector(`#reactivation-select-day-${day}`);
      selectDayBtn?.addEventListener('click', () => {
        const dayClients = this.eligibleClients.filter(c =>
          c.daysInactive >= day &&
          c.daysInactive < (this.cadenceDays[this.cadenceDays.indexOf(day) + 1] || Infinity) &&
          c.status === 'pending' &&
          !c.isSpecialList &&
          c.status !== 'excluded'
        );
        dayClients.forEach(client => {
          this.selectedClients.add(client.chatId);
        });
        this.updateUnifiedFlow();
        this.addLog('info', `Selecionados ${dayClients.length} cliente(s) do ${day}º dia`);
      });
    });

    // Limpar seleção
    const clearBtn = this.container?.querySelector('#reactivation-clear-selection');
    clearBtn?.addEventListener('click', () => {
      this.selectedClients.clear();
      this.updateUnifiedFlow();
      this.addLog('info', 'Seleção limpa');
    });
  }

  /**
   * Configura listeners da lista de destinatários.
   */
  private setupUnifiedRecipients(): void {
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

    // Botão enviar
    const sendBtn = this.container?.querySelector('#reactivation-send-selected');
    sendBtn?.addEventListener('click', () => this.sendSelectedClients());
  }

  /**
   * Adiciona entrada ao log.
   */
  private addLog(type: LogEntry['type'], message: string): void {
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
      <div class="mettri-reactivation-unified-flow flex flex-col gap-4">
        ${this.renderUnifiedFlow()}
      </div>

      <!-- TEMPLATE DE MENSAGEM (SECUNDÁRIO) -->
      <div class="space-y-2">
        <div class="flex items-center justify-between px-1">
          <span class="text-[11px] font-medium text-foreground">Template</span>
          <button class="w-5 h-5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center justify-center" id="reactivation-template-info" title="Placeholders disponíveis">
            <span class="w-3 h-3 flex items-center justify-center">${getIcon('Info')}</span>
          </button>
        </div>
        <div class="glass-subtle rounded-xl p-3" id="reactivation-template-config">
          <span class="text-[10px] text-muted-foreground">Ativo para</span>
          <p class="text-xs font-medium text-foreground">${this.selectedInactiveDay || this.cadenceDays[0]} dias</p>
        </div>
      </div>

      <!-- MONITORAMENTO -->
      <div class="space-y-2">
        <div class="flex items-center justify-between px-1">
          <span class="text-[11px] font-medium text-foreground">Monitoramento</span>
          <button class="h-7 px-2 text-[10px] text-primary hover:bg-primary/10 rounded-lg" id="reactivation-clear-logs">Limpar</button>
        </div>
        <div class="glass-subtle rounded-xl p-3 max-h-48 overflow-y-auto text-xs text-muted-foreground" id="reactivation-logs">
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
  private renderOverview(): string {
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
  private renderPrepareSection(): string {
    const selectedCount = this.selectedClients.size;
    const selectedClients = this.eligibleClients.filter(c => this.selectedClients.has(c.chatId));

    return `
      <div class="mettri-prepare-actions">
        <button class="mettri-btn-link" id="reactivation-select-all-days">Todos</button>
        ${this.cadenceDays.map(day => `
          <button class="mettri-btn-link" data-day="${day}" id="reactivation-select-day-${day}">
            ${day} dias
          </button>
        `).join('')}
        <button class="mettri-btn-link" id="reactivation-clear-selection">Limpar</button>
      </div>
      
      <div class="mettri-prepare-selected">
        <div class="mettri-prepare-selected-header">
          <span class="mettri-section-title-small">Clientes Selecionados (${selectedCount})</span>
        </div>
        <div class="mettri-prepare-clients-list">
          ${this.renderSelectedClientsList(selectedClients)}
        </div>
        <div class="mettri-prepare-send-footer">
          <button class="mettri-btn-primary mettri-btn-send" id="reactivation-send-selected" ${selectedCount === 0 ? 'disabled' : ''}>
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
      const firstName = client.firstName || this.extractFirstName(client.chatName);
      const template = this.templates[String(client.cadenceDay)] || 'Olá {{name}}! Sentimos sua falta por aqui.';
      const message = this.generateMessage(template, firstName);

      return `
        <div class="mettri-prepare-client-card" data-chat-id="${client.chatId}">
          <div class="mettri-prepare-client-main">
            <input type="checkbox" class="mettri-prepare-client-checkbox" 
                   checked data-chat-id="${client.chatId}">
            <div class="mettri-prepare-client-info">
              <div class="mettri-prepare-client-name">${this.escapeHtml(firstName)}</div>
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
      c.status === 'pending' && !c.isSpecialList && c.status !== 'excluded'
    );

    // Clientes elegíveis para exibição
    const eligibleClients = this.eligibleClients.filter(c =>
      c.status === 'pending' && !c.isSpecialList && c.status !== 'excluded'
    );

    return `
      <!-- HEADER: Métricas simples -->
      <div class="space-y-1 mb-4">
        <p class="text-2xl font-bold text-foreground">${this.eligibleCount} inativos elegíveis</p>
        <p class="text-xs text-muted-foreground">de ${this.totalContacts.toLocaleString('pt-BR')} contatos</p>
      </div>

      <!-- BOTÃO CTA PRINCIPAL -->
      <button 
        class="w-full h-11 rounded-xl bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-4" 
        id="reactivation-send-selected" 
        ${selectedCount === 0 ? 'disabled' : ''} 
        type="button"
      >
        Enviar para ${selectedCount}
      </button>

      <!-- SEÇÃO DE FILTROS (Colapsável) -->
      <div class="space-y-2 mb-4">
        <div class="flex items-center justify-between px-1">
          <button 
            class="flex items-center gap-1 text-xs font-medium text-foreground hover:text-primary transition-colors"
            id="reactivation-filters-toggle"
            type="button"
          >
            Selecionados (${selectedCount})
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="transition-transform ${this.isFiltersExpanded ? 'rotate-180' : ''}" id="reactivation-filters-chevron">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button 
            class="w-6 h-6 rounded flex items-center justify-center hover:bg-accent/50 transition-colors"
            id="reactivation-filters-kebab"
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
          <div id="reactivation-period-filters">
            ${this.renderPeriodFilters()}
          </div>
        ` : ''}
      </div>

      <!-- SEÇÃO DE CONTATOS (Colapsável) -->
      <div class="space-y-2 mb-4">
        <div class="flex items-center justify-between px-1">
          <button 
            class="flex items-center gap-1 text-xs font-medium text-foreground hover:text-primary transition-colors"
            id="reactivation-contacts-toggle"
            type="button"
          >
            Selecionados (${selectedCount})
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="transition-transform ${this.isContactsExpanded ? 'rotate-180' : ''}" id="reactivation-contacts-chevron">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button 
            class="w-6 h-6 rounded flex items-center justify-center hover:bg-accent/50 transition-colors"
            id="reactivation-contacts-kebab"
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
          <div class="space-y-0.5" id="reactivation-contacts-list">
            ${selectedCount > 0 ? this.renderContactsList(selectedClients) : this.renderEmptyRecipients(eligibleClients)}
          </div>
          
          ${selectedClients.length > 6 ? `
            <button 
              class="w-full h-8 rounded-lg text-xs text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-1"
              id="reactivation-expand-contacts"
              type="button"
            >
              ${this.isContactsExpanded ? 'Ver menos' : 'Ver todos >'}
            </button>
          ` : ''}
        ` : ''}
      </div>

      <!-- INPUT DE MENSAGEM -->
      <div class="flex items-center gap-2 p-2 rounded-xl border border-border bg-background">
        <span class="text-lg">😊</span>
        <input 
          type="text" 
          class="flex-1 bg-transparent text-sm placeholder:text-muted-foreground outline-none"
          placeholder="Escreva uma mensagem..."
          value="${this.escapeHtml(this.messageText)}"
          id="reactivation-message-input"
        />
        <button 
          class="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
          id="reactivation-send-message"
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M13 1L7 7M13 1l-5 5M13 1H1l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
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
              <span class="text-xs font-medium">${filter.range}</span>
              <span class="text-[10px] opacity-70">(${filter.count})</span>
            </button>
          `;
    }).join('')}
      </div>
    `;
  }

  /**
   * Renderiza lista de contatos simples: checkbox + nome + dias + kebab menu.
   */
  private renderContactsList(clients: InactiveClient[]): string {
    // Limitar a 6 itens quando não expandida
    const displayClients = this.isContactsExpanded ? clients : clients.slice(0, 6);

    return displayClients.map(client => {
      const firstName = client.firstName || this.extractFirstName(client.chatName);
      const isSelected = this.selectedClients.has(client.chatId);
      const isMenuOpen = this.openMenuId === client.chatId;

      return `
        <div class="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30 transition-colors relative" data-chat-id="${client.chatId}">
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
          <span class="text-xs font-medium text-foreground flex-1">${this.escapeHtml(firstName)}</span>
          <span class="text-[10px] text-muted-foreground">${client.daysInactive}d</span>
          <button 
            class="w-6 h-6 rounded flex items-center justify-center hover:bg-accent/50 transition-colors relative" 
            data-kebab-menu="${client.chatId}"
            type="button"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="3.5" r="1.5" fill="currentColor" class="text-muted-foreground"/>
              <circle cx="7" cy="7" r="1.5" fill="currentColor" class="text-muted-foreground"/>
              <circle cx="7" cy="10.5" r="1.5" fill="currentColor" class="text-muted-foreground"/>
            </svg>
            ${isMenuOpen ? this.renderKebabMenu(client.chatId) : ''}
          </button>
        </div>
      `;
    }).join('');
  }

  /**
   * Renderiza menu kebab dropdown para um contato.
   */
  private renderKebabMenu(chatId: string): string {
    return `
      <div class="absolute right-0 top-full mt-1 w-48 rounded-xl glass border border-border shadow-xl z-50" data-kebab-dropdown="${chatId}">
        <button 
          class="w-full rounded-lg cursor-pointer gap-2.5 text-xs flex items-center px-2 py-1.5 focus:bg-accent transition-colors"
          data-action="exclude-from-send"
          data-chat-id="${chatId}"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="w-3.5 h-3.5 text-muted-foreground">
            <path d="M11 3L3 11M3 3l8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span>Excluir deste envio</span>
        </button>
        <div class="bg-border/30 my-1 h-px"></div>
        <button 
          class="w-full rounded-lg cursor-pointer gap-2.5 text-xs flex items-center px-2 py-1.5 text-destructive focus:bg-destructive/10 focus:text-destructive transition-colors"
          data-action="block-forever"
          data-chat-id="${chatId}"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="w-3.5 h-3.5 text-destructive">
            <path d="M7 1L1 3v4c0 3.5 2.5 6.5 6 7.5 3.5-1 6-4 6-7.5V3L7 1z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Bloquear para sempre</span>
        </button>
      </div>
    `;
  }

  /**
   * Renderiza lista de destinatários no formato unificado (mantido para compatibilidade).
   */
  private renderUnifiedRecipientsList(clients: InactiveClient[]): string {
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
  private getInactiveCountForDay(day: number): number {
    return this.eligibleClients.filter(client => client.daysInactive >= day).length;
  }

  /**
   * Calcula filtros de período (21-35, 36-55, 56-83, +84) com contagens e estado.
   */
  private calculatePeriodFilters(): void {
    const filters: Array<{
      range: string;
      count: number;
      selected: boolean;
      variant: 'outline' | 'filled';
    }> = [];

    // Período 21-35
    const count21_35 = this.eligibleClients.filter(c =>
      c.daysInactive >= 21 && c.daysInactive < 36 &&
      c.status === 'pending' && !c.isSpecialList && c.status !== 'excluded'
    ).length;
    const selected21_35 = this.eligibleClients.filter(c =>
      c.daysInactive >= 21 && c.daysInactive < 36 &&
      this.selectedClients.has(c.chatId)
    ).length > 0;

    filters.push({
      range: '21-35',
      count: count21_35,
      selected: selected21_35,
      variant: selected21_35 ? 'filled' : 'outline',
    });

    // Período 36-55
    const count36_55 = this.eligibleClients.filter(c =>
      c.daysInactive >= 36 && c.daysInactive < 56 &&
      c.status === 'pending' && !c.isSpecialList && c.status !== 'excluded'
    ).length;
    const selected36_55 = this.eligibleClients.filter(c =>
      c.daysInactive >= 36 && c.daysInactive < 56 &&
      this.selectedClients.has(c.chatId)
    ).length > 0;

    filters.push({
      range: '36-55',
      count: count36_55,
      selected: selected36_55,
      variant: selected36_55 ? 'filled' : 'outline',
    });

    // Período 56-83
    const count56_83 = this.eligibleClients.filter(c =>
      c.daysInactive >= 56 && c.daysInactive < 84 &&
      c.status === 'pending' && !c.isSpecialList && c.status !== 'excluded'
    ).length;
    const selected56_83 = this.eligibleClients.filter(c =>
      c.daysInactive >= 56 && c.daysInactive < 84 &&
      this.selectedClients.has(c.chatId)
    ).length > 0;

    filters.push({
      range: '56-83',
      count: count56_83,
      selected: selected56_83,
      variant: selected56_83 ? 'filled' : 'outline',
    });

    // Período +84 (sempre variant filled quando selecionado)
    const count84Plus = this.eligibleClients.filter(c =>
      c.daysInactive >= 84 &&
      c.status === 'pending' && !c.isSpecialList && c.status !== 'excluded'
    ).length;
    const selected84Plus = this.eligibleClients.filter(c =>
      c.daysInactive >= 84 &&
      this.selectedClients.has(c.chatId)
    ).length > 0;

    filters.push({
      range: '+84',
      count: count84Plus,
      selected: selected84Plus,
      variant: selected84Plus ? 'filled' : 'outline', // +84 sempre filled quando selecionado
    });

    this.periodFilters = filters;
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
   * Calcula qual dia da régua um cliente está baseado nos dias inativos.
   * Retorna o maior dia da régua que o cliente já atingiu.
   */
  private calculateCadenceDay(daysInactive: number): number {
    // Encontrar o maior dia da régua que o cliente já atingiu
    let cadenceDay = this.cadenceDays[0]; // Primeiro dia por padrão

    for (let i = this.cadenceDays.length - 1; i >= 0; i--) {
      if (daysInactive >= this.cadenceDays[i]) {
        cadenceDay = this.cadenceDays[i];
        break;
      }
    }

    return cadenceDay;
  }

  /**
   * Renderiza cards de estatísticas.
   */
  private renderStats(): void {
    if (!this.container) return;

    const statsContainer = this.container.querySelector('#reactivation-stats');
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
   * Renderiza configuração de templates.
   */
  private renderTemplateConfig(): string {
    const selectedDay = this.cadenceDays[0] || 21;
    const template = this.templates[String(selectedDay)] || 'Olá {{name}}! Sentimos sua falta por aqui.';

    return `
      <div class="mettri-template-config-row">
        <label class="mettri-label">Template para <select class="mettri-select-inline" id="reactivation-template-day">
          ${this.cadenceDays.map(day =>
      `<option value="${day}" ${day === selectedDay ? 'selected' : ''}>${day} dias</option>`
    ).join('')}
        </select></label>
      </div>
      <div class="mettri-template-config-row">
        <textarea class="mettri-input mettri-textarea mettri-template-textarea" id="reactivation-template-text" 
                  placeholder="Olá {{name}}! Sentimos sua falta por aqui...">${this.escapeHtml(template)}</textarea>
      </div>
      <div class="mettri-message-preview">
        <div class="mettri-message-bubble">
          ${this.escapeHtml(this.generateMessage(template, 'João'))}
        </div>
        <div class="mettri-message-time">${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ✓✓</div>
      </div>
    `;
  }



  /**
   * Renderiza logs de monitoramento.
   */
  private renderLogs(): void {
    if (!this.container) return;

    const logsContainer = this.container.querySelector('#reactivation-logs');
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



    // Info de placeholders
    const templateInfoBtn = this.container?.querySelector('#reactivation-template-info');
    templateInfoBtn?.addEventListener('click', () => this.showPlaceholdersInfo());

    // Mudar dia do template
    const templateDaySelect = this.container?.querySelector('#reactivation-template-day');
    templateDaySelect?.addEventListener('change', () => {
      this.updateTemplatePreview();
      this.updateTemplateForDay();
    });

    // Salvar template automaticamente ao editar
    const templateText = this.container?.querySelector('#reactivation-template-text');
    templateText?.addEventListener('input', () => {
      this.updateTemplatePreview();
      this.saveTemplateAuto();
    });




    // Limpar logs
    const clearLogsBtn = this.container?.querySelector('#reactivation-clear-logs');
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
        this.addLog('info', `${client.firstName || client.chatName} - Pulado para hoje`);
        break;

      case 'exclude':
        client.status = 'excluded';
        this.selectedClients.delete(chatId);
        this.addLog('info', `${client.firstName || client.chatName} - Removido da lista`);
        break;

      case 'special-list':
        client.isSpecialList = true;
        this.selectedClients.delete(chatId);
        this.addLog('info', `${client.firstName || client.chatName} - Movido para lista especial`);
        break;
    }

    this.updateUnifiedFlow();
  }

  /**
   * Deseleciona todos os clientes.
   */
  private deselectAllClients(): void {
    this.selectedClients.clear();
    this.updateUnifiedFlow();
  }



  /**
   * Envia mensagens para clientes selecionados.
   */
  private async sendSelectedClients(): Promise<void> {
    if (this.selectedClients.size === 0) {
      this.addLog('warning', 'Nenhum cliente selecionado');
      return;
    }

    const clientsToSend = Array.from(this.selectedClients);
    this.addLog('info', `Iniciando envio para ${clientsToSend.length} cliente(s)...`);

    for (const chatId of clientsToSend) {
      await this.sendToClient(chatId);
      // Rate limiting: 1 mensagem a cada 5 segundos
      if (clientsToSend.indexOf(chatId) < clientsToSend.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    this.selectedClients.clear();
    this.updateUnifiedFlow();
    this.addLog('success', `Envio concluído para ${clientsToSend.length} cliente(s)`);
  }

  /**
   * Envia mensagem para um cliente específico.
   */
  private async sendToClient(chatId: string): Promise<void> {
    const client = this.eligibleClients.find(c => c.chatId === chatId);
    if (!client) {
      this.addLog('error', `Cliente não encontrado: ${chatId}`);
      return;
    }

    try {
      const template = this.templates[String(client.cadenceDay)] || 'Olá {{name}}!';
      const firstName = client.firstName || this.extractFirstName(client.chatName);
      const message = this.generateMessage(template, firstName);

      // TODO: Implementar envio real via WhatsApp
      // const interceptors = new WhatsAppInterceptors();
      // await interceptors.initialize();
      // await interceptors.addAndSendMsgToChat(client.chatId, message);

      // MOCK: Simular envio (1 segundo de delay)
      await new Promise(resolve => setTimeout(resolve, 1000));

      client.status = 'sent';
      client.generatedMessage = message;
      this.addLog('success', `${client.firstName || client.chatName} - Enviado`);
      this.updateUnifiedFlow();
    } catch (error) {
      this.addLog('error', `${client.firstName || client.chatName} - Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Mostra informações sobre placeholders disponíveis.
   */
  private showPlaceholdersInfo(): void {
    const info = `
Placeholders disponíveis:

{{name}} - Primeiro nome do cliente
{{phone}} - Telefone do cliente
{{days}} - Dias inativos

Exemplo:
Olá {{name}}! Sentimos sua falta por aqui. Faz {{days}} dias que não conversamos.
    `.trim();

    alert(info);
  }

  /**
   * Atualiza preview do template.
   */
  private updateTemplatePreview(): void {
    const templateText = this.container?.querySelector('#reactivation-template-text') as HTMLTextAreaElement;
    const preview = this.container?.querySelector('.mettri-message-bubble');

    if (templateText && preview) {
      const template = templateText.value;
      const message = this.generateMessage(template, 'João');
      preview.textContent = message;
    }
  }

  /**
   * Atualiza template quando muda o dia selecionado.
   */
  private updateTemplateForDay(): void {
    const daySelect = this.container?.querySelector('#reactivation-template-day') as HTMLSelectElement;
    const templateText = this.container?.querySelector('#reactivation-template-text') as HTMLTextAreaElement;

    if (daySelect && templateText) {
      const day = daySelect.value;
      const template = this.templates[day] || 'Olá {{name}}! Sentimos sua falta por aqui.';
      templateText.value = template;
      this.updateTemplatePreview();
    }
  }

  /**
   * Salva template automaticamente (sem botão).
   */
  private saveTemplateAuto(): void {
    const daySelect = this.container?.querySelector('#reactivation-template-day') as HTMLSelectElement;
    const templateText = this.container?.querySelector('#reactivation-template-text') as HTMLTextAreaElement;

    if (daySelect && templateText) {
      const day = daySelect.value;
      this.templates[day] = templateText.value;
      this.saveConfig();
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
}
