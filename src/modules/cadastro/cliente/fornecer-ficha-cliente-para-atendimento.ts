import { clientDB, type ClientRecord } from '../../../storage/client-db';
import {
  customerProfileDB,
  type CustomerOperationalProfile,
} from '../../../storage/customer-profile-db';
import { purchaseDB, type ManualPurchaseRecord } from '../../../storage/purchase-db';
import { type CadastroClienteResult, type FichaClienteAtendimento, type PurchaseSummary } from './types';

export interface FornecerFichaClienteParaAtendimentoDeps {
  getClientByChatId(chatId: string): Promise<ClientRecord | null>;
  getLastPurchaseByChatId(chatId: string): Promise<ManualPurchaseRecord | null>;
  getOperationalProfile(chatId: string): Promise<CustomerOperationalProfile | null | { confiancaPerfil?: number }>;
}

export interface FornecerFichaClienteOptions {
  allowPartialOnError?: boolean;
}

const defaultDeps: FornecerFichaClienteParaAtendimentoDeps = {
  getClientByChatId: chatId => clientDB.getByWhatsAppChatId(chatId),
  getLastPurchaseByChatId: chatId => purchaseDB.getLastActiveByChatId(chatId),
  getOperationalProfile: chatId => customerProfileDB.getByChatId(chatId),
};

function normalizeText(value: string): string {
  return String(value || '').trim();
}

function toPurchaseSummary(record: ManualPurchaseRecord | null): PurchaseSummary | null {
  if (!record) return null;
  return {
    purchaseId: record.purchaseId,
    purchaseDateIso: record.purchaseDateIso,
    value: record.value,
    items: record.items,
    notes: record.notes,
    source: record.source,
  };
}

function hasUsefulCadastro(cadastro: ClientRecord | null): boolean {
  if (!cadastro) return false;
  return Boolean(
    normalizeText(cadastro.fullName ?? '') ||
      normalizeText(cadastro.firstName ?? '') ||
      normalizeText(cadastro.nickname ?? '') ||
      normalizeText(cadastro.phoneDigits ?? '') ||
      normalizeText(cadastro.addressFreeform ?? '') ||
      normalizeText(cadastro.address ?? '')
  );
}

export async function fornecerFichaClienteParaAtendimento(
  chatIdInput: string,
  deps: FornecerFichaClienteParaAtendimentoDeps = defaultDeps,
  options?: FornecerFichaClienteOptions,
): Promise<CadastroClienteResult<FichaClienteAtendimento>> {
  const chatId = normalizeText(chatIdInput);
  if (!chatId) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'chatId é obrigatório.' };
  }

  const allowPartial = options?.allowPartialOnError === true;
  const partial: FichaClienteAtendimento = {
    chatId,
    isGroup: chatId.endsWith('@g.us'),
    phoneDigits: chatId.endsWith('@c.us') ? chatId.replace('@c.us', '') : null,
    cadastro: null,
    ultimaCompra: null,
    perfilOperacional: null,
    flags: { cadastroUtil: false },
  };

  try {
    const cadastro = await deps.getClientByChatId(chatId);
    partial.cadastro = cadastro;
    partial.flags.cadastroUtil = hasUsefulCadastro(cadastro);

    try {
      partial.ultimaCompra = toPurchaseSummary(await deps.getLastPurchaseByChatId(chatId));
    } catch (error) {
      if (!allowPartial) throw error;
    }

    try {
      const profile = await deps.getOperationalProfile(chatId);
      partial.perfilOperacional = profile && 'chatId' in profile ? profile : null;
    } catch (error) {
      if (!allowPartial) throw error;
    }

    const ficha: FichaClienteAtendimento = {
      chatId,
      isGroup: partial.isGroup,
      phoneDigits: partial.phoneDigits,
      cadastro: partial.cadastro,
      ultimaCompra: partial.ultimaCompra,
      perfilOperacional: partial.perfilOperacional,
      flags: { cadastroUtil: partial.flags.cadastroUtil },
    };

    return { ok: true, data: ficha };
  } catch (error) {
    if (allowPartial) {
      return { ok: true, data: partial };
    }
    return {
      ok: false,
      errorCode: 'STORE_ERROR',
      message: error instanceof Error ? error.message : 'Falha ao fornecer ficha de atendimento.',
    };
  }
}
