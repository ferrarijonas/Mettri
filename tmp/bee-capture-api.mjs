import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const context = browser.contexts()[0];
const page = context.pages()[0];

const apiCalls = new Set();
const allRequests = [];

page.on('request', req => {
  const url = req.url();
  allRequests.push({ url, method: req.method(), type: req.resourceType() });
  if (url.includes('beedelivery.com.br/central/') && 
      req.resourceType() === 'xhr' || req.resourceType() === 'fetch') {
    apiCalls.add(url);
  }
});

// Start at the deliveries page
await page.goto('https://www.beedelivery.com.br/central/entregas', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

// Navigate to colmeias/home (the actual dashboard)
console.log('Navigating to colmeias/home...');
await page.goto('https://www.beedelivery.com.br/central/colmeias/home', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(5000);

// Click on "Nova Entrega" or "Nova entrega" button
const buttons = await page.$$('a, button');
for (const btn of buttons) {
  const text = await btn.textContent();
  if (text && text.toLowerCase().includes('nova') && text.toLowerCase().includes('entrega')) {
    console.log('Found new delivery button:', text.trim());
    await btn.click();
    break;
  }
}
await page.waitForTimeout(5000);

// Try some menu navigation
const menuLinks = await page.$$('a');
for (const link of menuLinks) {
  const href = await link.getAttribute('href');
  if (href && href.includes('central/')) {
    console.log('Menu link:', href);
  }
}

// Save all API calls
const apiList = Array.from(apiCalls);
fs.writeFileSync('C:/Mettri4/tmp/bee-api-calls.json', JSON.stringify(apiList, null, 2), 'utf-8');
console.log('\nAPI calls captured:', apiList.length);
apiList.forEach(u => console.log('  ', u));

await browser.close();
