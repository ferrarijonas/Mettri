import { messageDB } from '../storage/message-db';
import type { CapturedMessage } from '../types';
import { MettriBridgeClient } from '../content/bridge-client';

export type ExportTrigger = 'startup' | 'interval' | 'near-limit' | 'manual' | 'retry-pending';

type ExportStateV1 = {
  version: 1;
  lastCursorIso?: string; // último timestamp exportado com sucesso
  lastSuccessIso?: string;
  lastAttemptIso?: string;
  lastError?: string;
  pending?: boolean;
  pendingReason?: string;
  seqByDay?: Record<string, number>;
};

const EXPORT_STATE_KEY = 'mettri_export_state_v1';
const SCHEMA_VERSION = 1;
const DEFAULT_TENANT_ID = 'local';

function isExportStateV1(value: unknown): value is ExportStateV1 {
  return !!value && typeof value === 'object' && (value as { version?: unknown }).version === 1;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function sanitizeForFilename(value: string): string {
  return value.replace(/[@.]/g, '_').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function sortForExport(a: CapturedMessage, b: CapturedMessage): number {
  const ta = a.timestamp.getTime();
  const tb = b.timestamp.getTime();
  if (ta !== tb) return ta - tb;
  return a.id.localeCompare(b.id);
}

function toEventLine(params: {
  tenantId: string;
  instanceId: string;
  ingestedAtIso: string;
  message: CapturedMessage;
}): string {
  const { tenantId, instanceId, ingestedAtIso, message } = params;
  // Serializar timestamp em ISO (JSON não tem Date)
  const msg = {
    ...message,
    timestamp: message.timestamp.toISOString(),
  };

  const envelope = {
    schemaVersion: SCHEMA_VERSION,
    eventType: 'message',
    tenantId,
    instanceId,
    ingestedAt: ingestedAtIso,
    message: msg,
  };

  return JSON.stringify(envelope);
}

export class LocalBatchExporter {
  private bridge = new MettriBridgeClient(2500);
  private timer: number | null = null;

  constructor(
    private options: {
      intervalMs?: number; // checagem periódica
      nearLimitThreshold?: number; // ex.: 9000
    } = {}
  ) {}

  start(): void {
    const intervalMs = this.options.intervalMs ?? 30 * 60 * 1000; // 30 min
    if (this.timer != null) return;

    // Rodar uma vez no início (sem travar o boot)
    setTimeout(() => {
      this.tick('startup').catch(() => {});
    }, 1000);

    this.timer = setInterval(() => {
      this.tick('interval').catch(() => {});
    }, intervalMs) as unknown as number;
  }

  stop(): void {
    if (this.timer != null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async exportManual(): Promise<{ ok: boolean; downloaded: boolean; reason?: string }> {
    return await this.exportNow({ trigger: 'manual', preferAutoDownload: false });
  }

  async tick(trigger: ExportTrigger): Promise<void> {
    // 1) Se existe pendência, tentar novamente (modo C)
    const state = await this.getState();
    if (state.pending) {
      await this.exportNow({ trigger: 'retry-pending', preferAutoDownload: true });
      return;
    }

    // 2) Regra diária: exportar ao menos 1x por dia
    const today = isoDay(new Date());
    const lastSuccessDay = state.lastSuccessIso ? state.lastSuccessIso.slice(0, 10) : null;
    const shouldDaily = lastSuccessDay !== today;

    // 3) Proteção: se perto do limite local, exportar antes
    const count = await messageDB.getMessageCount();
    const nearLimitThreshold = this.options.nearLimitThreshold ?? 9000;
    const nearLimit = count >= nearLimitThreshold;

    if (!shouldDaily && !nearLimit) return;

    await this.exportNow({
      trigger: nearLimit ? 'near-limit' : trigger,
      preferAutoDownload: true,
    });
  }

  private async getState(): Promise<ExportStateV1> {
    try {
      const result = await this.bridge.storageGet([EXPORT_STATE_KEY]);
      const raw = result?.[EXPORT_STATE_KEY] as unknown;
      if (isExportStateV1(raw)) return raw;
    } catch {
      // ignore
    }
    return { version: 1 };
  }

  private async setState(next: ExportStateV1): Promise<void> {
    await this.bridge.storageSet({ [EXPORT_STATE_KEY]: next });
  }

  private async exportNow(options: {
    trigger: ExportTrigger;
    preferAutoDownload: boolean;
  }): Promise<{ ok: boolean; downloaded: boolean; reason?: string }> {
    const now = new Date();
    const nowIso = now.toISOString();

    const state = await this.getState();
    await this.setState({
      ...state,
      lastAttemptIso: nowIso,
      lastError: undefined,
      pending: false,
      pendingReason: undefined,
    });

    const instanceId = messageDB.getCurrentUserWid() || 'unknown';
    const tenantId = DEFAULT_TENANT_ID;

    const startDate = state.lastCursorIso ? new Date(state.lastCursorIso) : new Date(0);
    const endDate = now;

    let messages = await messageDB.getMessagesByDateRange(startDate, endDate);
    if (messages.length === 0) {
      await this.setState({
        ...state,
        lastCursorIso: nowIso,
        lastSuccessIso: nowIso,
        lastAttemptIso: nowIso,
        pending: false,
        pendingReason: undefined,
        lastError: undefined,
      });
      return { ok: true, downloaded: false, reason: 'no-messages' };
    }

    messages = messages.sort(sortForExport);

    const day = isoDay(now);
    const seqByDay = { ...(state.seqByDay ?? {}) };
    const nextSeq = (seqByDay[day] ?? 0) + 1;
    seqByDay[day] = nextSeq;

    const filename = `mettri-batch-${sanitizeForFilename(instanceId)}-${day}-${String(nextSeq).padStart(3, '0')}.jsonl`;

    const lines = messages.map(m =>
      toEventLine({
        tenantId,
        instanceId,
        ingestedAtIso: nowIso,
        message: m,
      })
    );

    const content = lines.join('\n') + '\n';
    const blob = new Blob([content], { type: 'application/x-ndjson' });
    const url = URL.createObjectURL(blob);

    // Modo C: tentar download automático quando possível
    if (options.preferAutoDownload) {
      try {
        await this.bridge.downloadsDownload({ url, filename, saveAs: false });

        await this.setState({
          ...state,
          version: 1,
          lastCursorIso: endDate.toISOString(),
          lastSuccessIso: nowIso,
          lastAttemptIso: nowIso,
          seqByDay,
          pending: false,
          pendingReason: undefined,
          lastError: undefined,
        });
        return { ok: true, downloaded: true };
      } catch (error: unknown) {
        // Falhou: marcar como pendente e deixar para “download com clique”
        const msg = error instanceof Error ? error.message : String(error);
        await this.setState({
          ...state,
          version: 1,
          seqByDay,
          pending: true,
          pendingReason: `auto-download-failed:${msg}`,
          lastAttemptIso: nowIso,
          lastError: msg,
        });
        // Não avançar cursor se não baixou
        return { ok: false, downloaded: false, reason: 'auto-download-failed' };
      } finally {
        // Se baixou via downloads API, o browser controla o lifecycle do blob URL.
        // Se não baixou, manter URL viva para o fluxo manual (até a aba fechar).
      }
    }

    // Manual: usar clique (gesto do usuário)
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await this.setState({
        ...state,
        version: 1,
        lastCursorIso: endDate.toISOString(),
        lastSuccessIso: nowIso,
        lastAttemptIso: nowIso,
        seqByDay,
        pending: false,
        pendingReason: undefined,
        lastError: undefined,
      });

      return { ok: true, downloaded: true };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      await this.setState({
        ...state,
        version: 1,
        seqByDay,
        pending: true,
        pendingReason: `manual-download-failed:${msg}`,
        lastAttemptIso: nowIso,
        lastError: msg,
      });
      return { ok: false, downloaded: false, reason: 'manual-download-failed' };
    }
  }
}

