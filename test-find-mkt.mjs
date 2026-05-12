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

    // Procurar elementos do Mettri - botão "mkt enviar", painel, etc.
    console.log('Procurando elementos Mettri na página...');
    
    const mettriElements = await waPage.evaluate(() => {
      // Procurar todos elementos com texto "mkt", "enviar", "marketing", "retomar"
      const results = [];
      const allEls = document.querySelectorAll('*');
      
      for (const el of allEls) {
        const text = (el.textContent || '').trim();
        const tag = el.tagName.toLowerCase();
        const cls = (el.className && typeof el.className === 'string') ? el.className.substring(0, 80) : '';
        const id = el.id || '';
        
        // Procurar por textos do Mettri
        if (text.length < 60 && (
          text.toLowerCase().includes('enviar') ||
          text.toLowerCase().includes('marketing') ||
          text.toLowerCase().includes('retomar') ||
          cls.includes('mettri')
        )) {
          results.push({ tag, cls, id, text: text.substring(0, 100) });
        }
      }
      
      return {
        totalFound: results.length,
        samples: results.slice(0, 15),
        hasWindowMettri: !!window.Mettri,
        bodyClasses: document.body.className
      };
    });

    console.log(JSON.stringify(mettriElements, null, 2));

    // Tentar achar e clicar no painel do Mettri
    // Talvez seja um elemento com shadow DOM ou um iframe
    const possibleButtons = await waPage.$$('button, [role="button"], div[class*="mettri"]');
    console.log(`\n${possibleButtons.length} possíveis botões/elementos Mettri encontrados.`);

    // Screenshot
    await waPage.screenshot({ 
      path: 'C:\\Mettri4\\.karma\\.mettri\\tarefas\\concluidas\\T-006\\wa-search-mkt.png' 
    });
    console.log('Screenshot salvo.');

  } catch (error) {
    console.error('ERRO:', error.message);
  }
})();
