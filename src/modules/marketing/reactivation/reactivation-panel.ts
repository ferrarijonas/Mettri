/**
 * ReactivationPanel
 * 
 * Painel de reativação de clientes inativos.
 * Permite configurar régua de cadência, visualizar clientes elegíveis,
 * gerar mensagens personalizadas e enviar em massa.
 */

import { getIcon } from '../../../ui/icons/lucide-icons';
import { messageDB } from '../../../storage/message-db';
import { clientDB, digitsOnly, normalizePhoneDigitsWithAliases } from '../../../storage/client-db';
import { daysBetweenByCalendar } from './inactive-days';
import { classifyNameCandidate } from '../../clientes/name-likelihood';
import { MettriBridgeClient } from '../../../content/bridge-client';
import { sendMessageService } from '../../../infrastructure/services';

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
  private selectedClients = new Set<string>();
  private selectedInactiveDay: number | null = null;
  private logs: LogEntry[] = [];
  private stats = {
    totalEligible: 0,
    selected: 0,
    sentToday: 0,
    responseRate: 0,
  };

  // Propriedades para novo design
  private totalContacts = 0;
  private eligibleCount = 0;
  private periodFilters: {
    range: string;
    count: number;
    selected: boolean;
    variant: 'outline' | 'filled';
  }[] = [];
  private isFiltersExpanded = true;
  private isContactsExpanded = true;
  private openMenuId: string | null = null;
  private messageText = "";
  private closeMenusHandler: ((e: MouseEvent) => void) | null = null;
  private closeDropdownHandler: ((e: MouseEvent) => void) | null = null;

  private testContact: { phone: string; name: string } | null = null;
  private testModeEnabled = false;
  private bridge = new MettriBridgeClient(2500);
  private sendButtonClickHandler: ((e: MouseEvent) => void) | null = null;

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
   * Carrega configuração da régua via bridge (chrome.storage não disponível em world: MAIN).
   */
  private async loadConfig(): Promise<void> {
    try {
      const result = await this.bridge.storageGet([
        'reactivationCadence',
        'reactivationTestContact',
        'reactivationTestModeEnabled',
      ]);

      if (result.reactivationCadence && Array.isArray(result.reactivationCadence)) {
        this.cadenceDays = result.reactivationCadence;
      }

      if (result.reactivationTestContact && typeof result.reactivationTestContact === 'object') {
        const t = result.reactivationTestContact as { phone?: string; name?: string };
        if (typeof t.phone === 'string' && typeof t.name === 'string') {
          this.testContact = { phone: t.phone, name: t.name };
        }
      }

      if (typeof result.reactivationTestModeEnabled === 'boolean') {
        this.testModeEnabled = result.reactivationTestModeEnabled;
      }
    } catch (error) {
      console.error('[REACTIVATION] Erro ao carregar configuração:', error);
      // Não chamar addLog aqui pois o container ainda não foi renderizado
    }
  }

  /**
   * Salva configuração da régua via bridge (chrome.storage não disponível em world: MAIN).
   */
  private async saveConfig(): Promise<void> {
    try {
      await this.bridge.storageSet({
        reactivationCadence: this.cadenceDays,
        reactivationTestContact: this.testContact,
        reactivationTestModeEnabled: this.testModeEnabled,
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
   * Carrega clientes inativos (REAL via IndexedDB).
   *
   * Regra atual (simples):
   * - última atividade = última mensagem RECEBIDA (incoming)
   * - elegível quando daysInactive é exatamente um valor da régua (21/35/56/84)
   */
  private async loadInactiveClients(): Promise<void> {
    const now = new Date();

    const lastIncomingByContact = await messageDB.getLastIncomingByContact();

    // Métrica simples (contatos que têm ao menos 1 mensagem recebida)
    this.totalContacts = lastIncomingByContact.size;

    const clients: InactiveClient[] = [];

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

      clients.push({
        chatId: value.chatId,
        chatName: value.chatName,
        phone,
        lastMessageTime: value.lastIncomingAt,
        daysInactive,
        cadenceDay: daysInactive, // semântica: dia exato
        status: 'pending',
        firstName,
      });
    }

    // Ordenar por mais “frios” primeiro (opcional, mas útil)
    clients.sort((a, b) => b.daysInactive - a.daysInactive);

    this.eligibleClients = clients;

    // Default de seleção de dia
    if (!this.selectedInactiveDay) {
      this.selectedInactiveDay = this.cadenceDays[0] || 21;
    }

    this.eligibleCount = this.eligibleClients.filter(c => c.status === 'pending' && !c.isSpecialList).length;
    this.calculatePeriodFilters();
    this.updateStats();
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
    this.setupTestSectionListeners();
    this.setupSendButtonListener();
  }

  /**
   * Configura listener do botão de enviar.
   */
  private setupSendButtonListener(): void {
    const sendBtn = this.container?.querySelector('#reactivation-send-selected');
    sendBtn?.addEventListener('click', async () => {
      if (sendBtn.hasAttribute('disabled')) return;
      
      // Desabilitar botão durante envio
      if (sendBtn) {
        (sendBtn as HTMLButtonElement).disabled = true;
      }

      try {
        await this.sendSelectedClients();
      } catch (error) {
        this.addLog('error', `Erro ao enviar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      } finally {
        // Reabilitar botão
        if (sendBtn) {
          (sendBtn as HTMLButtonElement).disabled = false;
        }
      }
    });
  }

  /**
   * Configura listeners da seção de envio de teste.
   */
  private setupTestSectionListeners(): void {
    const checkbox = this.container?.querySelector('#reactivation-test-mode') as HTMLInputElement;
    checkbox?.addEventListener('change', () => {
      this.testModeEnabled = !!checkbox.checked;
      this.saveConfig();
      this.updateUnifiedFlow();
    });

    // Salvar automaticamente ao digitar nos campos de teste
    const phoneInput = this.container?.querySelector('#reactivation-test-phone') as HTMLInputElement;
    phoneInput?.addEventListener('blur', () => {
      const phone = phoneInput?.value?.trim() ?? '';
      const nameInput = this.container?.querySelector('#reactivation-test-name') as HTMLInputElement;
      const name = nameInput?.value?.trim() ?? '';
      const digits = digitsOnly(phone);
      if (digits.length >= 10) {
        this.testContact = { phone, name };
        this.saveConfig();
        this.updateUnifiedFlow();
      }
    });

    const nameInput = this.container?.querySelector('#reactivation-test-name') as HTMLInputElement;
    nameInput?.addEventListener('blur', () => {
      const phoneInput = this.container?.querySelector('#reactivation-test-phone') as HTMLInputElement;
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
    const day = parseInt(range, 10);
    if (!Number.isFinite(day)) return;

    // Selecionar o “dia ativo” (útil para texto/template)
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
          this.addLog('warning', `${client.firstName || client.phone || 'Sem nome'} bloqueado permanentemente`);
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
  }

  /**
   * Configura listeners do input de mensagem.
   */
  private setupMessageInputListeners(): void {
    const messageInput = this.container?.querySelector('#reactivation-message-input') as HTMLTextAreaElement;
    messageInput?.addEventListener('input', (e) => {
      this.messageText = (e.target as HTMLTextAreaElement).value;
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
  public setupUnifiedInactiveListeners(): void {
    const daySelector = this.container?.querySelector('#reactivation-day-selector') as HTMLElement | null;
    const dropdown = this.container?.querySelector('#reactivation-cadence-dropdown') as HTMLElement | null;

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
  public setupUnifiedFlowActions(): void {
    // Selecionar todos
    const selectAllBtn = this.container?.querySelector('#reactivation-select-all-days');
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
      const selectDayBtn = this.container?.querySelector(`#reactivation-select-day-${day}`);
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
      console.error('[REACTIVATION]', message);
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
      <div class="mettri-reactivation-unified-flow flex flex-col gap-4">
        ${this.renderUnifiedFlow()}
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
      <!-- HEADER: Métricas simples -->
      <div class="space-y-1 mb-2">
        <p class="text-2xl font-bold text-foreground">${this.eligibleCount} inativos elegíveis</p>
        <p class="text-xs text-muted-foreground">de ${this.totalContacts.toLocaleString('pt-BR')} contatos</p>
      </div>


      <!-- SEÇÃO DE FILTROS (Colapsável) -->
      <div class="space-y-2 mb-2">
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
      <div class="space-y-1 mb-2">
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
      <div class="flex items-start gap-2 p-2 rounded-xl border-2 border-border bg-background">
        <span class="text-lg mt-1">😊</span>
        <textarea 
          rows="3"
          class="flex-1 bg-transparent text-sm placeholder:text-muted-foreground outline-none resize-none"
          placeholder="Escreva uma mensagem..."
          id="reactivation-message-input"
        >${this.escapeHtml(this.messageText)}</textarea>
      </div>

      <!-- MODO TESTE -->
      <div class="mt-0.5">
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" id="reactivation-test-mode" ${this.testModeEnabled ? 'checked' : ''} />
          <span class="text-[10px] text-muted-foreground">Modo teste</span>
        </label>
      </div>

      <!-- BOTÃO DE ENVIAR -->
      <div class="mt-1.5">
        <button 
          class="w-full h-10 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          id="reactivation-send-selected"
          type="button"
          ${selectedCount === 0 && !this.testModeEnabled ? 'disabled' : ''}
        >
          ${this.testModeEnabled ? 'Enviar Teste' : selectedCount > 0 ? `Enviar (${selectedCount})` : 'Enviar'}
        </button>
      </div>

      <!-- CAMPOS DE TESTE (quando modo teste ativo) -->
      ${this.testModeEnabled ? `
        <div class="mt-2 p-2 rounded-lg border border-border/50 bg-accent/30">
          <div class="grid grid-cols-2 gap-2">
            <div class="relative">
              <input 
                type="text"
                class="w-full px-2 pr-7 py-1.5 rounded-lg border border-border bg-background text-sm outline-none"
                id="reactivation-test-phone" 
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
                id="reactivation-test-name" 
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
              <span class="text-xs font-medium">${filter.range}d</span>
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
      const firstName = client.firstName || '';
      const displayLabel = firstName || client.phone || 'Sem nome';
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
          <span class="text-xs font-medium text-foreground flex-1">${this.escapeHtml(displayLabel)}</span>
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
      return;
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
    if (this.closeMenusHandler) {
      document.removeEventListener('click', this.closeMenusHandler);
      this.closeMenusHandler = null;
    }
    if (this.closeDropdownHandler) {
      document.removeEventListener('click', this.closeDropdownHandler);
      this.closeDropdownHandler = null;
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
