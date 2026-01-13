import type { RGB, Region, Pattern } from '../../types/visual-scanner';

/**
 * Analisador de imagens para detecção visual de elementos.
 * 
 * Responsabilidades:
 * - Analisar pixels de imagens capturadas
 * - Detectar regiões por cor, padrão, texto
 * - Identificar características visuais (badges, ícones, botões)
 */
export class ImageAnalyzer {
  /**
   * Detecta regiões na imagem com cor similar à cor alvo.
   * 
   * @param imageData Dados da imagem
   * @param targetColor Cor alvo
   * @param tolerance Tolerância de cor (0-255)
   * @returns Array de regiões detectadas
   */
  detectColorRegions(imageData: ImageData, targetColor: RGB, tolerance: number = 30): Region[] {
    const regions: Region[] = [];
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const visited = new Set<number>();

    // Percorrer todos os pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (visited.has(index)) {
          continue;
        }

        const pixelIndex = index * 4;
        const r = data[pixelIndex];
        const g = data[pixelIndex + 1];
        const b = data[pixelIndex + 2];
        const a = data[pixelIndex + 3] || 255;

        // Verificar se pixel tem cor similar
        if (this.isColorSimilar({ r, g, b, a }, targetColor, tolerance)) {
          // Flood fill para encontrar região conectada
          const region = this.floodFill(imageData, x, y, targetColor, tolerance, visited);
          if (region && region.boundingBox.width > 2 && region.boundingBox.height > 2) {
            regions.push(region);
          }
        }
      }
    }

    return regions;
  }

  /**
   * Detecta regiões com texto usando análise básica de contraste.
   * 
   * @param imageData Dados da imagem
   * @returns Array de regiões que podem conter texto
   */
  detectTextRegions(imageData: ImageData): Region[] {
    const regions: Region[] = [];
    const width = imageData.width;
    const height = imageData.height;

    // Detectar áreas com alto contraste (característica de texto)
    const contrastMap = this.calculateContrastMap(imageData);
    const textThreshold = 50; // Limiar de contraste para texto

    // Agrupar pixels de alto contraste em regiões
    const visited = new Set<number>();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (visited.has(index) || contrastMap[index] < textThreshold) {
          continue;
        }

        const region = this.floodFillByContrast(imageData, x, y, textThreshold, contrastMap, visited);
        if (region && region.boundingBox.width > 10 && region.boundingBox.height > 5) {
          regions.push(region);
        }
      }
    }

    return regions;
  }

  /**
   * Detecta padrões visuais específicos (check marks, badges, etc).
   * 
   * @param imageData Dados da imagem
   * @param pattern Padrão a detectar
   * @returns Array de regiões que correspondem ao padrão
   */
  detectPatterns(imageData: ImageData, pattern: Pattern): Region[] {
    switch (pattern.type) {
      case 'check':
        return this.detectCheckMarks(imageData);
      case 'badge':
        return this.detectBadges(imageData);
      case 'button':
        return this.detectButtons(imageData);
      case 'icon':
        return this.detectIcons(imageData);
      default:
        return [];
    }
  }

  /**
   * Detecta badges numéricos (pequenos círculos/retângulos com números).
   * 
   * @param imageData Dados da imagem
   * @returns Array de regiões de badges
   */
  detectBadges(imageData: ImageData): Region[] {
    const regions: Region[] = [];

    // Cores comuns de badges (verde, azul, vermelho)
    const badgeColors: RGB[] = [
      { r: 37, g: 211, b: 102 }, // Verde WhatsApp
      { r: 0, g: 132, b: 255 }, // Azul
      { r: 255, g: 59, b: 48 }, // Vermelho
    ];

    for (const color of badgeColors) {
      const colorRegions = this.detectColorRegions(imageData, color, 40);
      
      // Filtrar por tamanho (badges são pequenos)
      const badgeRegions = colorRegions.filter(region => {
        const bb = region.boundingBox;
        const isSmall = bb.width < 30 && bb.height < 30;
        const isCompact = bb.width > 5 && bb.height > 5;
        const isRoughlySquare = Math.abs(bb.width - bb.height) < 10;
        
        return isSmall && isCompact && (isRoughlySquare || bb.width > bb.height * 1.5);
      });

      regions.push(...badgeRegions);
    }

    return regions;
  }

  /**
   * Detecta ícones de check (✓, ✓✓) em mensagens.
   * 
   * @param imageData Dados da imagem
   * @returns Array de regiões com check marks
   */
  detectCheckMarks(imageData: ImageData): Region[] {
    const regions: Region[] = [];

    // Cor cinza/azul comum de check marks
    const checkColors: RGB[] = [
      { r: 112, g: 117, b: 121 }, // Cinza
      { r: 0, g: 132, b: 255 }, // Azul (lido)
    ];

    for (const color of checkColors) {
      const colorRegions = this.detectColorRegions(imageData, color, 30);
      
      // Filtrar por tamanho muito pequeno (check marks são < 20px)
      const checkRegions = colorRegions.filter(region => {
        const bb = region.boundingBox;
        return bb.width < 20 && bb.height < 20 && bb.width > 2 && bb.height > 2;
      });

      regions.push(...checkRegions);
    }

    return regions;
  }

  /**
   * Detecta botões na imagem.
   * 
   * @param imageData Dados da imagem
   * @returns Array de regiões de botões
   */
  detectButtons(imageData: ImageData): Region[] {
    // Detectar regiões com bordas (característica de botões)
    const edgeRegions = this.detectEdges(imageData);
    
    // Filtrar por tamanho e formato de botão
    return edgeRegions.filter(region => {
      const bb = region.boundingBox;
      const hasReasonableSize = bb.width > 20 && bb.height > 20 && bb.width < 200 && bb.height < 100;
      const hasButtonRatio = bb.width / bb.height > 1.2 && bb.width / bb.height < 5;
      
      return hasReasonableSize && hasButtonRatio;
    });
  }

  /**
   * Detecta ícones genéricos.
   * 
   * @param imageData Dados da imagem
   * @returns Array de regiões de ícones
   */
  detectIcons(imageData: ImageData): Region[] {
    // Ícones geralmente são pequenos e têm formas específicas
    const smallRegions = this.detectSmallRegions(imageData);
    
    return smallRegions.filter(region => {
      const bb = region.boundingBox;
      return bb.width < 30 && bb.height < 30 && bb.width > 5 && bb.height > 5;
    });
  }

  /**
   * Verifica se duas cores são similares dentro da tolerância.
   */
  private isColorSimilar(color1: RGB, color2: RGB, tolerance: number): boolean {
    const rDiff = Math.abs(color1.r - color2.r);
    const gDiff = Math.abs(color1.g - color2.g);
    const bDiff = Math.abs(color1.b - color2.b);
    const aDiff = Math.abs((color1.a || 255) - (color2.a || 255));

    return rDiff <= tolerance && gDiff <= tolerance && bDiff <= tolerance && aDiff <= tolerance;
  }

  /**
   * Flood fill para encontrar região conectada de cor similar.
   */
  private floodFill(
    imageData: ImageData,
    startX: number,
    startY: number,
    targetColor: RGB,
    tolerance: number,
    visited: Set<number>
  ): Region | null {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const stack: Array<[number, number]> = [[startX, startY]];
    const pixels: Array<[number, number]> = [];

    let minX = startX;
    let maxX = startX;
    let minY = startY;
    let maxY = startY;

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const index = y * width + x;

      if (x < 0 || x >= width || y < 0 || y >= height || visited.has(index)) {
        continue;
      }

      const pixelIndex = index * 4;
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];
      const a = data[pixelIndex + 3] || 255;

      if (!this.isColorSimilar({ r, g, b, a }, targetColor, tolerance)) {
        continue;
      }

      visited.add(index);
      pixels.push([x, y]);

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      // Adicionar vizinhos
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    if (pixels.length < 4) {
      return null; // Região muito pequena
    }

    return {
      boundingBox: {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      },
      confidence: Math.min(1, pixels.length / 100), // Confiança baseada no tamanho
    };
  }

  /**
   * Calcula mapa de contraste da imagem.
   */
  private calculateContrastMap(imageData: ImageData): number[] {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const contrastMap: number[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        const pixelIndex = index * 4;

        // Calcular contraste com vizinhos
        let maxDiff = 0;
        const neighbors = [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ];

        const r = data[pixelIndex];
        const g = data[pixelIndex + 1];
        const b = data[pixelIndex + 2];
        const brightness = (r + g + b) / 3;

        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIndex = ny * width + nx;
            const nPixelIndex = nIndex * 4;
            const nR = data[nPixelIndex];
            const nG = data[nPixelIndex + 1];
            const nB = data[nPixelIndex + 2];
            const nBrightness = (nR + nG + nB) / 3;

            maxDiff = Math.max(maxDiff, Math.abs(brightness - nBrightness));
          }
        }

        contrastMap[index] = maxDiff;
      }
    }

    return contrastMap;
  }

  /**
   * Flood fill baseado em contraste (para detecção de texto).
   */
  private floodFillByContrast(
    imageData: ImageData,
    startX: number,
    startY: number,
    threshold: number,
    contrastMap: number[],
    visited: Set<number>
  ): Region | null {
    const width = imageData.width;
    const height = imageData.height;
    const stack: Array<[number, number]> = [[startX, startY]];
    const pixels: Array<[number, number]> = [];

    let minX = startX;
    let maxX = startX;
    let minY = startY;
    let maxY = startY;

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const index = y * width + x;

      if (x < 0 || x >= width || y < 0 || y >= height || visited.has(index)) {
        continue;
      }

      if (contrastMap[index] < threshold) {
        continue;
      }

      visited.add(index);
      pixels.push([x, y]);

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    if (pixels.length < 10) {
      return null;
    }

    return {
      boundingBox: {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      },
      confidence: Math.min(1, pixels.length / 500),
    };
  }

  /**
   * Detecta bordas na imagem (para detecção de botões).
   */
  private detectEdges(imageData: ImageData): Region[] {
    // Implementação simplificada: detectar transições bruscas de cor
    const contrastMap = this.calculateContrastMap(imageData);
    const edgeThreshold = 80;
    const visited = new Set<number>();
    const regions: Region[] = [];

    const width = imageData.width;
    const height = imageData.height;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (visited.has(index) || contrastMap[index] < edgeThreshold) {
          continue;
        }

        const region = this.floodFillByContrast(imageData, x, y, edgeThreshold, contrastMap, visited);
        if (region) {
          regions.push(region);
        }
      }
    }

    return regions;
  }

  /**
   * Detecta regiões pequenas (para ícones).
   */
  private detectSmallRegions(imageData: ImageData): Region[] {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const visited = new Set<number>();
    const regions: Region[] = [];

    // Detectar pequenas regiões com cor sólida
    for (let y = 0; y < height; y += 5) {
      for (let x = 0; x < width; x += 5) {
        const index = y * width + x;
        if (visited.has(index)) {
          continue;
        }

        const pixelIndex = index * 4;
        const r = data[pixelIndex];
        const g = data[pixelIndex + 1];
        const b = data[pixelIndex + 2];

        const region = this.floodFill(imageData, x, y, { r, g, b }, 20, visited);
        if (region) {
          const bb = region.boundingBox;
          if (bb.width < 30 && bb.height < 30 && bb.width > 3 && bb.height > 3) {
            regions.push(region);
          }
        }
      }
    }

    return regions;
  }
}
