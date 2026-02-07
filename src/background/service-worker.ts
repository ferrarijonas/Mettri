// Mettri Background Service Worker

import { ModuleUpdater } from '../infrastructure/module-updater';

// Inicializar sistema de atualização de módulos
const moduleUpdater = new ModuleUpdater();

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // First install
    await chrome.storage.local.set({
      settings: {
        panelEnabled: true,
        captureEnabled: true,
        theme: 'auto',
        historyEnabled: false,
      },
      version: '2.0.0',
      autoUpdateEnabled: true, // Habilitado por padrão
    });
  }
  
  // Iniciar verificação automática de atualizações
  await moduleUpdater.startAutoCheck();
});

// Verificar atualizações quando extensão é iniciada (se não foi instalada agora)
moduleUpdater.startAutoCheck().catch(error => {
  console.error('[ServiceWorker] Erro ao iniciar verificação de atualizações:', error);
});

// Verificar atualizações 1x por dia (alarm adicional para garantir)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'check-module-updates' || alarm.name === 'module-updater-check') {
    moduleUpdater.checkForUpdates().catch(error => {
      console.error('[ServiceWorker] Erro ao verificar atualizações:', error);
    });
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_SETTINGS') {
    chrome.storage.local.get(['settings'], result => {
      sendResponse(result.settings || {});
    });
    return true; // Keep channel open for async response
  }

  if (message.type === 'CHECK_MODULE_UPDATES') {
    (async () => {
      const result = await moduleUpdater.checkForUpdates();
      sendResponse(result);
    })();
    return true;
  }

  if (message.type === 'GET_MODULE_CODE') {
    const moduleId = typeof message.moduleId === 'string' ? message.moduleId : null;
    if (!moduleId) {
      sendResponse({ code: null });
      return false;
    }
    (async () => {
      const code = await moduleUpdater.getModuleCode(moduleId);
      sendResponse({ code });
    })();
    return true;
  }

  if (message.type === 'NET_FETCH') {
    const payload = message?.payload as { url?: unknown; method?: unknown; headers?: unknown; body?: unknown };
    const url = typeof payload?.url === 'string' ? payload.url : null;
    const method = typeof payload?.method === 'string' ? payload.method : 'GET';
    const headers = payload?.headers && typeof payload.headers === 'object' ? (payload.headers as Record<string, string>) : undefined;
    const body = typeof payload?.body === 'string' ? payload.body : undefined;

    if (!url) {
      sendResponse({ ok: false, status: 0, text: 'Missing url' });
      return false;
    }

    (async () => {
      try {
        const res = await fetch(url, {
          method,
          headers,
          body,
          credentials: 'omit',
          // Não seguir redirects (ex.: Cloudflare Access) para não "vazar"
          // para um host fora das permissões e virar "Failed to fetch".
          redirect: 'manual',
        });
        const location = res.headers.get('location') || '';
        const text = await res.text();
        sendResponse({ ok: res.ok, status: res.status, text, location });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown fetch error';
        sendResponse({ ok: false, status: 0, text: msg });
      }
    })();

    return true;
  }

  return false;
});
