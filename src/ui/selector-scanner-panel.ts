import type { ScanResult, ScanConfig, LayerScanResult, PhoneNumberTestResult } from '../types/selector-scanner';
import { SelectorScanner } from '../infrastructure/selector-scanner';
import { UIBlocker } from '../infrastructure/ui-blocker';
import { SelectorManager } from '../infrastructure/selector-manager';
import { ConfigUpdater } from '../infrastructure/config-updater';
import { SELECTOR_TARGETS, getEssentialTargets } from '../infrastructure/selector-targets';

/**
 * Painel de interface para varredura automática de seletores.
 * 
 * Componentes:
 * - Botão "Varrer Seletores"
 * - Botão "Testar Todos"
 * - Status em tempo real
 * - Barra de progresso
 * - Lista de seletores com status
 */
export class SelectorScannerPanel {
  private container: HTMLElement;
  private scanner: SelectorScanner;
  private blocker: UIBlocker;
  private selectorManager: SelectorManager;
  private updater: ConfigUpdater;
  private isScanning = false;

  constructor() {
    this.scanner = new SelectorScanner();
    this.blocker = new UIBlocker();
    this.selectorManager = new SelectorManager();
    this.updater = new ConfigUpdater();
    this.container = document.createElement('div');
    this.container.className = 'mettri-selector-scanner-panel';
    this.setupCallbacks();
  }

  /**
   * Configura callbacks do scanner.
   */
  private setupCallbacks(): void {
    this.scanner.onProgress((progress) => {
      this.updateProgress(progress);
      this.blocker.updateProgress(progress, `Varrendo seletores... ${progress}%`);
    });

    this.scanner.onStatus((status) => {
      this.updateStatus(status);
    });
  }

  /**
   * Renderiza o painel.
   * 
   * @returns Elemento HTML do painel
   */
  render(): HTMLElement {
    this.container.innerHTML = `
      <div class="mettri-scanner-header">
        <h3>Varredura de Seletores</h3>
      </div>
      <div class="mettri-scanner-actions">
        <button class="mettri-btn mettri-btn-primary" id="mettri-scan-essential-btn" ${this.isScanning ? 'disabled' : ''}>
          ${this.isScanning ? 'Varrendo...' : 'Varrer Essenciais'}
        </button>
        <button class="mettri-btn" id="mettri-scan-all-btn" ${this.isScanning ? 'disabled' : ''}>
          Varrer Todos
        </button>
        <button class="mettri-btn" id="mettri-test-phone-btn" ${this.isScanning ? 'disabled' : ''}>
          Testar com Número
        </button>
        <button class="mettri-btn" id="mettri-test-all-btn" ${this.isScanning ? 'disabled' : ''}>
          Testar Todos
        </button>
      </div>
      <div class="mettri-scanner-status">
        <span class="mettri-scanner-status-dot" id="mettri-scanner-status-dot"></span>
        <span id="mettri-scanner-status-text">Aguardando...</span>
      </div>
      <div class="mettri-scanner-progress">
        <div class="mettri-scanner-progress-bar" id="mettri-scanner-progress-bar"></div>
        <div class="mettri-scanner-progress-text" id="mettri-scanner-progress-text">0%</div>
      </div>
      <div class="mettri-scanner-summary">
        <div class="mettri-scanner-summary-item">
          <span class="summary-label">Encontrados:</span>
          <span class="summary-value" id="mettri-scanner-found">0</span>
          <span class="summary-total">/ ${SELECTOR_TARGETS.length}</span>
        </div>
        <div class="mettri-scanner-summary-item">
          <span class="summary-label">Validados:</span>
          <span class="summary-value" id="mettri-scanner-validated">0</span>
        </div>
        <div class="mettri-scanner-summary-item">
          <span class="summary-label">Falhas:</span>
          <span class="summary-value" id="mettri-scanner-failed">0</span>
        </div>
      </div>
      <div class="mettri-scanner-results" id="mettri-scanner-results">
        <div class="mettri-scanner-empty">
          <p>Nenhuma varredura realizada ainda.</p>
          <p>Clique em "Varrer Essenciais" para começar.</p>
        </div>
      </div>
      <div class="mettri-scanner-layer-comparison" id="mettri-scanner-layer-comparison" style="display: none;">
        <h4>Comparação de Camadas</h4>
        <div id="mettri-layer-comparison-table"></div>
      </div>
    `;

    this.addStyles();
    this.attachEventListeners();

    return this.container;
  }

  /**
   * Anexa event listeners aos botões.
   */
  private attachEventListeners(): void {
    const scanEssentialBtn = this.container.querySelector('#mettri-scan-essential-btn');
    scanEssentialBtn?.addEventListener('click', () => {
      this.startScanEssential();
    });

    const scanAllBtn = this.container.querySelector('#mettri-scan-all-btn');
    scanAllBtn?.addEventListener('click', () => {
      this.startScan();
    });

    const testPhoneBtn = this.container.querySelector('#mettri-test-phone-btn');
    testPhoneBtn?.addEventListener('click', () => {
      this.showPhoneTestModal();
    });

    const testBtn = this.container.querySelector('#mettri-test-all-btn');
    testBtn?.addEventListener('click', () => {
      this.testAllSelectors();
    });
  }

  /**
   * Inicia varredura apenas dos seletores essenciais.
   */
  private async startScanEssential(): Promise<void> {
    if (this.isScanning) {
      return;
    }

    this.isScanning = true;
    this.updateStatus('Iniciando varredura de seletores essenciais...');
    this.updateButtonStates(true);

    // Bloquear UI
    this.blocker.block(
      'Mettri está mapeando seletores essenciais. Por favor, aguarde...',
      () => {
        this.cancelScan();
      }
    );

    try {
      const essentialTargets = getEssentialTargets();
      const config: ScanConfig = {
        targets: essentialTargets,
        timeout: 30000,
        maxCandidatesPerSelector: 10,
        requireP0Validation: true,
        minP1SuccessRate: 0.8,
      };

      const results = await this.scanner.scanAll(config);

      // Processar resultados
      await this.processResults(results);

      // Desbloquear UI
      this.blocker.unblock();
      this.updateStatus('Varredura de essenciais concluída!');
    } catch (error) {
      console.error('Mettri: Erro na varredura de essenciais:', error);
      this.blocker.unblock();
      this.updateStatus(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      this.isScanning = false;
      this.updateButtonStates(false);
    }
  }

  /**
   * Inicia varredura completa (todos os seletores).
   */
  private async startScan(): Promise<void> {
    if (this.isScanning) {
      return;
    }

    this.isScanning = true;
    this.updateStatus('Iniciando varredura...');
    this.updateButtonStates(true);

    // Bloquear UI
    this.blocker.block(
      'Mettri está mapeando seletores automaticamente. Por favor, aguarde...',
      () => {
        this.cancelScan();
      }
    );

    try {
      const config: ScanConfig = {
        targets: SELECTOR_TARGETS,
        timeout: 30000, // 30 segundos
        maxCandidatesPerSelector: 10,
        requireP0Validation: true,
        minP1SuccessRate: 0.8, // 80%
      };

      const results = await this.scanner.scanAll(config);

      // Processar resultados
      await this.processResults(results);

      // Desbloquear UI
      this.blocker.unblock();
      this.updateStatus('Varredura concluída!');
    } catch (error) {
      console.error('Mettri: Erro na varredura:', error);
      this.blocker.unblock();
      this.updateStatus(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      this.isScanning = false;
      this.updateButtonStates(false);
    }
  }

  /**
   * Testa todos os seletores existentes.
   */
  private async testAllSelectors(): Promise<void> {
    if (this.isScanning) {
      return;
    }

    this.isScanning = true;
    this.updateStatus('Testando seletores...');
    this.updateButtonStates(true);

    const results: ScanResult[] = [];

    for (const target of SELECTOR_TARGETS) {
      const selector = await this.selectorManager.getSelector(target.id);
      if (selector) {
        const elements = document.querySelectorAll(selector);
        results.push({
          selectorId: target.id,
          candidates: [selector],
          bestSelector: selector,
          validated: elements.length > 0,
          validationErrors: elements.length === 0 ? ['Seletor não encontrou elementos'] : [],
          testDuration: 0,
          elementFound: elements.length > 0,
          elementCount: elements.length,
        });
      } else {
        results.push({
          selectorId: target.id,
          candidates: [],
          bestSelector: null,
          validated: false,
          validationErrors: ['Seletor não encontrado'],
          testDuration: 0,
          elementFound: false,
          elementCount: 0,
        });
      }
    }

    this.renderResults(results);
    this.updateStatus('Teste concluído!');
    this.isScanning = false;
    this.updateButtonStates(false);
  }

  /**
   * Processa resultados da varredura.
   */
  private async processResults(results: ScanResult[]): Promise<void> {
    // Renderizar resultados
    this.renderResults(results);

    // Se for varredura de essenciais, também fazer comparação de camadas
    const essentialTargets = getEssentialTargets();
    if (results.length <= essentialTargets.length) {
      // Provavelmente é varredura de essenciais, fazer comparação de camadas
      await this.renderLayerComparison(essentialTargets);
    }

    // Atualizar seletores validados
    const updates: Array<{ selectorId: string; newSelector: string }> = [];

    for (const result of results) {
      if (result.validated && result.bestSelector) {
        await this.selectorManager.updateSelector(result.selectorId, result.bestSelector);
        updates.push({
          selectorId: result.selectorId,
          newSelector: result.bestSelector,
        });
      }
    }

    // Enviar para remoto se houver atualizações
    if (updates.length > 0) {
      try {
        await this.updater.updateRemote(
          updates.map(u => ({
            ...u,
            oldSelector: 'unknown',
            validated: true,
          }))
        );
        console.log(`Mettri: ${updates.length} seletores atualizados e enviados para servidor`);
      } catch (error) {
        console.warn('Mettri: Falha ao atualizar remoto, mas seletores foram salvos localmente');
      }
    }
  }

  /**
   * Renderiza comparação de camadas para os seletores essenciais.
   */
  private async renderLayerComparison(targets: typeof SELECTOR_TARGETS): Promise<void> {
    const comparisonDiv = this.container.querySelector('#mettri-scanner-layer-comparison');
    const tableDiv = this.container.querySelector('#mettri-layer-comparison-table');
    
    if (!comparisonDiv || !tableDiv) {
      return;
    }

    comparisonDiv.style.display = 'block';
    tableDiv.innerHTML = '<p>Comparando camadas...</p>';

    const config: ScanConfig = {
      targets: [],
      timeout: 30000,
      maxCandidatesPerSelector: 10,
      requireP0Validation: true,
      minP1SuccessRate: 0.8,
    };

    const allLayerResults: Map<string, LayerScanResult[]> = new Map();

    for (const target of targets) {
      try {
        const layerResults = await this.scanner.scanSelectorByLayer(target, config);
        allLayerResults.set(target.id, layerResults);
      } catch (error) {
        console.warn(`Mettri: Erro ao comparar camadas para ${target.id}:`, error);
      }
    }

    // Renderizar tabela
    let tableHTML = '<table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
    tableHTML += '<thead><tr>';
    tableHTML += '<th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Seletor</th>';
    tableHTML += '<th style="border: 1px solid #ddd; padding: 8px;">Camada</th>';
    tableHTML += '<th style="border: 1px solid #ddd; padding: 8px;">Elementos</th>';
    tableHTML += '<th style="border: 1px solid #ddd; padding: 8px;">Precisão</th>';
    tableHTML += '<th style="border: 1px solid #ddd; padding: 8px;">Tempo (ms)</th>';
    tableHTML += '<th style="border: 1px solid #ddd; padding: 8px;">Seletor</th>';
    tableHTML += '</tr></thead><tbody>';

    for (const target of targets) {
      const layerResults = allLayerResults.get(target.id) || [];
      const bestLayer = layerResults.reduce((best, current) => {
        if (!best) return current;
        if (current.precision > best.precision) return current;
        if (current.precision === best.precision && current.elementsFound > best.elementsFound) return current;
        return best;
      }, null as LayerScanResult | null);

      for (let i = 0; i < layerResults.length; i++) {
        const result = layerResults[i];
        const isBest = result === bestLayer;
        const rowStyle = isBest ? 'background: #e8f5e9; font-weight: bold;' : '';

        tableHTML += '<tr style="' + rowStyle + '">';
        if (i === 0) {
          tableHTML += `<td rowspan="${layerResults.length}" style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">${target.description}</td>`;
        }
        tableHTML += `<td style="border: 1px solid #ddd; padding: 8px;">${result.layerName} ${isBest ? '⭐' : ''}</td>`;
        tableHTML += `<td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${result.elementsFound}</td>`;
        tableHTML += `<td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${result.precision.toFixed(1)}%</td>`;
        tableHTML += `<td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${result.executionTime}</td>`;
        tableHTML += `<td style="border: 1px solid #ddd; padding: 8px; font-family: monospace; font-size: 11px;">${result.bestSelector || '-'}</td>`;
        tableHTML += '</tr>';
      }
    }

    tableHTML += '</tbody></table>';
    tableDiv.innerHTML = tableHTML;
  }

  /**
   * Renderiza lista de resultados.
   */
  private renderResults(results: ScanResult[]): void {
    const resultsContainer = this.container.querySelector('#mettri-scanner-results');
    if (!resultsContainer) {
      return;
    }

    if (results.length === 0) {
      resultsContainer.innerHTML = `
        <div class="mettri-scanner-empty">
          <p>Nenhum resultado disponível.</p>
        </div>
      `;
      return;
    }

    const found = results.filter(r => r.elementFound).length;
    const validated = results.filter(r => r.validated).length;
    const failed = results.filter(r => !r.validated && r.elementFound).length;

    // Atualizar resumo
    const foundEl = this.container.querySelector('#mettri-scanner-found');
    const validatedEl = this.container.querySelector('#mettri-scanner-validated');
    const failedEl = this.container.querySelector('#mettri-scanner-failed');

    if (foundEl) foundEl.textContent = found.toString();
    if (validatedEl) validatedEl.textContent = validated.toString();
    if (failedEl) failedEl.textContent = failed.toString();

    // Renderizar lista
    resultsContainer.innerHTML = results
      .map(result => {
        const target = SELECTOR_TARGETS.find(t => t.id === result.selectorId);
        const statusIcon = result.validated ? '✓' : result.elementFound ? '⚠' : '✗';
        const statusClass = result.validated ? 'success' : result.elementFound ? 'warning' : 'failed';

        return `
          <div class="mettri-scanner-result ${statusClass}" data-selector-id="${result.selectorId}">
            <div class="result-header">
              <span class="result-icon">${statusIcon}</span>
              <span class="result-name">${target?.description || result.selectorId}</span>
              <span class="result-priority">${target?.priority || ''}</span>
            </div>
            <div class="result-details">
              ${result.bestSelector ? `<div class="result-selector"><code>${result.bestSelector}</code></div>` : ''}
              ${result.elementCount > 0 ? `<div class="result-count">${result.elementCount} elemento(s) encontrado(s)</div>` : ''}
              ${result.validationErrors.length > 0 ? `<div class="result-errors">${result.validationErrors.join(', ')}</div>` : ''}
            </div>
          </div>
        `;
      })
      .join('');
  }

  /**
   * Cancela varredura em andamento.
   */
  private cancelScan(): void {
    this.isScanning = false;
    this.updateButtonStates(false);
    this.updateStatus('Varredura cancelada');
  }

  /**
   * Atualiza progresso.
   */
  private updateProgress(progress: number): void {
    const progressBar = this.container.querySelector('#mettri-scanner-progress-bar') as HTMLElement;
    const progressText = this.container.querySelector('#mettri-scanner-progress-text');

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
    const statusText = this.container.querySelector('#mettri-scanner-status-text');
    const statusDot = this.container.querySelector('#mettri-scanner-status-dot');

    if (statusText) {
      statusText.textContent = status;
    }

    if (statusDot) {
      const isActive = this.isScanning;
      statusDot.className = `mettri-scanner-status-dot ${isActive ? 'active' : ''}`;
    }
  }

  /**
   * Atualiza estados dos botões.
   */
  private updateButtonStates(disabled: boolean): void {
    const scanEssentialBtn = this.container.querySelector('#mettri-scan-essential-btn') as HTMLButtonElement;
    const scanAllBtn = this.container.querySelector('#mettri-scan-all-btn') as HTMLButtonElement;
    const testPhoneBtn = this.container.querySelector('#mettri-test-phone-btn') as HTMLButtonElement;
    const testBtn = this.container.querySelector('#mettri-test-all-btn') as HTMLButtonElement;

    if (scanEssentialBtn) {
      scanEssentialBtn.disabled = disabled;
      scanEssentialBtn.textContent = disabled ? 'Varrendo...' : 'Varrer Essenciais';
    }
    if (scanAllBtn) {
      scanAllBtn.disabled = disabled;
      scanAllBtn.textContent = disabled ? 'Varrendo...' : 'Varrer Todos';
    }
    if (testPhoneBtn) {
      testPhoneBtn.disabled = disabled;
    }
    if (testBtn) {
      testBtn.disabled = disabled;
    }
  }

  /**
   * Mostra modal para teste com número de telefone.
   */
  private showPhoneTestModal(): void {
    const modal = document.createElement('div');
    modal.className = 'mettri-phone-test-modal';
    modal.innerHTML = `
      <div class="mettri-modal-overlay"></div>
      <div class="mettri-modal-content">
        <div class="mettri-modal-header">
          <h3>Testar com Número de Telefone</h3>
          <button class="mettri-modal-close" id="mettri-phone-modal-close">×</button>
        </div>
        <div class="mettri-modal-body">
          <label>
            Número de telefone:
            <input type="text" id="mettri-phone-input" value="7591" placeholder="7591 ou 34999277591" />
          </label>
          <button class="mettri-btn mettri-btn-primary" id="mettri-phone-test-start">Iniciar Teste</button>
          <div id="mettri-phone-test-results" style="margin-top: 16px;"></div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('#mettri-phone-modal-close');
    const overlay = modal.querySelector('.mettri-modal-overlay');
    const startBtn = modal.querySelector('#mettri-phone-test-start');
    const phoneInput = modal.querySelector('#mettri-phone-input') as HTMLInputElement;
    const resultsDiv = modal.querySelector('#mettri-phone-test-results');

    const closeModal = () => {
      document.body.removeChild(modal);
    };

    closeBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);

    startBtn?.addEventListener('click', async () => {
      const phoneNumber = phoneInput?.value || '7591';
      if (!phoneNumber) {
        alert('Por favor, insira um número de telefone');
        return;
      }

      if (startBtn instanceof HTMLButtonElement) {
        startBtn.disabled = true;
        startBtn.textContent = 'Testando...';
      }

      if (resultsDiv) {
        resultsDiv.innerHTML = '<p>Executando teste...</p>';
      }

      try {
        const result = await this.scanner.testWithPhoneNumber(phoneNumber);
        this.renderPhoneTestResults(resultsDiv, result);
      } catch (error) {
        if (resultsDiv) {
          resultsDiv.innerHTML = `<p style="color: red;">Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}</p>`;
        }
      } finally {
        if (startBtn instanceof HTMLButtonElement) {
          startBtn.disabled = false;
          startBtn.textContent = 'Iniciar Teste';
        }
      }
    });

    // Adicionar estilos do modal
    if (!document.getElementById('mettri-phone-modal-styles')) {
      const style = document.createElement('style');
      style.id = 'mettri-phone-modal-styles';
      style.textContent = `
        .mettri-phone-test-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 10000;
        }
        .mettri-modal-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
        }
        .mettri-modal-content {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          border-radius: 8px;
          padding: 0;
          min-width: 400px;
          max-width: 600px;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }
        .mettri-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid #eee;
        }
        .mettri-modal-header h3 {
          margin: 0;
          font-size: 18px;
        }
        .mettri-modal-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .mettri-modal-close:hover {
          color: #333;
        }
        .mettri-modal-body {
          padding: 16px;
        }
        .mettri-modal-body label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
        }
        .mettri-modal-body input {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          margin-bottom: 16px;
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Renderiza resultados do teste com número.
   */
  private renderPhoneTestResults(container: HTMLElement | null, result: PhoneNumberTestResult): void {
    if (!container) return;

    const successCount = result.steps.filter(s => s.success).length;
    const totalSteps = result.steps.length;

    container.innerHTML = `
      <div style="margin-top: 16px;">
        <h4>Resultado do Teste</h4>
        <p><strong>Número:</strong> ${result.phoneNumber}</p>
        <p><strong>Status:</strong> <span style="color: ${result.overallSuccess ? 'green' : 'red'}">${result.overallSuccess ? '✓ Sucesso' : '✗ Falhou'}</span></p>
        <p><strong>Passos completos:</strong> ${successCount}/${totalSteps}</p>
        <p><strong>Duração:</strong> ${result.duration}ms</p>
        <div style="margin-top: 16px;">
          <h5>Detalhes dos Passos:</h5>
          <ul style="list-style: none; padding: 0;">
            ${result.steps.map(step => `
              <li style="padding: 8px; margin-bottom: 8px; border-left: 4px solid ${step.success ? 'green' : 'red'}; background: ${step.success ? '#e8f5e9' : '#ffebee'};">
                <strong>${step.step}</strong> (${step.selectorId})<br/>
                ${step.success ? '✓ Sucesso' : `✗ Falhou: ${step.error || 'Erro desconhecido'}`}
                ${step.elementFound !== undefined ? `<br/><small>Elemento encontrado: ${step.elementFound ? 'Sim' : 'Não'}</small>` : ''}
              </li>
            `).join('')}
          </ul>
        </div>
      </div>
    `;
  }

  /**
   * Adiciona estilos CSS.
   */
  private addStyles(): void {
    if (document.getElementById('mettri-scanner-panel-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'mettri-scanner-panel-styles';
    style.textContent = `
      .mettri-selector-scanner-panel {
        padding: 16px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .mettri-scanner-header h3 {
        margin: 0 0 16px 0;
        font-size: 18px;
        font-weight: 600;
        color: #333;
      }
      .mettri-scanner-actions {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
      }
      .mettri-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
      }
      .mettri-btn-primary {
        background: #25D366;
        color: white;
      }
      .mettri-btn-primary:hover:not(:disabled) {
        background: #20ba5a;
      }
      .mettri-btn:disabled {
        background: #ccc;
        cursor: not-allowed;
      }
      .mettri-scanner-status {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        font-size: 14px;
        color: #666;
      }
      .mettri-scanner-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #ccc;
      }
      .mettri-scanner-status-dot.active {
        background: #25D366;
        animation: mettri-pulse 1.5s ease-in-out infinite;
      }
      @keyframes mettri-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      .mettri-scanner-progress {
        margin-bottom: 16px;
      }
      .mettri-scanner-progress-bar {
        height: 8px;
        background: #25D366;
        border-radius: 4px;
        transition: width 0.3s;
        width: 0%;
      }
      .mettri-scanner-progress-text {
        margin-top: 4px;
        font-size: 12px;
        color: #999;
        text-align: right;
      }
      .mettri-scanner-summary {
        display: flex;
        gap: 16px;
        margin-bottom: 16px;
        padding: 12px;
        background: #f5f5f5;
        border-radius: 4px;
        font-size: 13px;
      }
      .mettri-scanner-summary-item {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .summary-label {
        color: #666;
      }
      .summary-value {
        font-weight: 600;
        color: #333;
      }
      .summary-total {
        color: #999;
      }
      .mettri-scanner-results {
        max-height: 400px;
        overflow-y: auto;
      }
      .mettri-scanner-empty {
        text-align: center;
        padding: 32px;
        color: #999;
      }
      .mettri-scanner-result {
        padding: 12px;
        margin-bottom: 8px;
        border-radius: 4px;
        border-left: 4px solid #ddd;
      }
      .mettri-scanner-result.success {
        background: #e8f5e9;
        border-left-color: #2e7d32;
      }
      .mettri-scanner-result.warning {
        background: #fff3e0;
        border-left-color: #ff9800;
      }
      .mettri-scanner-result.failed {
        background: #ffebee;
        border-left-color: #c62828;
      }
      .result-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      .result-icon {
        font-size: 16px;
      }
      .result-name {
        font-weight: 600;
        font-size: 14px;
        flex: 1;
      }
      .result-priority {
        font-size: 11px;
        padding: 2px 6px;
        background: #e0e0e0;
        border-radius: 3px;
        color: #666;
      }
      .result-details {
        font-size: 12px;
        color: #666;
        margin-left: 24px;
      }
      .result-selector {
        margin-top: 4px;
      }
      .result-selector code {
        background: #f0f0f0;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 11px;
        font-family: 'Courier New', monospace;
      }
      .result-count {
        margin-top: 4px;
        color: #555;
      }
      .result-errors {
        margin-top: 4px;
        color: #c62828;
        font-style: italic;
      }
    `;
    document.head.appendChild(style);
  }
}
