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

    // Aguardar WA Web carregar
    console.log('Aguardando WA Web carregar...');
    try {
      await waPage.waitForSelector('[data-testid="chat-list"]', { timeout: 30000 });
      console.log('Chat list carregado!');
    } catch {
      console.log('Timeout aguardando chat list. Tentando buscar de qualquer forma...');
    }
    await new Promise(r => setTimeout(r, 3000));

    // Buscar contato "Pão de Verdade" - procurar por texto visível
    console.log('Procurando "Pão de Verdade"...');
    
    // Tentar busca no campo de pesquisa
    const searchBox = await waPage.$('[data-testid="chat-list-search"]') 
      || await waPage.$('[contenteditable="true"]') 
      || await waPage.$('div[aria-label="Search input textbox"]');
    
    if (searchBox) {
      await searchBox.click();
      await new Promise(r => setTimeout(r, 500));
      await waPage.keyboard.type('Pão de Verdade');
      await new Promise(r => setTimeout(r, 2000));
    } else {
      // Tentar clicar diretamente no chat com o nome
      const chatElements = await waPage.$$('[data-testid="cell-frame-container"]');
      for (const el of chatElements) {
        const text = await waPage.evaluate(e => e.textContent, el);
        if (text.toLowerCase().includes('pão') && text.toLowerCase().includes('verdade')) {
          await el.click();
          console.log('Contato encontrado e clicado!');
          break;
        }
      }
    }

    await new Promise(r => setTimeout(r, 2000));

    // Verificar se o chat abriu
    const currentChat = await waPage.evaluate(() => {
      const header = document.querySelector('[data-testid="conversation-header"]');
      return header ? header.textContent : null;
    });
    console.log('Chat atual:', currentChat);

    // Digitar mensagem no campo de input
    console.log('Digitando mensagem...');
    const inputBox = await waPage.$('[data-testid="conversation-compose-box-input"]')
      || await waPage.$('[contenteditable="true"][data-tab="10"]')
      || await waPage.$('div[contenteditable="true"][role="textbox"]')
      || await waPage.$('footer div[contenteditable="true"]');

    if (inputBox) {
      await inputBox.click();
      await new Promise(r => setTimeout(r, 500));
      
      // Digitar caractere por caractere
      const mensagem = 'Oi, Mettri aqui';
      await waPage.keyboard.type(mensagem, { delay: 50 });
      await new Promise(r => setTimeout(r, 1000));
      
      // Enviar (Enter)
      await waPage.keyboard.press('Enter');
      console.log('Mensagem enviada: "' + mensagem + '"');
    } else {
      console.log('ERRO: Campo de input não encontrado');
      // Tentar via evaluate
      await waPage.evaluate(() => {
        const box = document.querySelector('footer div[contenteditable="true"]');
        if (box) {
          box.textContent = 'Oi, Mettri aqui';
          box.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    }

    await new Promise(r => setTimeout(r, 2000));
    
    // Screenshot final
    await waPage.screenshot({ 
      path: 'C:\\Mettri4\\.karma\\.mettri\\tarefas\\concluidas\\T-006\\wa-mensagem-enviada.png' 
    });
    console.log('Screenshot salvo. SUCESSO!');

  } catch (error) {
    console.error('ERRO:', error.message);
  }
})();
