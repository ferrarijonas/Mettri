import { executablePath } from 'puppeteer-core';

(async () => {
  try {
    // Usar Puppeteer com Chrome do sistema
    const browser = await (await import('puppeteer-core')).launch({
      executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      headless: false,
      userDataDir: 'C:\\Users\\Alice\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 1',
      args: [
        '--load-extension=C:\\Mettri4\\dist',
        '--disable-extensions-except=C:\\Mettri4\\dist'
      ]
    });

    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();

    await page.goto('https://web.whatsapp.com/');
    await page.waitForTimeout(15000);

    const url = page.url();
    const title = await page.title();

    // Verificar se extensão injetou
    const hasExtension = await page.evaluate(() => {
      return {
        hasMettriRoot: !!document.querySelector('mettri-root'),
        hasMettriClass: !!document.querySelector('[class*="mettri"]'),
        hasWindowMettri: !!window.Mettri,
        bodyPreview: document.body.innerHTML.substring(0, 200)
      };
    });

    console.log(JSON.stringify({
      success: true,
      url,
      title,
      hasExtension,
      message: hasExtension.hasMettriRoot ? 'EXTENSION_INJECTED' : 'EXTENSION_NOT_INJECTED'
    }));

    // Screenshot
    await page.screenshot({
      path: 'C:\\Mettri4\\.karma\\.mettri\\tarefas\\concluidas\\T-006\\wa-puppeteer-final.png'
    });

    // Manter browser aberto para conferência
    console.log('Browser mantido aberto. Pressione Ctrl+C para fechar.');
    // await browser.close(); // Comentado para manter aberto
    
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error.message
    }));
  }
})();
