import { describe, it, expect } from 'vitest';
import type { MettriBridgeClient } from '../../../src/content/bridge-client';
import type { ConversationChunk } from '../../../src/modules/rag';
import { avaliar_sugestao_rag } from '../../../src/modules/rag';

function makeBridge(overrides: {
  apiKey?: string;
  fetchResponse?: { ok: boolean; status: number; text: string };
  storageThrows?: boolean;
}): MettriBridgeClient {
  const { apiKey = 'sk-test-key', fetchResponse, storageThrows = false } = overrides;

  return {
    storageGet: async (keys: string[]) => {
      if (storageThrows) throw new Error('storage error');
      const result: Record<string, unknown> = {};
      for (const k of keys) {
        if (k === 'mettri:openai:apiKey') result[k] = apiKey;
      }
      return result;
    },
    netFetch: async () => {
      if (!fetchResponse) throw new Error('netFetch não configurado no mock');
      return fetchResponse;
    },
  } as unknown as MettriBridgeClient;
}

function makeValidResponse(scores: {
  scoreRelevance: number;
  scoreFaithfulness: number;
  scoreStyle: number;
  notes?: string;
}): { ok: boolean; status: number; text: string } {
  const content = JSON.stringify(scores);
  return {
    ok: true,
    status: 200,
    text: JSON.stringify({
      choices: [{ message: { content } }],
    }),
  };
}

const sampleChunks: ConversationChunk[] = [
  {
    id: 'chunk-1',
    schemaVersion: '1.0',
    content: 'Cliente: oi\nAtendente: oi, tudo bem?',
    chatId: 'chat-1',
    timestamp: '2026-01-01T09:00:00.000Z',
    messageIds: ['m1'],
    turnSize: { client: 1, agent: 1 },
  },
];

describe('avaliar_sugestao_rag', () => {
  it('retorna scores válidos no caso feliz', async () => {
    const bridge = makeBridge({
      fetchResponse: makeValidResponse({
        scoreRelevance: 0.9,
        scoreFaithfulness: 0.85,
        scoreStyle: 0.7,
        notes: 'bom',
      }),
    });

    const result = await avaliar_sugestao_rag(
      'Cliente: Quero pão\nAtendente: Qual tipo?',
      sampleChunks,
      'Temos integral e francês. Qual prefere?',
      bridge,
    );

    expect(result.scoreRelevance).toBe(0.9);
    expect(result.scoreFaithfulness).toBe(0.85);
    expect(result.scoreStyle).toBe(0.7);
    expect(result.mode).toBe('llm');
    expect(result.notes).toBe('bom');
  });

  it('funciona sem notes na resposta', async () => {
    const bridge = makeBridge({
      fetchResponse: makeValidResponse({
        scoreRelevance: 0.5,
        scoreFaithfulness: 0.5,
        scoreStyle: 0.5,
      }),
    });

    const result = await avaliar_sugestao_rag(
      'Cliente: Oi',
      [],
      'Oi, posso ajudar?',
      bridge,
    );

    expect(result.notes).toBeUndefined();
    expect(result.mode).toBe('llm');
  });

  it('lança erro quando API key está ausente', async () => {
    const bridge = makeBridge({ apiKey: '' });

    await expect(
      avaliar_sugestao_rag('Cliente: Oi', [], 'Oi!', bridge),
    ).rejects.toThrow(/Chave API OpenAI não configurada/);
  });

  it('lança erro quando storageGet falha e key fica vazia', async () => {
    const bridge = makeBridge({ storageThrows: true });

    await expect(
      avaliar_sugestao_rag('Cliente: Oi', [], 'Oi!', bridge),
    ).rejects.toThrow(/Chave API OpenAI não configurada/);
  });

  it('lança erro com resposta JSON malformada (campos faltando)', async () => {
    const bridge = makeBridge({
      fetchResponse: {
        ok: true,
        status: 200,
        text: JSON.stringify({
          choices: [{ message: { content: '{"scoreRelevance": 0.5}' } }],
        }),
      },
    });

    await expect(
      avaliar_sugestao_rag('Cliente: Oi', [], 'Oi!', bridge),
    ).rejects.toThrow(/scoreFaithfulness.*inválido/);
  });

  it('lança erro com score fora do intervalo [0, 1]', async () => {
    const bridge = makeBridge({
      fetchResponse: makeValidResponse({
        scoreRelevance: 1.5,
        scoreFaithfulness: 0.5,
        scoreStyle: 0.5,
      }),
    });

    await expect(
      avaliar_sugestao_rag('Cliente: Oi', [], 'Oi!', bridge),
    ).rejects.toThrow(/scoreRelevance.*inválido/);
  });

  it('lança erro quando netFetch retorna ok: false', async () => {
    const bridge = makeBridge({
      fetchResponse: { ok: false, status: 500, text: 'Internal Server Error' },
    });

    await expect(
      avaliar_sugestao_rag('Cliente: Oi', [], 'Oi!', bridge),
    ).rejects.toThrow(/OpenAI avaliação 500/);
  });

  it('lança erro quando suggestion é vazia', async () => {
    const bridge = makeBridge({});

    await expect(
      avaliar_sugestao_rag('Cliente: Oi', [], '   ', bridge),
    ).rejects.toThrow(/Sugestão vazia/);
  });

  it('funciona com chunks vazio (caso baseline)', async () => {
    const bridge = makeBridge({
      fetchResponse: makeValidResponse({
        scoreRelevance: 0.4,
        scoreFaithfulness: 0.3,
        scoreStyle: 0.8,
      }),
    });

    const result = await avaliar_sugestao_rag(
      'Cliente: Bom dia\nAtendente: Bom dia!',
      [],
      'Posso ajudar?',
      bridge,
    );

    expect(result.scoreRelevance).toBe(0.4);
    expect(result.scoreFaithfulness).toBe(0.3);
    expect(result.scoreStyle).toBe(0.8);
    expect(result.mode).toBe('llm');
  });

  it('lança erro quando resposta não é JSON', async () => {
    const bridge = makeBridge({
      fetchResponse: {
        ok: true,
        status: 200,
        text: JSON.stringify({
          choices: [{ message: { content: 'isso não é json' } }],
        }),
      },
    });

    await expect(
      avaliar_sugestao_rag('Cliente: Oi', [], 'Oi!', bridge),
    ).rejects.toThrow(/não é JSON válido/);
  });
});
