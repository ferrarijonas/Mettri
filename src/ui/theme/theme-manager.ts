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
    themeLabels?: Partial<Record<ThemeName, string>>;
  } {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const parsed = stored ? (JSON.parse(stored) as unknown) : null;
      if (!parsed || typeof parsed !== 'object') return {};
      const obj = parsed as Record<string, unknown>;

      const allowedThemes: ThemeName[] = ['wa-web-2026', 'mettri-default', 'vscode-industrial'];
      const lastTheme = allowedThemes.includes(obj.lastTheme as ThemeName) ? (obj.lastTheme as ThemeName) : undefined;

      const labelsRaw = obj.themeLabels;
      let themeLabels: Partial<Record<ThemeName, string>> | undefined;
      if (labelsRaw && typeof labelsRaw === 'object') {
        const rec = labelsRaw as Record<string, unknown>;
        themeLabels = {};
        for (const theme of allowedThemes) {
          const value = rec[theme];
          if (typeof value === 'string') {
            themeLabels[theme] = value;
          }
        }
      }

      return { lastTheme, themeLabels };
    } catch {
      return {};
    }
  }

  /**
   * Salva preferências
   */
  private static setPreferences(preferences: {
    lastTheme?: ThemeName;
    themeLabels?: Partial<Record<ThemeName, string>>;
  }): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('[ThemeManager] Erro ao salvar preferências:', error);
    }
  }
}
