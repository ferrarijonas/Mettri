import type { ConversationChunk } from './agrupar_por_turno';

export interface VectorIndexQueryResult {
  chunk: ConversationChunk;
  score: number;
}

export interface VectorIndex {
  upsertMany(items: { chunk: ConversationChunk; vector: number[] }[]): Promise<void>;

  query(queryVector: number[], k: number): Promise<VectorIndexQueryResult[]>;

  /** true se não há vetores persistidos (checagem leve; não precisa carregar todos em RAM). */
  isEmpty(): Promise<boolean>;
}

