import type { Coordinate, Region } from '../../types/visual-scanner';

/**
 * Overlay de debug para mostrar coordenadas e regiões detectadas visualmente.
 * 
 * Responsabilidades:
 * - Mostrar marcadores nas coordenadas detectadas
 * - Exibir informações sobre regiões encontradas
 * - Permitir interação para inspecionar elementos
 */
export class VisualDebugOverlay {
  private overlay: HTMLElement | null = null;
  private markers: HTMLElement[] = [];

  /**
   * Mostra overlay com coordenadas detectadas.
   * 
   * @param coordinates Coordenadas detectadas
   * @param regions Regiões detectadas (opcional)
   * @param selectorId ID do seletor (para contexto)
   */
  show(coordinates: Coordinate[], regions?: Region[], selectorId?: string): void {
    this.hide(); // Remover overlay anterior se existir

    this.overlay = document.createElement('div');
    this.overlay.id = 'mettri-visual-debug-overlay';
    this.overlay.className = 'mettri-visual-debug-overlay';
    document.body.appendChild(this.overlay);

    this.addStyles();

    // Adicionar marcadores para cada coordenada
    coordinates.forEach((coord, index) => {
      const marker = this.createMarker(coord, index, selectorId);
      this.overlay!.appendChild(marker);
      this.markers.push(marker);
    });

    // Adicionar regiões se fornecidas
    if (regions) {
      regions.forEach((region, index) => {
        const regionOverlay = this.createRegionOverlay(region, index);
        this.overlay!.appendChild(regionOverlay);
      });
    }

    // Adicionar informações no canto
    const info = this.createInfoPanel(coordinates.length, regions?.length || 0, selectorId);
    this.overlay.appendChild(info);
  }

  /**
   * Esconde overlay de debug.
   */
  hide(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    this.markers = [];
  }

  /**
   * Cria marcador para uma coordenada.
   */
  private createMarker(coord: Coordinate, index: number, selectorId?: string): HTMLElement {
    const marker = document.createElement('div');
    marker.className = 'mettri-visual-marker';
    marker.style.left = `${coord.x}px`;
    marker.style.top = `${coord.y}px`;
    marker.setAttribute('data-index', index.toString());
    marker.setAttribute('data-confidence', coord.confidence.toFixed(2));

    // Círculo indicador
    const circle = document.createElement('div');
    circle.className = 'mettri-visual-marker-circle';
    marker.appendChild(circle);

    // Label com índice e confiança
    const label = document.createElement('div');
    label.className = 'mettri-visual-marker-label';
    label.textContent = `${index + 1} (${Math.round(coord.confidence * 100)}%)`;
    marker.appendChild(label);

    // Tooltip com informações
    const tooltip = document.createElement('div');
    tooltip.className = 'mettri-visual-marker-tooltip';
    tooltip.innerHTML = `
      <strong>Coordenada ${index + 1}</strong><br>
      X: ${Math.round(coord.x)}, Y: ${Math.round(coord.y)}<br>
      Confiança: ${Math.round(coord.confidence * 100)}%<br>
      ${selectorId ? `Seletor: ${selectorId}` : ''}
    `;
    marker.appendChild(tooltip);

    // Adicionar evento de clique para inspecionar elemento
    marker.addEventListener('click', () => {
      const element = document.elementFromPoint(coord.x, coord.y);
      if (element) {
        console.log('Mettri: Elemento na coordenada:', element);
        // Destacar elemento
        this.highlightElement(element as HTMLElement);
      }
    });

    return marker;
  }

  /**
   * Cria overlay para uma região detectada.
   */
  private createRegionOverlay(region: Region, index: number): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'mettri-visual-region';
    const bb = region.boundingBox;
    overlay.style.left = `${bb.x}px`;
    overlay.style.top = `${bb.y}px`;
    overlay.style.width = `${bb.width}px`;
    overlay.style.height = `${bb.height}px`;
    overlay.setAttribute('data-index', index.toString());
    overlay.setAttribute('data-confidence', region.confidence.toFixed(2));

    // Label com confiança
    const label = document.createElement('div');
    label.className = 'mettri-visual-region-label';
    label.textContent = `Região ${index + 1} (${Math.round(region.confidence * 100)}%)`;
    overlay.appendChild(label);

    return overlay;
  }

  /**
   * Cria painel de informações.
   */
  private createInfoPanel(coordCount: number, regionCount: number, selectorId?: string): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'mettri-visual-debug-info';
    panel.innerHTML = `
      <div class="mettri-visual-debug-info-header">
        <strong>Debug Visual</strong>
        <button class="mettri-visual-debug-close">×</button>
      </div>
      <div class="mettri-visual-debug-info-content">
        ${selectorId ? `<div><strong>Seletor:</strong> ${selectorId}</div>` : ''}
        <div><strong>Coordenadas:</strong> ${coordCount}</div>
        <div><strong>Regiões:</strong> ${regionCount}</div>
        <div class="mettri-visual-debug-hint">Clique nos marcadores para inspecionar elementos</div>
      </div>
    `;

    const closeBtn = panel.querySelector('.mettri-visual-debug-close');
    closeBtn?.addEventListener('click', () => {
      this.hide();
    });

    return panel;
  }

  /**
   * Destaca um elemento na tela.
   */
  private highlightElement(element: HTMLElement): void {
    // Remover destaque anterior
    const previous = document.querySelector('.mettri-visual-highlight');
    previous?.remove();

    const rect = element.getBoundingClientRect();
    const highlight = document.createElement('div');
    highlight.className = 'mettri-visual-highlight';
    highlight.style.position = 'fixed';
    highlight.style.left = `${rect.left}px`;
    highlight.style.top = `${rect.top}px`;
    highlight.style.width = `${rect.width}px`;
    highlight.style.height = `${rect.height}px`;
    highlight.style.border = '3px solid #ff0000';
    highlight.style.pointerEvents = 'none';
    highlight.style.zIndex = '9999998';
    document.body.appendChild(highlight);

    // Remover após 2 segundos
    setTimeout(() => {
      highlight.remove();
    }, 2000);
  }

  /**
   * Adiciona estilos CSS.
   */
  private addStyles(): void {
    if (document.getElementById('mettri-visual-debug-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'mettri-visual-debug-styles';
    style.textContent = `
      .mettri-visual-debug-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 9999997;
      }
      .mettri-visual-marker {
        position: absolute;
        pointer-events: all;
        cursor: pointer;
        transform: translate(-50%, -50%);
      }
      .mettri-visual-marker-circle {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #ff0000;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        animation: mettri-pulse 2s ease-in-out infinite;
      }
      @keyframes mettri-pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.2); opacity: 0.8; }
      }
      .mettri-visual-marker-label {
        position: absolute;
        top: 25px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 11px;
        white-space: nowrap;
        pointer-events: none;
      }
      .mettri-visual-marker-tooltip {
        position: absolute;
        top: 45px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px;
        border-radius: 4px;
        font-size: 12px;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s;
      }
      .mettri-visual-marker:hover .mettri-visual-marker-tooltip {
        opacity: 1;
      }
      .mettri-visual-region {
        position: absolute;
        border: 2px dashed #00ff00;
        background: rgba(0, 255, 0, 0.1);
        pointer-events: none;
      }
      .mettri-visual-region-label {
        position: absolute;
        top: -20px;
        left: 0;
        background: rgba(0, 255, 0, 0.9);
        color: #000;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 11px;
        font-weight: 600;
      }
      .mettri-visual-debug-info {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border: 2px solid #25D366;
        border-radius: 8px;
        padding: 16px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
        pointer-events: all;
        max-width: 300px;
        z-index: 9999999;
      }
      .mettri-visual-debug-info-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid #e0e0e0;
      }
      .mettri-visual-debug-close {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #666;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .mettri-visual-debug-close:hover {
        color: #000;
        background: #f0f0f0;
        border-radius: 4px;
      }
      .mettri-visual-debug-info-content {
        font-size: 13px;
        line-height: 1.6;
      }
      .mettri-visual-debug-info-content div {
        margin-bottom: 8px;
      }
      .mettri-visual-debug-hint {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid #e0e0e0;
        font-size: 11px;
        color: #666;
        font-style: italic;
      }
      .mettri-visual-highlight {
        position: fixed;
        pointer-events: none;
        z-index: 9999998;
        animation: mettri-highlight-flash 0.5s ease-in-out;
      }
      @keyframes mettri-highlight-flash {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `;
    document.head.appendChild(style);
  }
}
