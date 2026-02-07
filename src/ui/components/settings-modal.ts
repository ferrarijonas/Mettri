/**
 * SettingsModal - Modal de configurações da extensão
 * 
 * Permite controlar atualizações automáticas e ver informações de versão.
 */

import { getIcon } from '../icons/lucide-icons';
import { ModuleUpdater } from '../../infrastructure/module-updater';

export class SettingsModal {
  private overlay: HTMLElement | null = null;
  private modal: HTMLElement | null = null;
  private isOpen: boolean = false;
  private moduleUpdater: ModuleUpdater;
  private autoUpdateEnabled: boolean = true;

  constructor(moduleUpdater: ModuleUpdater) {
    this.moduleUpdater = moduleUpdater;
  }

  /**
   * Abre o modal de configurações.
   */
  async show(): Promise<void> {
    if (this.isOpen) {
      this.close();
      return;
    }

    await this.loadSettings();
    await this.createModal();
    this.isOpen = true;
  }

  /**
   * Fecha o modal.
   */
  close(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    this.isOpen = false;
  }

  /**
   * Carrega configurações do storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['autoUpdateEnabled', 'moduleUpdateVersion', 'moduleUpdateCheckedAt']);
      this.autoUpdateEnabled = result.autoUpdateEnabled !== false; // Default true
    } catch (error) {
      console.error('[SettingsModal] Erro ao carregar configurações:', error);
    }
  }

  /**
   * Cria o modal com configurações.
   */
  private async createModal(): Promise<void> {
    // Overlay
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.close();
      }
    });

    // Modal
    const modal = document.createElement('div');
    modal.className = 'glass rounded-2xl border border-border/50 p-6 w-96 max-w-[90vw] max-h-[90vh] overflow-y-auto';
    modal.style.backgroundColor = 'var(--mettri-bg, #ffffff)';
    modal.style.color = 'var(--mettri-text, #0A1014)';

    const currentVersion = (typeof chrome !== 'undefined' && chrome?.runtime?.getManifest?.())?.version ?? '—';
    const updateVersion = await this.getUpdateVersion();
    const lastChecked = await this.getLastChecked();

    modal.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold">Configurações</h2>
        <button class="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center" id="mettri-settings-modal-close">
          ${getIcon('X')}
        </button>
      </div>

      <div class="space-y-6">
        <!-- Atualizações Automáticas -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium">Atualizações Automáticas</label>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="mettri-auto-update-toggle" class="sr-only peer" ${this.autoUpdateEnabled ? 'checked' : ''}>
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
          <p class="text-xs text-muted-foreground">
            Quando habilitado, a extensão verifica e aplica atualizações automaticamente.
          </p>
        </div>

        <!-- Informações de Versão -->
        <div class="border-t border-border/50 pt-4">
          <h3 class="text-sm font-medium mb-3">Informações</h3>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-muted-foreground">Versão atual:</span>
              <span class="font-mono">${currentVersion}</span>
            </div>
            ${updateVersion ? `
            <div class="flex justify-between">
              <span class="text-muted-foreground">Versão módulos:</span>
              <span class="font-mono">${updateVersion}</span>
            </div>
            ` : ''}
            ${lastChecked ? `
            <div class="flex justify-between">
              <span class="text-muted-foreground">Última verificação:</span>
              <span class="text-xs">${lastChecked}</span>
            </div>
            ` : ''}
          </div>
        </div>

        <!-- Ações -->
        <div class="border-t border-border/50 pt-4 space-y-2">
          <button id="mettri-check-updates-now" class="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium">
            Verificar Atualizações Agora
          </button>
          <button id="mettri-clear-cache" class="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors text-sm">
            Limpar Cache de Módulos
          </button>
        </div>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.modal = modal;

    this.setupEventListeners();
  }

  /**
   * Configura event listeners do modal
   */
  private setupEventListeners(): void {
    if (!this.modal) return;

    // Fechar modal
    const closeBtn = this.modal.querySelector('#mettri-settings-modal-close');
    closeBtn?.addEventListener('click', () => this.close());

    // Toggle atualizações automáticas
    const toggle = this.modal.querySelector('#mettri-auto-update-toggle') as HTMLInputElement;
    toggle?.addEventListener('change', async (e) => {
      const enabled = (e.target as HTMLInputElement).checked;
      await this.setAutoUpdateEnabled(enabled);
    });

    // Verificar atualizações agora
    const checkBtn = this.modal.querySelector('#mettri-check-updates-now');
    checkBtn?.addEventListener('click', async () => {
      await this.checkUpdatesNow();
    });

    // Limpar cache
    const clearBtn = this.modal.querySelector('#mettri-clear-cache');
    clearBtn?.addEventListener('click', async () => {
      await this.clearCache();
    });
  }

  /**
   * Define se atualizações automáticas estão habilitadas
   */
  private async setAutoUpdateEnabled(enabled: boolean): Promise<void> {
    try {
      await chrome.storage.local.set({ autoUpdateEnabled: enabled });
      this.autoUpdateEnabled = enabled;

      if (enabled) {
        await this.moduleUpdater.startAutoCheck();
        console.log('[SettingsModal] Atualizações automáticas habilitadas');
      } else {
        this.moduleUpdater.stopAutoCheck();
        console.log('[SettingsModal] Atualizações automáticas desabilitadas');
      }
    } catch (error) {
      console.error('[SettingsModal] Erro ao salvar configuração:', error);
    }
  }

  /**
   * Verifica atualizações manualmente
   */
  private async checkUpdatesNow(): Promise<void> {
    const checkBtn = this.modal?.querySelector('#mettri-check-updates-now') as HTMLButtonElement;
    if (!checkBtn) return;

    const originalText = checkBtn.textContent;
    checkBtn.disabled = true;
    checkBtn.textContent = 'Verificando...';

    try {
      const result = await this.moduleUpdater.checkForUpdates();
      
      if (result.hasUpdate) {
        checkBtn.textContent = `Atualização disponível!`;
        checkBtn.classList.add('bg-green-600');
        setTimeout(() => {
          checkBtn.textContent = originalText;
          checkBtn.classList.remove('bg-green-600');
          checkBtn.disabled = false;
        }, 3000);
      } else {
        checkBtn.textContent = 'Nenhuma atualização';
        setTimeout(() => {
          checkBtn.textContent = originalText;
          checkBtn.disabled = false;
        }, 2000);
      }
    } catch (error) {
      console.error('[SettingsModal] Erro ao verificar atualizações:', error);
      checkBtn.textContent = 'Erro ao verificar';
      setTimeout(() => {
        checkBtn.textContent = originalText;
        checkBtn.disabled = false;
      }, 2000);
    }
  }

  /**
   * Limpa cache de módulos
   */
  private async clearCache(): Promise<void> {
    const clearBtn = this.modal?.querySelector('#mettri-clear-cache') as HTMLButtonElement;
    if (!clearBtn) return;

    const originalText = clearBtn.textContent;
    clearBtn.disabled = true;
    clearBtn.textContent = 'Limpando...';

    try {
      await this.moduleUpdater.clearCache();
      clearBtn.textContent = 'Cache limpo!';
      setTimeout(() => {
        clearBtn.textContent = originalText;
        clearBtn.disabled = false;
      }, 2000);
    } catch (error) {
      console.error('[SettingsModal] Erro ao limpar cache:', error);
      clearBtn.textContent = 'Erro ao limpar';
      setTimeout(() => {
        clearBtn.textContent = originalText;
        clearBtn.disabled = false;
      }, 2000);
    }
  }

  /**
   * Obtém versão dos módulos atualizados
   */
  private async getUpdateVersion(): Promise<string | null> {
    try {
      const result = await chrome.storage.local.get(['moduleUpdateVersion']);
      return result.moduleUpdateVersion || null;
    } catch {
      return null;
    }
  }

  /**
   * Obtém última verificação formatada
   */
  private async getLastChecked(): Promise<string | null> {
    try {
      const result = await chrome.storage.local.get(['moduleUpdateCheckedAt']);
      if (!result.moduleUpdateCheckedAt) return null;
      
      const date = new Date(result.moduleUpdateCheckedAt);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'Agora mesmo';
      if (diffMins < 60) return `${diffMins} min atrás`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h atrás`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d atrás`;
    } catch {
      return null;
    }
  }
}
