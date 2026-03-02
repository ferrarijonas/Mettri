import type { ConversationChunk } from './agrupar_por_turno';
import { EMBEDDING_DIMENSION } from './embedding-config';
import { cosineSimilarity } from './similarity';
import type { VectorIndex, VectorIndexQueryResult } from './vectorIndex';

interface StoredRecord {
  chunk: ConversationChunk;
  vector: number[];
}

export class VectorIndexMemory implements VectorIndex {
  private records: StoredRecord[] = [];

  async upsertMany(items: { chunk: ConversationChunk; vector: number[] }[]): Promise<void> {
    if (!items.length) return;

    const byId = new Map<string, StoredRecord>();

    for (const record of this.records) {
      byId.set(record.chunk.id, record);
    }

    for (const item of items) {
      byId.set(item.chunk.id, {
        chunk: item.chunk,
        vector: item.vector,
      });
    }

    this.records = Array.from(byId.values());
  }

  async query(queryVector: number[], k: number): Promise<VectorIndexQueryResult[]> {
    if (!Array.isArray(queryVector)) {
      throw new Error('queryVector deve ser um array numérico.');
    }

    if (queryVector.length !== EMBEDDING_DIMENSION) {
      throw new Error(
        `Dimensão inválida para queryVector: esperado ${EMBEDDING_DIMENSION}, recebido ${queryVector.length}.`,
      );
    }

    if (!Number.isInteger(k) || k <= 0) {
      throw new Error('k deve ser um inteiro maior ou igual a 1.');
    }

    if (!this.records.length) {
      return [];
    }

    const scored: VectorIndexQueryResult[] = this.records.map((record) => ({
      chunk: record.chunk,
      score: cosineSimilarity(queryVector, record.vector),
    }));

    scored.sort((a, b) => b.score - a.score);

    if (k >= scored.length) {
      return scored;
    }

    return scored.slice(0, k);
  }
}

export const vectorIndexMemory = new VectorIndexMemory();

