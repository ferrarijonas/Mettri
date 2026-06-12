import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const context = browser.contexts()[0];
const pages = context.pages();

// Encontrar a aba da Bee Delivery
let beePage = null;
for (const p of pages) {
  const url = p.url();
  if (url.includes('beedelivery')) {
    beePage = p;
    console.log('📌 Aba encontrada:', url);
    break;
  }
}

if (!beePage) {
  console.log('❌ Aba da Bee Delivery não encontrada!');
  console.log('Abas abertas:');
  for (const p of pages) console.log('  -', p.url());
  await browser.close();
  process.exit(1);
}

const page = beePage;

// Capturar requisições relevantes
const captured = [];
page.on('request', req => {
  const url = req.url();
  if (url.includes('beedelivery') || url.includes('secservices')) {
    const body = req.postData();
    console.log(`🌐 ${req.method()} ${url.split('?')[0]}`);
    if (body) console.log(`   Body: ${body.substring(0, 500)}`);
    captured.push({
      time: Date.now(),
      method: req.method(),
      url: url.split('?')[0],
      body: body || null,
      type: 'request'
    });
  }
});

page.on('response', async resp => {
  const url = resp.url();
  if (url.includes('beedelivery') || url.includes('secservices')) {
    let body = '';
    try {
      body = await resp.text();
    } catch {}
    const status = resp.status();
    console.log(`📥 ${status} ${url.split('?')[0]}`);
    if (body && body.length < 5000 && body.startsWith('{')) {
      console.log(`   Resposta: ${body.substring(0, 1000)}`);
    }
    captured.push({
      time: Date.now(),
      status: status,
      url: url.split('?')[0],
      body: body.substring(0, 5000),
      type: 'response'
    });
  }
});

console.log('📌 Monitorando rede da Bee Delivery...');
console.log('📌 Pode fazer a entrega agora! Vou capturar tudo.');
console.log('📌 Monitorando por 3 minutos...');

// Aguardar 3 minutos
await page.waitForTimeout(180000);

// Salvar capturas
fs.writeFileSync('C:/Mettri4/tmp/bee-monitor.json', JSON.stringify(captured, null, 2), 'utf-8');
console.log(`\n📌 ${captured.length} eventos capturados`);
console.log('📌 Salvo em tmp/bee-monitor.json');

// Resumo
console.log('\n📌 RESUMO:');
for (const c of captured) {
  if (c.body && (c.body.includes('total_empresa') || c.body.includes('saldoSuficiente') || c.body.includes('entrega_id') || c.body.includes('success'))) {
    console.log(`\n✅ ${c.method || 'RESP'} ${c.url}`);
    console.log(`   ${c.body.substring(0, 2000)}`);
  }
}

await browser.close();
