import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const [page] = browser.contexts()[0].pages();

// Navegar para página de entregas
await page.goto('https://www.beedelivery.com.br/central/entregas', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

// Procurar TODOS os scripts JS com Vue/components de entrega
const allScripts = await page.evaluate(() => {
  const scripts = document.querySelectorAll('script[src]');
  return Array.from(scripts).map(s => ({
    src: s.src,
    id: s.id,
    type: s.type
  }));
});
console.log('Scripts carregados:', allScripts.length);
allScripts.forEach(s => console.log('  ', s.src.split('/').pop()));

// Procurar componentes Vue inline
const vueComponents = await page.evaluate(() => {
  const results = [];
  document.querySelectorAll('script:not([src])').forEach(script => {
    const text = script.textContent || '';
    if (text.includes('Vue') || text.includes('component') || text.includes('entrega') || text.includes('calcular') || text.includes('cotacao')) {
      results.push({
        length: text.length,
        preview: text.substring(0, 500),
        hasCotacao: text.includes('cotacao') || text.includes('calcular'),
        hasEntrega: text.includes('entrega')
      });
    }
  });
  return results;
});
console.log('\nComponentes Vue encontrados:', vueComponents.length);
vueComponents.forEach((c, i) => {
  if (c.hasCotacao || c.hasEntrega) {
    console.log(`\n--- Script ${i+1} (${c.length} chars) ---`);
    console.log(c.preview);
  }
});

// Procurar por "calcular" especificamente no HTML
const calcularCode = await page.evaluate(() => {
  const results = [];
  // Procurar em todos os scripts
  document.querySelectorAll('script').forEach(s => {
    const text = s.textContent || '';
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (line.toLowerCase().includes('calcular') || line.includes('coleta/calcular')) {
        results.push({ line: i+1, text: line.trim().substring(0, 300), src: s.src || 'inline' });
      }
    });
  });
  return results;
});
console.log('\nLinhas com "calcular":');
calcularCode.forEach(c => console.log(`  ${c.src}:${c.line}: ${c.text}`));

await browser.close();
