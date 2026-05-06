import type { ClientRecord } from '../../../storage/client-db';
import { clientDB, digitsOnly, normalizePhoneDigitsWithAliases } from '../../../storage/client-db';

export interface ResolvedClient {
  chatId: string;
  isGroup: boolean;
  phoneDigits: string | null;
  record: ClientRecord | null;
}

function formatPhoneLabel(phoneDigits: string | null): string {
  const digits = digitsOnly(phoneDigits || '');
  if (!digits) return '—';
  // BUGFIX: não mostrar “telefone esquisito” (ex.: final 4776).
  // Metáfora: se tem poucos dígitos, não é telefone, é “código interno”.
  if (digits.length < 10) return '—';

  // BR: remover +55, mostrar só dígitos
  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) {
    return digits.slice(2);
  }

  // Internacional: manter DDI mas sem +
  return digits;
}

export function pickStrongDisplayName(record: ClientRecord | null, fallbackWhatsAppName: string, phoneDigits: string | null): string {
  const first = String(record?.firstName || '').trim();
  const last = String(record?.lastName || '').trim();
  const full = `${first} ${last}`.trim();
  if (full) {
    const low = full.toLowerCase();
    // Metáfora: se tiver número no “nome”, é rabisco, não nome.
    if (!/\d/.test(full) && low !== 'unknown' && low !== 'sem nome') return full;
  }

  // Import tem prioridade sobre apelido do WhatsApp.
  // Metáfora: “caneta” (cadastro/import) vence “lápis” (pushname).
  const imported = String(record?.fullName || '').trim();
  if (imported) {
    const low = imported.toLowerCase();
    if (!/\d/.test(imported) && low !== 'unknown' && low !== 'sem nome') return imported;
  }

  const nick = String(record?.nickname || '').trim();
  if (nick) {
    const low = nick.toLowerCase();
    if (!/\d/.test(nick) && low !== 'unknown' && low !== 'sem nome') return nick;
  }

  const fallback = String(fallbackWhatsAppName || '').trim();
  const stored = String(record?.whatsAppCandidateName || '').trim();
  const wa = (fallback || stored).trim();
  if (wa && wa.toLowerCase() !== 'unknown' && wa.toLowerCase() !== 'sem nome') return wa;

  const digits = digitsOnly(phoneDigits || '');
  if (digits && digits.length >= 10) return `+${digits}`;

  return 'Sem nome';
}

/**
 * Tenta obter dígitos de telefone do objeto Contact quando o chat é @lid.
 * Fallback: Contact pode ter phoneNumber, formattedPhoneNumber ou pn.
 */
export type GetPhoneForLidFn = (chatId: string) => Promise<string | null>;

/**
 * resolveClientByChatId
 *
 * Metáfora: pegar o “crachá” (chatId) e tentar achar o “RG” (ClientDB).
 */
export async function resolveClientByChatId(params: {
  chatId: string;
  fallbackWhatsAppName?: string;
  getPhoneForLid?: GetPhoneForLidFn;
}): Promise<ResolvedClient> {
  const chatId = String(params.chatId || '').trim();
  const isGroup = chatId.endsWith('@g.us') || chatId.includes('@g.us');
  const server = (chatId.split('@')[1] || '').trim();

  if (!chatId) {
    return { chatId: '', isGroup: false, phoneDigits: null, record: null };
  }

  if (isGroup) {
    return { chatId, isGroup: true, phoneDigits: null, record: null };
  }

  // Para @lid, o “antes do @” pode não ser telefone; não confiar.
  const rawBeforeAt = chatId.split('@')[0] || '';
  const normalized = normalizePhoneDigitsWithAliases(rawBeforeAt);
  let phoneDigits =
    server === 'c.us' ? (normalized.phoneDigits || null) : null;

  // Fallback @lid: obter telefone do Contact (phoneNumber, formattedPhoneNumber, pn).
  if (!phoneDigits && server === 'lid' && params.getPhoneForLid) {
    try {
      const lidPhone = await params.getPhoneForLid(chatId);
      if (lidPhone && digitsOnly(lidPhone).length >= 10) {
        const lidNormalized = normalizePhoneDigitsWithAliases(lidPhone);
        phoneDigits = lidNormalized.phoneDigits || null;
      }
    } catch {
      /* ignore */
    }
  }

  // 1) Lookup reverso (quando tiver index)
  let record: ClientRecord | null = null;
  try {
    record = await clientDB.getByWhatsAppChatId(chatId);
  } catch {
    record = null;
  }

  // Se veio por @lid e achou registro, preferir phoneDigits do cadastro.
  const recordPhone = digitsOnly(String(record?.phoneDigits || record?.clientKey || ''));
  const effectivePhoneDigits =
    phoneDigits ||
    (recordPhone.length >= 10 ? recordPhone : null);

  // 2) Lookup por telefone/aliases (compatível com bancos antigos)
  if (!record && effectivePhoneDigits) {
    const candidates = Array.from(new Set([normalized.phoneDigits, ...normalized.aliasesDigits].filter(Boolean)));
    for (const digits of candidates) {
      try {
        record = (await clientDB.getByPhoneDigits(digits)) || (await clientDB.getByKey(digits));
      } catch {
        // ignore e seguir
      }
      if (record) break;
    }
  }

  // Se achou cadastro mas o crachá não está fixado, fixar sem sobrescrever “caneta”
  if (record && !record.whatsAppChatId) {
    try {
      await clientDB.upsert({
        ...record,
        whatsAppChatId: chatId,
        phoneDigits: record.phoneDigits || effectivePhoneDigits || record.clientKey,
        aliasesDigits: record.aliasesDigits ?? (normalized.aliasesDigits.length ? normalized.aliasesDigits : undefined),
        updatedAtIso: new Date().toISOString(),
      });
    } catch {
      // ignore
    }
  }

  return { chatId, isGroup: false, phoneDigits: effectivePhoneDigits, record };
}

export function buildClientBadges(record: ClientRecord | null): string[] {
  const badges: string[] = [];
  if (!record) {
    badges.push('Sem cadastro');
    return badges;
  }

  // “Cadastro” existe
  if (String(record.addressFreeform || record.address || '').trim()) badges.push('Endereço');
  if (String((record as any).notesInternal || '').trim()) badges.push('Notas');
  return badges;
}

export function buildPhoneLabel(phoneDigits: string | null): string {
  return formatPhoneLabel(phoneDigits);
}

