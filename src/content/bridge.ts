interface BridgeRequest {
  __mettriBridge: true;
  direction: 'request';
  requestId: string;
  action: 'ping' | 'storage.get' | 'storage.set' | 'storage.remove' | 'downloads.download';
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

function isBridgeRequest(data: unknown): data is BridgeRequest {
  if (!data || typeof data !== 'object') return false;
  const anyData = data as Record<string, unknown>;
  return (
    anyData.__mettriBridge === true &&
    anyData.direction === 'request' &&
    typeof anyData.requestId === 'string' &&
    typeof anyData.action === 'string'
  );
}

function postResponse(response: BridgeResponse): void {
  window.postMessage(response, '*');
}

function getStorage(keys: string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, result => {
      const err = chrome.runtime.lastError;
      if (err) return reject(err);
      resolve(result as Record<string, unknown>);
    });
  });
}

function setStorage(items: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      const err = chrome.runtime.lastError;
      if (err) return reject(err);
      resolve();
    });
  });
}

function removeStorage(keys: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      const err = chrome.runtime.lastError;
      if (err) return reject(err);
      resolve();
    });
  });
}

async function handleRequest(request: BridgeRequest): Promise<unknown> {
  switch (request.action) {
    case 'ping': {
      return {
        hasChrome: typeof chrome !== 'undefined',
        hasStorage: !!chrome?.storage?.local,
        hasDownloads: typeof (chrome as unknown as { downloads?: unknown }).downloads !== 'undefined',
      };
    }
    case 'storage.get': {
      const payload = request.payload as { keys?: unknown };
      const keys = Array.isArray(payload?.keys) ? payload.keys.filter(k => typeof k === 'string') : [];
      return await getStorage(keys);
    }
    case 'storage.set': {
      const payload = request.payload as { items?: unknown };
      if (!payload?.items || typeof payload.items !== 'object') {
        throw new Error('Invalid payload.items');
      }
      await setStorage(payload.items as Record<string, unknown>);
      return { success: true };
    }
    case 'storage.remove': {
      const payload = request.payload as { keys?: unknown };
      const keys = Array.isArray(payload?.keys) ? payload.keys.filter(k => typeof k === 'string') : [];
      await removeStorage(keys);
      return { success: true };
    }
    case 'downloads.download': {
      const payload = request.payload as { url?: unknown; filename?: unknown; saveAs?: unknown };
      const url = typeof payload?.url === 'string' ? payload.url : null;
      const filename = typeof payload?.filename === 'string' ? payload.filename : null;
      const saveAs = typeof payload?.saveAs === 'boolean' ? payload.saveAs : false;

      if (!url) throw new Error('Missing url');
      if (!filename) throw new Error('Missing filename');

      const downloads = (chrome as unknown as { downloads?: { download?: unknown } }).downloads;
      if (!downloads || typeof downloads.download !== 'function') {
        throw new Error('chrome.downloads.download not available');
      }

      const downloadId = await new Promise<number>((resolve, reject) => {
        (downloads.download as (opts: { url: string; filename: string; saveAs?: boolean }, cb: (id?: number) => void) => void)(
          { url, filename, saveAs },
          (id?: number) => {
          const err = chrome.runtime.lastError;
          if (err) return reject(err);
          if (typeof id !== 'number') return reject(new Error('Download failed'));
          resolve(id);
        }
        );
      });

      return { downloadId };
    }
  }
}

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!isBridgeRequest(data)) return;

  const request = data;

  (async () => {
    try {
      const result = await handleRequest(request);
      postResponse({
        __mettriBridge: true,
        direction: 'response',
        requestId: request.requestId,
        ok: true,
        result,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error';
      postResponse({
        __mettriBridge: true,
        direction: 'response',
        requestId: request.requestId,
        ok: false,
        error: errorMessage,
      });
    }
  })();
});

