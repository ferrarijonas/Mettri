import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const [page] = browser.contexts()[0].pages();

// Navegar primeiro para central
await page.goto('https://www.beedelivery.com.br/central/colmeias/home', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Extrair CSRF token e XSRF-TOKEN cookie
const tokens = await page.evaluate(() => {
  const metaToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  const inputToken = document.querySelector('input[name="_token"]')?.value;
  return { metaToken, inputToken };
});
console.log('Meta CSRF:', tokens.metaToken?.substring(0, 20) + '...');
console.log('Input CSRF:', tokens.inputToken?.substring(0, 20) + '...');

// Extrair cookies
const cookies = await browser.contexts()[0].cookies();
const xsrfCookie = cookies.find(c => c.name === 'XSRF-TOKEN' && c.domain.includes('beedelivery'));
const sessionCookie = cookies.find(c => c.name === 'bee_session' && c.domain.includes('beedelivery'));
const allCookies = cookies.filter(c => c.domain.includes('beedelivery') || c.domain.includes('secservices'));

console.log('XSRF-TOKEN cookie:', xsrfCookie?.value?.substring(0, 20) + '...');
console.log('bee_session cookie:', sessionCookie?.value?.substring(0, 20) + '...');

const csrfToken = tokens.metaToken || tokens.inputToken;

// Montar cookie string
const cookieStr = allCookies.map(c => `${c.name}=${c.value}`).join('; ');
console.log('Cookie string length:', cookieStr.length);

// Extrair coordenadas e dados da empresa do HTML
const dados = await page.evaluate(() => {
  const html = document.body.innerHTML;
  
  // Procurar latitude/longitude da empresa
  let lat = null, lng = null;
  const latMatch = html.match(/["']?latitude["']?["':\s]+(-?\d+\.\d+)/i);
  const lngMatch = html.match(/["']?longitude["']?["':\s]+(-?\d+\.\d+)/i);
  if (latMatch) lat = latMatch[1];
  if (lngMatch) lng = lngMatch[1];
  
  return { lat, lng, htmlFirst500: html.substring(0, 500) };
});
console.log('Coordenadas encontradas:', dados);

// Tentar extrair dados de um script com dados da empresa
const empresaInfo = await page.evaluate(() => {
  // Procurar em dados Vue ou Laravel
  for (const script of document.querySelectorAll('script')) {
    const text = script.textContent || '';
    if (text.includes('empresa') || text.includes('company')) {
      // Procurar objeto JSON com dados da empresa
      const match = text.match(/(?:empresa|company|franquia)\s*:\s*\{[^}]+\}/i);
      if (match) return match[0].substring(0, 300);
    }
  }
  return null;
});
console.log('Empresa info:', empresaInfo);

// Testar cotação com headers corretos
console.log('\n📌 Testando cotação com headers completos...');

const quoteResult = await page.evaluate(async ({ token, cookieStr, dados }) => {
  const url = 'https://www.beedelivery.com.br/central/entregas/coleta/calcular';
  
  // Coordenadas da empresa (Uberlândia)
  const latOrigem = dados.lat || '-18.9188';
  const lngOrigem = dados.lng || '-48.2768';
  const latDestino = '-18.9200';
  const lngDestino = '-48.2800';
  
  const body = JSON.stringify({
    latitude_origem: latOrigem,
    longitude_origem: lngOrigem,
    latitude_destino: latDestino,
    longitude_destino: lngDestino,
    tipo_transporte: 'MB',     // Moto/Bike
    sn_volta: 'N',             // Sem volta
    sn_coleta: 'N',            // Sem coleta
    vltotal_produto: 0
  });

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': token || '',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json',
        'Referer': 'https://www.beedelivery.com.br/central/colmeias/home'
      },
      credentials: 'include',
      body: body
    });
    const text = await r.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    
    return { 
      status: r.status, 
      statusText: r.statusText,
      headers: Object.fromEntries(r.headers.entries()),
      body: typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : text.substring(0, 2000)
    };
  } catch(e) {
    return { error: e.message };
  }
}, { token: csrfToken, cookieStr, dados: dados });

console.log('Resultado cotação:', JSON.stringify(quoteResult, null, 2));
fs.writeFileSync('C:/Mettri4/tmp/bee-quote-result.json', JSON.stringify(quoteResult, null, 2), 'utf-8');

await browser.close();
