interface BridgeRequest {
  __mettriBridge: true;
  direction: 'request';
  requestId: string;
  action: 'ping' | 'storage.get' | 'storage.set' | 'storage.remove' | 'downloads.download' | 'net.fetch';
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

async function netFetch(payload: unknown): Promise<{ ok: boolean; status: number; text: string }> {
  const p = payload as { url?: unknown; method?: unknown; headers?: unknown; body?: unknown };
  const url = typeof p?.url === 'string' ? p.url : null;
  if (!url) throw new Error('Missing url');

  const method = typeof p?.method === 'string' ? p.method : 'GET';
  const headers = p?.headers && typeof p.headers === 'object' ? (p.headers as Record<string, string>) : undefined;
  const body = typeof p?.body === 'string' ? p.body : undefined;

  // Preferir buscar via service worker (mais robusto que fetch do content script).
  try {
    const result = await new Promise<{ ok: boolean; status: number; text: string }>((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'NET_FETCH',
          payload: { url, method, headers, body },
        },
        (resp: unknown) => {
          const err = chrome.runtime.lastError;
          if (err) return reject(err);
          resolve(resp as { ok: boolean; status: number; text: string });
        }
      );
    });
    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : 'NET_FETCH failed';

    // Importante: NÃO cair no fetch do content script para URLs externas,
    // porque isso vira "CORS" do WhatsApp e confunde o diagnóstico.
    // Só fazemos fallback quando a URL é do mesmo origin da página.
    try {
      const isSameOrigin = new URL(url).origin === window.location.origin;
      if (!isSameOrigin) {
        return { ok: false, status: 0, text: `NET_FETCH (service worker) falhou: ${msg}` };
      }
    } catch {
      // Se a URL for inválida, só devolve erro.
      return { ok: false, status: 0, text: `NET_FETCH (service worker) falhou: ${msg}` };
    }

    const res = await fetch(url, {
      method,
      headers,
      body,
      credentials: 'omit',
      redirect: 'follow',
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  }
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
    case 'net.fetch': {
      return await netFetch(request.payload);
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

