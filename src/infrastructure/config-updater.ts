import type { SelectorsConfig } from '../types';
import { SelectorsConfigSchema } from '../types/schemas';

/**
 * Interface para atualização de seletor.
 */
export interface SelectorUpdate {
  selectorId: string;
  newSelector: string;
  oldSelector: string;
  validated: boolean;
}

/**
 * Gerenciador de atualização de configuração remota.
 * 
 * Responsabilidades:
 * - Enviar novos seletores para servidor remoto
 * - Atualizar config/selectors.json local (fallback)
 * - Validar resposta do servidor
 * 
 * @see project_context.md seção 3.9.2 - Configurações Remotas (Hot-Update)
 */
export class ConfigUpdater {
  private readonly remoteUrl: string;

  constructor(remoteUrl?: string) {
    // Por padrão, usar GitHub Pages ou endpoint mock
    // Em produção, isso virá de uma variável de ambiente ou config remota
    this.remoteUrl = remoteUrl || 'https://mettri4.github.io/config/selectors.json';
  }

  /**
   * Atualiza seletores no servidor remoto.
   * 
   * @param updates Array de atualizações de seletores
   * @returns true se atualização foi bem-sucedida
   */
  async updateRemote(updates: SelectorUpdate[]): Promise<boolean> {
    if (updates.length === 0) {
      console.warn('Mettri: Nenhuma atualização para enviar');
      return false;
    }

    try {
      // Gerar próxima versão (incrementar patch)
      const currentVersion = this.getCurrentVersion();
      const nextVersion = this.incrementVersion(currentVersion);

      const payload = {
        version: nextVersion,
        updates,
        timestamp: new Date().toISOString(),
      };

      const response = await fetch(this.remoteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(
          `Mettri: Falha ao atualizar config remoto: ${response.status} ${response.statusText}`
        );
        return false;
      }

      const result = await response.json();
      if (result.success === true) {
        console.log(`Mettri: Config remoto atualizado com sucesso (versão ${nextVersion})`);
        return true;
      }

      console.error('Mettri: Resposta do servidor indicou falha:', result);
      return false;
    } catch (error) {
      console.error('Mettri: Erro ao atualizar config remoto:', error);
      // Fallback: tentar atualizar localmente
      return this.updateLocal(updates);
    }
  }

  /**
   * Busca configuração remota.
   * 
   * @returns Configuração de seletores ou null se falhar
   */
  async fetchRemote(): Promise<SelectorsConfig | null> {
    try {
      const response = await fetch(this.remoteUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(
          `Mettri: Falha ao buscar config remoto: ${response.status} ${response.statusText}`
        );
        return null;
      }

      const data = await response.json();
      const config = SelectorsConfigSchema.parse(data);
      console.log(`Mettri: Config remoto carregado (versão ${config.version})`);
      return config;
    } catch (error) {
      console.error('Mettri: Erro ao buscar config remoto:', error);
      return null;
    }
  }

  /**
   * Atualiza configuração local como fallback.
   * 
   * @param updates Array de atualizações de seletores
   * @returns true se atualização foi bem-sucedida
   */
  private async updateLocal(updates: SelectorUpdate[]): Promise<boolean> {
    // Nota: Em uma extensão Chrome, não podemos escrever diretamente em arquivos do sistema.
    // Esta função serve como placeholder para uma implementação futura que use chrome.storage
    // ou IndexedDB para cache local.
    console.warn('Mettri: Atualização remota falhou, salvando localmente (cache)');
    
    // Por enquanto, apenas logar as atualizações
    // Em produção, isso seria salvo em chrome.storage.local ou IndexedDB
    try {
      await chrome.storage.local.set({
        selectorUpdates: updates,
        lastUpdate: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.error('Mettri: Erro ao salvar atualizações localmente:', error);
      return false;
    }
  }

  /**
   * Obtém a versão atual da configuração.
   * 
   * @returns Versão atual (ex: "2026.01.11")
   */
  private getCurrentVersion(): string {
    // Por enquanto, retornar versão hardcoded
    // Em produção, isso viria do SelectorManager ou config atual
    return '2026.01.11';
  }

  /**
   * Incrementa a versão (patch version).
   * 
   * @param version Versão atual (ex: "2026.01.11")
   * @returns Nova versão (ex: "2026.01.12")
   */
  private incrementVersion(version: string): string {
    // Formato esperado: YYYY.MM.DD ou YYYY.MM.DD.PATCH
    const parts = version.split('.');
    if (parts.length >= 3) {
      const day = parseInt(parts[2], 10);
      if (!isNaN(day)) {
        parts[2] = (day + 1).toString();
        return parts.join('.');
      }
    }
    // Fallback: adicionar timestamp
    return `${version}.${Date.now()}`;
  }
}
