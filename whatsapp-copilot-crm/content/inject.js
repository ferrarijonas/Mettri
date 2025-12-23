(() => {
  const NS = (globalThis.WACRM = globalThis.WACRM || {});

  function registerBridge() {
    if (!globalThis.chrome?.runtime?.onMessage) return;
    if (globalThis.__WACRM_BRIDGE__) return;
    globalThis.__WACRM_BRIDGE__ = true;

    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      try {
        if (!msg || typeof msg !== "object") return;
        if (msg.type === "PING") {
          sendResponse({ ok: true });
          return;
        }
        if (msg.type === "GET_CONTEXT") {
          const context = NS.ChatContext?.getCurrent?.() || { chatId: null, chatName: null, chatType: "unknown" };
          sendResponse({ ok: true, context });
          return;
        }
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    });
  }

  async function boot() {
    try {
      await NS.Storage.initDefaults();
      if (NS.MockData?.seedIfNeeded) await NS.MockData.seedIfNeeded();
      await NS.MessageHandler.start();
    } catch (e) {
      console.error("[WACRM][boot] falhou", e);
    }
  }

  // evita boot duplo
  if (!globalThis.__WACRM_BOOTED__) {
    globalThis.__WACRM_BOOTED__ = true;
    registerBridge();
    boot();
  }
})();

