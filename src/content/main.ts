import { MettriPanel } from '../ui/panel';
import { MessageCapturer } from '../core/message-capturer';

class MettriApp {
  private panel: MettriPanel | null = null;
  private capturer: MessageCapturer | null = null;
  private isInitialized = false;

  constructor() {
    this.waitForWhatsApp();
    this.setupKeyboardShortcuts();
  }

  private waitForWhatsApp(): void {
    // Padrão reverse.txt: aguardar 5 segundos antes de verificar bundler (linha 202)
    setTimeout(() => {
      this.startBundlerCheck();
    }, 5000);
  }

  private startBundlerCheck(): void {
    // Wait for WhatsApp to fully load AND bundler to be available
    let attempts = 0;
    const maxAttempts = 120; // 60 segundos (500ms * 120) - aumentado para dar mais tempo
    
    const checkInterval = setInterval(() => {
      attempts++;
      const app = document.querySelector('#app');
      
      // #region DIAGNÓSTICO COMPLETO - Verificar TODAS as possibilidades
      // Com world: MAIN, window é o window real da página
      // Verificar webpack padrão
      const webpackExists = typeof window !== 'undefined' && 'webpackChunkwhatsapp_web_client' in window;
      const webpackIsArray = webpackExists && Array.isArray(window.webpackChunkwhatsapp_web_client);
      const webpackLength = webpackIsArray ? window.webpackChunkwhatsapp_web_client.length : -1;
      const webpackAvailable = webpackIsArray && webpackLength > 0;
      
      // Verificar Comet (padrão reverse.txt linhas 207-208)
      const hasRequire = typeof window !== 'undefined' && window.require && window.__d;
      let cometAvailable = false;
      let cometError: string | null = null;
      
      if (hasRequire) {
        try {
          // Acesso direto como no reverse.txt linha 210
          const debug = window.require!('__debug');
          const modulesMap = debug?.modulesMap;
          cometAvailable = !!modulesMap;
        } catch (e) {
          cometError = e instanceof Error ? e.message : String(e);
          // Falha silenciosa - bundler pode não estar totalmente carregado
        }
      }
      
      // Verificar propriedades do window que podem ser bundler
      const windowKeys = typeof window !== 'undefined' ? Object.keys(window) : [];
      const webpackLikeProps: string[] = [];
      const requireLikeProps: string[] = [];
      
      if (typeof window !== 'undefined') {
        for (const key of windowKeys) {
          if (key.toLowerCase().includes('webpack') || key.toLowerCase().includes('chunk')) {
            webpackLikeProps.push(key);
          }
          if (key.toLowerCase().includes('require') || key === '__d') {
            requireLikeProps.push(key);
          }
        }
      }
      
      // Verificar se webpack está em propriedades não enumeráveis
      let webpackInDescriptor = false;
      let webpackDescriptorType: string = 'N/A';
      try {
        const descriptor = Object.getOwnPropertyDescriptor(window, 'webpackChunkwhatsapp_web_client');
        if (descriptor) {
          webpackInDescriptor = true;
          webpackDescriptorType = typeof descriptor.value;
        }
      } catch {}
      
      // Verificar valor real de window.require e window.__d
      const requireType = typeof window !== 'undefined' && window.require ? typeof window.require : 'undefined';
      const __dType = typeof window !== 'undefined' && window.__d ? typeof window.__d : 'undefined';
      const requireValue = typeof window !== 'undefined' && window.require ? String(window.require).substring(0, 100) : 'N/A';
      // #endregion
      
      // Buscar todas as propriedades do window que podem ser webpack
      const allWindowKeys = typeof window !== 'undefined' ? Object.keys(window) : [];
      
      // Verificar TODAS as propriedades (incluindo não enumeráveis)
      const allWindowProps: string[] = [];
      try {
        // Obter propriedades próprias enumeráveis
        allWindowProps.push(...Object.keys(window));
        // Obter propriedades próprias não enumeráveis
        allWindowProps.push(...Object.getOwnPropertyNames(window));
        // Obter propriedades do prototype
        if (Object.getPrototypeOf(window)) {
          allWindowProps.push(...Object.getOwnPropertyNames(Object.getPrototypeOf(window)));
        }
      } catch {}
      
      const uniqueProps = [...new Set(allWindowProps)];
      const webpackLikeKeys = uniqueProps.filter(k => 
        k.toLowerCase().includes('webpack') || 
        k.toLowerCase().includes('chunk') ||
        k.toLowerCase().includes('bundler') ||
        (k.includes('require') && typeof (window as any)[k] === 'function') ||
        (k.includes('__d') && typeof (window as any)[k] !== 'undefined')
      ).slice(0, 30);
      
      // Verificar se webpack está em alguma propriedade com nome diferente
      const webpackVariants = [
        'webpackChunkwhatsapp_web_client',
        'webpackChunkwhatsapp_web',
        'webpackChunkwhatsapp',
        '__webpack_require__',
        'webpackJsonp',
        '__webpack_chunk_load__'
      ];
      
      const foundVariants: any = {};
      webpackVariants.forEach(variant => {
        try {
          if (variant in window) {
            const value = (window as any)[variant];
            foundVariants[variant] = {
              exists: true,
              type: typeof value,
              isArray: Array.isArray(value),
              length: Array.isArray(value) ? value.length : undefined
            };
          }
        } catch {}
      });
      
      // Verificar propriedades não enumeráveis e em iframes
      let webpackInIframes = false;
      let webpackInWindowDescriptor = false;
      try {
        const descriptor = Object.getOwnPropertyDescriptor(window, 'webpackChunkwhatsapp_web_client');
        webpackInWindowDescriptor = !!descriptor;
        if (descriptor && descriptor.value) {
          webpackInIframes = Array.isArray(descriptor.value);
        }
      } catch {}
      
      // Verificar todos os iframes
      const iframes = document.querySelectorAll('iframe');
      const iframeWebpackChecks: any[] = [];
      iframes.forEach((iframe, idx) => {
        try {
          const iframeWindow = iframe.contentWindow;
          if (iframeWindow && 'webpackChunkwhatsapp_web_client' in iframeWindow) {
            iframeWebpackChecks.push({
              index: idx,
              hasWebpack: true,
              isArray: Array.isArray(iframeWindow.webpackChunkwhatsapp_web_client)
            });
          }
        } catch {}
      });
      
      if (attempts % 10 === 0 || attempts === 1 || attempts === maxAttempts) {
        // Definir hasDebug antes de usar
        const hasDebug = typeof window !== 'undefined' && 
          ((window.require && window.__d) || 
           typeof window.webpackChunkwhatsapp_web_client !== 'undefined');
        
        console.log(`[DEBUG] Attempt ${attempts}:`, {
          appExists: !!app,
          webpackExists,
          webpackIsArray,
          webpackLength,
          webpackAvailable,
          hasRequire,
          hasDebug,
          cometAvailable,
          cometError,
          requireType,
          __dType,
          requireValue: requireValue.substring(0, 50),
          webpackLikeProps: webpackLikeProps.slice(0, 10),
          requireLikeProps: requireLikeProps.slice(0, 10),
          webpackInDescriptor,
          webpackDescriptorType,
          webpackLikeKeys: webpackLikeKeys.slice(0, 10),
          webpackInWindowDescriptor,
          iframeCount: iframes.length,
          iframeWebpackChecks,
          foundVariants,
          totalWindowProps: uniqueProps.length,
          sampleWindowKeys: uniqueProps.slice(0, 20).filter(k => 
            !k.startsWith('_') && 
            !k.startsWith('webkit') && 
            !k.includes('webkit') &&
            !k.includes('chrome') &&
            !k.includes('webkit')
          )
        });
      }
      
      fetch('http://127.0.0.1:7242/ingest/58de6e75-6d9e-4b0c-b575-37c34eed59d3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.ts:59',message:'Webpack check attempt',data:{attempt:attempts,appExists:!!app,webpackExists,webpackIsArray,webpackLength,webpackAvailable,webpackLikeKeys,hasRequire,cometAvailable,foundVariants,totalWindowProps:uniqueProps.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // #region agent log
      if (webpackExists && !webpackIsArray) {
        const webpackType = typeof window.webpackChunkwhatsapp_web_client;
        fetch('http://127.0.0.1:7242/ingest/58de6e75-6d9e-4b0c-b575-37c34eed59d3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.ts:32',message:'Webpack exists but wrong type',data:{webpackType,value:String(window.webpackChunkwhatsapp_web_client).substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      }
      // #endregion

      // Verificar se webpack OU comet está disponível (padrão reverse.txt)
      const bundlerAvailable = webpackAvailable || cometAvailable;
      
      if (app && bundlerAvailable) {
        clearInterval(checkInterval);
        // #region agent log
        console.log(`[DEBUG] Bundler found!`, {
          attempt: attempts,
          webpackAvailable,
          cometAvailable,
          webpackLength,
          usingComet: cometAvailable && !webpackAvailable
        });
        fetch('http://127.0.0.1:7242/ingest/58de6e75-6d9e-4b0c-b575-37c34eed59d3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.ts:38',message:'Bundler found, initializing',data:{attempt:attempts,webpackAvailable,cometAvailable,webpackLength},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        // Aguardar um pouco mais para garantir que bundler está totalmente carregado
        setTimeout(() => this.init(), 1000);
        return;
      }

      if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        // #region agent log
        const allWindowKeys = Object.keys(window).filter(k=>k.toLowerCase().includes('webpack')||k.toLowerCase().includes('chunk')).slice(0,20);
        console.error('[DEBUG] Final state:', {
          attempts,
          appExists: !!app,
          webpackExists,
          webpackIsArray,
          webpackLength,
          cometAvailable,
          hasRequire,
          allWindowKeys,
          webpackType: webpackExists ? typeof window.webpackChunkwhatsapp_web_client : 'N/A',
          webpackValue: webpackExists ? String(window.webpackChunkwhatsapp_web_client).substring(0, 500) : 'N/A'
        });
        fetch('http://127.0.0.1:7242/ingest/58de6e75-6d9e-4b0c-b575-37c34eed59d3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.ts:75',message:'Timeout reached',data:{attempts,appExists:!!app,webpackExists,webpackIsArray,webpackLength,cometAvailable,hasRequire,allWindowKeys},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        if (!this.isInitialized) {
          console.warn('Mettri: WhatsApp Web ou bundler não carregaram a tempo');
          if (app && !bundlerAvailable) {
            console.error('Mettri: WhatsApp carregou mas bundler não está disponível');
          }
        }
      }
    }, 500);
  }

  private init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    console.log('Mettri: Initializing...');

    // Create UI panel
    this.panel = new MettriPanel();

    // Create message capturer
    this.capturer = new MessageCapturer();

    // Connect capturer to panel
    this.capturer.onMessage(message => {
      this.panel?.addMessage(message);
    });

    // Conectar capturer ao painel para estatísticas
    this.panel?.setMessageCapturer(this.capturer);

    // Start capturing (apenas webpack, sem fallback)
    this.capturer.start().catch(error => {
      console.error('Mettri: Erro ao iniciar captura:', error);
      // Não tentar fallback - apenas logar erro
    });
    this.panel.setCapturing(true);

    console.log('Mettri: Initialized successfully');
  }

  /**
   * Configura atalhos de teclado.
   * Removido: auto-mapeamento não é mais suportado
   */
  private setupKeyboardShortcuts(): void {
    // Atalhos removidos - foco apenas em webpack
  }

  public destroy(): void {
    this.capturer?.stop();
    this.isInitialized = false;
  }
}

// Initialize when DOM is ready
// Com world: MAIN, temos acesso ao window real da página
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[METTRI] Inicializando no contexto MAIN (acesso ao window da página)');
    new MettriApp();
  });
} else {
  console.log('[METTRI] Inicializando no contexto MAIN (acesso ao window da página)');
  new MettriApp();
}
