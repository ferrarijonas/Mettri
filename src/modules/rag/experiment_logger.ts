import type { ConversationChunk } from './agrupar_por_turno';
import type { MettriBridgeClient } from '../../content/bridge-client';

const STORAGE_KEY_PREFIX = 'mettri:rag:experiment:';
const MAX_LINES_PER_DAY = 1000;
const PREVIEW_MAX_CHARS = 120;
/** Mesma régua do placar do dashboard (RAG “ganhou” se média dos 3 scores > baseline + delta). */
const WIN_COMPARISON_DELTA = 0.05;

/** Texto resumido alinhado ao juiz em `avaliar_sugestao_rag.ts` (para export/paper sem depender desse módulo). */
export const RAG_JUDGE_RUBRIC_SUMMARY_FOR_EXPORT = [
  'Juiz: LLM (gpt-4o-mini), temperature 0, saída JSON com scoreRelevance, scoreFaithfulness, scoreStyle em [0,1].',
  'Relevância: a resposta trata do que o cliente perguntou?',
  'Fidelidade: afirmações sustentadas na conversa + exemplos de histórico; penaliza invenção.',
  'Estilo: aderência às regras Jonas (resumo): mensagens curtas (3–14 palavras, máx. 20); uma ideia por mensagem; tom informal (pra, tô, tá, vc, né); sem corporativês nem frases banidas listadas no código do juiz.',
  'Código-fonte do prompt do juiz: src/modules/rag/avaliar_sugestao_rag.ts',
].join('\n');

export interface RagJudgeScores {
  scoreRelevance: number;
  scoreFaithfulness: number;
  scoreStyle: number;
  mode: 'llm';
  notes?: string;
}

export interface RagExperimentLogEvent {
  timestamp: string;
  chatId: string;
  messageId?: string;
  currentConversation: string;
  rag: {
    suggestion: string;
    evaluation: RagJudgeScores;
  };
  baseline: {
    suggestion: string;
    evaluation: RagJudgeScores;
  };
  chunksSummary: Array<{
    id: string;
    chatId: string;
    timestamp: string;
    preview: string;
  }>;
  k: number;
  ragPromptVersion?: string;
  judgePromptVersion?: string;
  indexVersion?: string;
  model: string;
}

export interface RagExperimentStats {
  totalEvents: number;
  ragBetterCount: number;
  baselineBetterCount: number;
  tieCount: number;
  ragBetterPct: number;
  baselineBetterPct: number;
  tiePct: number;
  averages: {
    rag: {
      relevance: number;
      faithfulness: number;
      style: number;
    };
    baseline: {
      relevance: number;
      faithfulness: number;
      style: number;
    };
  };
}

function getStorageKeyForDate(dateIso: string): string {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return `${STORAGE_KEY_PREFIX}unknown`;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${STORAGE_KEY_PREFIX}${year}-${month}-${day}`;
}

function buildChunksSummary(chunks: ConversationChunk[]): RagExperimentLogEvent['chunksSummary'] {
  return chunks.map((chunk) => {
    const previewSource = String(chunk.content ?? '');
    const preview =
      previewSource.length <= PREVIEW_MAX_CHARS
        ? previewSource
        : `${previewSource.slice(0, PREVIEW_MAX_CHARS)}…`;

    return {
      id: String(chunk.id ?? ''),
      chatId: String(chunk.chatId ?? ''),
      timestamp: String(chunk.timestamp ?? ''),
      preview,
    };
  });
}

export async function logRagExperimentEvent(params: {
  bridge: MettriBridgeClient;
  chatId: string;
  messageId?: string;
  currentConversation: string;
  chunks: ConversationChunk[];
  k: number;
  ragSuggestion: string;
  ragEvaluation: RagJudgeScores;
  baselineSuggestion: string;
  baselineEvaluation: RagJudgeScores;
  model: string;
  ragPromptVersion?: string;
  judgePromptVersion?: string;
  indexVersion?: string;
}): Promise<void> {
  const nowIso = new Date().toISOString();

  const event: RagExperimentLogEvent = {
    timestamp: nowIso,
    chatId: params.chatId,
    messageId: params.messageId,
    currentConversation: params.currentConversation,
    rag: {
      suggestion: params.ragSuggestion,
      evaluation: params.ragEvaluation,
    },
    baseline: {
      suggestion: params.baselineSuggestion,
      evaluation: params.baselineEvaluation,
    },
    chunksSummary: buildChunksSummary(params.chunks),
    k: params.k,
    ragPromptVersion: params.ragPromptVersion,
    judgePromptVersion: params.judgePromptVersion,
    indexVersion: params.indexVersion,
    model: params.model,
  };

  const storageKey = getStorageKeyForDate(nowIso);

  try {
    const existing = await params.bridge.storageGet([storageKey]);
    const raw = typeof existing[storageKey] === 'string' ? (existing[storageKey] as string) : '';

    const lines = raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    lines.push(JSON.stringify(event));

    const trimmedLines =
      lines.length > MAX_LINES_PER_DAY ? lines.slice(lines.length - MAX_LINES_PER_DAY) : lines;

    const nextValue = `${trimmedLines.join('\n')}\n`;

    await params.bridge.storageSet({ [storageKey]: nextValue });
  } catch (error) {
    // Logging é best-effort: nunca deve quebrar o fluxo principal do atendimento.
    // eslint-disable-next-line no-console
    console.error('[RAG][experiment_logger] Erro ao gravar evento de experimento:', error);
  }
}

function parseEventsFromStorageRaw(raw: string): RagExperimentLogEvent[] {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const events: RagExperimentLogEvent[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as RagExperimentLogEvent;
      if (
        parsed &&
        typeof parsed === 'object' &&
        parsed.rag &&
        parsed.baseline &&
        parsed.rag.evaluation &&
        parsed.baseline.evaluation
      ) {
        events.push(parsed);
      }
    } catch {
      // Ignorar linhas quebradas.
    }
  }
  return events;
}

function aggregateRagExperimentStats(events: RagExperimentLogEvent[]): RagExperimentStats | null {
  if (!events.length) {
    return null;
  }

  let ragBetterCount = 0;
  let baselineBetterCount = 0;
  let tieCount = 0;

  let ragRel = 0;
  let ragFid = 0;
  let ragSty = 0;
  let baseRel = 0;
  let baseFid = 0;
  let baseSty = 0;

  for (const ev of events) {
    const r = ev.rag.evaluation;
    const b = ev.baseline.evaluation;

    ragRel += r.scoreRelevance;
    ragFid += r.scoreFaithfulness;
    ragSty += r.scoreStyle;

    baseRel += b.scoreRelevance;
    baseFid += b.scoreFaithfulness;
    baseSty += b.scoreStyle;

    const ragScore = (r.scoreRelevance + r.scoreFaithfulness + r.scoreStyle) / 3;
    const baseScore = (b.scoreRelevance + b.scoreFaithfulness + b.scoreStyle) / 3;
    const diff = ragScore - baseScore;

    if (diff > WIN_COMPARISON_DELTA) {
      ragBetterCount += 1;
    } else if (diff < -WIN_COMPARISON_DELTA) {
      baselineBetterCount += 1;
    } else {
      tieCount += 1;
    }
  }

  const totalEvents = events.length;

  const safeDiv = (value: number, divisor: number): number =>
    divisor > 0 ? value / divisor : 0;

  const ragBetterPct = safeDiv(ragBetterCount * 100, totalEvents);
  const baselineBetterPct = safeDiv(baselineBetterCount * 100, totalEvents);
  const tiePct = safeDiv(tieCount * 100, totalEvents);

  return {
    totalEvents,
    ragBetterCount,
    baselineBetterCount,
    tieCount,
    ragBetterPct,
    baselineBetterPct,
    tiePct,
    averages: {
      rag: {
        relevance: safeDiv(ragRel, totalEvents),
        faithfulness: safeDiv(ragFid, totalEvents),
        style: safeDiv(ragSty, totalEvents),
      },
      baseline: {
        relevance: safeDiv(baseRel, totalEvents),
        faithfulness: safeDiv(baseFid, totalEvents),
        style: safeDiv(baseSty, totalEvents),
      },
    },
  };
}

export async function readRagExperimentStats(params: {
  bridge: MettriBridgeClient;
  days?: number;
}): Promise<RagExperimentStats | null> {
  const { bridge } = params;
  const days = params.days && params.days > 0 ? Math.floor(params.days) : 1;

  const today = new Date();
  const keys: string[] = [];

  for (let i = 0; i < days; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = getStorageKeyForDate(d.toISOString());
    keys.push(key);
  }

  let events: RagExperimentLogEvent[] = [];

  try {
    const stored = await bridge.storageGet(keys);

    for (const key of keys) {
      const raw = typeof stored[key] === 'string' ? (stored[key] as string) : '';
      if (!raw) continue;
      events.push(...parseEventsFromStorageRaw(raw));
    }
  } catch (error) {
    // Falha em leitura de logs não deve quebrar a UI.
    // eslint-disable-next-line no-console
    console.error('[RAG][experiment_logger] Erro ao ler logs de experimento:', error);
    return null;
  }

  return aggregateRagExperimentStats(events);
}

/** Uma leitura de storage para semana / hoje / janela longa (dashboard). */
export interface RagExperimentStatsDashboardBundle {
  week: RagExperimentStats | null;
  today: RagExperimentStats | null;
  total: RagExperimentStats | null;
}

export async function readRagExperimentStatsForDashboard(params: {
  bridge: MettriBridgeClient;
  recentDays?: number;
  longWindowDays?: number;
}): Promise<RagExperimentStatsDashboardBundle | null> {
  const { bridge } = params;
  const recentDays =
    params.recentDays && params.recentDays > 0 ? Math.floor(params.recentDays) : 7;
  const longWindowDays =
    params.longWindowDays && params.longWindowDays > 0 ? Math.floor(params.longWindowDays) : 366;

  const today = new Date();
  const keys: string[] = [];
  for (let i = 0; i < longWindowDays; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    keys.push(getStorageKeyForDate(d.toISOString()));
  }

  const todayKey = getStorageKeyForDate(today.toISOString());
  const weekKeySet = new Set<string>();
  for (let i = 0; i < recentDays; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    weekKeySet.add(getStorageKeyForDate(d.toISOString()));
  }

  let todayEvents: RagExperimentLogEvent[] = [];
  let weekEvents: RagExperimentLogEvent[] = [];
  let totalEvents: RagExperimentLogEvent[] = [];

  try {
    const stored = await bridge.storageGet(keys);
    for (const key of keys) {
      const raw = typeof stored[key] === 'string' ? (stored[key] as string) : '';
      if (!raw) continue;
      const parsed = parseEventsFromStorageRaw(raw);
      totalEvents.push(...parsed);
      if (weekKeySet.has(key)) {
        weekEvents.push(...parsed);
      }
      if (key === todayKey) {
        todayEvents.push(...parsed);
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[RAG][experiment_logger] Erro ao ler bundle de stats:', error);
    return null;
  }

  return {
    week: aggregateRagExperimentStats(weekEvents),
    today: aggregateRagExperimentStats(todayEvents),
    total: aggregateRagExperimentStats(totalEvents),
  };
}

export interface RagExperimentSeriesBlock {
  blockIndex: number;
  rangeLabel: string;
  startOrdinal: number;
  endOrdinal: number;
  count: number;
  ragBetterPct: number;
  baselineBetterPct: number;
  tiePct: number;
  averages: RagExperimentStats['averages'];
}

export interface RagExperimentExportDocumentV1 {
  exportVersion: 1;
  exportedAt: string;
  dataWindow: {
    daysScannedBackFromExportDate: number;
    storageKeyPattern: string;
    note: string;
  };
  judge: {
    model: string;
    criteria: ['scoreRelevance', 'scoreFaithfulness', 'scoreStyle'];
    scale: '[0,1]';
    winComparisonDelta: number;
    rubricSummary: string;
  };
  caveats: string[];
  totals: {
    eventCount: number;
    aggregate: RagExperimentStats | null;
  };
  seriesBlocks: RagExperimentSeriesBlock[];
  events: RagExperimentLogEvent[];
}

function sortEventsByTimestampAsc(events: RagExperimentLogEvent[]): RagExperimentLogEvent[] {
  return [...events].sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    return ta - tb;
  });
}

function buildRagExperimentSeriesBlocks(
  eventsSorted: RagExperimentLogEvent[],
  blockSize: number,
): RagExperimentSeriesBlock[] {
  const size = blockSize > 0 ? Math.floor(blockSize) : 100;
  const blocks: RagExperimentSeriesBlock[] = [];

  for (let i = 0; i < eventsSorted.length; i += size) {
    const slice = eventsSorted.slice(i, i + size);
    const agg = aggregateRagExperimentStats(slice);
    if (!agg) continue;

    const startOrdinal = i + 1;
    const endOrdinal = i + slice.length;
    blocks.push({
      blockIndex: blocks.length,
      rangeLabel: `events ${startOrdinal}-${endOrdinal}`,
      startOrdinal,
      endOrdinal,
      count: slice.length,
      ragBetterPct: agg.ragBetterPct,
      baselineBetterPct: agg.baselineBetterPct,
      tiePct: agg.tiePct,
      averages: agg.averages,
    });
  }

  return blocks;
}

/** Lê chaves `mettri:rag:experiment:YYYY-MM-DD` em janela de dias (varredura para trás a partir de hoje). */
export async function collectRagExperimentEventsForExport(params: {
  bridge: MettriBridgeClient;
  maxDaysBack?: number;
  storageGetBatchSize?: number;
}): Promise<RagExperimentLogEvent[]> {
  const maxDays =
    params.maxDaysBack && params.maxDaysBack > 0 ? Math.floor(params.maxDaysBack) : 1095;
  const batchSize =
    params.storageGetBatchSize && params.storageGetBatchSize > 0
      ? Math.floor(params.storageGetBatchSize)
      : 120;

  const today = new Date();
  const allKeys: string[] = [];
  for (let i = 0; i < maxDays; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    allKeys.push(getStorageKeyForDate(d.toISOString()));
  }

  const collected: RagExperimentLogEvent[] = [];

  for (let offset = 0; offset < allKeys.length; offset += batchSize) {
    const batch = allKeys.slice(offset, offset + batchSize);
    try {
      const stored = await params.bridge.storageGet(batch);
      for (const key of batch) {
        const raw = typeof stored[key] === 'string' ? (stored[key] as string) : '';
        if (!raw) continue;
        collected.push(...parseEventsFromStorageRaw(raw));
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[RAG][experiment_logger] Erro ao coletar eventos para export:', error);
      throw error;
    }
  }

  return collected;
}

export function buildRagExperimentExportDocumentV1(params: {
  events: RagExperimentLogEvent[];
  daysScannedBackFromExportDate: number;
  blockSize?: number;
}): RagExperimentExportDocumentV1 {
  const sorted = sortEventsByTimestampAsc(params.events);
  const blockSize = params.blockSize && params.blockSize > 0 ? Math.floor(params.blockSize) : 100;

  return {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    dataWindow: {
      daysScannedBackFromExportDate: params.daysScannedBackFromExportDate,
      storageKeyPattern: `${STORAGE_KEY_PREFIX}YYYY-MM-DD`,
      note:
        'Cada dia é um valor string JSONL no storage da extensão. Eventos fora da janela de dias não aparecem. Por dia, no máximo 1000 linhas são retidas (as mais recentes).',
    },
    judge: {
      model: 'gpt-4o-mini',
      criteria: ['scoreRelevance', 'scoreFaithfulness', 'scoreStyle'],
      scale: '[0,1]',
      winComparisonDelta: WIN_COMPARISON_DELTA,
      rubricSummary: RAG_JUDGE_RUBRIC_SUMMARY_FOR_EXPORT,
    },
    caveats: [
      'Não há neste export marcos automáticos de produto (ex.: perda de histórico, reindexação, troca de versão de índice) — só o que cada evento já carrega (ragPromptVersion, judgePromptVersion, indexVersion quando preenchidos).',
      'Tamanho do índice vetorial ao longo do tempo não é gravado por evento; só é possível inferir indiretamente (ex.: k e chunksSummary).',
      'Não há amostra humana anotada no pipeline; comparação é juiz LLM vs juiz LLM (RAG vs baseline).',
      'Textos incluem conversas e sugestões: trate como dados sensíveis ao compartilhar.',
    ],
    totals: {
      eventCount: sorted.length,
      aggregate: aggregateRagExperimentStats(sorted),
    },
    seriesBlocks: buildRagExperimentSeriesBlocks(sorted, blockSize),
    events: sorted,
  };
}

export async function downloadRagExperimentExportJson(params: {
  bridge: MettriBridgeClient;
  maxDaysBack?: number;
  blockSize?: number;
  storageGetBatchSize?: number;
}): Promise<{ eventCount: number; filename: string }> {
  const maxDays =
    params.maxDaysBack && params.maxDaysBack > 0 ? Math.floor(params.maxDaysBack) : 1095;

  const events = await collectRagExperimentEventsForExport({
    bridge: params.bridge,
    maxDaysBack: maxDays,
    storageGetBatchSize: params.storageGetBatchSize,
  });

  const doc = buildRagExperimentExportDocumentV1({
    events,
    daysScannedBackFromExportDate: maxDays,
    blockSize: params.blockSize,
  });

  const json = JSON.stringify(doc, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const dayStamp = new Date().toISOString().slice(0, 10);
  const filename = `mettri-rag-experiment-export-${dayStamp}.json`;

  try {
    await params.bridge.downloadsDownload({ url, filename, saveAs: true });
  } finally {
    URL.revokeObjectURL(url);
  }

  return { eventCount: doc.events.length, filename };
}

