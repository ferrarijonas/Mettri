import puppeteer from 'puppeteer-core';

(async () => {
  try {
    const browser = await puppeteer.connect({
      browserURL: 'http://localhost:9222',
      defaultViewport: null
    });

    const pages = await browser.pages();
    const waPage = pages.find(p => p.url().includes('web.whatsapp.com'));
    if (!waPage) return;
    await waPage.bringToFront();

    // Acessar shadow DOM do mettri-shadow-host
    const testResult = await waPage.evaluate(() => {
      const host = document.querySelector('#mettri-shadow-host');
      if (!host?.shadowRoot) return { error: 'no shadow' };
      
      const shadow = host.shadowRoot;
      
      // Procurar lista de contatos elegíveis
      const allText = shadow.querySelector('*')?.textContent || '';
      const hasPaoDeVerdade = allText.toLowerCase().includes('pão de verdade') || 
                              allText.toLowerCase().includes('pao de verdade');
      
      // Procurar elementos que parecem itens de lista de contatos
      const container = shadow.querySelector('#mettri-shadow-container');
      const innerHTML = container?.innerHTML?.substring(0, 3000) || '';
      
      // Extrair nomes de contatos do HTML
      const nameMatches = innerHTML.match(/Pão de Verdade|Jonas|F R E E L A S|Conta comercial/g) || [];
      
      // Contar quantas pessoas aparecem
      const enviarMatch = allText.match(/Enviar para (\d+) pessoas/);
      const eligibleCount = enviarMatch ? parseInt(enviarMatch[1]) : null;
      
      return {
        eligibleCount,
        hasPaoDeVerdade,
        nameMatches,
        innerHTMLPreview: innerHTML.substring(0, 500),
        allTextPreview: allText.substring(0, 500)
      };
    });

    console.log(JSON.stringify(testResult, null, 2));

    // Screenshot
    await waPage.screenshot({ path: 'C:\\Mettri4\\.karma\\.mettri\\tarefas\\concluidas\\T-006\\wa-retomar-list.png' });
    console.log('Screenshot salvo.');

  } catch (error) {
    console.error('ERRO:', error.message);
  }
})();
