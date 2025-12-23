(() => {
  /**
   * IA no content script via service worker.
   * Motivo: evitar CORS/segredos no DOM e centralizar chamadas externas.
   */
  const NS = (globalThis.WACRM = globalThis.WACRM || {});

  function log(...args) {
    try {
      const cfg = NS?.Storage?.getCachedConfig?.();
      if (cfg?.debug) console.log("[WACRM][ai]", ...args);
    } catch {
      // noop
    }
  }

  async function suggestReplies({
    chatId,
    chatName,
    chatType,
    lastIncomingText,
    conversationPreview,
    maxSuggestions = 3
  }) {
    if (!globalThis.chrome?.runtime?.sendMessage) {
      log("chrome.runtime indisponível; sem sugestões");
      return [];
    }

    try {
      const res = await chrome.runtime.sendMessage({
        type: "OPENAI_SUGGEST",
        payload: {
          chatId,
          chatName,
          chatType,
          lastIncomingText,
          conversationPreview,
          maxSuggestions
        }
      });

      if (!res || !res.ok) {
        log("falha OPENAI_SUGGEST", res?.error || res);
        return [];
      }
      return Array.isArray(res.suggestions) ? res.suggestions : [];
    } catch (err) {
      log("erro OPENAI_SUGGEST", err);
      return [];
    }
  }

  NS.AIService = { suggestReplies };
})();

