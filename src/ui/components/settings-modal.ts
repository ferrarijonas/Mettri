/**
 * SettingsModal - Painel de configurações da extensão
 * 
 * Renderiza as configurações inline dentro do #mettri-content (como um módulo),
 * não como overlay flutuante. Aceita callback onClose para restaurar módulo anterior.
 */

import { getIcon } from '../icons/lucide-icons';
import type { ModuleUpdater } from '../../infrastructure/module-updater';
import { MettriBridgeClient } from '../../content/bridge-client';

export class SettingsModal {
  private viewEl: HTMLElement | null = null;
  private containerEl: HTMLElement | null = null;
  private isOpen = false;
  private moduleUpdater: ModuleUpdater;
  private bridge = new MettriBridgeClient(5000);
  private autoUpdateEnabled = true;
  private devModeEnabled = false;
  private openaiApiKey = '';
  private deepseekApiKey = '';
  private onClose: (() => void) | null = null;

  constructor(moduleUpdater: ModuleUpdater) {
    this.moduleUpdater = moduleUpdater;
  }

  /**
   * Abre as configurações inline no container fornecido.
   * @param container - Elemento onde renderizar (ex.: #mettri-content)
   * @param onClose - Callback chamado ao fechar (ex.: restaurar módulo anterior)
   */
  async show(container: HTMLElement, onClose?: () => void): Promise<void> {
    // Se a view foi removida externamente (ex.: PanelShell trocou de módulo), resetar estado
    if (this.viewEl && !this.viewEl.isConnected) {
      this.viewEl = null;
      this.isOpen = false;
    }
    if (this.isOpen) return;
    this.onClose = onClose ?? null;
    await this.loadSettings();
    this.createView(container);
    this.isOpen = true;
  }

  /**
   * Fecha as configurações e restaura o módulo anterior.
   */
  close(): void {
    if (this.viewEl) {
      this.viewEl.remove();
      this.viewEl = null;
    }
    this.containerEl = null;
    this.isOpen = false;
    this.onClose?.();
  }

  /**
   * Carrega configurações do storage via bridge
   */
  private async loadSettings(): Promise<void> {
    try {
      const result = await this.bridge.storageGet([
        'autoUpdateEnabled',
        'moduleUpdateVersion',
        'moduleUpdateCheckedAt',
        'mettri:devMode',
        'mettri:openai:apiKey',
        'mettri:deepseek:apiKey',
      ]);
      this.autoUpdateEnabled = result.autoUpdateEnabled !== false;
      this.devModeEnabled = result['mettri:devMode'] === true;
      this.openaiApiKey = typeof result['mettri:openai:apiKey'] === 'string' ? result['mettri:openai:apiKey'] : '';
      this.deepseekApiKey = typeof result['mettri:deepseek:apiKey'] === 'string' ? result['mettri:deepseek:apiKey'] : '';
    } catch (error) {
      console.error('[SettingsModal] Erro ao carregar configurações:', error);
    }
  }

  /**
   * Cria a view de configurações inline dentro do container.
   * Design: cards glass com tipografia do design system, sem botão de fechar.
   */
  private createView(container: HTMLElement): void {
    container.innerHTML = '';

    const view = document.createElement('div');
    view.className = 'bg-background rounded-xl p-4 space-y-5';
    view.setAttribute('data-module-container', 'settings');

    const manifest =
      typeof chrome !== 'undefined' && typeof chrome.runtime?.getManifest === 'function'
        ? chrome.runtime.getManifest()
        : null;
    const currentVersion = manifest?.version ?? '—';

    const hasOpenAi = this.openaiApiKey.length > 0;
    const hasDeepSeek = this.deepseekApiKey.length > 0;
    const openAiLabel = `OpenAI${hasOpenAi ? '  ✓' : ''}`;
    const deepSeekLabel = `DeepSeek${hasDeepSeek ? '  ✓' : ''}`;

    view.innerHTML = `
      <!-- Chaves da API -->
      <div class="space-y-3">
        <h3 class="text-sm font-semibold text-foreground" style="letter-spacing:-0.01em">Chaves da API</h3>

        <div class="bg-card rounded-xl p-3.5 space-y-2 border border-border/30">
          <label class="block text-[11px] font-medium text-muted-foreground uppercase tracking-wide">${openAiLabel}</label>
          <input type="password" id="mettri-openai-key" class="w-full rounded-lg border border-border/50 bg-background text-foreground px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent" placeholder="sk-..." value="${this.escapeHtml(this.openaiApiKey)}" />
          <div class="flex items-center gap-2">
            <button id="mettri-save-openai-key" class="text-[13px] font-semibold px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              Salvar chave
            </button>
            <span id="mettri-openai-key-status" class="text-[13px] text-muted-foreground"></span>
          </div>
        </div>

        <div class="bg-card rounded-xl p-3.5 space-y-2 border border-border/30">
          <label class="block text-[11px] font-medium text-muted-foreground uppercase tracking-wide">${deepSeekLabel}</label>
          <input type="password" id="mettri-deepseek-key" class="w-full rounded-lg border border-border/50 bg-background text-foreground px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent" placeholder="sk-..." value="${this.escapeHtml(this.deepseekApiKey)}" />
          <div class="flex items-center gap-2">
            <button id="mettri-save-deepseek-key" class="text-[13px] font-semibold px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              Salvar chave
            </button>
            <span id="mettri-deepseek-key-status" class="text-[13px] text-muted-foreground"></span>
          </div>
        </div>
      </div>

      <!-- Atualizações Automáticas -->
      <div class="bg-card rounded-xl p-3.5 flex items-center justify-between border border-border/30">
        <div>
          <p class="text-[13px] font-semibold text-foreground">Atualizações Automáticas</p>
          <p class="text-[12px] text-muted-foreground mt-0.5">Verificação e aplicação automática de atualizações</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-3">
          <input type="checkbox" id="mettri-auto-update-toggle" class="sr-only peer" ${this.autoUpdateEnabled ? 'checked' : ''}>
          <div class="w-11 h-6 bg-zinc-300 rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
        </label>
      </div>

      <!-- Informações -->
      <div class="bg-card rounded-xl p-3.5 border border-border/30">
        <h3 class="text-[13px] font-semibold text-foreground mb-2">Informações</h3>
        <div class="flex items-baseline gap-2">
          <span class="text-[11px] text-muted-foreground uppercase tracking-wide">Versão atual</span>
          <span class="text-[13px] font-mono text-foreground tabular-nums">${currentVersion}</span>
        </div>
      </div>

      <!-- Modo Desenvolvedor -->
      <div class="bg-card rounded-xl p-3.5 flex items-center justify-between border border-border/30">
        <div>
          <p class="text-[13px] font-semibold text-foreground">Modo Desenvolvedor</p>
          <p class="text-[12px] text-muted-foreground mt-0.5">Mostrar módulos experimentais</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-3">
          <input type="checkbox" id="mettri-dev-mode-toggle" class="sr-only peer" ${this.devModeEnabled ? 'checked' : ''}>
          <div class="w-9 h-5 bg-zinc-300 rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
        </label>
      </div>

      <!-- Ações -->
      <div class="pt-1 space-y-2">
        <button id="mettri-check-updates-now" class="w-full px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 transition-colors tracking-wide">
          Verificar Atualizações Agora
        </button>
        <button id="mettri-clear-cache" class="w-full px-4 py-2.5 rounded-xl bg-background text-foreground text-[13px] font-medium border border-border/50 hover:bg-accent transition-colors">
          Limpar Cache de Módulos
        </button>
      </div>
    `;

    container.appendChild(view);
    this.viewEl = view;
    this.containerEl = container;

    this.setupEventListeners();
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Salva chave de API via bridge
   */
  private async saveApiKey(storageKey: string, inputId: string, statusId: string): Promise<void> {
    const input = this.viewEl?.querySelector(`#${inputId}`) as HTMLInputElement | null;
    const status = this.viewEl?.querySelector(`#${statusId}`) as HTMLElement | null;
    if (!input || !status) return;

    const key = input.value.trim();
    if (!key) {
      status.textContent = 'Informe uma chave antes de salvar.';
      status.className = 'text-xs text-destructive';
      return;
    }

    try {
      await this.bridge.storageSet({ [storageKey]: key });
      status.textContent = 'Salvo ✓';
      status.className = 'text-xs text-primary';

      if (storageKey === 'mettri:openai:apiKey') this.openaiApiKey = key;
      else if (storageKey === 'mettri:deepseek:apiKey') this.deepseekApiKey = key;

      // Atualizar indicador ✓ no label
      const label = input.closest('div')?.querySelector('label');
      if (label && !label.innerHTML.includes('✓')) {
        const text = label.childNodes[0]?.textContent ?? '';
        label.innerHTML = text + ' <span class="text-primary font-semibold">✓</span>';
      }

      setTimeout(() => { status.textContent = ''; }, 2000);
    } catch {
      status.textContent = 'Erro ao salvar';
      status.className = 'text-xs text-destructive';
    }
  }

  private setupEventListeners(): void {
    if (!this.viewEl) return;

    // Salvar chave OpenAI
    this.viewEl.querySelector('#mettri-save-openai-key')?.addEventListener('click', () => {
      this.saveApiKey('mettri:openai:apiKey', 'mettri-openai-key', 'mettri-openai-key-status');
    });

    // Salvar chave DeepSeek
    this.viewEl.querySelector('#mettri-save-deepseek-key')?.addEventListener('click', () => {
      this.saveApiKey('mettri:deepseek:apiKey', 'mettri-deepseek-key', 'mettri-deepseek-key-status');
    });

    // Enter nos inputs das chaves
    (this.viewEl.querySelector('#mettri-openai-key') as HTMLInputElement)
      ?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.saveApiKey('mettri:openai:apiKey', 'mettri-openai-key', 'mettri-openai-key-status');
      });
    (this.viewEl.querySelector('#mettri-deepseek-key') as HTMLInputElement)
      ?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.saveApiKey('mettri:deepseek:apiKey', 'mettri-deepseek-key', 'mettri-deepseek-key-status');
      });

    // Toggle auto-update
    (this.viewEl.querySelector('#mettri-auto-update-toggle') as HTMLInputElement)
      ?.addEventListener('change', async (e) => {
        await this.setAutoUpdateEnabled((e.target as HTMLInputElement).checked);
      });

    // Verificar atualizações
    this.viewEl.querySelector('#mettri-check-updates-now')
      ?.addEventListener('click', () => this.checkUpdatesNow());

    // Limpar cache
    this.viewEl.querySelector('#mettri-clear-cache')
      ?.addEventListener('click', () => this.clearCache());

    // Toggle Modo Desenvolvedor
    (this.viewEl.querySelector('#mettri-dev-mode-toggle') as HTMLInputElement)
      ?.addEventListener('change', async (e) => {
        await this.setDevModeEnabled((e.target as HTMLInputElement).checked);
      });
  }

  private async setDevModeEnabled(enabled: boolean): Promise<void> {
    try {
      await this.bridge.storageSet({ 'mettri:devMode': enabled });
      this.devModeEnabled = enabled;
    } catch (error) {
      console.error('[SettingsModal] Erro ao salvar devMode:', error);
    }
  }

  private async setAutoUpdateEnabled(enabled: boolean): Promise<void> {
    try {
      await this.bridge.storageSet({ autoUpdateEnabled: enabled });
      this.autoUpdateEnabled = enabled;
      if (enabled) {
        await this.moduleUpdater.startAutoCheck();
      } else {
        this.moduleUpdater.stopAutoCheck();
      }
    } catch (error) {
      console.error('[SettingsModal] Erro ao salvar configuração:', error);
    }
  }

  private async checkUpdatesNow(): Promise<void> {
    const btn = this.viewEl?.querySelector('#mettri-check-updates-now') as HTMLButtonElement;
    if (!btn) return;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Verificando...';
    try {
      const result = await this.moduleUpdater.checkForUpdates();
      btn.textContent = result.hasUpdate ? 'Atualização disponível!' : 'Nenhuma atualização';
      if (result.hasUpdate) btn.classList.add('bg-green-600');
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('bg-green-600');
        btn.disabled = false;
      }, result.hasUpdate ? 3000 : 2000);
    } catch {
      btn.textContent = 'Erro ao verificar';
      setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 2000);
    }
  }

  private async clearCache(): Promise<void> {
    const btn = this.viewEl?.querySelector('#mettri-clear-cache') as HTMLButtonElement;
    if (!btn) return;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Limpando...';
    try {
      await this.moduleUpdater.clearCache();
      btn.textContent = 'Cache limpo!';
      setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 2000);
    } catch {
      btn.textContent = 'Erro ao limpar';
      setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 2000);
    }
  }
}
