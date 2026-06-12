import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const context = browser.contexts()[0];
const page = context.pages()[0];

const apiCalls = [];

page.on('request', req => {
  const url = req.url();
  if (url.includes('beedelivery.com.br/central/') && 
      (req.resourceType() === 'xhr' || req.resourceType() === 'fetch')) {
    apiCalls.push({ url, method: req.method(), type: req.resourceType() });
  }
});

// Navigate to each section
const sections = [
  '/central/entregas',
  '/central/colmeias/home',  
  '/central/roteirizacao',
  '/central/qrCode',
  '/central/financeiro',
  '/central/usuarios',
  '/central/relatorios',
  '/central/perfil',
];

for (const section of sections) {
  console.log(`\n=== ${section} ===`);
  await page.goto(`https://www.beedelivery.com.br${section}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => console.log(`  Error: ${e.message}`));
  await page.waitForTimeout(2000);
  
  // Try to find and click interactive elements like buttons to trigger API calls
  const buttons = await page.$$('button, a.btn, [onclick]');
  for (const btn of buttons) {
    const text = await btn.textContent().catch(() => '');
    const href = await btn.getAttribute('href').catch(() => '');
    const onclick = await btn.getAttribute('onclick').catch(() => '');
    if (text && (text.toLowerCase().includes('nova') || text.toLowerCase().includes('calcular') || text.toLowerCase().includes('cotar') || text.toLowerCase().includes('salvar') || text.toLowerCase().includes('buscar'))) {
      console.log(`  Found interactive: "${text.trim()}"`);
    }
  }
}

// Save all captured API calls
fs.writeFileSync('C:/Mettri4/tmp/bee-api-calls-detailed.json', JSON.stringify(apiCalls, null, 2), 'utf-8');
console.log(`\nTotal API calls: ${apiCalls.length}`);
const unique = [...new Set(apiCalls.map(r => r.url))];
unique.forEach(u => {
  const match = apiCalls.find(r => r.url === u);
  console.log(`  ${match.method} ${u}`);
});

await browser.close();
