export type {
  CampanhaComElegibilidade,
  OfferSuggestion,
  Opportunity,
  OpportunityContext,
  VitrinePreviewResult,
  VitrineRecomendacaoItem,
} from './types';
export { detectarOportunidadesPorChat } from './detectar-oportunidades-por-chat';
export { explicarSugestao, type ExplicarSugestaoInput } from './explicar-sugestao';
export { montarContextoDeOportunidade, type MontarContextoInput } from './montar-contexto-de-oportunidade';
export {
  orquestrarVitrinePreview,
  type OrquestrarVitrinePreviewInput,
} from './orquestrar-vitrine-no-atendimento';
export { rankearOportunidades } from './rankear-oportunidades';
