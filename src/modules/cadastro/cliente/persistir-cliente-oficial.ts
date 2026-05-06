import { clientDB, type ClientRecord } from '../../../storage/client-db';
import { type CadastroClienteResult } from './types';

export interface PersistirClienteOficialInput {
  chatId: string;
  recordPatch: Partial<ClientRecord>;
}

export interface PersistirClienteOficialDeps {
  getByChatId(chatId: string): Promise<ClientRecord | null>;
  upsert(record: ClientRecord): Promise<void>;
  clock: { nowIso(): string };
}

const defaultDeps: PersistirClienteOficialDeps = {
  getByChatId: chatId => clientDB.getByWhatsAppChatId(chatId),
  upsert: record => clientDB.upsert(record),
  clock: { nowIso: () => new Date().toISOString() },
};

function normalizeText(value: string): string {
  return String(value || '').trim();
}

function makeClientKey(chatId: string): string {
  return `chat_${chatId}`;
}

export async function persistirClienteOficial(
  input: PersistirClienteOficialInput,
  deps: PersistirClienteOficialDeps = defaultDeps
): Promise<CadastroClienteResult<{ chatId: string; clientKey: string }>> {
  const chatId = normalizeText(input.chatId);
  if (!chatId) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'chatId é obrigatório.' };
  }

  if (!input.recordPatch || typeof input.recordPatch !== 'object') {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'recordPatch inválido.' };
  }

  try {
    const current = await deps.getByChatId(chatId);
    const nowIso = deps.clock.nowIso();

    const record: ClientRecord = {
      ...(current ?? {
        clientKey: makeClientKey(chatId),
        updatedAtIso: nowIso,
      }),
      ...input.recordPatch,
      clientKey: normalizeText(input.recordPatch.clientKey ?? current?.clientKey ?? makeClientKey(chatId)),
      whatsAppChatId: chatId,
      updatedAtIso: nowIso,
    };

    if (!record.clientKey) {
      return { ok: false, errorCode: 'INVALID_INPUT', message: 'clientKey inválido após merge.' };
    }

    await deps.upsert(record);

    return {
      ok: true,
      data: {
        chatId,
        clientKey: record.clientKey,
      },
    };
  } catch (error) {
    return {
      ok: false,
      errorCode: 'STORE_ERROR',
      message: error instanceof Error ? error.message : 'Falha ao persistir cadastro oficial.',
    };
  }
}
