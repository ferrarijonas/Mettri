(() => {
  const NS = (globalThis.WACRM = globalThis.WACRM || {});

  function log(level, ...args) {
    const cfg = NS?.Storage?.getCachedConfig?.();
    const debug = cfg?.debug ?? true;
    if (!debug && level !== "error") return;
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn("[WACRM][observer]", ...args);
  }

  function makeKey({ direction, text }) {
    // chave simples para deduplicação local
    return `${direction}:${text}`.slice(0, 500);
  }

  function extractBubblesFromNode(node) {
    const sels = NS?.WhatsAppAPI?.SELECTORS?.messageBubble || [];
    const list = [];

    if (!(node instanceof Element)) return list;

    // se o próprio nó já é bubble
    for (const sel of sels) {
      try {
        if (node.matches(sel)) {
          list.push(node);
          return list;
        }
      } catch {
        // ignore
      }
    }

    // senão, busca bubbles dentro
    for (const sel of sels) {
      try {
        const found = node.querySelectorAll(sel);
        if (found && found.length) return Array.from(found);
      } catch {
        // ignore
      }
    }
    return list;
  }

  function start({ onNewMessage, onlyIncoming = true } = {}) {
    if (typeof onNewMessage !== "function") throw new Error("dom-observer.start requer onNewMessage(message)");

    const root = NS.WhatsAppAPI.getMessageListRoot();
    if (!root) {
      log("error", "Observer não iniciou: root null");
      return { stop: () => {} };
    }

    const seen = new Set();
    const prune = () => {
      if (seen.size > 500) {
        // prune simples: zera quando crescer demais
        seen.clear();
      }
    };

    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const added of m.addedNodes || []) {
          const bubbles = extractBubblesFromNode(added);
          for (const b of bubbles) {
            const msgs = NS.WhatsAppAPI.getLatestMessages({ limit: 1 }); // garante parsing consistente
            // fallback: tenta extrair do bubble específico
            const text =
              msgs?.[0]?.text ||
              (() => {
                try {
                  const parts = b.querySelectorAll("span.selectable-text");
                  return Array.from(parts).map((n) => (n.textContent || "").trim()).filter(Boolean).join("\n").trim();
                } catch {
                  return "";
                }
              })();

            if (!text) continue;

            const direction = b.classList?.contains("message-out") ? "out" : "in";
            if (onlyIncoming && direction !== "in") continue;

            const key = makeKey({ direction, text });
            if (seen.has(key)) continue;
            seen.add(key);
            prune();

            try {
              onNewMessage({ direction, text, source: "dom-observer" });
            } catch (err) {
              log("error", "onNewMessage falhou", err);
            }
          }
        }
      }
    });

    obs.observe(root, { childList: true, subtree: true });
    log("log", "Observer ativo");

    return {
      stop: () => {
        try {
          obs.disconnect();
        } catch {
          // noop
        }
      }
    };
  }

  NS.DOMObserver = { start };
})();

