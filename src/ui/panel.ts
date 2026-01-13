import type { CapturedMessage, PanelState } from '../types';
import { messageDB } from '../storage/message-db';
import { SelectorScannerPanel } from './selector-scanner-panel';

export class MettriPanel {
  private container: HTMLElement | null = null;
  private messagesContainer: HTMLElement | null = null;
  private selectorScannerPanel: SelectorScannerPanel;
  private state: PanelState = {
    isVisible: true,
    isCapturing: false,
    messages: [],
    currentChatId: null,
  };

  constructor() {
    this.selectorScannerPanel = new SelectorScannerPanel();
    this.init();
  }

  private init(): void {
    this.createPanel();
    this.createToggleButton();
    this.loadMessages();
  }

  private createPanel(): void {
    // Create panel container
    const panel = document.createElement('div');
    panel.id = 'mettri-panel';

    panel.innerHTML = `
      <div class="mettri-header">
        <h1>Mettri</h1>
        <div class="mettri-header-actions">
          <button class="mettri-btn" id="mettri-minimize" title="Minimizar">_</button>
          <button class="mettri-btn" id="mettri-close" title="Fechar">×</button>
        </div>
      </div>
      <div class="mettri-tabs">
        <button class="mettri-tab active" data-tab="messages">Mensagens</button>
        <button class="mettri-tab" data-tab="selectors">Seletores</button>
        <button class="mettri-tab" data-tab="webpack">Webpack</button>
      </div>
      <div class="mettri-status">
        <span class="mettri-status-dot" id="mettri-status-dot"></span>
        <span id="mettri-status-text">Aguardando...</span>
      </div>
      <div class="mettri-content">
        <div class="mettri-tab-content" id="mettri-tab-messages">
          <div class="mettri-messages" id="mettri-messages">
            <div class="mettri-empty">
              <div class="mettri-empty-icon">💬</div>
              <p>Nenhuma mensagem capturada ainda.</p>
              <p>As mensagens aparecerao aqui em tempo real.</p>
            </div>
          </div>
        </div>
        <div class="mettri-tab-content" id="mettri-tab-selectors" style="display: none;">
        </div>
      </div>
      <div class="mettri-footer">
        Mettri v2.0.0 | Capturando mensagens
      </div>
    `;

    document.body.appendChild(panel);
    this.container = panel;
    this.messagesContainer = panel.querySelector('#mettri-messages');

    // Renderizar painel de seletores
    const selectorsTab = panel.querySelector('#mettri-tab-selectors');
    if (selectorsTab) {
      const scannerPanel = this.selectorScannerPanel.render();
      selectorsTab.appendChild(scannerPanel);
    }

    // Adjust WhatsApp layout
    this.adjustWhatsAppLayout();

    // Setup event listeners
    this.setupEventListeners();
    this.setupTabs();
  }

  private createToggleButton(): void {
    const toggle = document.createElement('button');
    toggle.id = 'mettri-toggle';
    toggle.innerHTML = 'M';
    toggle.title = 'Abrir Mettri';

    toggle.addEventListener('click', () => {
      this.show();
    });

    document.body.appendChild(toggle);
  }

  private adjustWhatsAppLayout(): void {
    // Find WhatsApp main container and adjust width
    const appWrapper = document.querySelector('#app');
    if (appWrapper instanceof HTMLElement) {
      appWrapper.style.width = 'calc(100% - 320px)';
    }
  }

  private resetWhatsAppLayout(): void {
    const appWrapper = document.querySelector('#app');
    if (appWrapper instanceof HTMLElement) {
      appWrapper.style.width = '100%';
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

  /**
   * Configura sistema de abas.
   */
  private setupTabs(): void {
    const tabs = this.container?.querySelectorAll('.mettri-tab');
    tabs?.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab') as 'messages' | 'selectors';
        this.switchTab(tabName);
      });
    });
  }

  /**
   * Troca de aba.
   */
  private switchTab(tabName: 'messages' | 'selectors' | 'webpack'): void {
    // Atualizar botões de aba
    const tabs = this.container?.querySelectorAll('.mettri-tab');
    tabs?.forEach(tab => {
      if (tab.getAttribute('data-tab') === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Mostrar/ocultar conteúdo
    const messagesContent = this.container?.querySelector('#mettri-tab-messages');
    const selectorsContent = this.container?.querySelector('#mettri-tab-selectors');

    // Ocultar todos primeiro
    messagesContent?.setAttribute('style', 'display: none;');
    selectorsContent?.setAttribute('style', 'display: none;');
    const webpackContent = this.container?.querySelector('#mettri-tab-webpack');
    webpackContent?.setAttribute('style', 'display: none;');

    // Mostrar apenas a aba selecionada
    if (tabName === 'messages') {
      messagesContent?.setAttribute('style', 'display: block;');
    } else if (tabName === 'selectors') {
      selectorsContent?.setAttribute('style', 'display: block;');
    } else if (tabName === 'webpack') {
      webpackContent?.setAttribute('style', 'display: block;');
      // Atualizar estatísticas quando abrir a aba
      this.updateWebpackStats();
    }
  }

  public show(): void {
    if (this.container) {
      this.container.style.display = 'flex';
      this.state.isVisible = true;
      this.adjustWhatsAppLayout();

      const toggle = document.querySelector('#mettri-toggle');
      toggle?.classList.add('panel-open');
    }
  }

  public hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
      this.state.isVisible = false;
      this.resetWhatsAppLayout();

      const toggle = document.querySelector('#mettri-toggle');
      toggle?.classList.remove('panel-open');
    }
  }

  public setCapturing(isCapturing: boolean): void {
    this.state.isCapturing = isCapturing;
    const dot = this.container?.querySelector('#mettri-status-dot');
    const text = this.container?.querySelector('#mettri-status-text');

    if (dot && text) {
      if (isCapturing) {
        dot.classList.add('active');
        text.textContent = 'Capturando mensagens...';
      } else {
        dot.classList.remove('active');
        text.textContent = 'Captura pausada';
      }
    }
  }

  public addMessage(message: CapturedMessage): void {
    this.state.messages.push(message);
    this.renderMessages();
  }

  private renderMessages(): void {
    if (!this.messagesContainer) return;

    if (this.state.messages.length === 0) {
      this.messagesContainer.innerHTML = `
        <div class="mettri-empty">
          <div class="mettri-empty-icon">💬</div>
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
   * Atualiza estatísticas do webpack na aba Webpack.
   */
  public updateWebpackStats(): void {
    // Importar WhatsAppInterceptors dinamicamente
    import('../infrastructure/whatsapp-interceptors').then(({ WhatsAppInterceptors }) => {
      const interceptors = new WhatsAppInterceptors();
      
      // Verificar disponibilidade
      const isAvailable = interceptors.isWebpackAvailable();
      const availableEl = this.container?.querySelector('#mettri-webpack-available');
      if (availableEl) {
        availableEl.textContent = isAvailable ? '✅ Sim' : '❌ Não';
        availableEl.className = `status-value ${isAvailable ? 'success' : 'error'}`;
      }

      // Tentar inicializar e verificar módulos
      if (isAvailable) {
        interceptors.initialize().then(() => {
          // Verificar cada módulo
          const modules = {
            msg: interceptors.Msg,
            chatcollection: interceptors.ChatCollection,
            user: interceptors.User,
            groupmetadata: interceptors.GroupMetadata,
            presencecollection: interceptors.PresenceCollection,
          };

          Object.entries(modules).forEach(([key, module]) => {
            const el = this.container?.querySelector(`#mettri-module-${key}`);
            if (el) {
              el.textContent = module ? '✅ Encontrado' : '❌ Não encontrado';
              el.className = `module-status ${module ? 'success' : 'error'}`;
            }
          });

          // Atualizar método ativo
          const methodEl = this.container?.querySelector('#mettri-webpack-method');
          if (methodEl) {
            methodEl.textContent = '⚡ Webpack (Prioritário)';
            methodEl.className = 'status-value success';
          }
        }).catch(() => {
          // Se falhar, usar DOM
          const methodEl = this.container?.querySelector('#mettri-webpack-method');
          if (methodEl) {
            methodEl.textContent = '🐌 DOM (Fallback)';
            methodEl.className = 'status-value warning';
          }
        });
      } else {
        // Webpack não disponível, usar DOM
        const methodEl = this.container?.querySelector('#mettri-webpack-method');
        if (methodEl) {
          methodEl.textContent = '🐌 DOM (Fallback)';
          methodEl.className = 'status-value warning';
        }

        // Marcar todos os módulos como não encontrados
        ['msg', 'chatcollection', 'user', 'groupmetadata', 'presencecollection'].forEach(key => {
          const el = this.container?.querySelector(`#mettri-module-${key}`);
          if (el) {
            el.textContent = '❌ Não disponível';
            el.className = 'module-status error';
          }
        });
      }
    }).catch(() => {
      console.warn('Mettri: Erro ao carregar WhatsAppInterceptors');
    });

    // Atualizar estatísticas de mensagens do MessageCapturer
    const capturer = (this as any).capturer;
    if (capturer && typeof capturer.getStats === 'function') {
      const stats = capturer.getStats();
      const webpackMessagesEl = this.container?.querySelector('#mettri-webpack-messages');
      const domMessagesEl = this.container?.querySelector('#mettri-dom-messages');
      const eventsEl = this.container?.querySelector('#mettri-webpack-events');
      const successRateEl = this.container?.querySelector('#mettri-webpack-success-rate');

      if (webpackMessagesEl) webpackMessagesEl.textContent = stats.webpackMessages.toString();
      if (domMessagesEl) domMessagesEl.textContent = stats.domMessages.toString();
      if (eventsEl) eventsEl.textContent = stats.webpackEvents.toString();
      if (successRateEl) successRateEl.textContent = stats.successRate;
    } else {
      // Valores padrão se capturer não estiver disponível
      const webpackMessagesEl = this.container?.querySelector('#mettri-webpack-messages');
      const domMessagesEl = this.container?.querySelector('#mettri-dom-messages');
      const eventsEl = this.container?.querySelector('#mettri-webpack-events');
      const successRateEl = this.container?.querySelector('#mettri-webpack-success-rate');

      if (webpackMessagesEl) webpackMessagesEl.textContent = '0';
      if (domMessagesEl) domMessagesEl.textContent = '0';
      if (eventsEl) eventsEl.textContent = '0';
      if (successRateEl) successRateEl.textContent = '-';
    }
  }

  /**
   * Define o MessageCapturer para atualizar estatísticas.
   */
  public setMessageCapturer(capturer: any): void {
    (this as any).capturer = capturer;
    
    // Atualizar estatísticas periodicamente se a aba webpack estiver visível
    setInterval(() => {
      const webpackTab = this.container?.querySelector('#mettri-tab-webpack');
      if (webpackTab && webpackTab.getAttribute('style')?.includes('display: block')) {
        this.updateWebpackStats();
      }
    }, 2000); // Atualizar a cada 2 segundos
  }
}
