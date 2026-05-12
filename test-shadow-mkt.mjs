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

    // Acessar shadow DOM do mettri-shadow-host
    const shadowContent = await waPage.evaluate(() => {
      const host = document.querySelector('#mettri-shadow-host');
      if (!host) return { error: 'mettri-shadow-host não encontrado' };
      
      const shadow = host.shadowRoot;
      if (!shadow) return { error: 'shadowRoot não encontrado' };
      
      // Listar estrutura do shadow DOM
      const children = Array.from(shadow.children).map(el => ({
        tag: el.tagName.toLowerCase(),
        id: el.id,
        cls: (el.className || '').toString().substring(0, 60),
        childCount: el.children.length,
        text: (el.textContent || '').substring(0, 80)
      }));
      
      // Procurar elementos com texto "Enviar", "MKT", "Retomar", "Marketing"
      const allInShadow = shadow.querySelectorAll('*');
      const menuItems = [];
      for (const el of allInShadow) {
        const text = (el.textContent || '').trim();
        if ((text.includes('Enviar') || text.includes('Retomar') || 
             text.includes('Marketing') || text.includes('mkt') ||
             text.includes('Mensagens') || text.includes('📨') || text.includes('📩')) 
            && text.length < 100) {
          menuItems.push({
            tag: el.tagName.toLowerCase(),
            text: text.substring(0, 60),
            cls: (el.className || '').toString().substring(0, 50),
            clickable: el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || el.onclick !== null
          });
        }
      }
      
      return { children, menuItems, shadowChildrenCount: shadow.children.length };
    });

    console.log(JSON.stringify(shadowContent, null, 2));

    // Tentar clicar em "mkt enviar" ou "Enviar" dentro do shadow DOM
    const clicked = await waPage.evaluate(() => {
      const host = document.querySelector('#mettri-shadow-host');
      if (!host?.shadowRoot) return 'no shadow';
      
      const shadow = host.shadowRoot;
      const allEls = shadow.querySelectorAll('*');
      
      for (const el of allEls) {
        const text = (el.textContent || '').trim();
        // Procurar "Enviar" ou item que pareça menu com texto curto
        if ((text === 'Enviar' || text.includes('MKT') || text.includes('📨')) && el.click) {
          el.click();
          return `clicou em: "${text}"`;
        }
      }
      
      return 'não encontrou botão Enviar';
    });
    
    console.log('\nClique:', clicked);
    await new Promise(r => setTimeout(r, 3000));

    // Verificar o que mudou após clique
    const afterClick = await waPage.evaluate(() => {
      const host = document.querySelector('#mettri-shadow-host');
      const shadow = host?.shadowRoot;
      if (!shadow) return 'no shadow';
      
      const children = Array.from(shadow.children).map(el => ({
        tag: el.tagName.toLowerCase(),
        id: el.id,
        cls: (el.className || '').toString().substring(0, 60),
        text: (el.textContent || '').substring(0, 100)
      }));
      
      // Procurar texto "Retomar"
      const retomarEls = shadow.querySelectorAll('*');
      const retomarItems = [];
      for (const el of retomarEls) {
        const t = (el.textContent || '').trim();
        if (t.includes('Retomar') && t.length < 100) {
          retomarItems.push({ tag: el.tagName, text: t.substring(0, 60) });
        }
      }
      
      return { children, retomarItems };
    });

    console.log('\nApós clique:', JSON.stringify(afterClick, null, 2));

    await waPage.screenshot({ path: 'C:\\Mettri4\\.karma\\.mettri\\tarefas\\concluidas\\T-006\\wa-shadow-dom.png' });
    console.log('Screenshot salvo.');

  } catch (error) {
    console.error('ERRO:', error.message);
  }
})();
