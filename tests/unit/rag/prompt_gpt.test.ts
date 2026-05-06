import { describe, it, expect, vi } from 'vitest';
import type { MettriBridgeClient } from '../../../src/content/bridge-client';
import type { ConversationChunk } from '../../../src/modules/rag';
import { generateRagSuggestion } from '../../../src/modules/rag';

function createMockBridge(
  overrides: Partial<MettriBridgeClient> = {},
): MettriBridgeClient {
  const base: Partial<MettriBridgeClient> = {
    storageGet: vi.fn(),
    netFetch: vi.fn(),
  };

  return {
    ...(base as MettriBridgeClient),
    ...overrides,
  };
}

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

describe('promptGPT (RAG)', () => {
  it('monta prompt com conversa atual e chunks e retorna suggestion do modelo', async () => {
    const currentConversation = 'Cliente: Tenho dúvida sobre minha fatura.';
    const chunks: ConversationChunk[] = [
      createChunk('c1', 'Cliente: Pergunta sobre boleto\nAtendente: Explica vencimento'),
      createChunk('c2', 'Cliente: Pergunta sobre juros\nAtendente: Explica política de cobrança'),
    ];

    const mockBridge = createMockBridge({
      storageGet: vi.fn().mockResolvedValue({
        'mettri:openai:apiKey': 'test-key',
      }),
      netFetch: vi.fn().mockImplementation(async (args: {
        url: string;
        method?: string;
        headers?: Record<string, string>;
        body?: string;
      }) => {
        const bodyJson = JSON.parse(args.body ?? '{}') as {
          messages?: Array<{ role: string; content: string }>;
        };

        const userMessage = bodyJson.messages?.find(
          (m) => m.role === 'user',
        );

        expect(userMessage?.content).toContain(currentConversation);
        expect(userMessage?.content).toContain(chunks[0].content);
        expect(userMessage?.content).toContain(chunks[1].content);

        return {
          ok: true,
          status: 200,
          text: JSON.stringify({
            choices: [
              {
                message: {
                  content: 'Sugestão de resposta para o cliente.',
                },
              },
            ],
          }),
        };
      }),
    });

    const suggestion = await generateRagSuggestion(currentConversation, chunks, mockBridge);

    expect(suggestion).toBe('Sugestão de resposta para o cliente.');
  });

  it('funciona quando chunks está vazio, usando apenas a conversa atual', async () => {
    const currentConversation = 'Cliente: Quero saber sobre cancelamento.';
    const chunks: ConversationChunk[] = [];

    const mockBridge = createMockBridge({
      storageGet: vi.fn().mockResolvedValue({
        'mettri:openai:apiKey': 'test-key',
      }),
      netFetch: vi.fn().mockImplementation(async (args: {
        url: string;
        method?: string;
        headers?: Record<string, string>;
        body?: string;
      }) => {
        const bodyJson = JSON.parse(args.body ?? '{}') as {
          messages?: Array<{ role: string; content: string }>;
        };

        const userMessage = bodyJson.messages?.find(
          (m) => m.role === 'user',
        );

        expect(userMessage?.content).toContain(currentConversation);
        expect(userMessage?.content).toContain(currentConversation);

        return {
          ok: true,
          status: 200,
          text: JSON.stringify({
            choices: [
              {
                message: {
                  content: 'Sugestão baseada apenas na conversa atual.',
                },
              },
            ],
          }),
        };
      }),
    });

    const suggestion = await generateRagSuggestion(currentConversation, chunks, mockBridge);

    expect(suggestion).toBe('Sugestão baseada apenas na conversa atual.');
  });

  it('lança erro quando a API de chat retorna erro HTTP', async () => {
    const currentConversation = 'Cliente: Teste de erro.';
    const chunks: ConversationChunk[] = [];

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

    await expect(
      generateRagSuggestion(currentConversation, chunks, mockBridge),
    ).rejects.toThrow(/OpenAI 500: erro interno/);
  });

  it('lança erro quando chave de API não está configurada', async () => {
    const currentConversation = 'Cliente: Teste de chave.';
    const chunks: ConversationChunk[] = [];

    const mockBridge = createMockBridge({
      storageGet: vi.fn().mockResolvedValue({}),
    });

    await expect(
      generateRagSuggestion(currentConversation, chunks, mockBridge),
    ).rejects.toThrow(/Chave API OpenAI não configurada para RAG/);
  });

  it('lança erro quando modelo responde sem conteúdo', async () => {
    const currentConversation = 'Cliente: Teste sem conteúdo.';
    const chunks: ConversationChunk[] = [];

    const mockBridge = createMockBridge({
      storageGet: vi.fn().mockResolvedValue({
        'mettri:openai:apiKey': 'test-key',
      }),
      netFetch: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: JSON.stringify({
          choices: [
            {
              message: {
                content: '   ',
              },
            },
          ],
        }),
      }),
    });

    await expect(
      generateRagSuggestion(currentConversation, chunks, mockBridge),
    ).rejects.toThrow(/OpenAI respondeu sem conteúdo para a sugestão RAG/);
  });
});

