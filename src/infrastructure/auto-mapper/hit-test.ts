/**
 * Utilitário para hit test usando document.elementFromPoint().
 * 
 * Responsabilidades:
 * - Encontrar elemento DOM em coordenadas específicas
 * - Navegar na árvore DOM para encontrar containers apropriados
 * 
 * @see tech_stack.md seção 2.1 - document.elementFromPoint()
 * @see project_context.md seção 3.9.1 - Auto-Mapeamento (Hit Test)
 */
export class HitTest {
  /**
   * Obtém o elemento DOM em coordenadas específicas.
   * 
   * @param x Coordenada X (em pixels)
   * @param y Coordenada Y (em pixels)
   * @returns Elemento HTMLElement ou null se não encontrado
   */
  getElementAt(x: number, y: number): HTMLElement | null {
    try {
      const element = document.elementFromPoint(x, y);
      return element instanceof HTMLElement ? element : null;
    } catch (error) {
      console.warn('Mettri: Erro ao obter elemento em coordenadas:', error);
      return null;
    }
  }

  /**
   * Encontra o container apropriado para um seletor específico.
   * Navega para cima na árvore DOM até encontrar um container que faça sentido.
   * 
   * @param element Elemento inicial
   * @param selectorId ID do seletor (para contexto)
   * @returns Container HTMLElement ou null se não encontrado
   */
  findContainer(element: HTMLElement, selectorId: string): HTMLElement | null {
    let current: HTMLElement | null = element;
    const maxDepth = 10; // Limitar profundidade para evitar loops infinitos
    let depth = 0;

    while (current && depth < maxDepth) {
      // Verificar se este elemento é um container apropriado
      if (this.isAppropriateContainer(current, selectorId)) {
        return current;
      }

      // Navegar para o pai
      current = current.parentElement;
      depth++;
    }

    // Se não encontrou container apropriado, retornar o elemento original
    return element;
  }

  /**
   * Verifica se um elemento é um container apropriado para um seletor.
   * 
   * @param element Elemento a verificar
   * @param selectorId ID do seletor (para contexto)
   * @returns true se o elemento é um container apropriado
   */
  private isAppropriateContainer(element: HTMLElement, selectorId: string): boolean {
    // Heurísticas para determinar se é um container apropriado:
    // 1. Tem data-testid (mais confiável)
    if (element.hasAttribute('data-testid')) {
      return true;
    }

    // 2. Tem role relevante
    const role = element.getAttribute('role');
    if (role && ['application', 'region', 'main', 'article'].includes(role)) {
      return true;
    }

    // 3. Tem classes que indicam container
    const classList = Array.from(element.classList);
    const containerKeywords = ['container', 'panel', 'wrapper', 'content', 'main'];
    if (classList.some(cls => containerKeywords.some(keyword => cls.includes(keyword)))) {
      return true;
    }

    // 4. Para seletores específicos, verificar padrões conhecidos
    if (selectorId.includes('Panel') || selectorId.includes('Container')) {
      // Containers geralmente têm estrutura específica
      if (element.children.length > 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Obtém o elemento sob o cursor do mouse (coordenadas atuais).
   * 
   * @returns Elemento HTMLElement ou null se não encontrado
   */
  getElementUnderCursor(): HTMLElement | null {
    // Esta função requer que seja chamada durante um evento de mouse
    // Por isso, é melhor usar getElementAt() com coordenadas explícitas
    return null;
  }

  /**
   * Obtém todos os elementos em uma área retangular.
   * 
   * @param x1 Coordenada X do canto superior esquerdo
   * @param y1 Coordenada Y do canto superior esquerdo
   * @param x2 Coordenada X do canto inferior direito
   * @param y2 Coordenada Y do canto inferior direito
   * @returns Array de elementos encontrados na área
   */
  getElementsInArea(x1: number, y1: number, x2: number, y2: number): HTMLElement[] {
    const elements: HTMLElement[] = [];
    const step = 10; // Passo para varredura (em pixels)

    // Varredura simples da área
    for (let x = x1; x <= x2; x += step) {
      for (let y = y1; y <= y2; y += step) {
        const element = this.getElementAt(x, y);
        if (element && !elements.includes(element)) {
          elements.push(element);
        }
      }
    }

    return elements;
  }

  /**
   * Obtém o elemento mais próximo de coordenadas específicas.
   * Útil quando elementFromPoint retorna um elemento filho muito pequeno.
   * 
   * @param x Coordenada X
   * @param y Coordenada Y
   * @param maxDistance Distância máxima para buscar (em pixels)
   * @returns Elemento HTMLElement ou null se não encontrado
   */
  getNearestElement(x: number, y: number, maxDistance: number = 50): HTMLElement | null {
    // Primeiro, tentar elemento exato
    let element = this.getElementAt(x, y);
    if (element) {
      return element;
    }

    // Se não encontrou, buscar em círculo ao redor
    const step = 5;
    for (let distance = step; distance <= maxDistance; distance += step) {
      // Buscar em múltiplos pontos ao redor
      const angles = [0, 45, 90, 135, 180, 225, 270, 315];
      for (const angle of angles) {
        const rad = (angle * Math.PI) / 180;
        const offsetX = Math.cos(rad) * distance;
        const offsetY = Math.sin(rad) * distance;
        element = this.getElementAt(x + offsetX, y + offsetY);
        if (element) {
          return element;
        }
      }
    }

    return null;
  }
}
