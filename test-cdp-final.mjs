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
    
    // Esperar WA Web carregar completamente (aguardar chat list ou QR code)
    console.log('Aguardando WA Web carregar...');
    try {
      await waPage.waitForSelector('[data-testid="chat-list"], [data-testid="qr-code"]', { timeout: 30000 });
      console.log('WA Web carregado!');
    } catch {
      console.log('Timeout waiting for WA Web, continuando mesmo assim...');
    }
    
    await new Promise(r => setTimeout(r, 5000));

    // Verificar extensão
    const hasExtension = await waPage.evaluate(() => {
      // Procurar mettri-root (Shadow DOM)
      const mettriRoot = document.querySelector('mettri-root');
      // Procurar elementos com classe mettri
      const mettriEls = document.querySelectorAll('[class*="mettri"]');
      
      return {
        hasMettriRoot: !!mettriRoot,
        mettriRootShadow: mettriRoot?.shadowRoot ? 'present' : 'absent',
        mettriClassCount: mettriEls.length,
        mettriClassList: Array.from(mettriEls).slice(0, 5).map(el => ({
          tag: el.tagName.toLowerCase(),
          class: el.className.substring(0, 100),
          id: el.id
        })),
        hasWindowMettri: !!window.Mettri,
        windowMettriKeys: window.Mettri ? Object.keys(window.Mettri).slice(0, 10) : [],
        chatListPresent: !!document.querySelector('[data-testid="chat-list"]')
      };
    });

    console.log(JSON.stringify({
      success: true,
      hasExtension,
      message: hasExtension.hasMettriRoot ? 'METTRI-ROOT ENCONTRADO!' : `Extensão ativa (window.Mettri), mas mettri-root não no DOM. ${hasExtension.mettriClassCount} elementos com classe mettri.`
    }));

    // Screenshot
    await waPage.screenshot({ 
      path: 'C:\\Mettri4\\.karma\\.mettri\\tarefas\\concluidas\\T-006\\wa-extensao-final.png' 
    });

    console.log('Screenshot salvo.');
    
  } catch (error) {
    console.error(JSON.stringify({ success: false, error: error.message }));
  }
})();
