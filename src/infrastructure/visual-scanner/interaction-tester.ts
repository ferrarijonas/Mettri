import type { InteractionType } from '../../types/visual-scanner';
import type { SelectorTarget } from '../../types/selector-scanner';

/**
 * Testador de interações para validar elementos encontrados visualmente.
 * 
 * Responsabilidades:
 * - Testar cliques, hovers, focus em elementos
 * - Detectar mudanças de estado após interação
 * - Validar que elemento é o correto baseado na resposta à interação
 */
export class InteractionTester {
  /**
   * Testa um clique em um elemento e verifica resultado.
   * 
   * @param element Elemento a clicar
   * @param target Target do seletor (para contexto)
   * @returns true se clique teve efeito esperado
   */
  async testClick(element: HTMLElement, target: SelectorTarget): Promise<boolean> {
    try {
      // Salvar estado antes
      const beforeState = this.captureState(element);

      // Verificar se elemento é clicável
      if (!this.isClickable(element)) {
        return false;
      }

      // Simular clique
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      });

      element.dispatchEvent(clickEvent);
      element.click();

      // Aguardar mudança
      await this.waitForChange(500);

      // Verificar mudança de estado
      const afterState = this.captureState(element);
      return this.detectExpectedChange(beforeState, afterState, target);
    } catch (error) {
      console.warn(`Mettri: Erro ao testar clique em ${target.id}:`, error);
      return false;
    }
  }

  /**
   * Testa hover em um elemento.
   * 
   * @param element Elemento a fazer hover
   * @param target Target do seletor
   * @returns true se hover teve efeito esperado
   */
  async testHover(element: HTMLElement, target: SelectorTarget): Promise<boolean> {
    try {
      const beforeState = this.captureState(element);

      // Simular hover
      const mouseEnter = new MouseEvent('mouseenter', {
        bubbles: true,
        cancelable: true,
        view: window,
      });
      const mouseOver = new MouseEvent('mouseover', {
        bubbles: true,
        cancelable: true,
        view: window,
      });

      element.dispatchEvent(mouseEnter);
      element.dispatchEvent(mouseOver);

      await this.waitForChange(300);

      const afterState = this.captureState(element);
      return this.detectExpectedChange(beforeState, afterState, target);
    } catch (error) {
      console.warn(`Mettri: Erro ao testar hover em ${target.id}:`, error);
      return false;
    }
  }

  /**
   * Testa foco em um elemento.
   * 
   * @param element Elemento a focar
   * @param target Target do seletor
   * @returns true se foco teve efeito esperado
   */
  async testFocus(element: HTMLElement, target: SelectorTarget): Promise<boolean> {
    try {
      if (!this.isFocusable(element)) {
        return false;
      }

      const beforeState = this.captureState(element);

      element.focus();

      await this.waitForChange(200);

      const afterState = this.captureState(element);
      const hasFocus = document.activeElement === element;

      return hasFocus || this.detectExpectedChange(beforeState, afterState, target);
    } catch (error) {
      console.warn(`Mettri: Erro ao testar foco em ${target.id}:`, error);
      return false;
    }
  }

  /**
   * Detecta resultado de uma interação.
   * 
   * @param element Elemento interagido
   * @param interactionType Tipo de interação
   * @returns true se interação teve resultado positivo
   */
  async detectInteractionResult(
    element: HTMLElement,
    interactionType: InteractionType
  ): Promise<boolean> {
    switch (interactionType) {
      case 'click':
        return await this.detectClickResult(element);
      case 'hover':
        return this.detectHoverResult(element);
      case 'focus':
        return document.activeElement === element;
      case 'scroll':
        return await this.detectScrollResult(element);
      default:
        return false;
    }
  }

  /**
   * Verifica se elemento é clicável.
   */
  private isClickable(element: HTMLElement): boolean {
    // Verificar tag
    if (['BUTTON', 'A', 'INPUT'].includes(element.tagName)) {
      return true;
    }

    // Verificar role
    const role = element.getAttribute('role');
    if (role === 'button' || role === 'link') {
      return true;
    }

    // Verificar se tem event listener de click
    const hasOnClick = element.onclick !== null;
    if (hasOnClick) {
      return true;
    }

    // Verificar cursor
    const style = window.getComputedStyle(element);
    if (style.cursor === 'pointer') {
      return true;
    }

    return false;
  }

  /**
   * Verifica se elemento é focável.
   */
  private isFocusable(element: HTMLElement): boolean {
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(element.tagName)) {
      return true;
    }

    const tabIndex = element.getAttribute('tabindex');
    if (tabIndex !== null && tabIndex !== '-1') {
      return true;
    }

    if (element.getAttribute('contenteditable') === 'true') {
      return true;
    }

    return false;
  }

  /**
   * Captura estado atual de um elemento.
   */
  private captureState(element: HTMLElement): unknown {
    return {
      visible: this.isVisible(element),
      classes: Array.from(element.classList),
      attributes: this.getRelevantAttributes(element),
      text: element.textContent?.trim().substring(0, 50),
      rect: element.getBoundingClientRect(),
    };
  }

  /**
   * Verifica se elemento está visível.
   */
  private isVisible(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      element.offsetWidth > 0 &&
      element.offsetHeight > 0
    );
  }

  /**
   * Obtém atributos relevantes de um elemento.
   */
  private getRelevantAttributes(element: HTMLElement): Record<string, string> {
    const attrs: Record<string, string> = {};

    const relevantAttrs = ['data-testid', 'aria-label', 'role', 'id', 'class'];
    for (const attr of relevantAttrs) {
      const value = element.getAttribute(attr);
      if (value) {
        attrs[attr] = value;
      }
    }

    return attrs;
  }

  /**
   * Aguarda mudança no DOM ou estado.
   */
  private waitForChange(timeout: number): Promise<void> {
    return new Promise(resolve => {
      const observer = new MutationObserver(() => {
        observer.disconnect();
        resolve();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeOldValue: true,
      });

      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, timeout);
    });
  }

  /**
   * Detecta mudança esperada baseada no target.
   */
  private detectExpectedChange(
    beforeState: unknown,
    afterState: unknown,
    target: SelectorTarget
  ): boolean {
    // Para a maioria dos casos, qualquer mudança é positiva
    // (indica que elemento é interativo)
    const before = beforeState as { classes: string[]; text?: string };
    const after = afterState as { classes: string[]; text?: string };

    // Verificar mudança de classes (comum em botões)
    const classesChanged = JSON.stringify(before.classes) !== JSON.stringify(after.classes);

    // Verificar mudança de texto
    const textChanged = before.text !== after.text;

    // Para elementos específicos, verificar mudanças esperadas
    if (target.id.includes('Button') || target.id.includes('send')) {
      return classesChanged || textChanged;
    }

    if (target.id.includes('Badge') || target.id.includes('Status')) {
      // Badges e status geralmente não mudam com clique, mas podem ter hover
      return true; // Qualquer interação válida é suficiente
    }

    return classesChanged || textChanged;
  }

  /**
   * Detecta resultado de clique.
   */
  private async detectClickResult(element: HTMLElement): Promise<boolean> {
    // Verificar se elemento ainda está visível e acessível
    const isStillVisible = this.isVisible(element);
    
    // Verificar se houve mudança no DOM próximo
    await this.waitForChange(300);
    
    return isStillVisible;
  }

  /**
   * Detecta resultado de hover.
   */
  private detectHoverResult(element: HTMLElement): boolean {
    // Verificar se elemento tem estado de hover (tooltip, etc)
    const style = window.getComputedStyle(element);
    const hasHoverState = style.cursor === 'pointer' || element.getAttribute('aria-label') !== null;

    // Verificar se há tooltip ou elemento relacionado
    const tooltip = element.querySelector('[role="tooltip"]') || 
                    document.querySelector('[role="tooltip"]');
    
    return hasHoverState || tooltip !== null;
  }

  /**
   * Detecta resultado de scroll.
   */
  private async detectScrollResult(element: HTMLElement): Promise<boolean> {
    const beforeScroll = element.scrollTop;
    element.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Aguardar scroll
    return new Promise<boolean>(resolve => {
      setTimeout(() => {
        const afterScroll = element.scrollTop;
        resolve(beforeScroll !== afterScroll);
      }, 500);
    });
  }
}
