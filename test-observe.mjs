import puppeteer from 'puppeteer-core';

(async () => {
  try {
    const browser = await puppeteer.connect({
      browserURL: 'http://localhost:9222',
      defaultViewport: null
    });

    // Listar TODAS as páginas abertas
    const allPages = await browser.pages();
    console.log(`${allPages.length} páginas abertas:`);
    for (const p of allPages) {
      const url = p.url();
      const title = await p.title().catch(() => '???');
      console.log(`  [${title}] ${url.substring(0, 140)}`);
    }

    // Verificar se mettri-root apareceu no WA Web
    const waPage = allPages.find(p => p.url().includes('web.whatsapp.com'));
    if (waPage) {
      await waPage.bringToFront();
      const dom = await waPage.evaluate(() => {
        return {
          hasMettriRoot: !!document.querySelector('mettri-root'),
          mettriRootHTML: (document.querySelector('mettri-root')?.shadowRoot?.innerHTML || 'NO-SHADOW').substring(0, 500),
          mettriDivs: Array.from(document.querySelectorAll('div[class*="mettri"]')).map(d => ({
            cls: d.className.substring(0, 80),
            text: d.textContent?.substring(0, 60)
          })).slice(0, 10),
          lateralPanel: (() => {
            const divs = document.querySelectorAll('div');
            for (const d of divs) {
              const t = (d.textContent || '');
              if ((t.includes('Enviar') || t.includes('Retomar') || t.includes('Marketing')) && t.length < 100) {
                return { text: t.substring(0, 100), cls: d.className.substring(0, 80) };
              }
            }
            return null;
          })()
        };
      });
      console.log('\nDOM no WA Web:', JSON.stringify(dom, null, 2));

      await waPage.screenshot({ path: 'C:\\Mettri4\\.karma\\.mettri\\tarefas\\concluidas\\T-006\\wa-apos-abrir.png' });
    }

    // Ver páginas de extensão
    for (const p of allPages) {
      if (p.url().includes('chrome-extension://')) {
        await p.bringToFront();
        const title = await p.title();
        const dom = await p.evaluate(() => {
          return {
            body: document.body?.innerHTML?.substring(0, 500),
            allButtons: Array.from(document.querySelectorAll('button, [role="button"]'))
              .map(b => b.textContent?.trim()?.substring(0, 40)).filter(Boolean).slice(0, 10)
          };
        });
        console.log(`\nExt page [${title}]:`, JSON.stringify(dom, null, 2));
      }
    }

  } catch (error) {
    console.error('ERRO:', error.message);
  }
})();
