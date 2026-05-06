import { describe, it, expect } from 'vitest';
import type { ConversationChunk } from '../../../src/modules/rag';
import { VectorIndexLocal } from '../../../src/modules/rag/vectorIndexLocal';
import { guardar, buscar, type EmbedIndexItem } from '../../../src/modules/rag';
import { EMBEDDING_DIMENSION } from '../../../src/modules/rag/embedding-config';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function createChunk(id: string, content: string): ConversationChunk {
  return {
    id,
    schemaVersion: '1.0',
    content,
    chatId: 'chat-1',
    timestamp: new Date('2026-01-01T10:00:00Z').toISOString(),
    messageIds: [id],
    turnSize: {
      client: 1,
      agent: 1,
    },
  };
}

function createVectorForDimension(dimIndex: number): number[] {
  const v = new Array(EMBEDDING_DIMENSION).fill(0);
  if (dimIndex >= 0 && dimIndex < EMBEDDING_DIMENSION) {
    v[dimIndex] = 1;
  }
  return v;
}

describe('RAG integração: guardar + buscar + VectorIndexLocal', () => {
  it('retorna o chunk mais similar para um queryVector próximo', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'rag-index-integration-'));
    const indexPath = join(tempDir, 'index.json');

    try {
      const index = new VectorIndexLocal(indexPath);

      const items: EmbedIndexItem[] = [
        {
          chunk: createChunk('c1', 'histórico sobre cobrança'),
          vector: createVectorForDimension(0),
        },
        {
          chunk: createChunk('c2', 'histórico sobre cancelamento'),
          vector: createVectorForDimension(1),
        },
      ];

      await guardar(items, index);

      // Query é alinhado com a mesma dimensão do segundo chunk
      const queryVector = createVectorForDimension(1);

      const results = await buscar(queryVector, 2, index);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].chunk.id).toBe('c2');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

