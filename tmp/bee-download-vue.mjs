import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const [page] = browser.contexts()[0].pages();

await page.goto('https://www.beedelivery.com.br/central/entregas', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

// Baixar scripts grandes (prováveis bundles Vue)
const scripts = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('script[src]')).map(s => ({
    src: s.src,
    size: s.textContent?.length || 0
  }));
});

for (const s of scripts) {
  const name = s.src.split('/').pop() || 'unknown';
  if (name.includes('app') || name.includes('bundle') || name.includes('central') || name.includes('main')) {
    console.log('Baixando:', name);
    try {
      const content = await page.evaluate(async (url) => {
        const r = await fetch(url, { credentials: 'include' });
        return await r.text();
      }, s.src);
      fs.writeFileSync(`C:/Mettri4/tmp/bee-${name}`, content, 'utf-8');
      console.log(`  Salvo: ${name} (${content.length} chars)`);
    } catch(e) {
      console.log(`  Erro: ${e.message}`);
    }
  }
}

// Extrair o código Vue inline completo para analisar
const inlineVueCode = await page.evaluate(() => {
  const scripts = document.querySelectorAll('script:not([src])');
  const results = [];
  scripts.forEach(s => {
    const text = s.textContent || '';
    if (text.includes('new Vue') || text.includes('Vue.component') || text.includes('coleta/calcular')) {
      results.push(text);
    }
  });
  return results;
});

for (let i = 0; i < inlineVueCode.length; i++) {
  fs.writeFileSync(`C:/Mettri4/tmp/bee-inline-vue-${i+1}.js`, inlineVueCode[i], 'utf-8');
  console.log(`Inline Vue ${i+1} salvo: ${inlineVueCode[i].length} chars`);
}

await browser.close();
