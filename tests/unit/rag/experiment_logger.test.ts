import { describe, it, expect } from 'vitest';
import type { MettriBridgeClient } from '../../../src/content/bridge-client';
import type { ConversationChunk } from '../../../src/modules/rag';
import {
  buildRagExperimentExportDocumentV1,
  logRagExperimentEvent,
  readRagExperimentStats,
  readRagExperimentStatsForDashboard,
  type RagExperimentLogEvent,
  type RagJudgeScores,
} from '../../../src/modules/rag';

function createBridgeMock() {
  const storage = new Map<string, string>();

  const bridge: MettriBridgeClient = {
    // @ts-expect-error partial mock
    async storageGet(keys: string[]) {
      const result: Record<string, unknown> = {};
      for (const key of keys) {
        if (storage.has(key)) {
          result[key] = storage.get(key);
        }
      }
      return result;
    },
    // @ts-expect-error partial mock
    async storageSet(items: Record<string, unknown>) {
      for (const [key, value] of Object.entries(items)) {
        storage.set(key, String(value));
      }
    },
  };

  return { bridge, storage };
}

const baseScores: RagJudgeScores = {
  scoreRelevance: 0.5,
  scoreFaithfulness: 0.5,
  scoreStyle: 0.5,
  mode: 'llm',
};

const chunksSample: ConversationChunk[] = [
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

describe('experiment_logger', () => {
  it('grava evento em storage e calcula estatísticas básicas', async () => {
    const { bridge } = createBridgeMock();

    await logRagExperimentEvent({
      bridge,
      chatId: 'chat-1',
      messageId: 'm-last',
      currentConversation: 'Cliente: oi\nAtendente: oi',
      chunks: chunksSample,
      k: 5,
      ragSuggestion: 'sugestão com RAG',
      ragEvaluation: {
        ...baseScores,
        scoreRelevance: 0.9,
      },
      baselineSuggestion: 'sugestão baseline',
      baselineEvaluation: {
        ...baseScores,
        scoreRelevance: 0.4,
      },
      model: 'gpt-4o-mini',
      ragPromptVersion: 'v1',
      judgePromptVersion: 'v1',
      indexVersion: 'v1',
    });

    const stats = await readRagExperimentStats({ bridge, days: 1 });

    expect(stats).not.toBeNull();
    expect(stats!.totalEvents).toBe(1);
    expect(stats!.ragBetterCount + stats!.baselineBetterCount + stats!.tieCount).toBe(1);
    expect(stats!.averages.rag.relevance).toBeCloseTo(0.9, 3);
    expect(stats!.averages.baseline.relevance).toBeCloseTo(0.4, 3);
  });

  it('retorna null quando não há eventos', async () => {
    const { bridge } = createBridgeMock();

    const stats = await readRagExperimentStats({ bridge, days: 1 });

    expect(stats).toBeNull();
  });

  it('readRagExperimentStatsForDashboard agrega hoje/semana/total numa leitura', async () => {
    const { bridge } = createBridgeMock();

    await logRagExperimentEvent({
      bridge,
      chatId: 'chat-1',
      messageId: 'm1',
      currentConversation: 'a',
      chunks: chunksSample,
      k: 5,
      ragSuggestion: 'r',
      ragEvaluation: { ...baseScores, scoreRelevance: 0.8 },
      baselineSuggestion: 'b',
      baselineEvaluation: { ...baseScores, scoreRelevance: 0.3 },
      model: 'gpt-4o-mini',
    });

    const bundle = await readRagExperimentStatsForDashboard({ bridge });
    expect(bundle).not.toBeNull();
    expect(bundle!.today?.totalEvents).toBe(1);
    expect(bundle!.week?.totalEvents).toBe(1);
    expect(bundle!.total?.totalEvents).toBe(1);
  });

  it('buildRagExperimentExportDocumentV1 ordena por tempo e monta blocos de N eventos', async () => {
    const { bridge } = createBridgeMock();

    await logRagExperimentEvent({
      bridge,
      chatId: 'chat-a',
      currentConversation: 'a',
      chunks: chunksSample,
      k: 5,
      ragSuggestion: 'r1',
      ragEvaluation: { ...baseScores, scoreRelevance: 0.9 },
      baselineSuggestion: 'b1',
      baselineEvaluation: { ...baseScores, scoreRelevance: 0.2 },
      model: 'gpt-4o-mini',
    });

    await logRagExperimentEvent({
      bridge,
      chatId: 'chat-b',
      currentConversation: 'b',
      chunks: chunksSample,
      k: 5,
      ragSuggestion: 'r2',
      ragEvaluation: { ...baseScores, scoreRelevance: 0.2 },
      baselineSuggestion: 'b2',
      baselineEvaluation: { ...baseScores, scoreRelevance: 0.9 },
      model: 'gpt-4o-mini',
    });

    const stats = await readRagExperimentStats({ bridge, days: 1 });
    expect(stats?.totalEvents).toBe(2);

    const raw = [...(createBridgeMock().storage as unknown as Map<string, string>)];
    const { bridge: b2, storage } = createBridgeMock();
    for (const [k, v] of raw) {
      storage.set(k, v);
    }
    void b2;

    const { bridge: b3, storage: s3 } = createBridgeMock();
    const dayKey = [...s3.keys()][0];
    const lines: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const ts = new Date(2026, 0, 1, 10, i, 0).toISOString();
      lines.push(
        JSON.stringify({
          timestamp: ts,
          chatId: `c${i}`,
          currentConversation: 'x',
          rag: {
            suggestion: 'r',
            evaluation: { ...baseScores, scoreRelevance: 0.8, scoreFaithfulness: 0.8, scoreStyle: 0.8 },
          },
          baseline: {
            suggestion: 'b',
            evaluation: { ...baseScores, scoreRelevance: 0.2, scoreFaithfulness: 0.2, scoreStyle: 0.2 },
          },
          chunksSummary: [],
          k: 5,
          model: 'gpt-4o-mini',
        }),
      );
    }
    s3.set(dayKey ?? 'mettri:rag:experiment:2026-01-01', `${lines.join('\n')}\n`);

    const events = lines.map((line) => JSON.parse(line) as import('../../../src/modules/rag').RagExperimentLogEvent);
    const doc = buildRagExperimentExportDocumentV1({
      events,
      daysScannedBackFromExportDate: 1,
      blockSize: 2,
    });

    expect(doc.exportVersion).toBe(1);
    expect(doc.events).toHaveLength(5);
    expect(doc.events[0].timestamp <= doc.events[4].timestamp).toBe(true);
    expect(doc.seriesBlocks).toHaveLength(3);
    expect(doc.seriesBlocks[0].count).toBe(2);
    expect(doc.seriesBlocks[2].count).toBe(1);
    expect(doc.totals.eventCount).toBe(5);
  });
});

