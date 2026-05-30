import puppeteer from 'puppeteer-core';

const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });

const targets = await browser.targets();
console.log('Targets:');
targets.forEach(t => console.log(`  ${t.type()}: ${(t.url() || '').slice(0,120)}`));

// Encontrar service worker ou background page
const extTarget = targets.find(t => 
  (t.type() === 'service_worker' || t.type() === 'background_page') && 
  t.url().includes('hkmaccoimjachimoigeonfeoihgglepgh')
);

if (!extTarget) {
  console.log('❌ Nenhum target da extensão encontrado');
  await browser.disconnect();
  process.exit(1);
}

console.log(`\n✅ Target encontrado: ${extTarget.type()}`);

// Criar CDP session
const cdp = await extTarget.createCDPSession();

// Limpar cache
const result = await cdp.send('Runtime.evaluate', {
  expression: `
    new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(null, (data) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          const keys = Object.keys(data).filter(k => k.startsWith('module_cache_'));
          console.log('[CLEANUP] Caches encontrados:', keys);
          if (keys.length === 0) {
            resolve({ removed: [], message: 'nenhum cache encontrado' });
            return;
          }
          chrome.storage.local.remove(keys, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }
            console.log('[CLEANUP] Limpos:', keys);
            resolve({ removed: keys });
          });
        });
      } catch(e) {
        reject(e.message);
      }
    })
  `,
  awaitPromise: true,
});

console.log('Resultado:', JSON.stringify(result, null, 2));

// Recarregar WA Web
const pages = await browser.pages();
const waPage = pages.find(p => (p.url() || '').includes('web.whatsapp.com'));
if (waPage) {
  console.log('\nRecarregando WA Web...');
  await waPage.reload({ waitUntil: 'networkidle0' });
  console.log('✅ WA Web recarregado');
}

// Verificar bundle rodando
if (waPage) {
  await new Promise(r => setTimeout(r, 4000));
  const check = await waPage.evaluate(async () => {
    try {
      const url = chrome.runtime.getURL('modules/marketing.retomar.js');
      const resp = await fetch(url + '?t=' + Date.now());
      const text = await resp.text();
      return {
        promptNovo: text.includes('Pode mencionar produtos') ? '✅' : '❌',
        relationType: text.includes('relationType') ? '✅' : '❌',
        daysInactive: text.includes('daysInactive') ? '✅' : '❌',
        sizeKB: Math.round(text.length / 1024),
      };
    } catch(e) {
      return { erro: e.message };
    }
  });
  console.log('\nBundle verificado:', JSON.stringify(check, null, 2));
}

await browser.disconnect();
console.log('\n✅ Pronto!');
