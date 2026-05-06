import { promises as fs } from 'fs';
import { dirname } from 'path';
import type { ConversationChunk } from './agrupar_por_turno';
import { EMBEDDING_DIMENSION } from './embedding-config';
import { cosineSimilarity } from './similarity';
import type { VectorIndex, VectorIndexQueryResult } from './vectorIndex';

interface StoredRecord {
  chunk: ConversationChunk;
  vector: number[];
}

async function ensureDirectoryExists(filePath: string): Promise<void> {
  const dir = dirname(filePath);

  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // Se falhar para criar o diretório, deixamos o erro propagar na próxima operação de escrita.
  }
}

async function loadIndex(filePath: string): Promise<StoredRecord[]> {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(data) as StoredRecord[] | unknown;

    if (!Array.isArray(parsed)) {
      throw new Error('Índice vetorial inválido: conteúdo não é um array.');
    }

    return parsed as StoredRecord[];
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const code = (error as { code?: string }).code;
      if (code === 'ENOENT') {
        // Arquivo ainda não existe: índice vazio.
        return [];
      }
    }

    throw error;
  }
}

async function saveIndex(filePath: string, records: StoredRecord[]): Promise<void> {
  await ensureDirectoryExists(filePath);
  const json = JSON.stringify(records);
  await fs.writeFile(filePath, json, 'utf-8');
}

export class VectorIndexLocal implements VectorIndex {
  private readonly filePath: string;

  constructor(filePath: string) {
    if (!filePath) {
      throw new Error('filePath é obrigatório para VectorIndexLocal.');
    }

    this.filePath = filePath;
  }

  async upsertMany(items: { chunk: ConversationChunk; vector: number[] }[]): Promise<void> {
    if (!items.length) {
      return;
    }

    const currentRecords = await loadIndex(this.filePath);
    const byId = new Map<string, StoredRecord>();

    for (const record of currentRecords) {
      byId.set(record.chunk.id, record);
    }

    for (const item of items) {
      byId.set(item.chunk.id, {
        chunk: item.chunk,
        vector: item.vector,
      });
    }

    const updatedRecords = Array.from(byId.values());
    await saveIndex(this.filePath, updatedRecords);
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

    const records = await loadIndex(this.filePath);

    if (!records.length) {
      return [];
    }

    const scored: VectorIndexQueryResult[] = records.map((record) => ({
      chunk: record.chunk,
      score: cosineSimilarity(queryVector, record.vector),
    }));

    scored.sort((a, b) => b.score - a.score);

    if (k >= scored.length) {
      return scored;
    }

    return scored.slice(0, k);
  }

  async isEmpty(): Promise<boolean> {
    const records = await loadIndex(this.filePath);
    return records.length === 0;
  }
}

