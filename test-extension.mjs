import { chromium } from 'playwright';

(async () => {
  try {
    const pathToExtension = 'C:\\Mettri4\\dist';
    const userDataDir = 'C:\\temp\\mettri-chromium-test';
    
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
    
    await page.goto('https://web.whatsapp.com/');
    await page.waitForTimeout(10000);
    
    const url = page.url();
    const title = await page.title();
    
    // Verificar se extensão carregou
    const hasExtension = await page.evaluate(() => {
      return {
        hasMettriRoot: !!document.querySelector('mettri-root'),
        hasMettriClass: !!document.querySelector('[class*="mettri"]'),
        bodyPreview: document.body.innerHTML.substring(0, 300)
      };
    });
    
    console.log(JSON.stringify({
      success: true,
      url,
      title,
      hasExtension,
      message: hasExtension.hasMettriRoot ? 'EXTENSION_LOADED' : 'EXTENSION_NOT_LOADED',
      note: url.includes('qr') ? 'QR_CODE_SHOWN' : 'PAGE_LOADED'
    }));
    
    // Screenshot
    await page.screenshot({ path: 'C:\\Mettri4\\.karma\\.mettri\\tarefas\\concluidas\\T-006\\wa-chromium-test.png' });
    
    // Manter browser aberto para verificação manual
    console.log('Browser kept open. Checking for QR code...');
    
    // Se QR code aparecer, avisar usuário
    const hasQR = await page.evaluate(() => {
      return !!document.querySelector('[data-testid="qr-code"]');
    });
    
    if (hasQR) {
      console.log(JSON.stringify({
        status: 'QR_CODE_SHOWN',
        message: 'WA Web pediu QR code. Por favor, escaneie para logar. Browser mantido aberto.'
      }));
      // Manter aberto - não fechar
      await new Promise(() => {}); // Espera indefinidamente
    }
    
    // Se não pediu QR, continuar teste
    console.log('WA Web carregou sem QR code. Teste pode continuar.');
    await browserContext.close();
    
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error.message
    }));
  }
})();
