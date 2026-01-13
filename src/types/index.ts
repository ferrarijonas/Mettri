/**
 * Tipos principais re-exportados de schemas.ts (fonte da verdade).
 * Os schemas Zod em schemas.ts são a única definição de tipos para mensagens e seletores.
 */
import type {
  CapturedMessage,
  SelectorDefinition,
  SelectorsConfig,
  MessageDBEntry,
  AutoMappingSession,
  AutoMappingResult,
} from './schemas';

// Re-exportar tipos
export type {
  CapturedMessage,
  SelectorDefinition,
  SelectorsConfig,
  MessageDBEntry,
  AutoMappingSession,
  AutoMappingResult,
};

// Re-exportar schemas Zod para validação
export {
  CapturedMessageSchema,
  SelectorDefinitionSchema,
  SelectorsConfigSchema,
  MessageDBEntrySchema,
  AutoMappingSessionSchema,
  AutoMappingResultSchema,
  messageToDBEntry,
  dbEntryToMessage,
} from './schemas';

// Re-exportar tipos de selector scanner
export type {
  SelectorTarget,
  ScanResult,
  ScanSession,
  ScanConfig,
  SelectorPriority,
  SelectorCategory,
  ScanStatus,
} from './selector-scanner';

// Re-exportar tipos de visual scanner
export type {
  BoundingBox,
  Coordinate,
  RGB,
  Region,
  VisualFeatures,
  VisualScanResult,
  Pattern,
  InteractionType,
} from './visual-scanner';

// Chat types (não relacionados a mensagens capturadas)
export interface Chat {
  id: string;
  name: string;
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount: number;
  isGroup: boolean;
}

// Panel state
export interface PanelState {
  isVisible: boolean;
  isCapturing: boolean;
  messages: CapturedMessage[];
  currentChatId: string | null;
}

// Storage types
export interface StoredSettings {
  panelEnabled: boolean;
  captureEnabled: boolean;
  theme: 'light' | 'dark' | 'auto';
}
