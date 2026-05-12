import puppeteer from 'puppeteer-core';

(async () => {
  try {
    const browser = await puppeteer.connect({
      browserURL: 'http://localhost:9222',
      defaultViewport: null
    });

    const pages = await browser.pages();
    const waPage = pages.find(p => p.url().includes('web.whatsapp.com')) || pages[0];
    await waPage.bringToFront();

    const EXT_ID = 'hkmaccoimjachmoigeonfeoihgglepgh';

    // Tentar abrir side panel via runtime.sendMessage
    console.log('Tentando abrir side panel...');
    await waPage.evaluate(async (extId) => {
      try {
        const response = await chrome.runtime.sendMessage(extId, {
          type: 'OPEN_SIDE_PANEL',
          action: 'openPanel',
          panel: 'marketing.enviar'
        });
        return response;
      } catch (e) {
        return { error: e.message };
      }
    }, EXT_ID);

    await new Promise(r => setTimeout(r, 3000));

    // Listar todas as páginas abertas (incluindo extensions)
    const allPages = await browser.pages();
    console.log(`\n${allPages.length} páginas abertas:`);
    for (const p of allPages) {
      const url = p.url();
      console.log(`  ${url.substring(0, 120)}`);
    }

    // Procurar página do side panel da extensão
    const sidePanel = allPages.find(p => p.url().includes('chrome-extension://') && p.url().includes('panel'));
    const extPages = allPages.filter(p => p.url().includes('chrome-extension://'));

    if (extPages.length > 0) {
      console.log(`\nPáginas da extensão encontradas: ${extPages.length}`);
      for (const ep of extPages) {
        await ep.bringToFront();
        const title = await ep.title();
        console.log(`  Título: "${title}" URL: ${ep.url()}`);
      }
    } else {
      console.log('\nNenhuma página da extensão encontrada.');
    }

    // Verificar se mettri-root apareceu na página WA
    const hasMettri = await waPage.evaluate(() => {
      return {
        hasMettriRoot: !!document.querySelector('mettri-root'),
        allPanelDivs: Array.from(document.querySelectorAll('[class*="mettri"]')).map(e => ({
          tag: e.tagName,
          cls: (e.className || '').substring(0, 60)
        }))
      };
    });
    console.log('\nhasMettri:', JSON.stringify(hasMettri));

    await waPage.screenshot({ path: 'C:\\Mettri4\\.karma\\.mettri\\tarefas\\concluidas\\T-006\\wa-sidepanel.png' });
    console.log('Screenshot salvo.');

  } catch (error) {
    console.error('ERRO:', error.message);
  }
})();
