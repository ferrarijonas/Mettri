/**
 * Exporta outcomes Retomar respondidos para JSONL append-only por conta.
 * ZenSpec: ZenSpecKit/Mettri/Specs/retomar/exportar-outcomes-retomar.zenspec.md
 */

import type { CapturedMessage, MessageDBEntry } from '../../../types/schemas';
import { dbEntryToMessage } from '../../../types/schemas';
import {
  findFirstRetomarReplyIncoming,
  sortMessagesR2,
  type RetomarMetricsMessageDB,
} from './retomar-metrics-resolver';

export type { RetomarMetricsMessageDB };

export interface RetomarOutcomeExportState {
  /** IDs de mensagens de envio Retomar já exportadas (idempotência). */
  exportedSendMessageIds: string[];
}

export interface RetomarOutcomeExporterWriter {
  append(filePath: string, text: string): Promise<void>;
}

export interface RetomarOutcomeExporterStateStore {
  get(accountId: string): Promise<RetomarOutcomeExportState>;
  set(accountId: string, state: RetomarOutcomeExportState): Promise<void>;
}

export interface RetomarOutcomeExporterParams {
  accountId: string;
  since: Date;
  until: Date;
  maxTextLength?: number;
  messageDB: RetomarMetricsMessageDB;
  writer: RetomarOutcomeExporterWriter;
  exportStateStore: RetomarOutcomeExporterStateStore;
  /** Instante usado em exportedAt e lastExportedAt (testes). */
  now?: Date;
}

export interface RetomarOutcomeExporterResult {
  exportedCount: number;
  skippedCount: number;
  lastExportedAt: Date;
  filePath: string;
}

export interface RetomarOutcomeJsonlLine {
  eventId: string;
  accountId: string;
  chatId: string;
  chatName: string | null;
  phoneDigits: string | null;
  sendMessageId: string;
  replyMessageId: string;
  cycleIndex: number;
  variant: 'A' | 'B';
  campaignLabel: string | null;
  sentAt: string;
  replyAt: string;
  responseLagMinutes: number;
  sendText: string;
  replyText: string;
  exportedAt: string;
}

const DEFAULT_MAX_TEXT = 500;

export function retomarOutcomesFilePath(accountId: string): string {
  return `retomar-outcomes-${accountId}.jsonl`;
}

function assertNonEmptyAccountId(accountId: string): void {
  if (typeof accountId !== 'string' || !accountId.trim()) {
    throw new Error('Erro de parâmetro: accountId inválido');
  }
}

/** Trunca por pontos de código Unicode (evita cortar surrogate pairs ao meio). */
export function truncateOutcomeText(text: string, maxLength: number): string {
  if (maxLength <= 0) return '';
  if (text.length <= maxLength) return text;
  return [...text].slice(0, maxLength).join('');
}

export function phoneDigitsFromChatId(chatId: string): string | null {
  const m = /^(\d+)@/.exec(chatId);
  return m ? m[1] : null;
}

function eventIdFor(accountId: string, sendMessageId: string): string {
  return `retomar-outcome::${accountId}::${sendMessageId}`;
}

function sendTimestampMs(entry: MessageDBEntry): number {
  const d = new Date(entry.timestamp);
  const t = d.getTime();
  if (!Number.isFinite(t)) {
    throw new Error(`Timestamp inválido no envio ${entry.id}`);
  }
  return t;
}

/**
 * Lista envios Retomar com resposta válida, monta linhas JSONL novas e faz append;
 * só persiste estado após escrita bem-sucedida.
 */
export async function retomarOutcomeExporter(
  params: RetomarOutcomeExporterParams,
): Promise<RetomarOutcomeExporterResult> {
  const {
    accountId,
    since,
    until,
    messageDB,
    writer,
    exportStateStore,
    now: nowParam,
  } = params;
  const maxTextLength = params.maxTextLength ?? DEFAULT_MAX_TEXT;

  assertNonEmptyAccountId(accountId);

  if (!(since instanceof Date) || !(until instanceof Date)) {
    throw new Error('Erro de parâmetro: since e until devem ser Date');
  }
  if (since.getTime() > until.getTime()) {
    throw new Error('Erro de parâmetro: since não pode ser posterior a until');
  }
  if (!Number.isFinite(maxTextLength) || maxTextLength < 0) {
    throw new Error('Erro de parâmetro: maxTextLength inválido');
  }

  const now = nowParam ?? new Date();
  const filePath = retomarOutcomesFilePath(accountId);

  const { exportedSendMessageIds = [] } = await exportStateStore.get(accountId);
  const already = new Set(exportedSendMessageIds);

  const sends = await messageDB.getRetomarSends(accountId, { since, until });

  let skippedCount = 0;
  if (sends.length === 0) {
    return { exportedCount: 0, skippedCount: 0, lastExportedAt: now, filePath };
  }

  const chatIds = [...new Set(sends.map(s => s.chatId))];
  const sortedByChat = new Map<string, CapturedMessage[]>();
  for (const chatId of chatIds) {
    const raw = await messageDB.getMessagesByDateRange(since, until, chatId);
    sortedByChat.set(chatId, sortMessagesR2(raw));
  }

  const newLines: RetomarOutcomeJsonlLine[] = [];
  const newSendIds: string[] = [];

  for (const send of sends) {
    if (already.has(send.id)) {
      skippedCount++;
      continue;
    }

    const rm = send.retomarMeta;
    if (!rm) continue;

    const timeline = sortedByChat.get(send.chatId);
    if (!timeline || timeline.length === 0) {
      throw new Error(
        `Erro ao ler messageDB: linha do tempo vazia para o chat ${send.chatId} (envio ${send.id})`,
      );
    }

    const reply = findFirstRetomarReplyIncoming({
      timeline,
      sendMessageId: send.id,
      accountId,
    });

    if (!reply) continue;

    const tSend = sendTimestampMs(send);
    const tReply = reply.timestamp.getTime();
    if (!Number.isFinite(tReply)) {
      throw new Error(`Timestamp inválido na resposta ${reply.id}`);
    }
    const responseLagMinutes = (tReply - tSend) / 60000;

    const sendMsg = dbEntryToMessage(send);
    newLines.push({
      eventId: eventIdFor(accountId, send.id),
      accountId,
      chatId: send.chatId,
      chatName: send.chatName?.trim() ? send.chatName : null,
      phoneDigits: phoneDigitsFromChatId(send.chatId),
      sendMessageId: send.id,
      replyMessageId: reply.id,
      cycleIndex: rm.cycleIndex,
      variant: rm.variant,
      campaignLabel: rm.campaignLabel ?? null,
      sentAt: new Date(tSend).toISOString(),
      replyAt: new Date(tReply).toISOString(),
      responseLagMinutes,
      sendText: truncateOutcomeText(sendMsg.text ?? '', maxTextLength),
      replyText: truncateOutcomeText(reply.text ?? '', maxTextLength),
      exportedAt: now.toISOString(),
    });
    newSendIds.push(send.id);
  }

  if (newLines.length === 0) {
    return { exportedCount: 0, skippedCount, lastExportedAt: now, filePath };
  }

  const chunk = newLines.map(l => JSON.stringify(l)).join('\n') + '\n';

  try {
    await writer.append(filePath, chunk);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Falha ao escrever arquivo de export: ${msg}`);
  }

  await exportStateStore.set(accountId, {
    exportedSendMessageIds: [...exportedSendMessageIds, ...newSendIds],
  });

  return {
    exportedCount: newLines.length,
    skippedCount,
    lastExportedAt: now,
    filePath,
  };
}
