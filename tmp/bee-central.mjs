import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const context = browser.contexts()[0];
const page = context.pages()[0];

// Intercept all network requests
const requests = [];
page.on('request', req => {
  const url = req.url();
  if (url.includes('beedelivery') || url.includes('api')) {
    requests.push({ url, method: req.method(), type: req.resourceType() });
  }
});

// Go to central selecionar first
console.log('Navigating to /central/selecionar...');
await page.goto('https://www.beedelivery.com.br/central/selecionar', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
console.log('Page URL:', page.url());
console.log('Page title:', await page.title());

// Save HTML
const html = await page.content();
fs.writeFileSync('C:/Mettri4/tmp/bee-central.html', html, 'utf-8');

// Get all scripts
const jsUrls = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
});
console.log('Scripts found:', jsUrls.length);
const beeUrls = jsUrls.filter(u => u.includes('beedelivery.com.br'));
beeUrls.forEach(u => console.log('  ', u));

// Download each bee JS file
for (const url of beeUrls) {
  try {
    const response = await page.evaluate(async (u) => {
      const r = await fetch(u);
      return await r.text();
    }, url);
    const name = url.split('/').pop() || 'bundle.js';
    fs.writeFileSync(`C:/Mettri4/tmp/bee-central-${name}`, response, 'utf-8');
    console.log(`Baixado: ${name} (${response.length} chars)`);
  } catch(e) {
    console.log('Erro baixando', url, e.message);
  }
}

// Save network requests
fs.writeFileSync('C:/Mettri4/tmp/bee-central-requests.json', JSON.stringify(requests, null, 2), 'utf-8');
console.log('Network requests captured:', requests.length);

// Try clicking on a franquia to go to home/dashboard
const links = await page.$$('a');
for (const link of links) {
  const href = await link.getAttribute('href');
  if (href && href.includes('home')) {
    console.log('Found home link:', href);
    await link.click();
    break;
  }
}
await page.waitForTimeout(5000);
console.log('After click URL:', page.url());

await browser.close();
