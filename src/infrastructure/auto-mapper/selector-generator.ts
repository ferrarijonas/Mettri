import { MettriElementFilter } from '../mettri-element-filter';

/**
 * Gerador de seletores CSS candidatos a partir de um elemento DOM.
 * 
 * Responsabilidades:
 * - Gerar múltiplos seletores CSS candidatos a partir de um elemento
 * - Priorizar seletores mais específicos e estáveis
 * 
 * Estratégias de geração (em ordem de prioridade):
 * 1. data-testid (mais estável)
 * 2. id (se único)
 * 3. class (combinando classes)
 * 4. aria-label (acessibilidade)
 * 5. Caminho hierárquico (ex: #app > div > div[role="region"])
 * 
 * @see tech_stack.md seção 2.1 - document.elementFromPoint()
 */
export class SelectorGenerator {
  private readonly maxCandidates = 15; // Limite de candidatos gerados

  /**
   * Gera múltiplos seletores CSS candidatos a partir de um elemento.
   * 
   * @param element Elemento DOM para gerar seletores
   * @returns Array de seletores CSS candidatos (ordenados por prioridade)
   */
  generateCandidates(element: HTMLElement): string[] {
    // Rejeitar elementos do Mettri
    if (MettriElementFilter.isMettriElement(element)) {
      return [];
    }
    
    const candidates: string[] = [];

    // 1. data-testid (mais estável)
    const testIdSelector = this.generateByTestId(element);
    if (testIdSelector) {
      candidates.push(testIdSelector);
    }

    // 2. id (se único)
    const idSelector = this.generateById(element);
    if (idSelector) {
      candidates.push(idSelector);
    }

    // 3. class (combinando classes)
    const classSelectors = this.generateByClass(element);
    candidates.push(...classSelectors);

    // 4. aria-label (acessibilidade)
    const ariaSelector = this.generateByAria(element);
    if (ariaSelector) {
      candidates.push(ariaSelector);
    }

    // 5. Caminho hierárquico
    const pathSelector = this.generateByPath(element);
    if (pathSelector) {
      candidates.push(pathSelector);
    }

    // Remover duplicatas e limitar quantidade
    const unique = Array.from(new Set(candidates));
    return unique.slice(0, this.maxCandidates);
  }

  /**
   * Gera seletor baseado em data-testid.
   * 
   * @param element Elemento DOM
   * @returns Seletor CSS ou null se não houver data-testid
   */
  private generateByTestId(element: HTMLElement): string | null {
    const testId = element.getAttribute('data-testid');
    if (testId) {
      return `[data-testid="${testId}"]`;
    }
    return null;
  }

  /**
   * Gera seletor baseado em id (apenas se único no documento).
   * 
   * @param element Elemento DOM
   * @returns Seletor CSS ou null se id não for único
   */
  private generateById(element: HTMLElement): string | null {
    const id = element.id;
    if (id) {
      // Verificar se id é único
      const elementsWithId = document.querySelectorAll(`#${id}`);
      if (elementsWithId.length === 1) {
        return `#${id}`;
      }
    }
    return null;
  }

  /**
   * Gera seletores baseados em classes.
   * 
   * @param element Elemento DOM
   * @returns Array de seletores CSS baseados em classes
   */
  private generateByClass(element: HTMLElement): string[] {
    const selectors: string[] = [];
    const classList = Array.from(element.classList);

    if (classList.length === 0) {
      return selectors;
    }

    // Seletor com todas as classes (mais específico)
    if (classList.length > 0) {
      const allClasses = classList.map(cls => `.${cls}`).join('');
      selectors.push(allClasses);
    }

    // Seletores com classes individuais (menos específicos, mas mais flexíveis)
    for (const cls of classList.slice(0, 3)) {
      // Apenas as primeiras 3 classes para evitar muitos candidatos
      selectors.push(`.${cls}`);
    }

    // Seletor com atributo class contendo substring (fallback genérico)
    if (classList.length > 0) {
      const firstClass = classList[0];
      selectors.push(`[class*="${firstClass}"]`);
    }

    return selectors;
  }

  /**
   * Gera seletor baseado em aria-label.
   * 
   * @param element Elemento DOM
   * @returns Seletor CSS ou null se não houver aria-label
   */
  private generateByAria(element: HTMLElement): string | null {
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      return `[aria-label="${ariaLabel}"]`;
    }

    const role = element.getAttribute('role');
    if (role) {
      return `[role="${role}"]`;
    }

    return null;
  }

  /**
   * Gera seletor baseado em caminho hierárquico no DOM.
   * 
   * @param element Elemento DOM
   * @returns Seletor CSS baseado no caminho
   */
  private generateByPath(element: HTMLElement): string {
    const path: string[] = [];
    let current: HTMLElement | null = element;

    // Navegar para cima na árvore DOM
    while (current && path.length < 5) {
      // Limitar profundidade para evitar seletores muito longos
      let selector = current.tagName.toLowerCase();

      // Adicionar id se disponível
      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break; // Id único, parar aqui
      }

      // Adicionar classes se disponíveis
      const classes = Array.from(current.classList).slice(0, 2); // Máximo 2 classes
      if (classes.length > 0) {
        selector += `.${classes.join('.')}`;
      }

      // Adicionar atributos relevantes
      const testId = current.getAttribute('data-testid');
      if (testId) {
        selector += `[data-testid="${testId}"]`;
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }

  /**
   * Gera seletor combinando múltiplas estratégias para maior robustez.
   * 
   * @param element Elemento DOM
   * @returns Seletor CSS combinado
   */
  generateCombinedSelector(element: HTMLElement): string | null {
    const parts: string[] = [];

    // Prioridade: data-testid > id > class + role
    const testId = element.getAttribute('data-testid');
    if (testId) {
      return `[data-testid="${testId}"]`;
    }

    const id = element.id;
    if (id) {
      const elementsWithId = document.querySelectorAll(`#${id}`);
      if (elementsWithId.length === 1) {
        return `#${id}`;
      }
    }

    // Combinar classe com role
    const classes = Array.from(element.classList).slice(0, 2);
    const role = element.getAttribute('role');

    if (classes.length > 0) {
      parts.push(`.${classes.join('.')}`);
    }
    if (role) {
      parts.push(`[role="${role}"]`);
    }

    if (parts.length > 0) {
      return parts.join('');
    }

    return null;
  }
}
