type BridgeAction =
  | 'ping'
  | 'storage.get'
  | 'storage.set'
  | 'storage.remove'
  | 'downloads.download';

interface BridgeRequest {
  __mettriBridge: true;
  direction: 'request';
  requestId: string;
  action: BridgeAction;
  payload?: unknown;
}

interface BridgeResponse {
  __mettriBridge: true;
  direction: 'response';
  requestId: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

function isBridgeResponse(data: unknown): data is BridgeResponse {
  if (!data || typeof data !== 'object') return false;
  const anyData = data as Record<string, unknown>;
  return (
    anyData.__mettriBridge === true &&
    anyData.direction === 'response' &&
    typeof anyData.requestId === 'string' &&
    typeof anyData.ok === 'boolean'
  );
}

function createRequestId(): string {
  return `mettri-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class MettriBridgeClient {
  constructor(private readonly timeoutMs = 2000) {}

  request<T = unknown>(action: BridgeAction, payload?: unknown): Promise<T> {
    const requestId = createRequestId();

    const request: BridgeRequest = {
      __mettriBridge: true,
      direction: 'request',
      requestId,
      action,
      payload,
    };

    return new Promise<T>((resolve, reject) => {
      const onMessage = (event: MessageEvent): void => {
        if (event.source !== window) return;
        if (!isBridgeResponse(event.data)) return;
        if (event.data.requestId !== requestId) return;

        window.removeEventListener('message', onMessage);
        clearTimeout(timeout);

        if (!event.data.ok) {
          reject(new Error(event.data.error || 'Bridge error'));
          return;
        }
        resolve(event.data.result as T);
      };

      const timeout = window.setTimeout(() => {
        window.removeEventListener('message', onMessage);
        reject(new Error(`Bridge timeout (${this.timeoutMs}ms) for ${action}`));
      }, this.timeoutMs);

      window.addEventListener('message', onMessage);
      window.postMessage(request, '*');
    });
  }

  async ping(): Promise<{ hasChrome: boolean; hasStorage: boolean; hasDownloads: boolean }> {
    return await this.request('ping');
  }

  async storageGet(keys: string[]): Promise<Record<string, unknown>> {
    return await this.request('storage.get', { keys });
  }

  async storageSet(items: Record<string, unknown>): Promise<void> {
    await this.request('storage.set', { items });
  }

  async storageRemove(keys: string[]): Promise<void> {
    await this.request('storage.remove', { keys });
  }

  async downloadsDownload(args: { url: string; filename: string; saveAs?: boolean }): Promise<{ downloadId: number }> {
    return await this.request('downloads.download', args);
  }
}

