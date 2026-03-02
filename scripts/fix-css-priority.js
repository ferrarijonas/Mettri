/**
 * Script para verificar e corrigir prioridade do CSS
 * 
 * Execute este script no console do DevTools do WhatsApp Web
 * para verificar se há CSS sobrescrevendo as variáveis do Tailwind.
 */

console.log('🔧 VERIFICAÇÃO DE PRIORIDADE CSS');
console.log('==================================\n');

// Verificar todas as stylesheets
const allSheets = Array.from(document.styleSheets);
console.log(`📚 Total de stylesheets: ${allSheets.length}\n`);

// Procurar pelo CSS do Mettri em stylesheets
let mettriSheet = null;
let mettriSheetIndex = -1;

allSheets.forEach((sheet, index) => {
  try {
    if (sheet.href) {
      if (sheet.href.includes('panel.css') || sheet.href.includes('chrome-extension://')) {
        console.log(`✅ CSS do Mettri encontrado na posição ${index}:`);
        console.log(`   URL: ${sheet.href}`);
        mettriSheet = sheet;
        mettriSheetIndex = index;
      }
    }
  } catch (e) {
    // Ignorar erros de CORS
  }
});

// Procurar por <style> tags injetadas pelo Mettri
const styleTags = document.querySelectorAll('style#mettri-critical-css, style[id*="mettri"]');
console.log(`\n📋 <style> tags do Mettri encontradas: ${styleTags.length}`);

if (styleTags.length > 0) {
  console.log('✅ CSS crítico do Mettri está sendo injetado via JavaScript!');
  styleTags.forEach((tag, i) => {
    console.log(`   ${i + 1}. ID: ${tag.id || '(sem ID)'}`);
    console.log(`      Tamanho do CSS: ${tag.textContent?.length || 0} caracteres`);
  });
}

if (!mettriSheet && styleTags.length === 0) {
  console.log('❌ CSS do Mettri não encontrado!');
  console.log('   - Não encontrado em stylesheets');
  console.log('   - Não encontrado em <style> tags');
  console.log('   Recomendação: Recarregue a extensão');
} else if (!mettriSheet) {
  console.log('\n⚠️ CSS do Mettri não está em stylesheets (comportamento esperado do Manifest V3)');
  console.log('   ✅ Mas está sendo injetado via <style> tag (correto!)');
} else {
  console.log(`\n✅ CSS do Mettri está na posição ${mettiSheetIndex} de ${allSheets.length}`);
  
  // Verificar se há sheets depois do Mettri que podem sobrescrever
  const sheetsAfter = allSheets.slice(mettiSheetIndex + 1);
  console.log(`\n📋 Sheets carregados DEPOIS do Mettri: ${sheetsAfter.length}`);
  
  if (sheetsAfter.length > 0) {
    console.log('⚠️ ATENÇÃO: Sheets carregados depois podem sobrescrever variáveis!');
    sheetsAfter.slice(0, 5).forEach((sheet, i) => {
      try {
        console.log(`   ${i + 1}. ${sheet.href || 'inline'}`);
      } catch {}
    });
  }
}

// Verificar variável --primary específica
const rootStyle = getComputedStyle(document.documentElement);
const primaryValue = rootStyle.getPropertyValue('--primary').trim();

console.log(`\n🎨 Valor de --primary no :root: ${primaryValue}`);

if (primaryValue && !primaryValue.startsWith('oklch')) {
  console.log('❌ PROBLEMA: --primary não está em formato OKLCH!');
  console.log(`   Valor atual: ${primaryValue}`);
  console.log(`   Esperado: oklch(0.72 0.17 155)`);
  
  // Tentar encontrar quem está definindo isso
  console.log('\n🔍 Procurando origem da variável --primary:');
  
  allSheets.forEach((sheet, index) => {
    try {
      const rules = Array.from(sheet.cssRules || []);
      rules.forEach(rule => {
        if (rule.style && rule.style.getPropertyValue('--primary')) {
          const value = rule.style.getPropertyValue('--primary').trim();
          if (value && !value.startsWith('oklch')) {
            console.log(`   ❌ Encontrado em sheet ${index}: ${sheet.href || 'inline'}`);
            console.log(`      Selector: ${rule.selectorText || 'N/A'}`);
            console.log(`      Valor: ${value}`);
          }
        }
      });
    } catch {}
  });
} else if (primaryValue && primaryValue.startsWith('oklch')) {
  console.log('✅ --primary está no formato OKLCH correto!');
  console.log(`   Valor: ${primaryValue}`);
} else {
  console.log('⚠️ --primary não está definida');
}

// Verificar se variáveis estão sendo aplicadas via JavaScript (setProperty)
console.log('\n🔍 Verificando variáveis aplicadas via JavaScript:');
const primaryViaJS = rootStyle.getPropertyValue('--primary').trim();
if (primaryViaJS && primaryViaJS.startsWith('oklch')) {
  console.log('   ✅ --primary está sendo aplicada corretamente via CSS/JS');
} else if (primaryViaJS) {
  console.log(`   ❌ --primary está como: ${primaryViaJS} (não é OKLCH)`);
}

// Verificar se CSS crítico está funcionando
const criticalStyle = document.getElementById('mettri-critical-css');
if (criticalStyle) {
  console.log('\n✅ CSS crítico injetado encontrado!');
  const hasPrimary = criticalStyle.textContent?.includes('--primary: oklch');
  if (hasPrimary) {
    console.log('   ✅ Variável --primary está definida no CSS crítico');
  } else {
    console.log('   ⚠️ Variável --primary não encontrada no CSS crítico');
  }
} else {
  console.log('\n❌ CSS crítico não está injetado!');
  console.log('   Isso pode indicar que injectCriticalCSS() não foi executado');
}

// Verificar se há tema antigo sendo carregado
const themeLink = document.getElementById('mettri-theme');
if (themeLink) {
  console.log('\n⚠️ PROBLEMA: Tema antigo (mettri-theme) ainda está sendo carregado!');
  console.log(`   URL: ${themeLink.href || themeLink.getAttribute('href') || 'N/A'}`);
  console.log('   Recomendação: Remover este link do DOM');
} else {
  console.log('\n✅ Tema antigo não está sendo carregado');
}

console.log('\n💡 AÇÕES RECOMENDADAS:');
console.log('   1. Recarregue a extensão completamente');
console.log('   2. Limpe o cache do navegador (Ctrl+Shift+Delete)');
console.log('   3. Verifique se o tema antigo foi realmente desabilitado');
console.log('   4. Se necessário, adicione !important às variáveis CSS');
