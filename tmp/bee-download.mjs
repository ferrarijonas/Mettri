import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const context = browser.contexts()[0];
const page = context.pages()[0];

// Go to main page
await page.goto('https://www.beedelivery.com.br/', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(5000);

// Save HTML
const html = await page.content();
fs.writeFileSync('C:/Mettri4/tmp/bee-main.html', html, 'utf-8');

// Get all scripts
const jsUrls = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
});

// Filter Bee Delivery owned JS (not CDN/analytics)
const beeJs = jsUrls.filter(u => u.includes('beedelivery.com.br'));
console.log('Bee Delivery JS files:', beeJs.length);
beeJs.forEach(u => console.log('  ', u));

// Download each
for (const url of beeJs) {
  try {
    const response = await page.evaluate(async (u) => {
      const r = await fetch(u);
      return await r.text();
    }, url);
    const name = url.split('/').pop() || 'bundle.js';
    fs.writeFileSync(`C:/Mettri4/tmp/bee-${name}`, response, 'utf-8');
    console.log(`Baixado: ${name} (${response.length} chars)`);
  } catch(e) {
    console.log('Erro baixando', url, e.message);
  }
}

await browser.close();
console.log('Done');
