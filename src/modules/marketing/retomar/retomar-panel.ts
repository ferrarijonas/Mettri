/**
 * RetomarPanel
 *
 * Painel de retomada de clientes inativos (Marketing > Retomar).
 * - Régua de cadência (dias por tipo; ex. Frequente: 21, 42, 73, 116).
 * - Modo dia: clientes elegíveis por dia; modo etiqueta: membros de Bloqueados/CNPJ ou listas customizadas.
 * - Etiquetas: adicionar/remover/mover clientes; listas padrão (Bloqueados, CNPJ) editáveis.
 * - Geração de mensagens, Simular envio e envio em massa.
 */

import { messageDB } from '../../../storage/message-db';
import { purchaseDB } from '../../../storage/purchase-db';
import { clientDB, digitsOnly, normalizePhoneDigitsWithAliases } from '../../../storage/client-db';
import {
  getRangesForType,
  getMinDistanceForType,
  isInRange,
  daysBetweenByCalendar,
  type RelationType,
} from './inactive-days';
import { classifyNameCandidate } from '../../clientes/name-likelihood';
import { MettriBridgeClient } from '../../../content/bridge-client';
import {
  sendMessageService,
  getLastOutgoingFromWhatsAppForChatIds,
  ensureChatLoaded,
} from '../../../infrastructure/services';
import { RateLimiter } from './rate-limiter';
import { RetomarListsManager, type RetomarList } from './retomar-lists';
import * as retomarContador from './retomar-contador';
import { getLastRetomarOutgoingMap, setLastRetomarOutgoingAt } from './retomar-last-outgoing-store';
import { mergeLastOutgoingMaps } from './merge-last-outgoing';
import { verifyRetomarPreSend } from './retomar-send-gate';
import {
  computeEligibleContactsDiagnostics,
  type LastActivityEntry,
  type LastOutgoingEntry,
} from './eligible-contacts-engine';
import { splitAB } from './ab-split';
import { suggestRedacaoRetomar, suggestText } from './ai-suggestion';
import { formatAgenteRetomarPromptUpdatedLabel, AGENTE_RETOMAR_PROMPT_LAST_MODIFIED_ISO } from './agente-retomar-prompt';
import { retomarContextResolver } from './retomar-context-resolver';
import {
  retomarMetricsResolver,
  type RetomarMetricsResult,
} from './retomar-metrics-resolver';
import { retomarOutcomeExporter } from './retomar-outcome-exporter';
import { createRetomarOutcomeBridgeDeps } from './retomar-outcome-export-bridge';
import type { RetomarMeta } from '../../../types/schemas';
import type { CapturedMessage } from '../../../types';
import {
  parseListaClientesXlsx,
  loadSnapshot,
  saveSnapshot,
  resolveLastActivityFromSnapshot,
  type PurchaseImportSnapshot,
} from './retomar-purchase-import';

interface InactiveClient {
  chatId: string;
  chatName: string;
  phone: string;
  lastMessageTime: Date;
  daysInactive: number;
  cadenceDay: number;
  status: 'pending' | 'sent' | 'responded' | 'blocked' | 'skipped-today' | 'excluded';
  generatedMessage?: string;
  firstName?: string; // Primeiro nome formatado
  isSpecialList?: boolean; // CNPJ ou lista especial
  listIds?: string[]; // IDs das listas que contêm este cliente
  isTestContact?: boolean; // Contato de Simular envio
}

interface LogEntry {
  timestamp: Date;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

/** Nomes de exibição para etiquetas padrão (compatibilidade com listas já criadas). */
const ETIQUETA_DISPLAY_NAMES: Record<string, string> = {
  'never-send': 'Bloqueados',
  'exclusivos': 'CNPJ',
  'inativos': 'Inativos',
};

/** Opções do dropdown Tipo de relação. label = nome; shortRange = texto explicativo. */
const RELATION_TYPES = [
  { id: 'frequente', label: 'Frequente', shortRange: 'Quinzenal ou mensal' },
  { id: 'pontual', label: 'Pontual', shortRange: 'Mensal ou bimestral' },
  { id: 'sazonal', label: 'Sazonal', shortRange: 'Trimestral' },
  { id: 'personalizado', label: 'Personalizado', shortRange: 'Você define' },
] as const;

type ActivitySource = 'last-message' | 'last-purchase' | 'last-purchase-import';

const ACTIVITY_SOURCE_OPTIONS = [
  { id: 'last-message', label: 'Última mensagem' },
  { id: 'last-purchase', label: 'Última compra' },
  { id: 'last-purchase-import', label: 'Lista importada (XLSX)' },
] as const;

/** localStorage=1 → console com contagem por motivo de exclusão na elegibilidade Retomar. */
const DEBUG_RETOMAR_ELIGIBILITY_KEY = 'mettri_debug_retomar_eligibility';
/** localStorage=1 → ignora última mensagem enviada (distância mínima) só para depuração local. */
const DEBUG_RETOMAR_SKIP_OUTGOING_KEY = 'mettri_debug_retomar_skip_outgoing';

/** Configuração dos ciclos da régua (Primeira, Segunda, Terceira, Última tentativa). Última sempre usa o último dia. */
const CHAMADAS_CONFIG = [
  { id: 'primeira', label: 'Primeira tentativa', campaignLabel: null },
  { id: 'segunda', label: 'Segunda tentativa', campaignLabel: null },
  { id: 'terceira', label: 'Terceira tentativa', campaignLabel: 'Desconto 25%' },
  { id: 'ultima', label: 'Última tentativa', campaignLabel: null },
] as const;

export class RetomarPanel {
  private container: HTMLElement | null = null;
  private cadenceDays: number[] = [21, 42, 73, 116];
  private eligibleClients: InactiveClient[] = [];
  /** Cache de clientes por chatId para preservar nomes entre modos (evita alteração ao alternar). */
  private clientsCache = new Map<string, InactiveClient>();
  private selectedClients = new Set<string>();
  /** Índice da faixa selecionada nos ciclos (0–3). */
  private selectedRangeIndex: number | null = null;
  private selectedInactiveDay: number | null = null;
  private logs: LogEntry[] = [];
  private stats = {
    totalEligible: 0,
    selected: 0,
    sentToday: 0,
    responseRate: 0,
  };

  // Propriedades para novo design
  private totalContacts = 0;
  private eligibleCount = 0;
  private periodFilters: {
    range: string;
    count: number;
    selected: boolean;
    variant: 'outline' | 'filled';
  }[] = [];
  private isFiltersExpanded = true;
  private isContactsExpanded = true;
  private openMenuId: string | null = null;
  private messageText = "";
  private closeMenusHandler: ((e: MouseEvent) => void) | null = null;
  private closeDropdownHandler: ((e: MouseEvent) => void) | null = null;
  private closeRelationDropdownHandler: ((e: MouseEvent) => void) | null = null;
  private closeActivitySourceDropdownHandler: ((e: MouseEvent) => void) | null = null;
  private repositionDropdownHandler: (() => void) | null = null;
  /** Intervalo customizado em dias (modo Tipo de relação = Personalizado). Apenas UI. */
  private customRelationIntervalDays: number | null = null;
  /** Expansão do painel avançado de dias da régua no modo Personalizado. */
  private isCustomCadenceExpanded = false;
  /** Popover de configuração da régua em Ciclos de contato (engrenagem). */
  private isChamadasConfigOpen = false;

  /** Tipo de relação selecionado (dropdown). */
  private selectedRelationType: RelationType = 'frequente';
  /** Dropdown "Baseado em" (fonte de atividade) aberto ou fechado. */
  private activitySourceDropdownOpen = false;
  /** Fonte da data de referência para afastamento. */
  private selectedActivitySource: ActivitySource = 'last-message';
  private relationTypeDropdownOpen = false;

  private testContact: { phone: string; name: string } | null = null;
  private testModeEnabled = false;
  private bridge = new MettriBridgeClient(30_000);
  private sendButtonClickHandler: ((e: MouseEvent) => void) | null = null;

  /** Índice da chamada (0–3) da fila atual; usado após envio para setContador. */
  private pendingChamadaIndex: number | null = null;

  // Rate limiting e controle de envio
  private rateLimiter = new RateLimiter();
  private isPaused = false;
  private isSending = false;
  private sendingQueue: string[] = [];
  private backgroundIntervalId: number | null = null;
  private readonly STORAGE_KEY_QUEUE = 'retomarSendingQueue';
  private readonly STORAGE_KEY_PAUSED = 'retomarIsPaused';

  /** accountId para contador e listas (definido em loadConfig). */
  private accountId = 'default';

  /** Snapshot da lista XLSX importada (fonte last-purchase-import). */
  private purchaseImportSnapshot: PurchaseImportSnapshot | null = null;
  /** Resumo do último import para exibir na UI. */
  private purchaseImportSummary: { totalRows: number; matchedCount: number; unmatchedCount: number; importedAt: string; filename?: string } | null = null;

  /** Textos A/B por ciclo (rangeIndex 0–3) para a UI expandida de Ciclos de contato. */
  private cycleMessages: { textA: string; textB: string | null }[] = [
    { textA: '', textB: null },
    { textA: '', textB: null },
    { textA: '', textB: null },
    { textA: '', textB: null },
  ];

  /** Painel do ciclo: lista de pessoas expandida ou só resumo. */
  private cyclePeopleExpanded = false;
  /** Painel do ciclo: bloco Métricas (este ciclo) expandido. */
  private cycleMetricsExpanded = false;
  /** Modo de envio no painel do ciclo: Só A, Só B ou A/B (50%–50%). */
  private cycleSendMode: 'A' | 'B' | 'AB' = 'A';

  /** Payload A/B por chatId — preenchido no modo A/B para que processQueue saiba o texto e variant de cada contato. */
  private sendingPayloadByChatId = new Map<string, { text: string; variant: 'A' | 'B' }>();

  /** Período selecionado nas métricas do ciclo (em dias). */
  private cycleMetricsPeriodDays = 7;
  /** Cache do bloco Métricas (este ciclo) após leitura do messageDB. */
  private cycleMetricsView:
    | null
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | {
        kind: 'ok';
        columns: { label: 'A' | 'B'; metrics: RetomarMetricsResult }[];
      } = null;

  /** Métricas agregadas no cartão "Retomar conversas" (todos os ciclos, A+B). */
  private retomarSummaryPeriodDays = 7;
  private retomarSummaryView:
    | null
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | { kind: 'ok'; metrics: RetomarMetricsResult } = null;

  /** Bloco Respostas Agênticas (independente do acordeão de Ciclos de contato). */
  private isAgenticSectionExpanded = true;
  private selectedAgenticRangeIndex: number | null = null;
  private readonly agenticHiddenChatIds = new Set<string>();
  private readonly agenticChecked = new Set<string>();
  private readonly agenticDraftByChatId = new Map<string, string>();
  /** Evita cliques duplicados enquanto a UI é re-renderizada durante geração em lote. */
  private agenticBulkGenerating = false;
  private agenticRegeneratingId: string | null = null;

  // Sistema de listas
  private listsManager: RetomarListsManager | null = null;
  private lists: RetomarList[] = [];
  private listsExpanded = false;
  private creatingList = false;
  private listMenuOpenId: string | null = null;
  /** Modo etiqueta: id da lista selecionada (Bloqueados/CNPJ) ou null = modo dia. */
  private selectedListId: string | null = null;
  /** Clientes da etiqueta selecionada (quando selectedListId !== null). */
  private labelModeClients: InactiveClient[] = [];
  private readonly SHOW_CREATE_LIST = true; // + e Nova lista visíveis

  // UI de progresso
  private sendingProgress = {
    total: 0,
    sent: 0,
    skipped: 0,
    errors: 0,
    current: null as string | null, // Nome do cliente atual
    startTime: null as number | null,
  };

  constructor() {
    // Constructor vazio - render() será chamado externamente
  }

  /**
   * Renderiza o painel de retomada completo.
   * Reseta estado ao renderizar para garantir sincronização.
   */
  public async render(): Promise<HTMLElement> {
    const panel = document.createElement('div');
    panel.className = 'flex flex-col gap-4 min-w-0 overflow-x-hidden overflow-y-visible';
    this.container = panel;

    // Resetar estado ao renderizar novamente
    this.selectedListId = null;
    this.labelModeClients = [];
    this.openMenuId = null;
    this.listMenuOpenId = null;
    this.cycleMessages = [
      { textA: '', textB: null },
      { textA: '', textB: null },
      { textA: '', textB: null },
      { textA: '', textB: null },
    ];
    this.cyclePeopleExpanded = false;
    this.cycleMetricsExpanded = false;
    this.cycleMetricsView = null;
    this.retomarSummaryView = null;
    this.retomarSummaryPeriodDays = 7;
    this.cycleSendMode = 'A';
    this.isAgenticSectionExpanded = true;
    this.selectedAgenticRangeIndex = null;
    this.agenticHiddenChatIds.clear();
    this.agenticChecked.clear();
    this.agenticDraftByChatId.clear();
    this.agenticBulkGenerating = false;
    this.agenticRegeneratingId = null;

    try {
      await this.loadConfig();
      // Timeout de 12s para loadInactiveClients — não travar o painel se WA Web demorar
      try {
        await Promise.race([
          this.loadInactiveClients(),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout (12s)')), 12_000)
          ),
        ]);
      } catch (e) {
        console.warn('[RETOMAR] loadInactiveClients falhou, renderizando sem clientes:', e);
      }
      // Inicializar dia selecionado com o primeiro da régua
      if (!this.selectedInactiveDay) {
        this.selectedInactiveDay = this.cadenceDays[0] || 21;
      }
      this.renderContent();
      this.updateStats();
    } catch (error) {
      console.error('[RETOMAR] Erro ao renderizar painel:', error);
      panel.innerHTML = `
        <div class="mettri-error">
          <p>Erro ao carregar painel de retomada.</p>
          <p>Verifique o console para mais detalhes.</p>
          <pre>${error instanceof Error ? error.message : String(error)}</pre>
        </div>
      `;
    }

    return panel;
  }

  /**
   * Obtém o accountId atual (WID do usuário) para isolar listas por conta.
   */
  private async getAccountId(): Promise<string> {
    try {
      // Tentar obter do storage (mesma chave usada por UserSessionManager)
      const result = await this.bridge.storageGet(['mettri_current_user_wid']);
      const wid = result.mettri_current_user_wid as string | undefined;
      if (wid && typeof wid === 'string') {
        // Sanitizar WID para usar como chave (remover caracteres especiais)
        return wid.replace(/[^a-zA-Z0-9]/g, '_');
      }
    } catch (error) {
      console.error('[RETOMAR] Erro ao obter accountId:', error);
    }
    // Fallback: usar 'default' se não conseguir obter WID
    return 'default';
  }

  /**
   * Carrega configuração da régua via bridge (chrome.storage não disponível em world: MAIN).
   */
  private async loadConfig(): Promise<void> {
    try {
      const result = await this.bridge.storageGet([
        'retomarCadence',
        'retomarTestContact',
        'retomarTestModeEnabled',
        'retomarActivitySource',
      ]);

      if (result.retomarCadence && Array.isArray(result.retomarCadence)) {
        this.cadenceDays = result.retomarCadence;
      }

      if (result.retomarTestContact && typeof result.retomarTestContact === 'object') {
        const t = result.retomarTestContact as { phone?: string; name?: string };
        if (typeof t.phone === 'string' && typeof t.name === 'string') {
          this.testContact = { phone: t.phone, name: t.name };
        }
      }

      if (typeof result.retomarTestModeEnabled === 'boolean') {
        this.testModeEnabled = result.retomarTestModeEnabled;
      }

      if (
        result.retomarActivitySource === 'last-message' ||
        result.retomarActivitySource === 'last-purchase' ||
        result.retomarActivitySource === 'last-purchase-import'
      ) {
        this.selectedActivitySource = result.retomarActivitySource;
      }

      // Inicializar gerenciador de listas
      this.accountId = await this.getAccountId();
      this.listsManager = new RetomarListsManager(this.accountId);
      await this.listsManager.initialize();
      this.lists = this.listsManager.getLists();

      // Carregar snapshot de import XLSX (se existir)
      this.purchaseImportSnapshot = await loadSnapshot(this.accountId);

      // Carregar estado de envio em background
      const queueResult = await this.bridge.storageGet([
        this.STORAGE_KEY_QUEUE,
        this.STORAGE_KEY_PAUSED,
      ]);

      if (queueResult[this.STORAGE_KEY_QUEUE] && Array.isArray(queueResult[this.STORAGE_KEY_QUEUE])) {
        this.sendingQueue = queueResult[this.STORAGE_KEY_QUEUE] as string[];
      }

      const pausedState = queueResult[this.STORAGE_KEY_PAUSED];
      if (typeof pausedState === 'boolean') {
        this.isPaused = pausedState;
      }

      // Se há fila pendente, iniciar processamento em background
      if (this.sendingQueue.length > 0 && !this.isPaused) {
        this.startBackgroundProcessing();
      }
    } catch (error) {
      console.error('[RETOMAR] Erro ao carregar configuração:', error);
      // Não chamar addLog aqui pois o container ainda não foi renderizado
    }
  }

  /**
   * Salva configuração da régua via bridge (chrome.storage não disponível em world: MAIN).
   */
  private async saveConfig(): Promise<void> {
    try {
      await this.bridge.storageSet({
        retomarCadence: this.cadenceDays,
        retomarTestContact: this.testContact,
        retomarTestModeEnabled: this.testModeEnabled,
        retomarActivitySource: this.selectedActivitySource,
      });
      if (this.container) {
        this.addLog('success', 'Configuração salva com sucesso');
      }
    } catch (error) {
      console.error('[RETOMAR] Erro ao salvar configuração:', error);
      if (this.container) {
        this.addLog('error', 'Erro ao salvar configuração');
      }
    }
  }

  /**
   * Carrega clientes inativos (REAL via IndexedDB).
   *
   * Nova regra:
   * - última atividade é plugável (última mensagem ou última compra)
   * - elegível quando daysInactive cai em alguma faixa da régua (por tipo de relação)
   * - distância mínima entre nossas mensagens respeitada (última mensagem ENVIADA)
   * - clientes em etiquetas são filtrados (não aparecem no modo dia)
   * - cache de clientes preserva nomes originais para evitar alteração ao alternar modos
   */
  private async loadInactiveClients(): Promise<void> {
    const now = new Date();
    const lastActivityByChat = await this.buildLastActivityByChat(this.selectedActivitySource);
    const idbLastOutgoing = await messageDB.getLastOutgoingByContact();
    const retomarOutgoingStored = await getLastRetomarOutgoingMap(this.accountId);
    let skipOutgoingForDebug = false;
    try {
      skipOutgoingForDebug =
        typeof localStorage !== 'undefined' &&
        localStorage.getItem(DEBUG_RETOMAR_SKIP_OUTGOING_KEY) === '1';
    } catch {
      skipOutgoingForDebug = false;
    }

    let lastOutgoingForEngine = new Map<string, LastOutgoingEntry>();
    if (!skipOutgoingForDebug) {
      // Two-pass: passada 1 usa apenas IDB + retomar storage (sem WA)
      lastOutgoingForEngine = mergeLastOutgoingMaps(
        idbLastOutgoing,
        retomarOutgoingStored,
      );
    }
    const contadorByChat = await retomarContador.getContadorMap(this.accountId);
    const chatIdsInLists = this.getChatIdsInListsSet();

    // Determinar réguas e distância mínima a partir do tipo de relação
    const relationType = this.selectedRelationType ?? 'frequente';
    const ranges = getRangesForType(relationType, this.customRelationIntervalDays);
    const minDistance = getMinDistanceForType(relationType, this.customRelationIntervalDays);

    // Manter cadenceDays existente, mas agora derivado dos mínimos das faixas (compatibilidade UI antiga)
    this.cadenceDays = ranges.map(r => r.min);

    // Métrica simples (contatos com data de referência disponível na fonte escolhida)
    this.totalContacts = lastActivityByChat.size;

    const clients: InactiveClient[] = [];

    let { eligible: eligibleFromEngine, stats: eligibilityStats } = computeEligibleContactsDiagnostics({
      now,
      lastActivityByChat,
      lastOutgoingByContact: lastOutgoingForEngine,
      contadorByChat,
      ranges,
      minDistance,
      chatIdsInLists,
    });

    // Two-pass: passada 2 - WA fallback apenas para elegíveis sem dado
    if (!skipOutgoingForDebug) {
      const semOutgoing = eligibleFromEngine.filter(e => !lastOutgoingForEngine.has(e.chatId));
      if (semOutgoing.length > 0) {
        try {
          const waMap = await getLastOutgoingFromWhatsAppForChatIds(
            semOutgoing.map(e => e.chatId)
          );
          // Pós-filtro: remover quem WA mostra com daysSinceOutgoing < minDistance
          const toRemove = new Set<string>();
          for (const [chatId, waDate] of waMap) {
            const daysSince = daysBetweenByCalendar(now, waDate);
            if (daysSince < minDistance) {
              toRemove.add(chatId);
            }
          }
          eligibleFromEngine = eligibleFromEngine.filter(e => !toRemove.has(e.chatId));
        } catch (e) {
          console.warn('[RETOMAR] Pós-filtro WA falhou:', e);
        }
      }
    }

    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem(DEBUG_RETOMAR_ELIGIBILITY_KEY) === '1') {
        const s = eligibilityStats;
        const bloqFala = s.recentOutgoingBlockedPerRange;
        const faixaStr = ranges.map((r, i) => `[${i}]${r.min}-${r.max}`).join(' ');
        // Uma linha sempre legível (Chrome costuma colapsar objetos como "Object").
        // eslint-disable-next-line no-console
        console.info(
          `[RETOMAR] elegibilidade mapa=${lastActivityByChat.size} scan=${s.totalScanned} entram=${s.included} | ` +
            `lista=${s.excludedInList} foraRégua=${s.excludedOutsideRegua} fala<${minDistance}d=${s.excludedRecentOutgoing} ` +
            `(porFaixa:${bloqFala.join(',')}) | cnt4=${s.excludedContadorComplete} cnt≠faixa=${s.excludedContadorMismatch} ` +
            `diasNeg=${s.excludedNegativeDays} | rel=${relationType} src=${this.selectedActivitySource} | faixas ${faixaStr}` +
            ` | skipFala=${skipOutgoingForDebug ? '1' : '0'}`
        );
        // eslint-disable-next-line no-console
        console.info(
          '[RETOMAR] elegibilidade (debug JSON)\n' +
            JSON.stringify(
              {
                stats: eligibilityStats,
                relationType,
                minDistance,
                activitySource: this.selectedActivitySource,
                mapSize: lastActivityByChat.size,
                skipOutgoingDebug: skipOutgoingForDebug,
                faixas: ranges.map((r, i) => ({ i, min: r.min, max: r.max })),
              },
              null,
              2
            )
        );
        // eslint-disable-next-line no-console
        console.info(
          `[RETOMAR] Desligar debug eleg.: localStorage.removeItem("${DEBUG_RETOMAR_ELIGIBILITY_KEY}")` +
            ` · skip fala: removeItem("${DEBUG_RETOMAR_SKIP_OUTGOING_KEY}")`
        );
      }
    } catch {
      /* localStorage indisponível */
    }

    // Resolver nome via ClientDB (fonte forte) + fallback WhatsApp com “peneira”
    for (const value of eligibleFromEngine) {
      const rawBeforeAt = value.chatId.split('@')[0] || '';
      const phone = rawBeforeAt.replace(/\D+/g, '');
      const firstName = await this.resolveFirstName(phone, value.chatName);

      const client: InactiveClient = {
        chatId: value.chatId,
        chatName: value.chatName,
        phone,
        lastMessageTime: lastActivityByChat.get(value.chatId)?.date ?? now,
        daysInactive: value.daysInactive,
        cadenceDay: value.rangeIndex,
        status: 'pending',
        firstName,
      };
      clients.push(client);
      // Cache: preservar nome original para evitar alteração ao alternar modos
      this.clientsCache.set(value.chatId, { ...client });
    }

    // Ordenar por mais “frios” primeiro (opcional, mas útil)
    clients.sort((a, b) => b.daysInactive - a.daysInactive);

    this.eligibleClients = clients;

    // Ciclos de contato: nenhum ciclo "aberto" por padrão; o container expandido só aparece ao clicar numa linha.
    // (selectedRangeIndex permanece null até o usuário clicar em um ciclo.)

    // Também manter selectedInactiveDay para compatibilidade com partes antigas da UI.
    if (!this.selectedInactiveDay) {
      const selectedRange = ranges[this.selectedRangeIndex ?? 0] ?? ranges[0];
      this.selectedInactiveDay = selectedRange?.min ?? this.cadenceDays[0] ?? 21;
    }

    this.eligibleCount = this.eligibleClients.filter(c => c.status === 'pending' && !c.isSpecialList).length;
    this.calculatePeriodFilters();
    // Resetar seleção para evitar acúmulo de IDs antigos entre recargas.
    this.selectedClients.clear();
    // Só pré-selecionar clientes quando um ciclo estiver aberto (clicado); senão lista fica vazia.
    if (this.selectedRangeIndex != null) {
      const activeRange = ranges[this.selectedRangeIndex];
      if (activeRange) {
        this.eligibleClients
          .filter(c =>
            isInRange(c.daysInactive, activeRange) &&
            c.status === 'pending' &&
            !c.isSpecialList
          )
          .forEach(c => this.selectedClients.add(c.chatId));
      }
    }
    this.updateStats();
    await this.loadRetomarSummaryMetrics();
  }

  private async buildLastActivityByChat(source: ActivitySource): Promise<Map<string, LastActivityEntry>> {
    if (source === 'last-purchase') {
      const [lastPurchaseByContact, lastIncomingByContact] = await Promise.all([
        purchaseDB.getLastActiveByContact(),
        messageDB.getLastIncomingByContact(),
      ]);

      const map = new Map<string, LastActivityEntry>();
      for (const purchase of lastPurchaseByContact.values()) {
        const fallbackName = purchase.chatId.split('@')[0] || purchase.chatId;
        map.set(purchase.chatId, {
          chatId: purchase.chatId,
          chatName: lastIncomingByContact.get(purchase.chatId)?.chatName || fallbackName,
          date: purchase.purchaseDate,
        });
      }
      return map;
    }

    if (source === 'last-purchase-import') {
      if (!this.purchaseImportSnapshot || this.purchaseImportSnapshot.rows.length === 0) {
        return new Map();
      }
      const lastIncomingByContact = await messageDB.getLastIncomingByContact();
      const { lastActivityByChat, unmatchedCount } = resolveLastActivityFromSnapshot(
        this.purchaseImportSnapshot.rows,
        lastIncomingByContact
      );
      this.purchaseImportSummary = {
        totalRows: this.purchaseImportSnapshot.rows.length,
        matchedCount: lastActivityByChat.size,
        unmatchedCount,
        importedAt: this.purchaseImportSnapshot.importedAt,
        filename: this.purchaseImportSnapshot.filename,
      };
      return lastActivityByChat;
    }

    const lastIncomingByContact = await messageDB.getLastIncomingByContact();
    const map = new Map<string, LastActivityEntry>();
    for (const value of lastIncomingByContact.values()) {
      map.set(value.chatId, {
        chatId: value.chatId,
        chatName: value.chatName,
        date: value.lastIncomingAt,
      });
    }
    return map;
  }

  private getChatIdsInListsSet(): Set<string> {
    const clientsInLists = new Set<string>();
    if (!this.listsManager) return clientsInLists;
    for (const list of this.lists) {
      const members = this.listsManager.getMembers(list.id);
      members.forEach(chatId => clientsInLists.add(chatId));
    }
    return clientsInLists;
  }

  private async resolveFirstName(phone: string, fallbackChatName: string): Promise<string> {
    let firstName = '';

    // 1) Fonte forte: cadastro
    try {
      // Tentar bater com/sem 55 e com/sem 9.
      const normalized = normalizePhoneDigitsWithAliases(phone);
      const candidates = Array.from(new Set([normalized.phoneDigits, ...normalized.aliasesDigits].filter(Boolean)));

      let record: {
        firstName?: string;
        fullName?: string;
        nickname?: string;
      } | null = null;
      for (const d of candidates) {
        record = (await clientDB.getByPhoneDigits(d)) || (await clientDB.getByKey(d));
        if (record) break;
      }

      const candidate = (record?.firstName || record?.fullName || record?.nickname || '').trim();
      if (candidate) {
        const classified = classifyNameCandidate(candidate);
        firstName = classified.kind === 'person' ? this.extractFirstName(classified.firstName) : '';
      }
    } catch {
      // ignore
    }

    // 2) Fonte fraca: WhatsApp (com peneira)
    if (!firstName) {
      const classified = classifyNameCandidate(fallbackChatName);
      if (classified.kind === 'person') {
        firstName = this.extractFirstName(classified.firstName);
      } else {
        firstName = ''; // empresa/ruído -> não usar nome
      }
    }

    return firstName;
  }

  /**
   * Busca clientes a partir dos membros de uma lista (modo etiqueta).
   * Preserva nome original do cache quando disponível para evitar alteração ao alternar modos.
   */
  private async getClientsFromListMembers(listId: string): Promise<InactiveClient[]> {
    if (!this.listsManager) return [];
    const chatIds = this.listsManager.getMembers(listId);
    const result: InactiveClient[] = [];
    const now = new Date();
    for (const chatId of chatIds) {
      // Tentar usar cache primeiro para preservar nome original
      const cached = this.clientsCache.get(chatId);
      if (cached) {
        result.push({
          ...cached,
          listIds: [listId],
          daysInactive: 0, // Modo etiqueta não usa dias
          cadenceDay: 0,
        });
        continue;
      }
      
      // Fallback: buscar do ClientDB se não estiver no cache
      const rawBeforeAt = chatId.split('@')[0] || '';
      const phone = rawBeforeAt.replace(/\D+/g, '');
      let chatName = phone || chatId;
      let firstName = '';
      try {
        const record = await clientDB.getByWhatsAppChatId(chatId);
        if (record) {
          const candidate = (record.firstName || record.fullName || record.nickname || '').trim();
          if (candidate) {
            const classified = classifyNameCandidate(candidate);
            firstName = classified.kind === 'person' ? this.extractFirstName(classified.firstName) : '';
          }
          chatName = (record.fullName || record.nickname || record.firstName || chatName).trim() || chatName;
        }
      } catch {
        // ignore
      }
      const client: InactiveClient = {
        chatId,
        chatName,
        phone,
        lastMessageTime: now,
        daysInactive: 0,
        cadenceDay: 0,
        status: 'pending',
        firstName: firstName || undefined,
        listIds: [listId],
      };
      result.push(client);
      // Atualizar cache
      this.clientsCache.set(chatId, { ...client });
    }
    return result;
  }

  /**
   * Converte telefone para chatId (formato WhatsApp: 5511999999999@c.us).
   */
  private phoneToChatId(phone: string): string {
    const d = digitsOnly(phone);
    if (!d) return '';
    let digits = d;
    if ((d.length === 10 || d.length === 11) && !d.startsWith('55')) {
      digits = '55' + d;
    }
    return `${digits}@c.us`;
  }


  /**
   * Atualiza estatísticas e visão geral.
   */
  private updateStats(): void {
    this.stats.totalEligible = this.eligibleClients.length;
    this.stats.selected = this.selectedClients.size;

    // MOCK: Calcular estatísticas dos dados mock
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Contar mensagens enviadas hoje (mock: baseado em status 'sent')
    this.stats.sentToday = this.eligibleClients.filter(c => c.status === 'sent').length;

    // Calcular taxa de resposta (mock: baseado em status 'responded')
    const respondedCount = this.eligibleClients.filter(c => c.status === 'responded').length;
    const sentCount = this.eligibleClients.filter(c => c.status === 'sent' || c.status === 'responded').length;
    this.stats.responseRate = sentCount > 0 ? Math.round((respondedCount / sentCount) * 100) : 0;

    // TODO: Implementar contagem real de mensagens enviadas hoje (buscar no IndexedDB)
    // TODO: Implementar cálculo real de taxa de resposta (buscar histórico de envios/respostas)

    // Atualizar fluxo unificado
    this.updateUnifiedFlow();
  }

  /**
   * Atualiza seção unificada de inativos (mantido para compatibilidade).
   */
  public updateUnifiedInactive(): void {
    this.updateUnifiedFlow();
  }

  /**
   * Atualiza o fluxo unificado completo (inativos + régua + lista + ações).
   */
  private updateUnifiedFlow(): void {
    if (!this.container) return;

    // Usar seletor mais específico para evitar conflitos
    const unifiedContainer = this.container.querySelector('.mettri-retomar-unified-flow') ||
      this.container.querySelector('.flex.flex-col.gap-4');
    if (unifiedContainer) {
      unifiedContainer.innerHTML = this.renderUnifiedFlow();
      // Reconfigurar listeners após atualizar HTML
      this.setupUnifiedFlowListeners();
      // Posicionar dropdowns abertos usando position: fixed
      this.positionKebabDropdowns();
      this.positionListMenus();
    }
  }

  /**
   * Posiciona dropdowns do kebab menu usando position: fixed para evitar scroll.
   */
  private positionKebabDropdowns(): void {
    if (!this.openMenuId || !this.container) return;

    const kebabButton = this.container.querySelector(`[data-kebab-menu="${this.openMenuId}"]`) as HTMLElement;
    const dropdown = this.container.querySelector(`[data-kebab-dropdown="${this.openMenuId}"]`) as HTMLElement;

    if (kebabButton && dropdown) {
      const buttonRect = kebabButton.getBoundingClientRect();
      
      // Calcular posição fixa relativa à viewport
      const top = buttonRect.bottom + 4; // mt-1 = 4px
      const right = window.innerWidth - buttonRect.right;
      
      dropdown.style.position = 'fixed';
      dropdown.style.top = `${top}px`;
      dropdown.style.right = `${right}px`;
      dropdown.style.left = 'auto';
      dropdown.style.bottom = 'auto';
      dropdown.style.margin = '0';
      dropdown.style.zIndex = '9999';
    }
  }

  /**
   * Posiciona menus de lista (etiquetas) usando position: fixed para evitar scroll.
   */
  private positionListMenus(): void {
    if (!this.listMenuOpenId || !this.container) return;

    const listMenuButton = this.container.querySelector(`[data-list-menu="${this.listMenuOpenId}"]`) as HTMLElement;
    const dropdown = this.container.querySelector(`[data-list-menu-dropdown="${this.listMenuOpenId}"]`) as HTMLElement;

    if (listMenuButton && dropdown) {
      const buttonRect = listMenuButton.getBoundingClientRect();
      
      // Calcular posição fixa relativa à viewport
      const top = buttonRect.bottom + 4; // mt-1 = 4px
      const right = window.innerWidth - buttonRect.right;
      
      dropdown.style.position = 'fixed';
      dropdown.style.top = `${top}px`;
      dropdown.style.right = `${right}px`;
      dropdown.style.left = 'auto';
      dropdown.style.bottom = 'auto';
      dropdown.style.margin = '0';
      dropdown.style.zIndex = '9999';
    }
  }

  /**
   * Configura listeners do fluxo unificado completo.
   */
  private setupUnifiedFlowListeners(): void {
    this.setupRelationTypeListeners();
    this.setupActivitySourceListeners();
    this.setupPeriodFiltersListeners();
    this.setupAgenticListeners();
    this.setupContactsListeners();
    this.setupMessageInputListeners();
    this.setupHeaderActionsListeners();
    this.setupTestSectionListeners();
    this.setupSendButtonListener();
    this.setupListsListeners();
    this.setupRetomarSummaryMetricsListener();
    this.setupRetomarOutcomeExportListener();
    this.setupPurchaseImportListener();
  }

  /**
   * Listeners do bloco Tipo de relação (abrir/fechar dropdown, fechar ao clicar fora, selecionar opção).
   */
  private setupRelationTypeListeners(): void {
    const wrapper = this.container?.querySelector('[data-relation-type-wrapper]');
    const trigger = this.container?.querySelector('[data-relation-trigger]');
    const dropdown = this.container?.querySelector('#retomar-relation-type-dropdown');

    trigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.relationTypeDropdownOpen = !this.relationTypeDropdownOpen;
      this.updateUnifiedFlow();
    });

    if (this.relationTypeDropdownOpen && dropdown && trigger) {
      if (this.closeRelationDropdownHandler) {
        document.removeEventListener('click', this.closeRelationDropdownHandler);
        this.closeRelationDropdownHandler = null;
      }
      const closeRelation = (e: MouseEvent) => {
        if (!dropdown.contains(e.target as Node) && !trigger.contains(e.target as Node)) {
          this.relationTypeDropdownOpen = false;
          this.updateUnifiedFlow();
          document.removeEventListener('click', closeRelation);
          this.closeRelationDropdownHandler = null;
        }
      };
      this.closeRelationDropdownHandler = closeRelation;
      document.addEventListener('click', closeRelation);
    }

    this.container?.querySelectorAll('[data-relation-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (e.currentTarget as HTMLElement).dataset.relationId;
        if (id) {
          this.selectedRelationType = id as RelationType;
          // Atualizar UI auxiliar do modo Personalizado (sem alterar cadenceDays).
          if (id === 'personalizado') {
            this.customRelationIntervalDays = this.getDefaultCustomIntervalDays();
          } else {
            this.customRelationIntervalDays = null;
            this.isCustomCadenceExpanded = false;
          }
          // Ao mudar o tipo de relação, recarregar clientes e resetar faixa selecionada.
          this.selectedRangeIndex = 0;
          this.relationTypeDropdownOpen = false;
          this.loadInactiveClients().then(() => {
            this.updateUnifiedFlow();
          }).catch(error => {
            console.error('[RETOMAR] Erro ao recarregar clientes ao mudar tipo de relação:', error);
            this.updateUnifiedFlow();
          });
        }
      });
    });

    // Listener do campo "Falar a cada X dias" (modo Personalizado).
    const customIntervalInput = this.container?.querySelector<HTMLInputElement>('#retomar-custom-interval');
    if (customIntervalInput) {
      customIntervalInput.addEventListener('input', () => {
        const value = parseInt(customIntervalInput.value, 10);
        if (Number.isFinite(value) && value > 0) {
          this.customRelationIntervalDays = value;
          // Recarregar clientes ao alterar intervalo personalizado.
          this.selectedRangeIndex = 0;
          this.loadInactiveClients().then(() => {
            this.updateUnifiedFlow();
          }).catch(error => {
            console.error('[RETOMAR] Erro ao recarregar clientes ao alterar intervalo personalizado:', error);
            this.updateUnifiedFlow();
          });
        } else {
          this.customRelationIntervalDays = null;
        }
      });
    }

    // Toggle do painel avançado "Ajustar dias da régua".
    const customCadenceToggle = this.container?.querySelector<HTMLButtonElement>('#retomar-custom-cadence-toggle');
    if (customCadenceToggle) {
      customCadenceToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.isCustomCadenceExpanded = !this.isCustomCadenceExpanded;
        this.updateUnifiedFlow();
      });
    }
  }

  private setupActivitySourceListeners(): void {
    const trigger = this.container?.querySelector('[data-activity-source-trigger]');
    const dropdown = this.container?.querySelector('[data-activity-source-dropdown]');
    const wrapper = this.container?.querySelector('[data-activity-source-wrapper]');

    trigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.activitySourceDropdownOpen = !this.activitySourceDropdownOpen;
      this.updateUnifiedFlow();
    });

    if (this.activitySourceDropdownOpen && dropdown && trigger && wrapper) {
      if (this.closeActivitySourceDropdownHandler) {
        document.removeEventListener('click', this.closeActivitySourceDropdownHandler);
        this.closeActivitySourceDropdownHandler = null;
      }
      const closeActivity = (e: MouseEvent) => {
        if (!wrapper.contains(e.target as Node)) {
          this.activitySourceDropdownOpen = false;
          this.updateUnifiedFlow();
          document.removeEventListener('click', closeActivity);
          this.closeActivitySourceDropdownHandler = null;
        }
      };
      this.closeActivitySourceDropdownHandler = closeActivity;
      document.addEventListener('click', closeActivity);
    }

    this.container?.querySelectorAll('[data-activity-source-option]').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = (e.currentTarget as HTMLElement).dataset.activitySourceId;
        if (id !== 'last-message' && id !== 'last-purchase' && id !== 'last-purchase-import') return;

        this.selectedActivitySource = id;
        this.activitySourceDropdownOpen = false;
        this.selectedRangeIndex = 0;
        this.saveConfig();

        try {
          await this.loadInactiveClients();
        } catch (error) {
          console.error('[RETOMAR] Erro ao recarregar clientes ao mudar fonte de atividade:', error);
        }
        this.updateUnifiedFlow();
      });
    });
  }

  private setupRetomarSummaryMetricsListener(): void {
    const sel = this.container?.querySelector<HTMLSelectElement>('#retomar-summary-metrics-period');
    sel?.addEventListener('change', async () => {
      this.retomarSummaryPeriodDays = parseInt(sel.value, 10) || 7;
      this.retomarSummaryView = { kind: 'loading' };
      this.updateUnifiedFlow();
      await this.loadRetomarSummaryMetrics();
      this.updateUnifiedFlow();
    });
  }

  private setupRetomarOutcomeExportListener(): void {
    const btn = this.container?.querySelector<HTMLButtonElement>('#retomar-export-outcomes-btn');
    btn?.addEventListener('click', () => {
      void this.handleRetomarOutcomeExport();
    });
  }

  /** Exporta outcomes Retomar respondidos (JSONL) no mesmo período do seletor de métricas resumo. */
  private async handleRetomarOutcomeExport(): Promise<void> {
    const btn = this.container?.querySelector<HTMLButtonElement>('#retomar-export-outcomes-btn');
    if (btn) btn.disabled = true;
    try {
      const since = new Date(Date.now() - this.retomarSummaryPeriodDays * 24 * 60 * 60 * 1000);
      const until = new Date();
      const exportBridge = new MettriBridgeClient(120_000);
      const { writer, exportStateStore } = createRetomarOutcomeBridgeDeps(this.accountId, exportBridge);
      const r = await retomarOutcomeExporter({
        accountId: this.accountId,
        since,
        until,
        messageDB,
        writer,
        exportStateStore,
      });
      if (r.exportedCount > 0) {
        this.addLog(
          'success',
          `Frases exportadas: ${r.exportedCount} linha(s) nova(s) em ${r.filePath}. (${r.skippedCount} envio(s) já estavam no arquivo.)`,
        );
      } else if (r.skippedCount > 0) {
        this.addLog(
          'info',
          `Nada de novo para exportar: ${r.skippedCount} envio(s) deste período já estavam exportados.`,
        );
      } else {
        this.addLog(
          'info',
          'Nenhum envio Retomar com resposta neste período — nada para exportar.',
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.addLog('error', `Exportar frases: ${msg}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  private setupPurchaseImportListener(): void {
    const input = this.container?.querySelector<HTMLInputElement>('#retomar-xlsx-import-input');
    input?.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        await this.handlePurchaseImportFile(file);
      } catch (err) {
        this.addLog('error', `Erro ao importar XLSX: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      }
      // Limpar para permitir reimport do mesmo ficheiro
      input.value = '';
    });
  }

  private async handlePurchaseImportFile(file: File): Promise<void> {
    this.addLog('info', `Importando "${file.name}"…`);
    const buffer = await file.arrayBuffer();
    const lastIncoming = await messageDB.getLastIncomingByContact();
    const result = parseListaClientesXlsx(buffer, lastIncoming, file.name);

    this.purchaseImportSnapshot = result.snapshot;
    await saveSnapshot(this.accountId, result.snapshot);

    const matched = result.lastActivityByChat.size;
    const total = result.snapshot.rows.length;
    this.purchaseImportSummary = {
      totalRows: total,
      matchedCount: matched,
      unmatchedCount: result.warnings.unmatchedCount,
      importedAt: result.snapshot.importedAt,
      filename: file.name,
    };

    const msg = `Lista importada: ${total} linha(s), ${matched} com chat encontrado, ${result.warnings.unmatchedCount} sem match.`;
    this.addLog('success', msg);

    if (result.warnings.unmatchedCount > 0 && result.warnings.samples.length > 0) {
      this.addLog('warning', `Telefones sem chat: ${result.warnings.samples.join(', ')}${result.warnings.unmatchedCount > 5 ? ' …' : ''}`);
    }

    // Recarregar lista com a nova fonte
    this.selectedActivitySource = 'last-purchase-import';
    await this.loadInactiveClients();
    this.updateUnifiedFlow();
  }

  /**
   * Configura listener do botão de enviar.
   */
  private setupSendButtonListener(): void {
    const sendBtn = this.container?.querySelector('#retomar-send-selected');
    sendBtn?.addEventListener('click', async () => {
      if (sendBtn.hasAttribute('disabled')) return;

      const btn = sendBtn as HTMLButtonElement;
      btn.disabled = true;
      try {
        await this.sendSelectedClients();
      } catch (error) {
        this.addLog('error', `Erro ao enviar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      } finally {
        btn.disabled = false;
      }
    });

    const pauseBtn = this.container?.querySelector('#retomar-pause-resume');
    pauseBtn?.addEventListener('click', () => {
      if (this.isPaused) {
        this.resumeSending();
      } else {
        this.pauseSending();
      }
    });
  }

  /**
   * Configura listeners da seção de listas.
   */
  private setupListsListeners(): void {
    // Toggle expandir/colapsar listas (título/área do header)
    const listsToggle = this.container?.querySelector('[data-lists-toggle]');
    listsToggle?.addEventListener('click', () => {
      this.listsExpanded = !this.listsExpanded;
      this.updateUnifiedFlow();
    });

    /**
     * Clique no chip da etiqueta: alternar entre modo dia e modo etiqueta.
     * - Clicar na mesma etiqueta novamente volta ao modo dia.
     * - Modo etiqueta: carrega membros da etiqueta selecionada.
     * - Modo dia: recarrega clientes elegíveis para garantir sincronização.
     */
    const listChips = this.container?.querySelectorAll('[data-list-select]');
    listChips?.forEach((el) => {
      el.addEventListener('click', async (e) => {
        // Não alternar se clicar no kebab menu (⋯)
        if ((e.target as HTMLElement).closest('[data-list-menu]')) return;
        const listId = (el as HTMLElement).dataset.listSelect ?? null;
        if (!listId) return;
        const next = this.selectedListId === listId ? null : listId;
        this.selectedListId = next;
        if (this.selectedListId && this.listsManager) {
          // Modo etiqueta: carregar membros da etiqueta
          this.labelModeClients = await this.getClientsFromListMembers(this.selectedListId);
        } else {
          // Modo dia: limpar lista de etiqueta e garantir que eligibleClients está atualizado
          this.labelModeClients = [];
          await this.loadInactiveClients();
        }
        this.updateUnifiedFlow();
      });
    });

    // Criar nova lista (header + botão "Nova lista" — ambos abrem o mesmo diálogo)
    const createListBtns = this.container?.querySelectorAll('[data-create-list]');
    createListBtns?.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.showCreateListDialog();
      });
    });

    // Menu de lista (kebab)
    const listMenuButtons = this.container?.querySelectorAll('[data-list-menu]');
    listMenuButtons?.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const listId = (btn as HTMLElement).dataset.listMenu;
        if (listId) {
          // Toggle menu
          if (this.listMenuOpenId === listId) {
            this.listMenuOpenId = null;
          } else {
            this.listMenuOpenId = listId;
          }
          this.updateUnifiedFlow();
          // Aguardar próximo frame para garantir que o DOM foi atualizado
          requestAnimationFrame(() => {
            this.positionListMenus();
          });
        }
      });
    });

    // Ações do menu de lista
    const viewMembersBtn = this.container?.querySelector('[data-list-action="view-members"]');
    viewMembersBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const listId = (e.currentTarget as HTMLElement).dataset.listId;
      if (listId && this.listsManager) {
        const members = this.listsManager.getMembers(listId);
        const list = this.lists.find(l => l.id === listId);
        alert(`${list?.name || 'Lista'}: ${members.length} membro(s)`);
        this.listMenuOpenId = null;
        this.updateUnifiedFlow();
      }
    });

    const renameBtn = this.container?.querySelector('[data-list-action="rename"]');
    renameBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const listId = (e.currentTarget as HTMLElement).dataset.listId;
      if (listId) {
        const list = this.lists.find(l => l.id === listId);
        if (list?.isDefault) {
          alert('Etiqueta padrão não pode ser renomeada.');
          this.listMenuOpenId = null;
          this.updateUnifiedFlow();
          return;
        }
        const newName = prompt('Novo nome da lista:', list?.name || '');
        if (newName && newName.trim() && this.listsManager) {
          try {
            await this.listsManager.renameList(listId, newName.trim());
            this.lists = this.listsManager.getLists();
            this.addLog('success', `Lista renomeada: ${newName.trim()}`);
            this.updateUnifiedFlow();
          } catch (error) {
            this.addLog('error', error instanceof Error ? error.message : 'Erro ao renomear lista');
          }
        }
        this.listMenuOpenId = null;
        this.updateUnifiedFlow();
      }
    });

    const deleteBtn = this.container?.querySelector('[data-list-action="delete"]');
    deleteBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const listId = (e.currentTarget as HTMLElement).dataset.listId;
      if (listId && this.listsManager) {
        const list = this.lists.find(l => l.id === listId);
        if (!list) return;
        if (list.isDefault) {
          alert('Etiqueta padrão não pode ser excluída.');
          this.listMenuOpenId = null;
          this.updateUnifiedFlow();
          return;
        }
        
        const memberCount = list.memberCount || 0;
        const memberText = memberCount === 1 ? '1 pessoa' : `${memberCount} pessoas`;
        const message = memberCount > 0
          ? `Tem certeza que deseja excluir a etiqueta "${list.name}"?\n\nOs ${memberText} nesta etiqueta voltarão ao estado normal (não serão deletados, apenas removidos desta etiqueta).`
          : `Tem certeza que deseja excluir a etiqueta "${list.name}"?`;
        
        if (confirm(message)) {
          try {
            await this.listsManager.deleteList(listId);
            this.lists = this.listsManager.getLists();
            // Se estava visualizando esta etiqueta, voltar ao modo dia
            if (this.selectedListId === listId) {
              this.selectedListId = null;
              this.labelModeClients = [];
            }
            // Recarregar clientes elegíveis para que membros removidos apareçam em Pessoas
            await this.loadInactiveClients();
            this.addLog('success', `Etiqueta "${list.name}" excluída. ${memberCount > 0 ? `${memberText} removida(s) da etiqueta.` : ''}`);
            this.updateUnifiedFlow();
          } catch (error) {
            this.addLog('error', error instanceof Error ? error.message : 'Erro ao excluir etiqueta');
          }
        }
        this.listMenuOpenId = null;
        this.updateUnifiedFlow();
      }
    });

    // Fechar menu ao clicar fora
    document.addEventListener('click', (e) => {
      if (this.listMenuOpenId && !(e.target as HTMLElement).closest('[data-list-menu]') && !(e.target as HTMLElement).closest('[data-list-menu-dropdown]')) {
        this.listMenuOpenId = null;
        this.updateUnifiedFlow();
      }
    });
  }

  /**
   * Mostra diálogo para criar nova lista.
   */
  private async showCreateListDialog(): Promise<void> {
    const name = prompt('Nome da lista:');
    if (!name || !name.trim()) return;

    // Cores disponíveis (8 opções)
    const colors = [
      { var: '--tag-color-1', name: 'Verde' },
      { var: '--tag-color-2', name: 'Azul' },
      { var: '--tag-color-3', name: 'Roxo' },
      { var: '--tag-color-4', name: 'Amarelo' },
      { var: '--tag-color-5', name: 'Laranja' },
      { var: '--tag-color-6', name: 'Vermelho' },
      { var: '--tag-color-7', name: 'Índigo' },
      { var: '--tag-color-8', name: 'Verde-água' },
    ];

    const colorChoice = prompt(`Escolha uma cor (1-8):\n${colors.map((c, i) => `${i + 1}. ${c.name}`).join('\n')}`);
    const colorIndex = parseInt(colorChoice || '1', 10) - 1;
    const selectedColor = colors[colorIndex >= 0 && colorIndex < colors.length ? colorIndex : 0];

    if (this.listsManager) {
      try {
        await this.listsManager.createList(name.trim(), selectedColor.var);
        this.lists = this.listsManager.getLists();
        this.addLog('success', `Lista criada: ${name.trim()}`);
        this.updateUnifiedFlow();
      } catch (error) {
        this.addLog('error', error instanceof Error ? error.message : 'Erro ao criar lista');
      }
    }
  }

  /**
   * Configura listeners da seção de envio de teste.
   */
  private setupTestSectionListeners(): void {
    const checkbox = this.container?.querySelector('#retomar-test-mode') as HTMLInputElement;
    checkbox?.addEventListener('change', () => {
      this.testModeEnabled = !!checkbox.checked;
      this.saveConfig();
      this.updateUnifiedFlow();
    });

    // Salvar automaticamente ao digitar nos campos de teste
    const phoneInput = this.container?.querySelector('#retomar-test-phone') as HTMLInputElement;
    phoneInput?.addEventListener('blur', () => {
      const phone = phoneInput?.value?.trim() ?? '';
      const nameInput = this.container?.querySelector('#retomar-test-name') as HTMLInputElement;
      const name = nameInput?.value?.trim() ?? '';
      const digits = digitsOnly(phone);
      if (digits.length >= 10) {
        this.testContact = { phone, name };
        this.saveConfig();
        this.updateUnifiedFlow();
      }
    });

    const nameInput = this.container?.querySelector('#retomar-test-name') as HTMLInputElement;
    nameInput?.addEventListener('blur', () => {
      const phoneInput = this.container?.querySelector('#retomar-test-phone') as HTMLInputElement;
      const phone = phoneInput?.value?.trim() ?? '';
      const name = nameInput?.value?.trim() ?? '';
      const digits = digitsOnly(phone);
      if (digits.length >= 10) {
        this.testContact = { phone, name };
        this.saveConfig();
        this.updateUnifiedFlow();
      }
    });
  }

  /**
   * Configura listeners do bloco Ciclos de contato (linhas selecionáveis por faixa).
   */
  private setupPeriodFiltersListeners(): void {
    const chamadaRows = this.container?.querySelectorAll('[data-chamada-range-index]');
    chamadaRows?.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const rangeIndexStr = (e.currentTarget as HTMLElement).dataset.chamadaRangeIndex;
        if (rangeIndexStr) {
          const rangeIndex = parseInt(rangeIndexStr, 10);
          if (Number.isFinite(rangeIndex)) {
            this.togglePeriodFilter(rangeIndex);
          }
        }
      });
    });

    // Engrenagem de configuração da régua em Ciclos de contato.
    const chamadasConfigButton = this.container?.querySelector<HTMLButtonElement>('#retomar-filters-kebab');
    if (chamadasConfigButton) {
      chamadasConfigButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.isChamadasConfigOpen = !this.isChamadasConfigOpen;
        this.updateUnifiedFlow();
      });
    }

    // Textareas e botões do painel expandido do ciclo selecionado
    const textAreaA = this.container?.querySelector<HTMLTextAreaElement>('#retomar-cycle-text-a');
    if (textAreaA) {
      textAreaA.addEventListener('input', (e) => {
        if (this.selectedRangeIndex == null) return;
        const value = (e.target as HTMLTextAreaElement).value;
        this.ensureCycleMessagesSize();
        this.cycleMessages[this.selectedRangeIndex] = {
          ...(this.cycleMessages[this.selectedRangeIndex] ?? { textA: '', textB: null }),
          textA: value,
        };
        // Mantém compatibilidade: Texto A do ciclo também alimenta o campo de mensagem principal.
        this.messageText = value;
        this.updateUnifiedFlow();
      });
    }

    const textAreaB = this.container?.querySelector<HTMLTextAreaElement>('#retomar-cycle-text-b');
    if (textAreaB) {
      textAreaB.addEventListener('input', (e) => {
        if (this.selectedRangeIndex == null) return;
        const value = (e.target as HTMLTextAreaElement).value;
        this.ensureCycleMessagesSize();
        this.cycleMessages[this.selectedRangeIndex] = {
          ...(this.cycleMessages[this.selectedRangeIndex] ?? { textA: '', textB: null }),
          textB: value,
        };
      });
    }

    const aiButton = this.container?.querySelector<HTMLButtonElement>('#retomar-cycle-ai');
    if (aiButton) {
      aiButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (this.selectedRangeIndex == null) return;
        this.ensureCycleMessagesSize();
        const current = this.cycleMessages[this.selectedRangeIndex] ?? { textA: '', textB: null };
        const chamadas = this.getChamadasWithCounts();
        const chamada = chamadas[this.selectedRangeIndex];
        const suggestion = await this.suggestMessageByAI({
          textA: current.textA ?? '',
          campaignLabel: chamada?.campaignLabel ?? null,
          relationType: this.selectedRelationType,
        });
        if (!suggestion) return;
        this.cycleMessages[this.selectedRangeIndex] = {
          ...current,
          textB: suggestion,
        };
        this.updateUnifiedFlow();
      });
    }

    const sendCycleBtn = this.container?.querySelector<HTMLButtonElement>('#retomar-cycle-send');
    if (sendCycleBtn) {
      sendCycleBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (sendCycleBtn.hasAttribute('disabled')) return;
        if (this.selectedRangeIndex == null) return;
        this.ensureCycleMessagesSize();
        const current = this.cycleMessages[this.selectedRangeIndex] ?? { textA: '', textB: null };
        const textA = (current.textA ?? '').trim();
        const textB = (current.textB ?? '').trim();
        let messageToSend = textA;
        this.sendingPayloadByChatId.clear();
        if (this.cycleSendMode === 'B') {
          if (!textB) {
            this.addLog('warning', 'Preencha o Texto B ou escolha outro modo de envio.');
            return;
          }
          messageToSend = textB;
        } else if (this.cycleSendMode === 'AB') {
          if (!textB) {
            this.addLog('warning', 'Preencha o Texto B para usar o modo A/B.');
            return;
          }
        }
        const cycleChatIds = this.getCycleClients().filter(c => this.selectedClients.has(c.chatId)).map(c => c.chatId);
        if (cycleChatIds.length === 0) {
          this.addLog('warning', 'Nenhum contato selecionado neste ciclo.');
          return;
        }
        if (this.cycleSendMode === 'AB') {
          const items = splitAB(cycleChatIds, textA, textB);
          for (const item of items) {
            this.sendingPayloadByChatId.set(item.chatId, { text: item.text, variant: item.variant });
          }
          this.messageText = textA;
        } else {
          const fixedVariant: 'A' | 'B' = this.cycleSendMode === 'B' ? 'B' : 'A';
          for (const id of cycleChatIds) {
            this.sendingPayloadByChatId.set(id, { text: messageToSend, variant: fixedVariant });
          }
          this.messageText = messageToSend;
        }
        this.sendingQueue = cycleChatIds.slice();
        cycleChatIds.forEach(id => this.selectedClients.delete(id));
        this.pendingChamadaIndex = this.selectedRangeIndex;
        await this.saveQueueState();
        this.sendingProgress = { total: this.sendingQueue.length, sent: 0, skipped: 0, errors: 0, current: null, startTime: Date.now() };
        this.isSending = true;
        this.addLog('info', `Iniciando envio para ${this.sendingQueue.length} cliente(s)...`);
        this.updateUnifiedFlow();
        await this.processQueue();
      });
    }

    const simulateCycleBtn = this.container?.querySelector<HTMLButtonElement>('#retomar-cycle-simulate');
    if (simulateCycleBtn) {
      simulateCycleBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (simulateCycleBtn.hasAttribute('disabled')) return;
        if (this.selectedRangeIndex == null) return;
        if (!this.testModeEnabled || !this.testContact?.phone) {
          this.addLog('warning', 'Marque "Simular envio" e informe o número de teste para simular.');
          return;
        }
        this.ensureCycleMessagesSize();
        const current = this.cycleMessages[this.selectedRangeIndex] ?? { textA: '', textB: null };
        const textA = (current.textA ?? '').trim();
        const textB = (current.textB ?? '').trim();
        const msg = this.cycleSendMode === 'B' ? textB : textA;
        if (!msg) {
          this.addLog('warning', 'Preencha o texto do ciclo para simular.');
          return;
        }
        // Reutiliza a lógica de envio de teste já existente (spec: "chamar a lógica de envio de teste já existente, usando o texto do ciclo").
        this.messageText = msg;
        await this.sendSelectedClients();
      });
    }

    const cyclePeopleToggle = this.container?.querySelector('[data-cycle-people-toggle]');
    cyclePeopleToggle?.addEventListener('click', () => {
      this.cyclePeopleExpanded = !this.cyclePeopleExpanded;
      this.updateUnifiedFlow();
    });

    const cycleMetricsToggle = this.container?.querySelector('[data-cycle-metrics-toggle]');
    cycleMetricsToggle?.addEventListener('click', async () => {
      this.cycleMetricsExpanded = !this.cycleMetricsExpanded;
      if (this.cycleMetricsExpanded) {
        await this.loadCycleMetrics();
      }
      this.updateUnifiedFlow();
    });

    const metricsPeriodSelect = this.container?.querySelector<HTMLSelectElement>('#retomar-cycle-metrics-period');
    metricsPeriodSelect?.addEventListener('change', async () => {
      this.cycleMetricsPeriodDays = parseInt(metricsPeriodSelect.value, 10) || 7;
      await this.loadCycleMetrics();
      this.updateUnifiedFlow();
    });

    this.container?.querySelectorAll<HTMLInputElement>('input[name="retomar-cycle-send-mode"]').forEach(radio => {
      radio.addEventListener('change', async () => {
        const v = radio.value as 'A' | 'B' | 'AB';
        if (v === 'A' || v === 'B' || v === 'AB') {
          this.cycleSendMode = v;
          this.updateUnifiedFlow();
          if (this.cycleMetricsExpanded && this.selectedRangeIndex != null) {
            await this.loadCycleMetrics();
            this.updateUnifiedFlow();
          }
        }
      });
    });

    // Checkboxes da lista de pessoas do ciclo (dentro do painel do ciclo)
    const detailPanel = this.container?.querySelector('[data-chamada-detail]');
    detailPanel?.querySelectorAll<HTMLInputElement>('.mettri-cycle-people-list input[type="checkbox"][data-chat-id], .retomar-cycle-contact input[type="checkbox"][data-chat-id]').forEach(cb => {
      cb.addEventListener('change', () => {
        const chatId = cb.dataset.chatId;
        if (!chatId) return;
        if (cb.checked) this.selectedClients.add(chatId);
        else this.selectedClients.delete(chatId);
        this.calculatePeriodFilters();
        this.updateUnifiedFlow();
      });
    });
    detailPanel?.querySelectorAll('.retomar-cycle-contact[data-chat-id], .mettri-cycle-people-list [data-chat-id]').forEach(row => {
      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('input') || (e.target as HTMLElement).closest('label')) return;
        const chatId = (row as HTMLElement).dataset.chatId;
        if (!chatId) return;
        const checkbox = row.querySelector<HTMLInputElement>('input[type="checkbox"][data-chat-id]');
        if (checkbox) {
          checkbox.checked = !checkbox.checked;
          if (checkbox.checked) this.selectedClients.add(chatId);
          else this.selectedClients.delete(chatId);
          this.calculatePeriodFilters();
          this.updateUnifiedFlow();
        }
      });
    });
  }

  /**
   * Bloco colapsável Respostas Agênticas (abaixo de Ciclos de contato; acordeão independente).
   */
  private renderAgenticSection(): string {
    const agenticPromptHint = formatAgenteRetomarPromptUpdatedLabel();
    const agenticPromptTitle = this.escapeHtml(AGENTE_RETOMAR_PROMPT_LAST_MODIFIED_ISO);
    const agenticPromptLine = this.escapeHtml(agenticPromptHint);
    return `
      <div class="mettri-agentic-section-wrap space-y-1 mb-0 mt-1">
        <div class="py-2.5 border-b border-border/50 min-w-0 space-y-0.5">
          <button
            class="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
            id="retomar-agentic-section-toggle"
            type="button"
          >
            Respostas Agênticas
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="transition-transform shrink-0 ${this.isAgenticSectionExpanded ? 'rotate-180' : ''}" id="retomar-agentic-chevron" aria-hidden="true">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <p class="text-[10px] text-muted-foreground leading-tight m-0" title="Última modificação do ficheiro no build (UTC): ${agenticPromptTitle}">${agenticPromptLine}</p>
        </div>
        ${this.isAgenticSectionExpanded ? `
          <div id="retomar-agentic-chamadas" class="mettri-chamadas-content">
            ${this.renderAgenticChamadas()}
          </div>
        ` : ''}
      </div>
    `;
  }

  private getAgenticChamadasWithCounts(): {
    id: string;
    label: string;
    day: number;
    count: number;
    selected: boolean;
    campaignLabel: string | null;
    rangeIndex: number;
  }[] {
    const ranges = getRangesForType(this.selectedRelationType, this.customRelationIntervalDays);
    const n = Math.min(ranges.length, CHAMADAS_CONFIG.length);
    if (n === 0) return [];

    const result: {
      id: string;
      label: string;
      day: number;
      count: number;
      selected: boolean;
      campaignLabel: string | null;
      rangeIndex: number;
    }[] = [];

    for (let i = 0; i < n; i++) {
      const range = ranges[i];
      const config = i < CHAMADAS_CONFIG.length - 1 ? CHAMADAS_CONFIG[i] : CHAMADAS_CONFIG[CHAMADAS_CONFIG.length - 1];

      const count = this.eligibleClients.filter(c =>
        isInRange(c.daysInactive, range) &&
        c.status === 'pending' &&
        !c.isSpecialList
      ).length;

      const isOpen = this.selectedAgenticRangeIndex === i;

      result.push({
        id: config.id,
        label: config.label,
        day: range.min,
        count,
        selected: isOpen,
        campaignLabel: config.campaignLabel,
        rangeIndex: i,
      });
    }

    return result;
  }

  private getAgenticCycleClients(): InactiveClient[] {
    if (this.selectedAgenticRangeIndex == null) return [];
    const ranges = getRangesForType(this.selectedRelationType, this.customRelationIntervalDays);
    const range = ranges[this.selectedAgenticRangeIndex];
    if (!range) return [];
    return this.eligibleClients.filter(c =>
      isInRange(c.daysInactive, range) &&
      c.status === 'pending' &&
      !c.isSpecialList &&
      !this.agenticHiddenChatIds.has(c.chatId)
    );
  }

  private toggleAgenticRange(rangeIndex: number): void {
    if (!Number.isFinite(rangeIndex) || rangeIndex < 0) return;

    if (this.selectedAgenticRangeIndex === rangeIndex) {
      this.selectedAgenticRangeIndex = null;
      this.updateUnifiedFlow();
      return;
    }

    const prev = this.selectedAgenticRangeIndex;
    this.selectedAgenticRangeIndex = rangeIndex;

    if (prev !== rangeIndex) {
      const ranges = getRangesForType(this.selectedRelationType, this.customRelationIntervalDays);
      const range = ranges[rangeIndex];
      if (range) {
        this.agenticChecked.clear();
        this.eligibleClients
          .filter(c =>
            isInRange(c.daysInactive, range) &&
            c.status === 'pending' &&
            !c.isSpecialList &&
            !this.agenticHiddenChatIds.has(c.chatId)
          )
          .forEach(c => this.agenticChecked.add(c.chatId));
      }
    }

    this.updateUnifiedFlow();
  }

  private countAgenticSendQualifying(): number {
    if (this.selectedAgenticRangeIndex == null) return 0;
    let n = 0;
    for (const c of this.getAgenticCycleClients()) {
      if (!this.agenticChecked.has(c.chatId)) continue;
      if ((this.agenticDraftByChatId.get(c.chatId) ?? '').trim() !== '') n++;
    }
    return n;
  }

  private renderAgenticChamadas(): string {
    const chamadas = this.getAgenticChamadasWithCounts();
    if (chamadas.length === 0) {
      return '<div class="mettri-chamadas-list text-sm text-muted-foreground">Nenhum dia na régua.</div>';
    }
    return `
      <div class="mettri-chamadas-list mettri-chamadas-accordion mettri-agentic-chamadas" role="list">
        ${chamadas.map(c => `
          <div class="mettri-chamadas-accordion-item" data-agentic-range-item="${c.rangeIndex}">
            <button
              type="button"
              class="mettri-chamadas-row ${c.selected ? 'mettri-chamadas-row-selected' : ''}"
              data-agentic-chamada-id="${this.escapeHtml(c.id)}"
              data-agentic-range-index="${c.rangeIndex}"
              role="listitem"
            >
              <span class="mettri-chamadas-selected-dot ${c.selected ? 'is-active' : 'is-inactive'}" aria-hidden="true"></span>
              <span class="mettri-chamadas-row-label">${this.escapeHtml(c.label)}</span>
              <span class="mettri-chamadas-row-count">${c.count} pessoa${c.count !== 1 ? 's' : ''}</span>
              ${c.campaignLabel ? `
              <span class="mettri-chamadas-campaign-pill" title="Campanha ativa">
                <span class="mettri-dot-accent" aria-hidden="true"></span>
                <span class="mettri-chamadas-campaign-pill-title">${this.escapeHtml(c.campaignLabel)}</span>
              </span>` : ''}
            </button>
            ${c.selected ? this.renderAgenticDetailPanel() : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  private renderAgenticDetailPanel(): string {
    if (this.selectedAgenticRangeIndex == null) return '';

    const chamadas = this.getAgenticChamadasWithCounts();
    const current = chamadas[this.selectedAgenticRangeIndex];
    if (!current) return '';

    const cycleClients = this.getAgenticCycleClients();
    const n = cycleClients.length;
    const checkedForGen = cycleClients.filter(c => this.agenticChecked.has(c.chatId)).length;
    const qualifying = this.countAgenticSendQualifying();
    const sendDisabled = this.testModeEnabled || this.isSending || qualifying === 0;
    const genDisabled = this.isSending || checkedForGen === 0 || this.agenticBulkGenerating;

    const rowsHtml =
      n === 0
        ? `<p class="text-xs text-muted-foreground">Nenhum contato elegível neste ciclo no momento.</p>`
        : cycleClients
            .map(client => {
              const displayLabel = client.firstName || client.phone || 'Sem nome';
              const isSelected = this.agenticChecked.has(client.chatId);
              const draft = this.agenticDraftByChatId.get(client.chatId) ?? '';
              return `
        <div class="rounded-lg border border-border/50 bg-background/40 p-2 space-y-1.5" data-agentic-contact-row="${client.chatId}">
          <div class="flex items-start gap-2">
            <label class="cursor-pointer flex items-center pt-0.5 shrink-0">
              <input type="checkbox" class="sr-only" data-agentic-check data-chat-id="${client.chatId}" ${isSelected ? 'checked' : ''}>
              <div class="w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? 'border-primary bg-primary' : 'border-border bg-background'}">
                ${isSelected ? `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M10 3L4.5 8.5L2 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ''}
              </div>
            </label>
            <div class="flex-1 min-w-0 space-y-1">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <span class="text-xs font-medium text-foreground">${this.escapeHtml(displayLabel)}</span>
                <div class="flex items-center gap-1 shrink-0">
                  <button type="button" class="text-[10px] px-2 py-0.5 rounded-md border border-border bg-background hover:bg-accent/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" data-agentic-regenerate data-chat-id="${client.chatId}" ${this.isSending || this.agenticRegeneratingId === client.chatId ? 'disabled' : ''}>Regenerar</button>
                  <button type="button" class="text-[10px] px-2 py-0.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors" data-agentic-hide data-chat-id="${client.chatId}">Ocultar</button>
                </div>
              </div>
              <textarea rows="2" class="mettri-agentic-draft-textarea w-full rounded-md border text-xs px-2 py-1.5 outline-none resize-none text-neutral-900 bg-white placeholder:text-neutral-600" data-agentic-draft data-chat-id="${client.chatId}" placeholder="Texto para este contato...">${this.escapeHtml(draft)}</textarea>
            </div>
          </div>
        </div>`;
            })
            .join('');

    return `
      <div class="mt-2 mb-2 rounded-xl border border-border/60 bg-background/60 p-3 space-y-3 mettri-agentic-accordion-body" data-agentic-detail>
        <p class="mettri-agentic-instruction text-[11px] leading-snug text-neutral-700">
          IA usa o histórico (última mensagem do cliente e sua última retomar, se houver). Revise o texto antes de enviar.
        </p>
        ${rowsHtml}
        <div class="flex flex-wrap gap-2 pt-1">
          <button type="button" id="retomar-agentic-generate" class="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/50 text-primary text-xs font-medium hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" ${genDisabled ? 'disabled' : ''}>
            Gerar textos para selecionados
          </button>
          <button type="button" id="retomar-agentic-send" class="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" ${sendDisabled ? 'disabled' : ''}>
            Enviar${qualifying > 0 ? ` (${qualifying})` : ''}
          </button>
        </div>
        ${this.testModeEnabled ? `<p class="text-[10px] text-amber-600/90">Desative &quot;Simular envio&quot; para enviar em massa aqui.</p>` : ''}
        ${!this.testModeEnabled && qualifying === 0 && n > 0 ? `<p class="text-[10px] text-muted-foreground">Marque linhas e preencha o texto para habilitar Enviar.</p>` : ''}
      </div>
    `;
  }

  private async runAgenticGenerateForChatIds(chatIds: string[]): Promise<void> {
    for (const chatId of chatIds) {
      const client = this.getAgenticCycleClients().find(c => c.chatId === chatId);
      const label = client?.firstName || client?.phone || chatId;
      try {
        await ensureChatLoaded(chatId);
        const contexts = await retomarContextResolver({
          chatIds: [chatId],
          accountId: this.accountId,
          messageDB,
        });
        let ctx = contexts[0];
        if (!ctx) {
          // Lista importada / chat sem mensagens capturadas: antes abortava; agora contexto mínimo para a IA.
          const name = (client?.firstName || client?.chatName || '').trim() || '(nome não informado)';
          const days = client?.daysInactive ?? 0;
          const synthetic = `[Sem mensagem de texto do cliente no histórico local] ${name}, ~${days} dias de inatividade na régua.`;
          ctx = {
            chatId,
            chatName: client?.chatName ?? chatId,
            contextText: `Cliente: ${synthetic}`,
            clientText: synthetic,
            conversationThread: synthetic,
          };
          this.addLog(
            'info',
            `${label}: sem histórico de texto no banco — gerando com nome + dias inativo.`,
          );
        }
        const rangeIdx = this.selectedAgenticRangeIndex ?? 0;
        const text = await suggestRedacaoRetomar(this.bridge, {
          firstName: client?.firstName ?? '',
          cycleIndex: rangeIdx + 1,
          relationType: this.selectedRelationType ?? 'frequente',
          daysInactive: client?.daysInactive ?? 0,
          lastIncomingFromClient: ctx.clientText,
          lastRetomarSentText: ctx.attendantText ?? '',
          conversationThread: ctx.conversationThread,
        });
        this.agenticDraftByChatId.set(chatId, text);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.addLog('error', `${label}: ${msg}`);
      }
      this.updateUnifiedFlow();
    }
  }

  private async runAgenticSendFromPanel(): Promise<void> {
    if (this.testModeEnabled) {
      this.addLog('warning', 'Desative Simular envio para enviar pelas Respostas Agênticas.');
      return;
    }
    if (this.selectedAgenticRangeIndex == null) return;

    const cycleChatIds: string[] = [];
    this.sendingPayloadByChatId.clear();

    for (const c of this.getAgenticCycleClients()) {
      if (!this.agenticChecked.has(c.chatId)) continue;
      const text = (this.agenticDraftByChatId.get(c.chatId) ?? '').trim();
      if (!text) continue;
      cycleChatIds.push(c.chatId);
      this.sendingPayloadByChatId.set(c.chatId, { text, variant: 'A' });
    }

    if (cycleChatIds.length === 0) {
      this.addLog('warning', 'Nenhum contato marcado com texto para enviar.');
      return;
    }

    this.pendingChamadaIndex = this.selectedAgenticRangeIndex;
    this.sendingQueue = cycleChatIds.slice();
    cycleChatIds.forEach(id => this.agenticChecked.delete(id));

    await this.saveQueueState();
    this.sendingProgress = {
      total: this.sendingQueue.length,
      sent: 0,
      skipped: 0,
      errors: 0,
      current: null,
      startTime: Date.now(),
    };
    this.isSending = true;
    this.addLog('info', `Respostas Agênticas: enviando para ${this.sendingQueue.length} cliente(s)...`);
    this.updateUnifiedFlow();
    await this.processQueue();
  }

  private setupAgenticListeners(): void {
    const sectionToggle = this.container?.querySelector('#retomar-agentic-section-toggle');
    sectionToggle?.addEventListener('click', () => {
      this.isAgenticSectionExpanded = !this.isAgenticSectionExpanded;
      this.updateUnifiedFlow();
    });

    this.container?.querySelectorAll<HTMLButtonElement>('[data-agentic-range-index]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const raw = btn.dataset.agenticRangeIndex;
        if (raw == null) return;
        const rangeIndex = parseInt(raw, 10);
        if (Number.isFinite(rangeIndex)) this.toggleAgenticRange(rangeIndex);
      });
    });

    const agenticDetail = this.container?.querySelector('[data-agentic-detail]');
    agenticDetail?.querySelectorAll<HTMLInputElement>('input[data-agentic-check][data-chat-id]').forEach(cb => {
      cb.addEventListener('change', () => {
        const chatId = cb.dataset.chatId;
        if (!chatId) return;
        if (cb.checked) this.agenticChecked.add(chatId);
        else this.agenticChecked.delete(chatId);
        this.updateUnifiedFlow();
      });
    });

    agenticDetail?.querySelectorAll<HTMLTextAreaElement>('textarea[data-agentic-draft][data-chat-id]').forEach(ta => {
      ta.addEventListener('input', e => {
        const id = (e.target as HTMLTextAreaElement).dataset.chatId;
        if (id) this.agenticDraftByChatId.set(id, (e.target as HTMLTextAreaElement).value);
        this.updateUnifiedFlow();
      });
    });

    agenticDetail?.querySelectorAll('[data-agentic-contact-row]').forEach(row => {
      row.addEventListener('click', e => {
        const t = e.target as HTMLElement;
        if (t.closest('textarea') || t.closest('button') || t.closest('label')) return;
        const chatId = (row as HTMLElement).dataset.agenticContactRow;
        if (!chatId) return;
        const checkbox = row.querySelector<HTMLInputElement>('input[data-agentic-check][data-chat-id]');
        if (checkbox) {
          checkbox.checked = !checkbox.checked;
          if (checkbox.checked) this.agenticChecked.add(chatId);
          else this.agenticChecked.delete(chatId);
          this.updateUnifiedFlow();
        }
      });
    });

    agenticDetail?.querySelectorAll<HTMLButtonElement>('[data-agentic-regenerate]').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        if (btn.disabled) return;
        const chatId = btn.dataset.chatId;
        if (!chatId) return;
        this.agenticRegeneratingId = chatId;
        this.updateUnifiedFlow();
        try {
          await this.runAgenticGenerateForChatIds([chatId]);
        } finally {
          this.agenticRegeneratingId = null;
          this.updateUnifiedFlow();
        }
      });
    });

    agenticDetail?.querySelectorAll<HTMLButtonElement>('[data-agentic-hide]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const chatId = btn.dataset.chatId;
        if (!chatId) return;
        this.agenticHiddenChatIds.add(chatId);
        this.agenticChecked.delete(chatId);
        this.agenticDraftByChatId.delete(chatId);
        this.updateUnifiedFlow();
      });
    });

    const genBtn = this.container?.querySelector<HTMLButtonElement>('#retomar-agentic-generate');
    genBtn?.addEventListener('click', async e => {
      e.stopPropagation();
      if (genBtn.hasAttribute('disabled')) return;
      const ids = this.getAgenticCycleClients()
        .filter(c => this.agenticChecked.has(c.chatId))
        .map(c => c.chatId);
      if (ids.length === 0) return;
      this.agenticBulkGenerating = true;
      this.updateUnifiedFlow();
      try {
        await this.runAgenticGenerateForChatIds(ids);
      } finally {
        this.agenticBulkGenerating = false;
        this.updateUnifiedFlow();
      }
    });

    const sendBtn = this.container?.querySelector<HTMLButtonElement>('#retomar-agentic-send');
    sendBtn?.addEventListener('click', async e => {
      e.stopPropagation();
      if (sendBtn.hasAttribute('disabled')) return;
      try {
        await this.runAgenticSendFromPanel();
      } catch (err) {
        this.addLog('error', `Envio agêntico: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  /**
   * Alterna seleção de um período (Última interação há…).
   * Limpa modo etiqueta e faz toggle: se todos da faixa estão selecionados, desmarca todos; senão, marca todos.
   * Não chama loadInactiveClients() aqui para não alterar selectedClients e quebrar o toggle.
   */
  private togglePeriodFilter(rangeIndex: number): void {
    if (!Number.isFinite(rangeIndex) || rangeIndex < 0) return;

    // Fechar detalhe ao clicar na mesma linha
    if (this.selectedRangeIndex === rangeIndex) {
      this.selectedRangeIndex = null;
      this.updateUnifiedFlow();
      return;
    }

    // Atualizar índice de faixa selecionado (ciclos)
    this.selectedRangeIndex = rangeIndex;

    const ranges = getRangesForType(this.selectedRelationType, this.customRelationIntervalDays);
    const range = ranges[rangeIndex];
    if (!range) return;

    // Manter compatibilidade com partes antigas da UI baseadas em selectedInactiveDay,
    // usando o mínimo da faixa atual.
    this.selectedInactiveDay = range.min;

    // Modo dia: limpar seleção de etiqueta
    this.selectedListId = null;
    this.labelModeClients = [];

    // Encontrar clientes dentro da faixa
    const clientsInRange = this.eligibleClients.filter(c =>
      isInRange(c.daysInactive, range) &&
      c.status === 'pending' &&
      !c.isSpecialList
    );

    // Verificar se todos estão selecionados
    const allSelected = clientsInRange.every(c => this.selectedClients.has(c.chatId));

    // Toggle: se todos selecionados, deselecionar; senão, selecionar todos
    clientsInRange.forEach(client => {
      if (allSelected) {
        this.selectedClients.delete(client.chatId);
      } else {
        this.selectedClients.add(client.chatId);
      }
    });

    this.calculatePeriodFilters();
    this.updateUnifiedFlow();
    if (this.cycleMetricsExpanded && this.selectedRangeIndex != null) {
      void this.loadCycleMetrics().then(() => this.updateUnifiedFlow());
    }
    const chamadaLabel = this.getChamadaLabelByRangeIndex(rangeIndex);
    this.addLog('info', `${allSelected ? 'Deselecionados' : 'Selecionados'} ${clientsInRange.length} cliente(s) da ${chamadaLabel}`);
  }

  /**
   * Configura listeners da lista de contatos.
   */
  private setupContactsListeners(): void {
    // Checkboxes de contatos
    const checkboxes = this.container?.querySelectorAll('#retomar-contacts-list input[type="checkbox"]');
    checkboxes?.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const chatId = (e.target as HTMLInputElement).dataset.chatId;
        const checked = (e.target as HTMLInputElement).checked;
        if (chatId) {
          if (checked) {
            this.selectedClients.add(chatId);
          } else {
            this.selectedClients.delete(chatId);
          }
          this.calculatePeriodFilters();
          this.updateUnifiedFlow();
        }
      });
    });

    // Permitir clicar no item do contato para toggle (exceto kebab menu)
    const contactItems = this.container?.querySelectorAll('#retomar-contacts-list [data-chat-id]');
    contactItems?.forEach(item => {
      item.addEventListener('click', (e) => {
        // Não toggle se clicar no kebab menu
        if ((e.target as HTMLElement).closest('[data-kebab-menu]') || (e.target as HTMLElement).closest('[data-kebab-dropdown]')) {
          return;
        }
        const chatId = (item as HTMLElement).dataset.chatId;
        if (chatId) {
          const checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement;
          if (checkbox) {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
          }
        }
      });
    });

    // Kebab menus
    const kebabButtons = this.container?.querySelectorAll('[data-kebab-menu]');
    kebabButtons?.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const chatId = (btn as HTMLElement).dataset.kebabMenu;
        if (chatId) {
          // Toggle menu: se já está aberto, fecha; senão, abre
          if (this.openMenuId === chatId) {
            this.openMenuId = null;
          } else {
            this.openMenuId = chatId;
          }
          this.updateUnifiedFlow();
          // Aguardar próximo frame para garantir que o DOM foi atualizado
          requestAnimationFrame(() => {
            this.positionKebabDropdowns();
            this.positionListMenus();
          });
        }
      });
    });

    /**
     * Ações do kebab menu (modo dia) — adicionar cliente a qualquer etiqueta.
     * Após adicionar, recarrega clientes elegíveis para que o cliente desapareça da lista de Pessoas
     * (clientes em etiquetas não aparecem no modo dia).
     */
    this.container?.querySelectorAll('[data-action="add-to-list"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const chatId = (e.currentTarget as HTMLElement).dataset.chatId;
        const listId = (e.currentTarget as HTMLElement).dataset.listId;
        if (chatId && listId && this.listsManager) {
          await this.listsManager.addMember(listId, chatId);
          this.selectedClients.delete(chatId);
          this.openMenuId = null;
          // Recarregar clientes elegíveis para remover da lista de Pessoas (modo dia)
          await this.loadInactiveClients();
          this.calculatePeriodFilters();
          this.lists = this.listsManager.getLists();
          this.updateUnifiedFlow();
          const list = this.lists.find(l => l.id === listId);
          const displayName = list ? (ETIQUETA_DISPLAY_NAMES[list.id] ?? list.name) : 'etiqueta';
          this.addLog('info', `Adicionado à ${displayName}`);
        }
      });
    });

    /**
     * Ações do kebab menu (modo etiqueta) — remover cliente da etiqueta atual.
     * Após remover, recarrega clientes elegíveis para que o cliente apareça em Pessoas (modo dia).
     */
    this.container?.querySelectorAll('[data-action="remove-from-label"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const chatId = (e.currentTarget as HTMLElement).dataset.chatId;
        if (chatId && this.selectedListId && this.listsManager) {
          await this.listsManager.removeMember(this.selectedListId, chatId);
          // Atualizar lista de membros da etiqueta atual
          this.labelModeClients = await this.getClientsFromListMembers(this.selectedListId);
          // Recarregar clientes elegíveis para que apareça em Pessoas (modo dia)
          await this.loadInactiveClients();
          this.openMenuId = null;
          this.lists = this.listsManager.getLists();
          this.updateUnifiedFlow();
          this.addLog('info', 'Removido da etiqueta');
        }
      });
    });

    /**
     * Ações do kebab menu (modo etiqueta) — mover cliente para outra etiqueta.
     * Remove da etiqueta atual e adiciona à etiqueta destino.
     */
    this.container?.querySelectorAll('[data-action="move-to-list"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const chatId = (e.currentTarget as HTMLElement).dataset.chatId;
        const targetListId = (e.currentTarget as HTMLElement).dataset.listId;
        if (chatId && targetListId && this.selectedListId && this.listsManager) {
          await this.listsManager.removeMember(this.selectedListId, chatId);
          await this.listsManager.addMember(targetListId, chatId);
          // Atualizar lista de membros da etiqueta atual (cliente foi removido)
          this.labelModeClients = await this.getClientsFromListMembers(this.selectedListId);
          this.openMenuId = null;
          this.lists = this.listsManager.getLists();
          this.updateUnifiedFlow();
          const targetList = this.lists.find(l => l.id === targetListId);
          const displayName = targetList ? (ETIQUETA_DISPLAY_NAMES[targetList.id] ?? targetList.name) : 'etiqueta';
          this.addLog('info', `Movido para ${displayName}`);
        }
      });
    });

    // Botão expandir/colapsar lista
    const expandBtn = this.container?.querySelector('#retomar-expand-contacts');
    expandBtn?.addEventListener('click', () => {
      this.isContactsExpanded = !this.isContactsExpanded;
      this.updateUnifiedFlow();
    });

    // Fechar menus ao clicar fora
    // Remover listener anterior para evitar vazamento em re-renders
    if (this.closeMenusHandler) {
      document.removeEventListener('click', this.closeMenusHandler);
      this.closeMenusHandler = null;
    }

    const closeMenusHandler = (e: MouseEvent) => {
      if (this.openMenuId && !(e.target as HTMLElement).closest('[data-kebab-menu]') && !(e.target as HTMLElement).closest('[data-kebab-dropdown]')) {
        this.openMenuId = null;
        this.updateUnifiedFlow();
      }
    };
    this.closeMenusHandler = closeMenusHandler;
    document.addEventListener('click', closeMenusHandler);

    // Reposicionar dropdown em caso de scroll ou resize
    if (this.repositionDropdownHandler) {
      window.removeEventListener('scroll', this.repositionDropdownHandler, true);
      window.removeEventListener('resize', this.repositionDropdownHandler);
    }
    const repositionHandler = () => {
      if (this.openMenuId) {
        this.positionKebabDropdowns();
      }
      if (this.listMenuOpenId) {
        this.positionListMenus();
      }
    };
    this.repositionDropdownHandler = repositionHandler;
    window.addEventListener('scroll', repositionHandler, true);
    window.addEventListener('resize', repositionHandler);
  }

  /**
   * Configura listeners do input de mensagem.
   */
  private setupMessageInputListeners(): void {
    const messageInput = this.container?.querySelector('#retomar-message-input') as HTMLTextAreaElement;
    messageInput?.addEventListener('input', (e) => {
      this.messageText = (e.target as HTMLTextAreaElement).value;
    });
  }

  /**
   * Configura listeners dos headers colapsáveis e kebab menus.
   */
  private setupHeaderActionsListeners(): void {
    // Toggle filtros
    const filtersToggle = this.container?.querySelector('#retomar-filters-toggle');
    filtersToggle?.addEventListener('click', () => {
      this.isFiltersExpanded = !this.isFiltersExpanded;
      this.updateUnifiedFlow();
    });

    // Toggle contatos
    const contactsToggle = this.container?.querySelector('#retomar-contacts-toggle');
    contactsToggle?.addEventListener('click', () => {
      this.isContactsExpanded = !this.isContactsExpanded;
      this.updateUnifiedFlow();
    });
  }

  /**
   * Configura listeners da seção unificada de inativos.
   */
  public setupUnifiedInactiveListeners(): void {
    const daySelector = this.container?.querySelector('#retomar-day-selector') as HTMLElement | null;
    const dropdown = this.container?.querySelector('#retomar-cadence-dropdown') as HTMLElement | null;

    // Toggle dropdown (agora dropdown pode ser customizado via Tailwind)
    daySelector?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = dropdown && dropdown.style.display !== 'none';
      if (dropdown) {
        dropdown.style.display = isVisible ? 'none' : 'block';
        dropdown.className = isVisible
          ? 'hidden'
          : 'glass rounded-xl border-border/30 min-w-[90px] p-1 absolute z-50 mt-1';
      }
    });

    // Fechar dropdown ao clicar fora
    // Remover listener anterior para evitar vazamento em re-renders
    if (this.closeDropdownHandler) {
      document.removeEventListener('click', this.closeDropdownHandler);
      this.closeDropdownHandler = null;
    }

    const closeDropdown = (e: MouseEvent) => {
      if (dropdown && daySelector &&
        !dropdown.contains(e.target as Node) &&
        !daySelector.contains(e.target as Node)) {
        dropdown.style.display = 'none';
      }
    };

    // Adicionar listener global (será removido quando o painel for destruído)
    this.closeDropdownHandler = closeDropdown;
    document.addEventListener('click', closeDropdown);

    // Selecionar dia do dropdown
    const dropdownItems = this.container?.querySelectorAll('#retomar-cadence-dropdown button[data-day]');
    dropdownItems?.forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const day = parseInt((e.target as HTMLElement).getAttribute('data-day') || '0');
        if (day > 0) {
          this.selectedInactiveDay = day;
          if (dropdown) {
            dropdown.classList.add('hidden');
            dropdown.style.display = 'none';
          }
          this.updateUnifiedFlow();
        }
      });
    });

    // Selecionar dia das opções rápidas (grid de botões)
    const cadenceOptions = this.container?.querySelectorAll('button[data-day]:not(#retomar-day-selector)');
    cadenceOptions?.forEach(option => {
      option.addEventListener('click', (e) => {
        const day = parseInt((e.target as HTMLElement).getAttribute('data-day') || '0');
        if (day > 0 && (e.target as HTMLElement).id.startsWith('retomar-select-day-')) {
          // Este é um botão de seleção, não o grid
          return;
        }
        if (day > 0 && !(e.target as HTMLElement).id.startsWith('retomar-')) {
          // Grid de períodos
          this.selectedInactiveDay = day;
          this.updateUnifiedFlow();
        }
      });
    });

    // Editar régua
    const editCadenceBtn = this.container?.querySelector('#retomar-edit-cadence');
    editCadenceBtn?.addEventListener('click', async () => {
      await this.showEditCadenceDialog();
    });
  }

  /**
   * Configura listeners das ações de seleção (Todos, por dia, limpar).
   */
  public setupUnifiedFlowActions(): void {
    // Selecionar todos
    const selectAllBtn = this.container?.querySelector('#retomar-select-all-days');
    selectAllBtn?.addEventListener('click', () => {
      const selectedDay = this.selectedInactiveDay || this.cadenceDays[0] || 21;
      this.eligibleClients
        .filter(c => c.daysInactive >= selectedDay && c.status === 'pending' && !c.isSpecialList)
        .forEach(client => {
          this.selectedClients.add(client.chatId);
        });
      this.updateUnifiedFlow();
      this.addLog('info', `Selecionados todos os clientes elegíveis (${this.selectedClients.size})`);
    });

    // Selecionar por dia específico
    this.cadenceDays.forEach(day => {
      const selectDayBtn = this.container?.querySelector(`#retomar-select-day-${day}`);
      selectDayBtn?.addEventListener('click', () => {
        const dayClients = this.eligibleClients.filter(c =>
          c.daysInactive >= day &&
          c.daysInactive < (this.cadenceDays[this.cadenceDays.indexOf(day) + 1] || Infinity) &&
          c.status === 'pending' &&
          !c.isSpecialList
        );
        dayClients.forEach(client => {
          this.selectedClients.add(client.chatId);
        });
        this.updateUnifiedFlow();
        this.addLog('info', `Selecionados ${dayClients.length} cliente(s) do ${day}º dia`);
      });
    });

    // Limpar seleção
    const clearBtn = this.container?.querySelector('#retomar-clear-selection');
    clearBtn?.addEventListener('click', () => {
      this.selectedClients.clear();
      this.updateUnifiedFlow();
      this.addLog('info', 'Seleção limpa');
    });
  }

  /**
   * Configura listeners da lista de destinatários.
   */
  public setupUnifiedRecipients(): void {
    // Checkboxes individuais (agora dentro de glass-subtle cards)
    const checkboxes = this.container?.querySelectorAll('input[type="checkbox"][data-chat-id]');
    checkboxes?.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const chatId = (e.target as HTMLInputElement).dataset.chatId;
        const checked = (e.target as HTMLInputElement).checked;
        if (chatId) {
          if (checked) {
            this.selectedClients.add(chatId);
          } else {
            this.selectedClients.delete(chatId);
          }
          this.updateUnifiedFlow();
        }
      });
    });

    // Ações dos cards (Hoje, Remover, Especial)
    const actionButtons = this.container?.querySelectorAll('button[data-action][data-chat-id]');
    actionButtons?.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = (e.target as HTMLElement).dataset.action;
        const chatId = (e.target as HTMLElement).dataset.chatId;
        if (chatId && action) {
          this.handleClientAction(action, chatId);
          this.updateUnifiedFlow();
        }
      });
    });

    // Botão enviar - REMOVIDO: agora usa event delegation em setupUnifiedFlowListeners()
    // Não precisa mais configurar aqui, pois o event delegation captura todos os cliques
  }

  /**
   * Adiciona entrada ao log.
   */
  private addLog(type: LogEntry['type'], message: string): void {
    if (type === 'error') {
      console.error('[RETOMAR]', message);
    }
    this.logs.push({
      timestamp: new Date(),
      type,
      message,
    });
    // Manter apenas últimos 100 logs
    if (this.logs.length > 100) {
      this.logs.shift();
    }
    // Só renderizar se o container já existir
    if (this.container) {
      this.renderLogs();
    }
  }

  /**
   * Renderiza todo o conteúdo do painel.
   */
  private renderContent(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <!-- INTERFACE UNIFICADA: INATIVOS + RÉGUA + ENVIOS -->
      <div class="mettri-retomar-unified-flow flex flex-col gap-5 min-w-0 max-w-full overflow-y-visible">
        ${this.renderUnifiedFlow()}
      </div>

      <!-- MONITORAMENTO -->
      <div class="space-y-2 pt-1">
        <div class="flex items-center justify-between py-2 border-b border-border/50">
          <span class="text-sm font-medium text-foreground">Monitoramento</span>
          <button class="h-7 px-2.5 text-xs text-primary hover:bg-primary/10 rounded-lg transition-colors" id="retomar-clear-logs">Limpar</button>
        </div>
        <div class="glass-subtle rounded-xl p-3 max-h-48 overflow-y-auto text-xs text-muted-foreground border border-border/50" id="retomar-logs">
          ${this.logs.length === 0 ? '<div class="text-center py-4 text-[11px] text-muted-foreground/60">Nenhum log ainda. Os eventos aparecerão aqui.</div>' : ''}
        </div>
      </div>
    `;

    this.setupEventListeners();
  }

  /**
   * Extrai primeiro nome formatado do nome completo.
   */
  private extractFirstName(fullName: string): string {
    const firstName = fullName.trim().split(/\s+/)[0] || fullName;
    // Primeira letra maiúscula, resto minúsculo
    return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  }

  /**
   * Renderiza visão geral compacta com breakdown por dias.
   */
  public renderOverview(): string {
    const totalInactive = this.eligibleClients.length;
    const countsByDay = this.getCadenceCounts();

    const breakdown = this.cadenceDays.map(day => {
      const count = countsByDay[day] || 0;
      return `<span class="mettri-overview-day-compact">${count} a ${day} dias</span>`;
    }).join('');

    return `
      <div class="mettri-overview-compact">
        <span class="mettri-overview-total-compact">${totalInactive} inativos</span>
        <div class="mettri-overview-breakdown-compact">
          ${breakdown}
        </div>
      </div>
    `;
  }

  /**
   * Renderiza seção de preparação de envios.
   */
  public renderPrepareSection(): string {
    const selectedCount = this.selectedClients.size;
    const selectedClients = this.eligibleClients.filter(c => this.selectedClients.has(c.chatId));

    return `
      <div class="mettri-prepare-actions">
        <button class="mettri-btn-link" id="retomar-select-all-days">Todos</button>
        ${this.cadenceDays.map(day => `
          <button class="mettri-btn-link" data-day="${day}" id="retomar-select-day-${day}">
            ${day} dias
          </button>
        `).join('')}
        <button class="mettri-btn-link" id="retomar-clear-selection">Limpar</button>
      </div>
      
      <div class="mettri-prepare-selected">
        <div class="mettri-prepare-selected-header">
          <span class="mettri-section-title-small">Clientes Selecionados (${selectedCount})</span>
        </div>
        <div class="mettri-prepare-clients-list">
          ${this.renderSelectedClientsList(selectedClients)}
        </div>
        <div class="mettri-prepare-send-footer">
          <button class="mettri-btn-primary mettri-btn-send" id="retomar-send-selected" ${selectedCount === 0 ? 'disabled' : ''}>
            Enviar ${selectedCount > 0 ? `(${selectedCount})` : ''}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Renderiza lista de clientes selecionados formatada.
   */
  private renderSelectedClientsList(clients: InactiveClient[]): string {
    if (clients.length === 0) {
      return `
        <div class="mettri-prepare-empty">
          <p>Nenhum cliente selecionado.</p>
          <p>Use os botões acima para selecionar clientes por dia da régua.</p>
        </div>
      `;
    }

    return clients.map(client => {
      const firstName = client.firstName || '';
      const displayLabel = firstName || client.phone || 'Sem nome';
      const message = this.messageText || 'Olá! Sentimos sua falta por aqui.';

      return `
        <div class="mettri-prepare-client-card" data-chat-id="${client.chatId}">
          <div class="mettri-prepare-client-main">
            <input type="checkbox" class="mettri-prepare-client-checkbox" 
                   checked data-chat-id="${client.chatId}">
            <div class="mettri-prepare-client-info">
              <div class="mettri-prepare-client-name">${this.escapeHtml(displayLabel)}</div>
              <div class="mettri-prepare-client-preview" title="${this.escapeHtml(message)}">
                ${this.escapeHtml(message.substring(0, 50))}${message.length > 50 ? '...' : ''}
              </div>
            </div>
          </div>
          <div class="mettri-prepare-client-actions">
            <button class="mettri-btn-link mettri-btn-small" 
                    data-action="skip-today" 
                    data-chat-id="${client.chatId}"
                    title="Pular para hoje">
              Hoje
            </button>
            <button class="mettri-btn-link mettri-btn-small" 
                    data-action="exclude" 
                    data-chat-id="${client.chatId}"
                    title="Remover da lista">
              Remover
            </button>
            <button class="mettri-btn-link mettri-btn-small mettri-btn-special-list" 
                    data-action="special-list" 
                    data-chat-id="${client.chatId}"
                    title="Mover para lista especial (CNPJ, etc)">
              Especial
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Bloco Tipo de relação (dropdown).
   */
  private renderRelationTypeBlock(): string {
    const current = RELATION_TYPES.find(r => r.id === this.selectedRelationType) ?? RELATION_TYPES[0];
    const dropdownHidden = this.relationTypeDropdownOpen ? '' : ' hidden';
    return `
      <div class="mettri-relation-type" data-relation-type-wrapper>
        <button type="button" id="retomar-relation-type-toggle" data-relation-trigger class="mettri-relation-type-trigger w-full text-left" aria-expanded="${this.relationTypeDropdownOpen}" aria-haspopup="listbox" aria-controls="retomar-relation-type-dropdown">
          <span class="mettri-relation-type-label">Tipo de relação</span>
          <span class="mettri-relation-type-value-row">
            <span class="mettri-relation-type-selected-dot" aria-hidden="true"></span>
            <span class="mettri-relation-type-value">${this.escapeHtml(current.label)}</span>
            <span class="mettri-relation-type-range">${this.escapeHtml(current.shortRange)}</span>
          </span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="mettri-relation-type-chevron ${this.relationTypeDropdownOpen ? 'rotate-180' : ''}" aria-hidden="true">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div id="retomar-relation-type-dropdown" class="mettri-relation-type-dropdown${dropdownHidden}" role="listbox" aria-hidden="${!this.relationTypeDropdownOpen}">
          ${RELATION_TYPES.map(r => `
            <button type="button" data-relation-id="${r.id}" role="option" class="mettri-relation-type-option ${r.id === this.selectedRelationType ? 'mettri-relation-type-option-selected' : ''}" ${r.id === this.selectedRelationType ? 'aria-selected="true"' : ''}>
              <span class="mettri-relation-type-option-label">${this.escapeHtml(r.label)}</span>
              <span class="mettri-relation-type-option-range">${this.escapeHtml(r.shortRange)}</span>
            </button>
          `).join('')}
        </div>
        ${current.id === 'personalizado' ? `
          <div class="mettri-relation-type-custom">
            <div class="mettri-relation-type-custom-title">Ritmo de contato</div>
            <div class="mettri-relation-type-custom-row">
              <span class="mettri-relation-type-custom-label">Falar a cada</span>
              <input 
                type="number" 
                min="1" 
                step="1" 
                id="retomar-custom-interval" 
                class="mettri-relation-type-custom-input" 
                value="${this.customRelationIntervalDays ?? ''}"
              />
              <span class="mettri-relation-type-custom-suffix">dias</span>
            </div>
            <p class="mettri-relation-type-custom-hint">
              O Mettri usa esse ritmo para distribuir até 4 ciclos na régua.
            </p>
            <button 
              type="button" 
              id="retomar-custom-cadence-toggle" 
              class="mettri-relation-type-custom-advanced-toggle"
            >
              Ajustar dias da régua
              <span class="mettri-relation-type-custom-advanced-chevron">${this.isCustomCadenceExpanded ? '▴' : '▾'}</span>
            </button>
            ${this.isCustomCadenceExpanded ? this.renderCustomCadenceAdvanced() : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Renderiza fluxo unificado completo com novo design.
   */
  private renderUnifiedFlow(): string {
    return `
      ${this.renderRelationTypeBlock()}

      <!-- Bloco único: Retomar conversas (objetivo + estado + métricas) -->
      <div class="glass rounded-2xl p-4 border border-border/50 shadow-sm">
        <div class="text-sm font-medium text-foreground tracking-tight">Retomar conversas</div>
        <div class="mt-2 text-sm text-muted-foreground">
          <span class="tabular-nums font-semibold text-foreground">${this.eligibleCount}</span>
          <span class="ml-1">aguardando ação</span>
        </div>
        <div class="mt-2 text-sm text-muted-foreground flex items-baseline flex-nowrap gap-2">
          <span class="shrink-0">Baseado em</span>
          <div class="mettri-activity-source-dropdown-wrap shrink-0" data-activity-source-wrapper>
            <button type="button" data-activity-source-trigger class="mettri-relation-type-trigger mettri-activity-source-trigger" aria-expanded="${this.activitySourceDropdownOpen}" aria-haspopup="listbox" aria-controls="retomar-activity-source-dropdown">
              <span class="mettri-relation-type-value">${this.escapeHtml(ACTIVITY_SOURCE_OPTIONS.find(o => o.id === this.selectedActivitySource)?.label ?? 'Última mensagem')}</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="mettri-relation-type-chevron ${this.activitySourceDropdownOpen ? 'rotate-180' : ''}" aria-hidden="true">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div id="retomar-activity-source-dropdown" class="mettri-relation-type-dropdown${this.activitySourceDropdownOpen ? '' : ' hidden'}" role="listbox" aria-hidden="${!this.activitySourceDropdownOpen}" data-activity-source-dropdown>
              ${ACTIVITY_SOURCE_OPTIONS.map(opt => `
                <button type="button" data-activity-source-option data-activity-source-id="${opt.id}" role="option" class="mettri-relation-type-option ${opt.id === this.selectedActivitySource ? 'mettri-relation-type-option-selected' : ''}" ${opt.id === this.selectedActivitySource ? 'aria-selected="true"' : ''}>
                  <span class="mettri-relation-type-option-label">${this.escapeHtml(opt.label)}</span>
                </button>
              `).join('')}
            </div>
          </div>
        </div>
        ${this.renderPurchaseImportSection()}
        ${this.renderRetomarSummaryMetricsSection()}
      </div>

      ${this.renderAgenticSection()}

      <!-- UI DE PROGRESSO -->
      ${this.renderProgressUI()}

      <!-- INPUT DE MENSAGEM -->
      <div class="flex items-start gap-3 p-3 rounded-xl border border-border bg-background shadow-sm min-w-0">
        <span class="text-lg mt-0.5 shrink-0">😊</span>
        <textarea 
          rows="3"
          class="flex-1 min-w-0 bg-transparent text-sm placeholder:text-muted-foreground outline-none resize-none"
          placeholder="Escreva uma mensagem..."
          id="retomar-message-input"
        >${this.escapeHtml(this.messageText)}</textarea>
      </div>

      <!-- MODO TESTE -->
      <div class="mt-0.5">
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" id="retomar-test-mode" ${this.testModeEnabled ? 'checked' : ''} />
          <span class="text-[11px] text-muted-foreground">Simular envio</span>
        </label>
      </div>

      <!-- BOTÕES DE CONTROLE -->
      <div class="mt-3 flex gap-2">
        ${this.isSending ? `
          <button 
            class="flex-1 h-11 rounded-xl bg-yellow-500 text-white font-medium hover:bg-yellow-600 transition-colors flex items-center justify-center gap-2 shadow-sm"
            id="retomar-pause-resume"
            type="button"
          >
            ${this.isPaused ? '▶ Retomar' : '⏸ Pausar'}
          </button>
          <div class="flex items-center px-3 text-xs text-muted-foreground">
            ${this.sendingQueue.length} restantes
          </div>
        ` : `
          <button 
            class="w-full h-11 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            id="retomar-send-selected"
            type="button"
            ${this.selectedClients.size === 0 && !this.testModeEnabled ? 'disabled' : ''}
          >
            ${this.testModeEnabled ? 'Enviar Teste' : this.selectedClients.size > 0 ? `Enviar (${this.selectedClients.size})` : 'Enviar'}
          </button>
        `}
      </div>

      <!-- CAMPOS DE TESTE (quando modo teste ativo) -->
      ${this.testModeEnabled ? `
        <div class="mt-2 p-2 rounded-lg border border-border/50 bg-accent/30">
          <div class="grid grid-cols-2 gap-2">
            <div class="relative">
              <input 
                type="text"
                class="w-full px-2 pr-7 py-1.5 rounded-lg border border-border bg-background text-sm outline-none"
                id="retomar-test-phone" 
                placeholder="Número (ex: 5511999999999)" 
                value="${this.testContact ? this.escapeHtml(this.testContact.phone) : ''}"
              />
              ${this.testContact?.phone ? `
                <span class="absolute right-2 top-1/2 -translate-y-1/2 text-green-500/70 pointer-events-none">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </span>
              ` : ''}
            </div>
            <div class="relative">
              <input 
                type="text"
                class="w-full px-2 pr-7 py-1.5 rounded-lg border border-border bg-background text-sm outline-none"
                id="retomar-test-name" 
                placeholder="Nome" 
                value="${this.testContact ? this.escapeHtml(this.testContact.name) : ''}"
              />
              ${this.testContact?.name ? `
                <span class="absolute right-2 top-1/2 -translate-y-1/2 text-green-500/70 pointer-events-none">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </span>
              ` : ''}
            </div>
          </div>
        </div>
      ` : ''}

    `;
  }

  /**
   * Renderiza chips de período em grid 2x2 com checkbox.
   */
  private renderPeriodFilters(): string {
    return `
      <div class="grid grid-cols-2 gap-2">
        ${this.periodFilters.map(filter => {
      const isSelected = filter.selected;
      const isFilled = filter.variant === 'filled';

      return `
            <button 
              class="flex items-center gap-2 px-3 py-2 rounded-xl transition-colors cursor-pointer ${isFilled
          ? 'bg-primary text-primary-foreground'
          : 'border border-border bg-background hover:bg-accent/50'
        }"
              data-period-range="${filter.range}"
              type="button"
            >
              <div class="w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected
          ? 'border-primary bg-primary'
          : 'border-border bg-background'
        }">
                ${isSelected ? `
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M10 3L4.5 8.5L2 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                ` : ''}
              </div>
              <span class="text-xs font-medium">${filter.range} dias</span>
              <span class="text-[11px] opacity-70">(${filter.count})</span>
            </button>
          `;
    }).join('')}
      </div>
    `;
  }

  /**
   * Renderiza lista vertical de ciclos (Primeira, Segunda, Terceira, Última tentativa) com contagem e opcional campanha.
   */
  /**
   * Renderiza lista vertical de ciclos em estilo acordeão: ao clicar num ciclo,
   * o painel de detalhes (Texto A/B, IA, Enviar) é inserido logo abaixo da linha,
   * empurrando as linhas seguintes para baixo.
   */
  private renderChamadas(): string {
    const chamadas = this.getChamadasWithCounts();
    if (chamadas.length === 0) return '<div class="mettri-chamadas-list text-sm text-muted-foreground">Nenhum dia na régua.</div>';
    return `
      <div class="mettri-chamadas-list mettri-chamadas-accordion" role="list">
        ${chamadas.map(c => `
          <div class="mettri-chamadas-accordion-item" data-range-index="${c.rangeIndex}">
            <button
              type="button"
              class="mettri-chamadas-row ${c.selected ? 'mettri-chamadas-row-selected' : ''}"
              data-chamada-id="${this.escapeHtml(c.id)}"
              data-chamada-range-index="${c.rangeIndex}"
              role="listitem"
            >
              <span class="mettri-chamadas-selected-dot ${c.selected ? 'is-active' : 'is-inactive'}" aria-hidden="true"></span>
              <span class="mettri-chamadas-row-label">${this.escapeHtml(c.label)}</span>
              <span class="mettri-chamadas-row-count">${c.count} pessoa${c.count !== 1 ? 's' : ''}</span>
              ${c.campaignLabel ? `
              <span class="mettri-chamadas-campaign-pill" title="Campanha ativa">
                <span class="mettri-dot-accent" aria-hidden="true"></span>
                <span class="mettri-chamadas-campaign-pill-title">${this.escapeHtml(c.campaignLabel)}</span>
              </span>` : ''}
            </button>
            ${c.selected ? this.renderSelectedChamadaPanel() : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Clientes elegíveis do ciclo atualmente selecionado (mesmo critério de getChamadasWithCounts).
   */
  private getCycleClients(): InactiveClient[] {
    if (this.selectedRangeIndex == null) return [];
    const ranges = getRangesForType(this.selectedRelationType, this.customRelationIntervalDays);
    const range = ranges[this.selectedRangeIndex];
    if (!range) return [];
    return this.eligibleClients.filter(c =>
      isInRange(c.daysInactive, range) &&
      c.status === 'pending' &&
      !c.isSpecialList
    );
  }

  /**
   * Painel expandido do ciclo selecionado: cabeçalho, modo/ quando, texto A/B, pessoas, ações, métricas.
   */
  private renderSelectedChamadaPanel(): string {
    if (this.selectedRangeIndex == null) return '';

    const chamadas = this.getChamadasWithCounts();
    const current = chamadas[this.selectedRangeIndex];
    if (!current) return '';

    const ranges = getRangesForType(this.selectedRelationType, this.customRelationIntervalDays);
    const range = ranges[this.selectedRangeIndex];
    if (!range) return '';

    const min = range.min;
    const max = range.max;
    const hasOpenRange = !Number.isFinite(max);
    const maxLabel = hasOpenRange ? '∞' : String(max);

    const messages = this.cycleMessages[this.selectedRangeIndex] ?? { textA: '', textB: null };
    const textA = messages.textA ?? '';
    const textB = messages.textB ?? '';
    const hasTextA = textA.trim().length > 0;
    const hasTextB = (textB ?? '').trim().length > 0;

    const cycleClients = this.getCycleClients();
    const N = cycleClients.length;
    const M = cycleClients.filter(c => this.selectedClients.has(c.chatId)).length;
    const hasContacts = N > 0;
    const sendDisabledByText =
      this.cycleSendMode === 'A'
        ? !hasTextA
        : this.cycleSendMode === 'B'
          ? !hasTextB
          : !hasTextA; // A/B: mínimo texto A por enquanto
    const sendDisabled = !hasContacts || M === 0 || sendDisabledByText;

    const peopleResumo = `${N} pessoa${N !== 1 ? 's' : ''} neste ciclo (${M} selecionado${M !== 1 ? 's' : ''})`;
    const cyclePeopleListHtml = this.cyclePeopleExpanded && N > 0
      ? cycleClients.map(client => {
          const isSelected = this.selectedClients.has(client.chatId);
          const displayLabel = (client.firstName || client.phone || 'Sem nome');
          return `
        <div class="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30 transition-colors retomar-cycle-contact" data-chat-id="${client.chatId}">
          <label class="cursor-pointer flex items-center">
            <input type="checkbox" class="sr-only" ${isSelected ? 'checked' : ''} data-chat-id="${client.chatId}">
            <div class="w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? 'border-primary bg-primary' : 'border-border bg-background'}">
              ${isSelected ? `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M10 3L4.5 8.5L2 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ''}
            </div>
          </label>
          <span class="text-xs font-medium text-foreground flex-1">${this.escapeHtml(displayLabel)}</span>
          <span class="text-[11px] text-muted-foreground">${client.daysInactive}d</span>
        </div>`;
        }).join('')
      : '';

    const metricsPeriodOptions = [
      { value: '7', label: '7 dias' },
      { value: '30', label: '30 dias' },
    ];
    const mv = this.cycleMetricsView;
    const metricsColumnsHtml =
      !mv || mv.kind === 'loading'
        ? `<div class="text-[11px] text-muted-foreground">Carregando...</div>`
        : mv.kind === 'error'
          ? `<div class="text-[11px] text-destructive">${this.escapeHtml(mv.message)}</div>`
          : mv.columns.length > 1
            ? `<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${mv.columns
                .map(
                  col => `
            <div class="rounded-md border border-border/50 p-2 space-y-1">
              <div class="text-[10px] font-semibold text-muted-foreground">Variante ${col.label}</div>
              ${this.renderRetomarCycleMetricsRows(col.metrics)}
            </div>`,
                )
                .join('')}</div>`
            : `<div class="rounded-md border border-border/50 p-2">${this.renderRetomarCycleMetricsRows(mv.columns[0].metrics)}</div>`;
    const metricsContent = this.cycleMetricsExpanded ? `
      <div class="mt-2 space-y-2 pl-0">
        <select class="text-xs rounded border border-border bg-background px-2 py-1" id="retomar-cycle-metrics-period">
          ${metricsPeriodOptions.map(o => `<option value="${o.value}" ${o.value === String(this.cycleMetricsPeriodDays) ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>
        ${metricsColumnsHtml}
      </div>
    ` : '';

    return `
      <div class="mt-2 mb-2 rounded-xl border border-border/60 bg-background/60 p-3 space-y-3 mettri-chamadas-accordion-body" data-chamada-detail>
        <!-- 1. Cabeçalho -->
        <div class="flex items-center justify-between gap-2">
          <div class="flex flex-col gap-0.5 min-w-0">
            <div class="text-sm font-medium text-foreground truncate">${this.escapeHtml(current.label)}</div>
            <div class="text-[11px] text-muted-foreground truncate">
              ${hasOpenRange ? `${min}+ dias desde a última compra/mensagem` : `${min}–${maxLabel} dias desde a última compra/mensagem`}
            </div>
          </div>
          ${current.campaignLabel ? `
            <div class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-[11px] text-emerald-600">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span class="truncate">${this.escapeHtml(current.campaignLabel)}</span>
            </div>
          ` : ''}
        </div>

        <!-- 2. Modo de envio -->
        <div class="flex flex-wrap items-center gap-3">
          <span class="text-xs font-medium text-muted-foreground">Enviar:</span>
          <label class="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="retomar-cycle-send-mode" value="A" ${this.cycleSendMode === 'A' ? 'checked' : ''} class="rounded-full border-border">
            <span class="text-xs">Só A</span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="retomar-cycle-send-mode" value="B" ${this.cycleSendMode === 'B' ? 'checked' : ''} class="rounded-full border-border">
            <span class="text-xs">Só B</span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="retomar-cycle-send-mode" value="AB" ${this.cycleSendMode === 'AB' ? 'checked' : ''} class="rounded-full border-border">
            <span class="text-xs">A/B (50%–50%)</span>
          </label>
        </div>

        <!-- 3. Texto A e Texto B + Sugerir com IA -->
        <div class="space-y-2">
          <div class="space-y-1">
            <label for="retomar-cycle-text-a" class="text-xs font-medium text-muted-foreground">Texto A (principal)</label>
            <textarea id="retomar-cycle-text-a" rows="3" class="w-full rounded-lg border border-border bg-background text-sm px-2.5 py-2 outline-none resize-none placeholder:text-muted-foreground" placeholder="Escreva aqui o Texto A...">${this.escapeHtml(textA)}</textarea>
          </div>
          <div class="space-y-1">
            <div class="flex items-center justify-between gap-2">
              <label for="retomar-cycle-text-b" class="text-xs font-medium text-muted-foreground">Texto B (sugestão da IA)</label>
              <button type="button" id="retomar-cycle-ai" class="text-[11px] px-2 py-1 rounded-md border border-primary/40 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" ${!hasTextA ? 'disabled' : ''} title="Gerar sugestão a partir do Texto A">Sugerir com IA</button>
            </div>
            <textarea id="retomar-cycle-text-b" rows="3" class="w-full rounded-lg border border-dashed border-border/70 bg-background text-sm px-2.5 py-2 outline-none resize-none placeholder:text-muted-foreground" placeholder="Texto B sugerido pela IA...">${this.escapeHtml(textB)}</textarea>
          </div>
        </div>

        <!-- 4. Pessoas do ciclo: resumo clicável e lista expandível -->
        <div class="space-y-1">
          ${N === 0
            ? `<p class="text-xs text-muted-foreground">Nenhum contato elegível neste ciclo no momento.</p>`
            : `
          <button type="button" class="flex items-center gap-1.5 w-full text-left text-[11px] text-muted-foreground hover:text-foreground transition-colors" data-cycle-people-toggle>
            <span>${peopleResumo}</span>
            <span class="text-[10px]">${this.cyclePeopleExpanded ? '▴' : '▾'}</span>
          </button>
          <div class="mettri-cycle-people-list ${this.cyclePeopleExpanded ? '' : 'hidden'}">${cyclePeopleListHtml}</div>
          `}
        </div>

        <!-- 5. Ações: Enviar e Simular -->
        <div class="flex flex-wrap gap-2">
          <button type="button" id="retomar-cycle-send" class="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" ${sendDisabled ? 'disabled' : ''}>
            Enviar para ${M} pessoa${M !== 1 ? 's' : ''}
          </button>
          <button type="button" id="retomar-cycle-simulate" class="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-medium hover:bg-accent/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" ${(!hasTextA && this.cycleSendMode !== 'B') || (this.cycleSendMode === 'B' && !hasTextB) ? 'disabled' : ''}>
            Simular
          </button>
        </div>

        <!-- 6. Métricas (este ciclo) -->
        <div class="border-t border-border/50 pt-2">
          <button type="button" class="flex items-center gap-1.5 w-full text-left text-xs font-medium text-muted-foreground hover:text-foreground transition-colors" data-cycle-metrics-toggle>
            <span>Métricas (este ciclo)</span>
            <span class="text-[10px]">${this.cycleMetricsExpanded ? '▴' : '▾'}</span>
          </button>
          ${metricsContent}
        </div>
      </div>
    `;
  }

  /**
   * Contato de teste como InactiveClient para aparecer na lista de Pessoas (Simular envio).
   * Não aparece se estiver em alguma etiqueta (só aparece em modo dia, não em modo etiqueta).
   */
  private getTestContactAsClient(): InactiveClient | null {
    if (!this.testModeEnabled || !this.testContact?.phone || !digitsOnly(this.testContact.phone)) return null;
    const chatId = this.phoneToChatId(this.testContact.phone);
    if (!chatId) return null;
    // Não mostrar contato de teste se estiver em alguma lista (em modo dia, pessoas em listas não aparecem)
    if (this.listsManager && this.listsManager.isInList(chatId)) return null;
    const name = (this.testContact.name || '').trim() || this.testContact.phone;
    return {
      chatId,
      chatName: name,
      phone: this.testContact.phone,
      lastMessageTime: new Date(),
      daysInactive: 0,
      cadenceDay: 0,
      status: 'pending',
      firstName: name || undefined,
      isTestContact: true,
    };
  }

  /**
   * Conteúdo da seção Pessoas: modo dia (selecionados/empty) ou modo etiqueta (membros da lista).
   * 
   * - Modo etiqueta (selectedListId !== null): mostra membros da etiqueta selecionada
   * - Modo dia (selectedListId === null): mostra clientes elegíveis filtrados por dia
   * - Simular envio: contato de teste aparece na lista quando ativo
   */
  private renderPeopleSectionContent(selectedCount: number, selectedClients: InactiveClient[], eligibleClients: InactiveClient[]): string {
    // Modo etiqueta: mostrar membros da etiqueta selecionada
    if (this.selectedListId !== null) {
      const labelName = ETIQUETA_DISPLAY_NAMES[this.selectedListId] ?? 'Etiqueta';
      return this.renderContactsList(this.labelModeClients, `(${labelName})`);
    }
    
    // Modo dia: mostrar clientes elegíveis ou contato de teste
    const testClient = this.getTestContactAsClient();
    if (this.testModeEnabled && testClient) {
      const withTest = this.selectedClients.has(testClient.chatId)
        ? selectedClients
        : [testClient, ...selectedClients.filter(c => c.chatId !== testClient.chatId)];
      if (withTest.length > 0) return this.renderContactsList(withTest);
      return this.renderContactsList([testClient]);
    }
    if (selectedCount > 0) return this.renderContactsList(selectedClients);
    return this.renderEmptyRecipients(eligibleClients);
  }

  /**
   * Renderiza lista de contatos: checkbox + nome + (dias ou etiqueta) + kebab menu.
   * @param labelSuffix - Se definido (modo etiqueta), exibe em vez de "Xd".
   */
  private renderContactsList(clients: InactiveClient[], labelSuffix?: string): string {
    // Limitar a 6 itens quando não expandida
    const displayClients = this.isContactsExpanded ? clients : clients.slice(0, 6);

    return displayClients.map(client => {
      const firstName = client.firstName || '';
      const displayLabel = firstName || client.phone || 'Sem nome';
      const isSelected = this.selectedClients.has(client.chatId);
      const isMenuOpen = this.openMenuId === client.chatId;
      const rightLabel = client.isTestContact ? '(Teste)' : (labelSuffix ?? `${client.daysInactive}d`);
      const kebabContent = this.selectedListId !== null
        ? this.renderKebabMenuLabelMode(client.chatId, this.selectedListId)
        : this.renderKebabMenu(client.chatId);

      return `
        <div class="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent/30 transition-colors relative overflow-visible" data-chat-id="${client.chatId}">
          <label class="cursor-pointer flex items-center">
            <input 
              type="checkbox" 
              class="sr-only" 
              ${isSelected ? 'checked' : ''} 
              data-chat-id="${client.chatId}"
            >
            <div class="w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected
          ? 'border-primary bg-primary'
          : 'border-border bg-background'
        }">
              ${isSelected ? `
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M10 3L4.5 8.5L2 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              ` : ''}
            </div>
          </label>
          <span class="text-xs font-medium text-foreground flex-1">${this.escapeHtml(displayLabel)}</span>
          <span class="text-[11px] text-muted-foreground">${this.escapeHtml(rightLabel)}</span>
          <div class="relative" style="overflow: visible; z-index: 1;">
            <button 
              class="w-6 h-6 rounded flex items-center justify-center hover:bg-accent/50 transition-colors" 
              data-kebab-menu="${client.chatId}"
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="3.5" r="1.5" fill="currentColor" class="text-muted-foreground"/>
                <circle cx="7" cy="7" r="1.5" fill="currentColor" class="text-muted-foreground"/>
                <circle cx="7" cy="10.5" r="1.5" fill="currentColor" class="text-muted-foreground"/>
              </svg>
            </button>
            ${isMenuOpen ? kebabContent : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Renderiza menu kebab dropdown para um contato (modo dia). Mostra todas as etiquetas disponíveis.
   */
  private renderKebabMenu(chatId: string): string {
    const allLists = this.lists.filter(l => l.id === 'never-send' || l.id === 'exclusivos' || l.id === 'inativos' || l.type === 'custom');
    const etiquetaButtons = allLists.map(list => {
      const displayName = ETIQUETA_DISPLAY_NAMES[list.id] ?? list.name;
      return `
        <button 
          class="w-full rounded-lg cursor-pointer gap-2.5 text-xs flex items-center px-2 py-1.5 text-muted-foreground focus:bg-accent transition-colors"
          data-action="add-to-list"
          data-list-id="${list.id}"
          data-chat-id="${chatId}"
        >
          <span>${this.escapeHtml(displayName)}</span>
        </button>
      `;
    }).join('');
    
    return `
      <div class="w-48 rounded-xl glass border border-border shadow-xl z-[9999]" data-kebab-dropdown="${chatId}">
        <div class="px-2 py-1.5 text-[11px] font-medium text-muted-foreground/70">
          Adicionar a:
        </div>
        <div class="bg-border/30 my-1 h-px"></div>
        ${etiquetaButtons}
      </div>
    `;
  }

  /**
   * Renderiza menu kebab no modo etiqueta: remover da etiqueta ou mover para outra.
   */
  private renderKebabMenuLabelMode(chatId: string, currentListId: string): string {
    const allLists = this.lists.filter(l => l.id !== currentListId && (l.id === 'never-send' || l.id === 'exclusivos' || l.id === 'inativos' || l.type === 'custom'));
    const moveButtons = allLists.map(list => {
      const displayName = ETIQUETA_DISPLAY_NAMES[list.id] ?? list.name;
      return `
        <button 
          class="w-full rounded-lg cursor-pointer gap-2.5 text-xs flex items-center px-2 py-1.5 text-muted-foreground focus:bg-accent transition-colors"
          data-action="move-to-list"
          data-list-id="${list.id}"
          data-chat-id="${chatId}"
        >
          <span>Mover para ${this.escapeHtml(displayName)}</span>
        </button>
      `;
    }).join('');
    
    return `
      <div class="w-48 rounded-xl glass border border-border shadow-xl z-[9999]" data-kebab-dropdown="${chatId}">
        <button 
          class="w-full rounded-lg cursor-pointer gap-2.5 text-xs flex items-center px-2 py-1.5 text-muted-foreground focus:bg-accent transition-colors"
          data-action="remove-from-label"
          data-chat-id="${chatId}"
        >
          <span>Remover desta etiqueta</span>
        </button>
        ${moveButtons ? `
        <div class="bg-border/30 my-1 h-px"></div>
        ${moveButtons}
        ` : ''}
      </div>
    `;
  }

  /**
   * Renderiza lista de destinatários no formato unificado (mantido para compatibilidade).
   */
  public renderUnifiedRecipientsList(clients: InactiveClient[]): string {
    return this.renderContactsList(clients);
  }

  /**
   * Renderiza estado vazio da lista de destinatários.
   */
  private renderEmptyRecipients(eligibleClients: InactiveClient[]): string {
    if (eligibleClients.length === 0) {
      return `
        <div class="glass-subtle rounded-xl p-3 text-center space-y-1">
          <p class="text-[11px] text-muted-foreground">Nenhum cliente inativo encontrado para este período.</p>
        </div>
      `;
    }

    return `
              <div class="glass-subtle rounded-xl p-3 text-center space-y-1">
                <p class="text-[11px] text-muted-foreground">Selecione clientes usando os botões acima.</p>
                <p class="text-[11px] text-primary font-medium">${eligibleClients.length} disponível${eligibleClients.length !== 1 ? 'eis' : ''} para ${this.getChamadaLabelByRangeIndex(this.selectedRangeIndex ?? 0) || 'este período'}</p>
              </div>
    `;
  }

  /**
   * Calcula quantos clientes estão inativos há mais de X dias.
   */
  public getInactiveCountForDay(day: number): number {
    return this.eligibleClients.filter(client => client.daysInactive === day).length;
  }

  /**
   * Retorna lista de ciclos com contagem e seleção (para o bloco Ciclos de contato).
   * Ciclo i (i < n-1) usa cadenceDays[i]; última linha sempre "Última tentativa" com último dia.
   */
  private getChamadasWithCounts(): {
    id: string;
    label: string;
    day: number;
    count: number;
    selected: boolean;
    campaignLabel: string | null;
    rangeIndex: number;
  }[] {
    const ranges = getRangesForType(this.selectedRelationType, this.customRelationIntervalDays);
    const n = Math.min(ranges.length, CHAMADAS_CONFIG.length);
    if (n === 0) return [];

    const result: {
      id: string;
      label: string;
      day: number;
      count: number;
      selected: boolean;
      campaignLabel: string | null;
      rangeIndex: number;
    }[] = [];

    for (let i = 0; i < n; i++) {
      const range = ranges[i];
      const config = i < CHAMADAS_CONFIG.length - 1 ? CHAMADAS_CONFIG[i] : CHAMADAS_CONFIG[CHAMADAS_CONFIG.length - 1];

      const count = this.eligibleClients.filter(c =>
        isInRange(c.daysInactive, range) &&
        c.status === 'pending' &&
        !c.isSpecialList
      ).length;

      // Destaque da linha = ciclo "aberto" (expandido), não quantidade de clientes selecionados.
      const isOpen = this.selectedRangeIndex === i;

      result.push({
        id: config.id,
        // Mantém o label visual original (Primeira, Segunda, Terceira, Última tentativa)
        label: config.label,
        day: range.min,
        count,
        selected: isOpen,
        campaignLabel: config.campaignLabel,
        rangeIndex: i,
      });
    }

    return result;
  }

  /**
   * Garante que o array de mensagens por ciclo tenha pelo menos 4 posições.
   */
  private ensureCycleMessagesSize(): void {
    if (this.cycleMessages.length >= 4) return;
    while (this.cycleMessages.length < 4) {
      this.cycleMessages.push({ textA: '', textB: null });
    }
  }

  private formatRetomarResponseRate(m: RetomarMetricsResult): string {
    return Math.abs(m.responseRate - Math.round(m.responseRate)) < 1e-6
      ? `${Math.round(m.responseRate)}`
      : m.responseRate.toFixed(1);
  }

  private formatRetomarAvgMinutes(m: RetomarMetricsResult): string {
    return m.avgResponseTimeMinutes === null ? '—' : `${m.avgResponseTimeMinutes.toFixed(1)} min`;
  }

  /**
   * Seção de import de lista XLSX — visível apenas quando fonte = last-purchase-import.
   */
  private renderPurchaseImportSection(): string {
    if (this.selectedActivitySource !== 'last-purchase-import') return '';

    const s = this.purchaseImportSummary;
    let infoHtml = '';
    if (s) {
      const importedDate = new Date(s.importedAt);
      const ageMs = Date.now() - importedDate.getTime();
      const ageDays = Math.floor(ageMs / 86_400_000);
      const dateStr = importedDate.toLocaleDateString('pt-BR');
      const staleWarning = ageDays > 7
        ? `<span class="text-yellow-600 text-xs ml-1">(importado há ${ageDays} dias — considere reimportar)</span>`
        : '';
      infoHtml = `
        <div class="mt-1 text-xs text-muted-foreground">
          ${s.filename ? `<span class="font-medium">${this.escapeHtml(s.filename)}</span> · ` : ''}
          ${s.totalRows} linha(s) · ${s.matchedCount} com chat · ${s.unmatchedCount} sem match
          · importado em ${dateStr}${staleWarning}
        </div>`;
    } else if (!this.purchaseImportSnapshot) {
      infoHtml = `<div class="mt-1 text-xs text-muted-foreground">Nenhuma lista importada ainda. Selecione um arquivo XLSX.</div>`;
    }

    return `
      <div class="mt-3 flex flex-col gap-1">
        <label class="text-xs font-medium text-foreground cursor-pointer inline-flex items-center gap-2">
          <span>Importar lista (.xlsx)</span>
          <input
            id="retomar-xlsx-import-input"
            type="file"
            accept=".xlsx"
            class="text-xs text-muted-foreground file:mr-2 file:text-xs file:rounded file:border-0 file:bg-primary/10 file:text-primary file:cursor-pointer hover:file:bg-primary/20 cursor-pointer"
          />
        </label>
        ${infoHtml}
      </div>`;
  }

  /**
   * Cartão "Retomar conversas": métricas reais (todos os ciclos, variantes A e B).
   */
  private renderRetomarSummaryMetricsSection(): string {
    const periodOpts = [
      { value: '7', label: '7 dias' },
      { value: '30', label: '30 dias' },
    ];
    const v = this.retomarSummaryView;
    let metricsHtml: string;
    if (!v || v.kind === 'loading') {
      metricsHtml = `<span class="text-muted-foreground">Carregando métricas…</span>`;
    } else if (v.kind === 'error') {
      metricsHtml = `<span class="text-destructive">${this.escapeHtml(v.message)}</span>`;
    } else {
      const m = v.metrics;
      const rateStr = this.formatRetomarResponseRate(m);
      const avgStr = this.formatRetomarAvgMinutes(m);
      metricsHtml = `
          <span class="text-muted-foreground">Envios</span>
          <span class="font-medium text-foreground tabular-nums">${m.sentCount}</span>
          <span class="text-muted-foreground"> · </span>
          <span class="text-muted-foreground">Respostas</span>
          <span class="font-medium text-foreground tabular-nums">${m.respondedCount}</span>
          <span class="text-muted-foreground"> · </span>
          <span class="text-muted-foreground">Taxa</span>
          <span class="font-medium text-foreground tabular-nums">${rateStr}%</span>
          <span class="text-muted-foreground"> · </span>
          <span class="text-muted-foreground">Tempo médio</span>
          <span class="font-medium text-foreground tabular-nums">${avgStr}</span>`;
    }
    return `
        <div class="mt-3 pt-3 border-t border-border/50 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs mettri-retomar-metrics">
          <div class="flex flex-wrap items-center gap-2 shrink-0">
            <select id="retomar-summary-metrics-period" class="text-xs rounded border border-border bg-background px-2 py-1" aria-label="Período das métricas Retomar">
              ${periodOpts
                .map(
                  o =>
                    `<option value="${o.value}" ${o.value === String(this.retomarSummaryPeriodDays) ? 'selected' : ''}>${o.label}</option>`,
                )
                .join('')}
            </select>
          </div>
          <div class="flex flex-wrap items-baseline gap-x-3 gap-y-0 min-w-0">${metricsHtml}</div>
        </div>`;
  }

  /** Agrega envios Retomar da conta no período (sem filtrar ciclo nem variante). */
  private async loadRetomarSummaryMetrics(): Promise<void> {
    const since = new Date(Date.now() - this.retomarSummaryPeriodDays * 24 * 60 * 60 * 1000);
    const until = new Date();
    try {
      const metrics = await retomarMetricsResolver({
        accountId: this.accountId,
        since,
        until,
        messageDB,
      });
      this.retomarSummaryView = { kind: 'ok', metrics };
    } catch (err) {
      console.warn('[RETOMAR] Falha ao carregar métricas resumo:', err);
      this.retomarSummaryView = {
        kind: 'error',
        message: 'Não foi possível carregar métricas.',
      };
    }
  }

  /**
   * Carrega métricas reais de envios Retomar para o ciclo selecionado.
   */
  private renderRetomarCycleMetricsRows(m: RetomarMetricsResult): string {
    const rateStr = this.formatRetomarResponseRate(m);
    const avgStr = this.formatRetomarAvgMinutes(m);
    return `
    <div class="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 text-[11px]">
      <span class="text-muted-foreground">Envios</span>
      <span class="font-medium text-foreground tabular-nums text-right">${m.sentCount}</span>
      <span class="text-muted-foreground">Respostas</span>
      <span class="font-medium text-foreground tabular-nums text-right">${m.respondedCount}</span>
      <span class="text-muted-foreground">Taxa</span>
      <span class="font-medium text-foreground tabular-nums text-right">${rateStr}%</span>
      <span class="text-muted-foreground">Tempo médio</span>
      <span class="font-medium text-foreground tabular-nums text-right">${avgStr}</span>
    </div>`;
  }

  private async loadCycleMetrics(): Promise<void> {
    if (this.selectedRangeIndex == null) {
      this.cycleMetricsView = null;
      return;
    }
    this.cycleMetricsView = { kind: 'loading' };
    this.updateUnifiedFlow();

    const cycleIndex = (this.selectedRangeIndex + 1) as 1 | 2 | 3 | 4;
    const since = new Date(Date.now() - this.cycleMetricsPeriodDays * 24 * 60 * 60 * 1000);
    const until = new Date();
    const base = {
      accountId: this.accountId,
      since,
      until,
      cycleIndex,
      messageDB,
    } as const;

    try {
      if (this.cycleSendMode === 'AB') {
        const [metricsA, metricsB] = await Promise.all([
          retomarMetricsResolver({ ...base, variant: 'A' }),
          retomarMetricsResolver({ ...base, variant: 'B' }),
        ]);
        this.cycleMetricsView = {
          kind: 'ok',
          columns: [
            { label: 'A', metrics: metricsA },
            { label: 'B', metrics: metricsB },
          ],
        };
      } else {
        const variant = this.cycleSendMode === 'B' ? 'B' : 'A';
        const metrics = await retomarMetricsResolver({ ...base, variant });
        this.cycleMetricsView = { kind: 'ok', columns: [{ label: variant, metrics }] };
      }
    } catch (err) {
      console.warn('[RETOMAR] Falha ao carregar métricas:', err);
      this.cycleMetricsView = {
        kind: 'error',
        message: 'Não foi possível carregar métricas.',
      };
    }
    this.updateUnifiedFlow();
  }

  /**
   * Gera variação (Texto B) via IA a partir do Texto A, campanha e tipo de relação.
   * Delega ao módulo ai-suggestion; em caso de falha, loga e retorna fallback.
   */
  private async suggestMessageByAI(params: {
    textA: string;
    campaignLabel: string | null;
    relationType: RelationType;
  }): Promise<string> {
    const base = (params.textA || '').trim();
    if (!base) return '';

    try {
      return await suggestText(this.bridge, {
        text: base,
        campaign: params.campaignLabel ?? undefined,
        relationType: params.relationType,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.addLog('warning', `IA: ${msg}`);
      return `${base}\n\n(Variação sugerida automaticamente)`;
    }
  }

  /** Retorna o label do ciclo para uma faixa (ex.: "21–41"). */
  private getChamadaLabelByRangeIndex(rangeIndex: number): string {
    const chamadas = this.getChamadasWithCounts();
    const chamada = chamadas[rangeIndex];
    return chamada?.label ?? '';
  }

  /**
   * Bloco avançado com dias da régua (modo Personalizado) – apenas visual.
   */
  private renderCustomCadenceAdvanced(): string {
    if (this.cadenceDays.length === 0) {
      return `
        <div class="mettri-relation-type-custom-advanced">
          <p class="mettri-relation-type-custom-advanced-empty">Nenhum dia configurado na régua.</p>
        </div>
      `;
    }

    const days = [...this.cadenceDays].sort((a, b) => a - b);
    const first = days[0];
    const second = days[1];
    const third = days[2];
    const last = days[days.length - 1];

    const rows: string[] = [];
    if (first !== undefined) {
      rows.push(`
        <div class="mettri-chamadas-config-row">
          <span class="mettri-chamadas-config-label">Primeira tentativa</span>
          <span class="mettri-chamadas-config-value">${first} dias</span>
        </div>
      `);
    }
    if (second !== undefined && days.length >= 2) {
      rows.push(`
        <div class="mettri-chamadas-config-row">
          <span class="mettri-chamadas-config-label">Segunda tentativa</span>
          <span class="mettri-chamadas-config-value">${second} dias</span>
        </div>
      `);
    }
    if (third !== undefined && days.length >= 3) {
      rows.push(`
        <div class="mettri-chamadas-config-row">
          <span class="mettri-chamadas-config-label">Terceira tentativa</span>
          <span class="mettri-chamadas-config-value">${third} dias</span>
        </div>
      `);
    }
    if (last !== undefined) {
      rows.push(`
        <div class="mettri-chamadas-config-row">
          <span class="mettri-chamadas-config-label">Última tentativa</span>
          <span class="mettri-chamadas-config-value">${last} dias</span>
        </div>
      `);
    }

    // Pré-visualização das faixas "Último contato" (usa ranges reais, incl. teto da 4ª faixa).
    const rangesPreview = getRangesForType(
      this.selectedRelationType ?? 'frequente',
      this.customRelationIntervalDays
    );
    const previewParts = rangesPreview.map(r =>
      Number.isFinite(r.max) ? `${r.min}–${r.max} dias` : `${r.min}+ dias`
    );

    return `
      <div class="mettri-relation-type-custom-advanced">
        ${rows.join('')}
        <div class="mettri-relation-type-custom-preview">
          <span class="mettri-relation-type-custom-preview-label">Último contato:</span>
          <span class="mettri-relation-type-custom-preview-value">${previewParts.join(' · ')}</span>
        </div>
      </div>
    `;
  }

  /**
   * Popover/cartão de configuração da régua acionado pela engrenagem em Ciclos de contato.
   * Apenas visual: espelha os dias atuais da régua.
   */
  private renderChamadasConfigPopover(): string {
    return `
      <div class="mettri-chamadas-config-popover">
        <div class="mettri-chamadas-config-header">
          <span class="mettri-chamadas-config-title">Configuração da régua</span>
          <span class="mettri-chamadas-config-subtitle">Ciclos usam estes dias</span>
        </div>
        ${this.renderCustomCadenceAdvanced()}
      </div>
    `;
  }

  /**
   * Intervalo padrão em dias para o modo Personalizado (apenas UI).
   * Usa a média entre os degraus da régua atual ou o primeiro dia como fallback.
   */
  private getDefaultCustomIntervalDays(): number {
    if (this.cadenceDays.length === 0) return 21;
    if (this.cadenceDays.length === 1) return this.cadenceDays[0];
    let totalDiff = 0;
    for (let i = 1; i < this.cadenceDays.length; i++) {
      totalDiff += Math.max(this.cadenceDays[i] - this.cadenceDays[i - 1], 0);
    }
    const avg = totalDiff / (this.cadenceDays.length - 1);
    return Math.max(1, Math.round(avg || this.cadenceDays[0]));
  }

  /**
   * Calcula filtros por dia da régua (ex.: 21, 42, 73, 116 para Frequente) com contagens e estado.
   */
  private calculatePeriodFilters(): void {
    const ranges = getRangesForType(this.selectedRelationType, this.customRelationIntervalDays);
    this.periodFilters = ranges.map((range) => {
      const count = this.eligibleClients.filter(c =>
        isInRange(c.daysInactive, range) &&
        c.status === 'pending' &&
        !c.isSpecialList
      ).length;
      const selected = this.eligibleClients.some(c =>
        isInRange(c.daysInactive, range) && this.selectedClients.has(c.chatId)
      );
      const label = Number.isFinite(range.max) ? `${range.min}–${range.max}` : `${range.min}+`;
      return {
        range: label,
        count,
        selected,
        variant: selected ? 'filled' : 'outline',
      };
    });
  }

  /**
   * Retorna contagem de clientes por dia da régua.
   */
  private getCadenceCounts(): Record<number, number> {
    const counts: Record<number, number> = {};
    this.cadenceDays.forEach((day, index) => {
      const next = this.cadenceDays[index + 1] ?? Infinity;
      counts[day] = this.eligibleClients.filter(c =>
        c.daysInactive >= day &&
        c.daysInactive < next
      ).length;
    });
    return counts;
  }

  /**
   * Renderiza cards de estatísticas.
   */
  public renderStats(): void {
    if (!this.container) return;

    const statsContainer = this.container.querySelector('#retomar-stats');
    if (!statsContainer) return;

    statsContainer.innerHTML = `
      <div class="mettri-stat-card">
        <div class="stat-value">${this.stats.totalEligible}</div>
        <div class="stat-label">Elegíveis</div>
      </div>
      <div class="mettri-stat-card">
        <div class="stat-value">${this.stats.selected}</div>
        <div class="stat-label">Selecionados</div>
      </div>
      <div class="mettri-stat-card">
        <div class="stat-value">${this.stats.sentToday}</div>
        <div class="stat-label">Enviadas Hoje</div>
      </div>
      <div class="mettri-stat-card">
        <div class="stat-value">${this.stats.responseRate}%</div>
        <div class="stat-label">Taxa de Resposta</div>
      </div>
    `;
  }

  /**
   * Renderiza logs de monitoramento.
   */
  private renderLogs(): void {
    if (!this.container) return;

    const logsContainer = this.container.querySelector('#retomar-logs');
    if (!logsContainer) return;

    if (this.logs.length === 0) {
      logsContainer.innerHTML = '<div class="mettri-logs-empty">Nenhum log ainda. Os eventos aparecerão aqui.</div>';
      return;
    }

    logsContainer.innerHTML = this.logs.map(log => {
      const time = log.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const icon = {
        success: '✓',
        error: '✗',
        info: '→',
        warning: '⚠',
      }[log.type] || '•';

      return `
        <div class="mettri-log-entry mettri-log-${log.type}">
          <span class="mettri-log-time">[${time}]</span>
          <span class="mettri-log-icon">${icon}</span>
          <span class="mettri-log-message">${this.escapeHtml(log.message)}</span>
        </div>
      `;
    }).join('');

    // Scroll para o final
    logsContainer.scrollTop = logsContainer.scrollHeight;
  }

  /**
   * Configura event listeners.
   */
  private setupEventListeners(): void {
    // Configurar listeners do fluxo unificado
    this.setupUnifiedFlowListeners();

    // Limpar logs
    const clearLogsBtn = this.container?.querySelector('#retomar-clear-logs');
    clearLogsBtn?.addEventListener('click', () => {
      this.logs = [];
      this.renderLogs();
    });

  }

  /**
   * Mostra diálogo para editar régua.
   */
  private async showEditCadenceDialog(): Promise<void> {
    const input = prompt('Digite os dias da régua separados por vírgula (ex: 21,42,73,116):', this.cadenceDays.join(','));
    if (input) {
      const days = input.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d) && d > 0);
      if (days.length > 0) {
        this.cadenceDays = days.sort((a, b) => a - b);
        await this.saveConfig();
        await this.loadInactiveClients();
        // Resetar dia selecionado para o primeiro da nova régua
        this.selectedInactiveDay = this.cadenceDays[0] || 21;
        this.renderContent();
        this.addLog('success', `Régua atualizada: ${this.cadenceDays.join(', ')} dias`);
        this.updateUnifiedFlow();
      }
    }
  }


  /**
   * Manipula ações dos cards de clientes.
   */
  private handleClientAction(action: string, chatId: string): void {
    const client = this.eligibleClients.find(c => c.chatId === chatId);
    if (!client) return;

    switch (action) {
      case 'skip-today':
        client.status = 'skipped-today';
        this.selectedClients.delete(chatId);
        this.addLog('info', `${client.firstName || client.phone || 'Sem nome'} - Pulado para hoje`);
        break;

      case 'exclude':
        client.status = 'excluded';
        this.selectedClients.delete(chatId);
        this.addLog('info', `${client.firstName || client.phone || 'Sem nome'} - Removido da lista`);
        break;

      case 'special-list':
        client.isSpecialList = true;
        this.selectedClients.delete(chatId);
        this.addLog('info', `${client.firstName || client.phone || 'Sem nome'} - Movido para lista especial`);
        break;
    }

    this.updateUnifiedFlow();
  }

  /**
   * Deseleciona todos os clientes.
   */
  public deselectAllClients(): void {
    this.selectedClients.clear();
    this.updateUnifiedFlow();
  }



  /**
   * Envia mensagens para clientes selecionados.
   */
  private async sendSelectedClients(): Promise<void> {
    if (this.testModeEnabled && this.testContact?.phone) {
      if (!this.messageText.trim()) {
        this.addLog('warning', 'Digite uma mensagem para o teste');
        return;
      }
      
      const chatId = this.phoneToChatId(this.testContact.phone);
      if (!chatId) {
        this.addLog('warning', 'Número de teste inválido');
        return;
      }
      
      try {
        const message = this.messageText.trim();
        if (!message) {
          this.addLog('warning', 'Digite uma mensagem para o teste');
          return;
        }
        await this.sendRawToChatId(chatId, message);
        const label = this.testContact.name || this.testContact.phone;
        this.addLog('success', `Teste enviado para ${label}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.addLog('error', `Teste: ${msg}`);
      }
      return;
    }

    if (this.selectedClients.size === 0) {
      this.addLog('warning', 'Nenhum cliente selecionado');
      return;
    }

    this.sendingQueue = Array.from(this.selectedClients);
    this.pendingChamadaIndex = this.selectedRangeIndex ?? 0;
    this.selectedClients.clear();

    // Popular payload com variant fixa 'A' (envio principal sem A/B)
    this.sendingPayloadByChatId.clear();
    const msg = this.messageText.trim() || 'Olá! Sentimos sua falta por aqui.';
    for (const id of this.sendingQueue) {
      this.sendingPayloadByChatId.set(id, { text: msg, variant: 'A' });
    }

    await this.saveQueueState();

    // Inicializar progresso
    this.sendingProgress = {
      total: this.sendingQueue.length,
      sent: 0,
      skipped: 0,
      errors: 0,
      current: null,
      startTime: Date.now(),
    };

    this.isSending = true;
    this.addLog('info', `Iniciando envio para ${this.sendingQueue.length} cliente(s)...`);
    this.updateUnifiedFlow();

    await this.processQueue();
  }

  private async processQueue(): Promise<void> {
    this.sendingProgress.startTime = Date.now();
    
    while (this.sendingQueue.length > 0) {
      if (this.isPaused) {
        await this.waitForResume();
        continue;
      }
      
      const chatId = this.sendingQueue[0];
      const client = this.eligibleClients.find(c => c.chatId === chatId);
      
      // Atualizar progresso ANTES de processar
      this.sendingProgress.current = client?.chatName || 'Desconhecido';
      this.updateProgressUI();
      
      // Verificar se está em lista (listas bloqueiam envio)
      if (this.listsManager && this.listsManager.isInList(chatId)) {
        this.sendingProgress.skipped++;
        this.logSkip(chatId, 'Cliente em lista bloqueada');
        this.sendingQueue.shift();
        this.updateProgressUI();
        await this.saveQueueState();
        continue;
      }

      if (!this.testModeEnabled) {
        const gate = await verifyRetomarPreSend({
          accountId: this.accountId,
          chatId,
          pendingRangeIndex: this.pendingChamadaIndex ?? 0,
          relationType: this.selectedRelationType ?? 'frequente',
          customRelationIntervalDays: this.customRelationIntervalDays,
        });
        if (!gate.ok) {
          this.sendingProgress.skipped++;
          this.logSkip(chatId, gate.reason);
          this.sendingQueue.shift();
          this.updateProgressUI();
          await this.saveQueueState();
          continue;
        }
      }
      
      // Verificar rate limit
      const check = this.rateLimiter.canSend();
      if (!check.allowed) {
        const waitMs = check.waitMs ?? this.rateLimiter.getDelay();
        this.addLog('info', `Aguardando limite: ${check.reason ?? 'rate limit'} (${Math.round(waitMs / 1000)}s)`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }

      // Pausa aleatória (10-30% chance a cada 10 mensagens)
      if (this.rateLimiter.shouldRandomPause()) {
        const pauseMs = Math.random() * 30000 + 10000; // 10-40s
        this.addLog('info', `Pausa aleatória: ${Math.round(pauseMs / 1000)}s`);
        await new Promise(resolve => setTimeout(resolve, pauseMs));
      }

      try {
        const sentOk = await this.sendToClient(chatId);
        if (sentOk) {
          this.sendingProgress.sent++;
          this.rateLimiter.recordSent();
        } else {
          this.sendingProgress.errors++;
        }
      } catch (error) {
        this.sendingProgress.errors++;
        this.logError(error);
      }
      
      // Atualizar progresso DEPOIS de processar
      this.updateProgressUI();
      
      // Delay aleatório
      const delay = this.rateLimiter.getDelay();
      await new Promise(resolve => setTimeout(resolve, delay));
      
      this.sendingQueue.shift();
      await this.saveQueueState();
    }
    
    this.isSending = false;
    this.sendingProgress.current = null;
    this.updateProgressUI();
    
    if (this.sendingQueue.length === 0) {
      this.addLog('success', 'Envio concluído');
      await this.clearQueueState();
    } else if (this.isPaused) {
      this.addLog('info', 'Envio pausado');
    }
    await this.loadRetomarSummaryMetrics();
    this.updateUnifiedFlow();
  }

  /**
   * Aguarda retomada do envio (quando pausado).
   */
  private async waitForResume(): Promise<void> {
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (!this.isPaused) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Registra log de cliente pulado.
   */
  private logSkip(chatId: string, reason: string): void {
    const client = this.eligibleClients.find(c => c.chatId === chatId);
    const label = client?.firstName || client?.phone || chatId;
    this.addLog('info', `${label} - Pulado: ${reason}`);
  }

  /**
   * Registra log de erro.
   */
  private logError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.addLog('error', `Erro: ${message}`);
  }

  private async saveQueueState(): Promise<void> {
    try {
      await this.bridge.storageSet({
        [this.STORAGE_KEY_QUEUE]: this.sendingQueue,
        [this.STORAGE_KEY_PAUSED]: this.isPaused,
      });
    } catch (error) {
      console.error('[RETOMAR] Erro ao salvar fila:', error);
    }
  }

  private async clearQueueState(): Promise<void> {
    try {
      await this.bridge.storageRemove([this.STORAGE_KEY_QUEUE, this.STORAGE_KEY_PAUSED]);
    } catch (error) {
      console.error('[RETOMAR] Erro ao limpar fila:', error);
    }
  }

  private startBackgroundProcessing(): void {
    if (this.backgroundIntervalId !== null) return;

    this.backgroundIntervalId = window.setInterval(async () => {
      if (this.sendingQueue.length > 0 && !this.isPaused && !this.isSending) {
        this.isSending = true;
        await this.processQueue();
        this.isSending = false;
      }
    }, 5000);
  }

  private stopBackgroundProcessing(): void {
    if (this.backgroundIntervalId !== null) {
      clearInterval(this.backgroundIntervalId);
      this.backgroundIntervalId = null;
    }
  }

  public pauseSending(): void {
    this.isPaused = true;
    this.saveQueueState();
    this.addLog('info', 'Envio pausado');
    this.updateUnifiedFlow();
  }

  public resumeSending(): void {
    this.isPaused = false;
    this.saveQueueState();
    this.addLog('info', 'Envio retomado');
    this.updateUnifiedFlow();

    if (this.sendingQueue.length > 0 && !this.isSending) {
      this.isSending = true;
      this.processQueue().finally(() => {
        this.isSending = false;
      });
    }
  }

  /**
   * Envia mensagem bruta para um chatId via WhatsApp Web.
   */
  private async sendRawToChatId(chatId: string, message: string): Promise<void> {
    await sendMessageService.sendText(chatId, message);
  }

  /**
   * Envia mensagem para um cliente específico.
   * Se houver payload A/B, usa texto e variant do payload; senão, usa messageText.
   * @returns true se enviou e persistiu; false se falhou (erro já logado).
   */
  private async sendToClient(chatId: string): Promise<boolean> {
    const client = this.eligibleClients.find(c => c.chatId === chatId);
    if (!client) {
      this.addLog('error', `Cliente não encontrado: ${chatId}`);
      throw new Error(`Cliente não encontrado: ${chatId}`);
    }

    const payload = this.sendingPayloadByChatId.get(chatId);
    const message = payload?.text?.trim() || this.messageText.trim() || 'Olá! Sentimos sua falta por aqui.';
    const variant: 'A' | 'B' = payload?.variant ?? 'A';

    try {
      await this.sendRawToChatId(chatId, message);
      await setLastRetomarOutgoingAt(this.accountId, chatId, new Date());

      client.status = 'sent';
      client.generatedMessage = message;

      if (!this.testModeEnabled && this.pendingChamadaIndex != null) {
        const chamada = (this.pendingChamadaIndex + 1) as 1 | 2 | 3 | 4;
        await retomarContador.setContador(this.accountId, chatId, chamada);
        if (chamada === 4 && this.listsManager) {
          await this.listsManager.addMember('inativos', chatId);
        }

        const captured: CapturedMessage = {
          id: `retomar-${chatId}-${Date.now()}`,
          chatId,
          chatName: client.chatName || client.phone || chatId,
          sender: 'retomar',
          text: message,
          timestamp: new Date(),
          isOutgoing: true,
          type: 'text',
        };
        const chamadas = this.getChamadasWithCounts();
        const meta: RetomarMeta = {
          cycleIndex: chamada,
          variant,
          campaignLabel: chamadas[this.pendingChamadaIndex]?.campaignLabel ?? null,
          accountId: this.accountId,
        };
        messageDB.saveMessageWithRetomarMeta(captured, meta).catch(err => {
          console.warn('[RETOMAR] Falha ao gravar envio no messageDB:', err);
        });
      }

      this.addLog('success', `${client.firstName || client.phone || 'Sem nome'} - Enviado (${variant})`);
      this.updateUnifiedFlow();
      return true;
    } catch (error) {
      this.addLog('error', `${client.firstName || client.phone || 'Sem nome'} - Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      return false;
    }
  }

  /**
   * Todas as listas para exibição: padrão (Bloqueados e CNPJ) + customizadas.
   * Garante que todas as etiquetas apareçam na lista.
   */
  private getEtiquetaListsForDisplay(): RetomarList[] {
    // Listas padrão sempre exibidas primeiro
    const defaultIds: { id: string; color: string }[] = [
      { id: 'never-send', color: '--tag-color-6' },
      { id: 'exclusivos', color: '--tag-color-2' },
      { id: 'inativos', color: '--tag-color-5' },
    ];
    
    const defaultLists = defaultIds.map(({ id, color }) => {
      const existing = this.lists.find(l => l.id === id);
      if (existing) return existing;
      const memberCount = this.listsManager ? this.listsManager.getMembers(id).length : 0;
      return {
        id,
        name: ETIQUETA_DISPLAY_NAMES[id] ?? id,
        type: 'default' as const,
        color,
        isDefault: true,
        memberCount,
        createdAt: 0,
        updatedAt: 0,
      };
    });
    
    // Listas customizadas (todas as outras)
    const customLists = this.lists.filter(l => l.type === 'custom');
    
    // Combinar: padrão primeiro, depois customizadas
    return [...defaultLists, ...customLists];
  }

  /**
   * Renderiza seção de listas (colapsável).
   * Só exibe Bloqueados e CNPJ; chips clicáveis para modo etiqueta.
   */
  private renderLists(): string {
    const headerTitle = this.listsExpanded ? 'Etiquetas Mettri' : 'Etiquetas';
    const etiquetaLists = this.getEtiquetaListsForDisplay();
    return `
      <div class="space-y-2 mb-0 min-w-0">
        <div class="flex items-center justify-between py-2.5 border-b border-border/50 min-w-0">
          <button 
            class="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors min-w-0"
            id="retomar-lists-toggle"
            data-lists-toggle
            type="button"
          >
            <span class="text-sm font-medium">${headerTitle}</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="transition-transform shrink-0 ${this.listsExpanded ? 'rotate-180' : ''}" id="retomar-lists-chevron">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          ${this.SHOW_CREATE_LIST ? `
          <button 
            class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-accent/50 transition-colors shrink-0"
            data-create-list
            title="Nova lista"
            type="button"
          >+</button>
          ` : ''}
        </div>
        ${this.listsExpanded ? `
          <div class="flex flex-col gap-2 min-w-0 pt-2">
            ${etiquetaLists.map(list => this.renderListTag(list)).join('')}
          </div>
          ${this.SHOW_CREATE_LIST ? `
          <button class="mettri-etiquetas-add-row w-full py-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors flex items-center justify-center gap-1" data-create-list type="button">
            <span>+</span>
            <span>Nova lista</span>
          </button>
          ` : ''}
        ` : ''}
      </div>
    `;
  }

  /**
   * Renderiza chip de uma lista (dot + nome + contagem). Clicável para modo etiqueta.
   */
  private renderListTag(list: RetomarList): string {
    const colorVar = list.color;
    const isDefault = list.isDefault;
    const isMenuOpen = this.listMenuOpenId === list.id;
    const memberCount = list.memberCount;
    const displayName = ETIQUETA_DISPLAY_NAMES[list.id] ?? list.name;
    const isSelected = this.selectedListId === list.id;

    return `
      <div 
        class="flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors group relative cursor-pointer overflow-visible ${isSelected ? 'border-primary bg-primary/10' : 'border-border bg-background hover:bg-accent/50'}"
        data-list-id="${list.id}"
        data-list-select="${list.id}"
      >
        <span class="w-3 h-3 rounded-full shrink-0" style="background-color: var(${colorVar})"></span>
        <span class="text-xs font-medium flex-1 min-w-0">${this.escapeHtml(displayName)}</span>
        <span class="text-[11px] opacity-70 shrink-0">(${memberCount})</span>
        <div class="relative shrink-0" style="overflow: visible;">
          <button 
            class="w-5 h-5 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity flex items-center justify-center"
            data-list-menu="${list.id}"
            title="Menu"
            type="button"
          >
            <span class="text-[11px]">⋯</span>
          </button>
          ${isMenuOpen ? this.renderListMenu(list) : ''}
        </div>
      </div>
    `;
  }

  /**
   * Renderiza menu de uma lista customizada.
   */
  private renderListMenu(list: RetomarList): string {
    const blockedClass = list.isDefault ? 'opacity-60' : '';
    const blockedData = list.isDefault ? 'true' : 'false';
    return `
      <div class="w-48 rounded-xl glass border border-border shadow-xl z-[9999]" data-list-menu-dropdown="${list.id}">
        <button 
          class="w-full rounded-lg cursor-pointer gap-2.5 text-xs flex items-center px-2 py-1.5 focus:bg-accent transition-colors"
          data-list-action="view-members"
          data-list-id="${list.id}"
        >
          <span>Ver membros</span>
        </button>
        <button 
          class="w-full rounded-lg cursor-pointer gap-2.5 text-xs flex items-center px-2 py-1.5 focus:bg-accent transition-colors ${blockedClass}"
          data-list-action="rename"
          data-list-id="${list.id}"
          data-list-default="${blockedData}"
        >
          <span>Renomear</span>
        </button>
        <div class="bg-border/30 my-1 h-px"></div>
        <button 
          class="w-full rounded-lg cursor-pointer gap-2.5 text-xs flex items-center px-2 py-1.5 text-destructive focus:bg-destructive/10 focus:text-destructive transition-colors ${blockedClass}"
          data-list-action="delete"
          data-list-id="${list.id}"
          data-list-default="${blockedData}"
        >
          <span>Excluir</span>
        </button>
      </div>
    `;
  }

  /**
   * Renderiza UI de progresso durante envio.
   */
  private renderProgressUI(): string {
    if (!this.isSending) return '';
    
    const progress = this.sendingProgress.total > 0 
      ? (this.sendingProgress.sent / this.sendingProgress.total) * 100 
      : 0;
    
    const elapsed = this.sendingProgress.startTime 
      ? Math.floor((Date.now() - this.sendingProgress.startTime) / 1000)
      : 0;
    const rate = elapsed > 0 ? Math.floor((this.sendingProgress.sent / elapsed) * 60) : 0;
    
    return `
      <div class="border border-border/50 rounded-xl bg-background p-3 space-y-2 shadow-sm">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-foreground">Enviando mensagens</span>
          ${this.isPaused ? `
            <span class="text-[11px] text-muted-foreground">Pausado</span>
          ` : `
            <span class="text-[11px] text-muted-foreground">${rate} msg/min</span>
          `}
        </div>
        
        <!-- Progress bar -->
        <div class="relative h-2 rounded-full overflow-hidden" style="background-color: var(--progress-bg)">
          <div 
            class="h-full rounded-full transition-all duration-300 ease-out"
            style="background-color: var(--progress-fill); width: ${progress}%"
            data-progress-bar
          ></div>
        </div>
        
        <!-- Contadores -->
        <div class="flex items-center justify-between text-[11px]">
          <div class="flex items-center gap-3">
            <span style="color: var(--progress-text)" data-sent-count>
              ${this.sendingProgress.sent} de ${this.sendingProgress.total} enviadas
            </span>
            ${this.sendingProgress.skipped > 0 ? `
              <span class="text-muted-foreground">
                ${this.sendingProgress.skipped} puladas
              </span>
            ` : ''}
            ${this.sendingProgress.errors > 0 ? `
              <span class="text-destructive">
                ${this.sendingProgress.errors} erros
              </span>
            ` : ''}
          </div>
          <span class="text-muted-foreground">${Math.round(progress)}%</span>
        </div>
        
        <!-- Cliente atual -->
        ${this.sendingProgress.current ? `
          <div class="text-[11px] text-muted-foreground truncate" data-current-client>
            Enviando para: ${this.escapeHtml(this.sendingProgress.current)}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Atualiza elementos específicos da UI de progresso (não re-renderiza tudo).
   */
  private updateProgressUI(): void {
    if (!this.container) return;

    const progressBar = this.container.querySelector('[data-progress-bar]') as HTMLElement;
    const sentCount = this.container.querySelector('[data-sent-count]');
    const currentClient = this.container.querySelector('[data-current-client]');
    
    if (progressBar) {
      const progress = this.sendingProgress.total > 0 
        ? (this.sendingProgress.sent / this.sendingProgress.total) * 100 
        : 0;
      progressBar.style.width = `${progress}%`;
    }
    
    if (sentCount) {
      sentCount.textContent = `${this.sendingProgress.sent} de ${this.sendingProgress.total} enviadas`;
    }
    
    if (currentClient && this.sendingProgress.current) {
      currentClient.textContent = `Enviando para: ${this.escapeHtml(this.sendingProgress.current)}`;
    }
  }

  /**
   * Escapa HTML para prevenir XSS.
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }


  /**
   * Libera recursos (especialmente listeners globais em document).
   * Importante para navegação entre módulos sem vazamentos.
   */
  public destroy(): void {
    this.stopBackgroundProcessing();
    if (this.closeMenusHandler) {
      document.removeEventListener('click', this.closeMenusHandler);
      this.closeMenusHandler = null;
    }
    if (this.closeDropdownHandler) {
      document.removeEventListener('click', this.closeDropdownHandler);
      this.closeDropdownHandler = null;
    }
    if (this.closeRelationDropdownHandler) {
      document.removeEventListener('click', this.closeRelationDropdownHandler);
      this.closeRelationDropdownHandler = null;
    }
    if (this.repositionDropdownHandler) {
      window.removeEventListener('scroll', this.repositionDropdownHandler, true);
      window.removeEventListener('resize', this.repositionDropdownHandler);
      this.repositionDropdownHandler = null;
    }
    if (this.sendButtonClickHandler && this.container) {
      this.container.removeEventListener('click', this.sendButtonClickHandler);
      this.sendButtonClickHandler = null;
    }

    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
  }
}
