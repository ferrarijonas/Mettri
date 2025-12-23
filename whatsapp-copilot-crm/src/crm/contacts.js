(() => {
  const NS = (globalThis.WACRM = globalThis.WACRM || {});

  function nowIso() {
    return new Date().toISOString();
  }

  function uid(prefix = "c") {
    return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
  }

  async function list() {
    const store = await NS.Storage.getWithDefaults("contacts");
    return Array.isArray(store) ? store : [];
  }

  async function saveAll(contacts) {
    await NS.Storage.set({ contacts });
    return contacts;
  }

  async function getById(contactId) {
    const contacts = await list();
    return contacts.find((c) => c.id === contactId) || null;
  }

  async function upsert(contact) {
    if (!contact || typeof contact !== "object") throw new Error("contacts.upsert(contact) requer objeto");

    const contacts = await list();
    const next = { ...contact };
    if (!next.id) next.id = uid("contact");
    if (!next.createdAt) next.createdAt = nowIso();
    next.updatedAt = nowIso();
    if (!Array.isArray(next.tags)) next.tags = [];

    const idx = contacts.findIndex((c) => c.id === next.id);
    if (idx >= 0) contacts[idx] = { ...contacts[idx], ...next };
    else contacts.unshift(next);

    await saveAll(contacts);
    return next;
  }

  async function update(contactId, patch) {
    const contacts = await list();
    const idx = contacts.findIndex((c) => c.id === contactId);
    if (idx < 0) return null;
    contacts[idx] = { ...contacts[idx], ...(patch || {}), id: contactId, updatedAt: nowIso() };
    if (!Array.isArray(contacts[idx].tags)) contacts[idx].tags = [];
    await saveAll(contacts);
    return contacts[idx];
  }

  async function remove(contactId) {
    const contacts = await list();
    const filtered = contacts.filter((c) => c.id !== contactId);
    await saveAll(filtered);
    return filtered.length !== contacts.length;
  }

  async function search(query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return list();
    const contacts = await list();
    return contacts.filter((c) => {
      const blob = [
        c.name,
        c.phone,
        c.company,
        c.title,
        c.notes,
        ...(Array.isArray(c.tags) ? c.tags : [])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }

  /**
   * Constrói/atualiza contato a partir do contexto do chat (módulo obrigatório).
   * - chatId: id estável (ex.: jid/serialized)
   * - chatName: nome no topo do chat
   * - chatType: "private" | "group" | "unknown"
   */
  async function ensureFromChatContext({ chatId, chatName, chatType }) {
    if (!chatId) return null;
    const contacts = await list();
    const existing = contacts.find((c) => c.chatId === chatId) || null;

    const patch = {
      chatId,
      name: chatName || existing?.name || "",
      chatType: chatType || existing?.chatType || "unknown",
      lastSeenAt: nowIso()
    };

    if (!existing) {
      const created = await upsert({
        id: uid("contact"),
        ...patch,
        tags: []
      });
      return created;
    }

    return update(existing.id, patch);
  }

  // defaults (para o storage layer)
  if (!NS.Storage.DEFAULTS.contacts) NS.Storage.DEFAULTS.contacts = [];

  NS.CRM = NS.CRM || {};
  NS.CRM.Contacts = {
    list,
    getById,
    upsert,
    update,
    remove,
    search,
    ensureFromChatContext
  };
})();

