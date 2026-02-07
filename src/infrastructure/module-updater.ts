/**
 * Sistema de atualização automática de módulos remotos
 * 
 * Permite que módulos sejam atualizados sem reinstalar a extensão.
 * Usa GitHub Pages como servidor de distribuição.
 * 
 * Funcionalidades:
 * - Verifica atualizações ao iniciar e 1x por dia
 * - Baixa módulos atualizados automaticamente
 * - Valida integridade com hash SHA-256
 * - Cacheia módulos em chrome.storage.local
 * - Respeita toggle ON/OFF de atualizações
 */

interface ModuleManifest {
  version: string;
  updatedAt: string;
  modules: {
    id: string;
    version: string;
    url: string;
    hash: string;
  }[];
}

interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  remoteVersion: string | null;
  modulesToUpdate: string[];
}

interface CachedModule {
  id: string;
  version: string;
  code: string;
  hash: string;
  cachedAt: string;
}

export class ModuleUpdater {
  private readonly baseUrl: string;
  private readonly checkInterval: number; // ms
  private checkTimer: number | null = null;
  private currentVersion: string;
  private isChecking = false;
  private isUpdating = false;

  constructor(baseUrl?: string, checkIntervalMinutes: number = 1440) {
    // Por padrão: GitHub Pages do mesmo repo (branch gh-pages, deploy deste workflow)
    this.baseUrl = baseUrl || 'https://ferrarijonas.github.io/Mettri';
    this.checkInterval = checkIntervalMinutes * 60 * 1000;
    try {
      this.currentVersion = (typeof chrome !== 'undefined' && chrome?.runtime?.getManifest?.())?.version ?? '0.0.0';
    } catch {
      this.currentVersion = '0.0.0';
    }
  }

  /**
   * Verifica se atualizações automáticas estão habilitadas
   */
  private async isAutoUpdateEnabled(): Promise<boolean> {
    try {
      const result = await chrome.storage.local.get(['autoUpdateEnabled']);
      // Por padrão, habilitado
      return result.autoUpdateEnabled !== false;
    } catch {
      return true;
    }
  }

  /**
   * Inicia verificação periódica de atualizações
   */
  async startAutoCheck(): Promise<void> {
    if (this.checkTimer !== null) {
      console.warn('[ModuleUpdater] Auto-check já está ativo');
      return;
    }

    const enabled = await this.isAutoUpdateEnabled();
    if (!enabled) {
      console.log('[ModuleUpdater] Atualizações automáticas desabilitadas');
      return;
    }

    console.log(`[ModuleUpdater] Iniciando verificação automática (a cada ${this.checkInterval / 60000} minutos)`);
    
    // Verificar imediatamente
    this.checkForUpdates();

    // Depois verificar periodicamente
    // Usar setInterval se disponível (content script) ou alarm (service worker)
    if (typeof window !== 'undefined' && window.setInterval) {
      this.checkTimer = window.setInterval(() => {
        this.checkForUpdates();
      }, this.checkInterval);
    } else {
      // Service worker: usar alarm em vez de setInterval
      chrome.alarms.create('module-updater-check', { periodInMinutes: this.checkInterval / 60000 });
    }
  }

  /**
   * Para verificação automática
   */
  stopAutoCheck(): void {
    if (this.checkTimer !== null && typeof window !== 'undefined' && typeof clearInterval !== 'undefined') {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
      console.log('[ModuleUpdater] Verificação automática parada');
    }
    // Limpar alarm se estiver em service worker
    chrome.alarms.clear('module-updater-check').catch(() => {
      // Ignorar se alarm não existir
    });
  }

  /**
   * Verifica se há atualizações disponíveis
   */
  async checkForUpdates(): Promise<UpdateCheckResult> {
    if (this.isChecking) {
      console.log('[ModuleUpdater] Verificação já em andamento');
      return {
        hasUpdate: false,
        currentVersion: this.currentVersion,
        remoteVersion: null,
        modulesToUpdate: [],
      };
    }

    const enabled = await this.isAutoUpdateEnabled();
    if (!enabled) {
      return {
        hasUpdate: false,
        currentVersion: this.currentVersion,
        remoteVersion: null,
        modulesToUpdate: [],
      };
    }

    this.isChecking = true;

    try {
      const manifestUrl = `${this.baseUrl}/manifest.json`;
      const response = await fetch(manifestUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        console.warn(`[ModuleUpdater] Falha ao buscar manifest: ${response.status}`);
        return {
          hasUpdate: false,
          currentVersion: this.currentVersion,
          remoteVersion: null,
          modulesToUpdate: [],
        };
      }

      const manifest: ModuleManifest = await response.json();
      const hasUpdate = this.compareVersions(manifest.version, this.currentVersion) > 0;

      // Verificar quais módulos precisam atualização
      const modulesToUpdate: string[] = [];
      if (hasUpdate && manifest.modules) {
        for (const module of manifest.modules) {
          const cached = await this.getCachedModule(module.id);
          if (!cached || cached.version !== module.version) {
            modulesToUpdate.push(module.id);
          }
        }
      }

      console.log(
        `[ModuleUpdater] Versão local: ${this.currentVersion}, Remota: ${manifest.version}, ` +
        `Atualização disponível: ${hasUpdate}, Módulos: ${modulesToUpdate.length}`
      );

      // Se há atualizações, baixar automaticamente
      if (hasUpdate && modulesToUpdate.length > 0) {
        this.applyUpdates(manifest, modulesToUpdate).catch(error => {
          console.error('[ModuleUpdater] Erro ao aplicar atualizações:', error);
        });
      }

      return {
        hasUpdate,
        currentVersion: this.currentVersion,
        remoteVersion: manifest.version,
        modulesToUpdate,
      };
    } catch (error) {
      console.error('[ModuleUpdater] Erro ao verificar atualizações:', error);
      return {
        hasUpdate: false,
        currentVersion: this.currentVersion,
        remoteVersion: null,
        modulesToUpdate: [],
      };
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Baixa e aplica atualizações de módulos
   */
  private async applyUpdates(manifest: ModuleManifest, moduleIds: string[]): Promise<void> {
    if (this.isUpdating) {
      console.warn('[ModuleUpdater] Atualização já em andamento');
      return;
    }

    this.isUpdating = true;

    try {
      console.log(`[ModuleUpdater] Aplicando atualizações para ${moduleIds.length} módulos...`);

      for (const moduleId of moduleIds) {
        const moduleInfo = manifest.modules.find(m => m.id === moduleId);
        if (!moduleInfo) {
          console.warn(`[ModuleUpdater] Módulo ${moduleId} não encontrado no manifest`);
          continue;
        }

        try {
          await this.downloadAndCacheModule(moduleInfo);
          console.log(`[ModuleUpdater] ✅ Módulo ${moduleId} atualizado`);
        } catch (error) {
          console.error(`[ModuleUpdater] Erro ao atualizar módulo ${moduleId}:`, error);
          // Continuar com outros módulos mesmo se um falhar
        }
      }

      // Atualizar versão local
      this.currentVersion = manifest.version;
      await chrome.storage.local.set({
        moduleUpdateVersion: manifest.version,
        moduleUpdateCheckedAt: new Date().toISOString(),
      });

      console.log(`[ModuleUpdater] ✅ Atualizações aplicadas com sucesso! Versão ${manifest.version}`);
      
      // Notificar que atualização foi aplicada
      this.notifyUpdateApplied(manifest.version);
    } catch (error) {
      console.error('[ModuleUpdater] Erro ao aplicar atualizações:', error);
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Baixa e cacheia um módulo
   */
  private async downloadAndCacheModule(moduleInfo: { id: string; url: string; hash: string; version: string }): Promise<void> {
    console.log(`[ModuleUpdater] Baixando módulo ${moduleInfo.id} de ${moduleInfo.url}...`);

    const response = await fetch(moduleInfo.url, {
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`Falha ao baixar ${moduleInfo.id}: ${response.status}`);
    }

    const code = await response.text();

    // Verificar hash
    if (moduleInfo.hash) {
      const actualHash = await this.sha256(code);
      if (actualHash !== moduleInfo.hash) {
        throw new Error(`Hash inválido para ${moduleInfo.id}. Esperado: ${moduleInfo.hash}, Obtido: ${actualHash}`);
      }
    }

    // Salvar em cache
    const cached: CachedModule = {
      id: moduleInfo.id,
      version: moduleInfo.version,
      code,
      hash: moduleInfo.hash,
      cachedAt: new Date().toISOString(),
    };

    await chrome.storage.local.set({
      [`module_cache_${moduleInfo.id}`]: cached,
    });

    console.log(`[ModuleUpdater] ✅ Módulo ${moduleInfo.id} cacheado`);
  }

  /**
   * Obtém módulo do cache
   */
  async getCachedModule(moduleId: string): Promise<CachedModule | null> {
    try {
      const result = await chrome.storage.local.get([`module_cache_${moduleId}`]);
      const cached = result[`module_cache_${moduleId}`] as CachedModule | undefined;
      return cached || null;
    } catch {
      return null;
    }
  }

  /**
   * Obtém código de um módulo (cache remoto ou null)
   */
  async getModuleCode(moduleId: string): Promise<string | null> {
    const cached = await this.getCachedModule(moduleId);
    return cached?.code || null;
  }

  /**
   * Calcula SHA-256 de uma string
   */
  private async sha256(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Compara duas versões (semver)
   * Retorna: positivo se v1 > v2, negativo se v1 < v2, zero se iguais
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }
    
    return 0;
  }

  /**
   * Notifica que atualização foi aplicada
   */
  private notifyUpdateApplied(version: string): void {
    // Enviar mensagem para content script se necessário
    chrome.runtime.sendMessage({
      type: 'MODULE_UPDATE_APPLIED',
      version,
    }).catch(() => {
      // Ignorar erro se não houver listeners (normal em service worker)
    });

    // Disparar evento customizado (apenas se window disponível)
    try {
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('mettri:module-updated', {
          detail: { version },
        }));
      }
    } catch {
      // Ignorar se window não disponível (service worker)
    }
  }

  /**
   * Obtém versão atual
   */
  getCurrentVersion(): string {
    return this.currentVersion;
  }

  /**
   * Limpa cache de módulos
   */
  async clearCache(): Promise<void> {
    try {
      const keys = await chrome.storage.local.get(null);
      const moduleKeys = Object.keys(keys).filter(key => key.startsWith('module_cache_'));
      
      await chrome.storage.local.remove(moduleKeys);
      console.log(`[ModuleUpdater] Cache limpo (${moduleKeys.length} módulos)`);
    } catch (error) {
      console.error('[ModuleUpdater] Erro ao limpar cache:', error);
    }
  }
}
