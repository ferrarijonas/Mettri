(() => {
  const NS = (globalThis.WACRM = globalThis.WACRM || {});

  const MAX_MESSAGES_PER_CHAT = 200;

  function nowMs() {
    return Date.now();
  }

  function uid(prefix = "m") {
    return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
  }

  async function getStore() {
    const store = await NS.Storage.getWithDefaults("history");
    if (store && typeof store === "object") {
      if (!store.chats || typeof store.chats !== "object") store.chats = {};
      return store;
    }
    return { chats: {} };
  }

  async function saveStore(store) {
    await NS.Storage.set({ history: store });
    return store;
  }

  async function addMessage({ chatId, chatName, direction, text, timestampMs, meta }) {
    if (!chatId) return null;
    const store = await getStore();
    const entry = {
      id: uid("msg"),
      chatId,
      chatName: chatName || "",
      direction: direction === "out" ? "out" : "in",
      text: String(text || ""),
      timestampMs: Number.isFinite(timestampMs) ? timestampMs : nowMs(),
      meta: meta && typeof meta === "object" ? meta : {}
    };

    const arr = Array.isArray(store.chats[chatId]) ? store.chats[chatId] : [];
    arr.push(entry);
    // limita tamanho
    while (arr.length > MAX_MESSAGES_PER_CHAT) arr.shift();
    store.chats[chatId] = arr;

    await saveStore(store);

    // feed analytics (se existir)
    try {
      NS.CRM?.Analytics?.ingestMessage?.(entry);
    } catch {
      // noop
    }

    return entry;
  }

  async function listByChat(chatId, { limit = 50 } = {}) {
    if (!chatId) return [];
    const store = await getStore();
    const arr = Array.isArray(store.chats[chatId]) ? store.chats[chatId] : [];
    return arr.slice(Math.max(0, arr.length - limit));
  }

  async function search(query, { limit = 100 } = {}) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return [];
    const store = await getStore();
    const out = [];
    for (const [chatId, msgs] of Object.entries(store.chats || {})) {
      for (const m of msgs || []) {
        if (String(m.text || "").toLowerCase().includes(q)) {
          out.push(m);
          if (out.length >= limit) return out;
        }
      }
    }
    return out;
  }

  async function exportJson() {
    const store = await getStore();
    return JSON.stringify(store, null, 2);
  }

  async function clearChat(chatId) {
    const store = await getStore();
    delete store.chats[chatId];
    await saveStore(store);
    return true;
  }

  async function clearAll() {
    await NS.Storage.set({ history: { chats: {} } });
    return true;
  }

  if (!NS.Storage.DEFAULTS.history) NS.Storage.DEFAULTS.history = { chats: {} };

  NS.CRM = NS.CRM || {};
  NS.CRM.History = { addMessage, listByChat, search, exportJson, clearChat, clearAll };
})();

