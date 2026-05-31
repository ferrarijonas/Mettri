import puppeteer from 'puppeteer-core';

const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });

const pages = await browser.pages();
const waPage = pages.find(p => (p.url() || '').includes('web.whatsapp.com'));
if (!waPage) {
  console.log('❌ WA Web não encontrado');
  await browser.disconnect();
  process.exit(1);
}
console.log('✅ WA Web encontrado:', waPage.url().slice(0, 80));

// Verificar extensão e bundle
const check = await waPage.evaluate(async () => {
  const checks = {};
  checks.shadowHost = !!document.querySelector('#mettri-shadow-host');
  const host = document.querySelector('#mettri-shadow-host');
  if (host?.shadowRoot) {
    const modules = host.shadowRoot.querySelectorAll('[data-module-id]');
    checks.modulesFound = modules.length;
    checks.moduleIds = Array.from(modules).map(el => el.getAttribute('data-module-id'));
  }
  return checks;
});
console.log('\n--- Extensão ---');
console.log(JSON.stringify(check, null, 2));

// Tentar acessar chrome.storage via page.evaluate
const storageResult = await waPage.evaluate(async () => {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise((resolve) => {
        chrome.storage.local.get(null, (data) => {
          const keys = Object.keys(data).filter(k => k.startsWith('module_cache_'));
          resolve({ chromeDisponivel: true, cachesEncontrados: keys });
        });
      });
    }
    return { chromeDisponivel: false };
  } catch(e) {
    return { chromeDisponivel: false, erro: e.message };
  }
});
console.log('\n--- Storage ---');
console.log(JSON.stringify(storageResult, null, 2));

// Tentar acessar bundle
const bundleCheck = await waPage.evaluate(async () => {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      const url = chrome.runtime.getURL('modules/marketing.retomar.js');
      const resp = await fetch(url + '?t=' + Date.now());
      if (!resp.ok) return { erro: `HTTP ${resp.status}` };
      const text = await resp.text();
      return {
        promptNovo: text.includes('Pode mencionar produtos'),
        relationType: text.includes('relationType'),
        daysInactive: text.includes('daysInactive'),
        promptAntigoRemovido: !text.includes('NUNCA invente produtos'),
        sizeKB: Math.round(text.length / 1024),
      };
    }
    return { erro: 'chrome.runtime indisponível' };
  } catch(e) {
    return { erro: e.message };
  }
});
console.log('\n--- Bundle ---');
console.log(JSON.stringify(bundleCheck, null, 2));

await browser.disconnect();
console.log('\n✅ Finalizado');
