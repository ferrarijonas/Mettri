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

    // Aguardar WA Web estar pronto
    await waPage.waitForSelector('[data-testid="chat-list"]', { timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));

    console.log('Chamando window.Mettri.initialize()...');
    try {
      await waPage.evaluate(async () => {
        if (window.Mettri && typeof window.Mettri.initialize === 'function') {
          await window.Mettri.initialize();
          return 'initialized';
        }
        return 'no initialize method';
      });
      console.log('initialize() concluído');
    } catch (e) {
      console.log('Erro no initialize:', e.message);
    }

    await new Promise(r => setTimeout(r, 3000));

    // Verificar se mettri-root apareceu
    const hasExtension = await waPage.evaluate(() => {
      const mettriRoot = document.querySelector('mettri-root');
      return {
        hasMettriRoot: !!mettriRoot,
        mettriRootHTML: mettriRoot?.innerHTML?.substring(0, 500),
        allCustomElements: Array.from(document.querySelectorAll('*')).filter(el => el.tagName.includes('-')).map(el => el.tagName).slice(0, 10),
        shadowRoots: Array.from(document.querySelectorAll('*')).filter(el => el.shadowRoot).map(el => el.tagName).slice(0, 10)
      };
    });

    console.log(JSON.stringify({
      success: true,
      hasExtension,
      message: hasExtension.hasMettriRoot ? 'METTRI-ROOT ENCONTRADO!' : 'Ainda não encontrado'
    }));

    await waPage.screenshot({ 
      path: 'C:\\Mettri4\\.karma\\.mettri\\tarefas\\concluidas\\T-006\\wa-after-init.png' 
    });

    console.log('Screenshot salvo.');
    
  } catch (error) {
    console.error(JSON.stringify({ success: false, error: error.message }));
  }
})();
