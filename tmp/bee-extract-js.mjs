import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const context = browser.contexts()[0];
const pages = context.pages();

// Use existing pages first
let page = pages[0];

// Try multiple URLs
const urls = [
  'https://www.beedelivery.com.br/',
  'https://www.beedelivery.com.br/central/home',
  'https://secservices.beedelivery.com.br/',
];

for (const url of urls) {
  try {
    console.log(`\n--- Tentando: ${url} ---`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    console.log('Page URL:', page.url());
    console.log('Page title:', await page.title());

    const scripts = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
    });
    console.log('Scripts:', scripts.length);
    scripts.forEach(s => console.log('  ', s));
  } catch(e) {
    console.log('Erro:', e.message);
  }
}

// Now try to intercept network requests to find API calls
console.log('\n--- Monitorando requisições de rede ---');
page = await context.newPage();

const apiUrls = new Set();
page.on('request', request => {
  const url = request.url();
  if (url.includes('beedelivery') || url.includes('api') || url.includes('v1')) {
    apiUrls.add(url);
  }
});

// Visit main page and click around
await page.goto('https://www.beedelivery.com.br/central/home', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await page.waitForTimeout(5000);

// Check if there's any login form
const html = await page.content();
fs.writeFileSync('C:/Mettri4/tmp/bee-page.html', html, 'utf-8');
console.log('Page HTML saved.');

const apiList = Array.from(apiUrls);
fs.writeFileSync('C:/Mettri4/tmp/bee-network-requests.json', JSON.stringify(apiList, null, 2), 'utf-8');
console.log('API requests captured:', apiList.length);
apiList.forEach(u => console.log('  ', u));

await page.close();
await browser.close();
