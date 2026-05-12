import puppeteer from 'puppeteer-core';

(async () => {
  try {
    // Conectar ao Chrome existente via CDP (porta 9222)
    const browser = await puppeteer.connect({
      browserURL: 'http://localhost:9222',
      defaultViewport: null
    });

    const pages = await browser.pages();
    const waPage = pages.find(p => p.url().includes('web.whatsapp.com')) || pages[0];
    
    await waPage.bringToFront();
    await new Promise(r => setTimeout(r, 5000));

    const url = waPage.url();
    const title = await waPage.title();

    // Verificar se extensão injetou
    const hasExtension = await waPage.evaluate(() => {
      return {
        hasMettriRoot: !!document.querySelector('mettri-root'),
        hasMettriClass: !!document.querySelector('[class*="mettri"]'),
        hasWindowMettri: !!window.Mettri,
        bodyPreview: document.body.innerHTML.substring(0, 300)
      };
    });

    console.log(JSON.stringify({
      success: true,
      url,
      title,
      hasExtension,
      message: hasExtension.hasMettriRoot ? 'EXTENSÃO INJETADA!' : 'Extensão NÃO injetada'
    }));

    // Screenshot
    await waPage.screenshot({ 
      path: 'C:\\Mettri4\\.karma\\.mettri\\tarefas\\concluidas\\T-006\\wa-extensao-check.png' 
    });

    console.log('Screenshot salvo. Chrome mantido aberto.');
    
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error.message
    }));
  }
})();
