import type { CapturedMessage } from '../../types';
import type { ConversationChunk } from './agrupar_por_turno';
import type { VectorIndex, VectorIndexQueryResult } from './vectorIndex';
import type { MettriBridgeClient } from '../../content/bridge-client';
import { embed_consulta } from './embed_consulta';
import { buscar } from './buscar';
import { generateRagSuggestion, buildRagPrompt } from './prompt_gpt';
import { avaliar_sugestao_rag, type AvaliarSugestaoFn } from './avaliar_sugestao_rag';
import { logRagExperimentEvent } from './experiment_logger';

export interface OrquestradorConsultaOptions {
  messages: CapturedMessage[];
  k: number;
  bridge: MettriBridgeClient;
  index: VectorIndex;
  embedConsultaFn?: typeof embed_consulta;
  buscarFn?: typeof buscar;
  promptFn?: PromptGptFn;
  avaliarFn?: AvaliarSugestaoFn;
}

export interface RagConsultaDebugInfo {
  conversationText: string;
  currentConversation: string;
  similarResults: VectorIndexQueryResult[];
  promptSystem: string;
  promptUser: string;
  timingsMs: {
    embed: number;
    search: number;
    prompt: number;
  };
  suggestionOriginal: string;
  evaluation?: {
    scoreRelevance: number;
    scoreFaithfulness: number;
    scoreStyle: number;
    mode: 'llm';
    notes?: string;
  };
  baselineNoRag?: {
    suggestion: string;
    evaluation: {
      scoreRelevance: number;
      scoreFaithfulness: number;
      scoreStyle: number;
      mode: 'llm';
      notes?: string;
    };
  };
}

export interface OrquestradorConsultaResult {
  suggestion: string;
  chunks: ConversationChunk[];
  debugInfo: RagConsultaDebugInfo;
}

export type PromptGptFn = (
  currentConversation: string,
  chunks: ConversationChunk[],
  bridge: MettriBridgeClient,
) => Promise<string>;

interface ConversationTextResult {
  conversationText: string;
  currentConversation: string;
}

function normalizeTextValue(value: unknown): string {
  if (typeof value === 'string') return value;
  return String(value ?? '');
}

function isReadableText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const longBase64LikeRun = /[A-Za-z0-9+/=]{40,}/.test(trimmed);
  if (longBase64LikeRun) return false;

  return true;
}

function montarConversationText(messages: CapturedMessage[]): ConversationTextResult {
  if (!messages.length) {
    throw new Error(
      'Lista de mensagens vazia em orquestrador_consulta_rag; não é possível montar conversationText.',
    );
  }

  const filtered = messages.filter((message) => {
    if (message.type !== 'text') return false;
    const text = normalizeTextValue(message.text);
    return isReadableText(text);
  });

  if (!filtered.length) {
    throw new Error(
      'Não há mensagens de texto válidas para montar a conversa da consulta RAG.',
    );
  }

  let lastClientIndex = -1;
  for (let i = filtered.length - 1; i >= 0; i -= 1) {
    if (!filtered[i].isOutgoing) {
      lastClientIndex = i;
      break;
    }
  }

  if (lastClientIndex === -1) {
    throw new Error(
      'Não há turno do cliente na conversa atual para consulta RAG.',
    );
  }

  const clientTurnMessages: CapturedMessage[] = [];
  let cursor = lastClientIndex;
  while (cursor >= 0 && !filtered[cursor].isOutgoing) {
    clientTurnMessages.unshift(filtered[cursor]);
    cursor -= 1;
  }

  const agentTurnMessages: CapturedMessage[] = [];
  let agentCursor = cursor;
  while (agentCursor >= 0 && filtered[agentCursor].isOutgoing) {
    agentTurnMessages.unshift(filtered[agentCursor]);
    agentCursor -= 1;
  }

  const clientText = clientTurnMessages
    .map((m) => normalizeTextValue(m.text).trim())
    .join(' ');
  const agentText = agentTurnMessages
    .map((m) => normalizeTextValue(m.text).trim())
    .join(' ');

  const lines: string[] = [];
  lines.push(`Cliente: ${clientText}`);
  if (agentTurnMessages.length > 0) {
    lines.push(`Atendente: ${agentText}`);
  }

  const conversationText = lines.join('\n');

  const currentConversation = filtered
    .map((m) => {
      const text = normalizeTextValue(m.text).trim();
      return `${m.isOutgoing ? 'Atendente' : 'Cliente'}: ${text}`;
    })
    .join('\n');

  return {
    conversationText,
    currentConversation,
  };
}

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export async function orquestrador_consulta_rag(
  options: OrquestradorConsultaOptions,
): Promise<OrquestradorConsultaResult> {
  const { messages, k, bridge, index, embedConsultaFn, buscarFn, promptFn, avaliarFn } = options;

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error(
      'messages não pode ser vazio em orquestrador_consulta_rag.',
    );
  }

  if (!Number.isInteger(k) || k < 1) {
    throw new Error(
      'k deve ser um inteiro maior ou igual a 1 em orquestrador_consulta_rag.',
    );
  }

  const { conversationText, currentConversation } = montarConversationText(messages);

  const embedFn = embedConsultaFn ?? embed_consulta;
  const buscarFunction = buscarFn ?? buscar;
  const promptFunction = promptFn ?? generateRagSuggestion;
  const avaliarFunction = avaliarFn ?? avaliar_sugestao_rag;

  const timings = {
    embed: 0,
    search: 0,
    prompt: 0,
  };

  const tEmbedStart = nowMs();
  const queryVector = await embedFn(conversationText, bridge);
  const tEmbedEnd = nowMs();
  timings.embed = Math.max(0, Math.round(tEmbedEnd - tEmbedStart));

  const messageIdSet = new Set<string>(
    messages
      .map((m) => String(m.id || '').trim())
      .filter((id) => id.length > 0),
  );

  const tSearchStart = nowMs();
  const rawResults = await buscarFunction(queryVector, k, index);
  const tSearchEnd = nowMs();
  timings.search = Math.max(0, Math.round(tSearchEnd - tSearchStart));

  const results = rawResults.filter((result) => {
    const chunkIds = result.chunk.messageIds ?? [];
    return !chunkIds.some((id) => messageIdSet.has(String(id || '').trim()));
  });

  const chunks = results.map((result) => result.chunk);

  const tPromptStart = nowMs();
  const suggestion = await promptFunction(currentConversation, chunks, bridge);
  const tPromptEnd = nowMs();
  timings.prompt = Math.max(0, Math.round(tPromptEnd - tPromptStart));

  const { system: promptSystem, user: promptUser } = buildRagPrompt(currentConversation, chunks);

  const evaluation = await avaliarFunction(currentConversation, chunks, suggestion, bridge);

  const baselineSuggestion = await promptFunction(currentConversation, [], bridge);
  const baselineEvaluation = await avaliarFunction(currentConversation, [], baselineSuggestion, bridge);

  const chatId = String(messages[0]?.chatId || '').trim();
  const messageId = String(messages[messages.length - 1]?.id || '').trim() || undefined;

  void logRagExperimentEvent({
    bridge,
    chatId,
    messageId,
    currentConversation,
    chunks,
    k,
    ragSuggestion: suggestion,
    ragEvaluation: evaluation,
    baselineSuggestion,
    baselineEvaluation,
    model: 'gpt-4o-mini',
    ragPromptVersion: 'v1',
    judgePromptVersion: 'v1',
    indexVersion: 'v1',
  });

  const debugInfo: RagConsultaDebugInfo = {
    conversationText,
    currentConversation,
    similarResults: results,
    promptSystem,
    promptUser,
    timingsMs: timings,
    suggestionOriginal: suggestion,
    evaluation,
    baselineNoRag: {
      suggestion: baselineSuggestion,
      evaluation: baselineEvaluation,
    },
  };

  return {
    suggestion,
    chunks,
    debugInfo,
  };
}

