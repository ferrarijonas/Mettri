import { describe, it, expect } from 'vitest';
import type { CapturedMessage } from '../../../src/types';
import type {
  ConversationChunk,
  VectorIndex,
  OrquestradorConsultaOptions,
} from '../../../src/modules/rag';
import type { MettriBridgeClient } from '../../../src/content/bridge-client';
import { orquestrador_consulta_rag } from '../../../src/modules/rag';

class FakeVectorIndex implements VectorIndex {
  public lastQueryArgs: { queryVector: number[]; k: number } | null = null;

  public resultsToReturn: { chunk: ConversationChunk; score: number }[] = [];

  async upsertMany(): Promise<void> {
    // não usado nos testes de consulta
  }

  async query(queryVector: number[], k: number) {
    this.lastQueryArgs = { queryVector, k };
    return this.resultsToReturn;
  }
}

function createMessage(overrides: Partial<CapturedMessage>): CapturedMessage {
  const baseTimestamp = new Date('2026-01-01T10:00:00Z');

  return {
    id: overrides.id ?? 'msg-id',
    chatId: overrides.chatId ?? 'chat-1',
    chatName: overrides.chatName ?? 'Cliente Exemplo',
    sender: overrides.sender ?? (overrides.isOutgoing ? 'Loja' : 'Cliente') ?? 'Cliente',
    text: overrides.text ?? '',
    timestamp: overrides.timestamp ?? baseTimestamp,
    isOutgoing: overrides.isOutgoing ?? false,
    type: overrides.type ?? 'text',
  };
}

function createBaseOptions(
  overrides: Partial<OrquestradorConsultaOptions> = {},
): OrquestradorConsultaOptions {
  const index = overrides.index ?? new FakeVectorIndex();

  return {
    messages: overrides.messages ?? [],
    k: overrides.k ?? 3,
    bridge: overrides.bridge ?? ({} as MettriBridgeClient),
    index,
    embedConsultaFn: overrides.embedConsultaFn,
    buscarFn: overrides.buscarFn,
    promptFn: overrides.promptFn,
  };
}

describe('orquestrador_consulta_rag (RAG)', () => {
  it('monta conversationText correto, delega para embed_consulta, buscar e promptFn, e retorna suggestion + chunks', async () => {
    const messages: CapturedMessage[] = [
      createMessage({
        id: 'c1',
        text: 'Oi',
        isOutgoing: false,
        timestamp: new Date('2026-01-01T10:00:00Z'),
      }),
      createMessage({
        id: 'a1',
        text: 'Olá, tudo bem?',
        isOutgoing: true,
        timestamp: new Date('2026-01-01T10:01:00Z'),
      }),
      createMessage({
        id: 'c2',
        text: 'Quero saber sobre meu pedido.',
        isOutgoing: false,
        timestamp: new Date('2026-01-01T10:02:00Z'),
      }),
      createMessage({
        id: 'a2',
        text: 'Claro, me manda o número.',
        isOutgoing: true,
        timestamp: new Date('2026-01-01T10:03:00Z'),
      }),
      createMessage({
        id: 'c3',
        text: 'É o 123.',
        isOutgoing: false,
        timestamp: new Date('2026-01-01T10:04:00Z'),
      }),
    ];

    const fakeVector = [0.1, 0.2, 0.3];
    let capturedConversationText: string | null = null;

    const embedConsultaFn = async (conversationText: string): Promise<number[]> => {
      capturedConversationText = conversationText;
      return fakeVector;
    };

    const index = new FakeVectorIndex();

    const chunkFromIndex: ConversationChunk = {
      id: 'chunk-1',
      schemaVersion: '1.0',
      content: 'Cliente: exemplo\nAtendente: exemplo',
      chatId: 'chat-1',
      timestamp: new Date('2026-01-01T09:00:00Z').toISOString(),
      messageIds: ['m1'],
      turnSize: {
        client: 1,
        agent: 1,
      },
    };

    index.resultsToReturn = [{ chunk: chunkFromIndex, score: 0.9 }];

    let capturedCurrentConversation: string | null = null;
    let capturedChunks: ConversationChunk[] | null = null;

    const promptFn = async (
      currentConversation: string,
      chunks: ConversationChunk[],
    ): Promise<string> => {
      capturedCurrentConversation = currentConversation;
      capturedChunks = chunks;
      return 'sugestão fake';
    };

    const result = await orquestrador_consulta_rag(
      createBaseOptions({
        messages,
        k: 3,
        index,
        embedConsultaFn,
        buscarFn: async (queryVector, k, idx) => idx.query(queryVector, k),
        promptFn,
      }),
    );

    expect(capturedConversationText).toBe(
      'Cliente: É o 123.\nAtendente: Claro, me manda o número.',
    );

    const expectedCurrentConversation =
      'Cliente: Oi\n' +
      'Atendente: Olá, tudo bem?\n' +
      'Cliente: Quero saber sobre meu pedido.\n' +
      'Atendente: Claro, me manda o número.\n' +
      'Cliente: É o 123.';

    expect(capturedCurrentConversation).toBe(expectedCurrentConversation);

    expect(index.lastQueryArgs).not.toBeNull();
    expect(index.lastQueryArgs?.queryVector).toEqual(fakeVector);
    expect(index.lastQueryArgs?.k).toBe(3);

    expect(capturedChunks).toEqual([chunkFromIndex]);
    expect(result.chunks).toEqual([chunkFromIndex]);
    expect(result.suggestion).toBe('sugestão fake');
  });

  it('chama promptFn mesmo quando buscar retorna lista vazia de resultados', async () => {
    const messages: CapturedMessage[] = [
      createMessage({
        id: 'c1',
        text: 'Cliente com dúvida.',
        isOutgoing: false,
      }),
    ];

    const fakeVector = [0.5, 0.6, 0.7];

    const embedConsultaFn = async (): Promise<number[]> => fakeVector;

    const index = new FakeVectorIndex();
    index.resultsToReturn = [];

    let capturedChunks: ConversationChunk[] | null = null;

    const promptFn = async (
      _currentConversation: string,
      chunks: ConversationChunk[],
    ): Promise<string> => {
      capturedChunks = chunks;
      return 'sugestão sem histórico';
    };

    const result = await orquestrador_consulta_rag(
      createBaseOptions({
        messages,
        k: 5,
        index,
        embedConsultaFn,
        buscarFn: async (queryVector, k, idx) => idx.query(queryVector, k),
        promptFn,
      }),
    );

    expect(index.lastQueryArgs).not.toBeNull();
    expect(index.lastQueryArgs?.queryVector).toEqual(fakeVector);
    expect(index.lastQueryArgs?.k).toBe(5);

    expect(capturedChunks).toEqual([]);
    expect(result.chunks).toEqual([]);
    expect(result.suggestion).toBe('sugestão sem histórico');
  });

  it('falha explicitamente quando messages está vazio', async () => {
    const index = new FakeVectorIndex();

    await expect(
      orquestrador_consulta_rag(
        createBaseOptions({
          messages: [],
          index,
        }),
      ),
    ).rejects.toThrow(/messages não pode ser vazio em orquestrador_consulta_rag/);
  });

  it('falha explicitamente quando não há turno do cliente (só atendente)', async () => {
    const messages: CapturedMessage[] = [
      createMessage({
        id: 'a1',
        text: 'Mensagem só do atendente.',
        isOutgoing: true,
      }),
    ];

    const index = new FakeVectorIndex();

    await expect(
      orquestrador_consulta_rag(
        createBaseOptions({
          messages,
          index,
          embedConsultaFn: async () => [0.1],
          buscarFn: async () => [],
          promptFn: async () => 'nunca deve ser chamado',
        }),
      ),
    ).rejects.toThrow(/Não há turno do cliente na conversa atual para consulta RAG/);
  });

  it('propaga erro de embed_consulta sem mascarar', async () => {
    const messages: CapturedMessage[] = [
      createMessage({
        id: 'c1',
        text: 'Cliente com dúvida.',
        isOutgoing: false,
      }),
    ];

    const index = new FakeVectorIndex();

    let buscarChamado = false;
    let promptChamado = false;

    await expect(
      orquestrador_consulta_rag(
        createBaseOptions({
          messages,
          index,
          embedConsultaFn: async () => {
            throw new Error('erro em embed_consulta');
          },
          buscarFn: async (queryVector, k, idx) => {
            buscarChamado = true;
            return idx.query(queryVector, k);
          },
          promptFn: async () => {
            promptChamado = true;
            return 'nunca deve ser retornado';
          },
        }),
      ),
    ).rejects.toThrow(/erro em embed_consulta/);

    expect(buscarChamado).toBe(false);
    expect(promptChamado).toBe(false);
  });

  it('propaga erro de promptFn sem mascarar após sucesso em embed_consulta e buscar', async () => {
    const messages: CapturedMessage[] = [
      createMessage({
        id: 'c1',
        text: 'Cliente com dúvida final.',
        isOutgoing: false,
      }),
    ];

    const fakeVector = [0.9, 0.8];

    const embedConsultaFn = async (): Promise<number[]> => fakeVector;

    const index = new FakeVectorIndex();
    index.resultsToReturn = [];

    let buscarChamado = false;

    await expect(
      orquestrador_consulta_rag(
        createBaseOptions({
          messages,
          index,
          embedConsultaFn,
          buscarFn: async (queryVector, k, idx) => {
            buscarChamado = true;
            return idx.query(queryVector, k);
          },
          promptFn: async () => {
            throw new Error('erro em prompt+GPT');
          },
        }),
      ),
    ).rejects.toThrow(/erro em prompt\+GPT/);

    expect(buscarChamado).toBe(true);
  });
}

