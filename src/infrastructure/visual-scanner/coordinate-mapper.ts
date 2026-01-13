import type { Coordinate, BoundingBox } from '../../types/visual-scanner';
import { MettriElementFilter } from '../mettri-element-filter';

/**
 * Mapeador de coordenadas de tela para elementos DOM.
 * 
 * Responsabilidades:
 * - Encontrar elementos DOM em coordenadas específicas
 * - Mapear regiões visuais para elementos
 * - Validar mapeamentos de coordenadas
 */
export class CoordinateMapper {
  /**
   * Encontra elemento DOM em uma coordenada específica.
   * 
   * @param x Coordenada X
   * @param y Coordenada Y
   * @returns Elemento HTMLElement ou null (rejeita elementos do Mettri)
   */
  findElementAtCoordinate(x: number, y: number): HTMLElement | null {
    try {
      const element = document.elementFromPoint(x, y);
      if (!(element instanceof HTMLElement)) {
        return null;
      }
      
      // Rejeitar elementos do Mettri
      if (MettriElementFilter.isMettriElement(element)) {
        return null;
      }
      
      return element;
    } catch (error) {
      console.warn('Mettri: Erro ao encontrar elemento em coordenada:', error);
      return null;
    }
  }

  /**
   * Encontra todos os elementos em uma região retangular.
   * 
   * @param region Região (bounding box)
   * @returns Array de elementos encontrados (filtrados para remover elementos do Mettri)
   */
  findElementsInRegion(region: BoundingBox): HTMLElement[] {
    const elements = new Set<HTMLElement>();
    const step = Math.max(5, Math.min(region.width, region.height) / 10); // Passo adaptativo

    // Varrer região em grid
    for (let y = region.y; y < region.y + region.height; y += step) {
      for (let x = region.x; x < region.x + region.width; x += step) {
        const element = this.findElementAtCoordinate(x, y);
        if (element && !elements.has(element)) {
          elements.add(element);
        }
      }
    }

    const allElements = Array.from(elements);
    // Filtrar elementos do Mettri
    return MettriElementFilter.filterMettriElements(allElements);
  }

  /**
   * Obtém coordenadas precisas do centro de um elemento.
   * 
   * @param element Elemento DOM
   * @returns Coordenada do centro do elemento
   */
  getPreciseCoordinates(element: HTMLElement): Coordinate {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      confidence: 1.0, // Coordenadas de elementos DOM são precisas
    };
  }

  /**
   * Obtém coordenadas de todos os cantos de um elemento.
   * 
   * @param element Elemento DOM
   * @returns Array de coordenadas (4 cantos + centro)
   */
  getElementCorners(element: HTMLElement): Coordinate[] {
    const rect = element.getBoundingClientRect();
    return [
      { x: rect.left, y: rect.top, confidence: 1.0 }, // Top-left
      { x: rect.right, y: rect.top, confidence: 1.0 }, // Top-right
      { x: rect.left, y: rect.bottom, confidence: 1.0 }, // Bottom-left
      { x: rect.right, y: rect.bottom, confidence: 1.0 }, // Bottom-right
      { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, confidence: 1.0 }, // Center
    ];
  }

  /**
   * Valida se uma coordenada mapeia corretamente para um elemento esperado.
   * 
   * @param coordinate Coordenada a validar
   * @param expectedElement Elemento esperado
   * @returns true se mapeamento é válido
   */
  validateCoordinateMapping(coordinate: Coordinate, expectedElement: HTMLElement): boolean {
    const element = this.findElementAtCoordinate(coordinate.x, coordinate.y);
    
    if (!element) {
      return false;
    }

    // Verificar se é o elemento esperado ou está contido nele
    if (element === expectedElement) {
      return true;
    }

    // Verificar se elemento está dentro do esperado
    if (expectedElement.contains(element)) {
      return true;
    }

    // Verificar se esperado está dentro do elemento encontrado
    if (element.contains(expectedElement)) {
      return true;
    }

    return false;
  }

  /**
   * Mapeia múltiplas coordenadas para elementos DOM, removendo duplicatas.
   * 
   * @param coordinates Array de coordenadas
   * @returns Array de elementos únicos (filtrados para remover elementos do Mettri)
   */
  mapCoordinatesToElements(coordinates: Coordinate[]): HTMLElement[] {
    const elements = new Set<HTMLElement>();

    for (const coord of coordinates) {
      const element = this.findElementAtCoordinate(coord.x, coord.y);
      if (element) {
        elements.add(element);
      }
    }

    const allElements = Array.from(elements);
    // Filtrar elementos do Mettri
    return MettriElementFilter.filterMettriElements(allElements);
  }

  /**
   * Encontra o elemento mais próximo de uma coordenada dentro de uma distância máxima.
   * 
   * @param x Coordenada X
   * @param y Coordenada Y
   * @param maxDistance Distância máxima em pixels
   * @returns Elemento mais próximo ou null (rejeita elementos do Mettri)
   */
  findNearestElement(x: number, y: number, maxDistance: number = 50): HTMLElement | null {
    // Primeiro, tentar coordenada exata
    let element = this.findElementAtCoordinate(x, y);
    if (element) {
      return element;
    }

    // Buscar em círculo ao redor
    const step = 5;
    for (let distance = step; distance <= maxDistance; distance += step) {
      const angles = [0, 45, 90, 135, 180, 225, 270, 315];
      for (const angle of angles) {
        const rad = (angle * Math.PI) / 180;
        const offsetX = Math.cos(rad) * distance;
        const offsetY = Math.sin(rad) * distance;
        element = this.findElementAtCoordinate(x + offsetX, y + offsetY);
        if (element) {
          return element;
        }
      }
    }

    return null;
  }

  /**
   * Converte coordenadas relativas de uma região para coordenadas absolutas da tela.
   * 
   * @param relativeCoord Coordenada relativa (0-1)
   * @param region Região de referência
   * @returns Coordenada absoluta
   */
  relativeToAbsolute(relativeCoord: Coordinate, region: BoundingBox): Coordinate {
    return {
      x: region.x + relativeCoord.x * region.width,
      y: region.y + relativeCoord.y * region.height,
      confidence: relativeCoord.confidence,
    };
  }

  /**
   * Normaliza coordenadas para diferentes resoluções/zooms.
   * 
   * @param coordinate Coordenada original
   * @param scaleFactor Fator de escala (ex: window.devicePixelRatio)
   * @returns Coordenada normalizada
   */
  normalizeCoordinate(coordinate: Coordinate, scaleFactor: number = 1): Coordinate {
    return {
      x: coordinate.x / scaleFactor,
      y: coordinate.y / scaleFactor,
      confidence: coordinate.confidence,
    };
  }
}
