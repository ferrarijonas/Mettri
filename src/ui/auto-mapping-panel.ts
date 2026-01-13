import type { AutoMappingSession } from '../types';
import { AutoMapper } from '../infrastructure/auto-mapper';

/**
 * Painel de UI para auto-mapeamento interativo.
 * 
 * Interface visual para guiar o usuário:
 * - Lista de seletores a mapear
 * - Instruções: "Clique no elemento X"
 * - Feedback visual (highlight do elemento)
 * - Progresso (X de Y seletores mapeados)
 * - Botão "Cancelar"
 */
export class AutoMappingPanel {
  private panel: HTMLElement | null = null;
  private autoMapper: AutoMapper;
  private currentTargetIndex = 0;
  private highlightOverlay: HTMLElement | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;

  constructor(autoMapper: AutoMapper) {
    this.autoMapper = autoMapper;
    this.setupCallbacks();
  }

  /**
   * Configura callbacks do AutoMapper.
   */
  private setupCallbacks(): void {
    this.autoMapper.onProgress((progress) => {
      this.updateProgress(progress);
    });

    this.autoMapper.onStatus((status) => {
      this.updateStatus(status);
    });
  }

  /**
   * Obtém informações amigáveis sobre um seletor.
   * Traduz IDs técnicos para descrições claras e instruções didáticas.
   */
  private getSelectorInfo(selectorId: string): {
    friendlyName: string;
    description: string;
    example: string;
    visualHint: string;
  } {
    const mapping: Record<
      string,
      {
        friendlyName: string;
        description: string;
        example: string;
        visualHint: string;
      }
    > = {
      conversationPanel: {
        friendlyName: 'Área Principal de Mensagens',
        description: 'A área grande no centro onde todas as mensagens aparecem',
        example: 'Clique na área grande onde você vê todas as conversas',
        visualHint: 'A área central do WhatsApp onde as mensagens são exibidas',
      },
      messageIn: {
        friendlyName: 'Mensagem Recebida',
        description: 'Uma mensagem que você recebeu (aparece do lado esquerdo, fundo branco/cinza)',
        example: 'Clique em uma mensagem que você RECEBEU (do lado esquerdo)',
        visualHint: 'Mensagens com foto de perfil à esquerda, fundo branco ou cinza',
      },
      messageOut: {
        friendlyName: 'Mensagem Enviada',
        description: 'Uma mensagem que você enviou (aparece do lado direito, fundo verde)',
        example: 'Clique em uma mensagem que você ENVIOU (do lado direito, fundo verde)',
        visualHint: 'Mensagens com foto de perfil à direita, fundo verde',
      },
      messageText: {
        friendlyName: 'Texto da Mensagem',
        description: 'O texto dentro de uma mensagem',
        example: 'Clique no texto dentro de uma mensagem (não no balão inteiro)',
        visualHint: 'O texto que está escrito dentro da bolha da mensagem',
      },
      messageMeta: {
        friendlyName: 'Hora da Mensagem',
        description: 'O horário que aparece abaixo da mensagem',
        example: 'Clique no horário que aparece abaixo de uma mensagem (ex: "09:27")',
        visualHint: 'O pequeno texto com horário abaixo das mensagens',
      },
      chatHeader: {
        friendlyName: 'Cabeçalho do Chat',
        description: 'A barra no topo com o nome do contato e foto de perfil',
        example: 'Clique na barra do topo onde aparece o nome do contato',
        visualHint: 'A área superior do chat com nome e foto do contato',
      },
      chatName: {
        friendlyName: 'Nome do Contato',
        description: 'O nome ou número do contato no topo do chat',
        example: 'Clique no nome do contato que aparece no topo (ex: "+55 34 9675-1010")',
        visualHint: 'O texto com o nome ou número do contato no cabeçalho',
      },
      senderName: {
        friendlyName: 'Nome do Remetente (Grupos)',
        description: 'O nome de quem enviou a mensagem em grupos',
        example: 'Clique no nome de quem enviou a mensagem (só aparece em grupos)',
        visualHint: 'O nome que aparece acima da mensagem em grupos',
      },
    };

    return (
      mapping[selectorId] || {
        friendlyName: selectorId,
        description: 'Elemento a ser mapeado',
        example: `Clique no elemento correspondente a ${selectorId}`,
        visualHint: 'Siga as instruções na tela',
      }
    );
  }

  /**
   * Mostra o painel de mapeamento.
   */
  show(): void {
    if (this.panel) {
      return; // Já está visível
    }

    this.createPanel();
    this.updateContent();
    document.body.appendChild(this.panel!);
  }

  /**
   * Esconde o painel de mapeamento.
   */
  hide(): void {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
    this.removeHighlight();
    this.removeClickHandler();
  }

  /**
   * Cria o elemento do painel.
   */
  private createPanel(): void {
    this.panel = document.createElement('div');
    this.panel.id = 'mettri-auto-mapping-panel';
    this.panel.className = 'mettri-auto-mapping-panel';
    this.panel.innerHTML = `
      <div class="mettri-auto-mapping-header">
        <h3>Auto-Mapeamento de Seletores</h3>
        <button class="mettri-auto-mapping-close" aria-label="Fechar">×</button>
      </div>
      <div class="mettri-auto-mapping-content">
        <div class="mettri-auto-mapping-status"></div>
        <div class="mettri-auto-mapping-progress">
          <div class="mettri-auto-mapping-progress-bar"></div>
          <div class="mettri-auto-mapping-progress-text">0%</div>
        </div>
        <div class="mettri-auto-mapping-instructions"></div>
        <div class="mettri-auto-mapping-targets"></div>
      </div>
      <div class="mettri-auto-mapping-actions">
        <button class="mettri-auto-mapping-cancel">Cancelar</button>
        <button class="mettri-auto-mapping-complete" disabled>Completar</button>
      </div>
    `;

    // Adicionar estilos inline (será movido para CSS depois)
    this.addStyles();

    // Adicionar event listeners
    const closeBtn = this.panel.querySelector('.mettri-auto-mapping-close');
    closeBtn?.addEventListener('click', () => this.hide());

    const cancelBtn = this.panel.querySelector('.mettri-auto-mapping-cancel');
    cancelBtn?.addEventListener('click', () => {
      this.autoMapper.cancelSession();
      this.hide();
    });

    const completeBtn = this.panel.querySelector('.mettri-auto-mapping-complete');
    completeBtn?.addEventListener('click', async () => {
      await this.completeMapping();
    });
  }

  /**
   * Atualiza o conteúdo do painel.
   */
  private updateContent(): void {
    const session = this.autoMapper.getSession();
    if (!session) {
      return;
    }

    this.updateStatus('Aguardando interação...');
    this.updateProgress(session.progress);
    this.updateTargetsList(session);
    this.updateInstructions(session);
  }

  /**
   * Atualiza a lista de targets.
   */
  private updateTargetsList(session: AutoMappingSession): void {
    const targetsContainer = this.panel?.querySelector('.mettri-auto-mapping-targets');
    if (!targetsContainer) {
      return;
    }

    targetsContainer.innerHTML = session.targets
      .map((target, index) => {
        const info = this.getSelectorInfo(target.selectorId);
        const statusIcon =
          target.status === 'success'
            ? '✓'
            : target.status === 'failed'
            ? '✗'
            : target.status === 'validating'
            ? '⟳'
            : '○';

        const statusClass = `status-${target.status}`;
        const isCurrent = index === this.currentTargetIndex;

        return `
          <div class="mettri-auto-mapping-target ${statusClass} ${isCurrent ? 'current' : ''}">
            <span class="target-icon">${statusIcon}</span>
            <div class="target-info">
              <span class="target-name">${info.friendlyName}</span>
              <span class="target-description">${info.description}</span>
            </div>
            <span class="target-attempts">(${target.attempts} tentativas)</span>
          </div>
        `;
      })
      .join('');
  }

  /**
   * Atualiza as instruções para o usuário.
   */
  private updateInstructions(session: AutoMappingSession): void {
    const instructionsContainer = this.panel?.querySelector('.mettri-auto-mapping-instructions');
    if (!instructionsContainer) {
      return;
    }

    const currentTarget = session.targets[this.currentTargetIndex];
    if (!currentTarget) {
      instructionsContainer.innerHTML = `
        <div class="success-message">
          <p>✓ Todos os elementos foram mapeados com sucesso!</p>
          <p>Clique em "Completar" para finalizar.</p>
        </div>
      `;
      return;
    }

    const info = this.getSelectorInfo(currentTarget.selectorId);

    if (currentTarget.status === 'pending') {
      instructionsContainer.innerHTML = `
        <div class="instruction-step">
          <p class="step-title">📌 O que fazer:</p>
          <p class="step-description"><strong>${info.example}</strong></p>
          <p class="step-hint">💡 Dica: ${info.visualHint}</p>
          <p class="step-note">Passe o mouse sobre os elementos para ver o destaque verde</p>
        </div>
      `;
      this.enableClickMode();
    } else if (currentTarget.status === 'validating') {
      instructionsContainer.innerHTML = `
        <div class="instruction-validating">
          <p>⟳ Validando "${info.friendlyName}"...</p>
          <p class="validating-note">Aguarde enquanto verificamos se o elemento está correto</p>
        </div>
      `;
    } else if (currentTarget.status === 'success') {
      instructionsContainer.innerHTML = `
        <div class="instruction-success">
          <p>✓ <strong>${info.friendlyName}</strong> mapeado com sucesso!</p>
          <p class="success-note">Prosseguindo para o próximo elemento...</p>
        </div>
      `;
      this.moveToNextTarget();
    } else if (currentTarget.status === 'failed') {
      instructionsContainer.innerHTML = `
        <div class="instruction-failed">
          <p>✗ Não foi possível mapear <strong>${info.friendlyName}</strong></p>
          <p class="failed-description">${info.description}</p>
          <p class="failed-example"><strong>Tente novamente:</strong> ${info.example}</p>
          <p class="failed-hint">💡 ${info.visualHint}</p>
        </div>
      `;
      this.enableClickMode();
    }
  }

  /**
   * Habilita modo de clique (aguarda usuário clicar em elemento).
   */
  private enableClickMode(): void {
    this.removeClickHandler();

    // Adicionar highlight ao passar mouse
    document.addEventListener('mousemove', (e) => {
      const element = document.elementFromPoint(e.clientX, e.clientY);
      if (element instanceof HTMLElement) {
        this.highlightElement(element);
      }
    });

    // Adicionar handler de clique
    this.clickHandler = async (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const element = this.autoMapper.getElementAtCoordinates(e.clientX, e.clientY);
      if (!element) {
        return;
      }

      const session = this.autoMapper.getSession();
      if (!session) {
        return;
      }

      const currentTarget = session.targets[this.currentTargetIndex];
      if (!currentTarget) {
        return;
      }

      // Mapear elemento
      const newSelector = await this.autoMapper.mapElement(currentTarget.selectorId, element);
      if (newSelector) {
        this.updateContent();
      } else {
        // Falhou, tentar novamente
        this.updateContent();
      }
    };

    document.addEventListener('click', this.clickHandler, true);
  }

  /**
   * Remove handler de clique.
   */
  private removeClickHandler(): void {
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler, true);
      this.clickHandler = null;
    }
  }

  /**
   * Destaca um elemento visualmente.
   */
  private highlightElement(element: HTMLElement): void {
    this.removeHighlight();

    const rect = element.getBoundingClientRect();
    this.highlightOverlay = document.createElement('div');
    this.highlightOverlay.className = 'mettri-auto-mapping-highlight';
    this.highlightOverlay.style.cssText = `
      position: fixed;
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      border: 2px solid #25D366;
      background: rgba(37, 211, 102, 0.1);
      pointer-events: none;
      z-index: 999998;
    `;
    document.body.appendChild(this.highlightOverlay);
  }

  /**
   * Remove highlight.
   */
  private removeHighlight(): void {
    if (this.highlightOverlay) {
      this.highlightOverlay.remove();
      this.highlightOverlay = null;
    }
  }

  /**
   * Move para o próximo target.
   */
  private moveToNextTarget(): void {
    const session = this.autoMapper.getSession();
    if (!session) {
      return;
    }

    this.currentTargetIndex++;
    if (this.currentTargetIndex >= session.targets.length) {
      // Todos mapeados
      const completeBtn = this.panel?.querySelector('.mettri-auto-mapping-complete') as HTMLButtonElement;
      if (completeBtn) {
        completeBtn.disabled = false;
      }
    } else {
      this.updateContent();
    }
  }

  /**
   * Atualiza progresso.
   */
  private updateProgress(progress: number): void {
    const progressBar = this.panel?.querySelector('.mettri-auto-mapping-progress-bar') as HTMLElement;
    const progressText = this.panel?.querySelector('.mettri-auto-mapping-progress-text');
    
    if (progressBar) {
      progressBar.style.width = `${progress}%`;
    }
    if (progressText) {
      progressText.textContent = `${progress}%`;
    }
  }

  /**
   * Atualiza status.
   */
  private updateStatus(status: string): void {
    const statusContainer = this.panel?.querySelector('.mettri-auto-mapping-status');
    if (statusContainer) {
      statusContainer.textContent = status;
    }
  }

  /**
   * Completa o mapeamento.
   */
  private async completeMapping(): Promise<void> {
    try {
      const results = await this.autoMapper.completeSession();
      alert(`Auto-mapeamento completado! ${results.length} seletores atualizados.`);
      this.hide();
    } catch (error) {
      console.error('Mettri: Erro ao completar mapeamento:', error);
      alert('Erro ao completar mapeamento. Verifique o console para detalhes.');
    }
  }

  /**
   * Adiciona estilos inline ao painel.
   * TODO: Mover para arquivo CSS separado
   */
  private addStyles(): void {
    if (!this.panel) {
      return;
    }

    const style = document.createElement('style');
    style.textContent = `
      .mettri-auto-mapping-panel {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 400px;
        max-height: 80vh;
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 999999;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .mettri-auto-mapping-header {
        padding: 16px;
        border-bottom: 1px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .mettri-auto-mapping-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }
      .mettri-auto-mapping-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #999;
      }
      .mettri-auto-mapping-content {
        padding: 16px;
        overflow-y: auto;
        flex: 1;
      }
      .mettri-auto-mapping-status {
        margin-bottom: 12px;
        color: #666;
        font-size: 14px;
      }
      .mettri-auto-mapping-progress {
        margin-bottom: 16px;
      }
      .mettri-auto-mapping-progress-bar {
        height: 8px;
        background: #25D366;
        border-radius: 4px;
        transition: width 0.3s;
      }
      .mettri-auto-mapping-progress-text {
        margin-top: 4px;
        font-size: 12px;
        color: #999;
      }
      .mettri-auto-mapping-instructions {
        margin-bottom: 16px;
        padding: 12px;
        background: #f5f5f5;
        border-radius: 4px;
        font-size: 14px;
      }
      .mettri-auto-mapping-instructions code {
        background: #e0e0e0;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 12px;
      }
      .mettri-auto-mapping-targets {
        max-height: 200px;
        overflow-y: auto;
      }
      .mettri-auto-mapping-target {
        padding: 8px;
        margin-bottom: 4px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
      }
      .mettri-auto-mapping-target.current {
        background: #e3f2fd;
        border: 1px solid #2196F3;
      }
      .mettri-auto-mapping-target.status-success {
        background: #e8f5e9;
        color: #2e7d32;
      }
      .mettri-auto-mapping-target.status-failed {
        background: #ffebee;
        color: #c62828;
      }
      .target-info {
        display: flex;
        flex-direction: column;
        flex: 1;
        gap: 4px;
      }
      .target-name {
        font-weight: 600;
        font-size: 14px;
      }
      .target-description {
        font-size: 12px;
        color: #666;
      }
      .instruction-step, .instruction-validating, .instruction-success, .instruction-failed, .success-message {
        padding: 12px;
        border-radius: 6px;
      }
      .instruction-step {
        background: #e3f2fd;
        border-left: 4px solid #2196F3;
      }
      .step-title {
        font-weight: 600;
        margin-bottom: 8px;
        color: #1976D2;
        font-size: 14px;
      }
      .step-description {
        font-size: 15px;
        margin-bottom: 8px;
        line-height: 1.5;
        color: #333;
      }
      .step-hint {
        font-size: 13px;
        color: #555;
        margin-bottom: 4px;
        font-style: italic;
        line-height: 1.4;
      }
      .step-note {
        font-size: 12px;
        color: #888;
        margin-top: 8px;
        line-height: 1.4;
      }
      .instruction-validating {
        background: #fff3e0;
        border-left: 4px solid #ff9800;
      }
      .validating-note {
        font-size: 12px;
        color: #666;
        margin-top: 4px;
      }
      .instruction-success {
        background: #e8f5e9;
        border-left: 4px solid #2e7d32;
      }
      .success-note {
        font-size: 12px;
        color: #2e7d32;
        margin-top: 4px;
      }
      .instruction-failed {
        background: #ffebee;
        border-left: 4px solid #c62828;
      }
      .failed-description, .failed-example, .failed-hint {
        margin-top: 8px;
        font-size: 13px;
        line-height: 1.5;
      }
      .failed-example {
        font-weight: 500;
        color: #333;
      }
      .success-message {
        background: #e8f5e9;
        border-left: 4px solid #2e7d32;
        text-align: center;
      }
      .success-message p {
        margin: 4px 0;
      }
      .mettri-auto-mapping-actions {
        padding: 16px;
        border-top: 1px solid #eee;
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
      .mettri-auto-mapping-actions button {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }
      .mettri-auto-mapping-cancel {
        background: #f5f5f5;
        color: #333;
      }
      .mettri-auto-mapping-complete {
        background: #25D366;
        color: white;
      }
      .mettri-auto-mapping-complete:disabled {
        background: #ccc;
        cursor: not-allowed;
      }
    `;
    document.head.appendChild(style);
  }
}
