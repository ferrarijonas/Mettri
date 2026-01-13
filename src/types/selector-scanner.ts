/**
 * Tipos para o sistema de varredura automática de seletores.
 */

export type SelectorPriority = 'P0' | 'P1' | 'P2';
export type SelectorCategory = 'navigation' | 'message' | 'input' | 'metadata' | 'ui';
export type ScanStatus = 'idle' | 'scanning' | 'validating' | 'completed' | 'failed';

/**
 * Definição de um seletor a ser mapeado.
 */
export interface SelectorTarget {
  id: string;
  description: string;
  priority: SelectorPriority;
  category: SelectorCategory;
  required: boolean;
  hints?: {
    location?: string; // Ex: "sidebar esquerda", "footer", "header"
    characteristics?: string[]; // Ex: ["data-testid", "role=button"]
    visualCues?: string; // Ex: "fundo verde", "lado direito"
  };
}

/**
 * Resultado da varredura de um seletor individual.
 */
export interface ScanResult {
  selectorId: string;
  candidates: string[];
  bestSelector: string | null;
  validated: boolean;
  validationErrors: string[];
  testDuration: number;
  elementFound: boolean;
  elementCount: number;
}

/**
 * Sessão de varredura completa.
 */
export interface ScanSession {
  id: string;
  startedAt: Date;
  status: ScanStatus;
  progress: number; // 0-100
  results: ScanResult[];
  errors: string[];
  completedAt?: Date;
}

/**
 * Configuração de varredura.
 */
export interface ScanConfig {
  targets: SelectorTarget[];
  timeout: number; // ms
  maxCandidatesPerSelector: number;
  requireP0Validation: boolean; // Se true, P0 deve ter 100% de sucesso
  minP1SuccessRate: number; // 0-1, ex: 0.8 = 80%
}

/**
 * Resultado de varredura por camada individual.
 */
export interface LayerScanResult {
  layer: number;
  layerName: string;
  elementsFound: number;
  candidatesGenerated: number;
  bestSelector: string | null;
  precision: number; // % de elementos corretos (0-100)
  executionTime: number; // ms
  errors: string[];
}

/**
 * Resultado de teste com número de telefone.
 */
export interface PhoneNumberTestResult {
  phoneNumber: string;
  steps: Array<{
    step: string;
    selectorId: string;
    success: boolean;
    error?: string;
    elementFound?: boolean;
  }>;
  overallSuccess: boolean;
  duration: number; // ms
}
