/**
 * Orquestra RAG automático e estado compartilhado de sugestão (Mettri carregado),
 * independentemente do módulo Atendimento estar montado.
 */

import type { EventBus } from '../../ui/core/event-bus';
import type { CapturedMessage } from '../../types';
import { MettriBridgeClient } from '../../content/bridge-client';
import { messageDB } from '../../storage/message-db';
import {
  orquestrador_consulta_rag,
  orquestrador_indexacao_rag,
  vectorIndexIDB,
} from '../rag';

const STORAGE_RAG_AUTO_SUGGEST = 'mettri:atendimento:rag:auto-suggest';

const registeredBuses = new WeakSet<EventBus>();

let activeChatId: string | null = null;
let ragIndexPromise: Promise<void> | null = null;
let ragBusyChatId: string | null = null;
let ragRunAgainForChatId: string | null = null;
let ragAutoSuggestEnabled = false;

let ragSuggestionText = '';
let ragSimilarCount: number | null = null;
let ragDebugInfo: unknown = null;
let ragLoading = false;

const listeners = new Set<() => void>();

function notify(): void {
  for (const cb of listeners) {
    try {
      cb();
    } catch (e) {
      console.error('[rag-mettri-controller] listener:', e);
    }
  }
}

export interface RagMettriControllerState {
  ragSuggestionText: string;
  ragSimilarCount: number | null;
  ragDebugInfo: unknown;
  ragLoading: boolean;
}

export function getRagMettriControllerState(): RagMettriControllerState {
  return {
    ragSuggestionText,
    ragSimilarCount,
    ragDebugInfo,
    ragLoading,
  };
}

export function subscribeRagMettriController(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** Evita que um “rodar de novo” do automático interfira no fluxo manual. */
export function clearRagAutoRetryPending(): void {
  ragRunAgainForChatId = null;
}

async function loadRagAutoSuggestFromStorage(): Promise<boolean> {
  try {
    const bridge = new MettriBridgeClient(4000);
    const obj = await bridge.storageGet([STORAGE_RAG_AUTO_SUGGEST]);
    const v = obj[STORAGE_RAG_AUTO_SUGGEST];
    return v === true || v === '1' || v === 1 || v === 'true';
  } catch {
    return false;
  }
}

function isValidInboundClientMessageForRagAuto(msg: CapturedMessage): boolean {
  if (msg.isOutgoing) return false;
  if (msg.type !== 'text') return false;
  const trimmed = String(msg.text ?? '').trim();
  if (!trimmed) return false;
  if (/[A-Za-z0-9+/=]{40,}/.test(trimmed)) return false;
  return true;
}

async function ensureVectorIndexReady(longBridge: MettriBridgeClient): Promise<void> {
  if (ragIndexPromise) {
    await ragIndexPromise;
    return;
  }

  let empty = true;
  try {
    empty = await vectorIndexIDB.isEmpty();
  } catch {
    empty = true;
  }
  if (!empty) return;

  ragIndexPromise = (async () => {
    alert('Preparando histórico de conversas (pode levar 1–2 minutos)...');
    await orquestrador_indexacao_rag({
      bridge: longBridge,
      index: vectorIndexIDB,
      maxMessages: 10_000,
    });
  })();

  try {
    await ragIndexPromise;
  } finally {
    ragIndexPromise = null;
  }
}

export async function runRagMettriConsultation(
  chatId: string,
  source: 'manual' | 'auto',
): Promise<void> {
  const cid = String(chatId || '').trim();
  if (!cid) {
    if (source === 'manual') {
      alert('Abra um chat para gerar sugestão com histórico.');
    }
    ragLoading = false;
    notify();
    return;
  }

  if (ragBusyChatId === cid) {
    if (source === 'auto') {
      ragRunAgainForChatId = cid;
    }
    return;
  }

  const loopAuto = (): boolean => {
    if (source !== 'auto') return false;
    return (
      ragAutoSuggestEnabled &&
      ragRunAgainForChatId === cid &&
      String(activeChatId || '').trim() === cid
    );
  };

  do {
    if (source === 'auto') {
      ragAutoSuggestEnabled = await loadRagAutoSuggestFromStorage();
    }

    if (ragRunAgainForChatId === cid) {
      ragRunAgainForChatId = null;
    }

    ragBusyChatId = cid;
    ragLoading = true;
    notify();

    const capturedChatId = cid;
    try {
      const bridge = new MettriBridgeClient(120_000);
      await ensureVectorIndexReady(bridge);

      const messagesDesc = await messageDB.getMessages(capturedChatId, 200);
      if (!messagesDesc.length) {
        throw new Error('Nenhuma mensagem encontrada para este chat.');
      }
      const messages = [...messagesDesc].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      );

      const { suggestion, chunks, debugInfo } = await orquestrador_consulta_rag({
        messages,
        k: 5,
        bridge,
        index: vectorIndexIDB,
      });

      if (String(activeChatId || '').trim() !== capturedChatId) {
        break;
      }

      ragSuggestionText = suggestion;
      ragSimilarCount = chunks.length;
      ragDebugInfo = debugInfo;
    } catch (error) {
      if (String(activeChatId || '').trim() === capturedChatId) {
        if (source === 'manual') {
          alert(
            error instanceof Error ? error.message : 'Erro ao gerar sugestão com histórico.',
          );
        } else {
          console.error('[rag-mettri-controller] RAG automático:', error);
        }
        ragSimilarCount = null;
      }
    } finally {
      ragLoading = false;
      ragBusyChatId = null;
      notify();
    }
  } while (loopAuto());
}

export function registerRagAutoListeners(eventBus: EventBus): void {
  if (registeredBuses.has(eventBus)) return;
  registeredBuses.add(eventBus);

  eventBus.on('chat:active-changed', (data: { chatId?: unknown }) => {
    const next = typeof data?.chatId === 'string' ? data.chatId : null;
    const prev = activeChatId;
    activeChatId = next;
    if (String(prev || '') !== String(next || '')) {
      ragRunAgainForChatId = null;
      if (!ragBusyChatId) {
        ragSuggestionText = '';
        ragSimilarCount = null;
        ragDebugInfo = null;
      }
    }
  });

  eventBus.on('message:new', (data: { message?: CapturedMessage }) => {
    void (async () => {
      ragAutoSuggestEnabled = await loadRagAutoSuggestFromStorage();
      if (!ragAutoSuggestEnabled) return;
      const msg = data?.message;
      if (!msg || !isValidInboundClientMessageForRagAuto(msg)) return;
      const mid = String(msg.chatId || '').trim();
      if (!mid) return;
      if (mid !== String(activeChatId || '').trim()) return;
      await runRagMettriConsultation(mid, 'auto');
    })();
  });
}
