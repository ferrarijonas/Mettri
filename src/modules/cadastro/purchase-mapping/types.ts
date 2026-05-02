/**
 * Tipos para o fluxo "Mapear compras já existentes".
 * Spec: specs/cadastro/spec.md
 */

export type MappingStatus =
  | 'IDLE'
  | 'SAMPLE_LOADING'
  | 'SAMPLE_READY'
  | 'SAMPLE_ANALYZING'
  | 'CONCEPT_READY'
  | 'CONCEPT_APPROVED'
  | 'MAPPING_RUNNING'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'ERROR_SAMPLE'
  | 'ERROR_MAPPING';

export interface MappingSession {
  status: MappingStatus;
  selectedSampleChatIds: string[];
  /** Pool: até 6 chatIds por messageCount (para substituição ao desmarcar) */
  samplePool: { chatId: string; chatName: string; messageCount: number }[];
  conceptText: string | null;
  examplePayloads: { date: string; value?: number; items?: string[]; notes?: string }[];
  totalChatsToProcess: number;
  totalChatsProcessed: number;
  totalPurchasesPersisted: number;
  totalErrors: number;
  cancelRequested: boolean;
}

export interface ConceptResult {
  conceptText: string;
  examplePayloads: { date: string; value?: number; items?: string[]; notes?: string }[];
}

export interface PurchaseItem {
  date: string;
  value?: number | null;
  items?: string[] | null;
  notes?: string | null;
}

export interface MappingResult {
  totalChatsProcessed: number;
  totalPurchasesPersisted: number;
  totalErrors: number;
  cancelled: boolean;
}
