/**
 * WhatsAppInterceptors
 * 
 * Sistema que acessa módulos internos do WhatsApp Web via webpack chunk.
 * Segue EXATAMENTE o padrão do reverse.txt (linhas 228-308).
 * 
 * TEMPORÁRIO: Verbosidade reduzida para focar em detecção de conta
 * TODO: Restaurar logs completos após conta carregar com sucesso
 */

import { StrategyMonitor } from './strategy-monitor';

declare global {
  interface Window {
    webpackChunkwhatsapp_web_client?: any[];
    require?: (module: string) => any;
    __d?: any;
    ErrorGuard?: {
      skipGuardGlobal: (skip: boolean) => void;
    };
  }
}

/**
 * Função helper para log seguro de objetos (evita referências circulares)
 * Melhorada para mostrar conteúdo real, não apenas "Object"
 */
function safeLog(obj: any, label: string): void {
  const seen = new WeakSet();

  try {
    // Forma 1: Logar propriedades específicas
    const info: any = {
      label,
      type: typeof obj,
      isFunction: typeof obj === 'function',
      isObject: typeof obj === 'object',
      constructor: obj?.constructor?.name,
      hasOn: typeof obj?.on === 'function',
      hasGet: typeof obj?.get === 'function',
      hasDefault: !!obj?.default,
    };

    // Tentar obter chaves (pode falhar se objeto tem getters)
    try {
      info.keys = Object.keys(obj || {}).slice(0, 30);
    } catch { }

    // Tentar obter propriedades próprias
    try {
      info.ownPropertyNames = Object.getOwnPropertyNames(obj || {}).slice(0, 30);
    } catch { }

    // Verificar propriedades específicas
    const checkProps = ['default', 'Collection', 'Model', 'Chat', 'Msg', 'PresenceCollection'];
    checkProps.forEach(prop => {
      try {
        if (obj && prop in obj) {
          info[`has${prop}`] = true;
          info[`${prop}Type`] = typeof obj[prop];
          if (typeof obj[prop] === 'object') {
            info[`${prop}HasOn`] = typeof obj[prop]?.on === 'function';
            info[`${prop}HasGet`] = typeof obj[prop]?.get === 'function';
          }
        }
      } catch { }
    });

    // ${label} disponível

    // Forma 2: Tentar JSON.stringify (pode falhar com objetos circulares)
    try {
      const json = JSON.stringify(obj, (key, value) => {
        void key;
        if (typeof value === 'function') return '[Function]';
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      }, 2);
      if (json.length > 1000) {
        // ${label} (JSON disponível)
      } else {
        // ${label} (JSON completo)
      }
    } catch (e: any) {
      // ${label} (JSON failed): ${e.message}
    }
  } catch (error: any) {
    // ${label} (log failed): ${error.message}
  }
}
export class WhatsAppInterceptors {
  private webpackChunk: any;
  private modules: Record<string, () => any> = {};
  private initialized = false;
  private modulesCache: Record<string, any> = {}; // Cache de módulos (equivalente ao Ct do reverse.txt)
  private N: any = null; // Objeto N (cópia de GroupMetadata.default) - padrão reverse.txt linha 309
  private warnedModules: Set<string> = new Set(); // Rastrear módulos que já geraram avisos
  private suppressModuleWarnings = false; // Flag para suprimir avisos durante inicialização

  /**
   * Aguarda o WhatsApp Web ficar "pronto" (padrão WA-Sync: AppState).
   * Metáfora: esperar o "semáforo" abrir antes de atravessar.
   *
   * IMPORTANTE: se não conseguir determinar AppState, faz fallback para
   * "bundler/require disponível" com timeout.
   */
  private async waitForWhatsAppReady(options?: { timeoutMs?: number; pollMs?: number }): Promise<void> {
    const timeoutMs = options?.timeoutMs ?? 60_000;
    const pollMs = options?.pollMs ?? 250;

    const acceptedStates = new Set(['CONNECTED', 'OPENING', 'PAIRING', 'TIMEOUT']);

    type RequireFn = (moduleId: string) => unknown;
    type SocketModel = { Socket?: { state?: unknown } };

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const appExists = typeof document !== 'undefined' && !!document.querySelector('#app');
      const hasRequire = typeof window !== 'undefined' && typeof window.require === 'function';
      const hasWebpack = typeof window !== 'undefined' && Array.isArray(window.webpackChunkwhatsapp_web_client);

      if (appExists && (hasRequire || hasWebpack)) {
        if (hasRequire) {
          try {
            const req = window.require as unknown as RequireFn;
            const socketModel = req('WAWebSocketModel') as SocketModel | null;
            const state = socketModel?.Socket?.state;
            if (typeof state === 'string' && acceptedStates.has(state)) {
              return;
            }
          } catch {
            // Ignorar: módulos podem não estar prontos ainda.
          }
        } else {
          // Webpack chunk disponível (mesmo que vazio) + #app existe.
          return;
        }
      }

      await new Promise(resolve => setTimeout(resolve, pollMs));
    }
  }

  /**
   * Verifica se algum bundler (webpack ou comet) está disponível.
   * Segue padrão do reverse.txt (linhas 207-242).
   */
  isWebpackAvailable(): boolean {
    const hasRequire = typeof window !== 'undefined' && typeof window.require === 'function';
    const hasWebpackChunkArray =
      typeof window !== 'undefined' && Array.isArray(window.webpackChunkwhatsapp_web_client);

    // IMPORTANTE: não exigir `__d` e não exigir `length > 0`.
    // - WA-Sync opera com `window.require(...)` mesmo sem `__d`.
    // - Em algumas versões, `webpackChunk...` existe mas começa vazio; o push acorda o runtime.
    return hasRequire || hasWebpackChunkArray;
  }

  /**
   * Inicializa o sistema de interceptação.
   * Segue EXATAMENTE o padrão do reverse.txt (linhas 207-242).
   * Suporta tanto Comet quanto Webpack.
   * 
   * @throws Error se nenhum bundler estiver disponível
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Expor o objeto base cedo para evitar "carregamento infinito" no wrapper/testes
    if (typeof window !== 'undefined' && !(window as any).Mettri) {
      (window as any).Mettri = {
        isWebpackAvailable: () => this.isWebpackAvailable(),
        initialize: () => this.initialize(),
        __ready: false,
      };
    }

    // Gate estilo WA-Sync: esperar app estar pronto o suficiente
    await this.waitForWhatsAppReady();

    if (!this.isWebpackAvailable()) {
      throw new Error('Cannot find bundler');
    }

    // Padrão reverse.txt: verificar Comet primeiro (linhas 207-226)
    if (typeof window.require === 'function') {
      // Sistema Comet
      try {
        // CRÍTICO: Aguardar que módulos críticos estejam prontos antes de acessar
        // Tentar acessar __debug de forma segura
        let debug: unknown;
        try {
          debug = window.require('__debug');
        } catch (error) {
          // Se __debug não estiver disponível ainda, aguardar um pouco
          // Log removido temporariamente - foco em detecção de conta
          await new Promise(resolve => setTimeout(resolve, 500));
          debug = window.require('__debug');
        }

        const modulesMap =
          typeof debug === 'object' && debug !== null && 'modulesMap' in debug
            ? ((debug as { modulesMap?: Record<string, unknown> }).modulesMap ?? {})
            : {};
        const moduleKeys = Object.keys(modulesMap);

        // #region agent log
        // Usando Comet bundler
        // #endregion

        // Criar módulos do Comet (padrão WA Web Plus: usar importNamespace se disponível)
        // WA Web Plus usa: importNamespace(t) dentro de try/finally com ErrorGuard
        if (moduleKeys.length > 0) {
          for (const moduleId of moduleKeys) {
            this.modules[moduleId] = () => {
              try {
                // Padrão WA Web Plus: usar ErrorGuard antes de acessar
                if (window.ErrorGuard) {
                  window.ErrorGuard.skipGuardGlobal(true);
                }

                // Tentar importNamespace primeiro (forma correta do Comet - WA Web Plus)
                let result: unknown;
                if (typeof (window as any).importNamespace === 'function') {
                  result = (window as any).importNamespace(moduleId);
                } else {
                  // Fallback para require
                  result = window.require!(moduleId);
                }

                if (window.ErrorGuard) {
                  window.ErrorGuard.skipGuardGlobal(false);
                }
                return result;
              } catch (error) {
                if (window.ErrorGuard) {
                  window.ErrorGuard.skipGuardGlobal(false);
                }
                // Não propagar erro - retornar null se módulo não estiver pronto
                const isInternalModule =
                  moduleId.startsWith('__') ||
                  moduleId.startsWith('__require') ||
                  moduleId.startsWith('__call__') ||
                  moduleId.startsWith('__requireModule__') ||
                  moduleId.startsWith('__requireWeak__') ||
                  moduleId.startsWith('__isRequired__');

                if (
                  !this.suppressModuleWarnings &&
                  !isInternalModule &&
                  !this.warnedModules.has(moduleId)
                ) {
                  this.warnedModules.add(moduleId);
                  console.warn(`Mettri: Module ${moduleId} not ready:`, error);
                }
                return null;
              }
            };
          }
        }
      } catch (error) {
        // Log removido temporariamente - foco em detecção de conta
        // Não falhar a inicialização inteira: o modo "WA-Sync" via require()
        // ainda pode expor módulos úteis (WAWebCollections etc.).
      }
    } else if (window.webpackChunkwhatsapp_web_client) {
      // Sistema Webpack (padrão reverse.txt linhas 228-241)
      this.webpackChunk = window.webpackChunkwhatsapp_web_client;

      const randomId = Math.random().toString(36).substring(7);

      this.modules = {};
      this.webpackChunk.push([
        [randomId],
        {},
        (moduleFactory: any) => {
          // moduleFactory.m contém o mapa de módulos (padrão reverse.txt linha 235)
          for (const id in moduleFactory.m) {
            this.modules[id] = () => moduleFactory(id);
          }
        },
      ]);

      // #region agent log
      // Usando Webpack bundler
      // #endregion
    } else {
      throw new Error('Cannot find bundler');
    }

    // Padrão do reverse.txt (linhas 278-284): definir getters lazy
    Object.entries(this.modules).forEach(([id, getModule]) => {
      Object.defineProperty(this.modulesCache, id, {
        get: getModule,
        enumerable: true,
        configurable: false,
      });
    });

    // Padrão do reverse.txt (linhas 286-308): adicionar métodos ao prototype
    // Criar objeto com métodos antes de definir prototype
    const self = this;
    const prototypeMethods = {
      some: function (predicate: (module: any) => boolean) {
        return !!self.find(predicate);
      },
      find: function (predicate: (module: any) => boolean) {
        return self.find(predicate);
      },
      filter: function (predicate: (module: any) => boolean) {
        return self.filter(predicate);
      },
      someExport: function (exportName: string) {
        return !!self.findExport(exportName);
      },
      findExport: function (exportName: string) {
        return self.findExport(exportName);
      },
      filterExport: function (exportName: string) {
        return self.filterExport(exportName);
      },
      getModules: function () {
        return self.modules;
      },
    };

    Object.setPrototypeOf(this.modulesCache, prototypeMethods);

    // Suprimir avisos durante inicialização de N (que faz muitas buscas)
    this.suppressModuleWarnings = true;
    this.initialized = true;
    // Log removido temporariamente - foco em detecção de conta

    // Inicializar N após tudo estar pronto (padrão reverse.txt linha 309)
    this.initializeN();
    
    // Reativar avisos após inicialização (mas só para novos módulos)
    this.suppressModuleWarnings = false;

    // Expor módulos diretamente em window.Mettri (padrão WA-Sync simplificado)
    this.exposeToWindow();
  }

  /**
   * Expõe todos os módulos diretamente em window.Mettri para acesso direto
   * Sistema em 2 fases:
   * - Fase 1: Crítico (aguarda WID, carrega User/Conn, cria banco)
   * - Fase 2: Tudo o resto (estilo WA-Sync usando window.require())
   */
  private exposeToWindow(): void {
    if (typeof window === 'undefined') return;

    // Criar objeto base
    const Mettri: any = {
      isWebpackAvailable: () => this.isWebpackAvailable(),
      initialize: () => this.initialize(),
      __ready: false,
    };

    // Expor objeto vazio primeiro
    (window as any).Mettri = Mettri;

    // Fase 1: Crítico (aguarda WID e carrega módulos essenciais)
    this.exposeCriticalModules(Mettri).then(() => {
      // Fase 2: Tudo o resto (estilo WA-Sync)
      this.exposeAllModules(Mettri);
      Mettri.__ready = true;
    }).catch((error) => {
      console.error('[Mettri] Erro na Fase 1 (crítica):', error);
      // Continuar com Fase 2 mesmo se Fase 1 falhar
      this.exposeAllModules(Mettri);
      Mettri.__ready = true;
    });
  }

  /**
   * Fase 1: Expõe módulos críticos (User, Conn) e inicializa banco de dados
   * Aguarda WID do usuário estar disponível antes de continuar
   */
  private async exposeCriticalModules(Mettri: any): Promise<void> {
    console.log('[Mettri] Tentando detectar conta...');
    
    const require = (window as any).require;
    if (!require || typeof require !== 'function') {
      console.log('[Mettri] window.require não disponível ainda, aguardando...');
      // Aguardar um pouco e tentar novamente
      await new Promise(resolve => setTimeout(resolve, 1000));
      const requireRetry = (window as any).require;
      if (!requireRetry || typeof requireRetry !== 'function') {
        console.warn('[Mettri] window.require ainda não disponível após espera');
        // Tentar detectar WID usando window.Mettri.User se já estiver disponível
        const userWid = await this.waitForUserWid();
        if (userWid) {
          const { messageDB } = await import('../storage/message-db');
          await messageDB.setUserWid(userWid);
          console.log('[Mettri] Banco inicializado com WID:', userWid);
        } else {
          console.warn('[Mettri] Banco não inicializado - conta não detectada');
        }
        return;
      }
      // Se window.require ficou disponível, continuar com o fluxo normal abaixo
    }

    try {
      console.log('[Mettri] Tentando detectar conta...');
      
      // Carregar módulos críticos via window.require() (rápido)
      const userPrefs = require('WAWebUserPrefsMeUser');
      if (userPrefs) {
        Mettri.User = userPrefs;
      }

      const connModel = require('WAWebConnModel');
      if (connModel?.Conn) {
        Mettri.Conn = connModel.Conn;
      }

      // Aguardar WID estar disponível (polling com timeout)
      const userWid = await this.waitForUserWid();
      if (userWid) {
        // Inicializar banco de dados com WID
        const { messageDB } = await import('../storage/message-db');
        await messageDB.setUserWid(userWid);
        console.log('[Mettri] Banco inicializado com WID:', userWid);
      } else {
        console.warn('[Mettri] Banco não inicializado - conta não detectada');
      }
    } catch (error: any) {
      console.error('[Mettri] Erro ao detectar conta:', error.message);
      // Fallback para getters
      Mettri.User = this.User;
      Mettri.Conn = this.Conn;
    }
  }

  /**
   * Aguarda WID do usuário estar disponível (polling)
   * Usa os mesmos métodos que test-panel.ts: getMaybeMePnUser() e getMaybeMeLidUser()
   */
  private async waitForUserWid(maxAttempts: number = 20, delayMs: number = 500): Promise<string | null> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        // Tentar via window.Mettri.User (já carregado na Fase 1)
        const User = (window as any).Mettri?.User;
        let userData: any = null;

        if (User) {
          // Estratégia 1: getMaybeMePnUser() (prioridade - como test-panel.ts linha 3114)
          if (typeof User.getMaybeMePnUser === 'function') {
            try {
              userData = User.getMaybeMePnUser();
              if (userData) {
                console.log('[Mettri] Conta detectada via getMaybeMePnUser()');
              }
            } catch {}
          }

          // Estratégia 2: getMaybeMeLidUser() (fallback - como test-panel.ts linha 3117)
          if (!userData && typeof User.getMaybeMeLidUser === 'function') {
            try {
              userData = User.getMaybeMeLidUser();
              if (userData) {
                console.log('[Mettri] Conta detectada via getMaybeMeLidUser()');
              }
            } catch {}
          }

          // Estratégia 3: User() como função direta
          if (!userData && typeof User === 'function') {
            try {
              userData = User();
            } catch {}
          }

          // Extrair WID de userData (formato id._serialized - mais comum)
          if (userData && typeof userData === 'object') {
            let wid: string | null = null;
            
            if (userData.id?._serialized) {
              wid = userData.id._serialized;
            } else if (userData._serialized) {
              wid = userData._serialized;
            } else if (userData.id && typeof userData.id === 'string') {
              wid = userData.id;
            } else if (userData.wid) {
              wid = userData.wid;
            } else if (userData.user && typeof userData.user === 'string') {
              wid = `${userData.user}@${userData.server || 'c.us'}`;
            }

            if (wid) {
              console.log('[Mettri] Conta detectada:', wid);
              return wid;
            }
          }
        }

        // Tentar também via window.Store (se WA-Sync já inicializou)
        const Store = (window as any).Store;
        if (Store?.User) {
          if (typeof Store.User.getMaybeMePnUser === 'function') {
            try {
              userData = Store.User.getMaybeMePnUser();
              if (userData?.id?._serialized) {
                console.log('[Mettri] Conta detectada via Store.User.getMaybeMePnUser()');
                return userData.id._serialized;
              }
            } catch {}
          }
          if (!userData && typeof Store.User.getMaybeMeLidUser === 'function') {
            try {
              userData = Store.User.getMaybeMeLidUser();
              if (userData?.id?._serialized) {
                console.log('[Mettri] Conta detectada via Store.User.getMaybeMeLidUser()');
                return userData.id._serialized;
              }
            } catch {}
          }
        }
      } catch (error: any) {
        // Silenciar erros durante polling
      }

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    console.warn(`[Mettri] Conta não detectada após ${maxAttempts} tentativas`);
    return null;
  }

  /**
   * Fase 2: Expõe todos os módulos restantes usando window.require() diretamente
   * Padrão EXATO do WA-Sync
   */
  private exposeAllModules(Mettri: any): void {
    const require = (window as any).require;
    if (!require || typeof require !== 'function') {
      // Log removido temporariamente - foco em detecção de conta
      this.exposeAllModulesFallback(Mettri);
      return;
    }

    try {
      // Base: WAWebCollections (como WA-Sync faz)
      const waWebCollections = require('WAWebCollections');
      Object.assign(Mettri, waWebCollections || {});

      // Módulos específicos (padrão WA-Sync - try/catch individual)
      try {
        const msgKey = require('WAWebMsgKey');
        if (msgKey) Mettri.MsgKey = msgKey;
      } catch {}

      try {
        const sendDelete = require('WAWebDeleteChatAction');
        if (sendDelete) Mettri.SendDelete = sendDelete;
      } catch {}

      try {
        const sendMsg = require('WAWebSendMsgChatAction');
        if (sendMsg) {
          const addAndSend =
            sendMsg.addAndSendMsgToChat ||
            sendMsg.default?.addAndSendMsgToChat;
          if (addAndSend) {
            Mettri.addAndSendMsgToChat = addAndSend;
          }

          // Alguns builds expõem a função em `default`
          const sendText =
            sendMsg.sendTextMsgToChat ||
            sendMsg.default?.sendTextMsgToChat;
          if (sendText) {
            Mettri.sendTextMsgToChat = sendText;
          } else {
            // Fallback: manter disponível via getter de busca (para o painel de testes)
            // Sem sobre-engenharia: só apontar para o resolver existente.
            Mettri.sendTextMsgToChat = this.sendTextMsgToChat;
          }
        }
      } catch {}

      try {
        const ephemeralFields = require('WAWebGetEphemeralFieldsMsgActionsUtils');
        if (ephemeralFields) Mettri.getEphemeralFields = ephemeralFields;
      } catch {}

      try {
        const msgActionChecks = require('WAWebMsgActionCapability');
        if (msgActionChecks?.canReplyMsg) Mettri.canReplyMsg = msgActionChecks.canReplyMsg;
      } catch {}

      try {
        const cmd = require('WAWebCmd');
        if (cmd?.Cmd) Mettri.Cmd = cmd.Cmd;
      } catch {}

      try {
        const chatState = require('WAWebChatStateBridge');
        if (chatState) Mettri.ChatState = chatState;
      } catch {}

      try {
        const presence = require('WAWebPresenceChatAction');
        if (presence) Mettri.Presence = presence;
      } catch {}

      try {
        const groupCreate = require('WAWebGroupCreateJob');
        if (groupCreate?.createGroup) Mettri.createGroup = groupCreate.createGroup;
      } catch {}

      try {
        const groupParticipants = require('WAWebModifyParticipantsGroupAction');
        if (groupParticipants?.getParticipants) Mettri.getParticipants = groupParticipants.getParticipants;
      } catch {}

      try {
        const blockContact = require('WAWebBlockContactAction');
        if (blockContact) Mettri.blockContact = blockContact;
      } catch {}

      try {
        const vcardUtils = require('WAWebFrontendVcardUtils');
        const vcardParsing = require('WAWebVcardParsingUtils');
        const vcardGetName = require('WAWebVcardGetNameFromParsed');
        if (vcardUtils || vcardParsing || vcardGetName) {
          Mettri.VCard = {
            ...(vcardUtils || {}),
            ...(vcardParsing || {}),
            ...(vcardGetName || {})
          };
        }
      } catch {}

      try {
        const queryExist = require('WAWebQueryExistsJob');
        if (queryExist?.queryWidExists) Mettri.QueryExist = queryExist.queryWidExists;
      } catch {}

      try {
        const mediaPrep = require('WAWebPrepRawMedia');
        if (mediaPrep) Mettri.MediaPrep = mediaPrep;
      } catch {}

      try {
        const mediaObject = require('WAWebMediaStorage');
        if (mediaObject) Mettri.MediaObject = mediaObject;
      } catch {}

      try {
        const mediaTypes = require('WAWebMmsMediaTypes');
        if (mediaTypes) Mettri.MediaTypes = mediaTypes;
      } catch {}

      try {
        const mediaCollection = require('WAWebMediaCollection');
        if (mediaCollection?.MediaCollection) Mettri.MediaCollection = mediaCollection.MediaCollection;
      } catch {}

      try {
        const uploadUtils = require('WAWebUploadManager');
        if (uploadUtils) Mettri.UploadUtils = uploadUtils;
      } catch {}

      try {
        const downloadManager = require('WAWebDownloadManager');
        if (downloadManager?.downloadManager) Mettri.DownloadManager = downloadManager.downloadManager;
      } catch {}

      try {
        const opaqueData = require('WAWebMediaOpaqueData');
        if (opaqueData) Mettri.OpaqueData = opaqueData;
      } catch {}

      try {
        const userConstructor = require('WAWebWid');
        if (userConstructor) Mettri.UserConstructor = userConstructor;
      } catch {}

      try {
        const widFactory = require('WAWebWidFactory');
        if (widFactory) Mettri.WidFactory = widFactory;
      } catch {}

      try {
        const linkPreview = require('WAWebLinkPreviewChatAction');
        if (linkPreview?.genMinimalLinkPreview) Mettri.genMinimalLinkPreview = linkPreview.genMinimalLinkPreview;
      } catch {}

      try {
        const linkify = require('WALinkify');
        if (linkify?.findFirstWebLink) Mettri.findFirstWebLink = linkify.findFirstWebLink;
      } catch {}

      try {
        const searchContext = require('WAWebChatMessageSearch');
        if (searchContext) Mettri.getSearchContext = searchContext;
      } catch {}

      try {
        const sendReaction = require('WAWebSendReactionMsgAction');
        if (sendReaction?.sendReactionToMsg) Mettri.sendReactionToMsg = sendReaction.sendReactionToMsg;
      } catch {}

      try {
        const statusUtils = require('WAWebContactStatusBridge');
        if (statusUtils) Mettri.StatusUtils = statusUtils;
      } catch {}

      try {
        const conversationMsgs = require('WAWebChatLoadMessages');
        if (conversationMsgs) Mettri.ConversationMsgs = conversationMsgs;
      } catch {}

      try {
        const groupMetadata = require('WAWebGroupMetadata');
        if (groupMetadata?.GroupMetadata) Mettri.GroupMetadata = groupMetadata.GroupMetadata;
        if (groupMetadata?.default) Mettri.N = groupMetadata.default;
      } catch {}

      // Log removido temporariamente - foco em detecção de conta
    } catch (error: any) {
      // Log removido temporariamente - foco em detecção de conta
      this.exposeAllModulesFallback(Mettri);
    }
  }

  /**
   * Fallback: expõe módulos usando getters lazy (quando window.require não está disponível)
   */
  private exposeAllModulesFallback(Mettri: any): void {
    Object.defineProperty(Mettri, 'Msg', { get: () => this.Msg, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'Chat', { get: () => this.Chat, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'Contact', { get: () => this.Contact, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'Label', { get: () => this.Label, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'ChatCollection', { get: () => this.ChatCollection, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'PresenceCollection', { get: () => this.PresenceCollection, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'GroupMetadata', { get: () => this.GroupMetadata, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'ConversationMsgs', { get: () => this.ConversationMsgs, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'MsgKey', { get: () => this.MsgKey, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'SendDelete', { get: () => this.SendDelete, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'addAndSendMsgToChat', { get: () => this.addAndSendMsgToChat, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'sendTextMsgToChat', { get: () => this.sendTextMsgToChat, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'getEphemeralFields', { get: () => this.getEphemeralFields, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'canReplyMsg', { get: () => this.canReplyMsg, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'Cmd', { get: () => this.Cmd, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'ChatState', { get: () => this.ChatState, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'Presence', { get: () => this.Presence, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'createGroup', { get: () => this.createGroup, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'getParticipants', { get: () => this.getParticipants, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'blockContact', { get: () => this.blockContact, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'VCard', { get: () => this.VCard, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'QueryExist', { get: () => this.QueryExist, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'uploadMedia', { get: () => this.uploadMedia, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'MediaPrep', { get: () => this.MediaPrep, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'MediaObject', { get: () => this.MediaObject, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'MediaTypes', { get: () => this.MediaTypes, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'MediaCollection', { get: () => this.MediaCollection, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'UploadUtils', { get: () => this.UploadUtils, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'DownloadManager', { get: () => this.DownloadManager, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'OpaqueData', { get: () => this.OpaqueData, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'UserConstructor', { get: () => this.UserConstructor, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'USyncQuery', { get: () => this.USyncQuery, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'USyncUser', { get: () => this.USyncUser, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'WidFactory', { get: () => this.WidFactory, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'genMinimalLinkPreview', { get: () => this.genMinimalLinkPreview, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'findFirstWebLink', { get: () => this.findFirstWebLink, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'getSearchContext', { get: () => this.getSearchContext, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'sendReactionToMsg', { get: () => this.sendReactionToMsg, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'colorIndexToHex', { get: () => this.colorIndexToHex, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'StatusUtils', { get: () => this.StatusUtils, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'Composing', { get: () => this.Composing, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'ConversationSeen', { get: () => this.ConversationSeen, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'Playing', { get: () => this.Playing, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'StatusState', { get: () => this.StatusState, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'Classes', { get: () => this.Classes, enumerable: true, configurable: true });
    Object.defineProperty(Mettri, 'N', { get: () => this.N, enumerable: true, configurable: true });

    // Log removido temporariamente - foco em detecção de conta
  }

  /**
   * Investiga uma coleção em detalhes para entender sua estrutura completa
   */
  private investigateCollection(collection: any, name: string): void {
    // Investigação: ${name}

    // Listar métodos
    const methods: string[] = [];
    const props: string[] = [];

    // Verificar métodos comuns de coleções
    const commonMethods = ['on', 'off', 'get', 'set', 'find', 'filter', 'add', 'remove', 'forEach', 'map', 'has', 'keys', 'values'];
    commonMethods.forEach(method => {
      if (typeof collection[method] === 'function') {
        methods.push(method);
      }
    });

    // Verificar propriedades
    const commonProps = ['_models', '_find', 'length', 'models', 'collection', '_collection'];
    commonProps.forEach(prop => {
      if (prop in collection) {
        props.push(prop);
        if (prop === '_models' && Array.isArray(collection._models)) {
          // ${name}._models tem ${collection._models.length} itens
          if (collection._models.length > 0) {
            // ${name}._models[0] exemplo disponível
          }
        }
      }
    });

    // ${name} tem ${methods.length} métodos e ${props.length} propriedades

    // Testar métodos importantes
    if (methods.includes('get')) {
      // ${name}.get() disponível
    }
    if (methods.includes('find')) {
      // ${name}.find() disponível
    }
    if (methods.includes('on')) {
      // ${name}.on() disponível - pode escutar eventos
    }

    safeLog(collection, `${name} (investigação completa)`);
  }

  /**
   * Inicializa objeto N seguindo EXATAMENTE padrão reverse.txt linha 309
   * N = Object.assign({}, Ct.findExport("GroupMetadata")?.default)
   * 
   * Isso copia todas as propriedades de GroupMetadata.default para N,
   * incluindo Msg, Chat, Contact, Label, etc.
   */
  private initializeN(): void {
    // Padrão EXATO reverse.txt linha 309
    // Ct.findExport("GroupMetadata")?.default
    // IMPORTANTE: Usar ErrorGuard para não interferir com inicialização do WhatsApp
    let groupMetadataModule: any;
    
    try {
      if (window.ErrorGuard) {
        window.ErrorGuard.skipGuardGlobal(true);
      }
      groupMetadataModule = this.findExport('GroupMetadata');
    } catch (error) {
      // Se GroupMetadata não estiver pronto ainda, tentar novamente depois
      // Log removido temporariamente - foco em detecção de conta
      if (window.ErrorGuard) {
        window.ErrorGuard.skipGuardGlobal(false);
      }
      // Retornar sem inicializar N - será tentado novamente quando necessário
      return;
    } finally {
      if (window.ErrorGuard) {
        window.ErrorGuard.skipGuardGlobal(false);
      }
    }

    if (groupMetadataModule) {
      // Verificar se tem .default
      if (groupMetadataModule.default) {
        // Padrão exato: Object.assign({}, Ct.findExport("GroupMetadata")?.default)
        this.N = Object.assign({}, groupMetadataModule.default);
        // Objeto N inicializado (cópia de GroupMetadata.default)
      } else {
        // GroupMetadata não tem .default - verificar se tem propriedades diretamente
        // GroupMetadata não tem .default, verificando propriedades diretamente

        // Verificar se tem Msg, Chat, Contact diretamente
        const hasMsg = !!groupMetadataModule.Msg;
        const hasChat = !!groupMetadataModule.Chat;
        const hasContact = !!groupMetadataModule.Contact;

        // GroupMetadata tem propriedades diretamente

        // Se tem propriedades diretamente, pode ser que GroupMetadata JÁ É o objeto que queremos
        if (hasMsg || hasChat || hasContact) {
          this.N = Object.assign({}, groupMetadataModule);
          // N inicializado de GroupMetadata diretamente (sem .default)
        } else {
          // Tentar usar GroupMetadata como N mesmo assim (pode ter outras propriedades)
          this.N = Object.assign({}, groupMetadataModule);
          // N inicializado de GroupMetadata (sem propriedades conhecidas)
        }
      }

      // Logar estrutura de N
      if (this.N) {
        // Estrutura de N inicializada

        // Verificar propriedades principais
        ['Msg', 'Chat', 'Contact', 'Label'].forEach(prop => {
          if (this.N[prop]) {
            // N.${prop} encontrado
            safeLog(this.N[prop], `N.${prop}`);

            // Verificar se tem métodos de coleção
            if (typeof this.N[prop].on === 'function') {
              // N.${prop} tem método .on()
            }
            if (typeof this.N[prop].get === 'function') {
              // N.${prop} tem método .get()
            }
          }
        });
      }
    } else {
      // GroupMetadata não encontrado - N não pode ser inicializado
    }
  }

  /**
   * Busca o primeiro módulo que satisfaz o predicado.
   * Padrão do reverse.txt (linhas 243-255).
   */
  find(predicate: (module: any) => boolean): any {
    if (!this.initialized) {
      // Log removido temporariamente - foco em detecção de conta
      return null;
    }

    if (typeof predicate !== 'function') {
      throw new Error('Missing predicate function');
    }

    for (const id in this.modulesCache) {
      try {
        const module = this.modulesCache[id];
        if (predicate(module)) {
          return module;
        }
      } catch {
        // Ignorar erros e continuar (padrão reverse.txt linha 252)
        continue;
      }
    }
    return null;
  }

  /**
   * Filtra todos os módulos que satisfazem o predicado.
   * Padrão do reverse.txt (linhas 256-268).
   */
  filter(predicate: (module: any) => boolean): any[] {
    if (!this.initialized) {
      // Log removido temporariamente - foco em detecção de conta
      return [];
    }

    if (typeof predicate !== 'function') {
      throw new Error('Missing predicate function');
    }

    const results: any[] = [];
    for (const id in this.modulesCache) {
      try {
        const module = this.modulesCache[id];
        if (predicate(module)) {
          results.push(module);
        }
      } catch {
        // Ignorar erros e continuar (padrão reverse.txt linha 264)
        continue;
      }
    }
    return results;
  }

  /**
   * Busca um módulo por nome de export.
   * Padrão do reverse.txt (linhas 269-277).
   */
  findExport(exportName: string): any {
    if (!this.initialized) {
      // Log removido temporariamente - foco em detecção de conta
      return null;
    }

    if (typeof exportName !== 'string') {
      throw new Error('Missing predicate export key');
    }

    return this.find((module: any) => {
      const keys = [
        ...Object.keys(module?.default || {}),
        ...Object.keys(module || {}),
      ];
      return keys.includes(exportName);
    });
  }

  /**
   * Filtra módulos por nome de export.
   * Padrão do reverse.txt (linhas 296-304).
   */
  filterExport(exportName: string): any[] {
    if (typeof exportName !== 'string') {
      throw new Error('Missing predicate export key');
    }

    return this.filter((module: any) => {
      const keys = [
        ...Object.keys(module?.default || {}),
        ...Object.keys(module || {}),
      ];
      return keys.includes(exportName);
    });
  }

  /**
   * Getter para o módulo Msg (modelo de mensagem).
   * No WhatsApp, Msg é uma coleção/modelo que tem método .on() para eventos.
   * 
   * Baseado no reverse.txt linha 309: N = Object.assign({}, Ct.findExport("GroupMetadata")?.default)
   * Então N.Msg vem de GroupMetadata.default.Msg, que deve ser uma coleção com .on() e .get()
   */
  get Msg(): any {
    // Tentar 1: Usar N.Msg (padrão reverse.txt linha 309)
    // N é cópia de GroupMetadata.default, então N.Msg já está disponível
    if (this.N?.Msg) {
      const msg = this.N.Msg;
      // Verificar se é coleção válida
      if (typeof msg.on === 'function' && typeof msg.get === 'function') {
        StrategyMonitor.record('Msg', 1, true);
        safeLog(msg, 'Msg getter result (N.Msg)');
        return msg;
      } else {
        // N.Msg encontrado mas não tem .on() e .get()
        safeLog(msg, 'N.Msg (estrutura inesperada)');
      }
    }

    // Tentar 2: Acessar GroupMetadata.default.Msg ou GroupMetadata.Msg diretamente (fallback)
    const groupMetadata = this.findExport('GroupMetadata');
    if (groupMetadata?.default?.Msg) {
      const msg = groupMetadata.default.Msg;
      if (typeof msg.on === 'function' && typeof msg.get === 'function') {
        StrategyMonitor.record('Msg', 2, true);
        safeLog(msg, 'Msg getter result (GroupMetadata.default.Msg)');
        return msg;
      }
    }
    if (groupMetadata?.Msg) {
      const msg = groupMetadata.Msg;
      if (typeof msg.on === 'function' && typeof msg.get === 'function') {
        StrategyMonitor.record('Msg', 2, true);
        safeLog(msg, 'Msg getter result (GroupMetadata.Msg)');
        return msg;
      }
    }

    // Tentar 3: Buscar por export "Msg"
    const msgExport = this.findExport('Msg');
    if (msgExport) {
      const msgObj = msgExport?.default || msgExport;
      if (typeof msgObj === 'function' && typeof msgObj.on === 'function') {
        StrategyMonitor.record('Msg', 3, true);
        safeLog(msgObj, 'Msg getter result (findExport Msg)');
        return msgObj;
      }
      if (msgObj?.Msg && typeof msgObj.Msg.on === 'function') {
        StrategyMonitor.record('Msg', 3, true);
        safeLog(msgObj.Msg, 'Msg getter result (findExport Msg.Msg)');
        return msgObj.Msg;
      }
    }

    // Tentar 4: Buscar coleção genérica com características de mensagem
    const msgCollection = this.find((m: any) => {
      const obj = m?.default || m;
      const hasOn = typeof obj?.on === 'function';
      const hasGet = typeof obj?.get === 'function';

      if (!hasOn || !hasGet) return false;

      // Verificar características específicas de coleção de mensagens
      const hasModels = Array.isArray(obj?._models);
      const hasFind = typeof obj?.find === 'function';
      const hasFilter = typeof obj?.filter === 'function';

      // Se tem _models, é muito provável que seja coleção de mensagens
      if (hasModels) {
        return true;
      }

      // Se tem find/filter, também pode ser
      return hasFind || hasFilter;
    });

    if (msgCollection) {
      StrategyMonitor.record('Msg', 4, true);
      this.investigateCollection(msgCollection, 'Msg (coleção genérica)');
      safeLog(msgCollection, 'Msg getter result (busca genérica)');
      return msgCollection;
    }

    // Nenhuma estratégia funcionou
    StrategyMonitor.record('Msg', 0, false);
    // Msg getter: Nenhum módulo Msg encontrado
    return null;
  }

  /**
   * Getter para o módulo Chat (coleção de chats).
   * Baseado no reverse.txt linha 309: N.Chat vem de GroupMetadata.default.Chat
   * PRIORIDADE: Buscar também por getModelsArray() (padrão WA-Sync)
   */
  get Chat(): any {
    // Tentar 0: window.Store.Chat (padrão WA-Sync) - acesso direto se disponível
    // WA-Sync usa: window.Store = Object.assign({}, window.require("WAWebCollections"))
    // Então window.Store.Chat vem de WAWebCollections
    if (typeof window !== 'undefined') {
      // Verificar window.Store.Chat (se WA-Sync já inicializou)
      if ((window as any).Store?.Chat) {
        const storeChat = (window as any).Store.Chat;
        if (typeof storeChat.on === 'function' && typeof storeChat.get === 'function') {
          StrategyMonitor.record('Chat', 0, true);
          // Log removido temporariamente - foco em detecção de conta
          return storeChat;
        }
      }

      // Tentar acessar WAWebCollections diretamente (como WA-Sync faz)
      // IMPORTANTE: Usar ErrorGuard para não interferir com inicialização do WhatsApp
      try {
        const require = (window as any).require;
        if (require && typeof require === 'function') {
          // Usar ErrorGuard para evitar erros durante inicialização
          if (window.ErrorGuard) {
            window.ErrorGuard.skipGuardGlobal(true);
          }
          
          try {
            const waWebCollections = require('WAWebCollections');
            if (waWebCollections?.Chat) {
              const chat = waWebCollections.Chat;
              if (typeof chat.on === 'function' && typeof chat.get === 'function') {
                StrategyMonitor.record('Chat', 0, true);
                // Log removido temporariamente - foco em detecção de conta
                if (window.ErrorGuard) {
                  window.ErrorGuard.skipGuardGlobal(false);
                }
                return chat;
              }
            }
          } catch (innerError) {
            // Módulo ainda não está pronto - ignorar silenciosamente
            // Não logar para não poluir o console durante inicialização
          } finally {
            if (window.ErrorGuard) {
              window.ErrorGuard.skipGuardGlobal(false);
            }
          }
        }
      } catch (error) {
        // Ignorar erros ao tentar acessar require - WhatsApp ainda não está pronto
      }
    }

    // Tentar 1: Usar N.Chat (padrão reverse.txt linha 309)
    if (this.N?.Chat) {
      const chat = this.N.Chat;
      if (typeof chat.on === 'function' && typeof chat.get === 'function') {
        StrategyMonitor.record('Chat', 1, true);
        safeLog(chat, 'Chat getter result (N.Chat)');
        return chat;
      }
    }

    // Tentar 2: GroupMetadata.default.Chat ou GroupMetadata.Chat
    const groupMetadata = this.findExport('GroupMetadata');
    if (groupMetadata?.default?.Chat) {
      const chat = groupMetadata.default.Chat;
      if (typeof chat.on === 'function' && typeof chat.get === 'function') {
        StrategyMonitor.record('Chat', 2, true);
        safeLog(chat, 'Chat getter result (GroupMetadata.default.Chat)');
        return chat;
      }
    }
    if (groupMetadata?.Chat) {
      const chat = groupMetadata.Chat;
      if (typeof chat.on === 'function' && typeof chat.get === 'function') {
        StrategyMonitor.record('Chat', 2, true);
        safeLog(chat, 'Chat getter result (GroupMetadata.Chat)');
        return chat;
      }
    }

    // Tentar 3: Buscar por export "Chat"
    const chatExport = this.findExport('Chat');
    if (chatExport) {
      StrategyMonitor.record('Chat', 3, true);
      safeLog(chatExport, 'Chat getter result (findExport Chat)');
      return chatExport;
    }

    // Tentar 4: Buscar por características (tem .on(), .get(), e .getActive() ou .find() OU getModelsArray())
    const chatCollection = this.find((m: any) => {
      const obj = m?.default || m;
      const hasOn = typeof obj?.on === 'function';
      const hasGet = typeof obj?.get === 'function';
      const hasGetActive = typeof obj?.getActive === 'function';
      const hasFind = typeof obj?.find === 'function';
      const hasGetModelsArray = typeof obj?.getModelsArray === 'function';

      return hasOn && hasGet && (hasGetActive || hasFind || hasGetModelsArray);
    });

    if (chatCollection) {
      safeLog(chatCollection, 'Chat getter result (busca por características incluindo getModelsArray)');
      return chatCollection;
    }

    return null;
  }

  /**
   * Getter para o módulo ChatCollection (coleção de chats).
   */
  get ChatCollection(): any {
    return this.findExport('ChatCollection');
  }

  /**
   * Getter para Chat.getModelsArray() - retorna lista de chats já ordenada (padrão WA-Sync).
   */
  get ChatGetModelsArray(): (() => any[]) | null {
    const Chat = this.Chat;
    if (Chat && typeof Chat.getModelsArray === 'function') {
      return Chat.getModelsArray.bind(Chat);
    }
    return null;
  }

  /**
   * Getter para o módulo User (usuário atual).
   */
  get User(): any {
    // Estratégia 1: getMaybeMePnUser
    const user1 = this.findExport('getMaybeMePnUser');
    if (user1) {
      StrategyMonitor.record('User', 1, true);
      return user1;
    }

    // Estratégia 2: getMaybeMeLidUser
    const user2 = this.findExport('getMaybeMeLidUser');
    if (user2) {
      StrategyMonitor.record('User', 2, true);
      return user2;
    }

    StrategyMonitor.record('User', 0, false);
    return null;
  }

  /**
   * Getter para o módulo ConversationMsgs (mensagens de conversa).
   * Usado para loadEarlierMsgs() na raspagem histórica (padrão WA-Sync).
   */
  get ConversationMsgs(): any {
    return (
      this.findExport('ConversationMsgs') ||
      this.findExport('loadEarlierMsgs') ||
      this.find((m: any) => m?.default?.loadEarlierMsgs)?.default ||
      this.find((m: any) => m?.loadEarlierMsgs)
    );
  }

  /**
   * Getter para o módulo GroupMetadata (metadados de grupos).
   */
  get GroupMetadata(): any {
    return this.findExport('GroupMetadata');
  }

  /**
   * Getter para o módulo Presence (subscrever presença).
   * Padrão reverse.txt linha 330: N.Presence = Ct.findExport("sendPresenceAvailable")
   */
  get Presence(): any {
    return this.findExport('sendPresenceAvailable');
  }

  /**
   * Getter para o módulo PresenceCollection (status online/offline).
   * Padrão reverse.txt linha 342: N.PresenceCollection = Ct.findExport("PresenceCollection")?.PresenceCollection
   */
  get PresenceCollection(): any {
    const found = this.findExport('PresenceCollection');

    // Estratégia 1: found?.PresenceCollection
    if (found?.PresenceCollection) {
      StrategyMonitor.record('PresenceCollection', 1, true);
      return found.PresenceCollection;
    }

    // Estratégia 2: found diretamente
    if (found) {
      StrategyMonitor.record('PresenceCollection', 2, true);
      return found;
    }

    StrategyMonitor.record('PresenceCollection', 0, false);
    return null;
  }

  /**
   * Getter para o módulo Contact (contatos).
   * Usa N.Contact primeiro (padrão reverse.txt linha 309).
   */
  get Contact(): any {
    return this.N?.Contact || this.findExport('Contact');
  }

  /**
   * Getter para o módulo Label (etiquetas).
   * Usa N.Label primeiro (padrão reverse.txt linha 309).
   */
  get Label(): any {
    return this.N?.Label || this.findExport('Label');
  }

  /**
   * Getter para o módulo MsgKey (cria IDs de mensagem).
   * Busca por característica: tem método newId (padrão reverse.txt linha 312).
   */
  get MsgKey(): any {
    // Estratégia 1: Buscar por característica (tem método newId)
    const msgKey = this.find((m: any) =>
      m?.default && typeof m.default.newId === 'function'
    )?.default;

    if (msgKey) {
      StrategyMonitor.record('MsgKey', 1, true);
      return msgKey;
    }

    // Nenhuma estratégia funcionou
    StrategyMonitor.record('MsgKey', 0, false);
    return null;
  }

  /**
   * Getter para o módulo OpaqueData (manipula dados).
   * Busca por característica: tem método createFromData (padrão reverse.txt linha 313).
   */
  get OpaqueData(): any {
    return this.find((m: any) =>
      m?.default && typeof m.default.createFromData === 'function'
    )?.default;
  }

  /**
   * Getter para o módulo MediaPrep (prepara mídia).
   * Padrão reverse.txt linha 314.
   */
  get MediaPrep(): any {
    return this.findExport('prepRawMedia');
  }

  /**
   * Inspeciona um módulo e retorna metadados sobre ele.
   * Usado pelo módulo Sentinela para testes remotos.
   */
  inspectModule(moduleName: string): {
    status: string;
    methods: string[];
    properties: string[];
    error?: string;
    logs: string[]
  } {
    const logs: string[] = [];
    const log = (msg: string) => logs.push(`[REMOTE] ${msg}`);

    try {
      // Mapear nome para getter
      const module = (this as any)[moduleName];

      if (!module) {
        return { status: 'not-found', methods: [], properties: [], logs };
      }

      const methods: string[] = [];
      const properties: string[] = [];

      // Extrair métodos e propriedades (lógica similar ao ModuleTester antigo, mas rodando localmente)
      try {
        // Métodos
        const commonMethods = [
          'on', 'off', 'get', 'set', 'find', 'filter', 'add', 'remove',
          'forEach', 'map', 'has', 'keys', 'values', 'newId', 'createFromData',
          'prepRawMedia', 'getOrCreateMediaObject', 'sendTextMsgToChat',
          'addAndSendMsgToChat', 'createWid', 'canReplyMsg', 'getEphemeralFields',
          'vcardFromContactModel', 'blockContact', 'uploadMedia', 'downloadManager',
          'queryExist', 'USyncQuery', 'USyncUser', 'sendPresenceAvailable',
          'sendChatStateComposing', 'createGroup', 'getParticipants',
          'genMinimalLinkPreview', 'findFirstWebLink', 'getSearchContext',
          'sendReactionToMsg', 'colorIndexToHex', 'setMyStatus', 'markComposing',
          'sendConversationSeen', 'markPlayed', 'markStatusRead'
        ];

        commonMethods.forEach(method => {
          if (typeof module[method] === 'function') {
            methods.push(method);
          }
        });

        // Prototype methods
        if (module.prototype) {
          Object.getOwnPropertyNames(module.prototype).forEach(prop => {
            if (prop !== 'constructor' && typeof module.prototype[prop] === 'function') {
              methods.push(`${prop} (prototype)`);
            }
          });
        }

        // Properties
        const commonProps = ['_models', '_find', 'length', 'models', 'collection', '_collection', 'default'];
        commonProps.forEach(prop => {
          if (prop in module) properties.push(prop);
        });

        Object.keys(module).slice(0, 30).forEach(prop => {
          if (!properties.includes(prop) && typeof module[prop] !== 'function') {
            properties.push(prop);
          }
        });

      } catch (e) {
        log(`Erro na introspecção: ${e}`);
      }

      return {
        status: 'success',
        methods,
        properties,
        logs
      };

    } catch (error: any) {
      return {
        status: 'error',
        error: error.message,
        methods: [],
        properties: [],
        logs
      };
    }
  }

  /**
   * Getter para o módulo MediaObject (objetos de mídia).
   * Padrão reverse.txt linha 315.
   */
  get MediaObject(): any {
    return this.findExport('getOrCreateMediaObject');
  }

  /**
   * Getter para o módulo sendTextMsgToChat (envia mensagens de texto).
   * Padrão reverse.txt linha 335.
   * Estratégias múltiplas para encontrar a função.
   */
  get sendTextMsgToChat(): any {
    // Estratégia 1: findExport('sendTextMsgToChat')?.sendTextMsgToChat
    const result1 = this.findExport('sendTextMsgToChat')?.sendTextMsgToChat;
    if (result1 && typeof result1 === 'function') {
      StrategyMonitor.record('sendTextMsgToChat', 1, true);
      return result1;
    }

    // Estratégia 2: findExport('sendTextMsgToChat') diretamente
    const result2 = this.findExport('sendTextMsgToChat');
    if (result2 && typeof result2 === 'function') {
      StrategyMonitor.record('sendTextMsgToChat', 2, true);
      return result2;
    }

    // Estratégia 3: Buscar em módulos que exportam funções relacionadas
    const result3 = this.find((m: any) => {
      const obj = m?.default || m;
      return typeof obj === 'function' && 
             (obj.name === 'sendTextMsgToChat' || 
              (obj.toString && obj.toString().includes('sendTextMsgToChat')));
    });
    if (result3) {
      const func = result3.default || result3;
      if (typeof func === 'function') {
        StrategyMonitor.record('sendTextMsgToChat', 3, true);
        return func;
      }
    }

    StrategyMonitor.record('sendTextMsgToChat', 0, false);
    return null;
  }

  /**
   * Getter para o módulo addAndSendMsgToChat (adiciona e envia mensagem).
   * Padrão reverse.txt linha 311.
   */
  get addAndSendMsgToChat(): any {
    const result = this.findExport('addAndSendMsgToChat')?.addAndSendMsgToChat;
    if (result) {
      StrategyMonitor.record('addAndSendMsgToChat', 1, true);
      return result;
    }
    StrategyMonitor.record('addAndSendMsgToChat', 0, false);
    return null;
  }

  /**
   * Getter para o módulo WidFactory (cria WIDs).
   * Padrão reverse.txt linha 321.
   */
  get WidFactory(): any {
    return this.findExport('createWid');
  }

  /**
   * Getter para o módulo canReplyMsg (verifica se pode responder).
   * Padrão reverse.txt linha 333.
   */
  get canReplyMsg(): any {
    return this.findExport('canReplyMsg')?.canReplyMsg;
  }

  /**
   * Getter para o módulo getEphemeralFields (campos efêmeros).
   * Padrão reverse.txt linha 329.
   */
  get getEphemeralFields(): any {
    const result = this.findExport('getEphemeralFields')?.getEphemeralFields;
    if (result) {
      StrategyMonitor.record('getEphemeralFields', 1, true);
      return result;
    }
    StrategyMonitor.record('getEphemeralFields', 0, false);
    return null;
  }

  /**
   * Getter para o módulo VCard (cartões de contato).
   * Padrão reverse.txt linha 319.
   */
  get VCard(): any {
    return this.findExport('vcardFromContactModel');
  }

  /**
   * Getter para o módulo MediaCollection (coleção de mídia).
   * Busca por característica: tem prototype.processAttachments (padrão reverse.txt linha 334).
   */
  get MediaCollection(): any {
    return this.find((m: any) =>
      m?.default &&
      m.default.prototype &&
      typeof m.default.prototype.processAttachments !== 'undefined'
    )?.default;
  }

  /**
   * Getter para o módulo Cmd (comandos do WhatsApp).
   * Padrão reverse.txt linha 317: N.Cmd = Ct.findExport("Cmd")?.Cmd
   */
  get Cmd(): any {
    // Estratégia 1: findExport('Cmd')?.Cmd
    const cmd1 = this.findExport('Cmd')?.Cmd;
    if (cmd1) {
      StrategyMonitor.record('Cmd', 1, true);
      return cmd1;
    }

    // Estratégia 2: findExport('Cmd')
    const cmd2 = this.findExport('Cmd');
    if (cmd2) {
      StrategyMonitor.record('Cmd', 2, true);
      return cmd2;
    }

    StrategyMonitor.record('Cmd', 0, false);
    return null;
  }

  /**
   * Getter para o módulo Conn (conexão com servidores).
   * Padrão reverse.txt linha 317: N.Conn = Ct.findExport("Conn")?.Conn
   */
  get Conn(): any {
    return this.findExport('Conn')?.Conn || this.findExport('Conn');
  }

  /**
   * Getter para o módulo ChatState (estado do chat - digitando, gravando).
   * Padrão reverse.txt linha 331: N.ChatState = Ct.findExport("sendChatStateComposing")
   */
  get ChatState(): any {
    return this.findExport('sendChatStateComposing');
  }

  /**
   * Getter para o módulo createGroup (criar grupo).
   * Padrão reverse.txt linha 332: N.createGroup = Ct.findExport("createGroup")?.createGroup
   */
  get createGroup(): any {
    return this.findExport('createGroup')?.createGroup || this.findExport('createGroup');
  }

  /**
   * Getter para o módulo getParticipants (obter participantes de grupo).
   * Padrão reverse.txt linha 336: N.getParticipants = Ct.findExport("getParticipants")?.getParticipants
   */
  get getParticipants(): any {
    return this.findExport('getParticipants')?.getParticipants || this.findExport('getParticipants');
  }

  /**
   * Getter para o módulo QueryExist (verificar existência).
   * Padrão reverse.txt linha 144: N.QueryExist = Ct.findExport("queryExist")
   */
  get QueryExist(): any {
    return this.findExport('queryExist');
  }

  /**
   * Getter para o módulo blockContact (bloquear contato).
   * Padrão reverse.txt linha 140: N.blockContact = Ct.findExport("blockContact")?.blockContact
   */
  get blockContact(): any {
    return this.findExport('blockContact')?.blockContact || this.findExport('blockContact');
  }

  /**
   * Getter para o módulo SendDelete (enviar ou deletar mensagens).
   * Padrão reverse.txt linha 128: N.SendDelete = Ct.findExport("sendDelete")?.SendDelete
   */
  get SendDelete(): any {
    return this.findExport('sendDelete')?.SendDelete || this.findExport('sendDelete');
  }

  /**
   * Getter para o módulo uploadMedia (enviar mídia).
   * Padrão reverse.txt linha 134: N.uploadMedia = Ct.findExport("uploadMedia")?.uploadMedia
   */
  get uploadMedia(): any {
    return this.findExport('uploadMedia')?.uploadMedia || this.findExport('uploadMedia');
  }

  /**
   * Getter para o módulo MediaTypes (tipos de mídia).
   * Padrão reverse.txt linha 136: N.MediaTypes = Ct.findExport("msgToMediaType")
   */
  get MediaTypes(): any {
    return this.findExport('msgToMediaType');
  }

  /**
   * Getter para o módulo UploadUtils (utilitários de upload).
   * Padrão reverse.txt linha 141: N.UploadUtils = Ct.find(t => t.default && t.default.encryptAndUpload ? t.default : null)?.default
   */
  get UploadUtils(): any {
    return this.find((m: any) =>
      m?.default && typeof m.default.encryptAndUpload === 'function'
    )?.default;
  }

  /**
   * Getter para o módulo DownloadManager (gerenciador de download).
   * Padrão reverse.txt linha 142: N.DownloadManager = Ct.findExport("downloadManager")?.downloadManager
   */
  get DownloadManager(): any {
    return this.findExport('downloadManager')?.downloadManager || this.findExport('downloadManager');
  }

  /**
   * Getter para o módulo UserConstructor (construtor de usuário).
   * Padrão reverse.txt linha 138: N.UserConstructor = Ct.find(t => t.default && t.default.prototype && t.default.prototype.isServer && t.default.prototype.isUser ? t.default : null)?.default
   */
  get UserConstructor(): any {
    return this.find((m: any) =>
      m?.default &&
      m.default.prototype &&
      m.default.prototype.isServer &&
      m.default.prototype.isUser
    )?.default;
  }

  /**
   * Getter para o módulo USyncQuery (query de sincronização).
   * Padrão reverse.txt linha 145: N.USyncQuery = Ct.findExport("USyncQuery")?.USyncQuery
   */
  get USyncQuery(): any {
    return this.findExport('USyncQuery')?.USyncQuery || this.findExport('USyncQuery');
  }

  /**
   * Getter para o módulo USyncUser (sincronização de usuário).
   * Padrão reverse.txt linha 146: N.USyncUser = Ct.findExport("USyncUser")?.USyncUser
   */
  get USyncUser(): any {
    return this.findExport('USyncUser')?.USyncUser || this.findExport('USyncUser');
  }

  /**
   * Getter para o módulo genMinimalLinkPreview (gerar preview de link).
   * Padrão reverse.txt linha 155: N.genMinimalLinkPreview = Ct.findExport("genMinimalLinkPreview")?.genMinimalLinkPreview
   */
  get genMinimalLinkPreview(): any {
    return this.findExport('genMinimalLinkPreview')?.genMinimalLinkPreview || this.findExport('genMinimalLinkPreview');
  }

  /**
   * Getter para o módulo findFirstWebLink (encontrar primeiro link).
   * Padrão reverse.txt linha 156: N.findFirstWebLink = Ct.findExport("findFirstWebLink")?.findFirstWebLink
   */
  get findFirstWebLink(): any {
    return this.findExport('findFirstWebLink')?.findFirstWebLink || this.findExport('findFirstWebLink');
  }

  /**
   * Getter para o módulo getSearchContext (obter contexto de busca).
   * Padrão reverse.txt linha 157: N.getSearchContext = Ct.findExport("getSearchContext")?.getSearchContext
   */
  get getSearchContext(): any {
    return this.findExport('getSearchContext')?.getSearchContext || this.findExport('getSearchContext');
  }

  /**
   * Getter para o módulo sendReactionToMsg (enviar reação).
   * Padrão reverse.txt linha 158: N.sendReactionToMsg = Ct.findExport("sendReactionToMsg")?.sendReactionToMsg
   */
  get sendReactionToMsg(): any {
    return this.findExport('sendReactionToMsg')?.sendReactionToMsg || this.findExport('sendReactionToMsg');
  }

  /**
   * Getter para o módulo colorIndexToHex (cor para hexadecimal).
   * Padrão reverse.txt linha 159: N.colorIndexToHex = Ct.findExport("colorIndexToHex")?.colorIndexToHex
   */
  get colorIndexToHex(): any {
    return this.findExport('colorIndexToHex')?.colorIndexToHex || this.findExport('colorIndexToHex');
  }

  /**
   * Getter para o módulo StatusUtils (utilitários de status).
   * Padrão reverse.txt linha 162: N.StatusUtils = Ct.findExport("setMyStatus")
   */
  get StatusUtils(): any {
    return this.findExport('setMyStatus');
  }

  /**
   * Getter para o módulo Composing (digitando).
   * Padrão reverse.txt linha 163: N.Composing = Ct.findExport("markComposing")
   */
  get Composing(): any {
    return this.findExport('markComposing');
  }

  /**
   * Getter para o módulo ConversationSeen (conversa vista).
   * Padrão reverse.txt linha 164: N.ConversationSeen = Ct.findExport("sendConversationSeen")
   */
  get ConversationSeen(): any {
    return this.findExport('sendConversationSeen');
  }

  /**
   * Getter para o módulo Playing (tocando).
   * Padrão reverse.txt linha 165: N.Playing = Ct.findExport("markPlayed")
   */
  get Playing(): any {
    return this.findExport('markPlayed');
  }

  /**
   * Getter para o módulo StatusState (estado de status).
   * Padrão reverse.txt linha 348: N.StatusState = Ct.findExport("markStatusRead")
   */
  get StatusState(): any {
    return this.findExport('markStatusRead');
  }

  /**
   * Getter para o módulo Classes (classes CSS dinâmicas).
   * Padrão reverse.txt linha 349-367: N.Classes = Object.entries(Ct.getModules())?.filter...
   */
  get Classes(): any {
    // Classes são seletores CSS dinâmicos - retornar objeto vazio por enquanto
    // A implementação completa requer parsing dos módulos
    return {};
  }

  /**
   * Retorna todos os módulos disponíveis (para debug).
   * Segue padrão do reverse.txt.
   */
  getModules(): Record<string, () => any> {
    return { ...this.modules };
  }

  /**
   * Retorna cache de módulos carregados.
   */
  getModulesCache(): Record<string, any> {
    return { ...this.modulesCache };
  }

  /**
   * Método de debug: lista todos os módulos e suas propriedades principais
   * para identificar onde está Msg e outras coleções.
   */
  debugAllModules(): void {
    // Análise de todos os módulos

    const modulesWithOn: any[] = [];
    const modulesWithGet: any[] = [];
    const modulesWithBoth: any[] = [];

    for (const id in this.modulesCache) {
      try {
        const module = this.modulesCache[id];
        const obj = module?.default || module;

        const hasOn = typeof obj?.on === 'function';
        const hasGet = typeof obj?.get === 'function';

        if (hasOn) modulesWithOn.push({ id, module: obj });
        if (hasGet) modulesWithGet.push({ id, module: obj });
        if (hasOn && hasGet) {
          modulesWithBoth.push({ id, module: obj });
          safeLog(obj, `Module ${id} (tem .on() e .get())`);
        }
      } catch (e) {
        // Ignorar erros
      }
    }

    // Módulos encontrados: .on()=${modulesWithOn.length}, .get()=${modulesWithGet.length}, ambos=${modulesWithBoth.length}

    // Verificar GroupMetadata especificamente
    const groupMetadata = this.findExport('GroupMetadata');
    if (groupMetadata) {
      // GroupMetadata Analysis
      safeLog(groupMetadata, 'GroupMetadata completo');
      safeLog(groupMetadata?.default, 'GroupMetadata.default');

      // Verificar propriedades comuns
      const props = ['Chat', 'Msg', 'Contact', 'Label', 'Collection'];
      props.forEach(prop => {
        if (groupMetadata?.default?.[prop]) {
          // GroupMetadata.default.${prop} encontrado
          safeLog(groupMetadata.default[prop], `GroupMetadata.default.${prop}`);
        }
        if (groupMetadata?.[prop]) {
          // GroupMetadata.${prop} encontrado
          safeLog(groupMetadata[prop], `GroupMetadata.${prop}`);
        }
      });
    }
  }
}

export const whatsappInterceptors = new WhatsAppInterceptors();
