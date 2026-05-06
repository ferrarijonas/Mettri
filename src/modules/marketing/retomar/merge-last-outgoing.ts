/**
 * Funde mapas de “última mensagem enviada” para o motor de elegibilidade.
 * Regra: por chatId, usa a data mais recente entre fontes (metáfora: vários relógios → ficas com o mais tarde).
 */

import type { LastOutgoingEntry } from './eligible-contacts-engine';

export interface MessageDbLastOutgoing {
  chatId: string;
  chatName: string;
  lastOutgoingAt: Date;
}

/**
 * @param idb - resultado de messageDB.getLastOutgoingByContact()
 * @param retomarStorage - ISO strings de retomar-last-outgoing-store
 * @param waFallback - datas vindas do modelo WhatsApp (opcional)
 */
export function mergeLastOutgoingMaps(
  idb: Map<string, MessageDbLastOutgoing>,
  retomarStorage: Record<string, string>,
  waFallback?: Map<string, Date>
): Map<string, LastOutgoingEntry> {
  const out = new Map<string, LastOutgoingEntry>();

  const consider = (chatId: string, d: Date | null | undefined): void => {
    if (!d || Number.isNaN(d.getTime())) return;
    const prev = out.get(chatId)?.lastOutgoingAt;
    if (!prev || d.getTime() > prev.getTime()) {
      out.set(chatId, { lastOutgoingAt: d });
    }
  };

  for (const [, row] of idb) {
    consider(row.chatId, row.lastOutgoingAt);
  }

  for (const [chatId, iso] of Object.entries(retomarStorage)) {
    if (!chatId.trim()) continue;
    const d = new Date(iso);
    consider(chatId, d);
  }

  if (waFallback) {
    for (const [chatId, d] of waFallback) {
      consider(chatId, d);
    }
  }

  return out;
}
