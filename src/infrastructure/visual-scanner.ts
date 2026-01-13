import type { VisualScanResult, BoundingBox, Coordinate, Region } from '../types/visual-scanner';
import type { SelectorTarget } from '../types/selector-scanner';
import { ImageAnalyzer } from './visual-scanner/image-analyzer';
import { CoordinateMapper } from './visual-scanner/coordinate-mapper';
import { InteractionTester } from './visual-scanner/interaction-tester';
import { VisualDebugOverlay } from './visual-scanner/debug-overlay';
import { MettriElementFilter } from './mettri-element-filter';

/**
 * Scanner visual usando visão computacional para detecção de seletores.
 * 
 * Responsabilidades:
 * - Capturar áreas da tela
 * - Analisar características visuais (cor, padrão, texto)
 * - Mapear coordenadas para elementos DOM
 * - Validar elementos através de interações
 */
export class VisualScanner {
  private imageAnalyzer: ImageAnalyzer;
  private coordinateMapper: CoordinateMapper;
  private interactionTester: InteractionTester;
  private debugOverlay: VisualDebugOverlay;
  private debugMode: boolean = false;

  constructor(debugMode: boolean = false) {
    this.imageAnalyzer = new ImageAnalyzer();
    this.coordinateMapper = new CoordinateMapper();
    this.interactionTester = new InteractionTester();
    this.debugOverlay = new VisualDebugOverlay();
    this.debugMode = debugMode;
  }

  /**
   * Ativa/desativa modo debug.
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    if (!enabled) {
      this.debugOverlay.hide();
    }
  }

  /**
   * Escaneia visualmente um target específico.
   * 
   * @param target Target do seletor
   * @returns Resultado da varredura visual
   */
  async scanVisual(target: SelectorTarget): Promise<VisualScanResult> {
    // Determinar área da tela a capturar baseado no target
    const captureArea = this.getCaptureAreaForTarget(target);
    
    // Capturar área da tela
    const imageData = await this.captureScreenArea(captureArea);
    
    if (!imageData) {
      return {
        selectorId: target.id,
        coordinates: [],
        elements: [],
        confidence: 0,
        validated: false,
      };
    }

    // Analisar características visuais
    const regions = this.analyzeVisualFeatures(imageData, target);
    
    // Converter regiões para coordenadas absolutas
    const coordinates = this.regionsToCoordinates(regions, captureArea);
    
    // Mapear coordenadas para elementos DOM
    const elements = this.coordinateMapper.mapCoordinatesToElements(coordinates);
    
    // Filtrar elementos do Mettri
    const filteredElements = MettriElementFilter.filterMettriElements(elements);
    
    // Validar elementos através de interações
    const validatedElements: HTMLElement[] = [];
    for (const element of filteredElements) {
      const isValid = await this.validateElement(element, target);
      if (isValid) {
        validatedElements.push(element);
      }
    }

    const result: VisualScanResult = {
      selectorId: target.id,
      coordinates,
      elements: validatedElements,
      confidence: this.calculateConfidence(regions, validatedElements.length),
      validated: validatedElements.length > 0,
      regions,
    };

    // Mostrar overlay de debug se ativado
    if (this.debugMode && coordinates.length > 0) {
      this.debugOverlay.show(coordinates, regions, target.id);
    }

    return result;
  }

  /**
   * Captura área específica da tela usando Canvas API.
   * 
   * @param area Área a capturar
   * @returns ImageData ou null se falhar
   */
  private async captureScreenArea(area: BoundingBox): Promise<ImageData | null> {
    try {
      // Criar canvas temporário
      const canvas = document.createElement('canvas');
      canvas.width = area.width;
      canvas.height = area.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        return null;
      }

      // Para captura de tela em extensão Chrome, usar html2canvas ou método alternativo
      // Por enquanto, usar método simplificado que captura elementos visíveis
      return this.captureElementsInArea(area);
    } catch (error) {
      console.warn('Mettri: Erro ao capturar área da tela:', error);
      return null;
    }
  }

  /**
   * Captura elementos visíveis em uma área (método alternativo sem html2canvas).
   * 
   * @param area Área a capturar
   * @returns ImageData aproximado baseado em elementos DOM
   */
  private captureElementsInArea(area: BoundingBox): ImageData | null {
    // Encontrar todos os elementos na área
    const elements = this.coordinateMapper.findElementsInRegion(area);
    
    if (elements.length === 0) {
      return null;
    }

    // Criar ImageData baseado em informações dos elementos
    // Nota: Esta é uma aproximação, não uma captura real de pixels
    // Para captura real, seria necessário html2canvas ou Chrome Extension API
    const canvas = document.createElement('canvas');
    canvas.width = area.width;
    canvas.height = area.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return null;
    }

    // Preencher com cor de fundo
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, area.width, area.height);

    // Desenhar elementos (aproximação)
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      const relativeX = rect.left - area.x;
      const relativeY = rect.top - area.y;

      if (relativeX >= 0 && relativeY >= 0 && relativeX < area.width && relativeY < area.height) {
        const style = window.getComputedStyle(element);
        const bgColor = style.backgroundColor || 'transparent';
        
        ctx.fillStyle = bgColor;
        ctx.fillRect(relativeX, relativeY, Math.min(rect.width, area.width - relativeX), Math.min(rect.height, area.height - relativeY));
      }
    }

    return ctx.getImageData(0, 0, area.width, area.height);
  }

  /**
   * Analisa características visuais na imagem capturada.
   * 
   * @param imageData Dados da imagem
   * @param target Target do seletor
   * @returns Array de regiões detectadas
   */
  private analyzeVisualFeatures(imageData: ImageData, target: SelectorTarget): Region[] {
    // Estratégias específicas por target
    switch (target.id) {
      case 'chatUnreadBadge':
        return this.detectChatUnreadBadge(imageData);
      case 'messageStatus':
        return this.detectMessageStatus(imageData);
      case 'chatLastMessage':
        return this.detectChatLastMessage(imageData);
      case 'scrollToTop':
        return this.detectScrollToTop(imageData);
      case 'chatHeaderInfo':
        return this.imageAnalyzer.detectPatterns(imageData, { type: 'button' });
      case 'typingIndicator':
        return this.imageAnalyzer.detectTextRegions(imageData);
      case 'conversationPanel':
        return this.detectConversationPanel(imageData);
      default:
        // Busca genérica por padrões
        return this.imageAnalyzer.detectPatterns(imageData, { type: 'icon' });
    }
  }

  /**
   * Detecção visual específica para chatUnreadBadge.
   */
  private detectChatUnreadBadge(imageData: ImageData): Region[] {
    const badges = this.imageAnalyzer.detectBadges(imageData);
    
    // Filtrar por posição (badges estão no canto direito de chat items)
    return badges.filter(region => {
      const bb = region.boundingBox;
      // Badges geralmente estão na metade direita da área capturada
      const isInRightHalf = bb.x + bb.width / 2 > imageData.width / 2;
      return isInRightHalf;
    });
  }

  /**
   * Detecção visual específica para messageStatus.
   */
  private detectMessageStatus(imageData: ImageData): Region[] {
    const checks = this.imageAnalyzer.detectPatterns(imageData, { type: 'check' });
    
    // Filtrar por posição (status está no canto inferior direito de mensagens)
    return checks.filter(region => {
      const bb = region.boundingBox;
      // Status geralmente está na parte inferior direita
      const isInBottomRight = bb.y + bb.height > imageData.height * 0.7 && 
                             bb.x + bb.width > imageData.width * 0.7;
      return isInBottomRight;
    });
  }

  /**
   * Detecção visual específica para chatLastMessage.
   */
  private detectChatLastMessage(imageData: ImageData): Region[] {
    const textRegions = this.imageAnalyzer.detectTextRegions(imageData);
    
    // Filtrar por posição (preview está abaixo do nome, na metade inferior)
    return textRegions.filter(region => {
      const bb = region.boundingBox;
      // Preview geralmente está na metade inferior da área
      const isInLowerHalf = bb.y > imageData.height / 2;
      // E tem tamanho razoável (não muito pequeno, não muito grande)
      const hasReasonableSize = bb.width > 20 && bb.width < imageData.width * 0.8 &&
                                bb.height > 8 && bb.height < 30;
      return isInLowerHalf && hasReasonableSize;
    });
  }

  /**
   * Detecção visual específica para scrollToTop.
   */
  private detectScrollToTop(imageData: ImageData): Region[] {
    const buttons = this.imageAnalyzer.detectPatterns(imageData, { type: 'button' });
    
    // Filtrar por posição (botão está no topo)
    return buttons.filter(region => {
      const bb = region.boundingBox;
      // Scroll to top está no topo da área (primeiros 20% da altura)
      const isAtTop = bb.y < imageData.height * 0.2;
      // E é pequeno
      const isSmall = bb.width < 50 && bb.height < 50;
      return isAtTop && isSmall;
    });
  }

  /**
   * Detecção visual específica para conversationPanel.
   */
  private detectConversationPanel(imageData: ImageData): Region[] {
    // Panel é uma área grande no centro
    // Não precisa de análise de pixels complexa, usar coordenadas conhecidas
    const main = document.querySelector('#main');
    if (main) {
      return [{
        boundingBox: {
          x: 0, // Relativo à área capturada
          y: 0,
          width: imageData.width,
          height: imageData.height,
        },
        confidence: 0.9,
      }];
    }
    return [];
  }

  /**
   * Converte regiões detectadas para coordenadas absolutas da tela.
   * 
   * @param regions Regiões detectadas (coordenadas relativas)
   * @param captureArea Área original capturada
   * @returns Coordenadas absolutas
   */
  private regionsToCoordinates(regions: Region[], captureArea: BoundingBox): Coordinate[] {
    return regions.map(region => {
      const bb = region.boundingBox;
      // Converter coordenadas relativas para absolutas
      return {
        x: captureArea.x + bb.x + bb.width / 2, // Centro da região
        y: captureArea.y + bb.y + bb.height / 2,
        confidence: region.confidence,
      };
    });
  }

  /**
   * Valida um elemento através de interação.
   * 
   * @param element Elemento a validar
   * @param target Target do seletor
   * @returns true se elemento é válido
   */
  private async validateElement(element: HTMLElement, target: SelectorTarget): Promise<boolean> {
    // Rejeitar elementos do Mettri
    if (MettriElementFilter.isMettriElement(element)) {
      return false;
    }
    
    // Determinar tipo de interação baseado no target
    if (target.id.includes('Button') || target.id.includes('send') || target.id.includes('Info')) {
      return await this.interactionTester.testClick(element, target);
    } else if (target.id.includes('Status') || target.id.includes('Badge')) {
      return await this.interactionTester.testHover(element, target);
    } else if (target.id.includes('Box') || target.id.includes('compose')) {
      return await this.interactionTester.testFocus(element, target);
    }

    // Validação básica: elemento deve estar visível
    const style = window.getComputedStyle(element);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      element.offsetWidth > 0 &&
      element.offsetHeight > 0
    );
  }

  /**
   * Calcula nível de confiança do resultado.
   * 
   * @param regions Regiões detectadas
   * @param validatedCount Número de elementos validados
   * @returns Confiança (0-1)
   */
  private calculateConfidence(regions: Region[], validatedCount: number): number {
    if (regions.length === 0) {
      return 0;
    }

    const avgConfidence = regions.reduce((sum, r) => sum + r.confidence, 0) / regions.length;
    const validationBonus = validatedCount > 0 ? 0.3 : 0;

    return Math.min(1, avgConfidence + validationBonus);
  }

  /**
   * Determina área da tela a capturar baseado no target.
   * 
   * @param target Target do seletor
   * @returns Área a capturar
   */
  private getCaptureAreaForTarget(target: SelectorTarget): BoundingBox {
    // Áreas específicas por categoria
    switch (target.category) {
      case 'navigation':
        // Lista de chats (sidebar esquerda)
        const sidebar = document.querySelector('#pane-side');
        if (sidebar) {
          const rect = sidebar.getBoundingClientRect();
          return {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
          };
        }
        break;

      case 'message':
      case 'metadata':
        // Área central de mensagens
        const main = document.querySelector('#main');
        if (main) {
          const rect = main.getBoundingClientRect();
          return {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
          };
        }
        break;

      case 'ui':
        // Área completa (header, scroll, etc)
        if (target.id === 'chatHeader' || target.id === 'chatHeaderInfo') {
          const header = document.querySelector('[data-testid="conversation-info-header"]');
          if (header) {
            const rect = header.getBoundingClientRect();
            return {
              x: rect.left,
              y: rect.top,
              width: rect.width,
              height: rect.height,
            };
          }
        }
        break;

      case 'input':
        // Footer com campo de input
        const footer = document.querySelector('footer');
        if (footer) {
          const rect = footer.getBoundingClientRect();
          return {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
          };
        }
        break;
    }

    // Fallback: capturar viewport completo
    return {
      x: 0,
      y: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }
}
