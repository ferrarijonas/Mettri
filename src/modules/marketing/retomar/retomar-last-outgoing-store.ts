/**
 * Espelho em chrome.storage da última mensagem Retomar enviada por chat.
 * Sobrevive a limpeza do MessageDB de mensagens antigas (metáfora: carimbo na gaveta).
 */

import { MettriBridgeClient } from '../../../content/bridge-client';

function storageKey(accountId: string): string {
  return `retomarLastOutgoingAt_${accountId}`;
}

const bridge = new MettriBridgeClient(2500);

export async function getLastRetomarOutgoingMap(accountId: string): Promise<Record<string, string>> {
  try {
    const result = await bridge.storageGet([storageKey(accountId)]);
    const stored = result[storageKey(accountId)] as Record<string, string> | undefined;
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      return stored;
    }
  } catch (error) {
    console.error('[RETOMAR LAST OUT] Erro ao carregar:', error);
  }
  return {};
}

/**
 * Grava ISO da última vez que a extensão enviou Retomar com sucesso para o chat.
 */
export async function setLastRetomarOutgoingAt(
  accountId: string,
  chatId: string,
  at: Date
): Promise<void> {
  const map = await getLastRetomarOutgoingMap(accountId);
  map[chatId] = at.toISOString();
  try {
    await bridge.storageSet({ [storageKey(accountId)]: map });
  } catch (error) {
    console.error('[RETOMAR LAST OUT] Erro ao salvar:', error);
  }
}
