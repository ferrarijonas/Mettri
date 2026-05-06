/**
 * Monta contexto mínimo por chat (Cliente: / Atendente:) a partir do messageDB.
 * ZenSpec: ZenSpecKit/Mettri/Specs/retomar/retomar-context-resolver.zenspec.md
 */

import type { CapturedMessage, RetomarMeta } from '../../../types/schemas';
import type { MessageDB } from '../../../storage/message-db';

const BASE64ISH = /[A-Za-z0-9+/=]{40,}/;

const CONVERSATION_THREAD_MAX = 20;

export interface RetomarResolvedContext {
  chatId: string;
  chatName: string;
  contextText: string;
  clientText: string;
  attendantText?: string;
  /** Até 20 mensagens de texto legíveis, mais recentes primeiro no DB; aqui em ordem cronológica. */
  conversationThread: string;
}

function isLegibleText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (BASE64ISH.test(t)) return false;
  return true;
}

function getRetomarMeta(msg: CapturedMessage): RetomarMeta | undefined {
  return (msg as CapturedMessage & { retomarMeta?: RetomarMeta }).retomarMeta;
}

/**
 * Últimas mensagens de texto legíveis (no máx. 20), do mais recente ao mais antigo no array de entrada,
 * formatadas em ordem cronológica: `[cliente]` / `[padaria]`.
 */
export function buildConversationThread(messages: CapturedMessage[]): string {
  const legible = messages.filter(m => m.type === 'text' && isLegibleText(m.text));
  const recent = legible.slice(0, CONVERSATION_THREAD_MAX);
  const chronological = [...recent].reverse();
  return chronological
    .map(m => {
      const role = m.isOutgoing ? 'padaria' : 'cliente';
      return `[${role}] ${m.text.trim()}`;
    })
    .join('\n');
}

/**
 * Para um chatId, escolhe a última mensagem de cliente elegível e a última de retomar enviada (mesma conta).
 */
export async function resolveRetomarContextForChat(
  messageDB: Pick<MessageDB, 'getMessages'>,
  chatId: string,
  accountId: string,
): Promise<RetomarResolvedContext | null> {
  const messages = await messageDB.getMessages(chatId, 500);
  if (messages.length === 0) return null;

  const chatName = messages[0]?.chatName ?? chatId;

  let clientText: string | null = null;
  let attendantText: string | undefined;

  for (const m of messages) {
    if (
      clientText === null &&
      m.isOutgoing === false &&
      m.type === 'text' &&
      isLegibleText(m.text)
    ) {
      clientText = m.text.trim();
    }

    const rm = getRetomarMeta(m);
    if (
      attendantText === undefined &&
      m.isOutgoing === true &&
      m.type === 'text' &&
      rm &&
      rm.accountId === accountId &&
      isLegibleText(m.text)
    ) {
      attendantText = m.text.trim();
    }

    if (clientText !== null && attendantText !== undefined) break;
  }

  if (clientText === null) return null;

  let contextText = `Cliente: ${clientText}`;
  if (attendantText !== undefined) {
    contextText += `\nAtendente: ${attendantText}`;
  }

  const conversationThread = buildConversationThread(messages);

  return {
    chatId,
    chatName,
    contextText,
    clientText,
    conversationThread,
    ...(attendantText !== undefined ? { attendantText } : {}),
  };
}

/**
 * Lista de chatIds → contextos (exclui chats sem mensagem de cliente legível). Preserva ordem de entrada.
 */
export async function retomarContextResolver(params: {
  chatIds: string[];
  accountId: string;
  messageDB: Pick<MessageDB, 'getMessages'>;
}): Promise<RetomarResolvedContext[]> {
  const { chatIds, accountId, messageDB } = params;
  if (!Array.isArray(chatIds)) {
    throw new Error('Erro de parâmetro: chatIds deve ser um array');
  }
  if (typeof accountId !== 'string' || !accountId.trim()) {
    throw new Error('Erro de parâmetro: accountId inválido');
  }
  for (const id of chatIds) {
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error('Erro de parâmetro: chatId vazio na lista');
    }
  }

  if (chatIds.length === 0) return [];

  const out: RetomarResolvedContext[] = [];
  for (const chatId of chatIds) {
    try {
      const ctx = await resolveRetomarContextForChat(messageDB, chatId, accountId);
      if (ctx) out.push(ctx);
    } catch (e) {
      throw new Error(
        `Erro ao acessar messageDB: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  return out;
}
