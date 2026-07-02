/**
 * Script para aplicar o tema VSCode Industrial
 * 
 * Execute este script no console do DevTools do WhatsApp Web:
 * 1. Abra o WhatsApp Web
 * 2. Abra o DevTools (F12)
 * 3. Vá na aba Console
 * 4. Cole e execute este código
 */

(async function() {
  console.log('🎨 Aplicando tema VSCode Industrial...');
  
  try {
    // Verificar se ThemeLoader está disponível
    if (typeof window.ThemeLoader === 'undefined') {
      console.error('❌ ThemeLoader não está disponível. Certifique-se de que a extensão está carregada.');
      console.log('💡 Tente recarregar a página ou a extensão.');
      return;
    }
    
    // Carregar tema VSCode
    await window.ThemeLoader.load('vscode-industrial');
    
    console.log('✅ Tema VSCode Industrial aplicado com sucesso!');
    console.log('🎨 Visual agora: Escuro, minimalista, sem ícones, fonte monospace');
    
    // Verificar tema atual
    const currentTheme = window.ThemeLoader.getCurrentTheme();
    console.log('📋 Tema atual:', currentTheme);
    
    // Verificar painel
    const panel = document.getElementById('mettri-panel');
    if (panel) {
      console.log('✅ Painel encontrado');
      const themeAttr = panel.getAttribute('data-theme');
      console.log('📝 Atributo data-theme:', themeAttr);
    } else {
      console.warn('⚠️ Painel não encontrado. O Mettri pode não ter inicializado ainda.');
    }
    
  } catch (error) {
    console.error('❌ Erro ao aplicar tema:', error);
  }
})();
