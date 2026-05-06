import type { CapturedMessage } from '../../types';

export interface ConversationTurnSize {
  client: number;
  agent: number;
}

export interface ConversationChunk {
  id: string;
  schemaVersion: string;
  content: string;
  chatId: string;
  timestamp: string;
  messageIds: string[];
  turnSize: ConversationTurnSize;
}

const CONVERSATION_CHUNK_SCHEMA_VERSION = '1.0';

function normalizeTextValue(value: unknown): string {
  if (typeof value === 'string') return value;
  return String(value ?? '');
}

function isReadableText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  // Heurística simples para payload técnico (ex.: base64 longo, hashes):
  // se existir um trecho contínuo muito longo apenas com A-Z, a-z, 0-9, +, /, =
  // é provavelmente conteúdo binário codificado, não texto humano.
  const longBase64LikeRun = /[A-Za-z0-9+/=]{40,}/.test(trimmed);
  if (longBase64LikeRun) return false;

  return true;
}

export function agrupar_por_turno(messages: CapturedMessage[]): ConversationChunk[] {
  if (!messages.length) {
    return [];
  }

  const filtered = messages.filter((message) => {
    if (message.type !== 'text') return false;
    const text = normalizeTextValue(message.text);
    return isReadableText(text);
  });

  if (!filtered.length) {
    return [];
  }

  const chunks: ConversationChunk[] = [];

  let index = 0;

  while (index < filtered.length && filtered[index].isOutgoing) {
    index += 1;
  }

  while (index < filtered.length) {
    if (filtered[index].isOutgoing) {
      index += 1;
      continue;
    }

    const clientTurnMessages: CapturedMessage[] = [];
    while (index < filtered.length && !filtered[index].isOutgoing) {
      clientTurnMessages.push(filtered[index]);
      index += 1;
    }

    const agentTurnMessages: CapturedMessage[] = [];
    while (index < filtered.length && filtered[index].isOutgoing) {
      agentTurnMessages.push(filtered[index]);
      index += 1;
    }

    if (!agentTurnMessages.length) {
      break;
    }

    const firstClientMessage = clientTurnMessages[0];
    const chatId = firstClientMessage.chatId;
    const timestampIso = firstClientMessage.timestamp.toISOString();

    const messageIds = [...clientTurnMessages, ...agentTurnMessages].map(
      (message) => message.id,
    );

    const clientText = clientTurnMessages
      .map((message) => normalizeTextValue(message.text).trim())
      .join(' ');
    const agentText = agentTurnMessages
      .map((message) => normalizeTextValue(message.text).trim())
      .join(' ');

    const chunk: ConversationChunk = {
      id: `${chatId}_${timestampIso}`,
      schemaVersion: CONVERSATION_CHUNK_SCHEMA_VERSION,
      content: `Cliente: ${clientText}\nAtendente: ${agentText}`,
      chatId,
      timestamp: timestampIso,
      messageIds,
      turnSize: {
        client: clientTurnMessages.length,
        agent: agentTurnMessages.length,
      },
    };

    chunks.push(chunk);
  }

  return chunks;
}

