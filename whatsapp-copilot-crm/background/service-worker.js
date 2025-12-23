const DEFAULT_CONFIG = {
  copilotEnabled: true,
  autoResponderEnabled: false,
  mcpModeEnabled: false,
  openai: { apiKey: "", model: "gpt-4o-mini", temperature: 0.3 },
  debug: true
};

function deepMerge(base, patch) {
  if (!patch || typeof patch !== "object") return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v) && base && typeof base[k] === "object") {
      out[k] = deepMerge(base[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function getConfig() {
  const { config } = await chrome.storage.local.get(["config"]);
  if (!config) {
    await chrome.storage.local.set({ config: structuredClone(DEFAULT_CONFIG) });
    return structuredClone(DEFAULT_CONFIG);
  }
  // garante chaves novas (migração futura)
  const merged = deepMerge(structuredClone(DEFAULT_CONFIG), config);
  if (JSON.stringify(merged) !== JSON.stringify(config)) {
    await chrome.storage.local.set({ config: merged });
  }
  return merged;
}

async function setConfig(partial) {
  const current = await getConfig();
  const next = deepMerge(current, partial || {});
  await chrome.storage.local.set({ config: next });
  return next;
}

function log(cfg, ...args) {
  if (cfg?.debug) console.log("[WACRM][sw]", ...args);
}

chrome.runtime.onInstalled.addListener(async () => {
  await getConfig();
});

chrome.runtime.onMessage.addListener((message, sender) => {
  return (async () => {
    const cfg = await getConfig();

    if (!message || typeof message !== "object") return { ok: false, error: "Mensagem inválida" };

    switch (message.type) {
      case "GET_CONFIG": {
        return { ok: true, config: cfg };
      }
      case "SET_CONFIG": {
        const next = await setConfig(message.payload || {});
        return { ok: true, config: next };
      }
      case "OPENAI_SUGGEST": {
        if (!cfg.copilotEnabled) return { ok: true, suggestions: [] };
        const apiKey = cfg?.openai?.apiKey;
        if (!apiKey) return { ok: false, error: "API key do OpenAI não configurada" };

        const p = message.payload || {};
        const lastIncomingText = String(p.lastIncomingText || "").trim();
        const conversationPreview = String(p.conversationPreview || "").trim();
        const maxSuggestions = Math.max(1, Math.min(5, Number(p.maxSuggestions || 3)));

        const system = [
          "Você é um copiloto de atendimento no WhatsApp.",
          "Gere respostas curtas, educadas e objetivas em PT-BR.",
          "Retorne APENAS um JSON array de strings, sem texto extra."
        ].join(" ");

        const user = [
          `Contexto: chat_name="${p.chatName || ""}", chat_type="${p.chatType || ""}"`,
          `Última mensagem recebida: ${lastIncomingText || "(vazia)"}`,
          "Prévia da conversa (pode estar truncada):",
          conversationPreview || "(sem prévia)",
          `Gere ${maxSuggestions} sugestões diferentes.`
        ].join("\n");

        try {
          const suggestions = await openAiSuggest({
            apiKey,
            model: cfg?.openai?.model || "gpt-4o-mini",
            temperature: Number(cfg?.openai?.temperature ?? 0.3),
            system,
            user
          });

          return { ok: true, suggestions };
        } catch (err) {
          log(cfg, "OPENAI_SUGGEST erro", err);
          return { ok: false, error: err?.message || String(err) };
        }
      }
      case "WACRM_NOTIFY": {
        const title = String(message.payload?.title || "WACRM");
        const body = String(message.payload?.body || "");
        try {
          await chrome.notifications.create({
            type: "basic",
            iconUrl: "assets/icons/icon-128.png",
            title,
            message: body
          });
        } catch (e) {
          // ícone pode não existir no MVP — não falhar por isso
          log(cfg, "notify falhou", e);
        }
        return { ok: true };
      }
      default:
        return { ok: false, error: `Tipo desconhecido: ${message.type}` };
    }
  })();
});

async function openAiSuggest({ apiKey, model, temperature, system, user }) {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`OpenAI HTTP ${resp.status}: ${text || resp.statusText}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  const parsed = tryParseJsonArray(content);
  if (parsed) return normalizeSuggestions(parsed);

  // fallback: tenta extrair linhas
  return normalizeSuggestions(String(content || "").split("\n").map((s) => s.trim()).filter(Boolean));
}

function tryParseJsonArray(text) {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function normalizeSuggestions(arr) {
  const out = [];
  for (const s of arr) {
    const t = String(s || "").trim();
    if (!t) continue;
    if (!out.includes(t)) out.push(t);
    if (out.length >= 5) break;
  }
  return out;
}

