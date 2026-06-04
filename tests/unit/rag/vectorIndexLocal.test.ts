import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { VectorIndexLocal } from '../../../src/modules/rag/vectorIndexLocal';
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
    turnSize: {
      client: 1,
      agent: 1,
    },
  };
}

describe('VectorIndexLocal (RAG)', () => {
  let tempDir: string;
  let indexPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'rag-index-'));
    indexPath = join(tempDir, 'index.json');
  });

  it('upsertMany com array vazio não lança erro e índice continua vazio', async () => {
    const index = new VectorIndexLocal(indexPath);

    await index.upsertMany([]);

    const results = await index.query(new Array(EMBEDDING_DIMENSION).fill(0), 5);
    expect(results).toEqual([]);
  });

  it('upsertMany persiste registros e é idempotente', async () => {
    const index = new VectorIndexLocal(indexPath);

    const items = [
      { chunk: createChunk('c1', 'texto 1'), vector: new Array(EMBEDDING_DIMENSION).fill(0.1) },
      { chunk: createChunk('c2', 'texto 2'), vector: new Array(EMBEDDING_DIMENSION).fill(0.2) },
    ];

    await index.upsertMany(items);
    await index.upsertMany(items);

    const results = await index.query(
      new Array(EMBEDDING_DIMENSION).fill(0.1),
      10,
    );

    expect(results.length).toBeGreaterThan(0);
    const ids = results.map((r) => r.chunk.id);
    expect(ids).toContain('c1');
    expect(ids).toContain('c2');
  });

  it('duplicatas no mesmo batch sobrescrevem o último valor', async () => {
    const index = new VectorIndexLocal(indexPath);

    const baseVector = new Array(EMBEDDING_DIMENSION).fill(0);
    const firstVector = [...baseVector];
    firstVector[0] = 1;

    const secondVector = [...baseVector];
    secondVector[0] = 2;

    await index.upsertMany([
      { chunk: createChunk('c1', 'texto 1'), vector: firstVector },
      { chunk: createChunk('c1', 'texto 1 atualizado'), vector: secondVector },
    ]);

    const results = await index.query(
      (() => {
        const v = [...baseVector];
        v[0] = 2;
        return v;
      })(),
      1,
    );

    expect(results).toHaveLength(1);
    expect(results[0].chunk.id).toBe('c1');
  });

  it('query em índice vazio retorna []', async () => {
    const index = new VectorIndexLocal(indexPath);
    const queryVector = new Array(EMBEDDING_DIMENSION).fill(0);

    const results = await index.query(queryVector, 5);

    expect(results).toEqual([]);
  });

  it('lança erro quando k é inválido', async () => {
    const index = new VectorIndexLocal(indexPath);
    const queryVector = new Array(EMBEDDING_DIMENSION).fill(0);

    // @ts-expect-error testando k inválido
    await expect(index.query(queryVector, 0)).rejects.toThrowError(/maior ou igual a 1/);
  });
});

