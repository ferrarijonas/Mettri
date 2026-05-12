import { chromium } from 'playwright';

(async () => {
  try {
    const pathToExtension = 'C:\\Mettri4\\dist';
    const userDataDir = 'C:\\temp\\mettri-chromium-test-2';
    
    const browserContext = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    });
    
    const pages = browserContext.pages();
    const page = pages[0] || await browserContext.newPage();
    
    // 1. Verificar se extensão carregou via chrome://extensions/
    console.log('Navegando para chrome://extensions/...');
    await page.goto('chrome://extensions/');
    await page.waitForTimeout(3000);
    
    const extensions = await page.evaluate(() => {
      const extensions = [];
      const extensionItems = document.querySelectorAll('extensions-item');
      extensionItems.forEach(item => {
        const name = item.shadowRoot?.querySelector('#name')?.textContent || 'Unknown';
        const id = item.getAttribute('extension-id') || 'Unknown';
        extensions.push({ name, id });
      });
      return extensions;
    });
    
    console.log('Extensões carregadas:', JSON.stringify(extensions));
    
    // Verificar service workers
    const serviceWorkers = browserContext.serviceWorkers();
    console.log('Service Workers:', serviceWorkers.map(sw => sw.url()));
    
    // 2. Navegar para WA Web
    console.log('Navegando para WhatsApp Web...');
    await page.goto('https://web.whatsapp.com/');
    await page.waitForTimeout(10000);
    
    const url = page.url();
    const hasQR = url.includes('qr') || await page.evaluate(() => {
      return !!document.querySelector('[data-testid="qr-code"]');
    });
    
    if (hasQR) {
      console.log(JSON.stringify({
        status: 'QR_CODE_SHOWN',
        message: 'WhatsApp Web pediu QR code. Por favor, escaneie para logar.'
      }));
      // Manter browser aberto
      await new Promise(() => {});
    }
    
    // 3. Verificar se extensão injetou
    const hasExtension = await page.evaluate(() => {
      return {
        hasMettriRoot: !!document.querySelector('mettri-root'),
        hasMettriClass: !!document.querySelector('[class*="mettri"]'),
        bodyPreview: document.body.innerHTML.substring(0, 300)
      };
    });
    
    console.log('Status da extensão:', JSON.stringify(hasExtension));
    
    // Screenshot
    await page.screenshot({ 
      path: 'C:\\Mettri4\\.karma\\.mettri\\tarefas\\concluidas\\T-006\\wa-final-test.png' 
    });
    
    console.log(JSON.stringify({
      success: true,
      url,
      hasExtension,
      message: hasExtension.hasMettriRoot ? 'EXTENSION_LOADED_AND_INJECTED' : 'EXTENSION_LOADED_BUT_NOT_INJECTED'
    }));
    
    // Manter browser aberto para conferência
    console.log('Browser mantido aberto para conferência manual.');
    await new Promise(() => {});
    
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error.message
    }));
  }
})();
