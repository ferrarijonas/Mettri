import puppeteer from 'puppeteer-core';

(async () => {
  try {
    const browser = await puppeteer.connect({
      browserURL: 'http://localhost:9222',
      defaultViewport: null
    });

    const pages = await browser.pages();
    const waPage = pages.find(p => p.url().includes('web.whatsapp.com'));
    if (!waPage) { console.log('WA Web não encontrado'); return; }
    await waPage.bringToFront();

    // Busca AMPLA: qualquer div com texto de Mettri
    const found = await waPage.evaluate(() => {
      const results = [];
      const allDivs = document.querySelectorAll('div, nav, aside, section');
      
      for (const el of allDivs) {
        const text = (el.textContent || '').trim();
        const cls = (el.className || '').toString();
        const id = el.id || '';
        
        const matches = 
          text.includes('Enviar') || text.includes('Retomar') || 
          text.includes('Marketing') || text.includes('Mettri') ||
          text.includes('mkt') || text.includes('📨') || text.includes('📩') ||
          cls.includes('mettri') || id.includes('mettri') ||
          text.includes('Catálogo') || text.includes('Pedidos') ||
          text.includes('Atendimento') || text.includes('Campanhas');
        
        if (matches && text.length < 200) {
          results.push({
            tag: el.tagName.toLowerCase(),
            id,
            cls: cls.substring(0, 60),
            text: text.substring(0, 120),
            rect: (() => {
              const r = el.getBoundingClientRect();
              return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
            })()
          });
        }
      }
      
      return results.slice(0, 30);
    });

    console.log(`${found.length} elementos com texto Mettri/Enviar/Retomar/etc:\n`);
    for (const f of found) {
      console.log(`  [${f.tag}] ${f.text.substring(0, 80)}`);
      console.log(`    cls: ${f.cls || '(sem classe)'}`);
      console.log(`    rect: ${f.rect.x},${f.rect.y} ${f.rect.w}x${f.rect.h}\n`);
    }

    // Verificar estrutura do body inteiro (1o nível)
    const bodyChildren = await waPage.evaluate(() => {
      return Array.from(document.body.children).map(el => ({
        tag: el.tagName.toLowerCase(),
        id: el.id,
        cls: (el.className || '').toString().substring(0, 60),
        childCount: el.children.length,
        text: (el.textContent || '').substring(0, 60)
      }));
    });
    console.log('\nFilhos diretos do body:');
    for (const c of bodyChildren) {
      console.log(`  <${c.tag} id="${c.id}" class="${c.cls.substring(0, 40)}"> (${c.childCount} filhos) "${c.text}"`);
    }

    // Screenshot
    await waPage.screenshot({ path: 'C:\\Mettri4\\.karma\\.mettri\\tarefas\\concluidas\\T-006\\wa-painel-check.png' });
    console.log('\nScreenshot salvo.');

  } catch (error) {
    console.error('ERRO:', error.message);
  }
})();
