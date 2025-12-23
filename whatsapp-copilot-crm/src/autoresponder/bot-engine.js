(() => {
  const NS = (globalThis.WACRM = globalThis.WACRM || {});

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim();
  }

  function matchRule(rule, incomingText) {
    const t = normalize(incomingText);
    const m = rule?.match || {};

    if (!t) return false;

    switch (m.type) {
      case "contains": {
        const v = normalize(m.value);
        return !!v && t.includes(v);
      }
      case "contains_any": {
        const arr = Array.isArray(m.value) ? m.value : [];
        return arr.some((x) => {
          const v = normalize(x);
          return v && t.includes(v);
        });
      }
      case "regex": {
        try {
          const re = new RegExp(m.value, "i");
          return re.test(incomingText);
        } catch {
          return false;
        }
      }
      default:
        return false;
    }
  }

  function renderTemplate(template, ctx) {
    const safe = (v) => String(v ?? "");
    return String(template || "")
      .replaceAll("{{chat_name}}", safe(ctx.chatName))
      .replaceAll("{{chat_id}}", safe(ctx.chatId))
      .replaceAll("{{chat_type}}", safe(ctx.chatType))
      .replaceAll("{{last_message}}", safe(ctx.lastIncomingText));
  }

  async function decideAutoReply({ chatId, chatName, chatType, lastIncomingText }) {
    const cfg = await NS.Storage.getWithDefaults("config");
    if (!cfg?.autoResponderEnabled) return null;

    const rules = await NS.Autoresponder.Rules.list();
    for (const r of rules) {
      if (!r?.enabled) continue;
      if (matchRule(r, lastIncomingText)) {
        const text = renderTemplate(r.replyTemplate, { chatId, chatName, chatType, lastIncomingText });
        return { ruleId: r.id, text };
      }
    }
    return null;
  }

  NS.Autoresponder = NS.Autoresponder || {};
  NS.Autoresponder.Bot = { decideAutoReply };
})();

