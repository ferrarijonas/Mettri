(() => {
  /**
   * WhatsApp DOM API (modo padrão: DOM direto).
   *
   * IMPORTANTÍSSIMO (antifrágil):
   * - O WhatsApp Web muda seletores com frequência.
   * - Então usamos uma lista de seletores por “função” (header, lista de mensagens, input, etc.)
   * - Se nenhum seletor casar, logamos erro e retornamos null/false (sem inventar valores).
   *
   * Seletores usados (e por quê):
   * - Header/título do chat: em geral existe um <header> com um <span title="Nome"> ou data-testid.
   * - Lista de mensagens: normalmente há um container scrollável em main com role="application" e/ou data-testid.
   * - Texto da mensagem: WhatsApp costuma colocar o conteúdo em `span.selectable-text` (ou variações).
   * - Caixa de texto: `div[contenteditable="true"][role="textbox"]` no footer.
   * - Botão enviar: `button[data-testid="send"]` ou ícone `span[data-icon="send"]`.
   */

  const NS = (globalThis.WACRM = globalThis.WACRM || {});

  const SELECTORS = {
    appReady: ["#app", "div[role='application']", "body"],

    header: ["header", "header[role='banner']"],
    chatTitle: [
      "header [data-testid='conversation-info-header-chat-title'] span[title]",
      "header span[title][dir='auto']",
      "header span[title]"
    ],

    // item selecionado no sidebar (tentativa de extrair algum id estável)
    selectedChatCell: ["div[role='gridcell'][aria-selected='true']", "div[aria-selected='true'][role='row']"],

    // lista de mensagens / área principal
    main: ["main", "div[role='main']"],
    messageList: [
      "main [data-testid='conversation-panel-messages']",
      "main [data-testid='msg-container']",
      "main div[role='application']",
      "main"
    ],
    messageBubble: [
      "div[data-testid='msg-container']",
      "div.message-in, div.message-out",
      "div[role='row']"
    ],
    messageText: ["span.selectable-text", "span.selectable-text.copyable-text", "div.copyable-text span"],

    composer: ["footer", "div[role='textbox'][contenteditable='true']"],
    input: [
      "footer div[role='textbox'][contenteditable='true']",
      "div[role='textbox'][contenteditable='true'][data-tab]",
      "footer [contenteditable='true'][data-tab]"
    ],
    sendButton: ["button[data-testid='send']", "button span[data-icon='send']", "span[data-icon='send']"]
  };

  function log(level, ...args) {
    const cfg = NS?.Storage?.getCachedConfig?.();
    const debug = cfg?.debug ?? true;
    if (!debug && level !== "error") return;
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn("[WACRM][wa]", ...args);
  }

  function qsAny(selectors, root = document) {
    for (const sel of selectors) {
      try {
        const el = root.querySelector(sel);
        if (el) return el;
      } catch {
        // seletor inválido -> ignora
      }
    }
    return null;
  }

  function qsaAny(selectors, root = document) {
    for (const sel of selectors) {
      try {
        const els = root.querySelectorAll(sel);
        if (els && els.length) return Array.from(els);
      } catch {
        // ignore
      }
    }
    return [];
  }

  async function waitForReady({ timeoutMs = 30_000, pollMs = 500 } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const el = qsAny(SELECTORS.appReady);
      if (el) return true;
      await new Promise((r) => setTimeout(r, pollMs));
    }
    log("warn", "timeout aguardando WhatsApp Web ficar pronto");
    return false;
  }

  function getChatName() {
    const titleEl = qsAny(SELECTORS.chatTitle, qsAny(SELECTORS.header) || document);
    const name = titleEl?.getAttribute?.("title") || titleEl?.textContent || "";
    return String(name || "").trim() || null;
  }

  function getChatType() {
    // Heurística mínima: se aparecer “Grupo” em algum lugar do header, assume group
    const header = qsAny(SELECTORS.header);
    const txt = (header?.textContent || "").toLowerCase();
    if (txt.includes("grupo")) return "group";
    return "private";
  }

  function getChatId() {
    // Não inventar ID se não existir: tenta extrair de atributos do item selecionado no sidebar.
    const cell = qsAny(SELECTORS.selectedChatCell);
    if (cell) {
      const attrs = ["data-id", "data-jid", "data-assetid", "id"];
      for (const a of attrs) {
        const v = cell.getAttribute?.(a);
        if (v) return String(v);
      }
    }
    return null;
  }

  function getChatContext() {
    const chatId = getChatId();
    const chatName = getChatName();
    const chatType = getChatType();
    if (!chatId) {
      log("warn", "chatId não encontrado no DOM (sem mock). CRM/autoresposta podem ser limitados.");
    }
    return { chatId, chatName, chatType };
  }

  function getMessageListRoot() {
    const main = qsAny(SELECTORS.main);
    const list = qsAny(SELECTORS.messageList, main || document);
    if (!list) log("error", "Não encontrei container de mensagens. Seletores:", SELECTORS.messageList);
    return list;
  }

  function extractTextFromBubble(bubble) {
    const parts = qsaAny(SELECTORS.messageText, bubble).map((n) => (n.textContent || "").trim()).filter(Boolean);
    return parts.join("\n").trim();
  }

  function isIncomingBubble(bubble) {
    if (!bubble) return false;
    if (bubble.classList?.contains("message-in")) return true;
    if (bubble.querySelector?.(".message-in")) return true;
    return false;
  }

  function isOutgoingBubble(bubble) {
    if (!bubble) return false;
    if (bubble.classList?.contains("message-out")) return true;
    if (bubble.querySelector?.(".message-out")) return true;
    return false;
  }

  function getLatestMessages({ limit = 20 } = {}) {
    const root = getMessageListRoot();
    if (!root) return [];

    // Pega bubbles pela primeira lista que existir
    const bubbles = qsaAny(SELECTORS.messageBubble, root);
    if (!bubbles.length) {
      log("error", "Não encontrei bubbles de mensagem. Seletores:", SELECTORS.messageBubble);
      return [];
    }

    const tail = bubbles.slice(Math.max(0, bubbles.length - limit));
    return tail
      .map((b) => {
        const text = extractTextFromBubble(b);
        if (!text) return null;
        const direction = isOutgoingBubble(b) ? "out" : "in";
        return { direction, text };
      })
      .filter(Boolean);
  }

  function getLastIncomingText() {
    const msgs = getLatestMessages({ limit: 30 });
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].direction === "in") return msgs[i].text;
    }
    return null;
  }

  function getConversationPreview({ maxChars = 1200 } = {}) {
    const msgs = getLatestMessages({ limit: 20 });
    const lines = msgs.map((m) => (m.direction === "in" ? `Cliente: ${m.text}` : `Você: ${m.text}`));
    const joined = lines.join("\n");
    return joined.length > maxChars ? joined.slice(-maxChars) : joined;
  }

  function findInput() {
    const input = qsAny(SELECTORS.input);
    if (!input) log("error", "Não encontrei input (composer). Seletores:", SELECTORS.input);
    return input;
  }

  function setComposerText(inputEl, text) {
    // contenteditable: precisa disparar eventos
    inputEl.focus();
    // tenta inserir de forma compatível
    try {
      document.execCommand("insertText", false, text);
    } catch {
      inputEl.textContent = text;
    }
    inputEl.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }

  function clickSend() {
    const btn = qsAny(SELECTORS.sendButton);
    if (btn?.tagName?.toLowerCase() === "button") {
      btn.click();
      return true;
    }
    // se achou só o span do ícone, sobe até o botão
    const parentBtn = btn?.closest?.("button");
    if (parentBtn) {
      parentBtn.click();
      return true;
    }
    log("error", "Não encontrei botão de enviar. Seletores:", SELECTORS.sendButton);
    return false;
  }

  function sendMessage(text) {
    const t = String(text || "").trim();
    if (!t) return false;

    const input = findInput();
    if (!input) return false;

    setComposerText(input, t);
    return clickSend();
  }

  NS.WhatsAppAPI = {
    SELECTORS,
    waitForReady,
    getChatContext,
    getChatName,
    getChatType,
    getChatId,
    getMessageListRoot,
    getLatestMessages,
    getLastIncomingText,
    getConversationPreview,
    sendMessage
  };
})();

