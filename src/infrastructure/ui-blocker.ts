/**
 * Bloqueador de UI para impedir interação durante processos automáticos.
 * 
 * Responsabilidades:
 * - Criar overlay fullscreen que bloqueia interação
 * - Bloquear eventos de mouse, teclado e scroll
 * - Mostrar indicador de progresso
 * - Botão de cancelamento de emergência
 */
export class UIBlocker {
  private overlay: HTMLElement | null = null;
  private isBlocked = false;
  private eventHandlers: Array<{
    element: HTMLElement | Document;
    event: string;
    handler: EventListener;
  }> = [];

  /**
   * Bloqueia a UI com overlay e bloqueio de eventos.
   * 
   * @param message Mensagem a exibir no overlay
   * @param onCancel Callback chamado quando usuário cancela
   */
  block(message: string, onCancel?: () => void): void {
    if (this.isBlocked) {
      return; // Já está bloqueado
    }

    this.isBlocked = true;

    // Criar overlay
    this.overlay = document.createElement('div');
    this.overlay.id = 'mettri-ui-blocker';
    this.overlay.className = 'mettri-ui-blocker';
    this.overlay.innerHTML = `
      <div class="mettri-ui-blocker-content">
        <div class="mettri-ui-blocker-spinner"></div>
        <p class="mettri-ui-blocker-message">${message}</p>
        <div class="mettri-ui-blocker-progress">
          <div class="mettri-ui-blocker-progress-bar"></div>
        </div>
        <p class="mettri-ui-blocker-status">Aguardando...</p>
        ${onCancel ? '<button class="mettri-ui-blocker-cancel">Cancelar</button>' : ''}
      </div>
    `;

    // Adicionar estilos
    this.addStyles();

    // Adicionar ao body
    document.body.appendChild(this.overlay);

    // Bloquear eventos
    this.blockEvents();

    // Adicionar listener de cancelamento
    if (onCancel) {
      const cancelBtn = this.overlay.querySelector('.mettri-ui-blocker-cancel');
      cancelBtn?.addEventListener('click', () => {
        onCancel();
        this.unblock();
      });
    }
  }

  /**
   * Desbloqueia a UI removendo overlay e restaurando eventos.
   */
  unblock(): void {
    if (!this.isBlocked) {
      return;
    }

    // Restaurar eventos
    this.unblockEvents();

    // Remover overlay
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }

    this.isBlocked = false;
  }

  /**
   * Atualiza progresso e status no overlay.
   * 
   * @param progress Progresso (0-100)
   * @param status Mensagem de status
   */
  updateProgress(progress: number, status: string): void {
    if (!this.overlay) {
      return;
    }

    const progressBar = this.overlay.querySelector('.mettri-ui-blocker-progress-bar') as HTMLElement;
    const statusText = this.overlay.querySelector('.mettri-ui-blocker-status');

    if (progressBar) {
      progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    }

    if (statusText) {
      statusText.textContent = status;
    }
  }

  /**
   * Verifica se a UI está bloqueada.
   * 
   * @returns true se bloqueada
   */
  isBlocking(): boolean {
    return this.isBlocked;
  }

  /**
   * Bloqueia todos os eventos de interação.
   */
  private blockEvents(): void {
    const events = ['click', 'mousedown', 'mouseup', 'keydown', 'keyup', 'scroll', 'touchstart', 'touchmove'];

    const handler = (e: Event) => {
      // Permitir apenas cliques no botão de cancelar
      const target = e.target as HTMLElement;
      if (target?.closest('.mettri-ui-blocker-cancel')) {
        return; // Permitir clique no botão cancelar
      }

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    };

    events.forEach(eventType => {
      const handlerWrapper = handler as EventListener;
      document.addEventListener(eventType, handlerWrapper, { capture: true, passive: false });
      this.eventHandlers.push({
        element: document,
        event: eventType,
        handler: handlerWrapper,
      });
    });
  }

  /**
   * Restaura eventos bloqueados.
   */
  private unblockEvents(): void {
    this.eventHandlers.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler, { capture: true });
    });
    this.eventHandlers = [];
  }

  /**
   * Adiciona estilos CSS ao overlay.
   */
  private addStyles(): void {
    // Verificar se estilos já foram adicionados
    if (document.getElementById('mettri-ui-blocker-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'mettri-ui-blocker-styles';
    style.textContent = `
      .mettri-ui-blocker {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        z-index: 9999999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .mettri-ui-blocker-content {
        background: white;
        padding: 32px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        text-align: center;
        min-width: 300px;
        max-width: 500px;
      }
      .mettri-ui-blocker-spinner {
        width: 48px;
        height: 48px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #25D366;
        border-radius: 50%;
        animation: mettri-spin 1s linear infinite;
        margin: 0 auto 16px;
      }
      @keyframes mettri-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .mettri-ui-blocker-message {
        font-size: 16px;
        font-weight: 600;
        color: #333;
        margin-bottom: 16px;
      }
      .mettri-ui-blocker-progress {
        width: 100%;
        height: 8px;
        background: #f0f0f0;
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 12px;
      }
      .mettri-ui-blocker-progress-bar {
        height: 100%;
        background: #25D366;
        border-radius: 4px;
        transition: width 0.3s ease;
        width: 0%;
      }
      .mettri-ui-blocker-status {
        font-size: 14px;
        color: #666;
        margin-bottom: 16px;
      }
      .mettri-ui-blocker-cancel {
        padding: 8px 16px;
        background: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        color: #333;
      }
      .mettri-ui-blocker-cancel:hover {
        background: #e0e0e0;
      }
    `;
    document.head.appendChild(style);
  }
}
