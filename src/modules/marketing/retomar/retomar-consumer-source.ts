/**
 * retomar-consumer-source
 *
 * Fonte de atividade do Retomar que vem direto do banco do Consumer (via
 * gateway local, scripts/consumer-bridge) — sem arrastar XLSX.
 *
 * Converte a resposta do bridge para o mesmo formato do import
 * (`PurchaseImportSnapshot`), reusando o match telefone→chatId existente
 * (`resolveLastActivityFromSnapshot`). Snapshot em cache no chrome.storage.
 */
import { MettriBridgeClient } from '../../../content/bridge-client';
import { normalizePhoneDigitsWithAliases } from '../../../storage/client-db';
import { consultarConsumer } from '../../harness/tools/consumer-client';
import type { ImportedRow, PurchaseImportSnapshot } from './retomar-purchase-import';

interface ClienteConsumer {
  nome: string;
  telefone: string;
  ultimoPedido: string;
}

const bridge = new MettriBridgeClient(5000);

function snapshotKey(accountId: string): string {
  return `retomarConsumerSnapshot_${accountId}`;
}

/** Busca a lista completa de clientes com a última compra, direto do Consumer. */
export async function fetchConsumerSnapshot(): Promise<PurchaseImportSnapshot> {
  const dados = await consultarConsumer<{ clientes: ClienteConsumer[] }>('inativos');

  const rows: ImportedRow[] = [];
  for (const c of dados.clientes ?? []) {
    const { phoneDigits } = normalizePhoneDigitsWithAliases(c.telefone || '');
    if (!phoneDigits) continue;
    rows.push({
      phoneDigits,
      lastPurchaseIso: (c.ultimoPedido || '').slice(0, 10),
      name: c.nome || undefined,
    });
  }

  return {
    importedAt: new Date().toISOString(),
    filename: 'Banco Consumer',
    rows,
  };
}

export async function loadConsumerSnapshot(accountId: string): Promise<PurchaseImportSnapshot | null> {
  try {
    const result = await bridge.storageGet([snapshotKey(accountId)]);
    const stored = result[snapshotKey(accountId)];
    if (stored && typeof stored === 'object' && 'rows' in (stored as object)) {
      return stored as PurchaseImportSnapshot;
    }
  } catch (e) {
    console.error('[RETOMAR CONSUMER] Erro ao carregar snapshot:', e);
  }
  return null;
}

export async function saveConsumerSnapshot(
  accountId: string,
  snapshot: PurchaseImportSnapshot,
): Promise<void> {
  try {
    await bridge.storageSet({ [snapshotKey(accountId)]: snapshot });
  } catch (e) {
    console.error('[RETOMAR CONSUMER] Erro ao salvar snapshot:', e);
  }
}
