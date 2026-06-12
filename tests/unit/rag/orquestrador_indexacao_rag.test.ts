import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CapturedMessage } from '../../../src/types';
import type { VectorIndex, VectorIndexQueryResult, EmbedIndexItem } from '../../../src/modules/rag';
import {
  orquestrador_indexacao_rag,
  type OrquestradorIndexacaoOptions,
} from '../../../src/modules/rag';
import * as fonteModule from '../../../src/modules/rag/fonte';
import * as embedIndexModule from '../../../src/modules/rag/embed_index';
import * as guardarModule from '../../../src/modules/rag/guardar';
import { validMessage, validMessageOutgoing } from '../../fixtures/test-data';
import type { MettriBridgeClient } from '../../../src/content/bridge-client';

class FakeVectorIndex implements VectorIndex {
  public items: EmbedIndexItem[] = [];

  async upsertMany(items: EmbedIndexItem[]): Promise<void> {
    this.items.push(...items);
  }

  async query(): Promise<VectorIndexQueryResult[]> {
    return [];
  }

  async isEmpty(): Promise<boolean> {
    return this.items.length === 0;
  }
}

function makeMessage(
  base: CapturedMessage,
  overrides: Partial<CapturedMessage>,
): CapturedMessage {
  return { ...base, ...overrides };
}

describe('orquestrador_indexacao_rag (RAG)', () => {
  let bridge: MettriBridgeClient;

  beforeEach(() => {
    bridge = {} as MettriBridgeClient;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('com chatId definido indexa apenas aquele chat', async () => {
    const chatId = 'chat-1';

    const messages: CapturedMessage[] = [
      makeMessage(validMessage, {
        id: 'm1',
        chatId,
        timestamp: new Date('2026-01-01T10:00:00Z'),
        isOutgoing: false,
      }),
      makeMessage(validMessageOutgoing, {
        id: 'a1',
        chatId,
        timestamp: new Date('2026-01-01T10:01:00Z'),
        isOutgoing: true,
      }),
    ];

    const fonteSpy = vi
      .spyOn(fonteModule, 'fonte')
      .mockResolvedValue(messages);

    const embedIndexSpy = vi
      .spyOn(embedIndexModule, 'embed_index')
      .mockImplementation(async chunks =>
        chunks.map((chunk, idx) => ({
          chunk,
          vector: [idx],
        })),
      );

    const guardarSpy = vi
      .spyOn(guardarModule, 'guardar')
      .mockImplementation(async (items, index) => {
        await index.upsertMany(items);
      });

    const index = new FakeVectorIndex();

    const options: OrquestradorIndexacaoOptions = {
      chatId,
      maxMessages: 100,
      bridge,
      index,
    };

    await orquestrador_indexacao_rag(options);

    expect(fonteSpy).toHaveBeenCalledTimes(1);
    expect(fonteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId,
        maxMessages: 100,
      }),
    );

    expect(embedIndexSpy).toHaveBeenCalledTimes(1);
    const [chunksArg] = embedIndexSpy.mock.calls[0];
    expect(Array.isArray(chunksArg)).toBe(true);
    expect(chunksArg).toHaveLength(1);
    expect(chunksArg[0].chatId).toBe(chatId);

    expect(guardarSpy).toHaveBeenCalledTimes(1);
    expect(index.items).toHaveLength(1);
    expect(index.items[0].chunk.chatId).toBe(chatId);
  });

  it('sem chatId agrupa por chat e indexa cada chat separadamente', async () => {
    const chat1 = 'chat-1';
    const chat2 = 'chat-2';

    const messages: CapturedMessage[] = [
      makeMessage(validMessage, {
        id: 'c1_a',
        chatId: chat1,
        timestamp: new Date('2026-01-01T09:00:00Z'),
        isOutgoing: false,
      }),
      makeMessage(validMessageOutgoing, {
        id: 'a1_a',
        chatId: chat1,
        timestamp: new Date('2026-01-01T09:01:00Z'),
        isOutgoing: true,
      }),
      makeMessage(validMessage, {
        id: 'c2_b',
        chatId: chat2,
        timestamp: new Date('2026-01-01T10:00:00Z'),
        isOutgoing: false,
      }),
      makeMessage(validMessageOutgoing, {
        id: 'a2_b',
        chatId: chat2,
        timestamp: new Date('2026-01-01T10:01:00Z'),
        isOutgoing: true,
      }),
    ];

    const fonteSpy = vi
      .spyOn(fonteModule, 'fonte')
      .mockResolvedValue(messages);

    const embedIndexSpy = vi
      .spyOn(embedIndexModule, 'embed_index')
      .mockImplementation(async chunks =>
        chunks.map((chunk, idx) => ({
          chunk,
          vector: [idx],
        })),
      );

    const guardarSpy = vi
      .spyOn(guardarModule, 'guardar')
      .mockImplementation(async (items, index) => {
        await index.upsertMany(items);
      });

    const index = new FakeVectorIndex();

    const options: OrquestradorIndexacaoOptions = {
      bridge,
      index,
    };

    await orquestrador_indexacao_rag(options);

    expect(fonteSpy).toHaveBeenCalledTimes(1);
    expect(fonteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: undefined,
      }),
    );

    // Deve ter chamado embed_index uma vez por chat com mensagens.
    expect(embedIndexSpy.mock.calls.length).toBe(2);

    const firstCallChunks = embedIndexSpy.mock.calls[0][0] as { chatId: string }[];
    const secondCallChunks = embedIndexSpy.mock.calls[1][0] as { chatId: string }[];

    const chatsCalled = new Set([
      ...firstCallChunks.map(c => c.chatId),
      ...secondCallChunks.map(c => c.chatId),
    ]);

    expect(chatsCalled.has(chat1)).toBe(true);
    expect(chatsCalled.has(chat2)).toBe(true);

    expect(guardarSpy).toHaveBeenCalledTimes(2);
    expect(index.items.length).toBeGreaterThanOrEqual(2);
  });

  it('não chama embed_index nem guardar quando não há mensagens para o chat', async () => {
    const fonteSpy = vi.spyOn(fonteModule, 'fonte').mockResolvedValue([]);
    const embedIndexSpy = vi.spyOn(embedIndexModule, 'embed_index');
    const guardarSpy = vi.spyOn(guardarModule, 'guardar');

    const index = new FakeVectorIndex();

    const options: OrquestradorIndexacaoOptions = {
      chatId: 'chat-sem-mensagens',
      bridge,
      index,
    };

    await orquestrador_indexacao_rag(options);

    expect(fonteSpy).toHaveBeenCalledTimes(1);
    expect(embedIndexSpy).not.toHaveBeenCalled();
    expect(guardarSpy).not.toHaveBeenCalled();
    expect(index.items).toHaveLength(0);
  });

  it('propaga erro quando embed_index falha', async () => {
    const chatId = 'chat-erro-embed';

    const messages: CapturedMessage[] = [
      makeMessage(validMessage, {
        id: 'm1',
        chatId,
        timestamp: new Date('2026-01-01T10:00:00Z'),
        isOutgoing: false,
      }),
      makeMessage(validMessageOutgoing, {
        id: 'a1',
        chatId,
        timestamp: new Date('2026-01-01T10:01:00Z'),
        isOutgoing: true,
      }),
    ];

    vi.spyOn(fonteModule, 'fonte').mockResolvedValue(messages);

    const embedIndexSpy = vi
      .spyOn(embedIndexModule, 'embed_index')
      .mockRejectedValue(new Error('falha em embed_index'));

    const guardarSpy = vi.spyOn(guardarModule, 'guardar');

    const index = new FakeVectorIndex();

    const options: OrquestradorIndexacaoOptions = {
      chatId,
      bridge,
      index,
    };

    await expect(orquestrador_indexacao_rag(options)).rejects.toThrow(
      'falha em embed_index',
    );

    expect(embedIndexSpy).toHaveBeenCalledTimes(1);
    expect(guardarSpy).not.toHaveBeenCalled();
    expect(index.items).toHaveLength(0);
  });

  it('integração: chain fonte → embed_index → guardar com MessageDB real (fake-indexeddb)', async () => {
    // justificado: fake-indexeddb é polyfill fiel do IndexedDB para Node.js
    await import('fake-indexeddb/auto');
    const { messageDB } = await import('../../../src/storage/message-db');
    const { CapturedMessageSchema } = await import('../../../src/types/schemas');

    // Aguarda init do messageDB
    await messageDB.setUserWid('test_integration_rag');

    // Popula com 2 mensagens
    const chatId = 'chat-integration-test';
    const msg1 = CapturedMessageSchema.parse({
      id: 'int-msg-1',
      chatId,
      chatName: 'Test',
      sender: 'Cliente',
      text: 'Quero pão francês',
      timestamp: new Date('2026-01-01T10:00:00Z'),
      isOutgoing: false,
      type: 'text',
    });
    const msg2 = CapturedMessageSchema.parse({
      id: 'int-msg-2',
      chatId,
      chatName: 'Test',
      sender: 'Loja',
      text: 'Temos sim, quantos?',
      timestamp: new Date('2026-01-01T10:01:00Z'),
      isOutgoing: true,
      type: 'text',
    });
    await messageDB.saveMessage(msg1);
    await messageDB.saveMessage(msg2);

    // Executa orquestrador com dependências reais (fonte via messageDB)
    const index = new FakeVectorIndex();
    const mockEmbedding = Array.from({ length: 1536 }, (_, i) => (i + 1) / 1536);
    const bridge = {
      embed: async () => mockEmbedding,
      storageGet: async () => ({ 'mettri:openai:apiKey': 'sk-fake-test-key' }),
      netFetch: async () => ({
        ok: true,
        status: 200,
        text: JSON.stringify({
          data: [{ embedding: mockEmbedding, index: 0 }],
        }),
      }),
    } as unknown as MettriBridgeClient;

    await orquestrador_indexacao_rag({
      chatId,
      db: messageDB,
      bridge,
      index,
    });

    // Verifica que os chunks foram embedados e guardados
    expect(index.items.length).toBeGreaterThanOrEqual(1);
    const chunkChatIds = index.items.map(item => item.chunk.chatId);
    expect(chunkChatIds).toContain(chatId);
  });

  it('propaga erro quando guardar falha', async () => {
    const chatId = 'chat-erro-guardar';

    const messages: CapturedMessage[] = [
      makeMessage(validMessage, {
        id: 'm1',
        chatId,
        timestamp: new Date('2026-01-01T10:00:00Z'),
        isOutgoing: false,
      }),
      makeMessage(validMessageOutgoing, {
        id: 'a1',
        chatId,
        timestamp: new Date('2026-01-01T10:01:00Z'),
        isOutgoing: true,
      }),
    ];

    vi.spyOn(fonteModule, 'fonte').mockResolvedValue(messages);

    vi.spyOn(embedIndexModule, 'embed_index').mockImplementation(async chunks =>
      chunks.map((chunk, idx) => ({
        chunk,
        vector: [idx],
      })),
    );

    const guardarSpy = vi
      .spyOn(guardarModule, 'guardar')
      .mockRejectedValue(new Error('falha em guardar'));

    const index = new FakeVectorIndex();

    const options: OrquestradorIndexacaoOptions = {
      chatId,
      bridge,
      index,
    };

    await expect(orquestrador_indexacao_rag(options)).rejects.toThrow(
      'falha em guardar',
    );

    expect(guardarSpy).toHaveBeenCalledTimes(1);
    expect(index.items).toHaveLength(0);
  });
});

