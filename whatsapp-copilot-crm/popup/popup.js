/* global WACRM */
(() => {
  const $ = (id) => document.getElementById(id);

  const el = {
    copilotEnabled: $("copilotEnabled"),
    autoResponderEnabled: $("autoResponderEnabled"),
    debug: $("debug"),
    openaiKey: $("openaiKey"),
    openaiModel: $("openaiModel"),
    openaiTemp: $("openaiTemp"),
    saveConfig: $("saveConfig"),
    reload: $("reload"),
    status: $("status"),
    suggestions: $("suggestions"),
    ctxHint: $("ctxHint"),
    analytics: $("analytics"),
    rules: $("rules"),
    exportHistory: $("exportHistory"),
    resetAnalytics: $("resetAnalytics")
  };

  function setStatus(msg, kind = "info") {
    el.status.textContent = msg || "";
    el.status.className = `status ${kind === "ok" ? "ok" : kind === "err" ? "err" : ""}`;
  }

  async function getConfig() {
    const res = await chrome.runtime.sendMessage({ type: "GET_CONFIG" });
    if (!res?.ok) throw new Error(res?.error || "GET_CONFIG falhou");
    return res.config;
  }

  async function setConfig(partial) {
    const res = await chrome.runtime.sendMessage({ type: "SET_CONFIG", payload: partial });
    if (!res?.ok) throw new Error(res?.error || "SET_CONFIG falhou");
    return res.config;
  }

  async function getActiveWhatsAppTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const t = tabs?.[0];
    if (!t?.id) return null;
    if (!String(t.url || "").includes("web.whatsapp.com")) return null;
    return t;
  }

  async function getChatContextFromTab(tabId) {
    try {
      const res = await chrome.tabs.sendMessage(tabId, { type: "GET_CONTEXT" });
      return res?.ok ? res.context : null;
    } catch {
      return null;
    }
  }

  async function loadSuggestionsForContext(ctx) {
    el.suggestions.innerHTML = "";
    if (!ctx?.chatId) {
      el.ctxHint.textContent = "chat_id não encontrado no DOM (sem mock). Abra outro chat ou aguarde.";
      el.ctxHint.style.display = "block";
      return;
    }

    el.ctxHint.textContent = `Chat: ${ctx.chatName || "(sem nome)"} • ${ctx.chatType || "unknown"}`;
    el.ctxHint.style.display = "block";

    const { suggestions } = await chrome.storage.local.get(["suggestions"]);
    const item = suggestions?.[ctx.chatId];
    const list = item?.suggestions || [];

    if (!list.length) {
      el.suggestions.innerHTML = `<div class="hint">Sem sugestões ainda. Quando chegar uma nova mensagem, o copiloto gera.</div>`;
      return;
    }

    for (const s of list) {
      const div = document.createElement("div");
      div.className = "pill";
      div.textContent = s;
      const small = document.createElement("div");
      small.className = "small";
      small.textContent = item.updatedAt ? `Atualizado: ${new Date(item.updatedAt).toLocaleString()}` : "";
      div.appendChild(small);
      el.suggestions.appendChild(div);
    }
  }

  async function loadAnalytics() {
    const { analytics } = await chrome.storage.local.get(["analytics"]);
    const totals = analytics?.totals || { in: 0, out: 0 };

    el.analytics.innerHTML = "";
    el.analytics.appendChild(metric("Recebidas", totals.in || 0));
    el.analytics.appendChild(metric("Enviadas", totals.out || 0));
  }

  function metric(label, value) {
    const div = document.createElement("div");
    div.className = "metric";
    div.innerHTML = `<div class="k">${escapeHtml(label)}</div><div class="v">${escapeHtml(String(value))}</div>`;
    return div;
  }

  async function loadRules() {
    const rules = await WACRM.Autoresponder.Rules.list();
    el.rules.innerHTML = "";
    for (const r of rules) {
      const row = document.createElement("div");
      row.className = "rule";

      const left = document.createElement("div");
      left.innerHTML = `<div class="name">${escapeHtml(r.name || "Regra")}</div>
        <div class="desc">${escapeHtml(describeRule(r))}</div>`;

      const right = document.createElement("div");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!r.enabled;
      cb.addEventListener("change", async () => {
        await WACRM.Autoresponder.Rules.setEnabled(r.id, cb.checked);
        setStatus("Regra atualizada", "ok");
      });
      right.appendChild(cb);

      row.appendChild(left);
      row.appendChild(right);
      el.rules.appendChild(row);
    }
  }

  function describeRule(r) {
    const m = r.match || {};
    if (m.type === "contains_any") return `Se conter: ${(m.value || []).join(", ")}`;
    if (m.type === "contains") return `Se conter: ${m.value || ""}`;
    if (m.type === "regex") return `Regex: ${m.value || ""}`;
    return "Condição não configurada";
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function init() {
    setStatus("Carregando…");
    await WACRM.Storage.initDefaults();

    const cfg = await getConfig();
    el.copilotEnabled.checked = !!cfg.copilotEnabled;
    el.autoResponderEnabled.checked = !!cfg.autoResponderEnabled;
    el.debug.checked = !!cfg.debug;
    el.openaiKey.value = cfg?.openai?.apiKey || "";
    el.openaiModel.value = cfg?.openai?.model || "gpt-4o-mini";
    el.openaiTemp.value = String(cfg?.openai?.temperature ?? 0.3);

    await loadAnalytics();
    await loadRules();

    const tab = await getActiveWhatsAppTab();
    if (!tab) {
      setStatus("Abra o WhatsApp Web para ver o contexto.", "info");
      return;
    }
    const ctx = await getChatContextFromTab(tab.id);
    await loadSuggestionsForContext(ctx);
    setStatus("Pronto", "ok");
  }

  el.saveConfig.addEventListener("click", async () => {
    try {
      setStatus("Salvando…");
      const partial = {
        copilotEnabled: el.copilotEnabled.checked,
        autoResponderEnabled: el.autoResponderEnabled.checked,
        debug: el.debug.checked,
        openai: {
          apiKey: el.openaiKey.value.trim(),
          model: el.openaiModel.value.trim() || "gpt-4o-mini",
          temperature: Number(el.openaiTemp.value || 0.3)
        }
      };
      await setConfig(partial);
      setStatus("Configuração salva", "ok");
    } catch (e) {
      setStatus(e?.message || String(e), "err");
    }
  });

  el.reload.addEventListener("click", () => init());

  el.exportHistory.addEventListener("click", async () => {
    const { history } = await chrome.storage.local.get(["history"]);
    const blob = new Blob([JSON.stringify(history || {}, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wacrm-history-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Histórico exportado", "ok");
  });

  el.resetAnalytics.addEventListener("click", async () => {
    await chrome.storage.local.set({ analytics: { totals: { in: 0, out: 0 }, daily: {} } });
    await loadAnalytics();
    setStatus("Analytics resetado", "ok");
  });

  document.addEventListener("DOMContentLoaded", init);
})();

