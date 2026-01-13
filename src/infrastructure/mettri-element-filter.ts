/**
 * Filtro para identificar e rejeitar elementos que pertencem à extensão Mettri.
 * 
 * Responsabilidades:
 * - Verificar se um elemento pertence ao Mettri (ID/classes que começam com "mettri-")
 * - Filtrar arrays de elementos removendo elementos do Mettri
 * - Prevenir falsos positivos na detecção de seletores do WhatsApp
 */
export class MettriElementFilter {
  /**
   * Verifica se um elemento pertence à extensão Mettri.
   * 
   * @param element Elemento a verificar
   * @returns true se elemento pertence ao Mettri
   */
  static isMettriElement(element: HTMLElement): boolean {
    // Verificar ID
    if (element.id && element.id.startsWith('mettri-')) {
      return true;
    }
    
    // Verificar classes
    for (const className of element.classList) {
      if (className.startsWith('mettri-')) {
        return true;
      }
    }
    
    // Verificar se está dentro de um elemento Mettri
    if (element.closest('[id^="mettri-"], [class*="mettri-"]')) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Filtra array de elementos removendo elementos do Mettri.
   * 
   * @param elements Array de elementos a filtrar
   * @returns Array filtrado sem elementos do Mettri
   */
  static filterMettriElements(elements: HTMLElement[]): HTMLElement[] {
    return elements.filter(el => !this.isMettriElement(el));
  }
}
