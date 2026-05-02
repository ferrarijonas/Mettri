import type { MettriBridgeClient } from '../../../content/bridge-client';
import { catalogoDB } from '../../../storage/catalogo-db';
import { orquestrarVitrinePreview } from '../orquestrar-vitrine-no-atendimento';
import type { VitrinePreviewResult } from '../types';

export function getPreviewAccountId(): string {
  return catalogoDB.getCurrentUserWid() || 'default';
}

export async function runOportunidadesPreview(params: {
  bridge: MettriBridgeClient;
  chatId: string;
  clienteTexto: string;
  aderenciaScore: number;
}): Promise<VitrinePreviewResult> {
  const accountId = getPreviewAccountId();
  const nowIso = new Date().toISOString();
  return orquestrarVitrinePreview(params.bridge, {
    chatId: params.chatId.trim() || 'preview_chat',
    accountId,
    instanteIso: nowIso,
    turnoAtual: { clienteTexto: params.clienteTexto },
    aderenciaScore: params.aderenciaScore,
    contactSnapshot: { tags: [] },
    atendimentoSnapshot: { chatAberto: true, operadorDisponivel: true },
    frequencySnapshot: { sendsInPeriod: 0 },
    metadadosSource: 'preview',
    vantagemLogisticaPreview: 0.5,
  });
}
