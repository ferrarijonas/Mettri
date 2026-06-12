import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const context = browser.contexts()[0];
const page = context.pages()[0];

// Intercept ALL requests including POST
const requests = [];
page.on('request', req => {
  const url = req.url();
  if (url.includes('beedelivery.com.br/central/')) {
    try {
      requests.push({ 
        url, 
        method: req.method(), 
        type: req.resourceType(),
        postData: req.postData()?.substring(0, 500) || null
      });
    } catch(e) {}
  }
});

await page.goto('https://www.beedelivery.com.br/central/entregas', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

// Click "Nova entrega" button
const btns = await page.$$('a, button');
for (const btn of btns) {
  const text = await btn.textContent().catch(() => '');
  if (text && text.includes('Nova entrega')) {
    console.log('Clicking:', text.trim());
    await btn.click();
    break;
  }
}
await page.waitForTimeout(5000);

// Save HTML
let html = await page.content();
fs.writeFileSync('C:/Mettri4/tmp/bee-nova-entrega.html', html, 'utf-8');
console.log('Saved nova-entrega page');

// Look for form related to delivery
try {
  // Type something in first input to trigger autocomplete or search
  const inputs = await page.$$('input');
  if (inputs.length > 0) {
    console.log(`Found ${inputs.length} inputs`);
    for (const input of inputs.slice(0, 5)) {
      const placeholder = await input.getAttribute('placeholder').catch(() => '');
      const id = await input.getAttribute('id').catch(() => '');
      console.log(`  Input: id="${id}" placeholder="${placeholder}"`);
    }
  }
} catch(e) {}

// Save requests
fs.writeFileSync('C:/Mettri4/tmp/bee-nova-entrega-requests.json', JSON.stringify(requests, null, 2), 'utf-8');
console.log(`\nRequests captured: ${requests.length}`);
requests.forEach(r => console.log(`  ${r.method} ${r.url}`));

await browser.close();
