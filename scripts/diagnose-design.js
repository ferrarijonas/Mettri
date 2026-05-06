/**
 * Script de Diagnóstico Completo de Design - METTRI
 * 
 * Execute este script no console do DevTools do WhatsApp Web
 * para diagnosticar problemas com o visual do Mettri.
 * 
 * Como usar:
 * 1. Abra o WhatsApp Web
 * 2. Abra o DevTools (F12)
 * 3. Vá na aba Console
 * 4. Cole e execute este script
 */

console.log('🔍 DIAGNÓSTICO COMPLETO DE DESIGN METTRI');
console.log('==========================================\n');

// ============================================
// 1. VERIFICAR PAINEL E ESTRUTURA
// ============================================
console.log('📋 1. ESTRUTURA DO PAINEL');
console.log('─'.repeat(50));

const panel = document.getElementById('mettri-panel');
const navbar = document.getElementById('mettri-navbar');

console.log('✅ Painel principal:', panel ? 'EXISTE' : '❌ NÃO ENCONTRADO');
console.log('✅ NavBar:', navbar ? 'EXISTE' : '❌ NÃO ENCONTRADO');

if (panel) {
  console.log('   - ID:', panel.id);
  console.log('   - Classes:', panel.className);
  console.log('   - Posição:', getComputedStyle(panel).position);
  console.log('   - Z-index:', getComputedStyle(panel).zIndex);
}

if (navbar) {
  console.log('   - ID:', navbar.id);
  console.log('   - Classes:', navbar.className);
}

// ============================================
// 2. VERIFICAR CSS CARREGADO
// ============================================
console.log('\n📄 2. CSS CARREGADO');
console.log('─'.repeat(50));

const allLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
const mettriCss = allLinks.filter(link => {
  const href = link.href || '';
  return href.includes('panel.css') || href.includes('mettri');
});

console.log(`✅ Links CSS encontrados: ${mettriCss.length}`);
mettriCss.forEach((link, i) => {
  console.log(`   ${i + 1}. ${link.href}`);
  console.log(`      ID: ${link.id || '(sem ID)'}`);
  console.log(`      No head: ${document.head.contains(link) ? 'SIM' : 'NÃO'}`);
});

// Verificar se CSS do manifest foi injetado
const chromeExtensionCss = Array.from(document.styleSheets).filter(sheet => {
  try {
    return sheet.href && (
      sheet.href.includes('chrome-extension://') && 
      sheet.href.includes('panel.css')
    );
  } catch {
    return false;
  }
});

console.log(`✅ CSS do Manifest V3: ${chromeExtensionCss.length > 0 ? 'CARREGADO' : '❌ NÃO CARREGADO'}`);
if (chromeExtensionCss.length > 0) {
  chromeExtensionCss.forEach((sheet, i) => {
    console.log(`   ${i + 1}. ${sheet.href}`);
  });
}

// ============================================
// 3. VERIFICAR VARIÁVEIS CSS
// ============================================
console.log('\n🎨 3. VARIÁVEIS CSS');
console.log('─'.repeat(50));

const rootStyle = getComputedStyle(document.documentElement);
const panelStyle = panel ? getComputedStyle(panel) : null;

const varsToCheck = [
  '--background',
  '--foreground',
  '--primary',
  '--primary-foreground',
  '--glass-bg',
  '--glass-border',
  '--glass-shadow',
  '--sidebar',
  '--sidebar-foreground'
];

console.log('Variáveis em :root:');
varsToCheck.forEach(varName => {
  const value = rootStyle.getPropertyValue(varName).trim();
  console.log(`   ${varName}: ${value || '❌ NÃO DEFINIDA'}`);
});

if (panel) {
  console.log('\nVariáveis no painel:');
  varsToCheck.forEach(varName => {
    const value = panelStyle?.getPropertyValue(varName).trim();
    console.log(`   ${varName}: ${value || '❌ NÃO DEFINIDA'}`);
  });
}

// Verificar se variáveis OKLCH estão sendo resolvidas
console.log('\n✅ Resolução de cores OKLCH:');
try {
  const testPrimary = rootStyle.getPropertyValue('--primary').trim();
  if (testPrimary.startsWith('oklch')) {
    console.log('   ✅ Formato OKLCH detectado');
    // Tentar verificar se o navegador suporta OKLCH
    const testDiv = document.createElement('div');
    testDiv.style.color = testPrimary;
    document.body.appendChild(testDiv);
    const computed = getComputedStyle(testDiv).color;
    document.body.removeChild(testDiv);
    console.log(`   Computado: ${computed}`);
  } else {
    console.log(`   ⚠️ Formato não-OKLCH: ${testPrimary}`);
  }
} catch (e) {
  console.log(`   ❌ Erro ao verificar OKLCH: ${e.message}`);
}

// ============================================
// 4. VERIFICAR GLASSMORPHISM
// ============================================
console.log('\n🔮 4. GLASSMORPHISM');
console.log('─'.repeat(50));

if (panel && panel.classList.contains('glass')) {
  const glassStyle = getComputedStyle(panel);
  
  const backdropFilter = glassStyle.backdropFilter || glassStyle.webkitBackdropFilter || 'none';
  const background = glassStyle.backgroundColor;
  const border = glassStyle.borderColor;
  
  console.log('✅ Classe .glass encontrada no painel');
  console.log(`   backdrop-filter: ${backdropFilter || '❌ NÃO APLICADO'}`);
  console.log(`   -webkit-backdrop-filter: ${glassStyle.webkitBackdropFilter || '❌ NÃO APLICADO'}`);
  console.log(`   background: ${background}`);
  console.log(`   border: ${border}`);
  
  if (!backdropFilter || backdropFilter === 'none') {
    console.log('   ❌ PROBLEMA: backdrop-filter não está sendo aplicado!');
    console.log('      Isso pode ser causado por:');
    console.log('      - Navegador não suporta');
    console.log('      - CSS não está carregado');
    console.log('      - Propriedade está sendo sobrescrita');
  } else {
    console.log('   ✅ backdrop-filter está funcionando!');
  }
} else {
  console.log('❌ PROBLEMA: Painel não tem classe .glass!');
  if (panel) {
    console.log(`   Classes atuais: ${panel.className}`);
  }
}

// Verificar se há elementos com .glass ou .glass-subtle
const glassElements = document.querySelectorAll('.glass, .glass-subtle');
console.log(`\n✅ Elementos com glassmorphism: ${glassElements.length}`);
glassElements.forEach((el, i) => {
  const style = getComputedStyle(el);
  const hasBackdrop = style.backdropFilter !== 'none' || style.webkitBackdropFilter !== 'none';
  console.log(`   ${i + 1}. ${el.tagName}.${el.className.split(' ').join('.')} - backdrop-filter: ${hasBackdrop ? '✅' : '❌'}`);
});

// ============================================
// 5. VERIFICAR CLASSES TAILWIND
// ============================================
console.log('\n🎯 5. CLASSES TAILWIND');
console.log('─'.repeat(50));

if (panel) {
  const classes = panel.className.split(' ');
  const tailwindClasses = classes.filter(c => 
    !c.startsWith('mettri-') && 
    c.match(/^(fixed|top|right|w-|h-|glass|flex|flex-col|z-)/)
  );
  
  console.log(`✅ Classes Tailwind no painel: ${tailwindClasses.length}`);
  tailwindClasses.forEach(c => console.log(`   - ${c}`));
  
  // Verificar se classes importantes existem
  const criticalClasses = ['fixed', 'glass', 'flex', 'flex-col'];
  criticalClasses.forEach(cls => {
    const has = panel.classList.contains(cls);
    console.log(`   ${cls}: ${has ? '✅' : '❌ NÃO ENCONTRADA'}`);
  });
}

// Verificar se há classes Tailwind sendo aplicadas mas não funcionando
if (panel) {
  const testClass = panel.classList.contains('bg-primary');
  const bgColor = getComputedStyle(panel).backgroundColor;
  console.log(`\n✅ Teste de cor primária:`);
  console.log(`   Classe bg-primary: ${panel.classList.contains('bg-primary') || '(não aplicada)'}`);
  console.log(`   Background computado: ${bgColor}`);
}

// ============================================
// 6. VERIFICAR DARK MODE
// ============================================
console.log('\n🌙 6. DARK MODE');
console.log('─'.repeat(50));

const hasDarkClass = document.documentElement.classList.contains('dark');
const htmlDarkAttr = document.documentElement.getAttribute('class')?.includes('dark');
const bodyDarkAttr = document.body.classList.contains('dark');

console.log(`✅ Classe .dark no <html>: ${hasDarkClass ? 'SIM' : 'NÃO'}`);
console.log(`✅ Classe .dark no <body>: ${bodyDarkAttr ? 'SIM' : 'NÃO'}`);

if (!hasDarkClass && !bodyDarkAttr) {
  console.log('   ⚠️ Dark mode não está ativo - usando cores light mode');
} else {
  console.log('   ✅ Dark mode está ativo');
}

// Verificar variáveis de dark mode
const darkBg = rootStyle.getPropertyValue('--background').trim();
console.log(`   Background atual: ${darkBg}`);

// ============================================
// 7. VERIFICAR CONFLITOS COM CSS DO WHATSAPP
// ============================================
console.log('\n⚔️ 7. CONFLITOS COM CSS DO WHATSAPP');
console.log('─'.repeat(50));

const waStylesheets = Array.from(document.styleSheets).filter(sheet => {
  try {
    return sheet.href && (
      sheet.href.includes('whatsapp') || 
      sheet.href.includes('wa-web') ||
      !sheet.href.includes('chrome-extension://')
    );
  } catch {
    return false;
  }
});

console.log(`✅ Stylesheets do WhatsApp encontradas: ${waStylesheets.length}`);

// Verificar especificidade de regras que podem conflitar
if (panel) {
  const panelRules = [];
  try {
    Array.from(document.styleSheets).forEach(sheet => {
      try {
        Array.from(sheet.cssRules || sheet.rules || []).forEach(rule => {
          if (rule.selectorText && (
            rule.selectorText.includes('#mettri-panel') ||
            rule.selectorText.includes('.glass') ||
            rule.selectorText.includes('.bg-primary')
          )) {
            panelRules.push({
              selector: rule.selectorText,
              href: sheet.href || 'inline',
              specificity: rule.selectorText.split(' ').length
            });
          }
        });
      } catch {}
    });
    
    console.log(`\n✅ Regras CSS que afetam o painel: ${panelRules.length}`);
    panelRules.slice(0, 10).forEach((rule, i) => {
      console.log(`   ${i + 1}. ${rule.selector}`);
      console.log(`      Fonte: ${rule.href}`);
      console.log(`      Especificidade: ${rule.specificity}`);
    });
  } catch (e) {
    console.log(`   ⚠️ Não foi possível verificar regras CSS: ${e.message}`);
  }
}

// ============================================
// 8. VERIFICAR FONTES
// ============================================
console.log('\n🔤 8. FONTES');
console.log('─'.repeat(50));

if (panel) {
  const fontFamily = getComputedStyle(panel).fontFamily;
  const fontSize = getComputedStyle(panel).fontSize;
  
  console.log(`✅ Font-family: ${fontFamily}`);
  console.log(`✅ Font-size: ${fontSize}`);
  
  if (!fontFamily.includes('Inter')) {
    console.log('   ⚠️ Fonte Inter não está sendo aplicada');
  }
}

// ============================================
// 9. VERIFICAR ESPECIFICIDADE E SOBRESCRITAS
// ============================================
console.log('\n🎯 9. ESPECIFICIDADE E SOBRESCRITAS');
console.log('─'.repeat(50));

if (panel) {
  const computed = getComputedStyle(panel);
  const inline = panel.getAttribute('style');
  
  console.log(`✅ CSS inline: ${inline || 'Nenhum'}`);
  
  // Verificar propriedades críticas
  const criticalProps = {
    'background-color': computed.backgroundColor,
    'backdrop-filter': computed.backdropFilter || computed.webkitBackdropFilter || 'none',
    'border': computed.border,
    'color': computed.color,
    'position': computed.position,
    'z-index': computed.zIndex
  };
  
  console.log('\n✅ Propriedades críticas computadas:');
  Object.entries(criticalProps).forEach(([prop, value]) => {
    console.log(`   ${prop}: ${value}`);
  });
}

// ============================================
// 10. VERIFICAR BUILD E PROCESSAMENTO
// ============================================
console.log('\n🔨 10. BUILD E PROCESSAMENTO');
console.log('─'.repeat(50));

// Verificar se há comentários de build no CSS
const cssText = Array.from(document.styleSheets)
  .map(sheet => {
    try {
      return Array.from(sheet.cssRules || []).map(r => r.cssText).join('\n');
    } catch {
      return '';
    }
  })
  .join('\n');

const hasTailwindComment = cssText.includes('tailwindcss') || cssText.includes('@layer');
const hasPostCssComment = cssText.includes('postcss') || cssText.includes('autoprefixer');

console.log(`✅ Marca de Tailwind no CSS: ${hasTailwindComment ? 'SIM' : '❌ NÃO'}`);
console.log(`✅ Marca de PostCSS no CSS: ${hasPostCssComment ? 'SIM' : '❌ NÃO'}`);

// ============================================
// RESUMO E RECOMENDAÇÕES
// ============================================
console.log('\n📊 RESUMO E RECOMENDAÇÕES');
console.log('═'.repeat(50));

const issues = [];

if (!panel) issues.push('❌ Painel principal não encontrado');
if (!navbar) issues.push('⚠️ NavBar não encontrada');
if (mettriCss.length === 0 && chromeExtensionCss.length === 0) {
  issues.push('❌ CSS do Mettri não está sendo carregado');
}
if (panel && !panel.classList.contains('glass')) {
  issues.push('❌ Classe .glass não está aplicada ao painel');
}
if (panel) {
  const style = getComputedStyle(panel);
  if (!style.backdropFilter && !style.webkitBackdropFilter) {
    issues.push('❌ backdrop-filter não está funcionando');
  }
}
if (!hasDarkClass && !bodyDarkAttr) {
  issues.push('⚠️ Dark mode não está ativo (se esperado)');
}

if (issues.length === 0) {
  console.log('✅ Nenhum problema crítico encontrado!');
  console.log('   Se o visual ainda está diferente, pode ser:');
  console.log('   - Valores de variáveis CSS diferentes da referência');
  console.log('   - Classes Tailwind específicas faltando');
  console.log('   - Problemas de espaçamento/tamanho');
} else {
  console.log('❌ PROBLEMAS ENCONTRADOS:');
  issues.forEach(issue => console.log(`   ${issue}`));
}

console.log('\n💡 PRÓXIMOS PASSOS:');
console.log('   1. Se CSS não carregou: recarregue a extensão');
console.log('   2. Se glassmorphism não funciona: verifique suporte do navegador');
console.log('   3. Se variáveis não resolvem: verifique formato OKLCH');
console.log('   4. Se classes Tailwind não funcionam: verifique build');

console.log('\n✅ Diagnóstico completo!');