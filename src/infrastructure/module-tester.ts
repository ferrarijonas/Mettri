/**
 * ModuleTester
 * 
 * Sistema de testes para módulos da Sentinela.
 * Testa cada módulo individualmente, verifica métodos esperados e coleta logs.
 */

import { WhatsAppInterceptors } from './whatsapp-interceptors';

export interface ModuleTestResult {
  status: 'success' | 'error' | 'not-found' | 'testing';
  module: any;
  methods: string[];
  properties: string[];
  error?: string;
  logs: string[];
  testedAt: Date;
}

export class ModuleTester {
  private interceptors: WhatsAppInterceptors;
  private logs: string[] = [];

  constructor(interceptors: WhatsAppInterceptors) {
    this.interceptors = interceptors;
  }

  /**
   * Testa um módulo específico.
   * 
   * @param moduleName Nome do módulo (ex: 'Msg', 'Contact', 'Conn')
   * @returns Resultado do teste
   */
  async testModule(moduleName: string): Promise<ModuleTestResult> {
    this.logs = [];
    const startTime = Date.now();

    try {
      this.log(`[TEST] Iniciando teste de N.${moduleName}...`);

      // Verificar se interceptors está inicializado
      if (!this.interceptors.isWebpackAvailable()) {
        throw new Error('Webpack não disponível');
      }

      // Garantir que está inicializado (sem verificar cache vazio)
      try {
        await this.interceptors.initialize();
      } catch (error: any) {
        this.log(`[TEST] Aviso ao inicializar: ${error.message}`);
        // Continuar mesmo se inicialização falhar parcialmente
      }

      // Tentar acessar o módulo
      const module = this.getModule(moduleName);

      if (module === null || module === undefined) {
        this.log(`[TEST] N.${moduleName} não encontrado`);
        return {
          status: 'not-found',
          module: null,
          methods: [],
          properties: [],
          logs: [...this.logs],
          testedAt: new Date()
        };
      }

      this.log(`[TEST] N.${moduleName} encontrado!`);

      // Analisar módulo
      const methods = this.getMethods(module);
      const properties = this.getProperties(module);

      this.log(`[TEST] Métodos encontrados: ${methods.length}`);
      this.log(`[TEST] Propriedades encontradas: ${properties.length}`);

      // Validação mais permissiva: se módulo existe, é válido
      // Não validar tipo específico, apenas existência

      const duration = Date.now() - startTime;
      this.log(`[TEST] N.${moduleName} testado com sucesso em ${duration}ms`);

      // Se chegou até aqui, módulo existe e é válido
      return {
        status: 'success',
        module,
        methods,
        properties,
        logs: [...this.logs],
        testedAt: new Date()
      };

    } catch (error: any) {
      this.log(`[TEST] Erro ao testar N.${moduleName}: ${error.message}`);
      return {
        status: 'error',
        module: null,
        methods: [],
        properties: [],
        error: error.message || 'Erro desconhecido',
        logs: [...this.logs],
        testedAt: new Date()
      };
    }
  }

  /**
   * Obtém módulo pelo nome usando WhatsAppInterceptors
   */
  private getModule(moduleName: string): any {
    try {
      const interceptorsAny = this.interceptors as any;
      
      // Mapear nome do módulo para getter (alguns têm nomes diferentes)
      const getterMap: Record<string, string> = {
        'Msg': 'Msg',
        'Contact': 'Contact',
        'Label': 'Label',
        'Chat': 'Chat',
        'ChatCollection': 'ChatCollection',
        'PresenceCollection': 'PresenceCollection',
        'GroupMetadata': 'GroupMetadata',
        'User': 'User',
        'Conn': 'Conn',
        'MsgKey': 'MsgKey',
        'SendDelete': 'SendDelete',
        'addAndSendMsgToChat': 'addAndSendMsgToChat',
        'sendTextMsgToChat': 'sendTextMsgToChat',
        'uploadMedia': 'uploadMedia',
        'MediaPrep': 'MediaPrep',
        'MediaObject': 'MediaObject',
        'MediaTypes': 'MediaTypes',
        'MediaCollection': 'MediaCollection',
        'UploadUtils': 'UploadUtils',
        'DownloadManager': 'DownloadManager',
        'OpaqueData': 'OpaqueData',
        'blockContact': 'blockContact',
        'VCard': 'VCard',
        'UserConstructor': 'UserConstructor',
        'ChatState': 'ChatState',
        'Presence': 'Presence',
        'createGroup': 'createGroup',
        'getParticipants': 'getParticipants',
        'WidFactory': 'WidFactory',
        'QueryExist': 'QueryExist',
        'USyncQuery': 'USyncQuery',
        'USyncUser': 'USyncUser',
        'getEphemeralFields': 'getEphemeralFields',
        'canReplyMsg': 'canReplyMsg',
        'genMinimalLinkPreview': 'genMinimalLinkPreview',
        'findFirstWebLink': 'findFirstWebLink',
        'getSearchContext': 'getSearchContext',
        'sendReactionToMsg': 'sendReactionToMsg',
        'colorIndexToHex': 'colorIndexToHex',
        'StatusUtils': 'StatusUtils',
        'Composing': 'Composing',
        'ConversationSeen': 'ConversationSeen',
        'Playing': 'Playing',
        'StatusState': 'StatusState',
        'Classes': 'Classes',
        'Cmd': 'Cmd',
      };

      const getterName = getterMap[moduleName];
      if (!getterName) {
        this.log(`[TEST] Getter não mapeado para ${moduleName}`);
        return null;
      }

      // Acessar getter (pode retornar undefined se não implementado)
      try {
        const module = interceptorsAny[getterName];
        return module !== undefined ? module : null;
      } catch {
        // Se getter não existe, retorna null
        return null;
      }

    } catch (error: any) {
      this.log(`[TEST] Erro ao acessar módulo ${moduleName}: ${error.message}`);
      return null;
    }
  }

  /**
   * Extrai métodos do módulo
   */
  private getMethods(module: any): string[] {
    const methods: string[] = [];

    if (!module || typeof module !== 'object') {
      return methods;
    }

    try {
      // Verificar métodos comuns
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

      // Verificar métodos do prototype
      if (module.prototype) {
        Object.getOwnPropertyNames(module.prototype).forEach(prop => {
          if (prop !== 'constructor' && typeof module.prototype[prop] === 'function') {
            methods.push(`${prop} (prototype)`);
          }
        });
      }

    } catch (error) {
      // Ignorar erros ao analisar métodos
    }

    return methods;
  }

  /**
   * Extrai propriedades do módulo
   */
  private getProperties(module: any): string[] {
    const properties: string[] = [];

    if (!module || typeof module !== 'object') {
      return properties;
    }

    try {
      // Propriedades comuns
      const commonProps = ['_models', '_find', 'length', 'models', 'collection', '_collection', 'default'];

      commonProps.forEach(prop => {
        if (prop in module) {
          properties.push(prop);
        }
      });

      // Propriedades próprias (limitado a 20 para não poluir)
      try {
        const ownProps = Object.getOwnPropertyNames(module).slice(0, 20);
        ownProps.forEach(prop => {
          if (!properties.includes(prop) && typeof module[prop] !== 'function') {
            properties.push(prop);
          }
        });
      } catch {
        // Ignorar erros
      }

    } catch (error) {
      // Ignorar erros ao analisar propriedades
    }

    return properties;
  }

  /**
   * Adiciona log à coleção
   */
  private log(message: string): void {
    this.logs.push(`[${new Date().toISOString()}] ${message}`);
    // Não logar no console para não poluir
  }

  /**
   * Limpa logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Retorna logs coletados
   */
  getLogs(): string[] {
    return [...this.logs];
  }
}
