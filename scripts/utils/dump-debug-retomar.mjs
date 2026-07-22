import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', '..', '.karma', 'tmp', 'debug-retomar.jsonl');

const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });

const targets = await browser.targets();
const extTarget = targets.find(t =>
  (t.type() === 'service_worker' || t.type() === 'background_page') &&
  t.url().includes('hkmaccoimjachimoigeonfeoihgglepgh')
);

if (!extTarget) {
  console.log('❌ Extensão não encontrada. Chrome em modo debug? (porta 9222)');
  await browser.disconnect();
  process.exit(1);
}

const cdp = await extTarget.createCDPSession();

const result = await cdp.send('Runtime.evaluate', {
  expression: `
    new Promise((resolve, reject) => {
      chrome.storage.local.get(['mettri_debug_retomar'], (data) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(data.mettri_debug_retomar || '');
      });
    })
  `,
  awaitPromise: true,
});

const data = result?.result?.value ?? '';

if (!data) {
  console.log('📭 Nenhum debug armazenado.');
  await browser.disconnect();
  process.exit(0);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, data, 'utf-8');

const lines = data.split('\n').filter(Boolean).length;
console.log(`✅ ${lines} entradas salvas em: ${OUT}`);

// Limpar storage após dump
await cdp.send('Runtime.evaluate', {
  expression: `
    new Promise((resolve) => {
      chrome.storage.local.remove(['mettri_debug_retomar'], () => resolve());
    })
  `,
  awaitPromise: true,
});
console.log('🧹 Storage limpo.');

await browser.disconnect();
