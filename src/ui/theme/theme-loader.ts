/**
 * ThemeLoader - Carregador de temas do Mettri
 * 
 * Permite trocar temas dinamicamente sem quebrar código interno.
 * 
 * Uso:
 *   import { ThemeLoader } from './theme';
 *   ThemeLoader.load('wa-web-2026');
 */

export type ThemeName = 'wa-web-2026' | 'mettri-default' | 'vscode-industrial';

export class ThemeLoader {
  private static readonly THEME_ID = 'mettri-theme';
  private static currentTheme: ThemeName | null = null;

  /**
   * Carrega um tema específico
   * 
   * @param themeName - Nome do tema ('wa-web-2026' ou 'mettri-default')
   * @returns Promise que resolve quando o tema for carregado
   * 
   * @example
   * await ThemeLoader.load('wa-web-2026');
   */
  static async load(themeName: ThemeName): Promise<void> {
    console.log(`[ThemeLoader] 🎨 Iniciando carregamento do tema: ${themeName}`);
    
    // Remove tema anterior se existir
    const removed = this.remove();
    if (removed) {
      console.log(`[ThemeLoader] ✅ Tema anterior removido`);
    }

    // Cria elemento <link> para o novo tema
    const link = document.createElement('link');
    link.id = this.THEME_ID;
    link.rel = 'stylesheet';
    link.type = 'text/css';

    // No ambiente de extensão, os temas estão em dist/themes/
    // No build, esbuild copia os temas para dist/themes/
    const themeUrl = chrome.runtime.getURL(`themes/${themeName}.css`);
    link.href = themeUrl;
    
    console.log(`[ThemeLoader] 📂 URL do tema: ${themeUrl}`);
    console.log(`[ThemeLoader] 🔗 Link element criado:`, link);

    // Adiciona ao <head>
    document.head.appendChild(link);
    console.log(`[ThemeLoader] ✅ Link adicionado ao <head>`);
    
    // Verificar se link foi realmente adicionado
    const linkInDOM = document.getElementById(this.THEME_ID);
    if (linkInDOM) {
      console.log(`[ThemeLoader] ✅ Link confirmado no DOM:`, linkInDOM);
      console.log(`[ThemeLoader] 🔗 href do link no DOM:`, (linkInDOM as HTMLLinkElement).href);
    } else {
      console.error(`[ThemeLoader] ❌ Link NÃO encontrado no DOM após appendChild!`);
    }

    // Aguarda CSS carregar
    return new Promise((resolve, reject) => {
      link.onload = () => {
        this.currentTheme = themeName;
        
        // Adicionar atributo no painel para controle de ícones/estilos específicos
        const panel = document.getElementById('mettri-panel');
        if (panel) {
          panel.setAttribute('data-theme', themeName);
        }
        
        resolve();
      };

      link.onerror = (error) => {
        console.error(`[ThemeLoader] ❌ ERRO ao carregar tema: ${themeName}`, error);
        console.error(`[ThemeLoader] ❌ URL que falhou: ${themeUrl}`);
        console.error(`[ThemeLoader] ❌ Link element:`, link);
        reject(new Error(`Failed to load theme: ${themeName}`));
      };

      // Timeout de segurança
      setTimeout(() => {
        if (!this.currentTheme) {
          console.error(`[ThemeLoader] ⏱️ TIMEOUT: Tema não carregou em 5 segundos: ${themeName}`);
          reject(new Error(`Theme load timeout: ${themeName}`));
        }
      }, 5000);
    });
  }

  /**
   * Remove o tema atual
   */
  static remove(): boolean {
    const existing = document.getElementById(this.THEME_ID);
    if (existing) {
      existing.remove();
      this.currentTheme = null;
      
      // Remover atributo do painel
      const panel = document.getElementById('mettri-panel');
      if (panel) {
        panel.removeAttribute('data-theme');
      }
      
      return true;
    }
    return false;
  }

  /**
   * Retorna o tema atual
   */
  static getCurrentTheme(): ThemeName | null {
    return this.currentTheme;
  }

  /**
   * Carrega o tema padrão (wa-web-2026)
   */
  static async loadDefault(): Promise<void> {
    return this.load('wa-web-2026');
  }
}
