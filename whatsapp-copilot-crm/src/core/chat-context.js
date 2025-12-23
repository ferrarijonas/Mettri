(() => {
  /**
   * Contexto do chat (módulo separado e obrigatório).
   *
   * Objetivo:
   * - Centralizar “chat_id, chat_name, chat_type”
   * - Ser o único ponto de verdade para o restante do pipeline (CRM, bot, copiloto)
   */
  const NS = (globalThis.WACRM = globalThis.WACRM || {});

  function log(level, ...args) {
    const cfg = NS?.Storage?.getCachedConfig?.();
    const debug = cfg?.debug ?? true;
    if (!debug && level !== "error") return;
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn("[WACRM][ctx]", ...args);
  }

  function getCurrent() {
    if (!NS.WhatsAppAPI?.getChatContext) {
      log("error", "WhatsAppAPI indisponível; contexto não pode ser lido");
      return { chatId: null, chatName: null, chatType: "unknown" };
    }
    const ctx = NS.WhatsAppAPI.getChatContext();
    const chatId = ctx?.chatId || null;
    const chatName = ctx?.chatName || null;
    const chatType = ctx?.chatType || "unknown";

    if (!chatId) log("warn", "chat_id ausente (sem mock): recursos que dependem de chave estável vão degradar.");
    return { chatId, chatName, chatType };
  }

  NS.ChatContext = { getCurrent };
})();

