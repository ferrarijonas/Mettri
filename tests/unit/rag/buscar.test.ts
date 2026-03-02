import { describe, it, expect } from 'vitest';
import { buscar } from '../../../src/modules/rag';
import type {
  VectorIndex,
  VectorIndexQueryResult,
} from '../../../src/modules/rag';
import { EMBEDDING_DIMENSION } from '../../../src/modules/rag/embedding-config';

class FakeVectorIndex implements VectorIndex {
  public lastQueryArgs: { queryVector: number[]; k: number } | null = null;

  public resultsToReturn: VectorIndexQueryResult[] = [];

  async upsertMany(): Promise<void> {
    // não usado em buscar
  }

  async query(queryVector: number[], k: number): Promise<VectorIndexQueryResult[]> {
    this.lastQueryArgs = { queryVector, k };
    return this.resultsToReturn;
  }
}

describe('buscar (RAG)', () => {
  it('delegates para index.query e retorna o resultado sem alterar', async () => {
    const fakeIndex = new FakeVectorIndex();

    const queryVector = new Array(EMBEDDING_DIMENSION).fill(0).map((_, i) => i * 0.01);
    const k = 3;

    const expectedResults: VectorIndexQueryResult[] = [
      {
        chunk: {
          id: 'c1',
          schemaVersion: '1.0',
          content: 'conteúdo 1',
          chatId: 'chat-1',
          timestamp: new Date('2026-01-01T10:00:00Z').toISOString(),
          messageIds: ['m1'],
          turnSize: {
            client: 1,
            agent: 1,
          },
        },
        score: 0.9,
      },
    ];

    fakeIndex.resultsToReturn = expectedResults;

    const results = await buscar(queryVector, k, fakeIndex);

    expect(fakeIndex.lastQueryArgs).not.toBeNull();
    expect(fakeIndex.lastQueryArgs?.queryVector).toEqual(queryVector);
    expect(fakeIndex.lastQueryArgs?.k).toBe(k);
    expect(results).toEqual(expectedResults);
  });

  it('lança erro quando queryVector tem dimensão diferente de EMBEDDING_DIMENSION', async () => {
    const fakeIndex = new FakeVectorIndex();

    const invalidVector = new Array(EMBEDDING_DIMENSION - 1).fill(0);

    await expect(buscar(invalidVector, 1, fakeIndex)).rejects.toThrowError(
      /Dimensão inválida para queryVector/,
    );

    expect(fakeIndex.lastQueryArgs).toBeNull();
  });

  it('lança erro quando k é menor ou igual a 0', async () => {
    const fakeIndex = new FakeVectorIndex();
    const queryVector = new Array(EMBEDDING_DIMENSION).fill(0);

    await expect(buscar(queryVector, 0, fakeIndex)).rejects.toThrowError(
      /maior ou igual a 1/,
    );

    expect(fakeIndex.lastQueryArgs).toBeNull();
  });
}
);

