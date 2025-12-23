(() => {
  const NS = (globalThis.WACRM = globalThis.WACRM || {});

  function nowIso() {
    return new Date().toISOString();
  }

  function uid(prefix = "rule") {
    return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
  }

  async function list() {
    const store = await NS.Storage.getWithDefaults("rules");
    return Array.isArray(store) ? store : [];
  }

  async function saveAll(rules) {
    await NS.Storage.set({ rules });
    return rules;
  }

  async function create(rule) {
    const r = rule && typeof rule === "object" ? { ...rule } : {};
    if (!r.name) r.name = "Nova regra";
    if (!r.match) r.match = { type: "contains", value: "" };
    if (!r.replyTemplate) r.replyTemplate = "Olá! Como posso ajudar?";
    if (typeof r.enabled !== "boolean") r.enabled = true;
    if (!r.id) r.id = uid("rule");
    r.createdAt = r.createdAt || nowIso();
    r.updatedAt = nowIso();

    const rules = await list();
    rules.unshift(r);
    await saveAll(rules);
    return r;
  }

  async function update(ruleId, patch) {
    const rules = await list();
    const idx = rules.findIndex((x) => x.id === ruleId);
    if (idx < 0) return null;
    rules[idx] = { ...rules[idx], ...(patch || {}), id: ruleId, updatedAt: nowIso() };
    await saveAll(rules);
    return rules[idx];
  }

  async function remove(ruleId) {
    const rules = await list();
    const filtered = rules.filter((r) => r.id !== ruleId);
    await saveAll(filtered);
    return filtered.length !== rules.length;
  }

  async function setEnabled(ruleId, enabled) {
    return update(ruleId, { enabled: !!enabled });
  }

  if (!NS.Storage.DEFAULTS.rules) {
    NS.Storage.DEFAULTS.rules = [
      {
        id: "rule_preco",
        name: "Quando perguntarem preço",
        enabled: true,
        match: { type: "contains_any", value: ["preço", "valor", "quanto custa"] },
        replyTemplate:
          "Oi {{chat_name}}! Me diga qual produto/serviço você quer e eu te passo o valor certinho. 🙂",
        createdAt: nowIso(),
        updatedAt: nowIso()
      },
      {
        id: "rule_horario",
        name: "Horário de atendimento",
        enabled: true,
        match: { type: "contains_any", value: ["horário", "horario", "atendimento"] },
        replyTemplate: "Atendemos de seg a sex, das 9h às 18h. Quer agendar um horário?",
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
    ];
  }

  NS.Autoresponder = NS.Autoresponder || {};
  NS.Autoresponder.Rules = { list, create, update, remove, setEnabled };
})();

