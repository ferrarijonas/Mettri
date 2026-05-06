/**
 * Adaptador chrome.storage + downloads API para {@link retomarOutcomeExporter} no painel (world MAIN).
 */

import type { MettriBridgeClient } from '../../../content/bridge-client';
import type {
  RetomarOutcomeExporterStateStore,
  RetomarOutcomeExporterWriter,
} from './retomar-outcome-exporter';

function storageKeyIds(accountId: string): string {
  return `mettri_ro_ids_v1_${accountId}`;
}

function storageKeyJsonl(accountId: string): string {
  return `mettri_ro_jsonl_v1_${accountId}`;
}

export function createRetomarOutcomeBridgeDeps(
  accountId: string,
  bridge: MettriBridgeClient,
): {
  writer: RetomarOutcomeExporterWriter;
  exportStateStore: RetomarOutcomeExporterStateStore;
} {
  const idsKey = storageKeyIds(accountId);
  const fileKey = storageKeyJsonl(accountId);

  return {
    exportStateStore: {
      get: async (acc: string) => {
        if (acc !== accountId) {
          throw new Error('Erro interno: accountId do export não confere.');
        }
        const r = await bridge.storageGet([idsKey]);
        const raw = r?.[idsKey] as { exportedSendMessageIds?: string[] } | undefined;
        return { exportedSendMessageIds: raw?.exportedSendMessageIds ?? [] };
      },
      set: async (acc: string, state) => {
        if (acc !== accountId) {
          throw new Error('Erro interno: accountId do export não confere.');
        }
        await bridge.storageSet({ [idsKey]: state });
      },
    },
    writer: {
      append: async (filePath: string, text: string) => {
        const r = await bridge.storageGet([fileKey]);
        const prev = typeof r?.[fileKey] === 'string' ? (r[fileKey] as string) : '';
        const next = prev + text;
        const blob = new Blob([next], { type: 'application/x-ndjson' });
        const url = URL.createObjectURL(blob);
        try {
          const filename = filePath.includes('/') ? filePath.split('/').pop()! : filePath;
          await bridge.downloadsDownload({ url, filename, saveAs: false });
        } finally {
          URL.revokeObjectURL(url);
        }
        await bridge.storageSet({ [fileKey]: next });
      },
    },
  };
}
