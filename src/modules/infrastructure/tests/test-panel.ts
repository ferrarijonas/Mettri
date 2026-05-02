/**
 * TestPanel
 * 
 * Painel de testes para módulos da Sentinela.
 * Lista todos os módulos organizados hierarquicamente e permite testar cada um.
 */

import type { WhatsAppInterceptors } from '../../../infrastructure/whatsapp-interceptors';
import { ModuleTester, type ModuleTestResult } from '../../../infrastructure/module-tester';
import { testConfig } from '../../../storage/test-config';
import { getIcon } from '../../../ui/icons/lucide-icons';

interface ModuleHierarchy {
  level: number;
  name: string;
  modules: string[];
}

type ModuleStatus = Record<string, ModuleTestResult | null>;

export class TestPanel {
  private container: HTMLElement | null = null;
  private interceptors: WhatsAppInterceptors;
  private tester: ModuleTester;
  private moduleStatus: ModuleStatus = {};
  private testNumber: string | null = null;
  private lastTestExecution: Date | null = null;

  // Descrições didáticas dos módulos
  private readonly MODULE_DESCRIPTIONS: Record<string, string> = {
    'Msg': 'Coleção de todas as mensagens do WhatsApp. Permite buscar, escutar eventos e acessar mensagens por ID.',
    'Contact': 'Coleção de todos os contatos. Permite buscar informações de contatos, nomes e status.',
    'Label': 'Coleção de etiquetas (labels) usadas para organizar conversas.',
    'Chat': 'Coleção de conversas/chats. Permite acessar chats ativos e buscar conversas.',
    'ChatCollection': 'Alternativa para acessar coleção de conversas.',
    'PresenceCollection': 'Status online/offline dos contatos em tempo real.',
    'GroupMetadata': 'Metadados de grupos (participantes, configurações, etc).',
    'User': 'Informações do usuário atual logado.',
    'Conn': 'Conexão com servidores do WhatsApp.',
    'MsgKey': 'Cria IDs únicos para mensagens.',
    'SendDelete': 'Envia ou deleta mensagens.',
    'addAndSendMsgToChat': 'Adiciona mensagem ao chat e envia automaticamente.',
    'sendTextMsgToChat': 'Envia mensagem de texto para um chat específico.',
    'uploadMedia': 'Envia arquivos de mídia (fotos, vídeos, documentos).',
    'MediaPrep': 'Prepara arquivos de mídia antes de enviar.',
    'MediaObject': 'Representa um arquivo de mídia no WhatsApp.',
    'MediaTypes': 'Tipos de mídia suportados (imagem, vídeo, áudio, etc).',
    'MediaCollection': 'Coleção de todos os arquivos de mídia.',
    'UploadUtils': 'Ferramentas auxiliares para upload de arquivos.',
    'DownloadManager': 'Gerencia downloads de arquivos recebidos.',
    'OpaqueData': 'Manipula dados opacos (criptografados).',
    'blockContact': 'Bloqueia um contato específico.',
    'VCard': 'Cartão de contato (vCard) para compartilhar informações.',
    'UserConstructor': 'Constrói objetos de usuário.',
    'ChatState': 'Estado do chat (digitando, gravando áudio, etc).',
    'Presence': 'Presença online/offline de contatos.',
    'createGroup': 'Cria um novo grupo no WhatsApp.',
    'getParticipants': 'Obtém lista de participantes de um grupo.',
    'WidFactory': 'Cria IDs de WhatsApp (WID) no formato correto.',
    'QueryExist': 'Verifica se um contato/chat existe.',
    'USyncQuery': 'Query de sincronização de dados.',
    'USyncUser': 'Sincronização de informações de usuário.',
    'getEphemeralFields': 'Obtém campos temporários de mensagens.',
    'canReplyMsg': 'Verifica se uma mensagem pode ser respondida.',
    'genMinimalLinkPreview': 'Gera preview de links automaticamente.',
    'findFirstWebLink': 'Encontra o primeiro link em um texto.',
    'getSearchContext': 'Obtém contexto para buscas.',
    'sendReactionToMsg': 'Envia reação (emoji) para uma mensagem.',
    'colorIndexToHex': 'Converte índice de cor para código hexadecimal.',
    'StatusUtils': 'Utilitários para status do WhatsApp.',
    'Composing': 'Indica quando alguém está digitando.',
    'ConversationSeen': 'Marca conversa como vista.',
    'Playing': 'Indica quando áudio está sendo reproduzido.',
    'StatusState': 'Estado dos status (stories).',
    'Classes': 'Seletores CSS dinâmicos usados pelo WhatsApp.',
    'Cmd': 'Comandos do WhatsApp (marcar lida, arquivar, etc).'
  };

  // Mapeamento de nomes técnicos para nomes amigáveis
  private readonly FRIENDLY_NAMES: Record<string, string> = {
    // Nível 1: Coleções Principais
    'Msg': 'Mensagens',
    'Contact': 'Contatos',
    'Label': 'Etiquetas',
    'Chat': 'Conversas',
    
    // Nível 2: Coleções Secundárias
    'ChatCollection': 'Conversas Alt',
    'PresenceCollection': 'Presença',
    'GroupMetadata': 'Grupos',
    
    // Nível 3: Core
    'User': 'Usuário',
    'Conn': 'Conexão',
    
    // Nível 4: Mensagens
    'MsgKey': 'Chave de Mensagem',
    'SendDelete': 'Enviar/Deletar',
    'addAndSendMsgToChat': 'Adicionar e Enviar Mensagem',
    'sendTextMsgToChat': 'Enviar Mensagem de Texto',
    
    // Nível 5: Mídia
    'uploadMedia': 'Enviar Mídia',
    'MediaPrep': 'Preparação de Mídia',
    'MediaObject': 'Objeto de Mídia',
    'MediaTypes': 'Tipos de Mídia',
    'MediaCollection': 'Coleção de Mídia',
    'UploadUtils': 'Utilitários de Upload',
    'DownloadManager': 'Gerenciador de Download',
    'OpaqueData': 'Dados Opacos',
    
    // Nível 6: Contatos
    'blockContact': 'Bloquear Contato',
    'VCard': 'Cartão de Contato',
    'UserConstructor': 'Construtor de Usuário',
    
    // Nível 7: Chat/Estado
    'ChatState': 'Estado do Chat',
    'Presence': 'Presença',
    'createGroup': 'Criar Grupo',
    'getParticipants': 'Obter Participantes',
    
    // Nível 8: Utilitários
    'WidFactory': 'Fábrica de WID',
    'QueryExist': 'Verificar Existência',
    'USyncQuery': 'Query de Sincronização',
    'USyncUser': 'Sincronização de Usuário',
    'getEphemeralFields': 'Obter Campos Efêmeros',
    'canReplyMsg': 'Pode Responder Mensagem',
    
    // Nível 9: Links/Preview
    'genMinimalLinkPreview': 'Gerar Preview de Link',
    'findFirstWebLink': 'Encontrar Primeiro Link',
    'getSearchContext': 'Obter Contexto de Busca',
    
    // Nível 10: Interações
    'sendReactionToMsg': 'Enviar Reação',
    'colorIndexToHex': 'Cor para Hexadecimal',
    
    // Nível 11: Status
    'StatusUtils': 'Utilitários de Status',
    'Composing': 'Digitando',
    'ConversationSeen': 'Conversa Vista',
    'Playing': 'Tocando',
    'StatusState': 'Estado de Status',
    
    // Nível 12: Seletores CSS
    'Classes': 'Classes CSS',
    
    // Nível 13: Comandos
    'Cmd': 'Comandos'
  };

  // Hierarquia completa de módulos (13 níveis)
  private readonly MODULE_HIERARCHY: ModuleHierarchy[] = [
    {
      level: 1,
      name: 'Coleções Principais',
      modules: ['Msg', 'Contact', 'Label', 'Chat']
    },
    {
      level: 2,
      name: 'Coleções Secundárias',
      modules: ['ChatCollection', 'PresenceCollection', 'GroupMetadata']
    },
    {
      level: 3,
      name: 'Core',
      modules: ['User', 'Conn']
    },
    {
      level: 4,
      name: 'Mensagens',
      modules: ['MsgKey', 'SendDelete', 'addAndSendMsgToChat', 'sendTextMsgToChat']
    },
    {
      level: 5,
      name: 'Mídia',
      modules: ['uploadMedia', 'MediaPrep', 'MediaObject', 'MediaTypes', 'MediaCollection', 'UploadUtils', 'DownloadManager', 'OpaqueData']
    },
    {
      level: 6,
      name: 'Contatos',
      modules: ['blockContact', 'VCard', 'UserConstructor']
    },
    {
      level: 7,
      name: 'Chat/Estado',
      modules: ['ChatState', 'Presence', 'createGroup', 'getParticipants']
    },
    {
      level: 8,
      name: 'Utilitários',
      modules: ['WidFactory', 'QueryExist', 'USyncQuery', 'USyncUser', 'getEphemeralFields', 'canReplyMsg']
    },
    {
      level: 9,
      name: 'Links/Preview',
      modules: ['genMinimalLinkPreview', 'findFirstWebLink', 'getSearchContext']
    },
    {
      level: 10,
      name: 'Interações',
      modules: ['sendReactionToMsg', 'colorIndexToHex']
    },
    {
      level: 11,
      name: 'Status',
      modules: ['StatusUtils', 'Composing', 'ConversationSeen', 'Playing', 'StatusState']
    },
    {
      level: 12,
      name: 'Seletores CSS',
      modules: ['Classes']
    },
    {
      level: 13,
      name: 'Comandos',
      modules: ['Cmd']
    }
  ];

  /**
   * Conjunto mínimo para considerar “maioria útil” aprovada.
   * Metáfora: itens essenciais do carro (motor, volante, freio).
   */
  private readonly REQUIRED_MODULES: string[] = [
    'User',
    'Conn',
    'Chat',
    'Msg',
    'Contact',
    'MsgKey',
    'sendTextMsgToChat',
    // Aceitar fallback: alguns builds expõem melhor via addAndSendMsgToChat
    'addAndSendMsgToChat',
  ];

  constructor(interceptors: WhatsAppInterceptors) {
    this.interceptors = interceptors;
    this.tester = new ModuleTester(interceptors);
  }

  /**
   * Renderiza o painel completo
   */
  async render(): Promise<HTMLElement> {
    // Carregar número de teste antes de renderizar
    await this.loadTestNumber();
    
    const panel = document.createElement('div');
    panel.className = 'flex flex-col gap-4';
    panel.innerHTML = this.getHTML();
    this.container = panel;

    // Criar toast fixo para feedback (anexar ao painel principal)
    this.createToast();

    // Setup event listeners
    this.setupEventListeners();
    
    // Fechar tooltips ao clicar fora (event listener global)
    document.addEventListener('click', (e) => {
      if (!this.container) return;
      const target = e.target as HTMLElement;
      if (!target.closest('.mettri-test-module-info')) {
        this.container.querySelectorAll('.mettri-info-tooltip').forEach((tooltip: Element) => {
          (tooltip as HTMLElement).style.display = 'none';
        });
      }
    });

    return panel;
  }

  /**
   * Cria toast fixo para feedback de testes
   */
  private createToast(): void {
    const rootNode = this.container?.getRootNode();
    const root = rootNode && rootNode instanceof ShadowRoot ? rootNode : document;

    // Verificar se o toast já existe (dentro do root correto)
    let toastEl =
      root instanceof ShadowRoot
        ? (root.querySelector('#mettri-test-feedback-toast') as HTMLElement | null)
        : (document.getElementById('mettri-test-feedback-toast') as HTMLElement | null);
    
    if (!toastEl) {
      // Criar toast e anexar ao painel principal (mettri-panel) ou ao próprio container como fallback
      const mettriPanel =
        root instanceof ShadowRoot
          ? (root.querySelector('#mettri-panel') as HTMLElement | null)
          : (document.getElementById('mettri-panel') as HTMLElement | null);
      const parent = mettriPanel ?? this.container ?? null;
      if (parent) {
        toastEl = document.createElement('div');
        toastEl.id = 'mettri-test-feedback-toast';
        toastEl.className = 'mettri-test-feedback-toast';
        toastEl.style.display = 'none';
        toastEl.innerHTML = `
          <div class="mettri-test-feedback-toast-content">
            <div class="mettri-test-feedback-toast-actions" style="display: flex; align-items: center; justify-content: flex-end; gap: 6px; flex-shrink: 0;">
              <button type="button" id="mettri-test-feedback-copy" title="Copiar log completo" style="font-size: 11px; padding: 4px 8px; border-radius: 6px; border: none; background: var(--accent, #eee); color: var(--accent-foreground, #333); cursor: pointer;">Copiar</button>
              <button type="button" class="mettri-test-feedback-toast-close" id="mettri-test-feedback-close" title="Fechar">×</button>
            </div>
            <div id="mettri-test-feedback-message" class="mettri-test-feedback-message" style="max-height: 50vh; overflow-y: auto;"></div>
          </div>
        `;
        parent.appendChild(toastEl);
      }
    }
  }

  /**
   * Gera HTML do painel
   */
  private getHTML(): string {
    return `
      ${this.renderRuntimeStatus()}

      <div class="flex gap-2">
        <button id="mettri-test-all" class="flex-1 h-8 rounded-xl text-[11px] font-medium glass-subtle glow-hover gap-1.5 flex items-center justify-center">
          <span class="w-3.5 h-3.5 text-primary">${getIcon('Play')}</span>
          <span>Testar Todos</span>
        </button>
        <button id="mettri-test-report" class="flex-1 h-8 rounded-xl text-[11px] font-medium glass-subtle glow-hover gap-1.5 flex items-center justify-center">
          <span class="w-3.5 h-3.5 text-primary">${getIcon('BarChart3')}</span>
          <span>Relatório</span>
        </button>
      </div>

      <div id="mettri-test-report-section" style="display: none;">
        ${this.renderReport()}
      </div>

      <div class="glass-subtle rounded-xl p-3 space-y-2">
        <div class="flex items-center gap-2">
          <span class="w-3.5 h-3.5 text-primary">${getIcon('Phone')}</span>
          <span class="text-[11px] font-medium text-foreground">Número de Teste</span>
        </div>
        <div class="flex gap-2">
          <input 
            type="text" 
            id="mettri-test-number-input" 
            placeholder="5511999999999" 
            value="${this.testNumber || ''}"
            class="flex-1 h-7 text-xs rounded-lg bg-background/50 border-border/30 focus:border-primary/50 px-3"
          />
          <button id="mettri-test-save-number" class="h-7 px-2 text-[10px] text-primary hover:bg-primary/10 rounded-lg">Salvar</button>
        </div>
        ${this.testNumber ? `<div class="text-[11px] text-primary opacity-80">Salvo: ${this.testNumber}</div>` : ''}
      </div>

      <div class="space-y-2">
        <span class="text-[11px] font-medium text-foreground px-1 block">Módulos da Sentinela</span>
        <div class="space-y-2" id="mettri-test-modules">
          ${this.renderModuleHierarchy()}
        </div>
      </div>
    `;
  }

  private renderRuntimeStatus(): string {
    const status = this.getRuntimeStatus();

    const boolText = (v: boolean | null): string => {
      if (v === null) return 'desconhecido';
      return v ? 'sim' : 'não';
    };

    return `
      <div class="glass-subtle rounded-xl p-3 space-y-2">
        <div class="flex items-center gap-2">
          <span class="w-3.5 h-3.5 text-primary">${getIcon('Info')}</span>
          <span class="text-[11px] font-medium text-foreground">Status (Sinal Verde)</span>
        </div>

        <div class="text-[11px] text-muted-foreground space-y-1">
          <div><strong>window.Mettri:</strong> ${boolText(status.hasMettri)} ${status.mettriKeys.length > 0 ? `(${status.mettriKeys.join(', ')})` : ''}</div>
          <div><strong>window.require:</strong> ${status.requireType}</div>
          <div><strong>window.__d:</strong> ${boolText(status.hasD)}</div>
          <div><strong>webpackChunk:</strong> ${status.webpackChunkInfo}</div>
          <div><strong>AppState:</strong> ${status.appState ?? 'desconhecido'}</div>
          <div><strong>WID (detectado):</strong> ${status.userWid ?? 'não detectado'}</div>
          <div><strong>Obrigatórios disponíveis:</strong> ${status.requiredAvailable}/${status.requiredTotal}</div>
        </div>
      </div>
    `;
  }

  private getRuntimeStatus(): {
    hasMettri: boolean;
    mettriKeys: string[];
    requireType: string;
    hasD: boolean | null;
    webpackChunkInfo: string;
    appState: string | null;
    userWid: string | null;
    requiredAvailable: number;
    requiredTotal: number;
  } {
    type RequireFn = (moduleId: string) => unknown;
    interface SocketModel { Socket?: { state?: unknown } }

    const mettri = (window as unknown as { Mettri?: Record<string, unknown> }).Mettri;
    const hasMettri = !!mettri;
    const mettriKeys = mettri ? Object.keys(mettri).slice(0, 10) : [];

    const requireType = typeof (window as unknown as { require?: unknown }).require;
    const hasD =
      typeof window !== 'undefined' && '__d' in window
        ? typeof (window as unknown as { __d?: unknown }).__d !== 'undefined'
        : null;

    const chunk = (window as unknown as { webpackChunkwhatsapp_web_client?: unknown }).webpackChunkwhatsapp_web_client;
    const webpackChunkInfo = Array.isArray(chunk) ? `array(len=${chunk.length})` : typeof chunk;

    let appState: string | null = null;
    const requireValue = (window as unknown as { require?: unknown }).require;
    if (typeof requireValue === 'function') {
      try {
        const req = requireValue as RequireFn;
        const socketModel = req('WAWebSocketModel') as SocketModel | null;
        const state = socketModel?.Socket?.state;
        if (typeof state === 'string') {
          appState = state;
        }
      } catch {
        // Ignorar
      }
    }

    const userWid = this.tryDetectUserWid();

    const interceptorsAny = this.interceptors as unknown as Record<string, unknown>;
    const requiredAvailable = this.REQUIRED_MODULES.filter(m => !!interceptorsAny[m]).length;

    return {
      hasMettri,
      mettriKeys,
      requireType,
      hasD,
      webpackChunkInfo,
      appState,
      userWid,
      requiredAvailable,
      requiredTotal: this.REQUIRED_MODULES.length,
    };
  }

  private tryDetectUserWid(): string | null {
    try {
      const userModule = this.interceptors.User as unknown as
        | { getMaybeMePnUser?: () => unknown; getMaybeMeLidUser?: () => unknown }
        | (() => unknown)
        | null
        | undefined;

      let userData: unknown = null;

      if (typeof userModule === 'function') {
        try {
          userData = userModule();
        } catch {
          userData = null;
        }
      } else if (userModule && typeof userModule === 'object') {
        const maybePn = userModule.getMaybeMePnUser?.();
        userData = maybePn ?? userModule.getMaybeMeLidUser?.() ?? null;
      }

      if (!userData || typeof userData !== 'object') return null;

      const obj = userData as {
        id?: { _serialized?: unknown } | unknown;
        _serialized?: unknown;
        wid?: unknown;
        user?: unknown;
        server?: unknown;
      };

      if (obj.id && typeof obj.id === 'object' && obj.id !== null) {
        const serialized = (obj.id as { _serialized?: unknown })._serialized;
        if (typeof serialized === 'string') return serialized;
      }
      if (typeof obj._serialized === 'string') return obj._serialized;
      if (typeof obj.wid === 'string') return obj.wid;
      if (typeof obj.user === 'string') {
        const server = typeof obj.server === 'string' ? obj.server : 'c.us';
        return `${obj.user}@${server}`;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Renderiza hierarquia de módulos
   */
  private renderModuleHierarchy(): string {
    return this.MODULE_HIERARCHY.map(level => {
      const modulesHTML = level.modules.map(moduleName => {
        const status = this.getModuleStatus(moduleName);
        const statusIcon = this.getStatusIcon(status);
        const statusClass = this.getStatusClass(status);

        const friendlyName = this.getFriendlyName(moduleName);
        const description = this.getModuleDescription(moduleName);
        // Escapar HTML para evitar problemas de renderização
        const escapedFriendlyName = this.escapeHtml(friendlyName);
        const escapedModuleName = this.escapeHtml(moduleName);
        void description;
        return `
          <div class="${TestPanel.MODULE_ROW_BASE_CLASS} ${statusClass}" data-module="${escapedModuleName}">
            <div class="w-4 h-4 flex items-center justify-center flex-shrink-0" data-status-indicator>${statusIcon}</div>
            <span class="w-3.5 h-3.5 text-muted-foreground/60 flex items-center justify-center">${getIcon('Info')}</span>
            <span class="flex-1 text-[11px] text-foreground truncate" title="${escapedFriendlyName}">${escapedFriendlyName}</span>
            <div class="flex items-center gap-0.5">
              <button class="h-5 px-1.5 text-[10px] text-primary hover:text-primary hover:bg-primary/10 rounded-md" data-action="test" data-module="${escapedModuleName}">Testar</button>
              <button class="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent rounded-md" data-action="details" data-module="${escapedModuleName}">Ver</button>
            </div>
          </div>
        `;
      }).join('');

      // Primeiro nível sempre expandido
      const isFirstLevel = level.level === 1;
      
      return `
        <div class="glass-subtle rounded-xl overflow-hidden">
          <button class="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/30 transition-colors" data-level="${level.level}" aria-expanded="${isFirstLevel ? 'true' : 'false'}">
            <span class="w-3.5 h-3.5 text-muted-foreground/70 flex items-center justify-center" style="transform: ${isFirstLevel ? 'rotate(0deg)' : 'rotate(-90deg)'}">${getIcon('ChevronDown')}</span>
            <span class="text-[11px] font-medium text-foreground">Nível ${level.level}: ${level.name}</span>
          </button>
          <div class="border-t border-border/20" data-level-modules="${level.level}" style="display: ${isFirstLevel ? 'block' : 'none'};">
            ${modulesHTML}
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Renderiza relatório
   */
  private renderReport(): string {
    const stats = this.getStats();
    const lastExecution = this.lastTestExecution 
      ? this.formatTimeAgo(this.lastTestExecution)
      : 'Nunca';

    return `
      <div class="mettri-test-report glass-subtle rounded-xl p-3">
        <h3 style="font-size: 11px; font-weight: 500; color: var(--mettri-text, #FFFFFF); margin: 0 0 12px 0; line-height: 1.3; letter-spacing: -0.01em;">Relatório de Testes</h3>
        <div class="mettri-test-report-stat">
          <strong>Total:</strong> ${stats.total} módulos
        </div>
        <div class="mettri-test-report-stat">
          <strong>Obrigatórios OK:</strong> ${stats.requiredSuccess}/${stats.requiredTotal}
        </div>
        <div class="mettri-test-report-stat">
          <strong>Funcionando:</strong> ${stats.success}
        </div>
        <div class="mettri-test-report-stat">
          <strong>Não funciona:</strong> ${stats.error}
        </div>
        <div class="mettri-test-report-stat">
          <strong>Não testado:</strong> ${stats.notTested}
        </div>
        <div class="mettri-test-report-stat">
          <strong>Testando:</strong> ${stats.testing}
        </div>
        <div class="mettri-test-report-stat">
          <strong>Última execução:</strong> ${lastExecution}
        </div>
        <div class="mettri-test-report-actions">
          <button id="mettri-test-export-json" class="mettri-test-btn-small">Exportar JSON</button>
          <button id="mettri-test-copy-logs" class="mettri-test-btn-small">Copiar Logs</button>
        </div>
      </div>
    `;
  }

  /**
   * Configura event listeners
   */
  private setupEventListeners(): void {
    if (!this.container) return;

    // Salvar número de teste
    const saveBtn = this.container.querySelector('#mettri-test-save-number');
    saveBtn?.addEventListener('click', async () => {
      const input = this.container?.querySelector('#mettri-test-number-input') as HTMLInputElement;
      if (input?.value) {
        const originalText = (saveBtn as HTMLButtonElement).textContent;
        (saveBtn as HTMLButtonElement).disabled = true;
        (saveBtn as HTMLButtonElement).textContent = 'Salvando...';
        
        try {
          await this.saveTestNumber(input.value);
          this.showFeedback('Número salvo com sucesso!', 'success');
        } catch (error: any) {
          console.error('[TEST] Erro ao salvar número:', error);
          const errorMsg = error?.message || 'Erro desconhecido ao salvar';
          this.showFeedback(`Erro: ${errorMsg}`, 'error');
        } finally {
          (saveBtn as HTMLButtonElement).disabled = false;
          (saveBtn as HTMLButtonElement).textContent = originalText || 'Salvar';
        }
      } else {
        this.showFeedback('⚠️ Digite um número válido', 'warning');
      }
    });

    // Limpar número de teste
    const clearBtn = this.container.querySelector('#mettri-test-clear-number');
    clearBtn?.addEventListener('click', async () => {
      try {
        await this.clearTestNumber();
        this.showFeedback('Número removido', 'success');
      } catch (error) {
        this.showFeedback('Erro ao remover número', 'error');
      }
    });

    // Testar módulo individual (usar event delegation para garantir que funciona)
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.hasAttribute('data-action') && target.getAttribute('data-action') === 'test') {
        const moduleName = target.getAttribute('data-module');
        if (moduleName) {
          e.preventDefault();
          e.stopPropagation();
          this.testModule(moduleName);
        }
      }
    });

    // Ver detalhes e logs do módulo (usar event delegation)
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.getAttribute('data-action');
      const moduleName = target.getAttribute('data-module');
      
      // Hover/Click no ícone de informação - mostrar tooltip (não alert)
      if (target.classList.contains('mettri-test-module-info') || target.closest('.mettri-test-module-info')) {
        e.preventDefault();
        e.stopPropagation();
        const infoEl = target.closest('.mettri-test-module-info');
        if (infoEl) {
          const tooltip = infoEl.querySelector('.mettri-info-tooltip') as HTMLElement;
          if (tooltip) {
            // Toggle tooltip
            const isVisible = tooltip.style.display === 'block';
            // Fechar todos os tooltips primeiro
            this.container?.querySelectorAll('.mettri-info-tooltip').forEach((t: Element) => {
              (t as HTMLElement).style.display = 'none';
            });
            // Mostrar/esconder o tooltip clicado
            tooltip.style.display = isVisible ? 'none' : 'block';
          }
        }
        return;
      }
      
      // Fechar tooltips ao clicar fora
      if (!target.closest('.mettri-test-module-info')) {
        this.container?.querySelectorAll('.mettri-info-tooltip').forEach((t: Element) => {
          (t as HTMLElement).style.display = 'none';
        });
      }
      
      if (action === 'details' && moduleName) {
        e.preventDefault();
        e.stopPropagation();
        this.showModuleDetails(moduleName);
      }
    });

    // Testar todos
    const testAllBtn = this.container.querySelector('#mettri-test-all');
    testAllBtn?.addEventListener('click', () => {
      this.testAllModules();
    });

    // Ver relatório
    const reportBtn = this.container.querySelector('#mettri-test-report');
    reportBtn?.addEventListener('click', () => {
      this.toggleReport();
    });

    // Expandir/recolher níveis (event delegation)
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const levelHeader = target.closest('[data-level]') as HTMLElement;
      
      if (levelHeader && levelHeader.hasAttribute('data-level')) {
        e.preventDefault();
        e.stopPropagation();
        const level = levelHeader.getAttribute('data-level');
        if (level) {
          const modulesDiv = this.container?.querySelector(`[data-level-modules="${level}"]`) as HTMLElement;
          const chevron = levelHeader.querySelector('svg');
          
          if (modulesDiv) {
            const isExpanded = modulesDiv.style.display !== 'none';
            
            if (isExpanded) {
              modulesDiv.style.display = 'none';
              levelHeader.setAttribute('aria-expanded', 'false');
              if (chevron) {
                chevron.style.transform = 'rotate(-90deg)';
              }
            } else {
              modulesDiv.style.display = 'block';
              levelHeader.setAttribute('aria-expanded', 'true');
              if (chevron) {
                chevron.style.transform = 'rotate(0deg)';
              }
            }
          }
        }
      }
    });

    // Exportar JSON
    const exportBtn = this.container.querySelector('#mettri-test-export-json');
    exportBtn?.addEventListener('click', () => {
      this.exportJSON();
    });

    // Copiar logs
    const copyBtn = this.container.querySelector('#mettri-test-copy-logs');
    copyBtn?.addEventListener('click', () => {
      this.copyLogs();
    });
  }

  /**
   * Carrega número de teste salvo
   */
  private async loadTestNumber(): Promise<void> {
    this.testNumber = await testConfig.getTestNumber();
  }

  /**
   * Salva número de teste
   */
  private async saveTestNumber(phone: string): Promise<void> {
    try {
      // Validar número
      const trimmedPhone = phone.trim();
      if (!trimmedPhone || trimmedPhone.length < 10) {
        throw new Error('Número inválido. Digite pelo menos 10 dígitos.');
      }
      
      await testConfig.saveTestNumber(trimmedPhone);
      this.testNumber = trimmedPhone;
      this.updateTestNumberDisplay();
    } catch (error: any) {
      console.error('[TEST] Erro ao salvar número:', error);
      throw error;
    }
  }

  /**
   * Limpa número de teste
   */
  private async clearTestNumber(): Promise<void> {
    await testConfig.clearTestNumber();
    this.testNumber = null;
    this.updateTestNumberDisplay();
  }

  /**
   * Atualiza display do número de teste
   */
  private updateTestNumberDisplay(): void {
    if (!this.container) return;

    const input = this.container.querySelector('#mettri-test-number-input') as HTMLInputElement;
    if (input) {
      input.value = this.testNumber || '';
    }

    const savedDiv = this.container.querySelector('.mettri-test-number-saved');
    if (this.testNumber) {
      if (!savedDiv) {
        const configDiv = this.container.querySelector('.mettri-test-number-config');
        const div = document.createElement('div');
        div.className = 'mettri-test-number-saved';
        div.textContent = `Salvo: ${this.testNumber}`;
        configDiv?.parentNode?.insertBefore(div, configDiv?.nextSibling);
      } else {
        savedDiv.textContent = `Salvo: ${this.testNumber}`;
      }
    } else {
      savedDiv?.remove();
    }
  }

  /**
   * Testa um módulo específico
   */
  private async testModule(moduleName: string): Promise<void> {
    if (!this.container) return;

    console.log(`[TEST] Iniciando teste de ${moduleName}...`);

    // Atualizar status para "testando"
    this.updateModuleStatus(moduleName, { status: 'testing' } as ModuleTestResult);
    this.updateModuleDisplay(moduleName);

    try {
      const result = await this.tester.testModule(moduleName);
      this.moduleStatus[moduleName] = result;
      this.lastTestExecution = new Date();
      this.updateModuleDisplay(moduleName);
      
      // Para módulos específicos, fazer teste funcional adicional
      let functionalResult = '';
      if (result.status === 'success' && result.module) {
        functionalResult = await this.performFunctionalTest(moduleName, result.module);
      }
      
      // Mostrar feedback baseado no resultado
      if (result.status === 'success') {
        const baseMsg = `${this.getFriendlyName(moduleName)} testado com sucesso!`;
        const finalMsg = functionalResult ? `${baseMsg}\n${functionalResult}` : baseMsg;
        this.showFeedback(finalMsg, 'success');
      } else if (result.status === 'not-found') {
          this.showFeedback(`${this.getFriendlyName(moduleName)} não encontrado`, 'error');
      } else {
          this.showFeedback(`Erro ao testar ${this.getFriendlyName(moduleName)}: ${result.error || 'Erro desconhecido'}`, 'error');
      }
      
      console.log(`[TEST] Resultado de ${moduleName}:`, result.status);
    } catch (error: any) {
      console.error(`[TEST] Erro ao testar ${moduleName}:`, error);
      this.moduleStatus[moduleName] = {
        status: 'error',
        module: null,
        methods: [],
        properties: [],
        error: error.message,
        logs: [],
        testedAt: new Date()
      };
      this.updateModuleDisplay(moduleName);
      this.showFeedback(`Erro ao testar ${this.getFriendlyName(moduleName)}: ${error.message}`, 'error');
    }
  }

  /**
   * Testa todos os módulos
   */
  private async testAllModules(): Promise<void> {
    if (!this.container) return;

    const testAllBtn = this.container.querySelector('#mettri-test-all') as HTMLButtonElement;
    if (testAllBtn) {
      testAllBtn.disabled = true;
      const span = testAllBtn.querySelector('span');
      if (span) {
        span.textContent = 'Testando...';
      }
    }

    const allModulesRaw = this.MODULE_HIERARCHY.flatMap(level => level.modules);
    const allModules = [
      ...this.REQUIRED_MODULES,
      ...allModulesRaw.filter(m => !this.REQUIRED_MODULES.includes(m)),
    ];
    let tested = 0;

    for (const moduleName of allModules) {
      await this.testModule(moduleName);
      tested++;
      
      // Atualizar progresso no botão
      if (testAllBtn) {
        const span = testAllBtn.querySelector('span');
        if (span) {
          span.textContent = `Testando... (${tested}/${allModules.length})`;
        }
      }
    }

    this.lastTestExecution = new Date();
    this.updateReport();

    if (testAllBtn) {
      testAllBtn.disabled = false;
      const span = testAllBtn.querySelector('span');
      if (span) {
        span.textContent = 'Testar Todos';
      }
    }
  }

  /**
   * Mostra detalhes e logs do módulo (combinado)
   */
  private showModuleDetails(moduleName: string): void {
    const result = this.moduleStatus[moduleName];
    const friendlyName = this.getFriendlyName(moduleName);
    
    if (!result) {
      alert(`${friendlyName} (N.${moduleName})\n\nMódulo ainda não foi testado. Clique em "Testar" primeiro.`);
      return;
    }

    let details = `
${friendlyName} (N.${moduleName})

Status: ${this.getStatusText(result.status)}
Testado em: ${result.testedAt.toLocaleString()}

Métodos encontrados (${result.methods.length}):
${result.methods.length > 0 ? result.methods.join(', ') : 'Nenhum'}

Propriedades encontradas (${result.properties.length}):
${result.properties.length > 0 ? result.properties.join(', ') : 'Nenhuma'}

${result.error ? `Erro: ${result.error}\n` : ''}`;

    // Adicionar logs se disponíveis
    if (result.logs && result.logs.length > 0) {
      details += `\n\nLogs (${result.logs.length}):\n${result.logs.join('\n')}`;
    } else {
      details += `\n\nLogs: Nenhum log disponível.`;
    }

    alert(details.trim());
  }

  /** Classes base da linha de módulo (igual ao renderModuleHierarchy) — não sobrescrever para não perder layout e botões */
  private static readonly MODULE_ROW_BASE_CLASS = 'flex items-center gap-2 px-3 py-2 hover:bg-accent/50 transition-colors group';

  /**
   * Atualiza display de um módulo
   */
  private updateModuleDisplay(moduleName: string): void {
    if (!this.container) return;

    const moduleEl = this.container.querySelector(`[data-module="${moduleName}"]`);
    if (!moduleEl || !(moduleEl instanceof HTMLElement)) return;

    const status = this.getModuleStatus(moduleName);
    const statusIcon = this.getStatusIcon(status);
    const statusClass = this.getStatusClass(status);

    // Atualizar ícone de status (agora é uma div dentro do flex container)
    const statusIndicator = moduleEl.querySelector('[data-status-indicator]') as HTMLElement;
    if (statusIndicator) {
      statusIndicator.innerHTML = statusIcon;
    }

    // Preservar classes de layout e só atualizar a classe de status (evita sumir botões Testar/Ver)
    moduleEl.className = `${TestPanel.MODULE_ROW_BASE_CLASS} ${statusClass}`;
  }

  /**
   * Atualiza status de um módulo (sem atualizar display)
   */
  private updateModuleStatus(moduleName: string, result: ModuleTestResult | null): void {
    this.moduleStatus[moduleName] = result;
  }

  /**
   * Obtém status de um módulo
   */
  private getModuleStatus(moduleName: string): ModuleTestResult | null {
    return this.moduleStatus[moduleName] || null;
  }

  /**
   * Obtém ícone de status
   */
  private getStatusIcon(result: ModuleTestResult | null): string {
    if (!result) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`;
    }
    if (result.status === 'testing') {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--mettri-warning-color, #FFB938);"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`;
    }
    if (result.status === 'success') {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color: var(--mettri-success-color, #00A884);"><polyline points="20 6 9 17 4 12"/></svg>`;
    }
    if (result.status === 'error' || result.status === 'not-found') {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--mettri-error-color, #EA0038);"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`;
  }

  /**
   * Obtém classe CSS de status
   */
  private getStatusClass(result: ModuleTestResult | null): string {
    if (!result) return 'status-not-tested';
    if (result.status === 'testing') return 'status-testing';
    if (result.status === 'success') return 'status-success';
    if (result.status === 'error' || result.status === 'not-found') return 'status-error';
    return 'status-not-tested';
  }

  /**
   * Obtém texto de status
   */
  private getStatusText(status: string): string {
    const map: Record<string, string> = {
      'success': 'Funcionando',
      'error': 'Erro',
      'not-found': 'Não encontrado',
      'testing': 'Testando'
    };
    return map[status] || '⚪ Não testado';
  }

  /**
   * Obtém estatísticas
   */
  private getStats() {
    const allModules = this.MODULE_HIERARCHY.flatMap(level => level.modules);
    let success = 0;
    let error = 0;
    let notTested = 0;
    let testing = 0;

    allModules.forEach(moduleName => {
      const result = this.moduleStatus[moduleName];
      if (!result) {
        notTested++;
      } else if (result.status === 'success') {
        success++;
      } else if (result.status === 'testing') {
        testing++;
      } else {
        error++;
      }
    });

    const requiredTotal = this.REQUIRED_MODULES.length;
    let requiredSuccess = 0;
    this.REQUIRED_MODULES.forEach(moduleName => {
      if (this.moduleStatus[moduleName]?.status === 'success') {
        requiredSuccess++;
      }
    });

    return {
      total: allModules.length,
      requiredTotal,
      requiredSuccess,
      success,
      error,
      notTested,
      testing
    };
  }

  /**
   * Alterna visibilidade do relatório
   */
  private toggleReport(): void {
    if (!this.container) return;

    const reportSection = this.container.querySelector('#mettri-test-report-section');
    if (reportSection) {
      const isVisible = reportSection.getAttribute('style')?.includes('display: none');
      if (isVisible) {
        this.updateReport();
        reportSection.setAttribute('style', 'display: block;');
      } else {
        reportSection.setAttribute('style', 'display: none;');
      }
    }
  }

  /**
   * Atualiza relatório
   */
  private updateReport(): void {
    if (!this.container) return;

    const reportSection = this.container.querySelector('#mettri-test-report-section');
    if (reportSection) {
      reportSection.innerHTML = this.renderReport();
      this.setupReportEventListeners();
    }
  }

  /**
   * Configura event listeners do relatório
   */
  private setupReportEventListeners(): void {
    if (!this.container) return;

    const exportBtn = this.container.querySelector('#mettri-test-export-json');
    exportBtn?.addEventListener('click', () => {
      this.exportJSON();
    });

    const copyBtn = this.container.querySelector('#mettri-test-copy-logs');
    copyBtn?.addEventListener('click', () => {
      this.copyLogs();
    });
  }

  /**
   * Exporta resultados como JSON
   */
  private exportJSON(): void {
    const allModules = this.MODULE_HIERARCHY.flatMap(level => level.modules);
    const exportData = {
      testNumber: this.testNumber,
      lastExecution: this.lastTestExecution?.toISOString(),
      stats: this.getStats(),
      modules: allModules.map(moduleName => {
        const result = this.moduleStatus[moduleName];
        return {
          name: moduleName,
          status: result?.status || 'not-tested',
          methods: result?.methods || [],
          properties: result?.properties || [],
          error: result?.error,
          testedAt: result?.testedAt?.toISOString()
        };
      })
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mettri-test-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Copia logs para clipboard
   */
  private async copyLogs(): Promise<void> {
    const allModules = this.MODULE_HIERARCHY.flatMap(level => level.modules);
    const allLogs: string[] = [];

    allModules.forEach(moduleName => {
      const result = this.moduleStatus[moduleName];
      if (result && result.logs.length > 0) {
        allLogs.push(`\n=== N.${moduleName} ===`);
        allLogs.push(...result.logs);
      }
    });

    if (allLogs.length === 0) {
      alert('Nenhum log disponível. Execute testes primeiro.');
      return;
    }

    try {
      await navigator.clipboard.writeText(allLogs.join('\n'));
      alert('Logs copiados para a área de transferência!');
    } catch (error) {
      alert('Erro ao copiar logs. Tente selecionar e copiar manualmente.');
    }
  }

  /**
   * Obtém nome amigável do módulo
   */
  private getFriendlyName(moduleName: string): string {
    return this.FRIENDLY_NAMES[moduleName] || moduleName;
  }

  /**
   * Obtém descrição do módulo
   */
  private getModuleDescription(moduleName: string): string {
    return this.MODULE_DESCRIPTIONS[moduleName] || 'Módulo da Sentinela do WhatsApp.';
  }

  /**
   * Mostra feedback visual em toast fixo
   */
  private showFeedback(message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
    // Garantir que o toast existe
    this.createToast();
    // Buscar toast no mesmo root do painel (document ou Shadow DOM)
    const rootNode = this.container?.getRootNode();
    const root = rootNode && rootNode instanceof ShadowRoot ? rootNode : document;
    const toastEl = root.querySelector('#mettri-test-feedback-toast') as HTMLElement | null;
    const messageEl = root.querySelector('#mettri-test-feedback-message') as HTMLElement | null;
    const closeBtn = root.querySelector('#mettri-test-feedback-close');
    const copyBtn = root.querySelector('#mettri-test-feedback-copy') as HTMLButtonElement | null;
    
    if (toastEl && messageEl) {
      // Suportar múltiplas linhas
      messageEl.innerHTML = message.split('\n').map(line => {
        const div = document.createElement('div');
        div.textContent = line;
        return div.outerHTML;
      }).join('');
      
      // Remover classes anteriores de tipo
      toastEl.classList.remove('mettri-test-feedback-toast-success', 'mettri-test-feedback-toast-error', 'mettri-test-feedback-toast-warning');
      // Adicionar nova classe de tipo
      toastEl.classList.add(`mettri-test-feedback-toast-${type}`);
      
      // Mostrar toast
      toastEl.style.display = 'flex';
      
      // Event listener para fechar
      const closeHandler = () => {
        toastEl.style.display = 'none';
      };
      
      if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true) as HTMLElement;
        closeBtn.parentNode?.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.addEventListener('click', closeHandler);
      }
      
      if (copyBtn) {
        const newCopyBtn = copyBtn.cloneNode(true) as HTMLButtonElement;
        copyBtn.parentNode?.replaceChild(newCopyBtn, copyBtn);
        newCopyBtn.textContent = 'Copiar';
        newCopyBtn.addEventListener('click', () => {
          const text = messageEl.innerText || messageEl.textContent || '';
          navigator.clipboard.writeText(text).then(() => {
            newCopyBtn.textContent = 'Copiado!';
            setTimeout(() => { newCopyBtn.textContent = 'Copiar'; }, 1500);
          }).catch(() => {
            newCopyBtn.textContent = 'Erro';
            setTimeout(() => { newCopyBtn.textContent = 'Copiar'; }, 1500);
          });
        });
      }
      
      // Ocultar automaticamente após 10 segundos
      setTimeout(() => {
        if (toastEl.style.display === 'flex') {
          toastEl.style.display = 'none';
        }
      }, 10000);
    }
  }

  /**
   * Spike: tenta várias abordagens para obter chatIds de uma etiqueta.
   * TODO: remover após implementar WhatsAppLabelsService.
   */
  private async runLabelToChatsSpike(Label: any, Chat: any): Promise<{
    approach: string; success: boolean; chatIds: string[]; error?: string;
  }[]> {
    const toIds = (chats: any[]): string[] => {
      if (!Array.isArray(chats)) return [];
      return chats.map((c: any) => c?.id?.toString?.() ?? c?.id ?? '').filter(Boolean);
    };
    const labels = (Label._models && Array.isArray(Label._models))
      ? Label._models
      : (typeof Label.all === 'function' ? Label.all() : []) ?? [];
    const firstLabel = labels.find((l: any) => l?.id != null) ?? labels[0];
    if (!firstLabel?.id) return [];
    const labelId = firstLabel.id;
    const results: { approach: string; success: boolean; chatIds: string[]; error?: string }[] = [];

    const run = async (approach: string, fn: () => Promise<any>) => {
      try {
        const out = await Promise.resolve(fn());
        const chatIds = Array.isArray(out) ? toIds(out as any) : [];
        return { approach, success: chatIds.length > 0, chatIds, error: undefined };
      } catch (e: any) {
        return { approach, success: false, chatIds: [], error: (e as Error)?.message || String(e) };
      }
    };

    results.push(await run('firstLabel.getChats()', () => Promise.resolve(firstLabel.getChats ? firstLabel.getChats() : [])));
    results.push(await run('Label.getChatsByLabelId(id)', () => Promise.resolve(Label.getChatsByLabelId?.(labelId) ?? [])));
    results.push(await run('firstLabel.chats', () => Promise.resolve(Array.isArray(firstLabel.chats) ? firstLabel.chats : [])));
    results.push(await run('firstLabel.chatIds', () => Promise.resolve(Array.isArray(firstLabel.chatIds) ? firstLabel.chatIds : [])));
    results.push(await run('firstLabel._chats', () => Promise.resolve(Array.isArray(firstLabel._chats) ? firstLabel._chats : [])));

    const chatModels = (Chat.getModelsArray && Chat.getModelsArray()) ?? (Array.isArray(Chat._models) ? Chat._models : []);
    results.push(await run('Chat.getModelsArray + labelIds', () => Promise.resolve(chatModels.filter((c: any) => c?.labelIds?.includes?.(labelId)))));
    results.push(await run('Chat.getModelsArray + labels', () => Promise.resolve(chatModels.filter((c: any) => {
      const L = c?.labels;
      if (!Array.isArray(L)) return false;
      return L.some((l: any) => l?.id === labelId || l === labelId);
    }))));
    results.push(await run('Chat._models + labelIds', () => Promise.resolve((Chat._models || []).filter((c: any) => (c?.labelIds && Array.isArray(c.labelIds)) && c.labelIds.includes(labelId)))));
    results.push(await run('Chat._models + getLabels()', async () => {
      const list: any[] = [];
      for (const c of Chat._models || []) {
        const labels = typeof c?.getLabels === 'function' ? (await c.getLabels()) : [];
        if (Array.isArray(labels) && labels.some((l: any) => l?.id === labelId || l === labelId)) list.push(c);
      }
      return list;
    }));
    results.push(await run('Label.get(id) + getChats', async () => {
      const labelObj = typeof Label.get === 'function' ? Label.get(labelId) : null;
      const chats = labelObj?.getChats ? await labelObj.getChats() : [];
      return Array.isArray(chats) ? chats : [];
    }));

    return results;
  }

  /**
   * Para uma etiqueta (labelId), obtém chatIds usando uma abordagem específica.
   */
  private async getChatIdsForLabelByApproach(
    Label: any,
    Chat: any,
    labelId: string,
    approachName: string
  ): Promise<string[]> {
    const toIds = (chats: any[]): string[] =>
      (Array.isArray(chats) ? chats : []).map((c: any) => c?.id?.toString?.() ?? c?.id ?? '').filter(Boolean);
    const chatModels = (Chat.getModelsArray && Chat.getModelsArray()) ?? (Array.isArray(Chat._models) ? Chat._models : []);

    switch (approachName) {
      case 'Label.getChatsByLabelId(id)':
        return toIds(Label.getChatsByLabelId?.(labelId) ?? []);
      case 'Chat.getModelsArray + labelIds':
        return toIds(chatModels.filter((c: any) => c?.labelIds?.includes?.(labelId)));
      case 'Chat.getModelsArray + labels':
        return toIds(chatModels.filter((c: any) => {
          const L = c?.labels;
          if (!Array.isArray(L)) return false;
          return L.some((l: any) => l?.id === labelId || l === labelId);
        }));
      case 'Chat._models + labelIds':
        return toIds((Chat._models || []).filter((c: any) => (c?.labelIds && Array.isArray(c.labelIds)) && c.labelIds.includes(labelId)));
      case 'Chat._models + getLabels()': {
        const list: any[] = [];
        for (const c of Chat._models || []) {
          const labels = typeof c?.getLabels === 'function' ? (await c.getLabels()) : [];
          if (Array.isArray(labels) && labels.some((l: any) => l?.id === labelId || l === labelId)) list.push(c);
        }
        return toIds(list);
      }
      case 'Label.get(id) + getChats': {
        const labelObj = typeof Label.get === 'function' ? Label.get(labelId) : null;
        const chats = labelObj?.getChats ? await labelObj.getChats() : [];
        return toIds(Array.isArray(chats) ? chats : []);
      }
      default:
        return [];
    }
  }

  /** Formata chatId (ex: 5531999999999@c.us) para exibição (ex: 55 31 99999-9999). */
  private formatChatIdForDisplay(chatId: string): string {
    if (!chatId) return '';
    const num = chatId.replace(/@.*$/, '').replace(/\D/g, '');
    if (num.length >= 10) {
      const ddd = num.slice(0, 2);
      const rest = num.slice(2);
      const tail = rest.length > 8 ? `${rest.slice(0, -4)}-${rest.slice(-4)}` : rest;
      return `${ddd} ${tail}`.trim();
    }
    return chatId;
  }

  /**
   * Realiza teste funcional adicional para módulos específicos
   * Retorna mensagem de resultado para exibir
   */
  private async performFunctionalTest(moduleName: string, module: any): Promise<string> {
    try {
      // Teste para módulo Msg - buscar mensagens do número de teste
      if (moduleName === 'Msg' && typeof module.get === 'function') {
        console.log(`[TEST] Executando teste funcional de Mensagens...`);
        
        // Mostrar indicador visual de execução
        this.showExecutionIndicator(moduleName, 'Buscando mensagens...');
        
        try {
          let resultMsg = '';
          
          // Se tem número de teste, buscar mensagens desse número
          if (this.testNumber) {
            const testWid = `${this.testNumber}@c.us`;
            console.log(`[TEST] Buscando mensagens do número de teste: ${testWid}`);
            
            try {
              const messages = module.get(testWid);
              if (messages) {
                const messageCount = Array.isArray(messages) ? messages.length : 1;
                resultMsg = `📨 Encontradas ${messageCount} mensagem(ns) do número ${this.testNumber}`;
                console.log(`[TEST] Mensagens encontradas:`, messageCount);
              }
            } catch (error: any) {
              console.log(`[TEST] Erro ao buscar mensagens do número:`, error.message);
            }
          }
          
          // Contar total de mensagens na coleção
          if (module._models && Array.isArray(module._models)) {
            const totalMessages = module._models.length;
            const totalMsg = `📊 Total: ${totalMessages} mensagem(ns) na coleção`;
            resultMsg = resultMsg ? `${resultMsg}\n${totalMsg}` : totalMsg;
            console.log(`[TEST] Total de mensagens na coleção:`, totalMessages);
            
            // Mostrar exemplo de mensagem (primeira da coleção)
            if (module._models.length > 0) {
              const firstMsg = module._models[0];
              const preview = firstMsg.body ? firstMsg.body.substring(0, 50) : 'Sem conteúdo';
              resultMsg += `\n💬 Exemplo: "${preview}${preview.length >= 50 ? '...' : ''}"`;
            }
          }
          
          // Verificar se tem método .on() para eventos
          if (typeof module.on === 'function') {
            resultMsg += `\n👂 Pode escutar eventos de novas mensagens`;
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg || '✅ Módulo funcionando corretamente!';
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          console.log(`[TEST] Erro ao buscar mensagens:`, error.message);
          return `⚠️ Módulo encontrado mas erro ao buscar dados: ${error.message}`;
        }
      }
      
      // Teste para módulo Contact - buscar contato do número de teste
      if (moduleName === 'Contact' && typeof module.get === 'function') {
        this.showExecutionIndicator(moduleName, 'Buscando contatos...');
        
        try {
          let resultMsg = '';
          
          if (this.testNumber) {
            const testWid = `${this.testNumber}@c.us`;
            const contact = module.get(testWid);
            if (contact) {
              resultMsg = `👤 Contato encontrado: ${contact.name || contact.pushname || 'Sem nome'}`;
            }
          }
          
          if (module._models && Array.isArray(module._models)) {
            const totalContacts = module._models.length;
            resultMsg = resultMsg ? `${resultMsg}\n📊 Total: ${totalContacts} contato(s)` : `📊 Total: ${totalContacts} contato(s)`;
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg || '✅ Módulo funcionando corretamente!';
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo Label - buscar etiquetas
      if (moduleName === 'Label' && typeof module.get === 'function') {
        this.showExecutionIndicator(moduleName, 'Buscando etiquetas...');
        
        try {
          let resultMsg = '';
          let totalLabels = 0;

          // Buscar todas as etiquetas
          if (module._models && Array.isArray(module._models)) {
            totalLabels = module._models.length;
            resultMsg = `🏷️ Total: ${totalLabels} etiqueta(s) encontrada(s)`;
            
            if (totalLabels > 0) {
              // Listar nomes das etiquetas
              const labelNames = module._models
                .slice(0, 10) // Limitar a 10 para não ficar muito longo
                .map((label: any) => label.name || label.id || 'Sem nome')
                .filter((name: string) => name && name !== 'Sem nome');
              
              if (labelNames.length > 0) {
                resultMsg += `\n📋 Nomes: ${labelNames.join(', ')}`;
                if (totalLabels > 10) {
                  resultMsg += `\n... e mais ${totalLabels - 10} etiqueta(s)`;
                }
              }
            }
          } else {
            // Tentar buscar via método get se disponível
            try {
              const allLabels = module.all ? module.all() : null;
              if (allLabels && Array.isArray(allLabels) && allLabels.length > 0) {
                totalLabels = allLabels.length;
                resultMsg = `🏷️ Total: ${totalLabels} etiqueta(s) encontrada(s)`;
                const labelNames = allLabels
                  .slice(0, 10)
                  .map((label: any) => label.name || label.id || 'Sem nome')
                  .filter((name: string) => name && name !== 'Sem nome');
                if (labelNames.length > 0) {
                  resultMsg += `\n📋 Nomes: ${labelNames.join(', ')}`;
                }
              }
            } catch (e) {
              // Ignorar erro
            }
          }

          // Spike: Label → Chats (10 abordagens na primeira etiqueta)
          const labelsList: { id: string; name: string }[] = [];
          let winnerApproachName: string | null = null;
          if (totalLabels > 0) {
            const spikeResults = await this.runLabelToChatsSpike(module, this.interceptors.Chat);
            const successResults = spikeResults.filter(r => r.success);
            const winner = successResults.reduce((best, r) =>
              (r.chatIds.length >= (best?.chatIds?.length ?? 0) ? r : best), successResults[0] ?? null) as typeof spikeResults[0] | null;
            if (winner) winnerApproachName = winner.approach;
            if (spikeResults.length > 0) {
              resultMsg += '\n\n--- Label→Chats (spike) ---';
              spikeResults.forEach(r => {
                resultMsg += `\n${r.success ? '✓' : '✗'} ${r.approach}: ${r.success ? r.chatIds.length + ' chats' : (r.error || 'falhou')}`;
              });
              if (winner) resultMsg += `\n→ USE: ${winner.approach}`;
            }
            const rawLabels = (module._models && Array.isArray(module._models))
              ? module._models
              : (typeof module.all === 'function' ? module.all() : []) ?? [];
            rawLabels.forEach((l: any) => {
              if (l?.id != null) labelsList.push({ id: l.id, name: (l.name || l.id || 'Sem nome').toString() });
            });
          }

          // Lista completa por etiqueta (nome, quantidade, todos os números) — pronto para copiar
          if (labelsList.length > 0) {
            const Chat = this.interceptors.Chat;
            const winnerName = winnerApproachName ?? 'Chat.getModelsArray + labels';
            const chatArr = (Chat.getModelsArray && Chat.getModelsArray()) ?? (Array.isArray(Chat._models) ? Chat._models : []);
            const totalChatsInMemory = chatArr.length;
            resultMsg += '\n\n--- Lista completa (pronto para copiar) ---';
            resultMsg += `\n(Contagem baseada nos ${totalChatsInMemory} chats carregados nesta sessão. O "Items" do WhatsApp pode ser maior pois inclui todos os chats do servidor.)`;
            for (const label of labelsList) {
              const idsWinner = await this.getChatIdsForLabelByApproach(module, Chat, label.id, winnerName);
              const nums = idsWinner.map(id => this.formatChatIdForDisplay(id));
              const n = idsWinner.length;
              resultMsg += `\n\nEtiqueta: ${label.name} | ${n} contato${n !== 1 ? 's' : ''}`;
              if (nums.length > 0) {
                resultMsg += '\n' + nums.join('\n');
              }
            }
          }

          this.hideExecutionIndicator(moduleName);
          return resultMsg || '✅ Módulo funcionando corretamente!';
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo Chat - buscar chat do número de teste
      if (moduleName === 'Chat' && typeof module.get === 'function') {
        this.showExecutionIndicator(moduleName, 'Buscando conversas...');
        
        try {
          let resultMsg = '';
          
          // Contar total de conversas
          if (module._models && Array.isArray(module._models)) {
            const totalChats = module._models.length;
            resultMsg = `💬 Total: ${totalChats} conversa(s) na coleção`;
            
            // Se tem número de teste, buscar conversa específica
            if (this.testNumber) {
              const testWid = `${this.testNumber}@c.us`;
              try {
                const chat = module.get(testWid);
                if (chat) {
                  const chatName = chat.name || chat.formattedTitle || chat.pushname || 'Sem nome';
                  const unreadCount = chat.unreadCount || 0;
                  resultMsg += `\n📱 Conversa encontrada: "${chatName}"`;
                  if (unreadCount > 0) {
                    resultMsg += `\n🔔 ${unreadCount} mensagem(ns) não lida(s)`;
                  }
                } else {
                  resultMsg += `\n⚠️ Conversa do número ${this.testNumber} não encontrada`;
                }
              } catch (error: any) {
                console.log(`[TEST] Erro ao buscar conversa:`, error.message);
              }
            }
            
            // Mostrar exemplo de conversas (primeiras 3)
            if (module._models.length > 0) {
              const sampleChats = module._models.slice(0, 3);
              const chatNames = sampleChats
                .map((chat: any) => chat.name || chat.formattedTitle || chat.pushname || 'Sem nome')
                .filter((name: string) => name && name !== 'Sem nome');
              if (chatNames.length > 0) {
                resultMsg += `\n📋 Exemplos: ${chatNames.join(', ')}`;
              }
            }
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg || '✅ Módulo funcionando corretamente!';
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo ChatCollection - coleção alternativa de conversas
      if (moduleName === 'ChatCollection') {
        this.showExecutionIndicator(moduleName, 'Buscando coleção de conversas...');
        
        try {
          let resultMsg = '';
          const chatCollection = this.interceptors.ChatCollection;
          
          // Se ChatCollection não tiver dados, usar Chat como fallback
          const chatModule = this.interceptors.Chat;
          let chats: any[] = [];
          
          if (chatCollection) {
            // Tentar acessar como coleção (com _models ou similar)
            if (chatCollection._models && Array.isArray(chatCollection._models) && chatCollection._models.length > 0) {
              chats = chatCollection._models;
            } else if (typeof chatCollection.get === 'function') {
              // Tentar buscar via método get
              try {
                // Buscar todas as conversas via Chat module como referência
                if (chatModule && chatModule._models) {
                  chats = chatModule._models;
                }
              } catch (e) {
                // Ignorar
              }
            }
          }
          
          // Fallback: usar Chat module diretamente
          if (chats.length === 0 && chatModule && chatModule._models && Array.isArray(chatModule._models)) {
            chats = chatModule._models;
          }
          
          if (chats.length > 0) {
            const totalChats = chats.length;
            resultMsg = `💬 Total: ${totalChats} conversa(s) encontrada(s)`;
            
            // Mostrar exemplos detalhados
            const sampleChats = chats.slice(0, 5);
            const chatInfo = sampleChats
              .map((chat: any) => {
                const name = chat.name || chat.formattedTitle || chat.pushname || chat.id?.split('@')[0] || 'Sem nome';
                const unread = chat.unreadCount || 0;
                return unread > 0 ? `${name} (${unread} não lidas)` : name;
              })
              .filter((info: string) => info);
            
            if (chatInfo.length > 0) {
              resultMsg += `\n\n📋 Primeiras conversas:\n${chatInfo.slice(0, 5).map((name, idx) => `   ${idx + 1}. ${name}`).join('\n')}`;
              if (chats.length > 5) {
                resultMsg += `\n   ... e mais ${chats.length - 5} conversa(s)`;
              }
            }
          } else {
            resultMsg = '✅ Módulo ChatCollection encontrado\n⚠️ Nenhuma conversa encontrada no momento';
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg || '✅ Módulo funcionando corretamente!';
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo PresenceCollection - status online/offline
      // IMPLEMENTAÇÃO IGUAL À REFERÊNCIA: Escuta eventos reativos (reverse.txt linhas 782-809)
      if (moduleName === 'PresenceCollection') {
        this.showExecutionIndicator(moduleName, 'Escutando eventos de presença...');
        
        try {
          let resultMsg = '';
          const presenceCollection = this.interceptors.PresenceCollection;
          const chatModule = this.interceptors.Chat;
          
          if (!presenceCollection) {
            this.hideExecutionIndicator(moduleName);
            return '❌ Módulo PresenceCollection não encontrado';
          }
          
          // Verificar se tem método .on() (igual referência linha 782)
          if (typeof presenceCollection.on !== 'function') {
            this.hideExecutionIndicator(moduleName);
            return '❌ PresenceCollection não tem método .on()';
          }
          
          // Verificar se Chat.find() existe (igual referência linha 783)
          if (!chatModule || typeof chatModule.find !== 'function') {
            this.hideExecutionIndicator(moduleName);
            return '❌ Chat.find() não disponível';
          }
          
          // Estrutura de dados para acumular resultados (igual referência)
          const presenceResults = {
            online: new Map<string, { name: string, timestamp: number }>(),
            offline: new Map<string, { name: string, timestamp: number }>()
          };
          
            // Debug: Logar estrutura
            console.log('[TEST] PresenceCollection estrutura (eventos):', {
              hasOn: typeof presenceCollection.on === 'function',
              hasChatFind: typeof chatModule.find === 'function',
              presenceCollectionType: typeof presenceCollection
            });
            
            // Callback do evento (igual referência reverse.txt linha 782-809)
            const eventHandler = async (t: any, n: number) => {
              try {
                // Filtrar apenas usuários (igual referência linha 783: 1 == t.isUser)
                if (t.isUser !== 1) {
                  return; // Ignorar se não for usuário
                }
                
                // Extrair wid (igual referência linha 783: t.id._serialized)
                const wid = t.id?._serialized;
                if (!wid || typeof wid !== 'string') {
                  return;
                }
                
                // Buscar chat (igual referência linha 783: N.Chat.find(t.id._serialized).then(e => {)
                try {
                  const chat = await chatModule.find(wid);
                  if (!chat) {
                    return;
                  }
                  
                  // Obter nome (igual referência linha 788: e.__x_formattedTitle)
                  const name = chat.__x_formattedTitle || chat.formattedTitle || chat.name || wid.split('@')[0] || 'Contato';
                  
                  // Determinar status (igual referência linha 785: 1 == n significa online)
                  const isOnline = n === 1;
                  
                  // Adicionar ao Map correspondente
                  if (isOnline) {
                    presenceResults.online.set(wid, { name, timestamp: Date.now() });
                  } else {
                    presenceResults.offline.set(wid, { name, timestamp: Date.now() });
                  }
                  
                  console.log(`[TEST] Evento de presença: ${name} - ${isOnline ? 'Online' : 'Offline'}`);
                } catch (e) {
                  // Ignorar erros ao buscar chat
                  console.warn('[TEST] Erro ao buscar chat no evento de presença:', e);
                }
              } catch (e) {
                // Ignorar erros no handler
                console.warn('[TEST] Erro no eventHandler de presença:', e);
              }
            };
            
            // Configurar listener (igual referência linha 782)
            presenceCollection.on('change:isOnline', eventHandler);
            console.log('[TEST] Listener de eventos change:isOnline configurado');
            
            // IMPORTANTE: Subscrever presença para forçar eventos (padrão reverse.txt linha 1504)
            // Isso faz com que o WhatsApp comece a monitorar presença e disparar eventos
            const presenceModule = this.interceptors.Presence;
            if (presenceModule && typeof presenceModule.subscribePresence === 'function' && chatModule) {
              try {
                // Subscrever presença para contatos individuais (primeiros 100 para não sobrecarregar)
                if (chatModule._models && Array.isArray(chatModule._models)) {
                  let subscribedCount = 0;
                  const allChats = chatModule._models;
                  
                  for (const chat of allChats.slice(0, 100)) { // Limitar a 100 para não sobrecarregar
                    try {
                      // Extrair wid
                      let wid = '';
                      if (typeof chat.id === 'string') {
                        wid = chat.id;
                      } else if (chat.id?._serialized && typeof chat.id._serialized === 'string') {
                        wid = chat.id._serialized;
                      } else if (chat.id?.user && typeof chat.id.user === 'string') {
                        wid = `${chat.id.user}@${chat.id.server || 'c.us'}`;
                      }
                      
                      // Subscrever apenas contatos individuais (não grupos)
                      if (wid && typeof wid === 'string' && wid.includes('@c.us') && !wid.includes('@g.us') && !wid.includes('@lid')) {
                        try {
                          presenceModule.subscribePresence(chat.id || wid);
                          subscribedCount++;
                        } catch (e) {
                          // Ignorar erros individuais
                        }
                      }
                    } catch (e) {
                      // Ignorar
                    }
                  }
                  
                  console.log(`[TEST] Presença subscrevida para ${subscribedCount} contatos (forçando eventos)`);
                  
                  // Aguardar um pouco para eventos começarem a chegar
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              } catch (e) {
                console.warn('[TEST] Erro ao subscrever presença:', e);
              }
            }
            
            // Aguardar eventos (5 segundos para eventos chegarem)
            console.log('[TEST] Aguardando eventos de presença (5 segundos)...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Compilar resultados iniciais (após eventos)
            let onlineCount = presenceResults.online.size;
            let offlineCount = presenceResults.offline.size;
            let totalPresences = onlineCount + offlineCount;
            
            // FALLBACK: Se poucos eventos, tentar buscar estado atual via PresenceCollection.get()
            // Isso complementa os eventos reativos com busca proativa
            if (totalPresences < 10 && typeof presenceCollection.get === 'function' && chatModule?._models) {
              console.log('[TEST] Poucos eventos recebidos, tentando buscar estado atual...');
              
              try {
                const allChats = chatModule._models.slice(0, 50); // Limitar a 50 para não sobrecarregar
                
                for (const chat of allChats) {
                  try {
                    // Extrair wid
                    let wid = '';
                    if (typeof chat.id === 'string') {
                      wid = chat.id;
                    } else if (chat.id?._serialized && typeof chat.id._serialized === 'string') {
                      wid = chat.id._serialized;
                    } else if (chat.id?.user && typeof chat.id.user === 'string') {
                      wid = `${chat.id.user}@${chat.id.server || 'c.us'}`;
                    }
                    
                    // Pular grupos
                    if (!wid || (typeof wid === 'string' && (wid.includes('@g.us') || wid.includes('@lid')))) {
                      continue;
                    }
                    
                    // Tentar buscar presença atual
                    const presence = presenceCollection.get(wid);
                    if (presence && presence !== null && presence !== undefined) {
                      const name = chat.__x_formattedTitle || chat.formattedTitle || chat.name || wid.split('@')[0] || 'Contato';
                      const isOnline = presence.isOnline === true || 
                                      presence.type === 'available' ||
                                      presence.presence === 'available' ||
                                      (presence.lastSeen && typeof presence.lastSeen === 'number' && Date.now() - presence.lastSeen < 300000);
                      
                      // Adicionar se ainda não foi adicionado por evento
                      if (!presenceResults.online.has(wid) && !presenceResults.offline.has(wid)) {
                        if (isOnline) {
                          presenceResults.online.set(wid, { name, timestamp: Date.now() });
                        } else {
                          presenceResults.offline.set(wid, { name, timestamp: Date.now() });
                        }
                      }
                    }
                  } catch (e) {
                    // Ignorar erros individuais
                  }
                }
                
                console.log(`[TEST] Busca proativa adicionou ${presenceResults.online.size + presenceResults.offline.size - totalPresences} contatos`);
              } catch (e) {
                console.warn('[TEST] Erro na busca proativa de presença:', e);
              }
            }
            
            // Recompilar resultados finais (após fallback)
            onlineCount = presenceResults.online.size;
            offlineCount = presenceResults.offline.size;
            totalPresences = onlineCount + offlineCount;
            
            // Converter Maps para arrays para exibição
            const onlineContacts = Array.from(presenceResults.online.values()).slice(0, 10).map(p => p.name);
            const offlineContacts = Array.from(presenceResults.offline.values()).slice(0, 5).map(p => p.name);
            
            // Limpar listener (evitar vazamento de memória)
            try {
              if (typeof presenceCollection.off === 'function') {
                presenceCollection.off('change:isOnline', eventHandler);
              } else if (typeof presenceCollection.removeListener === 'function') {
                presenceCollection.removeListener('change:isOnline', eventHandler);
              }
              console.log('[TEST] Listener de presença removido');
            } catch (e) {
              console.warn('[TEST] Erro ao remover listener:', e);
            }
            
            // Montar mensagem de resultado
            if (totalPresences > 0) {
              resultMsg = `📊 Total de contatos verificados: ${totalPresences}`;
              resultMsg += `\n🟢 Online: ${onlineCount} contato(s)`;
              resultMsg += `\n⚫ Offline: ${offlineCount} contato(s)`;
              
              if (onlineContacts.length > 0) {
                resultMsg += `\n\n🟢 Online agora:\n${onlineContacts.map((name, idx) => `   ${idx + 1}. ${name}`).join('\n')}`;
                if (onlineCount > onlineContacts.length) {
                  resultMsg += `\n   ... e mais ${onlineCount - onlineContacts.length} online`;
                }
              } else {
                resultMsg += `\n\n⚠️ Nenhum contato online no momento`;
              }
              
              if (offlineContacts.length > 0) {
                resultMsg += `\n\n⚫ Offline:\n${offlineContacts.map((name, idx) => `   ${idx + 1}. ${name}`).join('\n')}`;
                if (offlineCount > offlineContacts.length) {
                  resultMsg += `\n   ... e mais ${offlineCount - offlineContacts.length} offline`;
                }
              }
            } else {
              resultMsg = '✅ Módulo de presença encontrado\n⚠️ Nenhum evento de presença recebido nos últimos 5 segundos\n\n💡 Dica: Eventos são reativos - aparecem quando há mudanças de status';
            }
            
            this.hideExecutionIndicator(moduleName);
            return resultMsg || '✅ Módulo funcionando corretamente!';
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo GroupMetadata - metadados de grupos
      if (moduleName === 'GroupMetadata') {
        this.showExecutionIndicator(moduleName, 'Buscando metadados de grupos...');
        
        try {
          let resultMsg = '';
          const groupMetadata = this.interceptors.GroupMetadata;
          
          if (groupMetadata) {
            // Buscar grupos via Chat module
            const chatModule = this.interceptors.Chat;
            let groups: any[] = [];
            
            // Debug: Logar estrutura do Chat module
            console.log('[TEST] Chat module estrutura:', {
              hasModels: !!chatModule?._models,
              modelsCount: chatModule?._models?.length || 0,
              hasGet: typeof chatModule?.get === 'function',
              sampleChatIds: chatModule?._models?.slice(0, 5).map((c: any) => ({
                id: c.id,
                idSerialized: c.id?._serialized,
                name: c.name || c.formattedTitle,
                isGroup: c.isGroup,
                type: c.type,
                hasParticipants: !!c.participants,
                hasGroupMetadata: !!c.groupMetadata
              })) || []
            });
            
            if (chatModule && chatModule._models && Array.isArray(chatModule._models)) {
              // Buscar TODOS os chats primeiro
              const allChats = chatModule._models;
              
              // Filtro 1: Grupos explícitos (mais confiável) - verificar ID serializado também
              groups = allChats.filter((chat: any) => {
                try {
                  const chatId = chat.id || chat._id || '';
                  const chatIdSerialized = chat.id?._serialized || chat._serialized || '';
                  const fullChatId = chatIdSerialized || chatId;
                  
                  if (!fullChatId || typeof fullChatId !== 'string') return false;
                  
                  // Verificar múltiplas formas de identificar grupos
                  const isGroup = chat.isGroup === true || 
                                 chat.type === 'group' ||
                                 chat.kind === 'group' ||
                                 chat.isGroupChat === true ||
                                 fullChatId.endsWith('@g.us') ||
                                 (fullChatId.includes('@') && fullChatId.split('@')[1] === 'g.us') ||
                                 chatId.includes('g.us') ||
                                 chatIdSerialized.includes('g.us');
                  
                  return isGroup;
                } catch (e) {
                  return false;
                }
              });
              
              // Filtro 2: Se não encontrou grupos explícitos, buscar por características
              if (groups.length === 0) {
                groups = allChats.filter((chat: any) => {
                  try {
                    const chatId = chat.id || chat._id || '';
                    const chatIdSerialized = chat.id?._serialized || chat._serialized || '';
                    const fullChatId = chatIdSerialized || chatId;
                    
                    if (!fullChatId || typeof fullChatId !== 'string') return false;
                    
                    // Verificar se tem participantes (indicativo forte de grupo)
                    const participants = chat.participants || chat.groupMetadata?.participants;
                    const hasParticipants = participants && 
                                          (Array.isArray(participants) ? participants.length > 0 : 
                                           typeof participants === 'object' ? Object.keys(participants).length > 0 : false);
                    
                    // Verificar se tem groupMetadata
                    const hasGroupMetadata = chat.groupMetadata !== undefined && chat.groupMetadata !== null;
                    
                    // Verificar se ID contém g.us (em qualquer formato)
                    const hasGroupId = fullChatId.includes('g.us') || chatId.includes('g.us') || chatIdSerialized.includes('g.us');
                    
                    // Verificar se tem propriedades específicas de grupo
                    const hasGroupProps = chat.groupDesc !== undefined || 
                                        chat.groupSubject !== undefined ||
                                        chat.groupInviteLink !== undefined ||
                                        chat.groupRestrict !== undefined ||
                                        chat.groupDescId !== undefined ||
                                        chat.groupInvite !== undefined;
                    
                    // Se tem ID de grupo OU (participantes E metadata) OU propriedades de grupo
                    return hasGroupId || (hasParticipants && hasGroupMetadata) || (hasGroupId && hasGroupProps);
                  } catch (e) {
                    return false;
                  }
                });
              }
              
              // Filtro 3: Se ainda não encontrou, verificar TODOS os chats com @g.us no ID (qualquer formato)
              if (groups.length === 0) {
                groups = allChats.filter((chat: any) => {
                  try {
                    const chatId = chat.id || chat._id || '';
                    const chatIdSerialized = chat.id?._serialized || chat._serialized || '';
                    const fullChatId = chatIdSerialized || chatId;
                    return fullChatId && typeof fullChatId === 'string' && fullChatId.includes('g.us');
                  } catch (e) {
                    return false;
                  }
                });
              }
              
              // Filtro 4: Buscar no DOM também (grupos visíveis na interface)
              if (groups.length === 0) {
                try {
                  // Buscar elementos de grupos no DOM
                  const groupElements = Array.from(document.querySelectorAll('[data-testid="cell-frame-container"], [role="listitem"]'));
                  const groupNamesFromDOM: string[] = [];
                  
                  for (const element of groupElements) {
                    const text = element.textContent || '';
                    const title = element.getAttribute('title') || '';
                    
                    // Verificar se tem indicadores de grupo (ícone de grupo, múltiplos participantes, etc.)
                    const hasGroupIcon = element.querySelector('[data-icon="group"], [data-icon="default-group"]');
                    const hasMultipleAvatars = element.querySelectorAll('[data-testid="avatar"], img[alt*="group"]').length > 1;
                    
                    if (hasGroupIcon || hasMultipleAvatars) {
                      const groupName = title || text.split('\n')[0] || '';
                      if (groupName && !groupNamesFromDOM.includes(groupName)) {
                        groupNamesFromDOM.push(groupName);
                        
                        // Tentar encontrar o chat correspondente no modelo
                        const matchingChat = allChats.find((c: any) => {
                          const name = c.name || c.formattedTitle || c.subject || '';
                          return name && (name.includes(groupName) || groupName.includes(name));
                        });
                        
                        if (matchingChat && !groups.includes(matchingChat)) {
                          groups.push(matchingChat);
                        }
                      }
                    }
                  }
                } catch (e) {
                  // Ignorar erros de DOM
                }
              }
            }
            
            // Se ainda não encontrou grupos, tentar buscar via métodos do GroupMetadata
            if (groups.length === 0 && groupMetadata.default) {
              try {
                if (chatModule && chatModule._models) {
                  // Verificar TODOS os chats que têm @ no ID
                  const allChatsWithId = chatModule._models.filter((chat: any) => {
                    try {
                      const chatId = chat.id || chat._id || '';
                      return chatId && typeof chatId === 'string' && chatId.includes('@');
                    } catch (e) {
                      return false;
                    }
                  });
                  
                  // Verificar se tem participantes OU ID de grupo OU metadata
                  groups = allChatsWithId.filter((chat: any) => {
                    const chatId = chat.id || '';
                    const hasParticipants = chat.participants && 
                                          (Array.isArray(chat.participants) ? chat.participants.length > 0 : 
                                           typeof chat.participants === 'object' ? Object.keys(chat.participants).length > 0 : false);
                    return hasParticipants || 
                           (chatId.includes('g.us')) ||
                           (chat.groupMetadata !== undefined && chat.groupMetadata !== null);
                  });
                }
              } catch (e) {
                // Ignorar
              }
            }
            
            if (groups.length > 0) {
              resultMsg = `👥 Total: ${groups.length} grupo(s) encontrado(s)\n\n`;
              
              // Mostrar exemplos detalhados dos metadados
              const exampleGroups = groups.slice(0, 5);
              
              exampleGroups.forEach((group: any, idx: number) => {
                const groupInfo: string[] = [];
                
                // Nome do grupo
                const name = group.name || group.formattedTitle || group.subject || group.id?.split('@')[0] || 'Sem nome';
                groupInfo.push(`📋 ${name}`);
                
                // ID do grupo
                if (group.id) {
                  groupInfo.push(`ID: ${group.id}`);
                }
                
                // Número de participantes
                if (group.participants) {
                  const participantCount = Array.isArray(group.participants) ? group.participants.length : 0;
                  groupInfo.push(`👥 ${participantCount} participante(s)`);
                } else if (group.groupMetadata) {
                  const meta = group.groupMetadata;
                  if (meta.participants && Array.isArray(meta.participants)) {
                    groupInfo.push(`👥 ${meta.participants.length} participante(s)`);
                  }
                }
                
                // Descrição
                if (group.description) {
                  const desc = group.description.length > 30 ? group.description.substring(0, 30) + '...' : group.description;
                  groupInfo.push(`📝 "${desc}"`);
                }
                
                // Data de criação (se disponível)
                if (group.creation) {
                  const creation = new Date(group.creation * 1000);
                  groupInfo.push(`📅 Criado em: ${creation.toLocaleDateString()}`);
                }
                
                // Dono/Admin
                if (group.groupMetadata?.owner) {
                  groupInfo.push(`👑 Dono: ${group.groupMetadata.owner}`);
                } else if (group.owner) {
                  groupInfo.push(`👑 Dono: ${group.owner}`);
                }
                
                // Restrição (quem pode enviar mensagem)
                if (group.restrict !== undefined) {
                  groupInfo.push(`🔒 Restrito: ${group.restrict ? 'Sim' : 'Não'}`);
                }
                
                // Ephemeral (mensagens temporárias)
                if (group.ephemeralDuration) {
                  groupInfo.push(`⏱️ Temporárias: ${group.ephemeralDuration}s`);
                }
                
                resultMsg += groupInfo.join(' | ') + '\n';
                
                // Mostrar alguns participantes se disponível
                if (group.participants && Array.isArray(group.participants) && group.participants.length > 0) {
                  const sampleParticipants = group.participants.slice(0, 3)
                    .map((p: any) => p.id?.split('@')[0] || p.name || 'Participante')
                    .filter((name: string) => name);
                  if (sampleParticipants.length > 0) {
                    resultMsg += `   👤 Participantes: ${sampleParticipants.join(', ')}`;
                    if (group.participants.length > 3) {
                      resultMsg += ` (+${group.participants.length - 3})`;
                    }
                    resultMsg += '\n';
                  }
                }
                
                if (idx < exampleGroups.length - 1) {
                  resultMsg += '\n';
                }
              });
              
              if (groups.length > 5) {
                resultMsg += `\n... e mais ${groups.length - 5} grupo(s)`;
              }
            } else {
              // Se não encontrou grupos, mostrar métodos disponíveis
              if (groupMetadata.default) {
                const defaultObj = groupMetadata.default;
                const groupProps = ['getGroupMetadataFromGroupInvite', 'getGroupInfoFromInvite', 'getGroupMetadata'];
                const foundProps = groupProps.filter(prop => typeof defaultObj[prop] === 'function');
                if (foundProps.length > 0) {
                  resultMsg = `✅ Métodos de grupos disponíveis:\n📦 ${foundProps.join(', ')}\n\n`;
                  resultMsg += '⚠️ Nenhum grupo encontrado nas conversas ativas';
                } else {
                  resultMsg = '✅ Módulo GroupMetadata encontrado\n⚠️ Nenhum grupo encontrado';
                }
              } else {
                resultMsg = '✅ Módulo GroupMetadata encontrado\n⚠️ Nenhum grupo encontrado';
              }
            }
          } else {
            resultMsg = '❌ Módulo GroupMetadata não encontrado';
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg.trim();
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo User - informações do usuário atual
      if (moduleName === 'User') {
        this.showExecutionIndicator(moduleName, 'Buscando informações do usuário...');
        
        try {
          let resultMsg = '';
          let userData: any = null;
          
          // Tentar múltiplas formas de acessar o usuário
          try {
            // O módulo User retorna getMaybeMePnUser ou getMaybeMeLidUser (funções getter)
            const userGetter = this.interceptors.User;
            
            // Se é função, chamar diretamente para obter dados do usuário
            if (typeof userGetter === 'function') {
              try {
                userData = userGetter();
                // Se retornou null/undefined, tentar outra função
                if (!userData) {
                  // Tentar getMaybeMeLidUser se getMaybeMePnUser retornou null
                  const interceptorsAny = this.interceptors as any;
                  if (interceptorsAny.getMaybeMeLidUser && typeof interceptorsAny.getMaybeMeLidUser === 'function') {
                    userData = interceptorsAny.getMaybeMeLidUser();
                  }
                }
              } catch (e) {
                console.log('[TEST] Erro ao chamar userGetter:', e);
              }
            }
            
            // Se ainda não tem dados, tentar acessar via objeto User que pode ter métodos
            if (!userData && userGetter && typeof userGetter === 'object') {
              // Tentar funções comuns de getter de usuário
              const getterFunctions = [
                'getMaybeMePnUser',
                'getMaybeMeLidUser',
                'getMePnUserOrThrow',
                'getMeLidUserOrThrow',
                'getMeDisplayNameOrThrow',
                'getMe',
                'getMeUser',
                'getCurrentUser'
              ];
              
              for (const funcName of getterFunctions) {
                try {
                  if (typeof userGetter[funcName] === 'function') {
                    const result = userGetter[funcName]();
                    if (result && typeof result === 'object' && result !== null) {
                      userData = result;
                      break;
                    }
                  }
                } catch (e) {
                  // Continuar tentando outras funções
                }
              }
            }
          } catch (e) {
            console.log('[TEST] Erro ao acessar User:', e);
          }
          
          // Tentar acessar via window.N como fallback
          if (!userData) {
            try {
              const N = (window as any).N;
              if (N) {
                // Tentar N.User diretamente
                if (N.User && typeof N.User === 'function') {
                  userData = N.User();
                } else if (N.User && typeof N.User === 'object') {
                  // Tentar getters do N.User
                  const getters = ['getMaybeMePnUser', 'getMaybeMeLidUser', 'getMePnUserOrThrow'];
                  for (const getter of getters) {
                    try {
                      if (typeof N.User[getter] === 'function') {
                        const result = N.User[getter]();
                        if (result && result !== null) {
                          userData = result;
                          break;
                        }
                      }
                    } catch (e2) {
                      // Continuar
                    }
                  }
                }
              }
            } catch (e2) {
              // Ignorar
            }
          }
          
          // Tentar via Contact module (usuário atual pode estar lá)
          if (!userData) {
            try {
              const contactModule = this.interceptors.Contact;
              if (contactModule && contactModule._models) {
                // Buscar contato que pode ser o usuário atual
                const meContact = contactModule._models.find((c: any) => 
                  c.isMe === true || 
                  c.isMyContact === true ||
                  c.isMyNumber === true ||
                  (c.id && c.id.includes('@c.us') && c.isContactSyncCompleted === 1)
                );
                if (meContact) {
                  userData = meContact;
                }
              }
            } catch (e) {
              // Ignorar
            }
          }
          
          if (userData && typeof userData === 'object') {
            const userInfo: string[] = [];
            
            // ID do usuário
            const wid = userData.wid || userData.id || userData._serialized || '';
            if (wid) {
              userInfo.push(`📱 ID: ${wid}`);
            }
            
            // Nome - tentar múltiplas propriedades
            let name = userData.name || 
                      userData.pushname || 
                      userData.notifyName || 
                      userData.formattedName ||
                      userData.displayName ||
                      userData.shortName ||
                      userData.fullName ||
                      '';
            
            // Se não encontrou nome direto, tentar via Contact usando o ID
            if (!name && wid) {
              try {
                const contactModule = this.interceptors.Contact;
                if (contactModule && typeof contactModule.get === 'function') {
                  const contact = contactModule.get(wid);
                  if (contact) {
                    name = contact.name || 
                           contact.pushname || 
                           contact.notifyName || 
                           contact.formattedName ||
                           contact.displayName ||
                           contact.shortName ||
                           '';
                  }
                }
              } catch (e) {
                // Ignorar
              }
            }
            
            // Tentar via getMeDisplayNameOrThrow se disponível
            if (!name) {
              try {
                const interceptorsAny = this.interceptors as any;
                if (interceptorsAny.getMeDisplayNameOrThrow && typeof interceptorsAny.getMeDisplayNameOrThrow === 'function') {
                  name = interceptorsAny.getMeDisplayNameOrThrow();
                }
              } catch (e) {
                // Ignorar
              }
            }
            
            if (name) {
              userInfo.push(`👤 Nome: ${name}`);
            }
            
            // Telefone
            const phone = userData.phoneNumber || userData.number || (wid ? wid.split('@')[0] : '');
            if (phone) {
              userInfo.push(`📞 Telefone: ${phone}`);
            }
            
            // Business
            if (userData.isBusiness !== undefined) {
              userInfo.push(`💼 Business: ${userData.isBusiness ? 'Sim' : 'Não'}`);
            }
            
            // Enterprise
            if (userData.isEnterprise !== undefined) {
              userInfo.push(`🏢 Enterprise: ${userData.isEnterprise ? 'Sim' : 'Não'}`);
            }
            
            // Verificado
            if (userData.verifiedName !== undefined) {
              userInfo.push(`✅ Verificado: ${userData.verifiedName || 'Não'}`);
            }
            
            if (userInfo.length > 0) {
              resultMsg = userInfo.join('\n');
            } else {
              // Mostrar propriedades disponíveis
              try {
                const keys = Object.keys(userData).slice(0, 15);
                resultMsg = `✅ Usuário encontrado\n📋 Propriedades disponíveis: ${keys.join(', ')}`;
              } catch (e) {
                resultMsg = '✅ Usuário encontrado (sem dados acessíveis)';
              }
            }
          } else {
            resultMsg = '✅ Módulo User encontrado\n⚠️ Dados do usuário não acessíveis';
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg || '✅ Módulo funcionando corretamente!';
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo sendTextMsgToChat - enviar mensagem de texto
      // IMPLEMENTAÇÃO IGUAL À REFERÊNCIA: seguindo padrão de addAndSendMsgToChat
      if (moduleName === 'sendTextMsgToChat') {
        this.showExecutionIndicator(moduleName, 'Enviando mensagem de texto...');
        
        try {
          let resultMsg = '';
          
          if (!this.testNumber) {
            this.hideExecutionIndicator(moduleName);
            return '⚠️ Configure um número de teste primeiro';
          }
          
          const sendTextMsg = this.interceptors.sendTextMsgToChat;
          
          if (!sendTextMsg || typeof sendTextMsg !== 'function') {
            this.hideExecutionIndicator(moduleName);
            return '❌ Função sendTextMsgToChat não encontrada';
          }
          
          // ============================================================
          // NORMALIZAR NÚMERO DE TESTE (com código do país se necessário)
          // ============================================================
          console.log('[TEST] ========== NORMALIZAÇÃO DO NÚMERO (sendTextMsg) ==========');
          
          // Obter número do usuário atual para comparar
          let currentUserWid: string | null = null;
          const userModule = this.interceptors.User;
          if (userModule) {
            try {
              let currentUser: any = null;
              if (typeof userModule === 'function') {
                currentUser = userModule();
              } else if (typeof userModule.getMaybeMePnUser === 'function') {
                currentUser = userModule.getMaybeMePnUser();
              } else if (typeof userModule.getMaybeMeLidUser === 'function') {
                currentUser = userModule.getMaybeMeLidUser();
              }
              
              if (currentUser) {
                currentUserWid = currentUser.id?._serialized || 
                                currentUser._serialized || 
                                (currentUser.user ? `${currentUser.user}@${currentUser.server || 'c.us'}` : null);
                console.log('[TEST] ✅ Número do usuário atual obtido (sendTextMsg):', currentUserWid);
              }
            } catch (e: any) {
              console.warn('[TEST] ⚠️ Erro ao obter número do usuário atual (sendTextMsg):', e.message);
            }
          }
          
          // Preparar múltiplos formatos do número de teste
          const testWid1 = `${this.testNumber}@c.us`;
          const testWid2 = `55${this.testNumber}@c.us`;
          let testWid3: string | null = null;
          if (currentUserWid) {
            const match = currentUserWid.match(/^(\d{2})(\d+)/);
            if (match) {
              const countryCode = match[1];
              if (!this.testNumber.startsWith(countryCode)) {
                testWid3 = `${countryCode}${this.testNumber}@c.us`;
                console.log('[TEST] ✅ Formato 3 criado com código do país do usuário (sendTextMsg):', testWid3);
              }
            }
          }
          
          const testWidsToTry = [testWid1, testWid2, testWid3].filter(Boolean) as string[];
          console.log('[TEST] 📋 Formatos de WID para tentar (sendTextMsg):', testWidsToTry);
          
          // Verificar se algum formato corresponde ao número do usuário atual
          const isSendingToSelf = currentUserWid && testWidsToTry.some(wid => {
            const normalizedWid = wid.replace('@c.us', '');
            const normalizedCurrent = currentUserWid.replace('@c.us', '').replace('@lid', '');
            return normalizedWid === normalizedCurrent || 
                   normalizedWid.endsWith(normalizedCurrent) || 
                   normalizedCurrent.endsWith(normalizedWid);
          });
          
          if (isSendingToSelf) {
            console.log('[TEST] ✅ Detectado: Enviando mensagem para si mesmo! (sendTextMsg)');
          }
          
          const testMessage = `Teste Mettri Texto - ${new Date().toLocaleTimeString()}`;
          
          try {
            // ============================================================
            // OBTER CHAT (igual referência linha 1278, 1533)
            // ============================================================
            console.log('[TEST] ========== INÍCIO OBTER CHAT (sendTextMsg) ==========');
            console.log('[TEST] 📋 Parâmetros:', {
              testNumber: this.testNumber,
              testWidsToTry: testWidsToTry,
              currentUserWid: currentUserWid,
              isSendingToSelf: isSendingToSelf
            });
            
            // ESTRATÉGIA DA REFERÊNCIA: Abrir chat primeiro usando Cmd.openChatAt() (linha 1513)
            // Tentar com todos os formatos do número
            console.log('[TEST] [OBTER CHAT] Tentando abrir chat via Cmd.openChatAt() (sendTextMsg)...');
            const cmdModule = this.interceptors.Cmd;
            if (cmdModule && typeof cmdModule.openChatAt === 'function') {
              const chatModule = this.interceptors.Chat;
              if (chatModule && typeof chatModule.get === 'function') {
                // Tentar abrir com cada formato
                for (const testWid of testWidsToTry) {
                  try {
                    const basicChat = chatModule.get(testWid);
                    if (basicChat) {
                      console.log('[TEST] [OBTER CHAT] Chat básico obtido para abrir com formato (sendTextMsg):', testWid);
                      cmdModule.openChatAt(basicChat);
                      console.log('[TEST] [OBTER CHAT] ✅ Chat aberto via Cmd.openChatAt() (sendTextMsg)');
                      await new Promise(resolve => setTimeout(resolve, 500));
                      break;
                    }
                  } catch (e: any) {
                    console.warn('[TEST] [OBTER CHAT] Erro ao tentar abrir chat com formato (sendTextMsg)', testWid, ':', e.message);
                  }
                }
              }
            }
            
            // OBTER CHAT (igual referência linha 1278, 1533: N.Chat.get(e) || await N.Chat.find(N.WidFactory.createWid(e)))
            const chatModule = this.interceptors.Chat;
            let chat: any = null;
            
            if (!chatModule) {
              throw new Error('Módulo Chat não encontrado');
            }
            
            // Estratégia 1: Se enviando para si mesmo, usar chat ativo
            if (isSendingToSelf && typeof chatModule.getActive === 'function') {
              try {
                const activeChat = chatModule.getActive();
                if (activeChat && activeChat.id) {
                  const activeChatId = activeChat.id._serialized || 
                                      (typeof activeChat.id === 'string' ? activeChat.id : activeChat.id.toString());
                  const activeChatMatches = testWidsToTry.some(wid => {
                    const normalizedWid = wid.replace('@c.us', '');
                    const normalizedActive = activeChatId.replace('@c.us', '').replace('@lid', '');
                    return normalizedWid === normalizedActive || 
                           normalizedWid.endsWith(normalizedActive) || 
                           normalizedActive.endsWith(normalizedWid);
                  });
                  if (activeChatMatches) {
                    chat = activeChat;
                    console.log('[TEST] [OBTER CHAT] ✅ Chat ativo corresponde (sendTextMsg)!');
                  }
                }
              } catch (e: any) {
                console.error('[TEST] [OBTER CHAT] ERRO ao usar Chat.getActive() (sendTextMsg):', e.message);
              }
            }
            
            // Estratégia 2: Tentar Chat.get() com todos os formatos
            if (!chat && typeof chatModule.get === 'function') {
              for (const testWid of testWidsToTry) {
                try {
                  const foundChat = chatModule.get(testWid);
                  if (foundChat) {
                    chat = foundChat;
                    console.log('[TEST] [OBTER CHAT] ✅ Chat.get() encontrou (sendTextMsg) com formato:', testWid);
                    break;
                  }
                } catch (e: any) {
                  console.warn('[TEST] [OBTER CHAT] Erro ao tentar Chat.get() (sendTextMsg) com formato', testWid, ':', e.message);
                }
              }
            }
            
            // Estratégia 3: Tentar Chat.find() com todos os formatos
            if (!chat && typeof chatModule.find === 'function') {
              const widFactory = this.interceptors.WidFactory;
              for (const testWid of testWidsToTry) {
                try {
                  let widToFind: any = testWid;
                  if (widFactory) {
                    try {
                      if (typeof widFactory === 'function') {
                        widToFind = widFactory(testWid);
                      } else if (typeof widFactory.createWid === 'function') {
                        widToFind = widFactory.createWid(testWid);
                      }
                      if (!widToFind || (typeof widToFind === 'string' && widToFind === testWid)) {
                        widToFind = testWid;
                      }
                    } catch (e) {
                      widToFind = testWid;
                    }
                  }
                  const foundChat = await Promise.resolve(chatModule.find(widToFind)).catch(() => null);
                  if (foundChat) {
                    chat = foundChat;
                    console.log('[TEST] [OBTER CHAT] ✅ Chat.find() encontrou (sendTextMsg) com formato:', testWid);
                    break;
                  }
                } catch (e: any) {
                  console.warn('[TEST] [OBTER CHAT] Erro ao tentar Chat.find() (sendTextMsg) com formato', testWid, ':', e.message);
                }
              }
            }
            
            // VALIDAÇÃO CRÍTICA: Verificar se chat tem propriedades necessárias
            // O erro "enqueue" acontece quando o chat não tem todas as propriedades internas
            if (!chat) {
              // Estratégia 4: Se ainda não encontrou, tentar abrir chat com WID e aguardar
              console.warn('[TEST] [OBTER CHAT] ⚠️ Chat não encontrado via get() nem find() (sendTextMsg)');
              console.log('[TEST] [OBTER CHAT] Tentando estratégia alternativa: abrir chat e aguardar...');
              
              const widFactory = this.interceptors.WidFactory;
              if (widFactory && cmdModule && typeof cmdModule.openChatAt === 'function') {
                for (const testWid of testWidsToTry) {
                  try {
                    let widObj: any = null;
                    if (typeof widFactory === 'function') {
                      widObj = widFactory(testWid);
                    } else if (typeof widFactory.createWid === 'function') {
                      widObj = widFactory.createWid(testWid);
                    }
                    
                    if (widObj && widObj.user) {
                      try {
                        const tempChatForOpen = { id: widObj };
                        cmdModule.openChatAt(tempChatForOpen);
                        console.log('[TEST] [OBTER CHAT] Chat aberto via Cmd.openChatAt() com WID objeto (sendTextMsg):', testWid);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        chat = chatModule.get(testWid);
                        if (!chat && typeof chatModule.find === 'function') {
                          chat = await Promise.resolve(chatModule.find(widObj)).catch(() => null);
                        }
                        
                        if (chat) {
                          console.log('[TEST] [OBTER CHAT] ✅ Chat encontrado após abrir e aguardar (sendTextMsg)!');
                          break;
                        }
                      } catch (e: any) {
                        console.error('[TEST] [OBTER CHAT] ERRO ao abrir chat (sendTextMsg):', e.message);
                      }
                    }
                  } catch (e: any) {
                    console.error('[TEST] [OBTER CHAT] ERRO ao criar WID (sendTextMsg):', e.message);
                  }
                }
              }
              
              // Se ainda não encontrou, lançar erro explicativo
              if (!chat) {
                const errorMsg = `Chat não encontrado para ${this.testNumber}. O chat precisa existir no WhatsApp (ter pelo menos uma mensagem trocada) ou estar na lista de conversas. Tente:\n1. Abrir a conversa manualmente no WhatsApp primeiro\n2. Enviar uma mensagem manualmente para criar o chat\n3. Verificar se o número está correto (formato: 3499277591 sem espaços ou caracteres especiais)`;
                console.error('[TEST] [OBTER CHAT] ❌', errorMsg);
                throw new Error(errorMsg);
              }
            }
            
            // VALIDAÇÃO CRÍTICA: Verificar se chat tem propriedades necessárias
            if (chat) {
              const hasRequiredProps = chat.id && 
                                     (typeof chat.id.isGroup === 'function' || typeof chat.id.isLid === 'function') &&
                                     chat.id.user;
              
              if (!hasRequiredProps) {
                console.error('[TEST] [OBTER CHAT] ❌ Chat não tem propriedades necessárias (sendTextMsg):', {
                  hasId: !!chat.id,
                  idType: typeof chat.id,
                  idUser: chat.id?.user,
                  idIsGroup: typeof chat.id?.isGroup,
                  idIsLid: typeof chat.id?.isLid
                });
                throw new Error(`Chat obtido não tem estrutura válida. O chat precisa ser um objeto completo do WhatsApp, não um objeto mínimo. Tente abrir a conversa manualmente no WhatsApp primeiro.`);
              }
              
              console.log('[TEST] [OBTER CHAT] ✅ Chat validado com propriedades necessárias (sendTextMsg)');
            }
            
            // ENVIAR MENSAGEM usando mesma lógica de addAndSendMsgToChat (função Tt)
            // sendTextMsgToChat pode ser um wrapper, mas vamos usar addAndSendMsgToChat para garantir
            const addAndSendMsg = this.interceptors.addAndSendMsgToChat;
            
            // Declarar sendResult no escopo correto (igual addAndSendMsgToChat linha 3172)
            let sendResult: any = null;
            
            if (!addAndSendMsg || typeof addAndSendMsg !== 'function') {
              // Fallback: tentar sendTextMsgToChat diretamente
              try {
                if (chat && chat.id) {
                  sendResult = await Promise.resolve(sendTextMsg(chat, testMessage));
                } else {
                  // Tentar com primeiro formato disponível
                  const firstWid = testWidsToTry[0] || `${this.testNumber}@c.us`;
                  sendResult = await Promise.resolve(sendTextMsg(firstWid, testMessage));
                }
              } catch (e: any) {
                throw new Error(`sendTextMsgToChat não disponível e addAndSendMsgToChat também não: ${e.message}`);
              }
            } else {
              // Usar mesma lógica de addAndSendMsgToChat (função Tt)
              // Passo 1: Obter usuário atual
              const userModule = this.interceptors.User;
              let currentUser: any = null;
              
              if (userModule) {
                try {
                  if (typeof userModule === 'function') {
                    currentUser = userModule();
                  } else if (typeof userModule.getMaybeMePnUser === 'function') {
                    currentUser = userModule.getMaybeMePnUser();
                  } else if (typeof userModule.getMaybeMeLidUser === 'function') {
                    currentUser = userModule.getMaybeMeLidUser();
                  }
                } catch (e) {
                  console.log('[TEST] Erro ao obter usuário atual (sendTextMsg):', e);
                }
              }
              
              if (!currentUser) {
                throw new Error('Não foi possível obter usuário atual');
              }
              
              // Passo 2: Criar novo ID de mensagem
              const msgKeyModule = this.interceptors.MsgKey;
              if (!msgKeyModule || typeof msgKeyModule.newId !== 'function') {
                throw new Error('MsgKey.newId() não disponível');
              }
              
              const newMsgId = await Promise.resolve(msgKeyModule.newId());
              
              // Passo 3: Criar objeto MsgKey como CLASSE (igual addAndSendMsgToChat e WA Web Plus)
              // IMPORTANTE: WA Web Plus usa "new N.MsgKey({...})" - precisa ser classe, não objeto simples
              console.log('[TEST] [PASSO 3] Criando objeto MsgKey completo (new N.MsgKey({...}))...');
              console.log('[TEST] [PASSO 3] Verificando se chat.id é grupo...');
              const isGroup = chat.id && typeof chat.id.isGroup === 'function' ? chat.id.isGroup() : false;
              console.log('[TEST] [PASSO 3] É grupo?', isGroup);
              
              // IMPORTANTE: Referência usa "new N.MsgKey({...})" - MsgKey é uma classe construtora
              // Verificar se msgKeyModule É a classe ou tem a classe
              let msgKeyObj: any = null;
              
              try {
                // Preparar dados do MsgKey (igual referência linha 591-597)
                const msgKeyData = {
                  from: currentUser,
                  to: chat.id,
                  id: newMsgId,
                  participant: isGroup ? currentUser : undefined,
                  selfDir: 'out'
                };
                
                console.log('[TEST] [PASSO 3] Dados do MsgKey:', {
                  from: msgKeyData.from ? 'Existe' : 'NULL',
                  to: msgKeyData.to ? (msgKeyData.to.user || msgKeyData.to._serialized || 'Objeto WID') : 'NULL',
                  id: msgKeyData.id,
                  participant: msgKeyData.participant ? 'Existe' : 'undefined',
                  selfDir: msgKeyData.selfDir
                });
                
                // Tentar instanciar como classe (igual referência: new N.MsgKey({...}))
                // MsgKey pode ser a classe diretamente ou estar em msgKeyModule.default
                let MsgKeyClass: any = null;
                
                // Estratégia 1: msgKeyModule é a classe diretamente
                if (typeof msgKeyModule === 'function' && msgKeyModule.prototype) {
                  MsgKeyClass = msgKeyModule;
                  console.log('[TEST] [PASSO 3] MsgKey é classe diretamente');
                }
                // Estratégia 2: msgKeyModule tem .default que é a classe
                else if (msgKeyModule?.default && typeof msgKeyModule.default === 'function' && msgKeyModule.default.prototype) {
                  MsgKeyClass = msgKeyModule.default;
                  console.log('[TEST] [PASSO 3] MsgKey está em .default');
                }
                // Estratégia 3: msgKeyModule tem constructor
                else if (msgKeyModule?.constructor && typeof msgKeyModule.constructor === 'function' && msgKeyModule.constructor !== Object) {
                  MsgKeyClass = msgKeyModule.constructor;
                  console.log('[TEST] [PASSO 3] MsgKey tem constructor');
                }
                // Estratégia 4: Tentar encontrar MsgKey no N (se disponível) - igual referência usa N.MsgKey
                else if ((window as any).N?.MsgKey) {
                  const nMsgKey = (window as any).N.MsgKey;
                  if (typeof nMsgKey === 'function' && nMsgKey.prototype) {
                    MsgKeyClass = nMsgKey;
                    console.log('[TEST] [PASSO 3] ✅ MsgKey encontrado em window.N.MsgKey (igual referência)');
                  } else if (nMsgKey?.default && typeof nMsgKey.default === 'function') {
                    MsgKeyClass = nMsgKey.default;
                    console.log('[TEST] [PASSO 3] ✅ MsgKey encontrado em window.N.MsgKey.default');
                  }
                }
                
                // Estratégia 5: Tentar acessar via interceptors.N se disponível
                if (!MsgKeyClass && (this.interceptors as any).N?.MsgKey) {
                  const nMsgKey = (this.interceptors as any).N.MsgKey;
                  if (typeof nMsgKey === 'function' && nMsgKey.prototype) {
                    MsgKeyClass = nMsgKey;
                    console.log('[TEST] [PASSO 3] ✅ MsgKey encontrado em interceptors.N.MsgKey');
                  }
                }
                
                if (MsgKeyClass && typeof MsgKeyClass === 'function') {
                  try {
                    msgKeyObj = new MsgKeyClass(msgKeyData);
                    console.log('[TEST] [PASSO 3] ✅ MsgKey instanciado como classe (new MsgKey({...})):', {
                      msgKeyObj: msgKeyObj ? 'Criado' : 'NULL',
                      hasSerialized: !!msgKeyObj?._serialized,
                      msgKeyObjType: typeof msgKeyObj,
                      msgKeyObjKeys: msgKeyObj ? Object.keys(msgKeyObj).slice(0, 10) : []
                    });
                  } catch (e: any) {
                    console.error('[TEST] [PASSO 3] ERRO ao instanciar MsgKey como classe:', e.message, e.stack);
                    console.warn('[TEST] [PASSO 3] ⚠️ Usando objeto simples como fallback');
                    msgKeyObj = msgKeyData;
                  }
                } else {
                  console.warn('[TEST] [PASSO 3] ⚠️ MsgKey não é classe construtora, usando objeto simples:', {
                    msgKeyModuleType: typeof msgKeyModule,
                    hasDefault: !!msgKeyModule?.default,
                    defaultType: typeof msgKeyModule?.default,
                    hasConstructor: !!msgKeyModule?.constructor
                  });
                  msgKeyObj = msgKeyData;
                }
              } catch (e: any) {
                console.error('[TEST] [PASSO 3] ERRO ao criar MsgKey:', e.message, e.stack);
                // Fallback: objeto simples
                msgKeyObj = {
                  from: currentUser,
                  to: chat.id,
                  id: newMsgId,
                  selfDir: 'out'
                };
              }
              
              console.log('[TEST] [PASSO 3] ✅ MsgKey criado:', {
                msgKeyObj: msgKeyObj ? 'Existe' : 'NULL',
                msgKeyId: msgKeyObj?.id,
                msgKeyFrom: msgKeyObj?.from ? 'Existe' : 'NULL',
                msgKeyTo: msgKeyObj?.to ? (msgKeyObj.to.user || msgKeyObj.to._serialized || 'Objeto') : 'NULL',
                hasSerialized: !!msgKeyObj?._serialized
              });
              
              // Passo 4: Obter campos efêmeros
              const getEphemeralFieldsFunc = this.interceptors.getEphemeralFields;
              let ephemeralFields: any = {};
              
              if (getEphemeralFieldsFunc && typeof getEphemeralFieldsFunc === 'function') {
                try {
                  ephemeralFields = await Promise.resolve(getEphemeralFieldsFunc(chat)) || {};
                } catch (e) {
                  console.log('[TEST] Erro ao obter campos efêmeros (sendTextMsg):', e);
                }
              }
              
              // Passo 5: Criar objeto de mensagem completo (igual referência linha 601-623)
              console.log('[TEST] [PASSO 5] Criando objeto de mensagem completo (y = {...})...');
              const messageObj: any = {
                id: msgKeyObj,
                ack: 0,
                body: testMessage,
                from: currentUser,
                to: chat.id,
                local: true,
                self: 'out',
                t: Math.floor(Date.now() / 1000),
                isNewMsg: true,
                type: 'chat',
                ...ephemeralFields
              };
              
              // Definir tipo (linha 624: y.type = y.type || y.__x_type || "chat")
              messageObj.type = messageObj.type || messageObj.__x_type || 'chat';
              
              console.log('[TEST] [PASSO 5] ✅ Objeto de mensagem criado:', {
                id: messageObj.id ? 'Existe' : 'NULL',
                ack: messageObj.ack,
                body: messageObj.body ? `"${messageObj.body.substring(0, 50)}..."` : 'NULL',
                from: messageObj.from ? 'Existe' : 'NULL',
                to: messageObj.to ? (messageObj.to.user || messageObj.to._serialized || 'Objeto WID') : 'NULL',
                local: messageObj.local,
                self: messageObj.self,
                t: messageObj.t,
                isNewMsg: messageObj.isNewMsg,
                type: messageObj.type
              });
              
              // Passo 6: Enviar usando addAndSendMsgToChat (igual referência linha 625)
              console.log('[TEST] [PASSO 6] Enviando mensagem (await N.addAndSendMsgToChat(e, y))...');
              console.log('[TEST] [PASSO 6] Parâmetros:', {
                chat: chat ? 'Existe' : 'NULL',
                chatId: chat?.id,
                messageObjId: messageObj.id,
                messageObjBody: messageObj.body
              });
              
              // IMPORTANTE (WA-Sync): addAndSendMsgToChat retorna [sendPromise, waitPromise]
              // Precisamos aguardar de verdade, senão a mensagem "não aparece".
              const result = await Promise.resolve(addAndSendMsg(chat, messageObj));
              console.log('[TEST] [PASSO 6] ✅ addAndSendMsgToChat retornou:', {
                result: result ? 'Existe' : 'NULL',
                isArray: Array.isArray(result),
                resultLength: Array.isArray(result) ? result.length : 'N/A'
              });

              let sendPromiseOrValue: any = null;
              let waitPromiseOrValue: any = null;

              if (Array.isArray(result)) {
                sendPromiseOrValue = result[0];
                waitPromiseOrValue = result[1];
              } else {
                sendPromiseOrValue = result;
              }

              // WA-Sync: await sendPromise, depois await waitPromise (se existir)
              sendResult = await Promise.resolve(sendPromiseOrValue);
              if (waitPromiseOrValue) {
                await Promise.resolve(waitPromiseOrValue);
              }
              console.log('[TEST] [PASSO 6] ✅ sendResult final:', {
                sendResult: sendResult ? 'Existe' : 'NULL',
                sendResultId: sendResult?.id,
                sendResultIdSerialized: sendResult?.id?._serialized
              });
            }
            
            // Passo 7: Aguardar e verificar mensagem criada (igual referência linha 626-642)
            console.log('[TEST] [PASSO 7] Aguardando 500ms para mensagem aparecer...');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Passo 8: Buscar mensagem criada (igual referência linha 642)
            console.log('[TEST] [PASSO 8] Buscando mensagem criada (N.Msg.get(_._serialized))...');
            
            if (sendResult !== undefined && sendResult !== null) {
              // Tentar obter _serialized do MsgKey usado
              let msgKeySerialized: string | null = null;
              
              if (sendResult.id?._serialized) {
                msgKeySerialized = sendResult.id._serialized;
              } else if (sendResult._serialized) {
                msgKeySerialized = sendResult._serialized;
              } else if (sendResult.id) {
                msgKeySerialized = String(sendResult.id);
              }
              
              console.log('[TEST] [PASSO 8] MsgKey._serialized:', msgKeySerialized);
              
              if (msgKeySerialized) {
                const msgModule = this.interceptors.Msg;
                if (msgModule && typeof msgModule.get === 'function') {
                  try {
                    const createdMsg = msgModule.get(msgKeySerialized);
                    console.log('[TEST] [PASSO 8] ✅ Mensagem encontrada na coleção Msg:', {
                      found: !!createdMsg,
                      msgId: msgKeySerialized.substring(0, 50)
                    });
                    
                    if (createdMsg) {
                      resultMsg = `✅ Mensagem de texto enviada com sucesso!\n📱 Para: ${this.testNumber}\n💬 Mensagem: "${testMessage}"\n📨 ID: ${msgKeySerialized.substring(0, 50)}...`;
                    } else {
                      resultMsg = `✅ Função executada (mensagem pode estar sendo processada)\n📱 Para: ${this.testNumber}\n💬 Mensagem: "${testMessage}"\n\nVerifique se a mensagem apareceu no WhatsApp`;
                    }
                  } catch (e: any) {
                    console.warn('[TEST] [PASSO 8] ⚠️ Erro ao buscar mensagem:', e.message);
                    resultMsg = `✅ Função executada\n📱 Para: ${this.testNumber}\n💬 Mensagem: "${testMessage}"\n\nVerifique se a mensagem apareceu no WhatsApp`;
                  }
                } else {
                  resultMsg = `✅ Função executada\n📱 Para: ${this.testNumber}\n💬 Mensagem: "${testMessage}"\n\nVerifique se a mensagem apareceu no WhatsApp`;
                }
              } else {
                resultMsg = `✅ Função executada\n📱 Para: ${this.testNumber}\n💬 Mensagem: "${testMessage}"\n\nVerifique se a mensagem apareceu no WhatsApp`;
              }
            } else {
              resultMsg = `✅ Função executada (sem retorno)\n📱 Para: ${this.testNumber}\n💬 Mensagem: "${testMessage}"\n\nVerifique se a mensagem apareceu no WhatsApp`;
            }
            
            console.log('[TEST] ========== FIM PREPARAÇÃO DE MENSAGEM (sendTextMsg) ==========');
          } catch (sendError: any) {
            // Capturar erros específicos
            const errorMsg = sendError?.message || 'Erro desconhecido';
            const errorStack = sendError?.stack || '';
            
            // Erro específico: isLid is not a function (ID não é objeto WID)
            if (errorMsg.includes('isLid') || errorStack.includes('isLid')) {
              resultMsg = `❌ Erro: ID do chat não é objeto WID válido\n📱 Tentou enviar para: ${this.testNumber}\n💬 Mensagem: "${testMessage}"\n\n💡 O chat.id precisa ser um objeto WID (com métodos como isLid), não uma string.\nTente abrir a conversa no WhatsApp primeiro para garantir que o chat está carregado.`;
            }
            // Se erro contém 'toLogString', é erro interno do WhatsApp (objeto undefined)
            else if (errorMsg.includes('toLogString') || errorStack.includes('toLogString')) {
              resultMsg = `❌ Erro interno do WhatsApp: objeto não inicializado\n📱 Tentou enviar para: ${this.testNumber}\n💬 Mensagem: "${testMessage}"\n\n💡 O chat pode não estar totalmente carregado. Tente abrir a conversa no WhatsApp primeiro.`;
            } else {
              resultMsg = `❌ Erro ao enviar mensagem: ${errorMsg}\n📱 Tentou enviar para: ${this.testNumber}\n💬 Mensagem: "${testMessage}"`;
            }
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo addAndSendMsgToChat - enviar mensagem de teste
      // IMPLEMENTAÇÃO IGUAL À REFERÊNCIA: reverse.txt linhas 625, 1278, 4010
      if (moduleName === 'addAndSendMsgToChat') {
        this.showExecutionIndicator(moduleName, 'Enviando mensagem de teste...');
        
        try {
          let resultMsg = '';
          
          if (!this.testNumber) {
            this.hideExecutionIndicator(moduleName);
            return '⚠️ Configure um número de teste primeiro';
          }
          
          const addAndSendMsg = this.interceptors.addAndSendMsgToChat;
          
          if (!addAndSendMsg || typeof addAndSendMsg !== 'function') {
            this.hideExecutionIndicator(moduleName);
            return '❌ Função addAndSendMsgToChat não encontrada';
          }
          
          // ============================================================
          // NORMALIZAR NÚMERO DE TESTE (com código do país se necessário)
          // ============================================================
          console.log('[TEST] ========== NORMALIZAÇÃO DO NÚMERO ==========');
          
          // Obter número do usuário atual para comparar
          let currentUserWid: string | null = null;
          const userModule = this.interceptors.User;
          if (userModule) {
            try {
              let currentUser: any = null;
              if (typeof userModule === 'function') {
                currentUser = userModule();
              } else if (typeof userModule.getMaybeMePnUser === 'function') {
                currentUser = userModule.getMaybeMePnUser();
              } else if (typeof userModule.getMaybeMeLidUser === 'function') {
                currentUser = userModule.getMaybeMeLidUser();
              }
              
              if (currentUser) {
                currentUserWid = currentUser.id?._serialized || 
                                currentUser._serialized || 
                                (currentUser.user ? `${currentUser.user}@${currentUser.server || 'c.us'}` : null);
                console.log('[TEST] ✅ Número do usuário atual obtido:', currentUserWid);
              }
            } catch (e: any) {
              console.warn('[TEST] ⚠️ Erro ao obter número do usuário atual:', e.message);
            }
          }
          
          // Preparar múltiplos formatos do número de teste
          // Formato 1: Como digitado (3499277591@c.us)
          const testWid1 = `${this.testNumber}@c.us`;
          // Formato 2: Com código do país 55 (553499277591@c.us) - Brasil
          const testWid2 = `55${this.testNumber}@c.us`;
          // Formato 3: Se número do usuário tem código do país, extrair e usar
          let testWid3: string | null = null;
          if (currentUserWid) {
            const match = currentUserWid.match(/^(\d{2})(\d+)/);
            if (match) {
              const countryCode = match[1];
              // Se número de teste não começa com código do país, adicionar
              if (!this.testNumber.startsWith(countryCode)) {
                testWid3 = `${countryCode}${this.testNumber}@c.us`;
                console.log('[TEST] ✅ Formato 3 criado com código do país do usuário:', testWid3);
              }
            }
          }
          
          // Lista de WIDs para tentar (prioridade: formato original, depois com código do país)
          const testWidsToTry = [testWid1, testWid2, testWid3].filter(Boolean) as string[];
          console.log('[TEST] 📋 Formatos de WID para tentar:', testWidsToTry);
          
          // Verificar se algum formato corresponde ao número do usuário atual
          const isSendingToSelf = currentUserWid && testWidsToTry.some(wid => {
            const normalizedWid = wid.replace('@c.us', '');
            const normalizedCurrent = currentUserWid.replace('@c.us', '').replace('@lid', '');
            return normalizedWid === normalizedCurrent || 
                   normalizedWid.endsWith(normalizedCurrent) || 
                   normalizedCurrent.endsWith(normalizedWid);
          });
          
          if (isSendingToSelf) {
            console.log('[TEST] ✅ Detectado: Enviando mensagem para si mesmo!');
          }
          
          const testMessage = `Teste Mettri - ${new Date().toLocaleTimeString()}`;
          
          try {
            // ============================================================
            // OBTER CHAT (igual referência linha 1278, 1533)
            // ============================================================
            console.log('[TEST] ========== INÍCIO OBTER CHAT ==========');
            console.log('[TEST] 📋 Parâmetros:', {
              testNumber: this.testNumber,
              testWidsToTry: testWidsToTry,
              currentUserWid: currentUserWid,
              isSendingToSelf: isSendingToSelf
            });
            
            // ESTRATÉGIA DA REFERÊNCIA: Abrir chat primeiro usando Cmd.openChatAt() (linha 1513)
            // Isso garante que o chat está carregado e tem formato correto
            // Tentar com todos os formatos do número
            console.log('[TEST] [OBTER CHAT] Tentando abrir chat via Cmd.openChatAt() (referência linha 1513)...');
            const cmdModule = this.interceptors.Cmd;
            if (cmdModule && typeof cmdModule.openChatAt === 'function') {
              const chatModule = this.interceptors.Chat;
              if (chatModule && typeof chatModule.get === 'function') {
                // Tentar abrir com cada formato
                for (const testWid of testWidsToTry) {
                  try {
                    const basicChat = chatModule.get(testWid);
                    if (basicChat) {
                      console.log('[TEST] [OBTER CHAT] Chat básico obtido para abrir com formato:', testWid);
                      // Abrir chat usando Cmd (igual referência linha 1513)
                      cmdModule.openChatAt(basicChat);
                      console.log('[TEST] [OBTER CHAT] ✅ Chat aberto via Cmd.openChatAt() com formato:', testWid);
                      // Aguardar um pouco para chat carregar completamente
                      await new Promise(resolve => setTimeout(resolve, 500));
                      console.log('[TEST] [OBTER CHAT] ✅ Aguardou 500ms para chat carregar');
                      break; // Encontrou e abriu, parar loop
                    }
                  } catch (e: any) {
                    console.warn('[TEST] [OBTER CHAT] Erro ao tentar abrir chat com formato', testWid, ':', e.message);
                  }
                }
              }
            }
            
            // OBTER CHAT (igual referência linha 1278, 1533: N.Chat.get(e) || await N.Chat.find(N.WidFactory.createWid(e)))
            const chatModule = this.interceptors.Chat;
            let chat: any = null;
            
            if (!chatModule) {
              console.error('[TEST] [OBTER CHAT] ❌ Módulo Chat não encontrado!');
              throw new Error('Módulo Chat não encontrado');
            }
            
            console.log('[TEST] [OBTER CHAT] Chat module encontrado:', {
              hasGet: typeof chatModule.get === 'function',
              hasGetActive: typeof chatModule.getActive === 'function',
              hasFind: typeof chatModule.find === 'function',
              hasModels: !!chatModule._models,
              modelsCount: chatModule._models?.length || 0
            });
            
            // Estratégia 1: Se enviando para si mesmo, usar chat ativo (mais confiável)
            console.log('[TEST] [OBTER CHAT] [ESTRATÉGIA 1] Verificando se é envio para si mesmo...');
            if (isSendingToSelf && typeof chatModule.getActive === 'function') {
              try {
                const activeChat = chatModule.getActive();
                if (activeChat && activeChat.id) {
                  const activeChatId = activeChat.id._serialized || 
                                      (typeof activeChat.id === 'string' ? activeChat.id : activeChat.id.toString());
                  console.log('[TEST] [OBTER CHAT] [ESTRATÉGIA 1] Chat ativo ID:', activeChatId);
                  
                  // Verificar se chat ativo corresponde a algum formato do número de teste
                  const activeChatMatches = testWidsToTry.some(wid => {
                    const normalizedWid = wid.replace('@c.us', '');
                    const normalizedActive = activeChatId.replace('@c.us', '').replace('@lid', '');
                    return normalizedWid === normalizedActive || 
                           normalizedWid.endsWith(normalizedActive) || 
                           normalizedActive.endsWith(normalizedWid);
                  });
                  
                  if (activeChatMatches) {
                    chat = activeChat;
                    console.log('[TEST] [OBTER CHAT] [ESTRATÉGIA 1] ✅ Chat ativo corresponde ao número de teste!');
                  } else {
                    console.log('[TEST] [OBTER CHAT] [ESTRATÉGIA 1] ⚠️ Chat ativo não corresponde:', {
                      activeId: activeChatId,
                      wantedIds: testWidsToTry
                    });
                  }
                }
              } catch (e: any) {
                console.error('[TEST] [OBTER CHAT] [ESTRATÉGIA 1] ERRO ao usar Chat.getActive():', e.message);
              }
            }
            
            // Estratégia 1b: Tentar Chat.getActive() mesmo se não for envio para si mesmo (pode ser o chat aberto)
            if (!chat && typeof chatModule.getActive === 'function') {
              try {
                const activeChat = chatModule.getActive();
                if (activeChat && activeChat.id) {
                  const activeChatId = activeChat.id._serialized || 
                                      (typeof activeChat.id === 'string' ? activeChat.id : activeChat.id.toString());
                  console.log('[TEST] [OBTER CHAT] [ESTRATÉGIA 1b] Chat ativo ID:', activeChatId);
                  
                  // Verificar se corresponde a algum formato
                  const matches = testWidsToTry.some(wid => {
                    const normalizedWid = wid.replace('@c.us', '');
                    const normalizedActive = activeChatId.replace('@c.us', '').replace('@lid', '');
                    return normalizedWid === normalizedActive || 
                           normalizedWid.endsWith(normalizedActive) || 
                           normalizedActive.endsWith(normalizedWid);
                  });
                  
                  if (matches) {
                    chat = activeChat;
                    console.log('[TEST] [OBTER CHAT] [ESTRATÉGIA 1b] ✅ Chat ativo corresponde!');
                  }
                }
              } catch (e: any) {
                console.error('[TEST] [OBTER CHAT] [ESTRATÉGIA 1b] ERRO:', e.message);
              }
            }
            
            // Estratégia 2: Tentar Chat.get() com todos os formatos (síncrono, mais rápido - linha 1533)
            console.log('[TEST] [OBTER CHAT] [ESTRATÉGIA 2] Tentando Chat.get() com múltiplos formatos...');
            if (!chat && typeof chatModule.get === 'function') {
              for (const testWid of testWidsToTry) {
                try {
                  const foundChat = chatModule.get(testWid);
                  if (foundChat) {
                    chat = foundChat;
                    console.log('[TEST] [OBTER CHAT] [ESTRATÉGIA 2] ✅ Chat.get() encontrou com formato:', testWid);
                
                // Validar chat obtido
                if (chat && chat.id && typeof chat.id === 'string') {
                  // Se id é string, converter para WID objeto
                  const widFactory = this.interceptors.WidFactory;
                  if (widFactory) {
                    try {
                      let widObj: any = null;
                      if (typeof widFactory === 'function') {
                        widObj = widFactory(chat.id);
                      } else if (typeof widFactory.createWid === 'function') {
                        widObj = widFactory.createWid(chat.id);
                      }
                      if (widObj && widObj.user) {
                        chat.id = widObj;
                        console.log('[TEST] [OBTER CHAT] [ESTRATÉGIA 2] Chat.id convertido de string para WID objeto');
                      }
                    } catch (e) {
                      console.warn('[TEST] [OBTER CHAT] [ESTRATÉGIA 2] Erro ao converter chat.id para WID:', e);
                    }
                  }
                }
                
                    break; // Encontrou, parar loop
                  }
                } catch (e: any) {
                  console.warn('[TEST] [OBTER CHAT] [ESTRATÉGIA 2] Erro ao tentar Chat.get() com formato', testWid, ':', e.message);
                }
              }
              
              if (!chat) {
                console.log('[TEST] [OBTER CHAT] [ESTRATÉGIA 2] ❌ Chat.get() não encontrou com nenhum formato');
              }
            }
            
            // Estratégia 3: Se não encontrou, tentar Chat.find() com todos os formatos (assíncrono, igual referência linha 1278)
            console.log('[TEST] [OBTER CHAT] [ESTRATÉGIA 3] Tentando Chat.find() com múltiplos formatos...');
            if (!chat && typeof chatModule.find === 'function') {
              const widFactory = this.interceptors.WidFactory;
              
              for (const testWid of testWidsToTry) {
                try {
                  // Usar WidFactory se disponível (igual referência linha 1278, 1533)
                  // IMPORTANTE: WidFactory.createWid() recebe string completa "5511999999999@c.us"
                  let widToFind: any = testWid;
                
                  if (widFactory) {
                    try {
                      // Criar WID usando string completa (igual referência linha 1533: N.WidFactory.createWid(e))
                      if (typeof widFactory === 'function') {
                        widToFind = widFactory(testWid);
                      } else if (typeof widFactory.createWid === 'function') {
                        widToFind = widFactory.createWid(testWid);
                      }
                      
                      // Se WidFactory retornou objeto WID, usar ele; senão usar string original
                      if (!widToFind || (typeof widToFind === 'string' && widToFind === testWid)) {
                        widToFind = testWid;
                      }
                    } catch (e) {
                      // Usar testWid original se WidFactory falhar
                      widToFind = testWid;
                      console.log('[TEST] Erro ao criar WID para Chat.find(), usando string:', e);
                    }
                  }
                  
                  // Chat.find() aceita WID objeto ou string (igual referência linha 1278, 1533)
                  const foundChat = await Promise.resolve(chatModule.find(widToFind)).catch(() => null);
                  if (foundChat) {
                    chat = foundChat;
                    console.log('[TEST] [OBTER CHAT] [ESTRATÉGIA 3] ✅ Chat.find() encontrou com formato:', testWid);
                    
                    // Validar se chat tem id correto (objeto WID, não string)
                    if (chat && chat.id) {
                      if (typeof chat.id === 'string') {
                        // Se id é string, converter para WID usando WidFactory
                        if (widFactory) {
                          try {
                            let widObj: any = null;
                            if (typeof widFactory === 'function') {
                              widObj = widFactory(chat.id);
                            } else if (typeof widFactory.createWid === 'function') {
                              widObj = widFactory.createWid(chat.id);
                            }
                            if (widObj && widObj.user) {
                              chat.id = widObj;
                              console.log('[TEST] [OBTER CHAT] [ESTRATÉGIA 3] Chat.id convertido de string para WID objeto');
                            }
                          } catch (e) {
                            console.warn('[TEST] [OBTER CHAT] [ESTRATÉGIA 3] Erro ao converter chat.id para WID:', e);
                          }
                        }
                      } else if (chat.id.user) {
                        // Já é objeto WID correto
                        console.log('[TEST] [OBTER CHAT] [ESTRATÉGIA 3] Chat.id já é objeto WID válido');
                      }
                    }
                    break; // Encontrou, parar loop
                  }
                } catch (e: any) {
                  console.warn('[TEST] [OBTER CHAT] [ESTRATÉGIA 3] Erro ao tentar Chat.find() com formato', testWid, ':', e.message);
                }
              }
              
              if (!chat) {
                console.log('[TEST] [OBTER CHAT] [ESTRATÉGIA 3] ❌ Chat.find() não encontrou com nenhum formato');
              }
            }
            
            // Estratégia 3: Se ainda não encontrou, tentar criar/abrir chat e aguardar mais tempo
            if (!chat) {
              console.warn('[TEST] [OBTER CHAT] ⚠️ Chat não encontrado via get() nem find()');
              console.log('[TEST] [OBTER CHAT] Tentando estratégia alternativa: abrir chat e aguardar...');
              
              // Tentar criar WID e usar Chat.find() novamente após aguardar
              const widFactory = this.interceptors.WidFactory;
              if (widFactory && cmdModule && typeof cmdModule.openChatAt === 'function') {
                try {
                  // Criar WID objeto
                  let widObj: any = null;
                  if (typeof widFactory === 'function') {
                    widObj = widFactory(testWid1);
                  } else if (typeof widFactory.createWid === 'function') {
                    widObj = widFactory.createWid(testWid1);
                  }
                  
                  if (widObj && widObj.user) {
                    // Tentar abrir chat usando WID objeto
                    try {
                      // Criar um objeto básico apenas para openChatAt (não para enviar mensagem)
                      const tempChatForOpen = { id: widObj };
                      cmdModule.openChatAt(tempChatForOpen);
                      console.log('[TEST] [OBTER CHAT] Chat aberto via Cmd.openChatAt() com WID objeto');
                      
                      // Aguardar mais tempo para chat carregar completamente (2 segundos)
                      await new Promise(resolve => setTimeout(resolve, 2000));
                      console.log('[TEST] [OBTER CHAT] ✅ Aguardou 2s após abrir chat');
                      
                      // Tentar obter chat novamente após abrir com todos os formatos
                      for (const testWid of testWidsToTry) {
                        chat = chatModule.get(testWid);
                        if (chat) break;
                      }
                      if (!chat && typeof chatModule.find === 'function') {
                        chat = await Promise.resolve(chatModule.find(widObj)).catch(() => null);
                      }
                      
                      if (chat) {
                        console.log('[TEST] [OBTER CHAT] ✅ Chat encontrado após abrir e aguardar!');
                      }
                    } catch (e: any) {
                      console.error('[TEST] [OBTER CHAT] ERRO ao abrir chat com WID objeto:', e.message);
                    }
                  }
                } catch (e: any) {
                  console.error('[TEST] [OBTER CHAT] ERRO ao criar WID para estratégia alternativa:', e.message);
                }
              }
              
              // Se ainda não encontrou, lançar erro explicativo
              if (!chat) {
                const errorMsg = `Chat não encontrado para ${this.testNumber}. O chat precisa existir no WhatsApp (ter pelo menos uma mensagem trocada) ou estar na lista de conversas. Tente:\n1. Abrir a conversa manualmente no WhatsApp primeiro\n2. Enviar uma mensagem manualmente para criar o chat\n3. Verificar se o número está correto (formato: 3499277591 sem espaços ou caracteres especiais)`;
                console.error('[TEST] [OBTER CHAT] ❌', errorMsg);
                throw new Error(errorMsg);
              }
            }
            
            // VALIDAÇÃO CRÍTICA: Verificar se chat tem propriedades necessárias
            // O erro "enqueue" acontece quando o chat não tem todas as propriedades internas
            if (chat) {
              const hasRequiredProps = chat.id && 
                                     (typeof chat.id.isGroup === 'function' || typeof chat.id.isLid === 'function') &&
                                     chat.id.user;
              
              if (!hasRequiredProps) {
                console.error('[TEST] [OBTER CHAT] ❌ Chat não tem propriedades necessárias:', {
                  hasId: !!chat.id,
                  idType: typeof chat.id,
                  idUser: chat.id?.user,
                  idIsGroup: typeof chat.id?.isGroup,
                  idIsLid: typeof chat.id?.isLid
                });
                throw new Error(`Chat obtido não tem estrutura válida. O chat precisa ser um objeto completo do WhatsApp, não um objeto mínimo. Tente abrir a conversa manualmente no WhatsApp primeiro.`);
              }
              
              console.log('[TEST] [OBTER CHAT] ✅ Chat validado com propriedades necessárias');
            }
            
            // ============================================================
            // PREPARAR MENSAGEM EXATAMENTE COMO WA WEB PLUS (função Tt)
            // ============================================================
            console.log('[TEST] ========== INÍCIO PREPARAÇÃO DE MENSAGEM (função Tt) ==========');
            console.log('[TEST] 📋 CONTEXTO INICIAL:', {
              testNumber: this.testNumber,
              testWidsToTry: testWidsToTry,
              testMessage: testMessage,
              chat: chat ? 'Existe' : 'NULL',
              chatId: chat?.id,
              chatIdType: typeof chat?.id,
              chatIdUser: chat?.id?.user,
              chatIdSerialized: chat?.id?._serialized,
              chatIdIsGroup: chat?.id ? (typeof chat.id.isGroup === 'function' ? chat.id.isGroup() : 'isGroup não é função') : 'N/A',
              chatIdIsLid: chat?.id ? (typeof chat.id.isLid === 'function' ? 'isLid é função' : 'isLid não é função') : 'N/A'
            });
            
            // VALIDAÇÃO CRÍTICA: chat.id DEVE ser objeto WID válido
            if (!chat || !chat.id) {
              throw new Error('Chat ou chat.id não disponível');
            }
            
            if (typeof chat.id === 'string') {
              console.error('[TEST] ❌ ERRO CRÍTICO: chat.id é STRING, não objeto WID!', {
                chatId: chat.id,
                expected: 'Objeto WID com métodos (isLid, isGroup, etc)'
              });
              throw new Error('chat.id é string, precisa ser objeto WID. Tente abrir a conversa no WhatsApp primeiro.');
            }
            
            if (!chat.id.user && !chat.id._serialized) {
              console.warn('[TEST] ⚠️ AVISO: chat.id não tem user nem _serialized:', {
                chatId: chat.id,
                chatIdKeys: Object.keys(chat.id).slice(0, 10)
              });
            }
            
            console.log('[TEST] ✅ Chat validado:', {
              chatIdType: typeof chat.id,
              hasUser: !!chat.id.user,
              hasSerialized: !!chat.id._serialized,
              hasIsGroup: typeof chat.id.isGroup === 'function',
              hasIsLid: typeof chat.id.isLid === 'function'
            });
            
            // Passo 1: Obter usuário atual (linha 376, 589: xt = N.User?.getMaybeMePnUser() || N.User?.getMaybeMeLidUser())
            console.log('[TEST] [PASSO 1] Obtendo usuário atual (xt = N.User?.getMaybeMePnUser() || getMaybeMeLidUser())...');
            const userModule = this.interceptors.User;
            let currentUser: any = null;
            
            if (userModule) {
              console.log('[TEST] [PASSO 1] User module encontrado:', typeof userModule);
              try {
                if (typeof userModule === 'function') {
                  currentUser = userModule();
                  console.log('[TEST] [PASSO 1] Usuário obtido via User() como função:', currentUser ? 'Sucesso' : 'NULL');
                } else if (typeof userModule.getMaybeMePnUser === 'function') {
                  currentUser = userModule.getMaybeMePnUser();
                  console.log('[TEST] [PASSO 1] Usuário obtido via getMaybeMePnUser():', currentUser ? 'Sucesso' : 'NULL');
                } else if (typeof userModule.getMaybeMeLidUser === 'function') {
                  currentUser = userModule.getMaybeMeLidUser();
                  console.log('[TEST] [PASSO 1] Usuário obtido via getMaybeMeLidUser():', currentUser ? 'Sucesso' : 'NULL');
                } else {
                  console.log('[TEST] [PASSO 1] User module não tem métodos esperados, métodos disponíveis:', Object.keys(userModule).slice(0, 10));
                }
              } catch (e: any) {
                console.error('[TEST] [PASSO 1] ERRO ao obter usuário atual:', e.message, e.stack);
              }
            } else {
              console.error('[TEST] [PASSO 1] User module NÃO encontrado!');
            }
            
            if (!currentUser) {
              const errorMsg = 'Não foi possível obter usuário atual (User.getMaybeMePnUser ou getMaybeMeLidUser)';
              console.error('[TEST] [PASSO 1] FALHA:', errorMsg);
              throw new Error(errorMsg);
            }
            
            console.log('[TEST] [PASSO 1] ✅ Usuário atual obtido:', {
              hasUser: !!currentUser,
              userId: currentUser?.id || currentUser?._serialized || currentUser?.user || 'N/A',
              userType: typeof currentUser
            });
            
            // Passo 2: Criar novo ID de mensagem (linha 590: g = await N.MsgKey.newId())
            console.log('[TEST] [PASSO 2] Criando novo ID de mensagem (g = await N.MsgKey.newId())...');
            const msgKeyModule = this.interceptors.MsgKey;
            if (!msgKeyModule || typeof msgKeyModule.newId !== 'function') {
              const errorMsg = 'MsgKey.newId() não disponível';
              console.error('[TEST] [PASSO 2] FALHA:', errorMsg, {
                msgKeyModule: msgKeyModule ? 'Existe' : 'NULL',
                hasNewId: msgKeyModule ? typeof msgKeyModule.newId : 'N/A'
              });
              throw new Error(errorMsg);
            }
            
            const newMsgId = await Promise.resolve(msgKeyModule.newId());
            console.log('[TEST] [PASSO 2] ✅ Novo ID criado:', {
              newMsgId: newMsgId,
              newMsgIdType: typeof newMsgId
            });
            
            // Passo 3: Criar objeto MsgKey completo (linha 591-597)
            // new N.MsgKey({ from: h, to: e.id, id: g, participant: e.id?.isGroup() ? h : void 0, selfDir: "out" })
            console.log('[TEST] [PASSO 3] Criando objeto MsgKey completo (new N.MsgKey({...}))...');
            console.log('[TEST] [PASSO 3] Verificando se chat.id é grupo...');
            const isGroup = chat.id && typeof chat.id.isGroup === 'function' ? chat.id.isGroup() : false;
            console.log('[TEST] [PASSO 3] É grupo?', isGroup);
            
            // IMPORTANTE: Referência usa "new N.MsgKey({...})" - MsgKey é uma classe construtora
            // Verificar se msgKeyModule É a classe ou tem a classe
            let msgKeyObj: any = null;
            
            try {
              // Preparar dados do MsgKey (igual referência linha 591-597)
              const msgKeyData = {
                from: currentUser,
                to: chat.id,
                id: newMsgId,
                participant: isGroup ? currentUser : undefined,
                selfDir: 'out'
              };
              
              console.log('[TEST] [PASSO 3] Dados do MsgKey:', {
                from: msgKeyData.from ? 'Existe' : 'NULL',
                to: msgKeyData.to ? (msgKeyData.to.user || msgKeyData.to._serialized || 'Objeto WID') : 'NULL',
                id: msgKeyData.id,
                participant: msgKeyData.participant ? 'Existe' : 'undefined',
                selfDir: msgKeyData.selfDir
              });
              
              // Tentar instanciar como classe (igual referência: new N.MsgKey({...}))
              // MsgKey pode ser a classe diretamente ou estar em msgKeyModule.default
              let MsgKeyClass: any = null;
              
              // Estratégia 1: msgKeyModule é a classe diretamente
              if (typeof msgKeyModule === 'function' && msgKeyModule.prototype) {
                MsgKeyClass = msgKeyModule;
                console.log('[TEST] [PASSO 3] MsgKey é classe diretamente');
              }
              // Estratégia 2: msgKeyModule tem .default que é a classe
              else if (msgKeyModule?.default && typeof msgKeyModule.default === 'function' && msgKeyModule.default.prototype) {
                MsgKeyClass = msgKeyModule.default;
                console.log('[TEST] [PASSO 3] MsgKey está em .default');
              }
              // Estratégia 3: msgKeyModule tem constructor
              else if (msgKeyModule?.constructor && typeof msgKeyModule.constructor === 'function' && msgKeyModule.constructor !== Object) {
                MsgKeyClass = msgKeyModule.constructor;
                console.log('[TEST] [PASSO 3] MsgKey tem constructor');
              }
              // Estratégia 4: Tentar encontrar MsgKey no N (se disponível) - igual referência usa N.MsgKey
              else if ((window as any).N?.MsgKey) {
                const nMsgKey = (window as any).N.MsgKey;
                if (typeof nMsgKey === 'function' && nMsgKey.prototype) {
                  MsgKeyClass = nMsgKey;
                  console.log('[TEST] [PASSO 3] ✅ MsgKey encontrado em window.N.MsgKey (igual referência)');
                } else if (nMsgKey?.default && typeof nMsgKey.default === 'function') {
                  MsgKeyClass = nMsgKey.default;
                  console.log('[TEST] [PASSO 3] ✅ MsgKey encontrado em window.N.MsgKey.default');
                }
              }
              
              // Estratégia 5: Tentar acessar via interceptors.N se disponível
              if (!MsgKeyClass && (this.interceptors as any).N?.MsgKey) {
                const nMsgKey = (this.interceptors as any).N.MsgKey;
                if (typeof nMsgKey === 'function' && nMsgKey.prototype) {
                  MsgKeyClass = nMsgKey;
                  console.log('[TEST] [PASSO 3] ✅ MsgKey encontrado em interceptors.N.MsgKey');
                }
              }
              
              if (MsgKeyClass && typeof MsgKeyClass === 'function') {
                try {
                  msgKeyObj = new MsgKeyClass(msgKeyData);
                  console.log('[TEST] [PASSO 3] ✅ MsgKey instanciado como classe (new MsgKey({...})):', {
                    msgKeyObj: msgKeyObj ? 'Criado' : 'NULL',
                    hasSerialized: !!msgKeyObj?._serialized,
                    msgKeyObjType: typeof msgKeyObj,
                    msgKeyObjKeys: msgKeyObj ? Object.keys(msgKeyObj).slice(0, 10) : []
                  });
                } catch (e: any) {
                  console.error('[TEST] [PASSO 3] ERRO ao instanciar MsgKey como classe:', e.message, e.stack);
                  console.warn('[TEST] [PASSO 3] ⚠️ Usando objeto simples como fallback');
                  msgKeyObj = msgKeyData;
                }
              } else {
                console.warn('[TEST] [PASSO 3] ⚠️ MsgKey não é classe construtora, usando objeto simples:', {
                  msgKeyModuleType: typeof msgKeyModule,
                  hasDefault: !!msgKeyModule?.default,
                  defaultType: typeof msgKeyModule?.default,
                  hasConstructor: !!msgKeyModule?.constructor
                });
                msgKeyObj = msgKeyData;
              }
            } catch (e: any) {
              console.error('[TEST] [PASSO 3] ERRO ao criar MsgKey:', e.message, e.stack);
              // Fallback: objeto simples
              msgKeyObj = {
                from: currentUser,
                to: chat.id,
                id: newMsgId,
                selfDir: 'out'
              };
            }
            
            console.log('[TEST] [PASSO 3] ✅ MsgKey criado:', {
              msgKeyObj: msgKeyObj ? 'Existe' : 'NULL',
              msgKeyId: msgKeyObj?.id,
              msgKeyFrom: msgKeyObj?.from ? 'Existe' : 'NULL',
              msgKeyTo: msgKeyObj?.to ? (msgKeyObj.to.user || msgKeyObj.to._serialized || 'Objeto') : 'NULL'
            });
            
            // Passo 4: Obter campos efêmeros do chat (linha 600: g = N.getEphemeralFields(e))
            console.log('[TEST] [PASSO 4] Obtendo campos efêmeros (g = N.getEphemeralFields(e))...');
            const getEphemeralFieldsFunc = this.interceptors.getEphemeralFields;
            let ephemeralFields: any = {};
            
            if (getEphemeralFieldsFunc && typeof getEphemeralFieldsFunc === 'function') {
              try {
                ephemeralFields = await Promise.resolve(getEphemeralFieldsFunc(chat)) || {};
                console.log('[TEST] [PASSO 4] ✅ Campos efêmeros obtidos:', {
                  hasFields: Object.keys(ephemeralFields).length > 0,
                  fieldsCount: Object.keys(ephemeralFields).length,
                  fields: Object.keys(ephemeralFields).slice(0, 5)
                });
              } catch (e: any) {
                console.warn('[TEST] [PASSO 4] ⚠️ Erro ao obter campos efêmeros:', e.message);
                ephemeralFields = {};
              }
            } else {
              console.warn('[TEST] [PASSO 4] ⚠️ getEphemeralFields não disponível, usando objeto vazio');
            }
            
            // Passo 5: Criar objeto de mensagem completo (linha 601-623)
            console.log('[TEST] [PASSO 5] Criando objeto de mensagem completo (y = {...})...');
            const messageObj: any = {
              id: msgKeyObj,
              ack: 0,
              body: testMessage,
              from: currentUser,
              to: chat.id,
              local: true,
              self: 'out',
              t: Math.floor(Date.now() / 1000), // Timestamp em segundos
              isNewMsg: true,
              type: 'chat',
              ...ephemeralFields
            };
            
            // Definir tipo (linha 624: y.type = y.type || y.__x_type || "chat")
            messageObj.type = messageObj.type || messageObj.__x_type || 'chat';
            
            console.log('[TEST] [PASSO 5] ✅ Objeto de mensagem criado:', {
              id: messageObj.id ? 'Existe' : 'NULL',
              ack: messageObj.ack,
              body: messageObj.body ? `"${messageObj.body.substring(0, 50)}..."` : 'NULL',
              from: messageObj.from ? 'Existe' : 'NULL',
              to: messageObj.to ? (messageObj.to.user || messageObj.to._serialized || 'Objeto WID') : 'NULL',
              local: messageObj.local,
              self: messageObj.self,
              t: messageObj.t,
              isNewMsg: messageObj.isNewMsg,
              type: messageObj.type,
              ephemeralFieldsCount: Object.keys(ephemeralFields).length
            });
            
            // ENVIAR MENSAGEM (igual referência linha 625: await (await N.addAndSendMsgToChat(e, y))[0])
            console.log('[TEST] [PASSO 6] Enviando mensagem (await N.addAndSendMsgToChat(e, y))...');
            console.log('[TEST] [PASSO 6] Parâmetros:', {
              chat: chat ? 'Existe' : 'NULL',
              chatId: chat?.id,
              messageObjId: messageObj.id,
              messageObjBody: messageObj.body,
              messageObjTo: messageObj.to
            });
            
            let sendResult: any = null;
            
            try {
              // Chamar addAndSendMsgToChat(chat, messageObj) - igual referência linha 625
              console.log('[TEST] [PASSO 6] Chamando addAndSendMsgToChat(chat, messageObj)...');
              // IMPORTANTE (WA-Sync): addAndSendMsgToChat retorna [sendPromise, waitPromise]
              const result = await Promise.resolve(addAndSendMsg(chat, messageObj));
              
              console.log('[TEST] [PASSO 6] ✅ addAndSendMsgToChat retornou:', {
                result: result ? 'Existe' : 'NULL',
                isArray: Array.isArray(result),
                resultLength: Array.isArray(result) ? result.length : 'N/A',
                resultType: typeof result
              });
              
              let sendPromiseOrValue: any = null;
              let waitPromiseOrValue: any = null;
              if (Array.isArray(result)) {
                sendPromiseOrValue = result[0];
                waitPromiseOrValue = result[1];
                console.log('[TEST] [PASSO 6] ✅ Resultado é array, aguardando [0] e [1] (se existir)');
              } else {
                sendPromiseOrValue = result;
                console.log('[TEST] [PASSO 6] ✅ Resultado não é array, aguardando diretamente');
              }

              sendResult = await Promise.resolve(sendPromiseOrValue);
              if (waitPromiseOrValue) {
                await Promise.resolve(waitPromiseOrValue);
              }
              
              console.log('[TEST] [PASSO 6] ✅ sendResult final:', {
                sendResult: sendResult ? 'Existe' : 'NULL',
                sendResultId: sendResult?.id,
                sendResultIdSerialized: sendResult?.id?._serialized,
                sendResultType: typeof sendResult
              });
              
              // Verificar se a mensagem foi realmente criada (igual referência linha 630-642)
              if (sendResult && sendResult.id) {
                // Aguardar um pouco para mensagem aparecer (igual referência linha 626)
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Verificar se mensagem existe na coleção Msg (igual referência linha 630)
                const msgModule = this.interceptors.Msg;
                if (msgModule && typeof msgModule.get === 'function') {
                  try {
                    const msgId = sendResult.id._serialized || sendResult.id;
                    const createdMsg = msgModule.get(msgId);
                    if (createdMsg) {
                      resultMsg = `✅ Mensagem enviada com sucesso!\n📱 Para: ${this.testNumber}\n💬 Mensagem: "${testMessage}"\n📨 ID: ${msgId.substring(0, 50)}...`;
                    } else {
                      resultMsg = `✅ Função executada (mensagem pode estar sendo processada)\n📱 Para: ${this.testNumber}\n💬 Mensagem: "${testMessage}"\n\nVerifique se a mensagem apareceu no WhatsApp`;
                    }
                  } catch (e) {
                    resultMsg = `✅ Função executada\n📱 Para: ${this.testNumber}\n💬 Mensagem: "${testMessage}"\n\nVerifique se a mensagem apareceu no WhatsApp`;
                  }
                } else {
                  resultMsg = `✅ Função executada\n📱 Para: ${this.testNumber}\n💬 Mensagem: "${testMessage}"\n\nVerifique se a mensagem apareceu no WhatsApp`;
                }
              } else {
                resultMsg = `✅ Função executada (sem retorno de ID)\n📱 Para: ${this.testNumber}\n💬 Mensagem: "${testMessage}"\n\nVerifique se a mensagem apareceu no WhatsApp`;
              }
            } catch (sendError: any) {
              // Capturar erros específicos
              const errorMsg = sendError?.message || 'Erro desconhecido';
              const errorStack = sendError?.stack || '';
              
              // Erro específico: isLid is not a function (ID não é objeto WID)
              if (errorMsg.includes('isLid') || errorStack.includes('isLid')) {
                resultMsg = `❌ Erro: ID do chat não é objeto WID válido\n📱 Tentou enviar para: ${this.testNumber}\n💬 Mensagem: "${testMessage}"\n\n💡 O chat.id precisa ser um objeto WID (com métodos como isLid), não uma string.\nTente abrir a conversa no WhatsApp primeiro para garantir que o chat está carregado.`;
              }
              // Se erro contém 'toLogString', é erro interno do WhatsApp (objeto undefined)
              else if (errorMsg.includes('toLogString') || errorStack.includes('toLogString')) {
                resultMsg = `❌ Erro interno do WhatsApp: objeto não inicializado\n📱 Tentou enviar para: ${this.testNumber}\n💬 Mensagem: "${testMessage}"\n\n💡 O chat pode não estar totalmente carregado. Tente abrir a conversa no WhatsApp primeiro.`;
              } else {
                resultMsg = `❌ Erro ao enviar mensagem: ${errorMsg}\n📱 Tentou enviar para: ${this.testNumber}\n💬 Mensagem: "${testMessage}"`;
              }
            }
          } catch (error: any) {
            const errorMsg = error?.message || 'Erro desconhecido';
            resultMsg = `❌ Erro ao preparar envio: ${errorMsg}\n📱 Tentou enviar para: ${this.testNumber}\n💬 Mensagem: "${testMessage}"`;
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo Cmd - comandos do WhatsApp (alta prioridade)
      if (moduleName === 'Cmd') {
        this.showExecutionIndicator(moduleName, 'Testando comandos...');
        
        try {
          let resultMsg = '';
          const cmdModule = this.interceptors.Cmd;
          
          if (!cmdModule) {
            this.hideExecutionIndicator(moduleName);
            return '❌ Módulo Cmd não encontrado';
          }
          
          // Listar métodos disponíveis (padrão reverse.txt linha 865, 868, 1513, etc)
          const availableMethods: string[] = [];
          const cmdMethods = [
            'markChatUnread',
            'archiveChat',
            'openChatAt',
            'closeChat',
            'chatInfoDrawer',
            'pinChat',
            'unpinChat',
            'muteChat',
            'unmuteChat'
          ];
          
          cmdMethods.forEach(method => {
            if (typeof cmdModule[method] === 'function') {
              availableMethods.push(method);
            }
          });
          
          if (availableMethods.length > 0) {
            resultMsg = `✅ Módulo Cmd encontrado\n📋 Métodos disponíveis: ${availableMethods.join(', ')}`;
            
            // Se tem número de teste, mostrar exemplo de uso
            if (this.testNumber) {
              const testWid = `${this.testNumber}@c.us`;
              resultMsg += `\n\n💡 Exemplo: Cmd.openChatAt(Chat.get("${testWid}"))`;
            }
          } else {
            resultMsg = '✅ Módulo Cmd encontrado\n⚠️ Nenhum método identificado';
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo Conn - conexão com servidores
      if (moduleName === 'Conn') {
        this.showExecutionIndicator(moduleName, 'Verificando conexão...');
        
        try {
          let resultMsg = '';
          const connModule = this.interceptors.Conn;
          
          if (!connModule) {
            this.hideExecutionIndicator(moduleName);
            return '❌ Módulo Conn não encontrado';
          }
          
          // Verificar propriedades de conexão (padrão reverse.txt linha 4621: N.Conn?.pushname)
          const connInfo: string[] = [];
          
          if (connModule.pushname) {
            connInfo.push(`👤 Pushname: ${connModule.pushname}`);
          }
          
          if (connModule.isOnline !== undefined) {
            connInfo.push(`🟢 Online: ${connModule.isOnline ? 'Sim' : 'Não'}`);
          }
          
          if (connModule.isConnected !== undefined) {
            connInfo.push(`🔌 Conectado: ${connModule.isConnected ? 'Sim' : 'Não'}`);
          }
          
          // Verificar métodos disponíveis
          const methods = ['connect', 'disconnect', 'reconnect', 'getState'];
          const availableMethods = methods.filter(m => typeof connModule[m] === 'function');
          
          if (connInfo.length > 0 || availableMethods.length > 0) {
            resultMsg = `✅ Módulo Conn encontrado`;
            if (connInfo.length > 0) {
              resultMsg += `\n${connInfo.join('\n')}`;
            }
            if (availableMethods.length > 0) {
              resultMsg += `\n📋 Métodos: ${availableMethods.join(', ')}`;
            }
          } else {
            resultMsg = '✅ Módulo Conn encontrado\n⚠️ Informações de conexão não acessíveis';
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo ChatState - estado do chat (digitando, gravando)
      if (moduleName === 'ChatState') {
        this.showExecutionIndicator(moduleName, 'Testando estado do chat...');
        
        try {
          let resultMsg = '';
          const chatStateModule = this.interceptors.ChatState;
          
          if (!chatStateModule) {
            this.hideExecutionIndicator(moduleName);
            return '❌ Módulo ChatState não encontrado';
          }
          
          // Verificar métodos (padrão reverse.txt linha 885, 965: sendChatStateComposing, sendChatStateRecording)
          const methods = [
            'sendChatStateComposing',
            'sendChatStateRecording',
            'sendChatStatePaused',
            'clearChatState'
          ];
          
          const availableMethods = methods.filter(m => typeof chatStateModule[m] === 'function');
          
          if (availableMethods.length > 0) {
            resultMsg = `✅ Módulo ChatState encontrado\n📋 Métodos disponíveis: ${availableMethods.join(', ')}`;
            
            // Se tem número de teste, mostrar exemplo
            if (this.testNumber) {
              const testWid = `${this.testNumber}@c.us`;
              resultMsg += `\n\n💡 Exemplo: ChatState.sendChatStateComposing(WidFactory.createWid("${testWid}"))`;
            }
          } else {
            resultMsg = '✅ Módulo ChatState encontrado\n⚠️ Métodos não identificados';
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo Presence - presença individual (diferente de PresenceCollection)
      if (moduleName === 'Presence') {
        this.showExecutionIndicator(moduleName, 'Testando presença...');
        
        try {
          let resultMsg = '';
          const presenceModule = this.interceptors.Presence;
          
          if (!presenceModule) {
            this.hideExecutionIndicator(moduleName);
            return '❌ Módulo Presence não encontrado';
          }
          
          // Verificar métodos (padrão reverse.txt linha 330: sendPresenceAvailable)
          const methods = [
            'sendPresenceAvailable',
            'sendPresenceUnavailable',
            'subscribePresence',
            'unsubscribePresence'
          ];
          
          const availableMethods = methods.filter(m => typeof presenceModule[m] === 'function');
          
          if (availableMethods.length > 0) {
            resultMsg = `✅ Módulo Presence encontrado\n📋 Métodos disponíveis: ${availableMethods.join(', ')}`;
            
            // Se tem número de teste, mostrar exemplo
            if (this.testNumber) {
              resultMsg += `\n\n💡 Exemplo: Presence.subscribePresence("${this.testNumber}@c.us")`;
            }
          } else {
            resultMsg = '✅ Módulo Presence encontrado\n⚠️ Métodos não identificados';
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo createGroup - criar grupo
      if (moduleName === 'createGroup') {
        this.showExecutionIndicator(moduleName, 'Verificando criação de grupos...');
        
        try {
          let resultMsg = '';
          const createGroupFunc = this.interceptors.createGroup;
          
          if (!createGroupFunc || typeof createGroupFunc !== 'function') {
            this.hideExecutionIndicator(moduleName);
            return '❌ Função createGroup não encontrada';
          }
          
          // Verificar assinatura da função (padrão reverse.txt linha 2114: N.createGroup({...}))
          resultMsg = '✅ Função createGroup encontrada\n📋 Função disponível para criar grupos';
          resultMsg += '\n\n💡 Uso: createGroup({ subject: "Nome do Grupo", participants: ["5511999999999@c.us"] })';
          resultMsg += '\n⚠️ Não será executado automaticamente (requer confirmação)';
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo getParticipants - obter participantes de grupo
      if (moduleName === 'getParticipants') {
        this.showExecutionIndicator(moduleName, 'Buscando participantes...');
        
        try {
          let resultMsg = '';
          const getParticipantsFunc = this.interceptors.getParticipants;
          
          if (!getParticipantsFunc || typeof getParticipantsFunc !== 'function') {
            this.hideExecutionIndicator(moduleName);
            return '❌ Função getParticipants não encontrada';
          }
          
          // Tentar buscar participantes de grupos existentes
          const chatModule = this.interceptors.Chat;
          if (chatModule && chatModule._models) {
            const groups = chatModule._models.filter((chat: any) => {
              const chatId = chat.id?._serialized || chat.id || '';
              return chatId && typeof chatId === 'string' && chatId.includes('@g.us');
            }).slice(0, 3);
            
            if (groups.length > 0) {
              resultMsg = `✅ Função getParticipants encontrada\n👥 Testando com ${groups.length} grupo(s)...\n\n`;
              
              for (const group of groups) {
                try {
                  const groupId = group.id?._serialized || group.id || '';
                  if (groupId) {
                    const participants = await Promise.resolve(getParticipantsFunc(groupId)).catch(() => null);
                    if (participants && Array.isArray(participants)) {
                      const groupName = group.name || group.subject || groupId.split('@')[0];
                      resultMsg += `📋 ${groupName}: ${participants.length} participante(s)\n`;
                    }
                  }
                } catch (e) {
                  // Ignorar erros individuais
                }
              }
            } else {
              resultMsg = '✅ Função getParticipants encontrada\n⚠️ Nenhum grupo encontrado para testar';
            }
          } else {
            resultMsg = '✅ Função getParticipants encontrada\n⚠️ Chat module não disponível para testar';
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo MsgKey - criar IDs de mensagem
      if (moduleName === 'MsgKey') {
        this.showExecutionIndicator(moduleName, 'Testando criação de IDs...');
        
        try {
          let resultMsg = '';
          const msgKeyModule = this.interceptors.MsgKey;
          
          if (!msgKeyModule) {
            this.hideExecutionIndicator(moduleName);
            return '❌ Módulo MsgKey não encontrado';
          }
          
          // Verificar método newId (padrão reverse.txt linha 130: N.MsgKey = Ct.find(t => t.default && t.default.newId)?.default)
          if (typeof msgKeyModule.newId === 'function') {
            // Testar criar um ID
            try {
              const testWid = this.testNumber ? `${this.testNumber}@c.us` : '5511999999999@c.us';
              const msgId = msgKeyModule.newId(testWid);
              
              if (msgId) {
                resultMsg = `✅ Módulo MsgKey encontrado\n🔑 Método newId() disponível\n\n📋 ID gerado: ${JSON.stringify(msgId).substring(0, 100)}${JSON.stringify(msgId).length > 100 ? '...' : ''}`;
              } else {
                resultMsg = '✅ Módulo MsgKey encontrado\n🔑 Método newId() disponível\n⚠️ Retornou null/undefined';
              }
            } catch (e: any) {
              resultMsg = `✅ Módulo MsgKey encontrado\n🔑 Método newId() disponível\n⚠️ Erro ao testar: ${e.message}`;
            }
          } else {
            resultMsg = '✅ Módulo MsgKey encontrado\n⚠️ Método newId() não encontrado';
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo WidFactory - criar WIDs
      if (moduleName === 'WidFactory') {
        this.showExecutionIndicator(moduleName, 'Testando criação de WIDs...');
        
        try {
          let resultMsg = '';
          const widFactory = this.interceptors.WidFactory;
          
          if (!widFactory) {
            this.hideExecutionIndicator(moduleName);
            return '❌ Módulo WidFactory não encontrado';
          }
          
          // Verificar método createWid (padrão reverse.txt linha 139: N.WidFactory = Ct.findExport("createWid"))
          if (typeof widFactory === 'function') {
            // Testar criar um WID
            try {
              const testNumber = this.testNumber || '5511999999999';
              const wid = widFactory(testNumber);
              
              if (wid) {
                resultMsg = `✅ Módulo WidFactory encontrado\n🔑 Função createWid() disponível\n\n📋 WID gerado: ${JSON.stringify(wid).substring(0, 100)}${JSON.stringify(wid).length > 100 ? '...' : ''}`;
              } else {
                resultMsg = '✅ Módulo WidFactory encontrado\n🔑 Função createWid() disponível\n⚠️ Retornou null/undefined';
              }
            } catch (e: any) {
              resultMsg = `✅ Módulo WidFactory encontrado\n🔑 Função createWid() disponível\n⚠️ Erro ao testar: ${e.message}`;
            }
          } else if (typeof widFactory.createWid === 'function') {
            try {
              const testNumber = this.testNumber || '5511999999999';
              const wid = widFactory.createWid(testNumber);
              
              if (wid) {
                resultMsg = `✅ Módulo WidFactory encontrado\n🔑 Método createWid() disponível\n\n📋 WID gerado: ${JSON.stringify(wid).substring(0, 100)}${JSON.stringify(wid).length > 100 ? '...' : ''}`;
              } else {
                resultMsg = '✅ Módulo WidFactory encontrado\n🔑 Método createWid() disponível\n⚠️ Retornou null/undefined';
              }
            } catch (e: any) {
              resultMsg = `✅ Módulo WidFactory encontrado\n🔑 Método createWid() disponível\n⚠️ Erro ao testar: ${e.message}`;
            }
          } else {
            resultMsg = '✅ Módulo WidFactory encontrado\n⚠️ Método createWid() não encontrado';
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo QueryExist - verificar existência
      if (moduleName === 'QueryExist') {
        this.showExecutionIndicator(moduleName, 'Testando verificação de existência...');
        
        try {
          let resultMsg = '';
          const queryExistFunc = this.interceptors.QueryExist;
          
          if (!queryExistFunc || typeof queryExistFunc !== 'function') {
            this.hideExecutionIndicator(moduleName);
            return '❌ Função QueryExist não encontrada';
          }
          
          // Testar com número de teste se disponível
          if (this.testNumber) {
            try {
              const testWid = `${this.testNumber}@c.us`;
              const exists = await Promise.resolve(queryExistFunc(testWid)).catch(() => null);
              
              if (exists !== null && exists !== undefined) {
                resultMsg = `✅ Função QueryExist encontrada\n📱 Número ${this.testNumber}: ${exists ? 'Existe' : 'Não existe'}`;
              } else {
                resultMsg = `✅ Função QueryExist encontrada\n📱 Testado com: ${this.testNumber}\n⚠️ Retorno não disponível`;
              }
            } catch (e: any) {
              resultMsg = `✅ Função QueryExist encontrada\n⚠️ Erro ao testar: ${e.message}`;
            }
          } else {
            resultMsg = '✅ Função QueryExist encontrada\n💡 Configure um número de teste para verificar existência';
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo canReplyMsg - pode responder mensagem
      if (moduleName === 'canReplyMsg') {
        this.showExecutionIndicator(moduleName, 'Testando verificação de resposta...');
        
        try {
          let resultMsg = '';
          const canReplyFunc = this.interceptors.canReplyMsg;
          
          if (!canReplyFunc || typeof canReplyFunc !== 'function') {
            this.hideExecutionIndicator(moduleName);
            return '❌ Função canReplyMsg não encontrada';
          }
          
          // Tentar testar com mensagens existentes
          const msgModule = this.interceptors.Msg;
          if (msgModule && msgModule._models && msgModule._models.length > 0) {
            try {
              const testMsg = msgModule._models[0];
              const canReply = await Promise.resolve(canReplyFunc(testMsg)).catch(() => null);
              
              if (canReply !== null && canReply !== undefined) {
                resultMsg = `✅ Função canReplyMsg encontrada\n💬 Pode responder: ${canReply ? 'Sim' : 'Não'}`;
              } else {
                resultMsg = '✅ Função canReplyMsg encontrada\n⚠️ Retorno não disponível';
              }
            } catch (e: any) {
              resultMsg = `✅ Função canReplyMsg encontrada\n⚠️ Erro ao testar: ${e.message}`;
            }
          } else {
            resultMsg = '✅ Função canReplyMsg encontrada\n💡 Função disponível para verificar se mensagem pode ser respondida';
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo blockContact - bloquear contato
      if (moduleName === 'blockContact') {
        this.showExecutionIndicator(moduleName, 'Verificando bloqueio de contatos...');
        
        try {
          let resultMsg = '';
          const blockContactFunc = this.interceptors.blockContact;
          
          if (!blockContactFunc || typeof blockContactFunc !== 'function') {
            this.hideExecutionIndicator(moduleName);
            return '❌ Função blockContact não encontrada';
          }
          
          resultMsg = '✅ Função blockContact encontrada\n📋 Função disponível para bloquear contatos';
          resultMsg += '\n\n⚠️ Não será executado automaticamente (ação destrutiva)';
          
          if (this.testNumber) {
            resultMsg += `\n💡 Exemplo: blockContact("${this.testNumber}@c.us")`;
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo VCard - cartão de contato
      if (moduleName === 'VCard') {
        this.showExecutionIndicator(moduleName, 'Testando cartão de contato...');
        
        try {
          let resultMsg = '';
          const vcardFunc = this.interceptors.VCard;
          
          if (!vcardFunc || typeof vcardFunc !== 'function') {
            this.hideExecutionIndicator(moduleName);
            return '❌ Função VCard não encontrada';
          }
          
          // Tentar criar vCard de um contato
          if (this.testNumber) {
            try {
              const contactModule = this.interceptors.Contact;
              const testWid = `${this.testNumber}@c.us`;
              
              if (contactModule && typeof contactModule.get === 'function') {
                const contact = contactModule.get(testWid);
                if (contact) {
                  const vcard = await Promise.resolve(vcardFunc(contact)).catch(() => null);
                  if (vcard) {
                    resultMsg = `✅ Função VCard encontrada\n📇 vCard criado para: ${this.testNumber}`;
                    if (vcard.vcard) {
                      resultMsg += `\n📋 vCard: ${String(vcard.vcard).substring(0, 100)}${String(vcard.vcard).length > 100 ? '...' : ''}`;
                    }
                  } else {
                    resultMsg = `✅ Função VCard encontrada\n⚠️ Não foi possível criar vCard para ${this.testNumber}`;
                  }
                } else {
                  resultMsg = `✅ Função VCard encontrada\n⚠️ Contato ${this.testNumber} não encontrado`;
                }
              } else {
                resultMsg = '✅ Função VCard encontrada\n⚠️ Contact module não disponível para testar';
              }
            } catch (e: any) {
              resultMsg = `✅ Função VCard encontrada\n⚠️ Erro ao testar: ${e.message}`;
            }
          } else {
            resultMsg = '✅ Função VCard encontrada\n💡 Configure um número de teste para criar vCard';
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo SendDelete - enviar ou deletar mensagens
      if (moduleName === 'SendDelete') {
        this.showExecutionIndicator(moduleName, 'Verificando envio/deleção...');
        
        try {
          let resultMsg = '';
          const sendDeleteModule = this.interceptors.SendDelete;
          
          if (!sendDeleteModule) {
            this.hideExecutionIndicator(moduleName);
            return '❌ Módulo SendDelete não encontrado';
          }
          
          // Verificar métodos disponíveis
          const methods = ['send', 'delete', 'sendDelete'];
          const availableMethods = methods.filter(m => typeof sendDeleteModule[m] === 'function');
          
          if (availableMethods.length > 0) {
            resultMsg = `✅ Módulo SendDelete encontrado\n📋 Métodos disponíveis: ${availableMethods.join(', ')}`;
            resultMsg += '\n\n⚠️ Não será executado automaticamente (ação destrutiva)';
          } else {
            resultMsg = '✅ Módulo SendDelete encontrado\n⚠️ Métodos não identificados';
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo uploadMedia - enviar mídia
      if (moduleName === 'uploadMedia') {
        this.showExecutionIndicator(moduleName, 'Verificando upload de mídia...');
        
        try {
          let resultMsg = '';
          const uploadMediaFunc = this.interceptors.uploadMedia;
          
          if (!uploadMediaFunc || typeof uploadMediaFunc !== 'function') {
            this.hideExecutionIndicator(moduleName);
            return '❌ Função uploadMedia não encontrada';
          }
          
          resultMsg = '✅ Função uploadMedia encontrada\n📋 Função disponível para enviar mídia';
          resultMsg += '\n\n⚠️ Não será executado automaticamente (requer arquivo)';
          resultMsg += '\n💡 Uso: uploadMedia(chatId, file, options)';
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo MediaPrep - preparar mídia
      if (moduleName === 'MediaPrep') {
        this.showExecutionIndicator(moduleName, 'Verificando preparação de mídia...');
        
        try {
          let resultMsg = '';
          const mediaPrepFunc = this.interceptors.MediaPrep;
          
          if (!mediaPrepFunc || typeof mediaPrepFunc !== 'function') {
            this.hideExecutionIndicator(moduleName);
            return '❌ Função MediaPrep não encontrada';
          }
          
          resultMsg = '✅ Função MediaPrep encontrada\n📋 Função disponível para preparar mídia antes de enviar';
          resultMsg += '\n💡 Uso: MediaPrep(file, options)';
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo MediaObject - objeto de mídia
      if (moduleName === 'MediaObject') {
        this.showExecutionIndicator(moduleName, 'Verificando objeto de mídia...');
        
        try {
          let resultMsg = '';
          const mediaObjectFunc = this.interceptors.MediaObject;
          
          if (!mediaObjectFunc || typeof mediaObjectFunc !== 'function') {
            this.hideExecutionIndicator(moduleName);
            return '❌ Função MediaObject não encontrada';
          }
          
          resultMsg = '✅ Função MediaObject encontrada\n📋 Função disponível para criar/obter objetos de mídia';
          resultMsg += '\n💡 Uso: MediaObject(mediaId) ou MediaObject.create(data)';
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo MediaTypes - tipos de mídia
      if (moduleName === 'MediaTypes') {
        this.showExecutionIndicator(moduleName, 'Verificando tipos de mídia...');
        
        try {
          let resultMsg = '';
          const mediaTypesFunc = this.interceptors.MediaTypes;
          
          if (!mediaTypesFunc || typeof mediaTypesFunc !== 'function') {
            this.hideExecutionIndicator(moduleName);
            return '❌ Função MediaTypes não encontrada';
          }
          
          // Tentar testar com uma mensagem se disponível
          const msgModule = this.interceptors.Msg;
          if (msgModule && msgModule._models && msgModule._models.length > 0) {
            try {
              const testMsg = msgModule._models[0];
              const mediaType = await Promise.resolve(mediaTypesFunc(testMsg)).catch(() => null);
              
              if (mediaType !== null && mediaType !== undefined) {
                resultMsg = `✅ Função MediaTypes encontrada\n📋 Tipo de mídia: ${mediaType}`;
              } else {
                resultMsg = '✅ Função MediaTypes encontrada\n⚠️ Retorno não disponível';
              }
            } catch (e: any) {
              resultMsg = `✅ Função MediaTypes encontrada\n⚠️ Erro ao testar: ${e.message}`;
            }
          } else {
            resultMsg = '✅ Função MediaTypes encontrada\n💡 Função disponível para converter mensagem em tipo de mídia';
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo MediaCollection - coleção de mídia
      if (moduleName === 'MediaCollection') {
        this.showExecutionIndicator(moduleName, 'Buscando coleção de mídia...');
        
        try {
          let resultMsg = '';
          const mediaCollection = this.interceptors.MediaCollection;
          
          if (!mediaCollection) {
            this.hideExecutionIndicator(moduleName);
            return '❌ Módulo MediaCollection não encontrado';
          }
          
          // Verificar métodos disponíveis
          const methods = ['get', 'add', 'remove', 'processAttachments'];
          const availableMethods = methods.filter(m => typeof mediaCollection[m] === 'function');
          
          if (availableMethods.length > 0) {
            resultMsg = `✅ Módulo MediaCollection encontrado\n📋 Métodos disponíveis: ${availableMethods.join(', ')}`;
            
            // Verificar se tem _models
            if (mediaCollection._models && Array.isArray(mediaCollection._models)) {
              resultMsg += `\n📊 Total: ${mediaCollection._models.length} item(ns) na coleção`;
            }
          } else {
            resultMsg = '✅ Módulo MediaCollection encontrado\n⚠️ Métodos não identificados';
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo UploadUtils - utilitários de upload
      if (moduleName === 'UploadUtils') {
        this.showExecutionIndicator(moduleName, 'Verificando utilitários de upload...');
        
        try {
          let resultMsg = '';
          const uploadUtils = this.interceptors.UploadUtils;
          
          if (!uploadUtils) {
            this.hideExecutionIndicator(moduleName);
            return '❌ Módulo UploadUtils não encontrado';
          }
          
          // Verificar método encryptAndUpload (padrão referência)
          if (typeof uploadUtils.encryptAndUpload === 'function') {
            resultMsg = '✅ Módulo UploadUtils encontrado\n🔐 Método encryptAndUpload() disponível';
            resultMsg += '\n💡 Função para criptografar e fazer upload de arquivos';
          } else {
            resultMsg = '✅ Módulo UploadUtils encontrado\n⚠️ Método encryptAndUpload() não encontrado';
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo DownloadManager - gerenciador de download
      if (moduleName === 'DownloadManager') {
        this.showExecutionIndicator(moduleName, 'Verificando gerenciador de download...');
        
        try {
          let resultMsg = '';
          const downloadManager = this.interceptors.DownloadManager;
          
          if (!downloadManager) {
            this.hideExecutionIndicator(moduleName);
            return '❌ Módulo DownloadManager não encontrado';
          }
          
          // Verificar métodos disponíveis
          const methods = ['download', 'downloadMedia', 'getDownloadUrl'];
          const availableMethods = methods.filter(m => typeof downloadManager[m] === 'function');
          
          if (availableMethods.length > 0) {
            resultMsg = `✅ Módulo DownloadManager encontrado\n📋 Métodos disponíveis: ${availableMethods.join(', ')}`;
          } else {
            resultMsg = '✅ Módulo DownloadManager encontrado\n⚠️ Métodos não identificados';
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo OpaqueData - dados opacos
      if (moduleName === 'OpaqueData') {
        this.showExecutionIndicator(moduleName, 'Verificando dados opacos...');
        
        try {
          let resultMsg = '';
          const opaqueDataModule = this.interceptors.OpaqueData;
          
          if (!opaqueDataModule) {
            this.hideExecutionIndicator(moduleName);
            return '❌ Módulo OpaqueData não encontrado';
          }
          
          // Verificar método createFromData (padrão referência)
          if (typeof opaqueDataModule.createFromData === 'function') {
            resultMsg = '✅ Módulo OpaqueData encontrado\n🔐 Método createFromData() disponível';
            resultMsg += '\n💡 Função para criar dados opacos (criptografados)';
          } else {
            resultMsg = '✅ Módulo OpaqueData encontrado\n⚠️ Método createFromData() não encontrado';
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo UserConstructor - construtor de usuário
      if (moduleName === 'UserConstructor') {
        this.showExecutionIndicator(moduleName, 'Verificando construtor de usuário...');
        
        try {
          let resultMsg = '';
          const userConstructor = this.interceptors.UserConstructor;
          
          if (!userConstructor) {
            this.hideExecutionIndicator(moduleName);
            return '❌ Módulo UserConstructor não encontrado';
          }
          
          // Verificar se é uma classe/função construtora
          if (typeof userConstructor === 'function') {
            resultMsg = '✅ Módulo UserConstructor encontrado\n🏗️ Construtor de usuário disponível';
            resultMsg += '\n💡 Uso: new UserConstructor(data)';
          } else {
            resultMsg = '✅ Módulo UserConstructor encontrado\n⚠️ Não é uma função construtora';
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo USyncQuery - query de sincronização
      if (moduleName === 'USyncQuery') {
        this.showExecutionIndicator(moduleName, 'Verificando query de sincronização...');
        
        try {
          let resultMsg = '';
          const usyncQuery = this.interceptors.USyncQuery;
          
          if (!usyncQuery) {
            this.hideExecutionIndicator(moduleName);
            return '❌ Módulo USyncQuery não encontrado';
          }
          
          // Verificar métodos disponíveis
          const methods = ['query', 'sync', 'get'];
          const availableMethods = methods.filter(m => typeof usyncQuery[m] === 'function');
          
          if (availableMethods.length > 0) {
            resultMsg = `✅ Módulo USyncQuery encontrado\n📋 Métodos disponíveis: ${availableMethods.join(', ')}`;
          } else {
            resultMsg = '✅ Módulo USyncQuery encontrado\n⚠️ Métodos não identificados';
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo USyncUser - sincronização de usuário
      if (moduleName === 'USyncUser') {
        this.showExecutionIndicator(moduleName, 'Verificando sincronização de usuário...');
        
        try {
          let resultMsg = '';
          const usyncUser = this.interceptors.USyncUser;
          
          if (!usyncUser) {
            this.hideExecutionIndicator(moduleName);
            return '❌ Módulo USyncUser não encontrado';
          }
          
          // Verificar métodos disponíveis
          const methods = ['sync', 'get', 'update'];
          const availableMethods = methods.filter(m => typeof usyncUser[m] === 'function');
          
          if (availableMethods.length > 0) {
            resultMsg = `✅ Módulo USyncUser encontrado\n📋 Métodos disponíveis: ${availableMethods.join(', ')}`;
          } else {
            resultMsg = '✅ Módulo USyncUser encontrado\n⚠️ Métodos não identificados';
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo getEphemeralFields - campos efêmeros
      if (moduleName === 'getEphemeralFields') {
        this.showExecutionIndicator(moduleName, 'Verificando campos efêmeros...');
        
        try {
          let resultMsg = '';
          const getEphemeralFieldsFunc = this.interceptors.getEphemeralFields;
          
          if (!getEphemeralFieldsFunc || typeof getEphemeralFieldsFunc !== 'function') {
            this.hideExecutionIndicator(moduleName);
            return '❌ Função getEphemeralFields não encontrada';
          }
          
          // Tentar testar com uma mensagem se disponível
          const msgModule = this.interceptors.Msg;
          if (msgModule && msgModule._models && msgModule._models.length > 0) {
            try {
              const testMsg = msgModule._models[0];
              const ephemeralFields = await Promise.resolve(getEphemeralFieldsFunc(testMsg)).catch(() => null);
              
              if (ephemeralFields !== null && ephemeralFields !== undefined) {
                resultMsg = `✅ Função getEphemeralFields encontrada\n📋 Campos efêmeros: ${Object.keys(ephemeralFields).length} campo(s)`;
              } else {
                resultMsg = '✅ Função getEphemeralFields encontrada\n⚠️ Retorno não disponível';
              }
            } catch (e: any) {
              resultMsg = `✅ Função getEphemeralFields encontrada\n⚠️ Erro ao testar: ${e.message}`;
            }
          } else {
            resultMsg = '✅ Função getEphemeralFields encontrada\n💡 Função disponível para obter campos temporários de mensagens';
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo genMinimalLinkPreview - gerar preview de link
      if (moduleName === 'genMinimalLinkPreview') {
        this.showExecutionIndicator(moduleName, 'Verificando preview de link...');
        
        try {
          let resultMsg = '';
          const genPreviewFunc = this.interceptors.genMinimalLinkPreview;
          
          if (!genPreviewFunc || typeof genPreviewFunc !== 'function') {
            this.hideExecutionIndicator(moduleName);
            return '❌ Função genMinimalLinkPreview não encontrada';
          }
          
          // Testar com um link de exemplo
          try {
            const testUrl = 'https://example.com';
            const preview = await Promise.resolve(genPreviewFunc(testUrl)).catch(() => null);
            
            if (preview) {
              resultMsg = `✅ Função genMinimalLinkPreview encontrada\n🔗 Preview gerado para: ${testUrl}`;
              if (preview.title) {
                resultMsg += `\n📋 Título: ${preview.title}`;
              }
            } else {
              resultMsg = '✅ Função genMinimalLinkPreview encontrada\n⚠️ Não foi possível gerar preview';
            }
          } catch (e: any) {
            resultMsg = `✅ Função genMinimalLinkPreview encontrada\n⚠️ Erro ao testar: ${e.message}`;
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo findFirstWebLink - encontrar primeiro link
      if (moduleName === 'findFirstWebLink') {
        this.showExecutionIndicator(moduleName, 'Verificando busca de links...');
        
        try {
          let resultMsg = '';
          const findLinkFunc = this.interceptors.findFirstWebLink;
          
          if (!findLinkFunc || typeof findLinkFunc !== 'function') {
            this.hideExecutionIndicator(moduleName);
            return '❌ Função findFirstWebLink não encontrada';
          }
          
          // Testar com um texto de exemplo
          try {
            const testText = 'Visite https://example.com para mais informações';
            const link = await Promise.resolve(findLinkFunc(testText)).catch(() => null);
            
            if (link) {
              resultMsg = `✅ Função findFirstWebLink encontrada\n🔗 Link encontrado: ${link}`;
            } else {
              resultMsg = '✅ Função findFirstWebLink encontrada\n⚠️ Não foi possível encontrar link no texto de teste';
            }
          } catch (e: any) {
            resultMsg = `✅ Função findFirstWebLink encontrada\n⚠️ Erro ao testar: ${e.message}`;
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo getSearchContext - contexto de busca
      if (moduleName === 'getSearchContext') {
        this.showExecutionIndicator(moduleName, 'Verificando contexto de busca...');
        
        try {
          let resultMsg = '';
          const getSearchContextFunc = this.interceptors.getSearchContext;
          
          if (!getSearchContextFunc || typeof getSearchContextFunc !== 'function') {
            this.hideExecutionIndicator(moduleName);
            return '❌ Função getSearchContext não encontrada';
          }
          
          resultMsg = '✅ Função getSearchContext encontrada\n📋 Função disponível para obter contexto de buscas';
          resultMsg += '\n💡 Uso: getSearchContext(query, options)';
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo sendReactionToMsg - enviar reação
      if (moduleName === 'sendReactionToMsg') {
        this.showExecutionIndicator(moduleName, 'Verificando envio de reação...');
        
        try {
          let resultMsg = '';
          const sendReactionFunc = this.interceptors.sendReactionToMsg;
          
          if (!sendReactionFunc || typeof sendReactionFunc !== 'function') {
            this.hideExecutionIndicator(moduleName);
            return '❌ Função sendReactionToMsg não encontrada';
          }
          
          resultMsg = '✅ Função sendReactionToMsg encontrada\n📋 Função disponível para enviar reações (emoji)';
          resultMsg += '\n\n⚠️ Não será executado automaticamente';
          resultMsg += '\n💡 Uso: sendReactionToMsg(messageId, emoji)';
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo colorIndexToHex - cor para hexadecimal
      if (moduleName === 'colorIndexToHex') {
        this.showExecutionIndicator(moduleName, 'Testando conversão de cor...');
        
        try {
          let resultMsg = '';
          const colorToHexFunc = this.interceptors.colorIndexToHex;
          
          if (!colorToHexFunc || typeof colorToHexFunc !== 'function') {
            this.hideExecutionIndicator(moduleName);
            return '❌ Função colorIndexToHex não encontrada';
          }
          
          // Testar com alguns índices comuns
          try {
            const testIndices = [0, 1, 2, 5, 10];
            const results: string[] = [];
            
            for (const index of testIndices) {
              try {
                const hex = await Promise.resolve(colorToHexFunc(index)).catch(() => null);
                if (hex) {
                  results.push(`Índice ${index}: ${hex}`);
                }
              } catch (e) {
                // Ignorar erros individuais
              }
            }
            
            if (results.length > 0) {
              resultMsg = `✅ Função colorIndexToHex encontrada\n🎨 Conversões de teste:\n${results.map(r => `   ${r}`).join('\n')}`;
            } else {
              resultMsg = '✅ Função colorIndexToHex encontrada\n⚠️ Não foi possível testar conversões';
            }
          } catch (e: any) {
            resultMsg = `✅ Função colorIndexToHex encontrada\n⚠️ Erro ao testar: ${e.message}`;
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo StatusUtils - utilitários de status
      if (moduleName === 'StatusUtils') {
        this.showExecutionIndicator(moduleName, 'Verificando utilitários de status...');
        
        try {
          let resultMsg = '';
          const statusUtils = this.interceptors.StatusUtils;
          
          if (!statusUtils || typeof statusUtils !== 'function') {
            this.hideExecutionIndicator(moduleName);
            return '❌ Módulo StatusUtils não encontrado';
          }
          
          resultMsg = '✅ Módulo StatusUtils encontrado\n📋 Função disponível para definir status';
          resultMsg += '\n💡 Uso: StatusUtils(text) ou StatusUtils.setMyStatus(text)';
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo Composing - digitando
      if (moduleName === 'Composing') {
        this.showExecutionIndicator(moduleName, 'Verificando estado de digitação...');
        
        try {
          let resultMsg = '';
          const composingFunc = this.interceptors.Composing;
          
          if (!composingFunc || typeof composingFunc !== 'function') {
            this.hideExecutionIndicator(moduleName);
            return '❌ Função Composing não encontrada';
          }
          
          resultMsg = '✅ Função Composing encontrada\n📋 Função disponível para marcar como digitando';
          resultMsg += '\n💡 Uso: Composing(chatId) ou Composing.markComposing(chatId)';
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo ConversationSeen - conversa vista
      if (moduleName === 'ConversationSeen') {
        this.showExecutionIndicator(moduleName, 'Verificando marcação de vista...');
        
        try {
          let resultMsg = '';
          const conversationSeenFunc = this.interceptors.ConversationSeen;
          
          if (!conversationSeenFunc || typeof conversationSeenFunc !== 'function') {
            this.hideExecutionIndicator(moduleName);
            return '❌ Função ConversationSeen não encontrada';
          }
          
          resultMsg = '✅ Função ConversationSeen encontrada\n📋 Função disponível para marcar conversa como vista';
          resultMsg += '\n💡 Uso: ConversationSeen(chatId) ou ConversationSeen.sendConversationSeen(chatId)';
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo Playing - tocando
      if (moduleName === 'Playing') {
        this.showExecutionIndicator(moduleName, 'Verificando estado de reprodução...');
        
        try {
          let resultMsg = '';
          const playingFunc = this.interceptors.Playing;
          
          if (!playingFunc || typeof playingFunc !== 'function') {
            this.hideExecutionIndicator(moduleName);
            return '❌ Função Playing não encontrada';
          }
          
          resultMsg = '✅ Função Playing encontrada\n📋 Função disponível para marcar áudio como tocado';
          resultMsg += '\n💡 Uso: Playing(messageId) ou Playing.markPlayed(messageId)';
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo StatusState - estado de status
      if (moduleName === 'StatusState') {
        this.showExecutionIndicator(moduleName, 'Verificando estado de status...');
        
        try {
          let resultMsg = '';
          const statusStateFunc = this.interceptors.StatusState;
          
          if (!statusStateFunc || typeof statusStateFunc !== 'function') {
            this.hideExecutionIndicator(moduleName);
            return '❌ Função StatusState não encontrada';
          }
          
          resultMsg = '✅ Função StatusState encontrada\n📋 Função disponível para marcar status como lido';
          resultMsg += '\n💡 Uso: StatusState(statusId) ou StatusState.markStatusRead(statusId)';
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      // Teste para módulo Classes - classes CSS dinâmicas
      if (moduleName === 'Classes') {
        this.showExecutionIndicator(moduleName, 'Verificando classes CSS...');
        
        try {
          let resultMsg = '';
          const classesModule = this.interceptors.Classes;
          
          if (!classesModule || typeof classesModule !== 'object') {
            this.hideExecutionIndicator(moduleName);
            return '❌ Módulo Classes não encontrado';
          }
          
          // Verificar se tem propriedades de classes CSS (padrão reverse.txt linha 354-367)
          const classKeys = Object.keys(classesModule);
          
          if (classKeys.length > 0) {
            resultMsg = `✅ Módulo Classes encontrado\n📋 Classes CSS disponíveis: ${classKeys.slice(0, 10).join(', ')}`;
            if (classKeys.length > 10) {
              resultMsg += `\n... e mais ${classKeys.length - 10} classe(s)`;
            }
          } else {
            resultMsg = '✅ Módulo Classes encontrado\n⚠️ Nenhuma classe CSS identificada';
            resultMsg += '\n💡 Classes são seletores CSS dinâmicos do WhatsApp';
          }
          
          this.hideExecutionIndicator(moduleName);
          return resultMsg;
        } catch (error: any) {
          this.hideExecutionIndicator(moduleName);
          return `⚠️ Erro: ${error.message}`;
        }
      }
      
      return '';
    } catch (error: any) {
      console.log(`[TEST] Erro no teste funcional:`, error.message);
      return '';
    }
  }

  /**
   * Mostra indicador visual de execução
   */
  private showExecutionIndicator(moduleName: string, message: string): void {
    if (!this.container) return;
    
    const moduleEl = this.container.querySelector(`[data-module="${moduleName}"]`);
    if (moduleEl) {
      // Adicionar classe de execução
      moduleEl.classList.add('executing');
      
      // Criar ou atualizar indicador
      let indicator = moduleEl.querySelector('.mettri-test-execution-indicator');
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'mettri-test-execution-indicator';
        moduleEl.appendChild(indicator);
      }
      indicator.textContent = message;
      indicator.setAttribute('style', 'display: block;');
    }
  }

  /**
   * Esconde indicador visual de execução
   */
  private hideExecutionIndicator(moduleName: string): void {
    if (!this.container) return;
    
    const moduleEl = this.container.querySelector(`[data-module="${moduleName}"]`);
    if (moduleEl) {
      moduleEl.classList.remove('executing');
      const indicator = moduleEl.querySelector('.mettri-test-execution-indicator');
      if (indicator) {
        indicator.setAttribute('style', 'display: none;');
      }
    }
  }

  /**
   * Escapa HTML para evitar problemas de renderização
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Formata tempo relativo
   */
  private formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'agora';
    if (diffMins < 60) return `há ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
  }
}
