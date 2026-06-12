import puppeteer from 'puppeteer';
import fs from 'fs';

const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

console.log('📌 Navegando para Entregas...');
await page.goto('https://www.beedelivery.com.br/central/entregas', { waitUntil: 'load', timeout: 60000 });
await new Promise(r => setTimeout(r, 2000));

// Network capture
console.log('📌 Ativando captura de rede...');
const allReqs = [];
const allResps = [];
const apiReqs = []; // focused on beedelivery API

page.on('request', req => {
  const url = req.url();
  allReqs.push({ url: url, method: req.method(), resourceType: req.resourceType(), postData: req.postData() });
  if (url.includes('beedelivery') || url.includes('api') || url.includes('quote') ||
      url.includes('frete') || url.includes('calcular')) {
    apiReqs.push({ url, method: req.method(), postData: req.postData() });
  }
});

page.on('response', async resp => {
  const url = resp.url();
  const ct = resp.headers()['content-type'] || '';
  if (url.includes('beedelivery') || url.includes('secservices')) {
    try {
      const text = await resp.text();
      if (text.length > 20 && text.length < 20000) {
        allResps.push({ url, status: resp.status(), contentType: ct, body: text.substring(0, 5000) });
      }
    } catch {}
  }
});

// Click "Criar nova entrega"
console.log('📌 Clicando em Criar nova entrega...');
await page.waitForSelector('a:has-text("Criar nova entrega")', { timeout: 10000 }).catch(() => {});
await page.evaluate(() => {
  const els = document.querySelectorAll('a, button');
  for (const el of els) {
    if (el.textContent.includes('Criar nova entrega') || el.textContent.includes('Nova entrega')) {
      el.click();
      return;
    }
  }
});
await new Promise(r => setTimeout(r, 3000));

await page.screenshot({ path: 'C:/Mettri4/tmp/bee-form-vazio.png', fullPage: true });
console.log('📌 Screenshot vazio salvo');

// Discover fields
const campos = await page.evaluate(() => {
  const inputs = document.querySelectorAll('input, select, textarea');
  return Array.from(inputs).map(i => ({
    id: i.id, name: i.name, type: i.type,
    placeholder: i.placeholder, class: i.className,
    visible: i.offsetParent !== null,
    rect: i.offsetParent !== null ? i.getBoundingClientRect() : null,
    label: i.closest('label')?.textContent?.trim() ||
          (i.previousElementSibling?.tagName === 'LABEL' ? i.previousElementSibling.textContent.trim() : '') ||
          (i.closest('.form-group')?.querySelector('label')?.textContent?.trim() || '')
  }));
});
fs.writeFileSync('C:/Mettri4/tmp/bee-campos.json', JSON.stringify(campos, null, 2), 'utf-8');

const visibleFields = campos.filter(c => c.visible && c.type !== 'hidden');
console.log(`📌 ${campos.length} campos (${visibleFields.length} visíveis):`);
visibleFields.forEach(f => console.log(`  - #${f.id} [${f.type}] "${(f.placeholder || f.label).substring(0, 60)}"`));

// Fill destination
console.log('📌 Preenchendo endereço de destino...');
await page.evaluate(() => {
  const el = document.getElementById('destino_descricao_autocomplete');
  if (el) {
    el.value = 'Rua Oscar Alves, 100 - Santa Mônica, Uberlândia';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
});
await new Promise(r => setTimeout(r, 5000));

// Fill complement and obs
await page.evaluate(() => {
  const fields = ['destino_complemento', 'obs'];
  const values = ['Apto 42', 'Teste automático'];
  fields.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) { el.value = values[i]; el.dispatchEvent(new Event('input', { bubbles: true })); }
  });
});

await new Promise(r => setTimeout(r, 3000));
await page.screenshot({ path: 'C:/Mettri4/tmp/bee-form-preenchido.png', fullPage: true });
console.log('📌 Screenshot preenchido salvo');

await new Promise(r => setTimeout(r, 2000));

// Save
fs.writeFileSync('C:/Mettri4/tmp/bee-requests.json', JSON.stringify(allReqs, null, 2), 'utf-8');
fs.writeFileSync('C:/Mettri4/tmp/bee-responses.json', JSON.stringify(allResps, null, 2), 'utf-8');
fs.writeFileSync('C:/Mettri4/tmp/bee-api-reqs.json', JSON.stringify(apiReqs, null, 2), 'utf-8');

const htmlSnippet = await page.evaluate(() => document.body.innerHTML.substring(0, 50000));
fs.writeFileSync('C:/Mettri4/tmp/bee-form.html', htmlSnippet, 'utf-8');

console.log('\n✅ Exploração concluída!');
console.log(`📁 bee-campos.json - ${campos.length} campos (${visibleFields.length} visíveis)`);
console.log(`📁 bee-requests.json - ${allReqs.length} requests (total)`);
console.log(`📁 bee-api-reqs.json - ${apiReqs.length} requests (filtradas)`);
console.log(`📁 bee-responses.json - ${allResps.length} responses`);

// === REPORT ===
console.log('\n══════════════════════════════════════════');
console.log('📋 RELATÓRIO DE EXPLORAÇÃO BEE DELIVERY');
console.log('══════════════════════════════════════════');

// 1. URLs beedelivery/secservices
const beeUrls = [...new Set(allReqs.filter(r =>
  r.url.includes('beedelivery') || r.url.includes('secservices')
).map(r => r.url.split('?')[0]))];
console.log(`\n1. Endpoints beedelivery/secservices (${beeUrls.length}):`);
beeUrls.forEach(u => console.log(`   ${u}`));

// 2. API-like endpoints
const apiEndpoints = [...new Set(allReqs.filter(r =>
  r.url.includes('/api/') || r.url.includes('quote') || r.url.includes('frete') ||
  r.url.includes('calcular') || r.url.includes('price') || r.url.includes('/rest/') ||
  r.url.includes('/v1/') || r.url.includes('/v2/') || r.url.includes('googleAutoComplete')
).map(r => r.url.split('?')[0]))];
console.log(`\n2. Endpoints API/cotação (${apiEndpoints.length}):`);
apiEndpoints.forEach(u => console.log(`   ${u}`));

// 3. Response details
console.log(`\n3. Respostas da API (${allResps.length}):`);
for (const r of allResps) {
  console.log(`   [${r.status}] ${r.url.split('?')[0]}`);
  try {
    const parsed = JSON.parse(r.body);
    console.log(`      ${JSON.stringify(parsed, null, 2).substring(0, 600)}`);
  } catch {
    console.log(`      ${r.body.substring(0, 200)}`);
  }
  console.log('');
}

// 4. Form structure summary
console.log('4. Estrutura do formulário:');
console.log(`   Total de campos: ${campos.length}`);
console.log(`   Campos visíveis: ${visibleFields.length}`);
console.log('   Campos de entrada principais:');
visibleFields.forEach(f => console.log(`   - #${f.id} [${f.type}] "${f.placeholder || f.label}"`));

await page.close();
await browser.disconnect();
