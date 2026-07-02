/**
 * Script de diagnóstico de tema
 * 
 * Execute este script no console do DevTools do WhatsApp Web para diagnosticar
 * problemas com o tema do Mettri.
 * 
 * Como usar:
 * 1. Abra o WhatsApp Web
 * 2. Abra o DevTools (F12)
 * 3. Vá na aba Console
 * 4. Cole e execute este script
 */

console.log('🔍 DIAGNÓSTICO DE TEMA METTRI');
console.log('================================\n');

// 1. Verificar se painel existe
const panel = document.getElementById('mettri-panel');
console.log('1️⃣ Painel existe?', panel ? '✅ SIM' : '❌ NÃO');

if (panel) {
  // 2. Verificar link do tema
  const themeLink = document.getElementById('mettri-theme');
  console.log('2️⃣ Link do tema existe?', themeLink ? '✅ SIM' : '❌ NÃO');
  
  if (themeLink) {
    console.log('   URL do tema:', (themeLink as HTMLLinkElement).href);
    console.log('   Link está no DOM?', document.head.contains(themeLink) ? '✅ SIM' : '❌ NÃO');
  }
  
  // 3. Verificar variáveis CSS no painel
  const panelStyle = getComputedStyle(panel);
  const bg = panelStyle.getPropertyValue('--mettri-bg').trim();
  const accent = panelStyle.getPropertyValue('--mettri-accent').trim();
  const text = panelStyle.getPropertyValue('--mettri-text').trim();
  
  console.log('3️⃣ Variáveis CSS no painel:');
  console.log('   --mettri-bg:', bg || '(não definida)');
  console.log('   --mettri-accent:', accent || '(não definida)');
  console.log('   --mettri-text:', text || '(não definida)');
  
  // 4. Verificar estilos computados do painel
  console.log('4️⃣ Estilos computados do painel:');
  console.log('   background:', panelStyle.backgroundColor);
  console.log('   color:', panelStyle.color);
  
  // 5. Verificar variáveis CSS em :root
  const rootStyle = getComputedStyle(document.documentElement);
  const rootBg = rootStyle.getPropertyValue('--mettri-bg').trim();
  const rootAccent = rootStyle.getPropertyValue('--mettri-accent').trim();
  
  console.log('5️⃣ Variáveis CSS em :root:');
  console.log('   --mettri-bg:', rootBg || '(não definida)');
  console.log('   --mettri-accent:', rootAccent || '(não definida)');
  
  // 6. Verificar se há CSS inline sobrescrevendo
  const panelInlineStyle = panel.getAttribute('style');
  console.log('6️⃣ CSS inline no painel?', panelInlineStyle || 'Nenhum');
  
  // 7. Listar todos os <link> de CSS relacionados ao tema
  const allLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
  const themeLinks = allLinks.filter(link => 
    (link as HTMLLinkElement).href.includes('themes') || 
    link.id === 'mettri-theme'
  );
  console.log('7️⃣ Links CSS de tema encontrados:', themeLinks.length);
  themeLinks.forEach((link, i) => {
    console.log(`   ${i + 1}.`, (link as HTMLLinkElement).href, link.id ? `(id: ${link.id})` : '');
  });
  
  // 8. Verificar estilos do header
  const header = panel.querySelector('.mettri-header');
  if (header) {
    const headerStyle = getComputedStyle(header);
    console.log('8️⃣ Estilos do header:');
    console.log('   background:', headerStyle.backgroundColor);
    console.log('   color:', headerStyle.color);
  }
  
  // 9. Verificar estilos das tabs
  const tabs = panel.querySelector('.mettri-tabs');
  if (tabs) {
    const tabsStyle = getComputedStyle(tabs);
    console.log('9️⃣ Estilos das tabs:');
    console.log('   background:', tabsStyle.backgroundColor);
    console.log('   color:', tabsStyle.color);
  }
  
  // 10. Verificar se há CSS do WhatsApp interferindo
  const waStyles = Array.from(document.styleSheets).filter(sheet => {
    try {
      return sheet.href && sheet.href.includes('whatsapp');
    } catch {
      return false;
    }
  });
  console.log('🔟 Stylesheets do WhatsApp encontradas:', waStyles.length);
  
  console.log('\n✅ Diagnóstico completo!');
} else {
  console.log('❌ Painel não encontrado. O Mettri pode não ter inicializado ainda.');
}
