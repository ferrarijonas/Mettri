import type { CapturedMessage, PanelState } from '../types';

export class MettriPanel {
  private container: HTMLElement | null = null;
  private messagesContainer: HTMLElement | null = null;
  private state: PanelState = {
    isVisible: true,
    isCapturing: false,
    messages: [],
    currentChatId: null,
  };

  constructor() {
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
      <div class="mettri-status">
        <span class="mettri-status-dot" id="mettri-status-dot"></span>
        <span id="mettri-status-text">Aguardando...</span>
      </div>
      <div class="mettri-messages" id="mettri-messages">
        <div class="mettri-empty">
          <div class="mettri-empty-icon">💬</div>
          <p>Nenhuma mensagem capturada ainda.</p>
          <p>As mensagens aparecerao aqui em tempo real.</p>
        </div>
      </div>
      <div class="mettri-footer">
        Mettri v2.0.0 | Capturando mensagens
      </div>
    `;

    document.body.appendChild(panel);
    this.container = panel;
    this.messagesContainer = panel.querySelector('#mettri-messages');

    // Adjust WhatsApp layout
    this.adjustWhatsAppLayout();

    // Setup event listeners
    this.setupEventListeners();
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
      const response = await chrome.runtime.sendMessage({ type: 'GET_MESSAGES' });
      if (Array.isArray(response)) {
        this.state.messages = response;
        this.renderMessages();
      }
    } catch (error) {
      console.warn('Mettri: Could not load messages', error);
    }
  }
}
