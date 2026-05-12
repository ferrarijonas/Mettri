const puppeteer = require('puppeteer-core');

(async () => {
  try {
    const browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      headless: false,
      userDataDir: 'C:\\Users\\Alice\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 1',
      args: ['--load-extension=C:\\Mettri4\\dist']
    });
    
    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();
    
    await page.goto('https://web.whatsapp.com/');
    await page.waitForTimeout(10000);
    
    const hasExtension = await page.evaluate(() => {
      return {
        hasMettriRoot: !!document.querySelector('mettri-root'),
        title: document.title
      };
    });
    
    console.log(JSON.stringify({ success: true, hasExtension }));
    
    await page.screenshot({ path: 'C:\\Mettri4\\.karma\\.mettri\\tarefas\\concluidas\\T-006\\wa-puppeteer-test.png' });
    
    // Keep browser open for manual verification
    console.log('Browser kept open. Press Ctrl+C to close.');
    // await browser.close();
  } catch (error) {
    console.error(JSON.stringify({ success: false, error: error.message }));
  }
})();
