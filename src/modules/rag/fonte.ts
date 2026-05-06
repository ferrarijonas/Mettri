import type { CapturedMessage } from '../../types';
import type { MessageDB } from '../../storage/message-db';
import { messageDB } from '../../storage/message-db';

const RAG_FONTE_MAX_MESSAGES = 50_000;

export interface FonteOptions {
  chatId?: string;
  db?: MessageDB;
  maxMessages?: number;
}

/**
 * Fonte do pipeline RAG: lê mensagens do MessageDB e entrega em ordem cronológica ascendente.
 */
export async function fonte(options?: FonteOptions): Promise<CapturedMessage[]> {
  const db = options?.db ?? messageDB;
  const maxMessages = options?.maxMessages ?? RAG_FONTE_MAX_MESSAGES;
  const messages = await db.getMessages(options?.chatId, maxMessages);
  messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return messages;
}
