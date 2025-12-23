(() => {
  const NS = (globalThis.WACRM = globalThis.WACRM || {});

  function nowIso() {
    return new Date().toISOString();
  }

  function uid(prefix = "tag") {
    return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
  }

  async function list() {
    const store = await NS.Storage.getWithDefaults("tags");
    return Array.isArray(store) ? store : [];
  }

  async function saveAll(tags) {
    await NS.Storage.set({ tags });
    return tags;
  }

  async function create({ name, color }) {
    const n = String(name || "").trim();
    if (!n) throw new Error("tags.create requer name");
    const tags = await list();
    const existing = tags.find((t) => t.name.toLowerCase() === n.toLowerCase());
    if (existing) return existing;

    const tag = {
      id: uid("tag"),
      name: n,
      color: color || pickColor(n),
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    tags.push(tag);
    await saveAll(tags);
    return tag;
  }

  async function remove(tagId) {
    const tags = await list();
    const filtered = tags.filter((t) => t.id !== tagId);
    await saveAll(filtered);

    // remove tag de contatos
    const contacts = await NS.CRM.Contacts.list();
    let changed = false;
    for (const c of contacts) {
      if (Array.isArray(c.tags) && c.tags.includes(tagId)) {
        c.tags = c.tags.filter((x) => x !== tagId);
        c.updatedAt = nowIso();
        changed = true;
      }
    }
    if (changed) await NS.Storage.set({ contacts });

    return filtered.length !== tags.length;
  }

  async function assignToContact(contactId, tagId) {
    const contact = await NS.CRM.Contacts.getById(contactId);
    if (!contact) return null;
    const tags = Array.isArray(contact.tags) ? contact.tags : [];
    if (!tags.includes(tagId)) tags.push(tagId);
    return NS.CRM.Contacts.update(contactId, { tags });
  }

  async function unassignFromContact(contactId, tagId) {
    const contact = await NS.CRM.Contacts.getById(contactId);
    if (!contact) return null;
    const tags = Array.isArray(contact.tags) ? contact.tags : [];
    return NS.CRM.Contacts.update(contactId, { tags: tags.filter((t) => t !== tagId) });
  }

  function pickColor(seed) {
    const palette = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#14b8a6"];
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  }

  if (!NS.Storage.DEFAULTS.tags) {
    NS.Storage.DEFAULTS.tags = [
      { id: "tag_quente", name: "Lead quente", color: "#ef4444", createdAt: nowIso(), updatedAt: nowIso() },
      { id: "tag_morno", name: "Lead morno", color: "#f59e0b", createdAt: nowIso(), updatedAt: nowIso() },
      { id: "tag_frio", name: "Lead frio", color: "#0ea5e9", createdAt: nowIso(), updatedAt: nowIso() }
    ];
  }

  NS.CRM = NS.CRM || {};
  NS.CRM.Tags = { list, create, remove, assignToContact, unassignFromContact };
})();

