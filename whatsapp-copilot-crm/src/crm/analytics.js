(() => {
  const NS = (globalThis.WACRM = globalThis.WACRM || {});

  function dayKey(tsMs) {
    const d = new Date(tsMs);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  async function getStore() {
    const store = await NS.Storage.getWithDefaults("analytics");
    if (store && typeof store === "object") {
      if (!store.totals) store.totals = { in: 0, out: 0 };
      if (!store.daily) store.daily = {};
      return store;
    }
    return { totals: { in: 0, out: 0 }, daily: {} };
  }

  async function saveStore(store) {
    await NS.Storage.set({ analytics: store });
    return store;
  }

  async function ingestMessage(entry) {
    if (!entry) return;
    const dir = entry.direction === "out" ? "out" : "in";
    const ts = Number.isFinite(entry.timestampMs) ? entry.timestampMs : Date.now();
    const k = dayKey(ts);

    const store = await getStore();
    store.totals[dir] = (store.totals[dir] || 0) + 1;
    store.daily[k] = store.daily[k] || { in: 0, out: 0 };
    store.daily[k][dir] = (store.daily[k][dir] || 0) + 1;

    await saveStore(store);
  }

  async function getSummary({ days = 7 } = {}) {
    const store = await getStore();
    const keys = Object.keys(store.daily || {}).sort();
    const last = keys.slice(Math.max(0, keys.length - days));
    const series = last.map((k) => ({ day: k, in: store.daily[k]?.in || 0, out: store.daily[k]?.out || 0 }));
    return {
      totals: store.totals,
      series
    };
  }

  async function reset() {
    const store = { totals: { in: 0, out: 0 }, daily: {} };
    await saveStore(store);
    return store;
  }

  if (!NS.Storage.DEFAULTS.analytics) NS.Storage.DEFAULTS.analytics = { totals: { in: 0, out: 0 }, daily: {} };

  NS.CRM = NS.CRM || {};
  NS.CRM.Analytics = { ingestMessage, getSummary, reset };
})();

