/**
 * WhatsAppInterceptors
 * 
 * Sistema que acessa módulos internos do WhatsApp Web via webpack chunk.
 * Segue EXATAMENTE o padrão do reverse.txt (linhas 228-308).
 */

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
    } catch {}
    
    // Tentar obter propriedades próprias
    try {
      info.ownPropertyNames = Object.getOwnPropertyNames(obj || {}).slice(0, 30);
    } catch {}
    
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
      } catch {}
    });
    
    console.log(`[DEBUG] ${label}:`, info);
    
    // Forma 2: Tentar JSON.stringify (pode falhar com objetos circulares)
    try {
      const json = JSON.stringify(obj, (key, value) => {
        if (typeof value === 'function') return '[Function]';
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      }, 2);
      if (json.length > 1000) {
        console.log(`[DEBUG] ${label} (JSON - primeiros 1000 chars):`, json.substring(0, 1000));
      } else {
        console.log(`[DEBUG] ${label} (JSON):`, json);
      }
    } catch (e: any) {
      console.log(`[DEBUG] ${label} (JSON failed):`, e.message);
    }
  } catch (error: any) {
    console.error(`[DEBUG] ${label} (log failed):`, error.message);
  }
}
export class WhatsAppInterceptors {
  private webpackChunk: any;
  private modules: Record<string, () => any> = {};
  private initialized = false;
  private modulesCache: Record<string, any> = {}; // Cache de módulos (equivalente ao Ct do reverse.txt)
  private N: any = null; // Objeto N (cópia de GroupMetadata.default) - padrão reverse.txt linha 309

  /**
   * Verifica se algum bundler (webpack ou comet) está disponível.
   * Segue padrão do reverse.txt (linhas 207-242).
   */
  isWebpackAvailable(): boolean {
    // Padrão reverse.txt linha 207: verificação simples (truthy), sem verificar tipo
    const cometAvailable = typeof window !== 'undefined' && window.require && window.__d;
    
    // #region agent log
    const webpackPropExists = typeof window !== 'undefined' && 'webpackChunkwhatsapp_web_client' in window;
    const webpackIsArray = webpackPropExists && Array.isArray(window.webpackChunkwhatsapp_web_client);
    const webpackLength = webpackIsArray ? window.webpackChunkwhatsapp_web_client.length : -1;
    const webpackAvailable = webpackIsArray && webpackLength > 0;
    
    const result = cometAvailable || webpackAvailable;
    
    console.log('[DEBUG] isWebpackAvailable:', {
      cometAvailable,
      webpackAvailable,
      webpackLength,
      result
    });
    fetch('http://127.0.0.1:7242/ingest/58de6e75-6d9e-4b0c-b575-37c34eed59d3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-interceptors.ts:22',message:'isWebpackAvailable check',data:{cometAvailable,webpackAvailable,webpackLength,result},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    // Padrão reverse.txt linha 207: verificar Comet primeiro, depois webpack
    if (cometAvailable) {
      return true; // Comet disponível
    }
    
    return (
      typeof window !== 'undefined' &&
      Array.isArray(window.webpackChunkwhatsapp_web_client) &&
      window.webpackChunkwhatsapp_web_client.length > 0
    );
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

    if (!this.isWebpackAvailable()) {
      throw new Error('Cannot find bundler');
    }

    // Padrão reverse.txt: verificar Comet primeiro (linhas 207-226)
    if (window.require && window.__d) {
      // Sistema Comet
      try {
        const debug = window.require('__debug');
        const modulesMap = debug?.modulesMap || {};
        const moduleKeys = Object.keys(modulesMap);
        
        // #region agent log
        console.log('[DEBUG] Using Comet bundler:', { moduleCount: moduleKeys.length });
        fetch('http://127.0.0.1:7242/ingest/58de6e75-6d9e-4b0c-b575-37c34eed59d3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-interceptors.ts:60',message:'Initializing Comet',data:{moduleCount:moduleKeys.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        // Criar módulos do Comet (padrão reverse.txt linhas 211-224)
        // Nota: reverse.txt usa importNamespace, mas vamos usar require diretamente
        for (const moduleId of moduleKeys) {
          this.modules[moduleId] = () => {
            try {
              // Padrão reverse.txt linha 214: usar ErrorGuard antes de acessar
              if (window.ErrorGuard) {
                window.ErrorGuard.skipGuardGlobal(true);
              }
              const result = window.require!(moduleId);
              if (window.ErrorGuard) {
                window.ErrorGuard.skipGuardGlobal(false);
              }
              return result;
            } catch (error) {
              if (window.ErrorGuard) {
                window.ErrorGuard.skipGuardGlobal(false);
              }
              throw error;
            }
          };
        }
      } catch (error) {
        console.error('[DEBUG] Comet initialization failed:', error);
        throw new Error('Comet initialization failed');
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
      console.log('[DEBUG] Using Webpack bundler');
      fetch('http://127.0.0.1:7242/ingest/58de6e75-6d9e-4b0c-b575-37c34eed59d3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-interceptors.ts:95',message:'Initializing Webpack',data:{randomId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
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
      some: function(predicate: (module: any) => boolean) {
        return !!self.find(predicate);
      },
      find: function(predicate: (module: any) => boolean) {
        return self.find(predicate);
      },
      filter: function(predicate: (module: any) => boolean) {
        return self.filter(predicate);
      },
      someExport: function(exportName: string) {
        return !!self.findExport(exportName);
      },
      findExport: function(exportName: string) {
        return self.findExport(exportName);
      },
      filterExport: function(exportName: string) {
        return self.filterExport(exportName);
      },
      getModules: function() {
        return self.modules;
      },
    };
    
    Object.setPrototypeOf(this.modulesCache, prototypeMethods);

    this.initialized = true;
    console.log('Mettri: WhatsAppInterceptors inicializado com sucesso');
    
    // Inicializar N após tudo estar pronto (padrão reverse.txt linha 309)
    this.initializeN();
  }

  /**
   * Investiga uma coleção em detalhes para entender sua estrutura completa
   */
  private investigateCollection(collection: any, name: string): void {
    console.log(`[DEBUG] === Investigação: ${name} ===`);
    
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
          console.log(`[DEBUG] ${name}._models tem ${collection._models.length} itens`);
          if (collection._models.length > 0) {
            console.log(`[DEBUG] ${name}._models[0] exemplo:`, {
              type: typeof collection._models[0],
              hasId: !!collection._models[0]?.id,
              hasBody: !!collection._models[0]?.body,
              keys: collection._models[0] ? Object.keys(collection._models[0]).slice(0, 10) : []
            });
          }
        }
      }
    });
    
    console.log(`[DEBUG] ${name} métodos:`, methods);
    console.log(`[DEBUG] ${name} propriedades:`, props);
    
    // Testar métodos importantes
    if (methods.includes('get')) {
      console.log(`[DEBUG] ${name}.get() disponível`);
    }
    if (methods.includes('find')) {
      console.log(`[DEBUG] ${name}.find() disponível`);
    }
    if (methods.includes('on')) {
      console.log(`[DEBUG] ${name}.on() disponível - pode escutar eventos`);
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
    const groupMetadataModule = this.findExport('GroupMetadata');
    
    if (groupMetadataModule) {
      // Verificar se tem .default
      if (groupMetadataModule.default) {
        // Padrão exato: Object.assign({}, Ct.findExport("GroupMetadata")?.default)
        this.N = Object.assign({}, groupMetadataModule.default);
        console.log('[DEBUG] === Objeto N Inicializado ===');
        console.log('[DEBUG] N é cópia de GroupMetadata.default (padrão reverse.txt linha 309)');
      } else {
        // GroupMetadata não tem .default - verificar se tem propriedades diretamente
        console.log('[DEBUG] GroupMetadata não tem .default, verificando propriedades diretamente...');
        
        // Verificar se tem Msg, Chat, Contact diretamente
        const hasMsg = !!groupMetadataModule.Msg;
        const hasChat = !!groupMetadataModule.Chat;
        const hasContact = !!groupMetadataModule.Contact;
        
        console.log('[DEBUG] GroupMetadata tem diretamente:', {
          hasMsg,
          hasChat,
          hasContact,
          msgType: typeof groupMetadataModule.Msg,
          chatType: typeof groupMetadataModule.Chat,
          allKeys: Object.keys(groupMetadataModule).slice(0, 50)
        });
        
        // Se tem propriedades diretamente, pode ser que GroupMetadata JÁ É o objeto que queremos
        if (hasMsg || hasChat || hasContact) {
          this.N = Object.assign({}, groupMetadataModule);
          console.log('[DEBUG] === Objeto N Inicializado ===');
          console.log('[DEBUG] N inicializado de GroupMetadata diretamente (sem .default)');
        } else {
          // Tentar usar GroupMetadata como N mesmo assim (pode ter outras propriedades)
          this.N = Object.assign({}, groupMetadataModule);
          console.log('[DEBUG] === Objeto N Inicializado ===');
          console.log('[DEBUG] N inicializado de GroupMetadata (sem propriedades conhecidas)');
        }
      }
      
      // Logar estrutura de N
      if (this.N) {
        console.log('[DEBUG] === Estrutura de N ===');
        console.log('[DEBUG] Chaves de N:', Object.keys(this.N).slice(0, 50));
        
        // Verificar propriedades principais
        ['Msg', 'Chat', 'Contact', 'Label'].forEach(prop => {
          if (this.N[prop]) {
            console.log(`[DEBUG] N.${prop} encontrado!`);
            safeLog(this.N[prop], `N.${prop}`);
            
            // Verificar se tem métodos de coleção
            if (typeof this.N[prop].on === 'function') {
              console.log(`[DEBUG] N.${prop} tem método .on()`);
            }
            if (typeof this.N[prop].get === 'function') {
              console.log(`[DEBUG] N.${prop} tem método .get()`);
            }
          }
        });
      }
    } else {
      console.warn('[DEBUG] GroupMetadata não encontrado - N não pode ser inicializado');
    }
  }

  /**
   * Busca o primeiro módulo que satisfaz o predicado.
   * Padrão do reverse.txt (linhas 243-255).
   */
  find(predicate: (module: any) => boolean): any {
    if (!this.initialized) {
      console.warn('Mettri: WhatsAppInterceptors não inicializado');
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
      console.warn('Mettri: WhatsAppInterceptors não inicializado');
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
      console.warn('Mettri: WhatsAppInterceptors não inicializado');
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
        safeLog(msg, 'Msg getter result (N.Msg)');
        return msg;
      } else {
        console.warn('[DEBUG] N.Msg encontrado mas não tem .on() e .get()');
        safeLog(msg, 'N.Msg (estrutura inesperada)');
      }
    }
    
    // Tentar 2: Acessar GroupMetadata.default.Msg ou GroupMetadata.Msg diretamente (fallback)
    const groupMetadata = this.findExport('GroupMetadata');
    if (groupMetadata?.default?.Msg) {
      const msg = groupMetadata.default.Msg;
      if (typeof msg.on === 'function' && typeof msg.get === 'function') {
        safeLog(msg, 'Msg getter result (GroupMetadata.default.Msg)');
        return msg;
      }
    }
    if (groupMetadata?.Msg) {
      const msg = groupMetadata.Msg;
      if (typeof msg.on === 'function' && typeof msg.get === 'function') {
        safeLog(msg, 'Msg getter result (GroupMetadata.Msg)');
        return msg;
      }
    }
    
    // Tentar 3: Buscar por export "Msg"
    const msgExport = this.findExport('Msg');
    if (msgExport) {
      const msgObj = msgExport?.default || msgExport;
      if (typeof msgObj === 'function' && typeof msgObj.on === 'function') {
        safeLog(msgObj, 'Msg getter result (findExport Msg)');
        return msgObj;
      }
      if (msgObj?.Msg && typeof msgObj.Msg.on === 'function') {
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
      this.investigateCollection(msgCollection, 'Msg (coleção genérica)');
      safeLog(msgCollection, 'Msg getter result (busca genérica)');
      return msgCollection;
    }
    
    console.warn('[DEBUG] Msg getter: Nenhum módulo Msg encontrado');
    if (this.N) {
      console.log('[DEBUG] Estrutura de N:', {
        hasMsg: !!this.N.Msg,
        msgType: typeof this.N.Msg,
        msgKeys: this.N.Msg ? Object.keys(this.N.Msg).slice(0, 20) : [],
        hasChat: !!this.N.Chat,
        hasContact: !!this.N.Contact,
        allKeys: Object.keys(this.N).slice(0, 30)
      });
    }
    
    return null;
  }

  /**
   * Getter para o módulo Chat (coleção de chats).
   * Baseado no reverse.txt linha 309: N.Chat vem de GroupMetadata.default.Chat
   */
  get Chat(): any {
    // Tentar 1: Usar N.Chat (padrão reverse.txt linha 309)
    if (this.N?.Chat) {
      const chat = this.N.Chat;
      if (typeof chat.on === 'function' && typeof chat.get === 'function') {
        safeLog(chat, 'Chat getter result (N.Chat)');
        return chat;
      }
    }
    
    // Tentar 2: GroupMetadata.default.Chat ou GroupMetadata.Chat
    const groupMetadata = this.findExport('GroupMetadata');
    if (groupMetadata?.default?.Chat) {
      const chat = groupMetadata.default.Chat;
      if (typeof chat.on === 'function' && typeof chat.get === 'function') {
        safeLog(chat, 'Chat getter result (GroupMetadata.default.Chat)');
        return chat;
      }
    }
    if (groupMetadata?.Chat) {
      const chat = groupMetadata.Chat;
      if (typeof chat.on === 'function' && typeof chat.get === 'function') {
        safeLog(chat, 'Chat getter result (GroupMetadata.Chat)');
        return chat;
      }
    }
    
    // Tentar 3: Buscar por export "Chat"
    const chatExport = this.findExport('Chat');
    if (chatExport) {
      safeLog(chatExport, 'Chat getter result (findExport Chat)');
      return chatExport;
    }
    
    // Tentar 4: Buscar por características (tem .on(), .get(), e .getActive() ou .find())
    const chatCollection = this.find((m: any) => {
      const obj = m?.default || m;
      const hasOn = typeof obj?.on === 'function';
      const hasGet = typeof obj?.get === 'function';
      const hasGetActive = typeof obj?.getActive === 'function';
      const hasFind = typeof obj?.find === 'function';
      
      return hasOn && hasGet && (hasGetActive || hasFind);
    });
    
    if (chatCollection) {
      safeLog(chatCollection, 'Chat getter result (busca por características)');
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
   * Getter para o módulo User (usuário atual).
   */
  get User(): any {
    return (
      this.findExport('getMaybeMePnUser') ||
      this.findExport('getMaybeMeLidUser')
    );
  }

  /**
   * Getter para o módulo GroupMetadata (metadados de grupos).
   */
  get GroupMetadata(): any {
    return this.findExport('GroupMetadata');
  }

  /**
   * Getter para o módulo PresenceCollection (status online/offline).
   */
  get PresenceCollection(): any {
    return this.findExport('PresenceCollection');
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
    return this.find((m: any) => 
      m?.default && typeof m.default.newId === 'function'
    )?.default;
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
   * Getter para o módulo MediaObject (objetos de mídia).
   * Padrão reverse.txt linha 315.
   */
  get MediaObject(): any {
    return this.findExport('getOrCreateMediaObject');
  }

  /**
   * Getter para o módulo sendTextMsgToChat (envia mensagens de texto).
   * Padrão reverse.txt linha 335.
   */
  get sendTextMsgToChat(): any {
    return this.findExport('sendTextMsgToChat')?.sendTextMsgToChat;
  }

  /**
   * Getter para o módulo addAndSendMsgToChat (adiciona e envia mensagem).
   * Padrão reverse.txt linha 311.
   */
  get addAndSendMsgToChat(): any {
    return this.findExport('addAndSendMsgToChat')?.addAndSendMsgToChat;
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
    return this.findExport('getEphemeralFields')?.getEphemeralFields;
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
    console.log('[DEBUG] === Análise de Todos os Módulos ===');
    
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
    
    console.log('[DEBUG] Módulos com .on():', modulesWithOn.length);
    console.log('[DEBUG] Módulos com .get():', modulesWithGet.length);
    console.log('[DEBUG] Módulos com .on() E .get():', modulesWithBoth.length);
    
    // Verificar GroupMetadata especificamente
    const groupMetadata = this.findExport('GroupMetadata');
    if (groupMetadata) {
      console.log('[DEBUG] === GroupMetadata Analysis ===');
      safeLog(groupMetadata, 'GroupMetadata completo');
      safeLog(groupMetadata?.default, 'GroupMetadata.default');
      
      // Verificar propriedades comuns
      const props = ['Chat', 'Msg', 'Contact', 'Label', 'Collection'];
      props.forEach(prop => {
        if (groupMetadata?.default?.[prop]) {
          console.log(`[DEBUG] GroupMetadata.default.${prop} encontrado!`);
          safeLog(groupMetadata.default[prop], `GroupMetadata.default.${prop}`);
        }
        if (groupMetadata?.[prop]) {
          console.log(`[DEBUG] GroupMetadata.${prop} encontrado!`);
          safeLog(groupMetadata[prop], `GroupMetadata.${prop}`);
        }
      });
    }
  }
}
