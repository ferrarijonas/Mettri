/**
 * ThemeManager - Gerenciador de temas com persistência
 * 
 * Permite salvar e restaurar temas facilmente.
 * 
 * Uso:
 *   import { ThemeManager } from './theme-manager';
 *   await ThemeManager.saveCurrent('wa-web-2026'); // Salva tema atual
 *   await ThemeManager.restore('wa-web-2026');     // Restaura tema salvo
 */

import { ThemeLoader, ThemeName } from './theme-loader';

export class ThemeManager {
  private static readonly STORAGE_KEY = 'mettri-theme-preferences';

  /**
   * Salva o tema atual nas preferências
   * 
   * @param themeName - Nome do tema a salvar
   * @param label - Label opcional para identificação (ex: "WhatsApp Web 2026")
   */
  static async saveCurrent(themeName: ThemeName, label?: string): Promise<void> {
    const preferences = this.getPreferences();
    preferences.lastTheme = themeName;
    if (label) {
      preferences.themeLabels = preferences.themeLabels || {};
      preferences.themeLabels[themeName] = label;
    }
    this.setPreferences(preferences);
  }

  /**
   * Restaura um tema salvo
   * 
   * @param themeName - Nome do tema a restaurar
   */
  static async restore(themeName: ThemeName): Promise<void> {
    await ThemeLoader.load(themeName);
    await this.saveCurrent(themeName); // Atualiza último tema usado
  }

  /**
   * Restaura o último tema usado
   */
  static async restoreLast(): Promise<void> {
    const preferences = this.getPreferences();
    if (preferences.lastTheme) {
      await this.restore(preferences.lastTheme);
    } else {
      // Se não há tema salvo, usa o padrão
      await ThemeLoader.loadDefault();
    }
  }

  /**
   * Lista todos os temas disponíveis
   */
  static getAvailableThemes(): ThemeName[] {
    return ['wa-web-2026', 'mettri-default', 'vscode-industrial'];
  }

  /**
   * Obtém o label de um tema (se foi salvo)
   */
  static getThemeLabel(themeName: ThemeName): string {
    const preferences = this.getPreferences();
    return preferences.themeLabels?.[themeName] || themeName;
  }

  /**
   * Obtém preferências salvas
   */
  private static getPreferences(): {
    lastTheme?: ThemeName;
    themeLabels?: Record<ThemeName, string>;
  } {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  /**
   * Salva preferências
   */
  private static setPreferences(preferences: {
    lastTheme?: ThemeName;
    themeLabels?: Record<ThemeName, string>;
  }): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('[ThemeManager] Erro ao salvar preferências:', error);
    }
  }
}
