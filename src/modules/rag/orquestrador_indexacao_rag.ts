import type { CapturedMessage } from '../../types';
import { MettriBridgeClient } from '../../content/bridge-client';
import type { MessageDB } from '../../storage/message-db';
import { fonte } from './fonte';
import { agrupar_por_turno } from './agrupar_por_turno';
import { embed_index } from './embed_index';
import { guardar } from './guardar';
import type { VectorIndex } from './vectorIndex';

export interface OrquestradorIndexacaoOptions {
  chatId?: string;
  maxMessages?: number;
  /**
   * Backend de mensagens. Opcional e usado principalmente para testes.
   * Se não for fornecido, o `fonte` usa o `messageDB` padrão.
   */
  db?: MessageDB;
  /**
   * Cliente de bridge para chamadas de embedding.
   */
  bridge: MettriBridgeClient;
  /**
   * Backend de índice vetorial onde os embeddings serão gravados.
   */
  index: VectorIndex;
}

async function indexarChat(
  messages: CapturedMessage[],
  options: { bridge: MettriBridgeClient; index: VectorIndex },
): Promise<void> {
  const chunks = agrupar_por_turno(messages);

  if (!chunks.length) {
    return;
  }

  const items = await embed_index(chunks, options.bridge);
  await guardar(items, options.index);
}

export async function orquestrador_indexacao_rag(
  options: OrquestradorIndexacaoOptions,
): Promise<void> {
  const { chatId, maxMessages, db, bridge, index } = options;

  // Caso 1: indexar apenas um chat específico
  if (chatId) {
    const messages = await fonte({ chatId, maxMessages, db });

    if (!messages.length) {
      // Chat sem mensagens → nada para indexar, conclui com sucesso.
      return;
    }

    await indexarChat(messages, { bridge, index });
    return;
  }

  // Caso 2: indexar todos os chats disponíveis
  const messages = await fonte({ chatId: undefined, maxMessages, db });

  if (!messages.length) {
    // MessageDB vazio → nada para indexar, conclui com sucesso.
    return;
  }

  // Agrupa por chatId preservando a ordem cronológica dentro de cada chat.
  const messagesByChat = new Map<string, CapturedMessage[]>();

  for (const message of messages) {
    const list = messagesByChat.get(message.chatId);
    if (list) {
      list.push(message);
    } else {
      messagesByChat.set(message.chatId, [message]);
    }
  }

  for (const chatMessages of messagesByChat.values()) {
    if (!chatMessages.length) {
      continue;
    }

    await indexarChat(chatMessages, { bridge, index });
  }
}

