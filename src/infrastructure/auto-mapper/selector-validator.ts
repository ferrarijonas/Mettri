/**
 * Contexto para validação de seletor.
 */
export interface SelectorContext {
  selectorId: string;
  expectedCount?: number; // Número esperado de elementos (1 = único, undefined = qualquer)
  mustBeVisible?: boolean; // Se o elemento deve estar visível
}

/**
 * Resultado da validação de um seletor.
 */
export interface ValidationResult {
  isValid: boolean;
  element: HTMLElement | null;
  matchCount: number;
  isUnique: boolean;
  isVisible: boolean;
  error?: string;
}

import { MettriElementFilter } from '../mettri-element-filter';

/**
 * Validador de seletores CSS.
 * 
 * Responsabilidades:
 * - Testar se um seletor encontra o elemento correto
 * - Validar que seletor não retorna múltiplos elementos (quando não esperado)
 * - Verificar se seletor funciona em diferentes estados do DOM
 * 
 * @see project_context.md seção 3.9.1 - Auto-Mapeamento
 */
export class SelectorValidator {
  /**
   * Valida um seletor CSS.
   * 
   * @param selector Seletor CSS a validar
   * @param expectedElement Elemento esperado (para verificar se encontrou o correto)
   * @param context Contexto da validação
   * @returns Resultado da validação
   */
  async validate(
    selector: string,
    expectedElement: HTMLElement,
    context: SelectorContext
  ): Promise<ValidationResult> {
    try {
      // Rejeitar se elemento esperado for do Mettri
      if (MettriElementFilter.isMettriElement(expectedElement)) {
        return {
          isValid: false,
          element: null,
          matchCount: 0,
          isUnique: false,
          isVisible: false,
          error: 'Elemento pertence à extensão Mettri',
        };
      }
      
      // Testar seletor
      const elements = this.testSelector(selector);
      const matchCount = elements.length;

      // Verificar se encontrou o elemento esperado
      const foundExpected = elements.includes(expectedElement);

      // Verificar unicidade
      const isUnique = this.verifyUniqueness(selector, context.expectedCount);

      // Verificar visibilidade
      const isVisible = context.mustBeVisible
        ? this.verifyVisibility(expectedElement)
        : true;

      // Determinar se é válido
      const isValid = foundExpected && isUnique && isVisible;

      return {
        isValid,
        element: foundExpected ? expectedElement : elements[0] || null,
        matchCount,
        isUnique,
        isVisible,
        error: isValid ? undefined : this.getErrorMessage(foundExpected, isUnique, isVisible),
      };
    } catch (error) {
      return {
        isValid: false,
        element: null,
        matchCount: 0,
        isUnique: false,
        isVisible: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido na validação',
      };
    }
  }

  /**
   * Testa um seletor CSS no DOM.
   * 
   * @param selector Seletor CSS
   * @returns Array de elementos encontrados (filtrados para remover elementos do Mettri)
   */
  private testSelector(selector: string): HTMLElement[] {
    try {
      const elements = document.querySelectorAll(selector);
      const htmlElements = Array.from(elements).filter(
        (el): el is HTMLElement => el instanceof HTMLElement
      );
      // Filtrar elementos do Mettri
      return MettriElementFilter.filterMettriElements(htmlElements);
    } catch (error) {
      // Seletor CSS inválido
      return [];
    }
  }

  /**
   * Verifica se o seletor retorna um número único de elementos.
   * 
   * @param selector Seletor CSS
   * @param expectedCount Número esperado (1 = único, undefined = qualquer)
   * @returns true se o seletor é único conforme esperado
   */
  private verifyUniqueness(selector: string, expectedCount?: number): boolean {
    const elements = this.testSelector(selector);
    const actualCount = elements.length;

    if (expectedCount === undefined) {
      // Não há expectativa de unicidade
      return true;
    }

    return actualCount === expectedCount;
  }

  /**
   * Verifica se um elemento está visível.
   * 
   * @param element Elemento a verificar
   * @returns true se o elemento está visível
   */
  private verifyVisibility(element: HTMLElement): boolean {
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
   * Verifica a estabilidade de um seletor (se funciona em diferentes estados do DOM).
   * 
   * @param selector Seletor CSS
   * @returns Promise que resolve para true se o seletor é estável
   */
  async verifyStability(selector: string): Promise<boolean> {
    // Testar múltiplas vezes com pequenos delays para capturar mudanças dinâmicas
    const tests = 3;
    const results: boolean[] = [];

    for (let i = 0; i < tests; i++) {
      const elements = this.testSelector(selector);
      results.push(elements.length > 0);

      // Pequeno delay entre testes
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Seletor é estável se funcionou em todas as tentativas
    return results.every(r => r === true);
  }

  /**
   * Gera mensagem de erro baseada nos resultados da validação.
   * 
   * @param foundExpected Se encontrou o elemento esperado
   * @param isUnique Se o seletor é único
   * @param isVisible Se o elemento está visível
   * @returns Mensagem de erro ou undefined
   */
  private getErrorMessage(
    foundExpected: boolean,
    isUnique: boolean,
    isVisible: boolean
  ): string | undefined {
    if (!foundExpected) {
      return 'Seletor não encontrou o elemento esperado';
    }
    if (!isUnique) {
      return 'Seletor retorna múltiplos elementos quando deveria ser único';
    }
    if (!isVisible) {
      return 'Elemento não está visível';
    }
    return undefined;
  }

  /**
   * Validação rápida (sem verificar estabilidade).
   * Útil para validação inicial de candidatos.
   * 
   * @param selector Seletor CSS
   * @param expectedElement Elemento esperado
   * @returns true se o seletor encontra o elemento esperado
   */
  quickValidate(selector: string, expectedElement: HTMLElement): boolean {
    try {
      const elements = this.testSelector(selector);
      return elements.includes(expectedElement) && elements.length === 1;
    } catch {
      return false;
    }
  }

  /**
   * Validação funcional: testa se o seletor funciona em contexto real.
   * 
   * @param selector Seletor CSS
   * @param target Target esperado
   * @returns true se validação funcional passou
   */
  async validateFunctional(selector: string, target: { id: string }): Promise<boolean> {
    try {
      const elements = this.testSelector(selector);
      if (elements.length === 0) {
        return false;
      }

      // Teste básico: elemento deve estar visível
      const firstElement = elements[0];
      if (!this.verifyVisibility(firstElement)) {
        return false;
      }

      // Testes específicos por tipo de seletor
      if (target.id.includes('Button') || target.id.includes('send')) {
        // Botões devem ser clicáveis
        return firstElement.tagName === 'BUTTON' || firstElement.getAttribute('role') === 'button';
      }

      if (target.id.includes('Input') || target.id.includes('compose')) {
        // Inputs devem ser editáveis
        return (
          firstElement.tagName === 'INPUT' ||
          firstElement.tagName === 'TEXTAREA' ||
          firstElement.getAttribute('contenteditable') === 'true'
        );
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Valida seletor em contexto específico.
   * 
   * @param selector Seletor CSS
   * @param context Contexto (ex: "conversationPanel", "chatList")
   * @returns true se seletor funciona no contexto
   */
  async validateInContext(selector: string, context: string): Promise<boolean> {
    try {
      // Buscar container de contexto
      let contextElement: HTMLElement | null = null;

      if (context === 'conversationPanel') {
        contextElement = document.querySelector('[data-testid="conversation-panel-messages"]') as HTMLElement;
      } else if (context === 'chatList') {
        contextElement = document.querySelector('#pane-side') as HTMLElement;
      }

      if (!contextElement) {
        // Se contexto não encontrado, validar globalmente
        return this.testSelector(selector).length > 0;
      }

      // Validar se seletor encontra elementos dentro do contexto
      const elements = contextElement.querySelectorAll(selector);
      return elements.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Valida estabilidade do seletor em múltiplas iterações.
   * 
   * @param selector Seletor CSS
   * @param iterations Número de iterações
   * @returns true se seletor é estável
   */
  async validateStability(selector: string, iterations: number = 3): Promise<boolean> {
    const results: boolean[] = [];

    for (let i = 0; i < iterations; i++) {
      const elements = this.testSelector(selector);
      results.push(elements.length > 0);

      // Pequeno delay entre testes
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Seletor é estável se funcionou em todas as tentativas
    return results.every(r => r === true);
  }
}
