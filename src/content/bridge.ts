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

async function withRetry<T>(fn: () => Promise<T>, attempt = 1): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (attempt < 2 && (msg.includes('context invalidated') || msg.includes('Extension context'))) {
      await new Promise(r => setTimeout(r, 500));
      return withRetry(fn, 2);
    }
    throw err;
  }
}

function getStorage(keys: string[]): Promise<Record<string, unknown>> {
  return withRetry(() => new Promise<Record<string, unknown>>((resolve, reject) => {
    chrome.storage.local.get(keys, result => {
      const err = chrome.runtime.lastError;
      if (err) return reject(err);
      resolve(result as Record<string, unknown>);
    });
  }));
}

function setStorage(items: Record<string, unknown>): Promise<void> {
  return withRetry(() => new Promise<void>((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      const err = chrome.runtime.lastError;
      if (err) return reject(err);
      resolve();
    });
  }));
}

function removeStorage(keys: string[]): Promise<void> {
  return withRetry(() => new Promise<void>((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      const err = chrome.runtime.lastError;
      if (err) return reject(err);
      resolve();
    });
  }));
}

/** No MV3, `chrome.downloads` não existe no content script; blob: só funciona no documento da aba. */
async function downloadViaAnchor(url: string, filename: string): Promise<{ downloadId: number }> {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.position = 'fixed';
  a.style.left = '-9999px';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  await new Promise<void>((resolve) => setTimeout(resolve, 2500));
  return { downloadId: 0 };
}

async function downloadViaServiceWorker(
  url: string,
  filename: string,
  saveAs: boolean,
): Promise<{ downloadId: number }> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'DOWNLOADS_DOWNLOAD', payload: { url, filename, saveAs } },
      (resp: unknown) => {
        const lastErr = chrome.runtime.lastError;
        if (lastErr) {
          reject(new Error(lastErr.message));
          return;
        }
        const r = resp as { ok?: boolean; downloadId?: number; error?: string };
        if (r?.ok === true && typeof r.downloadId === 'number') {
          resolve({ downloadId: r.downloadId });
          return;
        }
        reject(new Error(typeof r?.error === 'string' ? r.error : 'DOWNLOADS_DOWNLOAD failed'));
      },
    );
  });
}

async function netFetch(payload: unknown): Promise<{ ok: boolean; status: number; text: string }> {
  const p = payload as { url?: unknown; method?: unknown; headers?: unknown; body?: unknown };
  const url = typeof p?.url === 'string' ? p.url : null;
  if (!url) throw new Error('Missing url');

  const method = typeof p?.method === 'string' ? p.method : 'GET';
  const headers = p?.headers && typeof p.headers === 'object' ? (p.headers as Record<string, string>) : undefined;
  const body = typeof p?.body === 'string' ? p.body : undefined;

  // Tenta via service worker primeiro (mais robusto que fetch do content script).
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
  } catch {
    // Fallback: fetch direto do isolated world.
    // O content script MV3 tem host_permissions, então consegue acessar
    // URLs externas (ex: api.deepseek.com) sem CORS da página.
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

      if (url.startsWith('blob:') || url.startsWith('data:')) {
        return await downloadViaAnchor(url, filename);
      }

      try {
        return await downloadViaServiceWorker(url, filename, saveAs);
      } catch (swErr: unknown) {
        const downloads = (chrome as unknown as { downloads?: { download?: unknown } }).downloads;
        if (downloads && typeof downloads.download === 'function') {
          const downloadId = await new Promise<number>((resolve, reject) => {
            (downloads.download as (
              opts: { url: string; filename: string; saveAs?: boolean },
              cb: (id?: number) => void,
            ) => void)({ url, filename, saveAs }, (id?: number) => {
              const err = chrome.runtime.lastError;
              if (err) return reject(err);
              if (typeof id !== 'number') return reject(new Error('Download failed'));
              resolve(id);
            });
          });
          return { downloadId };
        }
        const msg = swErr instanceof Error ? swErr.message : 'download failed';
        throw new Error(msg);
      }
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

