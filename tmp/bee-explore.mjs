import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const pages = browser.contexts()[0].pages();

for (const page of pages) {
  const url = page.url();
  console.log('=== ABA:', url, '===');
  
  if (url.includes('beedelivery')) {
    const title = await page.title();
    console.log('Título:', title);
    
    // Extrair texto completo da página
    const text = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync('C:/Mettri4/tmp/bee-text.txt', text, 'utf-8');
    
    // Extrair HTML
    const html = await page.content();
    fs.writeFileSync('C:/Mettri4/tmp/bee-page.html', html, 'utf-8');
    
    // Extrair todas as URLs de API/requisições
    const apis = await page.evaluate(() => {
      const results = [];
      // Performance entries (fetch/ajax)
      const entries = performance.getEntriesByType('resource');
      entries.forEach(e => {
        if (e.name.includes('api') || e.name.includes('v1') || e.name.includes('bee')) {
          results.push({ url: e.name, type: e.initiatorType });
        }
      });
      return results;
    });
    fs.writeFileSync('C:/Mettri4/tmp/bee-apis.json', JSON.stringify(apis, null, 2), 'utf-8');
    
    // Procurar saldo e dados financeiros
    const saldo = await page.evaluate(() => {
      const body = document.body.innerText;
      const matches = body.match(/(?:saldo|crédito|credits?|R\$)\s*[\d.,]+/gi);
      return matches || [];
    });
    fs.writeFileSync('C:/Mettri4/tmp/bee-saldo.json', JSON.stringify(saldo, null, 2), 'utf-8');
    
    console.log('Dados extraídos com sucesso!');
    console.log('APIs encontradas:', apis.length);
    console.log('Saldo:', saldo);
  }
}

await browser.close();
