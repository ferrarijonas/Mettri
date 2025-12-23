(() => {
  /**
   * Storage antifrágil:
   * - Usa chrome.storage.local quando disponível
   * - Faz fallback para localStorage (útil em dev/teste)
   * - API promise-based (preparado para migração futura para backend)
   */

  const NS = (globalThis.WACRM = globalThis.WACRM || {});

  const DEFAULTS = {
    config: {
      copilotEnabled: true,
      autoResponderEnabled: false,
      mcpModeEnabled: false,
      openai: { apiKey: "", model: "gpt-4o-mini", temperature: 0.3 },
      debug: true
    }
  };

  function hasChromeStorage() {
    try {
      return !!(globalThis.chrome && chrome.storage && chrome.storage.local);
    } catch {
      return false;
    }
  }

  function log(...args) {
    try {
      if (NS?.Storage?.getCachedConfig?.()?.debug) console.log("[WACRM][storage]", ...args);
    } catch {
      // noop
    }
  }

  // Cache leve para leituras frequentes (ex.: debug)
  let cachedConfig = null;

  async function get(keys) {
    if (!keys) throw new Error("get(keys) requer keys");
    const keyArr = Array.isArray(keys) ? keys : [keys];

    if (hasChromeStorage()) {
      const result = await chrome.storage.local.get(keyArr);
      return result || {};
    }

    const out = {};
    for (const k of keyArr) {
      const raw = localStorage.getItem(`wacrm:${k}`);
      out[k] = raw ? safeJsonParse(raw) : undefined;
    }
    return out;
  }

  async function set(obj) {
    if (!obj || typeof obj !== "object") throw new Error("set(obj) requer objeto");

    if (hasChromeStorage()) {
      await chrome.storage.local.set(obj);
      if (Object.prototype.hasOwnProperty.call(obj, "config")) cachedConfig = obj.config;
      return;
    }

    for (const [k, v] of Object.entries(obj)) {
      localStorage.setItem(`wacrm:${k}`, JSON.stringify(v));
      if (k === "config") cachedConfig = v;
    }
  }

  async function remove(keys) {
    const keyArr = Array.isArray(keys) ? keys : [keys];
    if (hasChromeStorage()) {
      await chrome.storage.local.remove(keyArr);
      if (keyArr.includes("config")) cachedConfig = null;
      return;
    }
    for (const k of keyArr) localStorage.removeItem(`wacrm:${k}`);
    if (keyArr.includes("config")) cachedConfig = null;
  }

  async function getWithDefaults(key) {
    const res = await get([key]);
    if (res[key] === undefined) return structuredClone(DEFAULTS[key]);
    return res[key];
  }

  async function initDefaults() {
    const existing = await get(["config"]);
    if (existing.config === undefined) {
      await set({ config: structuredClone(DEFAULTS.config) });
      cachedConfig = structuredClone(DEFAULTS.config);
      log("defaults inicializados");
    } else {
      cachedConfig = existing.config;
    }
  }

  async function updateConfig(partial) {
    const current = await getWithDefaults("config");
    const next = deepMerge(current, partial || {});
    await set({ config: next });
    return next;
  }

  function getCachedConfig() {
    return cachedConfig;
  }

  function safeJsonParse(raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }

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

  NS.Storage = {
    DEFAULTS,
    initDefaults,
    get,
    set,
    remove,
    getWithDefaults,
    updateConfig,
    getCachedConfig
  };
})();

