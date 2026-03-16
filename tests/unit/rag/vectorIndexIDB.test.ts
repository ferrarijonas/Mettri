import { describe, it, expect, beforeEach } from 'vitest';
import { VectorIndexIDB } from '../../../src/modules/rag/vectorIndexIDB';
import type { ConversationChunk } from '../../../src/modules/rag';
import { EMBEDDING_DIMENSION } from '../../../src/modules/rag/embedding-config';

function createChunk(id: string, content: string): ConversationChunk {
  return {
    id,
    schemaVersion: '1.0',
    content,
    chatId: 'chat-1',
    timestamp: new Date('2026-01-01T10:00:00Z').toISOString(),
    messageIds: [id],
    turnSize: { client: 1, agent: 1 },
  };
}

describe('VectorIndexIDB (RAG)', () => {
  const defaultDbName = 'mettri-rag-index';

  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(defaultDbName);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });

  it('upsertMany persiste e query retorna os mesmos resultados após "reabrir"', async () => {
    const index1 = new VectorIndexIDB(defaultDbName);
    const items = [
      { chunk: createChunk('c1', 'texto 1'), vector: new Array(EMBEDDING_DIMENSION).fill(0.1) },
      { chunk: createChunk('c2', 'texto 2'), vector: new Array(EMBEDDING_DIMENSION).fill(0.2) },
    ];
    await index1.upsertMany(items);

    const index2 = new VectorIndexIDB(defaultDbName);
    const results = await index2.query(new Array(EMBEDDING_DIMENSION).fill(0.1), 10);

    expect(results.length).toBeGreaterThan(0);
    const ids = results.map((r) => r.chunk.id);
    expect(ids).toContain('c1');
    expect(ids).toContain('c2');
  });

  it('upsertMany com mesmo chunk.id faz upsert (sobrescreve)', async () => {
    const index = new VectorIndexIDB(defaultDbName);
    const baseVector = new Array(EMBEDDING_DIMENSION).fill(0);
    const v1 = [...baseVector];
    v1[0] = 1;
    const v2 = [...baseVector];
    v2[0] = 2;

    await index.upsertMany([
      { chunk: createChunk('c1', 'texto 1'), vector: v1 },
      { chunk: createChunk('c1', 'texto 1 atualizado'), vector: v2 },
    ]);

    const results = await index.query((() => { const v = [...baseVector]; v[0] = 2; return v; })(), 1);

    expect(results).toHaveLength(1);
    expect(results[0].chunk.id).toBe('c1');
    expect(results[0].chunk.content).toBe('texto 1 atualizado');
  });

  it('query em índice vazio retorna []', async () => {
    const emptyDbName = 'mettri-rag-index-empty';
    const index = new VectorIndexIDB(emptyDbName);
    const results = await index.query(new Array(EMBEDDING_DIMENSION).fill(0), 5);
    expect(results).toEqual([]);
  });
});
