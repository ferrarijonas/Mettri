import type { CapturedMessage, PanelState, UserSession } from '../types';
import type { MessageCapturer } from '../core/message-capturer';
import { messageDB } from '../storage/message-db';
import { ModuleRegistry, PanelShell, EventBus, emitPanelNavigate, onPanelNavigate } from './core';
import { getIcon } from './icons/lucide-icons';
import { KebabMenu } from './components/kebab-menu';
import { UserSessionModal } from './components/user-session-modal';
import { SettingsModal } from './components/settings-modal';
import { getExtensionResourceUrl } from './core/extension-url';
import { MettriBridgeClient } from '../content/bridge-client';
import { LocalBatchExporter } from '../infrastructure/local-batch-exporter';
import { ActiveChatService } from '../infrastructure/active-chat-service';
import { ModuleUpdater } from '../infrastructure/module-updater';

type PanelSettings = Record<string, unknown> & {
  historyEnabled?: unknown;
};

function readHistoryEnabled(settings: unknown): boolean {
  if (!settings || typeof settings !== 'object') return false;
  const record = settings as PanelSettings;
  return record.historyEnabled === true;
}

export class MettriPanel {
  private hostEl: HTMLDivElement | null = null;
  private shadow: ShadowRoot | null = null;
  private shadowContainer: HTMLDivElement | null = null;
  private container: HTMLElement | null = null;
  private navbar: HTMLElement | null = null;
  private messagesContainer: HTMLElement | null = null;
  private registry: ModuleRegistry;
  private panelShell: PanelShell | null = null;
  private eventBus: EventBus;
  private disposePanelNavigate: (() => void) | null = null;
  private enviarMenu: KebabMenu | null = null;
  private clientesMenu: KebabMenu | null = null;
  private currentModuleId: string = 'atendimento.dashboard'; // Módulo padrão
  private userSessionModal: UserSessionModal | null = null;
  private settingsModal: SettingsModal | null = null;
  private moduleUpdater: ModuleUpdater | null = null;
  private isDarkMode: boolean = false; // Estado do dark mode
  private userSession: UserSession | null = null; // Sessão do usuário atual
  private capturer: MessageCapturer | null = null;
  private bridge = new MettriBridgeClient(2500);
  private historyEnabled: boolean = false; // Toggle do Histórico (persistido)
  private exporter: LocalBatchExporter | null = null;
  private activeChat: ActiveChatService | null = null;
  private state: PanelState = {
    isVisible: true,
    isCapturing: false,
    messages: [],
    currentChatId: null,
  };

  constructor() {
    // Inicializar Plugin System
    this.registry = new ModuleRegistry();
    this.eventBus = new EventBus();
    this.init();
  }

  private async init(): Promise<void> {
    this.ensureShadowRoot();
    this.injectBaseStyles();
    this.createNavBar();
    this.createSidebar();
    this.createToggleButton();
    this.userSessionModal = new UserSessionModal();
    
    // Inicializar sistema de atualização de módulos
    this.moduleUpdater = new ModuleUpdater();
    this.registry.setModuleUpdater(this.moduleUpdater);
    this.settingsModal = new SettingsModal(this.moduleUpdater);
    
    // Inicializar UI com aviso (conta ainda não detectada)
    this.updateUserSessionUI(null);

    // Carregar settings antes de renderizar módulos (para o Histórico nascer OFF por padrão)
    await this.loadAndApplySettings();
    await this.initializePluginSystem();
    this.startActiveChatService();
    this.startExportScheduler();
    this.loadMessages();
  }

  private startActiveChatService(): void {
    if (this.activeChat) return;
    this.activeChat = new ActiveChatService({ pollMs: 750 });

    this.activeChat.onChange((chatId) => {
      this.state.currentChatId = chatId;
      this.eventBus.emit('chat:active-changed', { chatId });
    });

    this.activeChat
      .start()
      .catch((error) => console.warn('[MettriPanel] Falha ao iniciar ActiveChatService:', error));
  }

  private startExportScheduler(): void {
    if (this.exporter) return;
    this.exporter = new LocalBatchExporter({
      // checagens periódicas leves enquanto o WhatsApp estiver aberto
      intervalMs: 30 * 60 * 1000,
      nearLimitThreshold: 9000,
    });
    this.exporter.start();
    // Debug via console
    window.MettriExporter = this.exporter;
  }

  /**
   * Cria a NavBar vertical (lado direito) - Design v0
   */
  private createNavBar(): void {
    const navbar = document.createElement('div');
    navbar.id = 'mettri-navbar';
    navbar.className = 'fixed top-0 right-0 w-14 h-screen bg-primary flex flex-col items-center py-3 gap-1';

    navbar.innerHTML = `
      <!-- Toggle Sidebar Button -->
      <button class="w-10 h-10 rounded-xl text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-all mb-2 flex items-center justify-center" id="mettri-navbar-toggle" title="Fechar painel">
        <span class="w-5 h-5">${getIcon('ChevronRight')}</span>
      </button>

      <div class="w-8 h-px bg-primary-foreground/20 my-1"></div>

      <!-- Module: Atendimento -->
      <button class="w-10 h-10 rounded-xl transition-all text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 mettri-navbar-module flex items-center justify-center" data-module-id="atendimento" title="Atendimento">
        <span class="w-5 h-5">${getIcon('MessageSquare')}</span>
      </button>

      <!-- Module: Clientes / Histórico -->
      <button class="w-10 h-10 rounded-xl transition-all text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 mettri-navbar-module flex items-center justify-center" data-module-id="clientes" title="Clientes - Histórico de conversas">
        <span class="w-5 h-5">${getIcon('Users')}</span>
      </button>

      <!-- Module: Infraestrutura / Testes -->
      <button class="w-10 h-10 rounded-xl transition-all text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 mettri-navbar-module flex items-center justify-center" data-module-id="infraestrutura" title="Infraestrutura - Testes e Sentinela">
        <span class="w-5 h-5">${getIcon('Server')}</span>
      </button>

      <!-- Module: Marketing / Reativação -->
      <button class="w-10 h-10 rounded-xl transition-all text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 mettri-navbar-module flex items-center justify-center" data-module-id="marketing" title="Marketing - Enviar">
        <span class="w-5 h-5">${getIcon('Megaphone')}</span>
      </button>

      <div class="flex-1"></div>

      <div class="w-8 h-px bg-primary-foreground/20 my-1"></div>

      <!-- User Session -->
      <div class="relative flex items-center justify-center">
        <button class="w-10 h-10 rounded-full overflow-hidden border-2 border-primary-foreground/20 hover:border-primary-foreground/40 transition-all" id="mettri-user-session" title="Conta">
          <img id="mettri-user-avatar" src="" alt="User" class="w-full h-full object-cover" style="display: none;">
          <div id="mettri-user-fallback" class="w-full h-full bg-primary-foreground/20 flex items-center justify-center text-primary-foreground text-xs">
            <span id="mettri-user-initials">?</span>
          </div>
        </button>
        <!-- Aviso quando conta não detectada -->
        <span id="mettri-user-warning" class="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full flex items-center justify-center text-white text-[10px] font-bold hidden" title="Conta não detectada - tentando novamente...">⚠</span>
      </div>

      <!-- Settings -->
      <button class="w-10 h-10 rounded-xl text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-all flex items-center justify-center" id="mettri-navbar-help" title="Ajuda">
        <span class="w-5 h-5">${getIcon('HelpCircle')}</span>
      </button>

      <button class="w-10 h-10 rounded-xl text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-all flex items-center justify-center" id="mettri-navbar-settings" title="Configurações">
        <span class="w-5 h-5">${getIcon('Settings')}</span>
      </button>

      <!-- Dark Mode Toggle -->
      <button class="w-10 h-10 rounded-xl text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-all flex items-center justify-center" id="mettri-navbar-darkmode" title="Alternar modo escuro">
        <span class="w-5 h-5">${getIcon('Moon')}</span>
      </button>
    `;

    this.shadowContainer?.appendChild(navbar);
    this.navbar = navbar;

    this.setupNavBarListeners();
  }

  /**
   * Cria o Sidebar (painel de conteúdo) - Design v0
   */
  private createSidebar(): void {
    const sidebar = document.createElement('div');
    sidebar.id = 'mettri-panel';
    sidebar.className = 'fixed top-0 right-14 w-[300px] h-full glass flex flex-col z-[9999]';

    // Título inicial será atualizado quando módulo carregar
    sidebar.innerHTML = `
      <!-- Header -->
      <div class="h-12 px-4 flex items-center justify-between bg-primary">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-primary-foreground" id="mettri-sidebar-title">Histórico</span>
        </div>
        <div class="flex items-center gap-0.5">
          <button class="w-7 h-7 rounded-lg text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10" id="mettri-kebab-menu" title="Menu">
            ${getIcon('MoreVertical')}
          </button>
          <button class="w-7 h-7 rounded-lg text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10" id="mettri-minimize" title="Minimizar">
            ${getIcon('Minus')}
          </button>
          <button class="w-7 h-7 rounded-lg text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10" id="mettri-close" title="Fechar">
            ${getIcon('X')}
          </button>
        </div>
      </div>

      <!-- Status Bar -->
      <div class="px-4 py-2 flex items-center justify-between border-b border-border/20">
        <div class="flex items-center gap-2">
          <div class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" id="mettri-status-dot"></div>
          <span class="text-[11px] text-muted-foreground" id="mettri-status-text">Sincronizado</span>
        </div>
        <div class="flex items-center gap-2" id="mettri-status-actions">
          <!-- Toggle do Histórico (só aparece no módulo Histórico) -->
          <div class="flex items-center gap-1.5" id="mettri-history-toggle-wrap" style="display: none;">
            <span class="text-[10px] text-muted-foreground">Histórico</span>
            <label class="relative inline-flex items-center cursor-pointer select-none">
              <input type="checkbox" id="mettri-history-toggle" class="sr-only peer">
              <!-- trilho com contorno sempre visível -->
              <span class="w-9 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 border border-black/45 dark:border-white/40 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.20)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.20)] peer-checked:bg-primary transition-colors"></span>
              <!-- “bolinha” com contorno -->
              <span class="absolute left-[2px] top-[2px] w-4 h-4 rounded-full bg-white dark:bg-zinc-100 border border-black/60 dark:border-white/60 shadow-md peer-checked:left-[18px] transition-all"></span>
            </label>
          </div>

          <button class="w-6 h-6 rounded-md text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center" id="mettri-refresh" title="Atualizar">
            <span class="w-3.5 h-3.5">${getIcon('RefreshCw')}</span>
          </button>

          <!-- Menu de navegação de Clientes (apenas em clientes.*) -->
          <button class="w-6 h-6 rounded-md text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center" id="mettri-clientes-menu" title="Clientes" style="display: none;">
            <span class="w-3.5 h-3.5">${getIcon('MoreVertical')}</span>
          </button>

          <!-- Menu de navegação do Enviar (apenas em marketing.enviar.*) -->
          <button class="w-6 h-6 rounded-md text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center" id="mettri-enviar-menu" title="Enviar" style="display: none;">
            <span class="w-3.5 h-3.5">${getIcon('MoreVertical')}</span>
          </button>
        </div>
      </div>

      <!-- Content Area -->
      <div class="flex-1 overflow-y-auto px-3 pb-4 pt-3 space-y-4 mettri-content" id="mettri-content">
        <!-- Conteúdo será gerenciado pelo PanelShell -->
      </div>

      <!-- Footer -->
      <div class="px-4 py-2 border-t border-border/20 flex items-center justify-center">
        <span class="text-[9px] text-muted-foreground/60">Mettri v2.0.0</span>
      </div>
    `;

    this.shadowContainer?.appendChild(sidebar);
    this.container = sidebar;
    this.messagesContainer = sidebar.querySelector('#mettri-messages');

    // Adjust WhatsApp layout
    this.adjustWhatsAppLayout();

    // Setup event listeners
    this.setupEventListeners();
    this.setupHistoryToggleListeners();

    // Criar KebabMenu
    this.createKebabMenu();
    this.createClientesMenu();
    this.createEnviarMenu();
    this.updateClientesMenuVisibility(this.currentModuleId);
    this.updateEnviarMenuVisibility(this.currentModuleId);
  }

  private updateClientesMenuVisibility(moduleId: string): void {
    const btn = this.container?.querySelector('#mettri-clientes-menu') as HTMLButtonElement | null;
    if (!btn) return;
    const shouldShow = typeof moduleId === 'string' && moduleId.startsWith('clientes');
    btn.style.display = shouldShow ? 'flex' : 'none';
  }

  private createClientesMenu(): void {
    const statusActions = this.container?.querySelector('#mettri-status-actions') as HTMLElement | null;
    if (!statusActions) return;

    // Evitar criar múltiplas vezes
    if (this.clientesMenu) return;

    this.clientesMenu = new KebabMenu(
      statusActions,
      [
        {
          label: 'Cadastro',
          onClick: () => emitPanelNavigate(this.eventBus, 'clientes.directory'),
        },
        {
          label: 'Histórico',
          onClick: () => emitPanelNavigate(this.eventBus, 'clientes.history'),
        },
      ],
      { buttonSelector: '#mettri-clientes-menu' }
    );
  }

  private updateEnviarMenuVisibility(moduleId: string): void {
    const btn = this.container?.querySelector('#mettri-enviar-menu') as HTMLButtonElement | null;
    if (!btn) return;
    const shouldShow = typeof moduleId === 'string' && moduleId.startsWith('marketing.enviar');
    btn.style.display = shouldShow ? 'flex' : 'none';
  }

  private createEnviarMenu(): void {
    const statusActions = this.container?.querySelector('#mettri-status-actions') as HTMLElement | null;
    if (!statusActions) return;

    // Evitar criar múltiplas vezes
    if (this.enviarMenu) return;

    this.enviarMenu = new KebabMenu(
      statusActions,
      [
        {
          label: 'Retomar',
          onClick: () => emitPanelNavigate(this.eventBus, 'marketing.enviar.retomar'),
        },
        {
          label: 'Responder',
          onClick: () => emitPanelNavigate(this.eventBus, 'marketing.enviar.responder'),
        },
        {
          label: 'Divulgar',
          onClick: () => emitPanelNavigate(this.eventBus, 'marketing.enviar.divulgar'),
        },
      ],
      { buttonSelector: '#mettri-enviar-menu' }
    );
  }

  /**
   * Lê settings persistidos e aplica no painel.
   * Importante: roda antes do plugin system para o Histórico iniciar OFF.
   */
  private async loadAndApplySettings(): Promise<void> {
    try {
      const result = await this.bridge.storageGet(['settings']);
      const settings = (result?.settings ?? {}) as unknown;
      this.historyEnabled = readHistoryEnabled(settings);

      // Se ainda não existe no storage, persistir default (OFF)
      const record = settings && typeof settings === 'object' ? (settings as PanelSettings) : ({} as PanelSettings);
      if (typeof record.historyEnabled === 'undefined') {
        await this.bridge.storageSet({
          settings: {
            ...record,
            historyEnabled: false,
          },
        });
      }
    } catch (error) {
      // Fallback: manter OFF por padrão
      this.historyEnabled = false;
    }

    this.updateHistoryToggleChecked();
    // Emitir estado para módulos
    this.eventBus.emit('settings:history-enabled', { enabled: this.historyEnabled });
  }

  private updateHistoryToggleChecked(): void {
    const input = this.container?.querySelector('#mettri-history-toggle') as HTMLInputElement | null;
    if (input) {
      input.checked = this.historyEnabled;
    }
  }

  private updateHistoryToggleVisibility(moduleId: string): void {
    const wrap = this.container?.querySelector('#mettri-history-toggle-wrap') as HTMLElement | null;
    if (!wrap) return;
    wrap.style.display = moduleId === 'clientes.history' ? 'flex' : 'none';
  }

  private setupHistoryToggleListeners(): void {
    const input = this.container?.querySelector('#mettri-history-toggle') as HTMLInputElement | null;
    if (!input) return;

    input.addEventListener('change', async () => {
      const enabled = input.checked === true;
      this.historyEnabled = enabled;

      // Persistir
      try {
        const result = await this.bridge.storageGet(['settings']);
        const settings = (result?.settings ?? {}) as unknown;
        const record = settings && typeof settings === 'object' ? (settings as PanelSettings) : ({} as PanelSettings);
        await this.bridge.storageSet({
          settings: {
            ...record,
            historyEnabled: enabled,
          },
        });
      } catch (error) {
        console.warn('[MettriPanel] Falha ao persistir historyEnabled:', error);
      }

      // Notificar módulos
      this.eventBus.emit('settings:history-enabled', { enabled });

      // Se estiver no módulo de histórico, re-renderizar para aplicar gating (placeholder ↔ full)
      if (this.panelShell && this.currentModuleId === 'clientes.history') {
        try {
          await this.panelShell.switchToModule('clientes.history');
        } catch (error) {
          console.warn('[MettriPanel] Falha ao re-renderizar histórico após toggle:', error);
        }
      }
    });
  }

  /**
   * Cria o KebabMenu no header
   */
  private createKebabMenu(): void {
    const headerActions = this.container?.querySelector('.flex.items-center.gap-0\\.5');
    if (!headerActions) {
      console.warn('[MettriPanel] Header actions não encontrado para KebabMenu');
      return;
    }

    // Criar menu com opções (o botão já existe no HTML)
    new KebabMenu(headerActions as HTMLElement, [
      {
        label: 'Sincronizar',
        icon: 'RefreshCw',
        onClick: () => {
          console.log('[MettriPanel] Sincronizar clicado');
          // TODO: Implementar sincronização
        },
      },
      {
        label: 'Exportar dados',
        icon: 'Download',
        onClick: () => {
          console.log('[MettriPanel] Exportar dados clicado');
          // TODO: Implementar exportação
        },
      },
      {
        label: 'Configurações',
        icon: 'Settings',
        onClick: () => {
          console.log('[MettriPanel] Configurações clicado');
          // TODO: Implementar configurações
        },
      },
      {
        label: 'Ajuda',
        icon: 'HelpCircle',
        onClick: () => {
          console.log('[MettriPanel] Ajuda clicado');
          // TODO: Implementar ajuda
        },
      },
      {
        label: 'Limpar cache',
        icon: 'Trash2',
        destructive: true,
        onClick: () => {
          console.log('[MettriPanel] Limpar cache clicado');
          // TODO: Implementar limpeza de cache
        },
      },
    ]);
  }

  /**
   * Configura listeners da NavBar
   */
  private setupNavBarListeners(): void {
    if (!this.navbar) return;

    // Toggle sidebar
    const toggleBtn = this.navbar.querySelector('#mettri-navbar-toggle');
    toggleBtn?.addEventListener('click', () => {
      this.toggleSidebar();
    });

    // Módulos (clientes, infraestrutura, marketing)
    const moduleButtons = this.navbar.querySelectorAll('.mettri-navbar-module');

    moduleButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const moduleId = btn.getAttribute('data-module-id');
        if (!moduleId) return;

        const trySwitch = (): void => {
          if (!this.panelShell) return;
          const mappedId = this.mapModuleId(moduleId);
          this.panelShell.switchToModule(mappedId).catch(error => {
            console.error('[MettriPanel] Erro ao trocar módulo:', error);
          });
        };

        if (this.panelShell) {
          trySwitch();
          return;
        }

        const maxWait = 15000;
        const interval = 200;
        const start = Date.now();
        const t = window.setInterval(() => {
          if (this.panelShell) {
            window.clearInterval(t);
            trySwitch();
            return;
          }
          if (Date.now() - start >= maxWait) {
            window.clearInterval(t);
            console.warn('[MettriPanel] PanelShell não disponível. Verifique erros no console.');
          }
        }, interval);
      });
    });

    // Dark mode toggle
    const darkModeBtn = this.navbar.querySelector('#mettri-navbar-darkmode');
    darkModeBtn?.addEventListener('click', () => {
      this.toggleDarkMode();
    });

    // User Session button
    const userSessionBtn = this.navbar.querySelector('#mettri-user-session');
    userSessionBtn?.addEventListener('click', () => {
      this.showUserSessionModal();
    });

    // Settings
    const settingsBtn = this.navbar.querySelector('#mettri-navbar-settings');
    settingsBtn?.addEventListener('click', () => {
      this.settingsModal?.show();
    });

    const helpBtn = this.navbar.querySelector('#mettri-navbar-help');
    helpBtn?.addEventListener('click', () => {
      console.log('[MettriPanel] Help clicado');
      // TODO: Implementar help
    });
  }

  /**
   * Alterna entre modo claro e escuro
   */
  private toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;
    const darkModeBtn = this.navbar?.querySelector('#mettri-navbar-darkmode');

    if (darkModeBtn) {
      // Atualizar ícone
      darkModeBtn.innerHTML = this.isDarkMode ? getIcon('Sun') : getIcon('Moon');

      // Aplicar/remover classe dark APENAS no Mettri (não mexer no <html>)
      this.shadowContainer?.classList.toggle('dark', this.isDarkMode);
      this.container?.classList.toggle('dark', this.isDarkMode);

      // Aplicar tema manual (variáveis CSS) no painel
      if (this.isDarkMode) this.applyDarkModeTheme();
      else this.applyLightModeTheme();
    }
  }

  /**
   * Aplica tema dark manualmente
   */
  private applyDarkModeTheme(): void {
    const panel = this.container;
    if (!panel) return;

    // Variáveis CSS para dark mode
    panel.style.setProperty('--mettri-bg', '#12181C');
    panel.style.setProperty('--mettri-bg-secondary', '#20272B');
    panel.style.setProperty('--mettri-text', '#FFFFFF');
    panel.style.setProperty('--mettri-text-secondary', '#8D9599');
    panel.style.setProperty('--mettri-border', 'rgba(255, 255, 255, 0.05)');
  }

  /**
   * Aplica tema light manualmente
   */
  private applyLightModeTheme(): void {
    const panel = this.container;
    if (!panel) return;

    // Variáveis CSS para light mode
    panel.style.setProperty('--mettri-bg', '#FFFFFF');
    panel.style.setProperty('--mettri-bg-secondary', '#F7F5F3');
    panel.style.setProperty('--mettri-text', '#0A1014');
    panel.style.setProperty('--mettri-text-secondary', '#5B6368');
    panel.style.setProperty('--mettri-border', 'rgba(17, 27, 33, 0.1)');
  }

  /**
   * Mapeia ID do módulo do NavBar para ID real do módulo
   * IMPORTANTE: Se o módulo pai tem filhos, ativa o primeiro filho automaticamente
   */
  private mapModuleId(navbarModuleId: string): string {
    const mapping: Record<string, string> = {
      'atendimento': 'atendimento.dashboard',
      'clientes': 'clientes.directory',
      'infraestrutura': 'infrastructure.tests', // PanelShell vai ativar o primeiro filho
      'marketing': 'marketing.enviar',
    };
    return mapping[navbarModuleId] || navbarModuleId;
  }

  /**
   * Toggle sidebar (mostrar/ocultar)
   */
  private toggleSidebar(): void {
    if (this.container) {
      const isVisible = this.container.style.display !== 'none';
      if (isVisible) {
        this.container.style.display = 'none';
        this.adjustWhatsAppLayout();
      } else {
        this.container.style.display = 'flex';
        this.adjustWhatsAppLayout();
      }
    }
  }

  /**
   * Inicializa o Plugin System (ModuleRegistry + PanelShell)
   */
  private async initializePluginSystem(): Promise<void> {
    if (!this.container) {
      console.error('[MettriPanel] Container não disponível.');
      return;
    }

    try {
      this.panelShell = new PanelShell({
        container: this.container,
        registry: this.registry,
        eventBus: this.eventBus,
        defaultModuleId: this.currentModuleId,
      });
      await this.panelShell.init();

      this.disposePanelNavigate?.();
      this.disposePanelNavigate = onPanelNavigate(this.eventBus, ({ moduleId }) => {
        if (!this.panelShell || this.currentModuleId === moduleId) return;
        this.panelShell.switchToModule(moduleId).catch((err) => {
          console.error('[MettriPanel] Falha ao navegar:', err);
        });
      });

      this.eventBus.on('panel:module-changed', (data: { moduleId: string }) => {
        this.currentModuleId = data.moduleId;
        this.updateSidebarTitle(data.moduleId);
        this.updateNavBarActive(data.moduleId);
        this.updateHistoryToggleVisibility(data.moduleId);
        this.updateClientesMenuVisibility(data.moduleId);
        this.updateEnviarMenuVisibility(data.moduleId);
        if (data.moduleId === 'clientes.history') {
          this.updateHistoryToggleChecked();
          this.eventBus.emit('settings:history-enabled', { enabled: this.historyEnabled });
        }
      });

      await this.panelShell.switchToModule(this.currentModuleId);
    } catch (error) {
      console.error('[MettriPanel] Erro ao inicializar Plugin System:', error);
    }
  }

  /**
   * Atualiza título do sidebar baseado no módulo ativo
   */
  private updateSidebarTitle(moduleId: string): void {
    const titleMap: Record<string, string> = {
      'atendimento': 'Atendimento',
      'atendimento.dashboard': 'Atendimento',
      'clientes': 'Clientes',
      'clientes.directory': 'Clientes',
      'clientes.history': 'Histórico',
      'infraestrutura': 'Sentinela',
      'infraestrutura.tests': 'Sentinela',
      'marketing': 'Enviar',
      'marketing.enviar': 'Enviar',
      'marketing.enviar.retomar': 'Enviar',
      'marketing.enviar.responder': 'Enviar',
      'marketing.enviar.divulgar': 'Enviar',
    };

    const parts = moduleId.split('.');
    const parentId = parts[0];
    const title = titleMap[moduleId] || titleMap[parentId] || moduleId;

    const titleElement = this.container?.querySelector('#mettri-sidebar-title');
    if (titleElement) {
      titleElement.textContent = title;
    }
  }

  /**
   * Atualiza qual botão do NavBar está ativo
   */
  private updateNavBarActive(moduleId: string): void {
    if (!this.navbar) return;

    // Remover active de todos
    this.navbar.querySelectorAll('.mettri-navbar-module').forEach(btn => {
      btn.classList.remove('bg-primary-foreground/20', 'text-primary-foreground');
      btn.classList.add('text-primary-foreground/60');
    });

    // Adicionar active no módulo correto
    const parts = moduleId.split('.');
    const parentId = parts[0];
    const activeBtn = this.navbar.querySelector(`[data-module-id="${parentId}"]`);
    if (activeBtn) {
      activeBtn.classList.remove('text-primary-foreground/60');
      activeBtn.classList.add('bg-primary-foreground/20', 'text-primary-foreground');
    }
  }

  private createToggleButton(): void {
    const toggle = document.createElement('button');
    toggle.id = 'mettri-toggle';
    toggle.innerHTML = 'M';
    toggle.title = 'Abrir Mettri';

    toggle.addEventListener('click', () => {
      this.show();
    });

    this.shadowContainer?.appendChild(toggle);
  }

  private adjustWhatsAppLayout(): void {
    // Find WhatsApp main container and adjust width
    // NavBar (56px) + Sidebar (300px) = 356px
    const appWrapper = document.querySelector('#app');
    if (appWrapper instanceof HTMLElement) {
      const sidebarWidth = this.container && this.container.style.display !== 'none' ? 300 : 0;
      appWrapper.style.width = `calc(100% - ${56 + sidebarWidth}px)`; // 56px = NavBar width
    }
  }

  private resetWhatsAppLayout(): void {
    // Quando sidebar fecha, só NavBar fica (56px)
    const appWrapper = document.querySelector('#app');
    if (appWrapper instanceof HTMLElement) {
      appWrapper.style.width = 'calc(100% - 56px)'; // Apenas NavBar
    }
  }

  private setupEventListeners(): void {
    // Close button
    const closeBtn = this.container?.querySelector('#mettri-close');
    closeBtn?.addEventListener('click', () => {
      this.hide();
    });

    // Minimize button
    const minimizeBtn = this.container?.querySelector('#mettri-minimize');
    minimizeBtn?.addEventListener('click', () => {
      this.hide();
    });
  }



  public hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
      this.state.isVisible = false;
      this.resetWhatsAppLayout();

      const toggle = document.querySelector('#mettri-toggle');
      toggle?.classList.remove('panel-open');

      // Atualizar ícone do NavBar toggle
      const navbarToggle = this.navbar?.querySelector('#mettri-navbar-toggle');
      if (navbarToggle) {
        navbarToggle.innerHTML = getIcon('ChevronLeft');
      }
    }
  }

  public show(): void {
    if (this.container) {
      this.container.style.display = 'flex';
      this.state.isVisible = true;
      this.adjustWhatsAppLayout();

      const toggle = document.querySelector('#mettri-toggle');
      toggle?.classList.add('panel-open');

      // Atualizar ícone do NavBar toggle
      const navbarToggle = this.navbar?.querySelector('#mettri-navbar-toggle');
      if (navbarToggle) {
        navbarToggle.innerHTML = getIcon('ChevronRight');
      }
    }
  }

  public setCapturing(isCapturing: boolean): void {
    this.state.isCapturing = isCapturing;
    const dot = this.container?.querySelector('#mettri-status-dot');
    const text = this.container?.querySelector('#mettri-status-text');

    if (dot && text) {
      if (isCapturing) {
        dot.classList.add('active');
        text.textContent = 'Sincronizado';
      } else {
        dot.classList.remove('active');
        text.textContent = 'Desconectado';
      }
    }
  }

  public addMessage(message: CapturedMessage): void {
    this.state.messages.push(message);
    this.renderMessages();

    // Emitir evento para módulos escutarem (ex: histórico atualizar automaticamente)
    // IMPORTANTE: Aguardar um pouco para garantir que WhatsApp atualizou ordem internamente
    // Padrão WA-Sync: sempre confiar na ordem do WhatsApp via getModelsArray()
    if (this.state.isVisible) {
      setTimeout(() => {
        this.eventBus.emit('message:new', { message });
      }, 100); // 100ms é suficiente para WhatsApp atualizar ordem
    }
  }

  private renderMessages(): void {
    if (!this.messagesContainer) return;

    if (this.state.messages.length === 0) {
      this.messagesContainer.innerHTML = `
        <div class="mettri-empty">
          <p>Nenhuma mensagem capturada ainda.</p>
          <p>As mensagens aparecerao aqui em tempo real.</p>
        </div>
      `;
      return;
    }

    this.messagesContainer.innerHTML = this.state.messages
      .slice(-50) // Show last 50 messages
      .map(msg => this.renderMessage(msg))
      .join('');

    // Scroll to bottom
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  private renderMessage(message: CapturedMessage): string {
    const direction = message.isOutgoing ? 'outgoing' : 'incoming';
    const time = new Date(message.timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return `
      <div class="mettri-message ${direction}">
        ${!message.isOutgoing ? `<div class="mettri-message-sender">${message.sender}</div>` : ''}
        <div class="mettri-message-text">${this.escapeHtml(message.text)}</div>
        <div class="mettri-message-time">${time}</div>
      </div>
    `;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private async loadMessages(): Promise<void> {
    try {
      const messages = await messageDB.getMessages();
      this.state.messages = messages;
      this.renderMessages();
    } catch (error) {
      console.error('Mettri: Erro ao carregar mensagens do banco:', error);
    }
  }

  /**
   * Define o MessageCapturer para atualizar estatísticas.
   */
  public setMessageCapturer(capturer: MessageCapturer): void {
    this.capturer = capturer;
  }

  public getMessageCapturer(): MessageCapturer | null {
    return this.capturer;
  }

  /**
   * Define a sessão do usuário atual e atualiza a UI.
   */
  public setUserSession(session: UserSession | null): void {
    this.userSession = session;
    this.updateUserSessionUI(session);
  }

  /**
   * Atualiza a UI da sessão de usuário na NavBar.
   */
  private updateUserSessionUI(session: UserSession | null): void {
    if (!this.navbar) return;

    const avatarImg = this.navbar.querySelector('#mettri-user-avatar') as HTMLImageElement;
    const fallbackDiv = this.navbar.querySelector('#mettri-user-fallback') as HTMLElement;
    const initialsSpan = this.navbar.querySelector('#mettri-user-initials') as HTMLElement;
    const sessionBtn = this.navbar.querySelector('#mettri-user-session') as HTMLButtonElement;
    const warningBadge = this.navbar.querySelector('#mettri-user-warning') as HTMLElement;

    if (!avatarImg || !fallbackDiv || !initialsSpan || !sessionBtn) {
      return;
    }

    if (!session) {
      // Sem sessão - mostrar placeholder e aviso
      avatarImg.style.display = 'none';
      fallbackDiv.style.display = 'flex';
      initialsSpan.textContent = '?';
      sessionBtn.title = 'Conta não detectada';
      // Mostrar aviso visual
      if (warningBadge) {
        warningBadge.classList.remove('hidden');
        warningBadge.classList.add('flex');
      }
      return;
    }

    // Conta detectada - ocultar aviso
    if (warningBadge) {
      warningBadge.classList.add('hidden');
      warningBadge.classList.remove('flex');
    }

    // Atualizar tooltip
    const tooltipText = session.name
      ? `${session.name}${session.phoneNumber ? `\n${session.phoneNumber}` : ''}`
      : session.phoneNumber || session.wid;
    sessionBtn.title = tooltipText;

    // Tentar exibir foto
    if (session.profilePicUrl) {
      avatarImg.src = session.profilePicUrl;
      avatarImg.onload = () => {
        avatarImg.style.display = 'block';
        fallbackDiv.style.display = 'none';
      };
      avatarImg.onerror = () => {
        // Foto falhou ao carregar - usar fallback
        avatarImg.style.display = 'none';
        fallbackDiv.style.display = 'flex';
        this.setUserInitials(initialsSpan, session);
      };
    } else {
      // Sem foto - usar iniciais
      avatarImg.style.display = 'none';
      fallbackDiv.style.display = 'flex';
      this.setUserInitials(initialsSpan, session);
    }
  }

  /**
   * Define as iniciais do usuário no elemento.
   */
  private setUserInitials(element: HTMLElement, session: UserSession): void {
    if (session.name) {
      // Pegar primeira letra do nome
      const initials = session.name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
      element.textContent = initials || '?';
    } else {
      element.textContent = '?';
    }
  }

  /**
   * Mostra modal de configurações da conta.
   */
  private showUserSessionModal(): void {
    if (this.userSessionModal) {
      this.userSessionModal.show(this.userSession);
    }
  }

  /**
   * Cria um único ShadowRoot para isolar 100% o visual do Mettri.
   * (Sem "vazar" CSS pro WhatsApp, como se fosse um aquário de vidro.)
   */
  private ensureShadowRoot(): void {
    if (this.shadow && this.shadowContainer && this.hostEl) return;

    const existingHost = document.getElementById('mettri-shadow-host');
    if (existingHost instanceof HTMLDivElement && existingHost.shadowRoot) {
      this.hostEl = existingHost;
      this.applyHostSafetyStyles(existingHost);
      this.shadow = existingHost.shadowRoot;
      const existingContainer = this.shadow.querySelector('#mettri-shadow-container');
      if (existingContainer instanceof HTMLDivElement) {
        this.shadowContainer = existingContainer;
      } else {
        const container = document.createElement('div');
        container.id = 'mettri-shadow-container';
        this.shadow.appendChild(container);
        this.shadowContainer = container;
      }
      window.__mettriShadowRoot = this.shadow;
      return;
    }

    const host = document.createElement('div');
    host.id = 'mettri-shadow-host';
    this.applyHostSafetyStyles(host);
    const shadow = host.attachShadow({ mode: 'open' });

    const container = document.createElement('div');
    container.id = 'mettri-shadow-container';

    shadow.appendChild(container);
    document.body.appendChild(host);

    this.hostEl = host;
    this.shadow = shadow;
    this.shadowContainer = container;

    // Ponte para outros módulos (ex: ThemeLoader) encontrarem o ShadowRoot
    window.__mettriShadowRoot = shadow;
  }

  /**
   * Carrega o CSS base do Mettri dentro do ShadowRoot.
   * IMPORTANTE: não usamos mais "content_scripts.css" para evitar vazamento global.
   */
  private injectBaseStyles(): void {
    if (!this.shadow) return;
    if (this.shadow.querySelector('#mettri-base-styles')) return;

    const link = document.createElement('link');
    link.id = 'mettri-base-styles';
    link.rel = 'stylesheet';
    link.type = 'text/css';

    const href = getExtensionResourceUrl('panel.css');
    link.href = href ?? 'panel.css';
    this.shadow.appendChild(link);
  }

  /**
   * Mantém o host do Shadow DOM "sempre por cima" e sem interferir no layout.
   */
  private applyHostSafetyStyles(host: HTMLDivElement): void {
    host.style.position = 'fixed';
    host.style.top = '0';
    host.style.left = '0';
    host.style.width = '0';
    host.style.height = '0';
    host.style.zIndex = '2147483647';
  }
}
