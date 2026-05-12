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

    // Tentar disparar o painel via window.Mettri
    console.log('window.Mettri keys:', await waPage.evaluate(() => {
      return window.Mettri ? Object.keys(window.Mettri).slice(0, 20) : 'NO_METTRI';
    }));

    // Tentar abrir painel via EventBus
    console.log('\nTentando disparar painel...');
    await waPage.evaluate(() => {
      // Tentar enviar evento para abrir marketing
      window.postMessage({
        __mettriBridge: true,
        direction: 'request',
        action: 'openPanel',
        payload: { panel: 'marketing.enviar' }
      }, '*');

      // Tentar EventBus
      if (window.__mettriEventBus) {
        window.__mettriEventBus.emit('panel.open', { id: 'marketing.enviar' });
      }
    });

    await new Promise(r => setTimeout(r, 3000));

    // Procurar novamente
    const found = await waPage.evaluate(() => {
      const allDivs = document.querySelectorAll('div');
      const lateralDivs = [];
      for (const d of allDivs) {
        const style = window.getComputedStyle(d);
        const rect = d.getBoundingClientRect();
        // Procurar div que parece menu lateral (lado esquerdo, altura grande)
        if (rect.left < 100 && rect.height > 400 && rect.width > 40 && rect.width < 400) {
          lateralDivs.push({
            tag: d.tagName,
            id: d.id,
            classes: (d.className || '').substring(0, 80),
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
            text: (d.textContent || '').substring(0, 60)
          });
        }
      }
      return { lateralDivs: lateralDivs.slice(0, 10), totalDivs: allDivs.length };
    });

    console.log(JSON.stringify(found, null, 2));

    // Verificar se tem algum elemento visível com texto "Enviar" ou "MKT"
    const buttons = await waPage.$$eval('button, [role="button"], span, div', els => 
      els.filter(e => {
        const t = (e.textContent || '').trim();
        return t === 'Enviar' || t === 'MKT' || t === 'Marketing' || t === 'Retomar' || t === '📨' || t === '📩';
      }).map(e => ({
        tag: e.tagName,
        text: (e.textContent || '').trim().substring(0, 30),
        rect: e.getBoundingClientRect()
      }))
    );
    console.log('\nBotões com texto MKT:', buttons);

    await waPage.screenshot({ path: 'C:\\Mettri4\\.karma\\.mettri\\tarefas\\concluidas\\T-006\\wa-trigger-test.png' });
    console.log('Screenshot salvo.');

  } catch (error) {
    console.error('ERRO:', error.message);
  }
})();
