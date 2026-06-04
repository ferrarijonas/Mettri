import { describe, it, expect } from 'vitest';
import type { CapturedMessage } from '../../../src/types';
import type {
  ConversationChunk,
  VectorIndex,
  OrquestradorConsultaOptions,
  AvaliacaoResult,
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

  async isEmpty(): Promise<boolean> {
    return true;
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

const fakeEvaluation: AvaliacaoResult = {
  scoreRelevance: 0.8,
  scoreFaithfulness: 0.7,
  scoreStyle: 0.9,
  mode: 'llm',
};

const fakeAvaliarFn = async (): Promise<AvaliacaoResult> => fakeEvaluation;

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
    avaliarFn: overrides.avaliarFn ?? fakeAvaliarFn,
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
    const allPromptCalls: { conv: string; chunks: ConversationChunk[] }[] = [];

    const promptFn = async (
      currentConversation: string,
      chunks: ConversationChunk[],
    ): Promise<string> => {
      capturedCurrentConversation = currentConversation;
      allPromptCalls.push({ conv: currentConversation, chunks });
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

    expect(allPromptCalls[0].chunks).toEqual([chunkFromIndex]);
    expect(result.chunks).toEqual([chunkFromIndex]);
    expect(result.suggestion).toBe('sugestão fake');

    expect(allPromptCalls[1].chunks).toEqual([]);

    expect(result.debugInfo.evaluation).toEqual(fakeEvaluation);
    expect(result.debugInfo.baselineNoRag).toBeDefined();
    expect(result.debugInfo.baselineNoRag!.suggestion).toBe('sugestão fake');
    expect(result.debugInfo.baselineNoRag!.evaluation).toEqual(fakeEvaluation);
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

  it('propaga erro de avaliarFn sem mascarar', async () => {
    const messages: CapturedMessage[] = [
      createMessage({ id: 'c1', text: 'Oi', isOutgoing: false }),
    ];

    const index = new FakeVectorIndex();
    index.resultsToReturn = [];

    await expect(
      orquestrador_consulta_rag(
        createBaseOptions({
          messages,
          index,
          embedConsultaFn: async () => [0.1],
          buscarFn: async (queryVector, k, idx) => idx.query(queryVector, k),
          promptFn: async () => 'sugestão ok',
          avaliarFn: async () => {
            throw new Error('erro no juiz LLM');
          },
        }),
      ),
    ).rejects.toThrow(/erro no juiz LLM/);
  });

  it('baseline usa promptFn com chunks vazio e avaliarFn recebe a suggestion do baseline', async () => {
    const messages: CapturedMessage[] = [
      createMessage({ id: 'c1', text: 'Quero pão', isOutgoing: false }),
    ];

    const index = new FakeVectorIndex();
    index.resultsToReturn = [
      {
        chunk: {
          id: 'chunk-hist',
          schemaVersion: '1.0',
          content: 'Cliente: pão?\nAtendente: temos sim',
          chatId: 'chat-2',
          timestamp: '2026-01-01T08:00:00.000Z',
          messageIds: ['old-1'],
          turnSize: { client: 1, agent: 1 },
        },
        score: 0.85,
      },
    ];

    const promptCalls: { chunks: ConversationChunk[] }[] = [];

    const promptFn = async (
      _conv: string,
      chunks: ConversationChunk[],
    ): Promise<string> => {
      promptCalls.push({ chunks });
      return chunks.length === 0 ? 'baseline response' : 'rag response';
    };

    const avaliarCalls: { suggestion: string; chunks: ConversationChunk[] }[] = [];

    const avaliarFn = async (
      _conv: string,
      chunks: ConversationChunk[],
      suggestion: string,
    ): Promise<AvaliacaoResult> => {
      avaliarCalls.push({ suggestion, chunks });
      return fakeEvaluation;
    };

    const result = await orquestrador_consulta_rag(
      createBaseOptions({
        messages,
        index,
        embedConsultaFn: async () => [0.1],
        buscarFn: async (queryVector, k, idx) => idx.query(queryVector, k),
        promptFn,
        avaliarFn,
      }),
    );

    expect(promptCalls).toHaveLength(2);
    expect(promptCalls[1].chunks).toEqual([]);

    expect(avaliarCalls).toHaveLength(2);
    expect(avaliarCalls[0].suggestion).toBe('rag response');
    expect(avaliarCalls[1].suggestion).toBe('baseline response');
    expect(avaliarCalls[1].chunks).toEqual([]);

    expect(result.debugInfo.baselineNoRag!.suggestion).toBe('baseline response');
  });

  it('integração: embed_consulta (real com bridge mock) + buscar (real via index) com promptFn e avaliarFn simples', async () => {
    const messages: CapturedMessage[] = [
      createMessage({
        id: 'c1',
        text: 'Quero pão de queijo',
        isOutgoing: false,
        timestamp: new Date('2026-01-01T10:00:00Z'),
      }),
      createMessage({
        id: 'a1',
        text: 'Temos sim, quantas unidades?',
        isOutgoing: true,
        timestamp: new Date('2026-01-01T10:01:00Z'),
      }),
    ];

    // Componente real: embedConsultaFn — função pura que mapeia texto → vetor fixo
    const embedConsultaFn = async (conversationText: string): Promise<number[]> => {
      // Simula embedding determinístico baseado no tamanho do texto
      const length = conversationText.length;
      return [length / 100, 0.5, 0.3];
    };

    // Componente real: buscarFn — chama index.query() real
    const buscarFn = async (
      queryVector: number[],
      k: number,
      index: VectorIndex,
    ): Promise<{ chunk: ConversationChunk; score: number }[]> => {
      return index.query(queryVector, k);
    };

    // Componente simples (mock aceitável): promptFn
    const promptFn = async (
      _currentConversation: string,
      chunks: ConversationChunk[],
    ): Promise<string> => {
      if (chunks.length === 0) return 'resposta sem histórico';
      return `resposta com ${chunks.length} chunk(s)`;
    };

    // Componente simples (mock aceitável): avaliarFn
    const avaliarFn = async (): Promise<AvaliacaoResult> => ({
      scoreRelevance: 0.8,
      scoreFaithfulness: 0.9,
      scoreStyle: 0.7,
      mode: 'llm',
    });

    const index = new FakeVectorIndex();
    // Popula o índice com 1 chunk
    const chunk: ConversationChunk = {
      id: 'chunk-pao-queijo',
      schemaVersion: '1.0',
      content: 'Cliente: Quero pão de queijo\nAtendente: temos sim',
      chatId: 'chat-1',
      timestamp: new Date('2026-01-01T09:00:00Z').toISOString(),
      messageIds: ['old-1'],
      turnSize: { client: 1, agent: 1 },
    };
    index.resultsToReturn = [{ chunk, score: 0.85 }];

    const result = await orquestrador_consulta_rag(
      createBaseOptions({
        messages,
        index,
        embedConsultaFn,
        buscarFn,
        promptFn,
        avaliarFn,
      }),
    );

    // Verifica que embed_consulta + buscar retornaram chunks
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0].id).toBe('chunk-pao-queijo');

    // Verifica que promptFn recebeu os chunks e gerou resposta
    expect(result.suggestion).toBe('resposta com 1 chunk(s)');

    // Verifica que avaliarFn foi chamada (debugInfo presente)
    expect(result.debugInfo.evaluation.scoreRelevance).toBe(0.8);
    expect(result.debugInfo.baselineNoRag).toBeDefined();
    expect(result.debugInfo.baselineNoRag!.suggestion).toBe('resposta sem histórico');
  });
});

