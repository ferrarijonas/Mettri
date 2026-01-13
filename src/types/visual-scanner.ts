/**
 * Tipos para o sistema de detecção visual de seletores.
 */

/**
 * Caixa delimitadora (bounding box) de uma região.
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Coordenada na tela com nível de confiança.
 */
export interface Coordinate {
  x: number;
  y: number;
  confidence: number; // 0-1
}

/**
 * Cor RGB.
 */
export interface RGB {
  r: number;
  g: number;
  b: number;
  a?: number;
}

/**
 * Região detectada na imagem.
 */
export interface Region {
  boundingBox: BoundingBox;
  confidence: number;
  features?: VisualFeatures;
}

/**
 * Características visuais de um elemento.
 */
export interface VisualFeatures {
  color: RGB;
  size: { width: number; height: number };
  position: Coordinate;
  pattern?: Pattern;
  text?: string;
}

/**
 * Padrão visual a ser detectado.
 */
export interface Pattern {
  type: 'check' | 'badge' | 'button' | 'text' | 'icon';
  color?: RGB;
  size?: { minWidth: number; maxWidth: number; minHeight: number; maxHeight: number };
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

/**
 * Resultado de uma varredura visual.
 */
export interface VisualScanResult {
  selectorId: string;
  coordinates: Coordinate[];
  elements: HTMLElement[];
  confidence: number; // 0-1
  validated: boolean;
  regions?: Region[];
}

/**
 * Tipo de interação para teste.
 */
export type InteractionType = 'click' | 'hover' | 'focus' | 'scroll';

/**
 * Resultado de um teste de interação.
 */
export interface InteractionResult {
  success: boolean;
  element: HTMLElement;
  interactionType: InteractionType;
  stateChange?: unknown; // Estado antes/depois da interação
}
