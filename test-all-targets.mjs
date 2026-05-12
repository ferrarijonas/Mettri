import puppeteer from 'puppeteer-core';

(async () => {
  try {
    const browser = await puppeteer.connect({
      browserURL: 'http://localhost:9222',
      defaultViewport: null
    });

    // Listar TODOS os targets (inclui service workers, extensions, side panels)
    const targets = browser.targets();
    console.log(`${targets.length} targets CDP:\n`);
    
    for (const t of targets) {
      const info = {
        type: t.type(),
        url: t.url().substring(0, 200),
      };
      console.log(`  [${info.type}] ${info.url}`);
    }

    // Tentar encontrar target do side panel da extensão
    const extTargets = targets.filter(t => 
      t.url().includes('chrome-extension://') || 
      t.url().includes('mettri')
    );
    
    console.log(`\n${extTargets.length} targets da extensão Mettri:`);
    
    for (const t of extTargets) {
      try {
        const page = await t.page();
        if (page) {
          const title = await page.title();
          console.log(`  [${t.type()}] "${title}"`);
          const body = await page.evaluate(() => {
            return {
              innerHTML: document.body?.innerHTML?.substring(0, 500),
              buttons: Array.from(document.querySelectorAll('button, [role="button"], a, div[class*="mettri"]'))
                .map(b => ({ text: b.textContent?.trim()?.substring(0, 40), cls: b.className?.substring(0, 60) }))
                .filter(x => x.text).slice(0, 15)
            };
          });
          console.log(JSON.stringify(body, null, 2));
        } else {
          console.log(`  [${t.type()}] sem page (service worker?)`);
        }
      } catch (e) {
        console.log(`  [${t.type()}] erro: ${e.message}`);
      }
    }

  } catch (error) {
    console.error('ERRO:', error.message);
  }
})();
