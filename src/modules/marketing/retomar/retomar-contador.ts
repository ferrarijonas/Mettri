/**
 * Store do contador de ciclos Retomar.
 * Persiste chatId → último ciclo enviado (1–4) por conta.
 * Chave: retomarContador_${accountId}
 */

import { MettriBridgeClient } from '../../../content/bridge-client';

export type ChamadaIndex = 1 | 2 | 3 | 4;

function storageKey(accountId: string): string {
  return `retomarContador_${accountId}`;
}

const bridge = new MettriBridgeClient(2500);

/**
 * Retorna o mapa completo chatId → ciclo (1–4) para a conta.
 */
export async function getContadorMap(accountId: string): Promise<Record<string, number>> {
  try {
    const result = await bridge.storageGet([storageKey(accountId)]);
    const stored = result[storageKey(accountId)] as Record<string, number> | undefined;
    if (stored && typeof stored === 'object') {
      return stored;
    }
  } catch (error) {
    console.error('[RETOMAR CONTADOR] Erro ao carregar:', error);
  }
  return {};
}

/**
 * Define o último ciclo enviado para um chat (1–4).
 */
export async function setContador(
  accountId: string,
  chatId: string,
  chamada: ChamadaIndex
): Promise<void> {
  const map = await getContadorMap(accountId);
  map[chatId] = chamada;
  try {
    await bridge.storageSet({ [storageKey(accountId)]: map });
  } catch (error) {
    console.error('[RETOMAR CONTADOR] Erro ao salvar:', error);
  }
}

/**
 * Retorna o último ciclo enviado para o chat (1–4). 0 se ausente.
 */
export async function getContador(accountId: string, chatId: string): Promise<number> {
  const map = await getContadorMap(accountId);
  return map[chatId] ?? 0;
}

/**
 * Zera o contador para um chat (ex.: após compra detectada).
 * Será conectado quando a detecção de compra estiver pronta.
 */
export async function resetForChat(accountId: string, chatId: string): Promise<void> {
  const map = await getContadorMap(accountId);
  delete map[chatId];
  try {
    await bridge.storageSet({ [storageKey(accountId)]: map });
  } catch (error) {
    console.error('[RETOMAR CONTADOR] Erro ao resetar:', error);
  }
}
