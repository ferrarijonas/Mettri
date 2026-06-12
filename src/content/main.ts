import { MettriPanel } from '../ui/panel';
import { MessageCapturer } from '../core/message-capturer';
import { ThemeLoader } from '../ui/theme';
import { whatsappInterceptors } from '../infrastructure/interceptors-core';
import { whatsappInterceptors as interceptorsWrapper } from '../infrastructure/whatsapp-interceptors';
import { UserSessionManager } from '../infrastructure/user-session-manager';
import { MettriBridgeClient } from './bridge-client';
import { ModuleUpdater } from '../infrastructure/module-updater';
import type { CapturedMessage } from '../types';

class MettriApp {
  private panel: MettriPanel | null = null;
  private capturer: MessageCapturer | null = null;
  private isInitialized = false;
  private bridge = new MettriBridgeClient(60000);

  constructor() {
    console.log('[MettriApp] Inicializando no contexto MAIN (acesso direto)');
    this.initialize();
  }

  /**
   * Inicializa interceptors e aguarda estar pronto antes de iniciar UI
   */
  private async initialize(): Promise<void> {
    try {
      // Verificar se o bridge (isolated world) está ativo
      try {
        const ping = await this.bridge.ping();
        console.log('[MettriApp] Bridge OK:', ping);
        // Expor para debug e para módulos como ModuleUpdater que precisam contornar CSP
        window.MettriBridge = this.bridge;
        (window as any).__mettriBridgeClient = this.bridge;
      } catch (e) {
        console.warn('[MettriApp] ⚠️ Bridge indisponível (fallback limitado):', e);
      }

      // Inicializar interceptors-core diretamente (agora roda no mesmo contexto)
      console.log('[MettriApp] Inicializando WhatsAppInterceptors...');
      
      // Verificar se webpack está disponível antes de tentar inicializar
      if (!whatsappInterceptors.isWebpackAvailable()) {
        console.log('[MettriApp] Webpack não disponível ainda, aguardando...');
        // Aguardar até ~60s (padrão do bootstrap antigo)
        let attempts = 0;
        while (!whatsappInterceptors.isWebpackAvailable() && attempts < 120) {
          await new Promise(resolve => setTimeout(resolve, 500));
          attempts++;
        }
        
        if (!whatsappInterceptors.isWebpackAvailable()) {
          console.warn('[MettriApp] Webpack não disponível após timeout, continuando...');
        }
      }

      // Inicializar interceptors-core
      await whatsappInterceptors.initialize();
      
      // Aguardar wrapper estar pronto (ele aguarda window.Mettri)
      await interceptorsWrapper.initialize();

      console.log('[MettriApp] ✅ WhatsAppInterceptors inicializado!');
      
      // Verificar atualizações de módulos em background (não bloquear UI)
      this.checkModuleUpdates();
      
      // Iniciar UI após interceptors estarem prontos
      this.startUI();
    } catch (error) {
      console.error('[MettriApp] Erro ao inicializar:', error);
      // Mesmo com erro, tentar iniciar UI (pode funcionar parcialmente)
      this.startUI();
    }
  }

  /**
   * Verifica atualizações de módulos
   */
  private async checkModuleUpdates(): Promise<void> {
    try {
      console.log('[MettriApp] Verificando atualizações de módulos...');
      const moduleUpdater = new ModuleUpdater();
      const result = await moduleUpdater.checkForUpdates();
      
      if (result.hasUpdate) {
        console.log(`[MettriApp] ✅ Atualizações disponíveis: ${result.modulesToUpdate.length} módulos`);
      } else {
        console.log('[MettriApp] Nenhuma atualização disponível');
      }
    } catch (error) {
      console.warn('[MettriApp] Erro ao verificar atualizações (continuando com código local):', error);
      // Não bloquear inicialização se verificação falhar
    }
  }

  /**
   * Inicia a interface do usuário
   */
  private async startUI(): Promise<void> {
    if (this.isInitialized) {
      console.warn('[MettriApp] ⚠️ UI já inicializada, ignorando...');
      return;
    }
    this.isInitialized = true;

    console.log('[MettriApp] 🚀 Iniciando Interface do Usuário (Painel)...');

    // Expor ThemeLoader globalmente para acesso via console (caso necessário para testes)
    window.ThemeLoader = ThemeLoader;

    // Create UI panel
    this.panel = new MettriPanel();

    // Create message capturer
    this.capturer = new MessageCapturer();

    // Conectar capturer ao painel (para UI e módulos reagirem)
    this.capturer.onMessage(message => {
      this.panel?.addMessage(message);
    });
    this.panel.setMessageCapturer(this.capturer);

    // Conectar sessão do usuário na UI (NavBar) usando código já existente
    try {
      const sessionManager = new UserSessionManager();
      const session = await sessionManager.initialize(interceptorsWrapper);
      this.panel.setUserSession(session);
    } catch (error) {
      console.warn('[MettriApp] ⚠️ Não foi possível inicializar sessão do usuário:', error);
      this.panel.setUserSession(null);
    }

    // Iniciar captura (webpack)
    try {
      await this.capturer.start();
      this.panel.setCapturing(true);
    } catch (error) {
      console.error('[MettriApp] ❌ Erro ao iniciar captura:', error);
      this.panel.setCapturing(false);
    }
    console.log('[MettriApp] ✅ UI Inicializada com sucesso!');
  }

  public destroy(): void {
    this.capturer?.stop();
    this.isInitialized = false;
  }

  /** Força o reprocessamento de uma mensagem pelo pipeline do Ouvinte. Usado para testes/debug. */
  public async triggerPipeline(message: { text: string; chatId: string; isOutgoing?: boolean }): Promise<boolean> {
    if (!this.panel || !this.isInitialized) return false;
    const msg: CapturedMessage = {
      id: `test_${Date.now()}`,
      chatId: message.chatId,
      chatName: '',
      sender: message.chatId,
      text: message.text,
      timestamp: new Date(),
      isOutgoing: message.isOutgoing ?? false,
      type: 'text',
    };
    this.panel.addMessage(msg);
    return true;
  }
}

// Initialize when DOM is ready
let appInstance: MettriApp | null = null;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    appInstance = new MettriApp();
    (window as any).__METTRI_INTERNAL__ = { app: appInstance };
  });
} else {
  appInstance = new MettriApp();
  (window as any).__METTRI_INTERNAL__ = { app: appInstance };
}
