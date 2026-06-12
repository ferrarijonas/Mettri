import { chromium } from 'playwright';
import fs from 'fs';

// Obter WebSocket URL dinamicamente
const versionResp = await fetch('http://localhost:9222/json/version');
const versionData = await versionResp.json();
const wsURL = versionData.webSocketDebuggerUrl;
console.log(`📌 Conectando a ${wsURL}`);

const browser = await chromium.connectOverCDP(wsURL);

// Encontrar a página do Bee Delivery que já está aberta
let targetPage = null;
for (const ctx of browser.contexts()) {
  for (const p of ctx.pages()) {
    const url = p.url();
    if (url.includes('beedelivery.com.br/central/entregas')) {
      targetPage = p;
      break;
    }
  }
  if (targetPage) break;
}

if (!targetPage) {
  // Se não achou, cria nova aba no primeiro contexto
  console.log('📌 Nenhuma página Bee encontrada, criando nova aba...');
  const ctx = browser.contexts()[0];
  targetPage = await ctx.newPage();
  console.log('📌 Navegando para página de entregas...');
  await targetPage.goto('https://www.beedelivery.com.br/central/entregas', { waitUntil: 'domcontentloaded', timeout: 60000 });
} else {
  console.log(`📌 Usando página existente: ${await targetPage.title()}`);
  // Recarregar pra garantir estado limpo
  await targetPage.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
}

const page = targetPage;
page.setDefaultTimeout(60000);
await page.waitForTimeout(3000);

// Capturar requisições de rede
const capturedRequests = [];
page.on('request', req => {
  const url = req.url();
  if (url.includes('beedelivery') || url.includes('secservices') || url.includes('googleapis') || url.includes('maps')) {
    capturedRequests.push({
      type: 'request',
      url: url,
      method: req.method(),
      headers: req.headers(),
      body: req.postData() || null
    });
  }
});

page.on('response', async resp => {
  const url = resp.url();
  if (url.includes('beedelivery') || url.includes('secservices')) {
    try {
      const text = await resp.text();
      capturedRequests.push({
        type: 'response',
        url: url,
        status: resp.status(),
        body: text.substring(0, 3000)
      });
    } catch {}
  }
});

// Screenshot inicial
await page.screenshot({ path: 'C:/Mettri4/tmp/bee-form-inicial.png', fullPage: true });

console.log('');
console.log('📌 Script rodando - aguardando 120s pra você preencher o formulário');
console.log('📌 Vá no Chrome, preencha o endereço e selecione a sugestão.');
console.log('📌 NÃO clique em Chamar Entregador!');
console.log('');

// Aguardar 2 minutos
await page.waitForTimeout(120000);

// Salvar capturas
fs.writeFileSync('C:/Mettri4/tmp/bee-captured.json', JSON.stringify(capturedRequests, null, 2), 'utf-8');
console.log(`📌 ${capturedRequests.length} requisições capturadas -> bee-captured.json`);

// Screenshot final
try {
  await page.screenshot({ path: 'C:/Mettri4/tmp/bee-form-final.png', fullPage: true });
} catch {}

// Extrair texto visível
const visibleText = await page.evaluate(() => document.body.innerText);
const freteMatch = visibleText.match(/R?\$?\s*[\d.,]+\s*(?:de frete|frete|taxa|total)/gi);
console.log('📌 Textos de frete:', freteMatch || 'nenhum');
fs.writeFileSync('C:/Mettri4/tmp/bee-form-text.txt', visibleText, 'utf-8');

await browser.close();
