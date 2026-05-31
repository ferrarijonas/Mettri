import puppeteer from 'puppeteer-core';
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
const page = await browser.newPage();
await page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded' });
console.log('Navegando para WA Web...');
await new Promise(r => setTimeout(r, 2000));
console.log('URL atual:', page.url());
await browser.disconnect();
