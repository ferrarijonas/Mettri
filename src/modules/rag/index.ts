export { fonte, type FonteOptions } from './fonte';
export {
  agrupar_por_turno,
  type ConversationChunk,
  type ConversationTurnSize,
} from './agrupar_por_turno';
export {
  orquestrador_indexacao_rag,
  type OrquestradorIndexacaoOptions,
} from './orquestrador_indexacao_rag';
export {
  embed_index,
  type EmbedIndexItem,
  sliceIntoBatches,
  validateEmbeddingDimensions,
  zipChunksWithVectors,
} from './embed_index';
export { embed_consulta } from './embed_consulta';
export { cosineSimilarity } from './similarity';
export type { VectorIndex, VectorIndexQueryResult } from './vectorIndex';
export { VectorIndexMemory, vectorIndexMemory } from './vectorIndexMemory';
export { guardar } from './guardar';
export { buscar } from './buscar';
export { generateRagSuggestion, buildRagPrompt } from './prompt_gpt';
export {
  orquestrador_consulta_rag,
  type OrquestradorConsultaOptions,
  type OrquestradorConsultaResult,
  type PromptGptFn,
  type RagConsultaDebugInfo,
} from './orquestrador_consulta_rag';
