import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const [page] = browser.contexts()[0].pages();

// 1. Extrair CSRF token e cookies da sessão ativa
console.log('📌 Extraindo token e cookies...');

const csrfToken = await page.evaluate(() => {
  // Procurar em meta tags
  const meta = document.querySelector('meta[name="csrf-token"]');
  if (meta) return meta.getAttribute('content');
  // Procurar em input hidden
  const input = document.querySelector('input[name="_token"]');
  if (input) return input.value;
  // Procurar no window
  return window.csrfToken || window.Laravel?.csrfToken || null;
});
console.log('CSRF Token:', csrfToken ? csrfToken.substring(0, 20) + '...' : 'NÃO ENCONTRADO');

// Extrair cookies do contexto do navegador
const cookies = await browser.contexts()[0].cookies();
const sessionCookie = cookies.find(c => c.name.includes('session') || c.name === 'XSRF-TOKEN' || c.name === 'laravel_session');
const xsrfCookie = cookies.find(c => c.name === 'XSRF-TOKEN');

console.log('Cookies encontrados:', cookies.length);
cookies.forEach(c => console.log(`  ${c.name}: ${c.value.substring(0, 30)}... (${c.domain})`));

// Salvar cookies e token
const sessionData = {
  csrfToken,
  cookies: cookies.map(c => ({ name: c.name, value: c.value, domain: c.domain, path: c.path })),
  xsrfCookie: xsrfCookie?.value
};
fs.writeFileSync('C:/Mettri4/tmp/bee-session.json', JSON.stringify(sessionData, null, 2), 'utf-8');

// 2. Pegar dados da empresa do HTML
const empresaData = await page.evaluate(() => {
  const html = document.body.innerHTML;
  const matches = {
    empresaId: html.match(/empresa[Ii][Dd]\s*[=:]\s*["']?(\d+)/)?.[1],
    franquiaId: html.match(/franquia[Ii][Dd]\s*[=:]\s*["']?(\d+)/)?.[1],
    userId: html.match(/user[Ii][Dd]\s*[=:]\s*["']?(\d+)/)?.[1]
  };
  return matches;
});
console.log('📌 Dados da empresa:', empresaData);
fs.writeFileSync('C:/Mettri4/tmp/bee-empresa.json', JSON.stringify(empresaData, null, 2), 'utf-8');

// 3. Extrair coordenadas da empresa (endereço cadastrado)
const coords = await page.evaluate(() => {
  const html = document.body.innerHTML;
  const lat = html.match(/latitude["']?\s*[:=]\s*["']?(-?\d+\.\d+)/i)?.[1];
  const lng = html.match(/longitude["']?\s*[:=]\s*["']?(-?\d+\.\d+)/i)?.[1];
  return { lat, lng };
});
console.log('📌 Coordenadas da empresa:', coords);

// 4. Tentar chamar endpoint de saldo (secservices - não precisa de CSRF)
console.log('\n📌 Testando endpoint de saldo...');
try {
  const empresaId = empresaData.empresaId || '168556';
  const franquiaId = empresaData.franquiaId || '19';
  const balanceUrl = `https://secservices.beedelivery.com.br/api/v1/company/balance/${empresaId}/${franquiaId}`;
  
  const balanceResp = await page.evaluate(async (url) => {
    const r = await fetch(url);
    return await r.text();
  }, balanceUrl);
  console.log('Saldo resposta:', balanceResp.substring(0, 500));
  fs.writeFileSync('C:/Mettri4/tmp/bee-saldo-response.json', balanceResp, 'utf-8');
} catch(e) {
  console.log('Erro saldo:', e.message);
}

// 5. Testar endpoint de cotação
console.log('\n📌 Testando endpoint de cotação...');
try {
  const quoteUrl = 'https://www.beedelivery.com.br/central/entregas/coleta/calcular';
  
  const quoteResp = await page.evaluate(async ({ url, token, lat, lng }) => {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': token || '',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        latitude_origem: lat || '-18.9188',
        longitude_origem: lng || '-48.2768',
        latitude_destino: '-18.9200',
        longitude_destino: '-48.2800',
        tipo_transporte: 'MB',
        sn_volta: 'N',
        sn_coleta: 'N',
        vltotal_produto: 0
      })
    });
    const text = await r.text();
    return { status: r.status, body: text.substring(0, 2000) };
  }, { url: quoteUrl, token: csrfToken, lat: coords.lat, lng: coords.lng });
  
  console.log('Cotação resposta:', JSON.stringify(quoteResp, null, 2));
  fs.writeFileSync('C:/Mettri4/tmp/bee-cotacao-response.json', JSON.stringify(quoteResp, null, 2), 'utf-8');
} catch(e) {
  console.log('Erro cotação:', e.message);
}

console.log('\n✅ Teste concluído!');
await browser.close();
