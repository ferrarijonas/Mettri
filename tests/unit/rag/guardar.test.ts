import { describe, it, expect } from 'vitest';
import { guardar } from '../../../src/modules/rag';
import type { ConversationChunk, VectorIndex, VectorIndexQueryResult } from '../../../src/modules/rag';
import type { EmbedIndexItem } from '../../../src/modules/rag';

class FakeVectorIndex implements VectorIndex {
  public items: EmbedIndexItem[] = [];

  async upsertMany(items: EmbedIndexItem[]): Promise<void> {
    this.items.push(...items);
  }

  async query(): Promise<VectorIndexQueryResult[]> {
    return [];
  }
}

function createChunk(id: string): ConversationChunk {
  return {
    id,
    schemaVersion: '1.0',
    content: `conteúdo ${id}`,
    chatId: 'chat-1',
    timestamp: new Date('2026-01-01T10:00:00Z').toISOString(),
    messageIds: [id],
    turnSize: {
      client: 1,
      agent: 1,
    },
  };
}

describe('guardar (RAG)', () => {
  it('não chama upsertMany quando items está vazio', async () => {
    const fakeIndex = new FakeVectorIndex();

    await guardar([], fakeIndex);

    expect(fakeIndex.items).toHaveLength(0);
  });

  it('chama upsertMany com todos os items', async () => {
    const fakeIndex = new FakeVectorIndex();

    const items: EmbedIndexItem[] = [
      { chunk: createChunk('c1'), vector: [0.1, 0.2] },
      { chunk: createChunk('c2'), vector: [0.3, 0.4] },
    ];

    await guardar(items, fakeIndex);

    expect(fakeIndex.items).toHaveLength(2);
    expect(fakeIndex.items[0].chunk.id).toBe('c1');
    expect(fakeIndex.items[1].chunk.id).toBe('c2');
  });
});

