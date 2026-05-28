import puppeteer from 'puppeteer-core';

const CDP_URL = 'http://localhost:9222';

async function main() {
  console.log('=== DIAGNÓSTICO RETOMAR ===\n');

  // 1. Conecta no Chrome via CDP
  console.log('1. Conectando ao Chrome via CDP...');
  const browser = await puppeteer.connect({ browserURL: CDP_URL });
  console.log(`   ✓ Conectado! Versão: ${await browser.version()}\n`);

  // 2. Lista páginas abertas
  const pages = await browser.pages();
  console.log(`2. Páginas abertas: ${pages.length}`);
  for (const p of pages) {
    const url = p.url();
    console.log(`   [${p.target()._targetId}] ${url}`);
  }
  console.log();

  // 3. Verifica extensões carregadas
  console.log('3. Verificando extensões...');
  const targets = browser.targets();
  const extensionTargets = targets.filter(t =>
    t.url().startsWith('chrome-extension://')
  );
  console.log(`   Extensões encontradas: ${extensionTargets.length}`);
  for (const t of extensionTargets) {
    console.log(`   - ${t.url()}`);
  }

  // 4. Abre chrome://extensions pra ver lista
  console.log('\n4. Verificando extensões instaladas via chrome://extensions...');
  const extPage = await browser.newPage();
  await extPage.goto('chrome://extensions/', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));
  const extTitle = await extPage.title();
  console.log(`   Título da página: ${extTitle}`);

  // 5. Abre chrome://inspect pra ver service workers
  console.log('\n5. Verificando service workers...');
  const inspectPage = await browser.newPage();
  await inspectPage.goto('chrome://inspect/#service-workers', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));
  console.log(`   Página inspect carregada`);

  // 6. Tenta navegar ao WhatsApp Web
  console.log('\n6. Navegando ao WhatsApp Web...');
  const waPage = await browser.newPage();
  await waPage.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
  const waUrl = waPage.url();
  console.log(`   URL: ${waUrl}`);

  // Verifica se está na tela de QR code ou logado
  const pageContent = await waPage.evaluate(() => {
    const hasQR = !!document.querySelector('canvas') || !!document.querySelector('[data-testid="qrcode"]');
    const hasChat = !!document.querySelector('[data-testid="conversation-panel"]');
    const hasMettri = !!document.querySelector('#mettri-shadow-host');
    const mettriRoots = [];
    document.querySelectorAll('[id*="mettri"]').forEach(el => {
      mettriRoots.push({
        id: el.id,
        tag: el.tagName,
        shadow: !!el.shadowRoot,
        classes: el.className
      });
    });
    return { hasQR, hasChat, hasMettri, mettriRoots, url: window.location.href };
  });
  console.log(`   QR Code visível: ${pageContent.hasQR}`);
  console.log(`   Chat logado: ${pageContent.hasChat}`);
  console.log(`   #mettri-shadow-host: ${pageContent.hasMettri}`);
  console.log(`   Elementos Mettri encontrados: ${pageContent.mettriRoots.length}`);
  if (pageContent.mettriRoots.length > 0) {
    console.log(`   Detalhes: ${JSON.stringify(pageContent.mettriRoots, null, 2)}`);
  }

  // 7. Se WA logado, tenta acessar shadow DOM e módulo Retomar
  if (pageContent.hasChat || pageContent.hasMettri) {
    console.log('\n7. WA Web logado! Inspecionando extensão Mettri...');

    if (pageContent.hasMettri) {
      const shadowInfo = await waPage.evaluate(() => {
        const host = document.querySelector('#mettri-shadow-host');
        if (!host || !host.shadowRoot) return { error: 'Sem shadow root' };
        const sr = host.shadowRoot;
        const children = Array.from(sr.children).map(c => ({
          tag: c.tagName,
          id: c.id,
          className: c.className,
          children: c.children.length
        }));
        const allText = sr.textContent?.substring(0, 2000) || '';
        return { children, allText, innerHTML: sr.innerHTML?.substring(0, 3000) };
      });
      console.log(`   Shadow DOM children: ${JSON.stringify(shadowInfo.children, null, 2)}`);
      console.log(`   Text content: ${shadowInfo.allText}`);
    }

    // Tenta window.Mettri
    const mettriGlobal = await waPage.evaluate(() => {
      const m = window.Mettri;
      if (!m) return { found: false };
      const info = { found: true };
      if (m.module) {
        info.module = typeof m.module;
        if (typeof m.module.getModules === 'function') {
          info.modules = m.module.getModules();
        }
      }
      if (m.modules) {
        info.modules = Object.keys(m.modules);
      }
      info.keys = Object.keys(m);
      return info;
    });
    console.log(`\n   window.Mettri: ${JSON.stringify(mettriGlobal, null, 2)}`);

    // Procura por "retomar" em qualquer lugar
    const retomarSearch = await waPage.evaluate(() => {
      const result = { window: false, dom: false, modules: false };
      if (window.Mettri) result.window = true;
      const allText = document.body.innerText || '';
      result.hasRetomarText = allText.toLowerCase().includes('retomar');
      const allHTML = document.body.innerHTML || '';
      result.hasRetomarHTML = allHTML.toLowerCase().includes('retomar');
      return result;
    });
    console.log(`\n   Busca por "retomar": ${JSON.stringify(retomarSearch)}`);
  } else {
    console.log('\n7. WA Web NÃO logado (tela de QR Code).');
    console.log('   Para testar o módulo Retomar, faça login no WhatsApp Web escaneando o QR Code.');
  }

  // Console errors
  console.log('\n8. Console errors da página WA:');
  const consoleErrors = [];
  waPage.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  await new Promise(r => setTimeout(r, 2000));
  if (consoleErrors.length > 0) {
    consoleErrors.forEach(e => console.log(`   ❌ ${e}`));
  } else {
    console.log('   Nenhum erro de console capturado (pode precisar de mais tempo)');
  }

  await browser.disconnect();
  console.log('\n=== DIAGNÓSTICO CONCLUÍDO ===');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
