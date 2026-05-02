import type { MettriBridgeClient } from '../../content/bridge-client';
import { detectarOportunidadesPorChat } from './detectar-oportunidades-por-chat';
import { explicarSugestao } from './explicar-sugestao';
import { montarContextoDeOportunidade, type MontarContextoInput } from './montar-contexto-de-oportunidade';
import { rankearOportunidades } from './rankear-oportunidades';
import type { VitrinePreviewResult } from './types';

export interface OrquestrarVitrinePreviewInput extends MontarContextoInput {
  persona?: string;
}

/**
 * Encadeia contexto → detecção → ranking → explicação.
 * Não envia mensagem (apenas contrato pronto para o atendimento/retomar no futuro).
 */
export async function orquestrarVitrinePreview(
  bridge: MettriBridgeClient,
  input: OrquestrarVitrinePreviewInput
): Promise<VitrinePreviewResult> {
  const context = await montarContextoDeOportunidade(bridge, input);
  const candidatos = detectarOportunidadesPorChat(context);
  const opportunitiesRanked = rankearOportunidades(candidatos);
  const suggestion = explicarSugestao({ context, ranked: opportunitiesRanked, persona: input.persona });
  return { context, opportunitiesRanked, suggestion };
}
