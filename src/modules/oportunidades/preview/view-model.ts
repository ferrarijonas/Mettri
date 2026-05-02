import type { VitrinePreviewResult } from '../types';

export interface OportunidadesPreviewVm {
  chatId: string;
  clienteTexto: string;
  aderenciaScore: number;
  result: VitrinePreviewResult | null;
  loadError: string | null;
  isLoading: boolean;
}
