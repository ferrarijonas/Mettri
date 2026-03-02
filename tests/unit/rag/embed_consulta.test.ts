import { describe, it, expect, vi } from 'vitest';
import type { MettriBridgeClient } from '../../../src/content/bridge-client';
import { EMBEDDING_DIMENSION } from '../../../src/modules/rag/embedding-config';
import { embed_consulta } from '../../../src/modules/rag';

function createMockBridge(overrides: Partial<MettriBridgeClient> = {}): MettriBridgeClient {
  const base: Partial<MettriBridgeClient> = {
    storageGet: vi.fn(),
    netFetch: vi.fn(),
  };

  return {
    ...(base as MettriBridgeClient),
    ...overrides,
  };
}

describe('embed_consulta (RAG)', () => {
  it('retorna vetor com dimensão EMBEDDING_DIMENSION para conversationText válido', async () => {
    const conversationText = 'Cliente: Olá\nAtendente: Como posso ajudar?';

    const fakeVector = new Array(EMBEDDING_DIMENSION).fill(0).map((_, i) => i * 0.001);

    const mockBridge = createMockBridge({
      storageGet: vi.fn().mockResolvedValue({
        'mettri:openai:apiKey': 'test-key',
      }),
      netFetch: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: JSON.stringify({
          data: [
            {
              embedding: fakeVector,
              index: 0,
            },
          ],
        }),
      }),
    });

    const vector = await embed_consulta(conversationText, mockBridge);

    expect(vector).toHaveLength(EMBEDDING_DIMENSION);
    expect(vector).toEqual(fakeVector);
  });

  it('lança erro quando conversationText está vazio após trim', async () => {
    const mockBridge = createMockBridge({
      storageGet: vi.fn(),
      netFetch: vi.fn(),
    });

    await expect(embed_consulta('   ', mockBridge)).rejects.toThrow(
      /conversationText vazio para embed_consulta/,
    );
  });

  it('propaga erro quando a API de embeddings retorna erro', async () => {
    const conversationText = 'Cliente: Teste\nAtendente: Teste';

    const mockBridge = createMockBridge({
      storageGet: vi.fn().mockResolvedValue({
        'mettri:openai:apiKey': 'test-key',
      }),
      netFetch: vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: 'erro interno',
      }),
    });

    await expect(embed_consulta(conversationText, mockBridge)).rejects.toThrow(
      /OpenAI embeddings 500: erro interno/,
    );
  });

  it('lança erro quando chave de API não está configurada', async () => {
    const conversationText = 'Cliente: Teste';

    const mockBridge = createMockBridge({
      storageGet: vi.fn().mockResolvedValue({}),
    });

    await expect(embed_consulta(conversationText, mockBridge)).rejects.toThrow(
      /Chave API OpenAI não configurada para RAG/,
    );
  });

  it('lança erro quando resposta de embeddings vem vazia', async () => {
    const conversationText = 'Cliente: Teste\nAtendente: Teste';

    const mockBridge = createMockBridge({
      storageGet: vi.fn().mockResolvedValue({
        'mettri:openai:apiKey': 'test-key',
      }),
      netFetch: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: JSON.stringify({
          data: [],
        }),
      }),
    });

    await expect(embed_consulta(conversationText, mockBridge)).rejects.toThrow(
      /Resposta de embeddings vazia da OpenAI para embed_consulta/,
    );
  });
});

