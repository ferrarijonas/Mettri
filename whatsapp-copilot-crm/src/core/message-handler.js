(() => {
  const NS = (globalThis.WACRM = globalThis.WACRM || {});

  function log(level, ...args) {
    const cfg = NS?.Storage?.getCachedConfig?.();
    const debug = cfg?.debug ?? true;
    if (!debug && level !== "error") return;
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn("[WACRM][handler]", ...args);
  }

  // dedup por chatId: evita reagir duas vezes ao mesmo texto
  const lastHandledByChat = new Map();

  async function storeSuggestions(chatId, suggestions) {
    const current = await NS.Storage.getWithDefaults("suggestions");
    const store = current && typeof current === "object" ? current : {};
    store[chatId] = { suggestions, updatedAt: new Date().toISOString() };
    await NS.Storage.set({ suggestions: store });
  }

  async function onIncomingMessage({ text }) {
    const cfg = await NS.Storage.getWithDefaults("config");
    const ctx = NS.ChatContext.getCurrent();

    if (!text) return;

    const dedupKey = `${text}`.slice(0, 400);
    const chatKey = ctx.chatId || null;
    if (chatKey) {
      const prev = lastHandledByChat.get(chatKey);
      if (prev === dedupKey) return;
      lastHandledByChat.set(chatKey, dedupKey);
    }

    // CRM (somente com chatId estável)
    if (ctx.chatId) {
      try {
        await NS.CRM.Contacts.ensureFromChatContext(ctx);
        await NS.CRM.History.addMessage({
          chatId: ctx.chatId,
          chatName: ctx.chatName,
          direction: "in",
          text
        });
      } catch (e) {
        log("error", "falha ao salvar no CRM", e);
      }
    }

    // Auto-responder
    if (cfg?.autoResponderEnabled) {
      try {
        const decision = await NS.Autoresponder.Bot.decideAutoReply({
          chatId: ctx.chatId,
          chatName: ctx.chatName,
          chatType: ctx.chatType,
          lastIncomingText: text
        });

        if (decision?.text) {
          const ok = NS.WhatsAppAPI.sendMessage(decision.text);
          if (ok && ctx.chatId) {
            await NS.CRM.History.addMessage({
              chatId: ctx.chatId,
              chatName: ctx.chatName,
              direction: "out",
              text: decision.text,
              meta: { ruleId: decision.ruleId }
            });
          }
          log("log", "auto-resposta enviada", decision.ruleId);
        }
      } catch (e) {
        log("error", "auto-responder falhou", e);
      }
    }

    // Copiloto IA (sugestões)
    if (cfg?.copilotEnabled) {
      try {
        const suggestions = await NS.AIService.suggestReplies({
          chatId: ctx.chatId,
          chatName: ctx.chatName,
          chatType: ctx.chatType,
          lastIncomingText: text,
          conversationPreview: NS.WhatsAppAPI.getConversationPreview({ maxChars: 1200 }),
          maxSuggestions: 3
        });

        if (suggestions.length) {
          log("log", "sugestões IA:", suggestions);
          if (ctx.chatId) await storeSuggestions(ctx.chatId, suggestions);

          // notificação leve (se permitido)
          try {
            chrome.runtime?.sendMessage?.({
              type: "WACRM_NOTIFY",
              payload: { title: "Sugestões do Copiloto", body: suggestions.slice(0, 2).join("\n") }
            });
          } catch {
            // noop
          }
        }
      } catch (e) {
        log("warn", "copiloto não gerou sugestões", e);
      }
    }
  }

  async function start() {
    await NS.Storage.initDefaults();
    await NS.WhatsAppAPI.waitForReady({ timeoutMs: 30_000 });

    // inicia observer (somente incoming)
    const observer = NS.DOMObserver.start({
      onlyIncoming: true,
      onNewMessage: (m) => {
        // roda async sem bloquear observer
        onIncomingMessage(m);
      }
    });

    return observer;
  }

  NS.MessageHandler = { start };
})();

