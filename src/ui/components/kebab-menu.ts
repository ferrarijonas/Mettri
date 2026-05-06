/**
 * KebabMenu - Menu dropdown estilo v0
 * 
 * Componente de menu dropdown com glassmorphism, baseado no design v0.
 */

import type { LucideIcons } from '../icons/lucide-icons';
import { getIcon } from '../icons/lucide-icons';

export interface KebabMenuOption {
  label: string;
  icon?: keyof typeof LucideIcons;
  onClick: () => void;
  destructive?: boolean;
}

export class KebabMenu {
  private button: HTMLElement | null = null;
  private dropdown: HTMLElement | null = null;
  private isOpen = false;
  private closeHandler: ((e: MouseEvent) => void) | null = null;
  private buttonClickHandler: ((e: MouseEvent) => void) | null = null;
  private readonly buttonSelector: string;

  constructor(
    private container: HTMLElement,
    private options: KebabMenuOption[],
    config?: { buttonSelector?: string }
  ) {
    this.buttonSelector = config?.buttonSelector ?? '#mettri-kebab-menu';

    // Container deve conter o botão alvo
    if (!container.querySelector(this.buttonSelector)) {
      console.warn(`[KebabMenu] Container não contém "${this.buttonSelector}"`);
      return;
    }
    this.render();
  }

  private render(): void {
    // Garantir posicionamento para o dropdown ancorar no container
    try {
      const style = getComputedStyle(this.container);
      if (style.position === 'static') {
        this.container.style.position = 'relative';
      }
    } catch {
      // ignore
    }

    // Botão kebab (já existe no HTML, apenas encontrar)
    const btn = this.container.querySelector(this.buttonSelector) as HTMLButtonElement;
    if (!btn) {
      console.warn(`[KebabMenu] Botão "${this.buttonSelector}" não encontrado`);
      return;
    }

    // Dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'w-44 glass rounded-xl border-border/50 p-1 absolute z-50 mt-1 hidden';
    dropdown.style.position = 'absolute';
    dropdown.style.top = '100%';
    dropdown.style.right = '0';
    dropdown.style.marginTop = '8px';

    // Opções do menu
    this.options.forEach((option, index) => {
      if (index > 0 && option.destructive && !this.options[index - 1].destructive) {
        // Adicionar divisor antes de item destructive
        const divider = document.createElement('div');
        divider.className = 'bg-border/30 my-1 h-px';
        dropdown.appendChild(divider);
      }

      const item = document.createElement('button');
      item.className = `w-full rounded-lg cursor-pointer gap-2.5 text-xs flex items-center px-2 py-1.5 focus:bg-accent transition-colors ${
        option.destructive ? 'text-destructive focus:text-destructive focus:bg-destructive/10' : ''
      }`;
      
      if (option.icon) {
        const iconSize = option.destructive ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5 text-muted-foreground';
        item.innerHTML = `
          ${getIcon(option.icon).replace('width="14" height="14"', `width="14" height="14" class="${iconSize}"`)}
          <span>${this.escapeHtml(option.label)}</span>
        `;
      } else {
        item.textContent = option.label;
      }

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        option.onClick();
        this.close();
      });

      dropdown.appendChild(item);
    });

    // Toggle dropdown
    this.buttonClickHandler = (e: MouseEvent) => {
      e.stopPropagation();
      this.toggle();
    };
    btn.addEventListener('click', this.buttonClickHandler);

    // Inserir dropdown no container
    this.container.appendChild(dropdown);

    this.button = btn;
    this.dropdown = dropdown;
  }

  private toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  private open(): void {
    if (!this.dropdown || !this.button) return;

    this.dropdown.classList.remove('hidden');
    this.dropdown.style.display = 'block';
    this.isOpen = true;

    // Fechar ao clicar fora
    this.closeHandler = (e: MouseEvent) => {
      if (this.dropdown && this.button && 
          !this.dropdown.contains(e.target as Node) && 
          !this.button.contains(e.target as Node)) {
        this.close();
      }
    };

    // Usar setTimeout para não fechar imediatamente
    setTimeout(() => {
      document.addEventListener('click', this.closeHandler!);
    }, 0);
  }

  private close(): void {
    if (!this.dropdown) return;

    this.dropdown.style.display = 'none';
    this.dropdown.classList.remove('show');
    this.isOpen = false;

    if (this.closeHandler) {
      document.removeEventListener('click', this.closeHandler);
      this.closeHandler = null;
    }
  }

  public destroy(): void {
    if (this.closeHandler) {
      document.removeEventListener('click', this.closeHandler);
    }
    if (this.button && this.buttonClickHandler) {
      this.button.removeEventListener('click', this.buttonClickHandler);
    }
    this.dropdown?.remove();
    this.button = null;
    this.dropdown = null;
    this.closeHandler = null;
    this.buttonClickHandler = null;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
