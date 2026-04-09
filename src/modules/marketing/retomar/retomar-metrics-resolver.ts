/**
 * Agrega métricas de resposta ao Retomar (envios vs primeira incoming por envio).
 * ZenSpec: ZenSpecKit/Mettri/Specs/retomar/calcular-metricas-retomar.zenspec.md
 */

import type { CapturedMessage, MessageDBEntry, RetomarMeta } from '../../../types/schemas';
import type { MessageDB } from '../../../storage/message-db';

export type RetomarMetricsMessageDB = Pick<
  MessageDB,
  'getRetomarSends' | 'getMessagesByDateRange'
>;

export type RetomarMetricsResult = {
  sentCount: number;
  respondedCount: number;
  responseRate: number;
  avgResponseTimeMinutes: number | null;
};

function assertValidTimestamp(d: Date, context: string): void {
  const t = d.getTime();
  if (!Number.isFinite(t)) {
    throw new Error(`Timestamp inválido (${context})`);
  }
}

/** R2: timestamp crescente; empate por id lexicográfico crescente. */
export function sortMessagesR2(messages: CapturedMessage[]): CapturedMessage[] {
  const copy = [...messages];
  for (const m of copy) {
    assertValidTimestamp(m.timestamp, `mensagem ${m.id}`);
  }
  copy.sort((a, b) => {
    const ta = a.timestamp.getTime();
    const tb = b.timestamp.getTime();
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });
  return copy;
}

function entrySendTime(entry: MessageDBEntry): Date {
  const d = new Date(entry.timestamp);
  assertValidTimestamp(d, `envio ${entry.id}`);
  return d;
}

function getRetomarMeta(msg: CapturedMessage): RetomarMeta | undefined {
  return (msg as CapturedMessage & { retomarMeta?: RetomarMeta }).retomarMeta;
}

/** Outro envio Retomar da mesma conta entre este envio e a resposta “corta” a atribuição (ZenSpec: dois envios, uma resposta só após o segundo). */
function isOutgoingRetomarFromAccount(m: CapturedMessage, accountId: string): boolean {
  if (!m.isOutgoing) return false;
  const rm = getRetomarMeta(m);
  return !!(rm && rm.accountId === accountId);
}

/**
 * Primeira incoming após o envio Retomar (timeline já ordenada por R2).
 * Mesma regra de atribuição usada em {@link retomarMetricsResolver}.
 */
export function findFirstRetomarReplyIncoming(params: {
  timeline: CapturedMessage[];
  sendMessageId: string;
  accountId: string;
}): CapturedMessage | undefined {
  const { timeline, sendMessageId, accountId } = params;
  const idx = timeline.findIndex(m => m.id === sendMessageId);
  if (idx === -1) {
    throw new Error(
      `Envio Retomar ${sendMessageId} não encontrado na linha do tempo do chat`,
    );
  }
  for (let j = idx + 1; j < timeline.length; j++) {
    const m = timeline[j];
    if (m.isOutgoing !== false) continue;
    let blocked = false;
    for (let k = idx + 1; k < j; k++) {
      if (isOutgoingRetomarFromAccount(timeline[k], accountId)) {
        blocked = true;
        break;
      }
    }
    if (!blocked) {
      return m;
    }
  }
  return undefined;
}

/**
 * Calcula contagens e taxas de resposta para envios Retomar num intervalo.
 */
export async function retomarMetricsResolver(params: {
  accountId: string;
  since: Date;
  until: Date;
  cycleIndex?: number;
  variant?: 'A' | 'B';
  messageDB: RetomarMetricsMessageDB;
}): Promise<RetomarMetricsResult> {
  const { accountId, since, until, cycleIndex, variant, messageDB } = params;

  if (!(since instanceof Date) || !(until instanceof Date)) {
    throw new Error('Erro de parâmetro: since e until devem ser Date');
  }
  if (since.getTime() > until.getTime()) {
    throw new Error('Erro de parâmetro: since não pode ser posterior a until');
  }
  if (cycleIndex !== undefined) {
    if (!Number.isInteger(cycleIndex) || cycleIndex < 1 || cycleIndex > 4) {
      throw new Error('Erro de parâmetro: cycleIndex deve estar entre 1 e 4');
    }
  }
  if (typeof accountId !== 'string' || !accountId.trim()) {
    throw new Error('Erro de parâmetro: accountId inválido');
  }

  const sends = await messageDB.getRetomarSends(accountId, {
    since,
    until,
    ...(cycleIndex !== undefined ? { cycleIndex } : {}),
    ...(variant !== undefined ? { variant } : {}),
  });

  const sentCount = sends.length;
  if (sentCount === 0) {
    return {
      sentCount: 0,
      respondedCount: 0,
      responseRate: 0,
      avgResponseTimeMinutes: null,
    };
  }

  const chatIds = [...new Set(sends.map(s => s.chatId))];
  const sortedByChat = new Map<string, CapturedMessage[]>();

  for (const chatId of chatIds) {
    const raw = await messageDB.getMessagesByDateRange(since, until, chatId);
    sortedByChat.set(chatId, sortMessagesR2(raw));
  }

  let respondedCount = 0;
  const deltasMinutes: number[] = [];

  for (const send of sends) {
    const timeline = sortedByChat.get(send.chatId);
    if (!timeline || timeline.length === 0) {
      throw new Error(
        `Envio Retomar ${send.id}: linha do tempo vazia para o chat ${send.chatId}`,
      );
    }
    const tSend = entrySendTime(send).getTime();
    const firstIncoming = findFirstRetomarReplyIncoming({
      timeline,
      sendMessageId: send.id,
      accountId,
    });
    if (firstIncoming) {
      respondedCount++;
      const tIn = firstIncoming.timestamp.getTime();
      deltasMinutes.push((tIn - tSend) / 60000);
    }
  }

  const responseRate = (respondedCount / sentCount) * 100;
  const avgResponseTimeMinutes =
    respondedCount === 0
      ? null
      : deltasMinutes.reduce((a, b) => a + b, 0) / deltasMinutes.length;

  return {
    sentCount,
    respondedCount,
    responseRate,
    avgResponseTimeMinutes,
  };
}
