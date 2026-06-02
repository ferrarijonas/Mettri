import type { AtendimentoViewModel, ComercialPanelVm, CampoConfianca } from './view-model';
import type { RagConsultaDebugInfo, RagExperimentStats } from '../../../modules/rag';

type ActionHandler = (actionId: string, payload?: unknown) => void;
type RetomarEtiquetaVm = Extract<AtendimentoViewModel, { kind: 'ready' }>['retomar']['etiquetas'][number];

/** Rótulos placeholder quando não há `slotsResumo`. */
const COMERCIAL_RESUMO_CAMPOS: readonly string[] = [
  'Intenção',
  'Pedido',
  'Logística',
  'Horário',
  'Valor',
  'Upsell',
  'Fecho',
];

/** Etapas do pipeline. `pendingSvg` = ícone quando a etapa ainda falta. */
const METTRI_PIPELINE_STAGES: readonly {
  id: string;
  short: string;
  label: string;
  pendingSvg: string;
}[] = [
  {
    id: 'itens',
    short: 'Ped',
    label: 'Itens',
    pendingSvg:
      '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>',
  },
  {
    id: 'logistica',
    short: 'Log',
    label: 'Logística',
    pendingSvg:
      '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><path d="M2 8h4"/><path d="M2 12h4"/><path d="M2 16h4"/>',
  },
  {
    id: 'horario',
    short: 'Hor',
    label: 'Horário',
    pendingSvg: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  },
  {
    id: 'valor',
    short: '$',
    label: 'Valor',
    pendingSvg: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  },
  {
    id: 'oferecer',
    short: '↑',
    label: 'Oferecer',
    pendingSvg: '<path d="M12 5v14"/><path d="m19 12-7-7-7 7"/>',
  },
  {
    id: 'fechar',
    short: 'Ok',
    label: 'Fechar Pedido',
    pendingSvg: '<circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>',
  },
];

const COMERCIAL_PIPELINE_CHECK_SVG = '<path d="M20 6L9 17l-5-5"/>';

function normalizeComercialStageKey(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isComercialValueEmpty(value: string): boolean {
  const v = String(value || '').trim();
  if (!v) return true;
  return v === '—' || v === '-' || v === '…' || v.toLowerCase() === 'em aberto' || /^[\s—\-…]+$/.test(v);
}

/** "Chave: valor" → duas colunas; linha sem ":" vira texto único. */
function parseComercialSlotLine(line: string): { label: string; value: string } | null {
  const m = String(line).match(/^([^:]+):\s*(.+)$/);
  if (!m) return null;
  return { label: m[1].trim(), value: m[2].trim() };
}

/** Linhas do resumo: várias linhas OU uma linha com separadores "•". */
function splitComercialSlotsLines(raw: string): string[] {
  const t = String(raw).trim();
  if (!t) return [];
  const byNl = t
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (byNl.length > 1) return byNl;
  if (byNl.length === 1 && byNl[0].includes('•')) {
    return byNl[0]
      .split(/\s*•\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return byNl;
}

/**
 * Tokens visuais do painel (skill `frontend-design-clareza`): system UI, bordas finas,
 * hierarquia por opacidade, estados hover/active/focus explícitos.
 */
const ATD_FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1 focus-visible:ring-offset-background';

/** Seção principal: camada sobre o fundo */
const ATD_SECTION = 'glass-subtle rounded-xl border border-border/20';

const ATD_BTN_TOP = `${ATD_FOCUS} h-7 px-2.5 rounded-lg border border-border/40 bg-secondary/15 text-[10px] font-medium text-foreground/95 transition-colors duration-150 hover:bg-secondary/32 hover:border-border/55 active:bg-secondary/22`;

const ATD_BTN_TOP_SQUARE = `${ATD_FOCUS} w-8 h-8 rounded-lg border border-border/40 bg-secondary/15 text-xs text-foreground transition-colors duration-150 hover:bg-secondary/32 active:bg-secondary/22`;

const ATD_BTN_8 = `${ATD_FOCUS} h-8 px-3 rounded-lg border border-border/40 bg-secondary/15 text-[11px] font-medium text-foreground/95 transition-colors duration-150 hover:bg-secondary/30 hover:border-border/50 active:bg-secondary/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-secondary/15`;

const ATD_BTN_8_DEST = `${ATD_FOCUS} h-8 px-3 rounded-lg border border-destructive/45 bg-destructive/10 text-[11px] font-medium text-destructive transition-colors duration-150 hover:bg-destructive/18 hover:border-destructive/55 active:bg-destructive/22`;

const ATD_BTN_9 = `${ATD_FOCUS} h-9 px-3 rounded-lg border border-border/40 bg-secondary/15 text-[11px] font-medium text-foreground/95 transition-colors duration-150 hover:bg-secondary/30`;

const ATD_BTN_9_PRI = `${ATD_FOCUS} h-9 px-3 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold shadow-sm transition-colors duration-150 hover:bg-primary/92 active:bg-primary/88`;

const ATD_BTN_9_PRI_WIDE = `${ATD_FOCUS} inline-flex h-9 flex-1 min-w-[8rem] items-center justify-center gap-2 rounded-lg bg-primary px-3 text-[11px] font-semibold text-primary-foreground shadow-sm transition-colors duration-150 hover:bg-primary/92 active:bg-primary/88 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary`;

const ATD_BTN_9_SEC_WIDE = `${ATD_FOCUS} inline-flex h-9 flex-1 min-w-[8rem] items-center justify-center gap-2 rounded-lg border border-border/45 bg-background/80 px-3 text-[11px] font-semibold text-foreground/95 shadow-sm transition-colors duration-150 hover:bg-secondary/20 hover:border-border/60 active:bg-secondary/25 disabled:opacity-50 disabled:cursor-not-allowed`;

const ATD_BTN_10_PRI = `${ATD_FOCUS} h-10 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-sm transition-colors duration-150 hover:bg-primary/92 active:bg-primary/88 disabled:opacity-50 disabled:cursor-not-allowed`;

const ATD_BTN_10_SEC = `${ATD_FOCUS} h-10 rounded-lg border border-border/40 bg-secondary/15 text-xs font-medium text-foreground/95 transition-colors duration-150 hover:bg-secondary/30 disabled:opacity-50 disabled:cursor-not-allowed`;

const ATD_ICON_BTN = `${ATD_FOCUS} w-6 h-6 rounded-md text-muted-foreground transition-colors duration-150 hover:bg-secondary/25 hover:text-foreground`;

const ATD_INPUT = `${ATD_FOCUS} rounded-lg border border-border/40 bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/85`;

const ATD_CHIP = 'inline-flex items-center rounded-md border border-border/35 bg-secondary/12 px-2 py-0.5 text-[10px] text-muted-foreground/95';

const ATD_SECTION_TOGGLE = `${ATD_FOCUS} flex items-center gap-1.5 rounded-lg text-left text-xs font-semibold text-foreground/95 transition-colors duration-150 hover:text-primary`;

/**
 * AtendimentoPanel (UI)
 *
 * Metáfora: é a "casca" do painel (layout + componentes).
 * Ela só entende ViewModel e eventos (cliques), não entende banco nem WhatsApp.
 */
export class AtendimentoPanel {
  private container: HTMLElement | null = null;
  private vm: AtendimentoViewModel | null = null;
  private onAction: ActionHandler | null = null;
  private notesOpen = false;
  private retomarExpanded = false;
  private retomarMenuOpenListId: string | null = null;
  private purchaseBlockExpanded = true;
  private purchaseFormOpen = false;
  private ragBlockExpanded = false;
  private ragSuggestionText = '';
  private ragLoading = false;
  private ragSimilarCount: number | null = null;
  private ragDebugOpen = false;
  private ragDebugInfo: RagConsultaDebugInfo | null = null;
  /** Agregados do mini-dashboard: semana (percentuais/médias), hoje e total (~1 ano de chaves). */
  private ragExperimentStatsWeek: RagExperimentStats | null = null;
  private ragExperimentStatsToday: RagExperimentStats | null = null;
  private ragExperimentStatsTotal: RagExperimentStats | null = null;
  /** Persistido via bridge em `mettri:atendimento:rag:auto-suggest`. */
  public ragAutoSuggestEnabled = false;

  /** True enquanto o ouvinte está processando a mensagem (antes do LLM responder). */
  public processandoOuvinte = false;

  /** Bloco Comercial (funil + rascunho): Fase 1 — estado local até o orquestrador existir. */
  private comercialBlockExpanded = true;
  private comercialDraftText = '';
  private comercialLoading = false;
  private comercialErrorMessage: string | null = null;
  private lastComercialChatId: string | null = null;
  /** Status operacional do pedido (UI + futuro filtro): Aberto → pagamento → Fechado. */
  private orderPipelineUi: 'aberto' | 'pagamento' | 'fechado' = 'aberto';

  private ouvinteExpanded = false;

  constructor(params: { onAction?: ActionHandler } = {}) {
    this.onAction = params.onAction ?? null;
  }

  public async render(vm: AtendimentoViewModel): Promise<HTMLElement> {
    if (vm.kind === 'ready') {
      if (this.lastComercialChatId !== vm.customer.chatId) {
        this.comercialDraftText = '';
        this.comercialLoading = false;
        this.comercialErrorMessage = null;
        this.orderPipelineUi = vm.comercial.pedidoConfirmado ? 'fechado' : 'aberto';
      }
      this.lastComercialChatId = vm.customer.chatId;
    } else {
      this.lastComercialChatId = null;
    }

    this.vm = vm;
    const root = document.createElement('div');
    root.className = 'flex flex-col gap-4';
    this.container = root;
    this.renderContent();
    this.bindListeners();
    return root;
  }

  public destroy(): void {
    if (this.container) this.container.innerHTML = '';
    this.container = null;
    this.vm = null;
  }

  private renderContent(): void {
    if (!this.container || !this.vm) return;

    if (this.vm.kind === 'noChat') {
      this.container.innerHTML = `
        <div class="${ATD_SECTION} p-3">
          <div class="text-sm font-semibold text-foreground">${this.escapeHtml(this.vm.title)}</div>
          <div class="text-xs text-muted-foreground mt-1">
            ${this.escapeHtml(this.vm.hint)}
          </div>
        </div>
      `;
      return;
    }

    const demoBadge = this.vm.demoBadge
      ? `<span class="inline-flex items-center rounded-lg border border-border/30 bg-secondary/20 px-2 py-0.5 text-[10px] text-muted-foreground">${this.escapeHtml(this.vm.demoBadge)}</span>`
      : '';

    const badges = this.vm.customer.badges.slice(0, 2).map(b => this.renderBadge(b)).join('');
    const hasMoreBadges = this.vm.customer.badges.length > 2;
    const moreBadges = hasMoreBadges ? this.renderBadge(`+${this.vm.customer.badges.length - 2}`) : '';

    const retomarPanel = this.renderRetomarEtiquetasPanel();

    // Coluna cresce com o conteúdo; a rolagem fica no #mettri-content (shell).
    // Evitar h-full + flex-1 no Pedido: isso comía a altura e cortava RAG / Comercial / registro.
    this.container.innerHTML = `
      <style>
        @keyframes flash-update {
          0%   { background: rgba(34,197,94,0.25); transform: scale(1.02); border-radius: 4px; }
          50%  { background: rgba(34,197,94,0.12); }
          100% { background: transparent; transform: scale(1); }
        }
        @keyframes fadeOutBadge {
          0% { opacity: 1; }
          70% { opacity: 1; }
          100% { opacity: 0; }
        }
        .campo-atualizado { animation: flash-update 1.5s ease-out; }
      </style>
      <div class="relative flex flex-col gap-3 min-h-0">
        <!-- Drawer de Notas -->
        <div class="absolute inset-0 z-[1000] ${this.notesOpen ? '' : 'hidden'}" data-notes-drawer>
          <div class="absolute inset-0 bg-black/50" data-action="notes:close"></div>
          <div class="absolute top-0 left-0 right-0 glass rounded-b-2xl border border-border/40 p-3 shadow-sm">
            <div class="flex items-center justify-between">
              <div class="text-xs font-semibold text-foreground/95">Notas</div>
              <button type="button" class="${ATD_BTN_TOP_SQUARE}" data-action="notes:close">Fechar</button>
            </div>
            <textarea
              class="mt-2 w-full min-h-28 ${ATD_INPUT} resize-y"
              placeholder="${this.escapeHtml(this.vm.notes.placeholder)}"
              data-field="notes"
            >${this.escapeHtml(this.vm.notes.value)}</textarea>
            <div class="mt-2 text-[11px] text-muted-foreground" data-field="notes-status">Salvamento automático</div>
          </div>
        </div>

        <!-- Header do Cliente + Badge de Estado -->
        <div class="${ATD_SECTION} p-2.5">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              ${(() => {
                const name = this.vm.customer.displayName;
                const tipoCliente = this.vm.customer.tipoCliente;
                const isNovoFlag = tipoCliente === 'novo';
                const tipoLabel = tipoCliente === 'recorrente' ? 'Recorrente' : tipoCliente === 'ativo' ? 'Ativo' : tipoCliente === 'contato' ? 'Contato' : null;
                const tipoColor = tipoCliente === 'recorrente'
                  ? 'bg-primary/10 text-primary/90 border-primary/20'
                  : tipoCliente === 'ativo'
                    ? 'bg-primary/8 text-primary/70 border-primary/15'
                    : tipoCliente === 'contato'
                      ? 'bg-secondary/20 text-muted-foreground border-border/30'
                      : '';
                const chipHtml = tipoLabel
                  ? `<span class="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium border ${tipoColor}">${tipoLabel}</span>`
                  : '';
                const novoBadge = isNovoFlag
                  ? `<span class="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium border border-primary/15 bg-primary/8 text-primary/70">Novo</span>`
                  : '';
                // Badge de estado percebido
                const ep = (this.vm && this.vm.kind === 'ready' && this.vm.estadoPercebido)
                  ? this.renderEstadoBadge(this.vm.estadoPercebido)
                  : '';
                return `
                <button type="button" class="w-full text-left cursor-pointer" data-action="open-cadastro">
                  <div class="flex items-center gap-1.5">
                    <span class="text-sm font-semibold text-foreground leading-tight truncate">${this.escapeHtml(name)}</span>
                    ${chipHtml}
                    ${novoBadge}
                    ${demoBadge}
                  </div>
                </button>
                ${ep}`;
              })()}
              <div class="mt-0.5">
                <button type="button" class="text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer" data-action="copy-text" data-text="${this.escapeAttr(this.vm.customer.phoneLabel)}">
                  ${this.escapeHtml(this.vm.customer.phoneLabel)} 📋
                </button>
              </div>
              <div class="mt-1 flex flex-wrap gap-1">
                ${badges}${moreBadges}
              </div>
              ${
                this.vm.kind === 'ready' && this.vm.customer.relacionamentoInicialParaAgente === true
                  ? `<div class="mt-1 rounded-md border border-border/25 bg-secondary/10 px-2 py-1 text-[10px] text-muted-foreground/95 leading-snug">
                Primeiras 48h de contato — contexto ainda em formação.
              </div>`
                  : ''
              }
            </div>
          </div>
        </div>

        <!-- Bloco P: Intenção + Estado + Produtos + Resposta (fundido, substitui funil) -->
        ${this.vm.kind === 'ready' ? `
        <div class="${ATD_SECTION} p-2.5">
          ${this.renderIntencaoChip()}
          ${this.renderPedidoOrderRecord()}
          ${this.renderPedidoUnificado()}
          ${this.renderDetalhesPedido()}
          ${this.renderPendenciasPedido()}
          ${this.renderSugestaoAmbiguidade()}
          ${this.renderOuvinteDebug()}
          ${this.renderVitrineInline()}
          <div class="flex gap-2 mt-2">
            <button type="button" class="${ATD_BTN_9_PRI_WIDE}" data-action="order:send-resume">Enviar resumo no WhatsApp</button>
            <button type="button" class="${ATD_BTN_9_SEC_WIDE}" data-action="order:register-mock">Criar pedido</button>
          </div>
        </div>
        ` : ''}

        <!-- Preferências do Cliente (expansível) + Histórico -->
        ${this.vm.kind === 'ready' ? this.renderOuvinteFieldsCompact(this.vm.customer) : ''}
        ${this.vm.kind === 'ready' ? this.renderHistoricoCliente() : ''}

        <!-- Resposta sugerida (LLM) — confirmação rápida do ouvinte -->
        ${this.renderRespostaSugeridaBlock()}

        <!-- Resposta sugerida (RAG) — abaixo de cliente & venda -->
        ${this.renderRagSuggestionBlock()}

        ${retomarPanel}
      </div>
    `;
    if (this.vm.kind === 'ready') {
      this.bindRagAutoSuggestListener();
    }
  }

  private bindListeners(): void {
    if (!this.container) return;

    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest?.('[data-action]') as HTMLElement | null;
      if (!btn) return;
      const action = btn.getAttribute('data-action') || '';

      // Ações que copiam texto
      if (action === 'copy-text') {
        const text = btn.getAttribute('data-text') || '';
        this.copyToClipboard(text);
        return;
      }

      if (action === 'notes:open') {
        this.notesOpen = true;
        this.renderContent();
        this.bindNotesListeners();
        return;
      }

      if (action === 'notes:close') {
        this.notesOpen = false;
        this.renderContent();
        return;
      }

      if (action === 'ouvinte:toggle') {
        this.ouvinteExpanded = !this.ouvinteExpanded;
        this.renderContent();
        return;
      }

      if (action === 'rag:toggle-expand') {
        this.ragBlockExpanded = !this.ragBlockExpanded;
        this.renderContent();
        return;
      }

      if (action === 'comercial:toggle-expand') {
        this.comercialBlockExpanded = !this.comercialBlockExpanded;
        this.renderContent();
        return;
      }

      if (action === 'comercial:generate') {
        if (this.comercialLoading) return;
        this.comercialErrorMessage = null;
        this.comercialLoading = true;
        this.renderContent();
        this.bindListeners();
        this.onAction?.('comercial:generate');
        window.setTimeout(() => {
          this.comercialLoading = false;
          this.comercialDraftText =
            'Oi! Para eu fechar certinho: você prefere retirada aqui ou entrega? Se for hoje, qual horário funciona melhor pra você?';
          this.renderContent();
          this.bindListeners();
          if (this.vm?.kind === 'ready') this.bindRagAutoSuggestListener();
        }, 550);
        return;
      }

      if (action === 'comercial:send') {
        const textarea = this.container?.querySelector('[data-field="comercial-draft"]') as HTMLTextAreaElement | null;
        const text = textarea?.value?.trim() ?? this.comercialDraftText;
        this.onAction?.('comercial:send', { text });
        return;
      }

      if (action === 'comercial:demo-error') {
        this.comercialErrorMessage = this.comercialErrorMessage
          ? null
          : 'Não foi possível gerar o rascunho agora. Verifique a conexão e tente de novo.';
        this.renderContent();
        this.bindListeners();
        if (this.vm?.kind === 'ready') this.bindRagAutoSuggestListener();
        return;
      }

      if (action === 'order-status:set') {
        const raw = btn.getAttribute('data-status') || '';
        if (raw === 'aberto' || raw === 'pagamento' || raw === 'fechado') {
          this.orderPipelineUi = raw;
          this.renderContent();
          this.bindListeners();
          if (this.vm?.kind === 'ready') this.bindRagAutoSuggestListener();
        }
        return;
      }

      if (action === 'order:register-mock') {
        this.onAction?.('order:register-mock');
        window.alert('Pedido registrado (mock).');
        return;
      }

      if (action === 'vitrine:add') {
        const productId = String(btn.getAttribute('data-product-id') || '');
        this.onAction?.('vitrine:add', { productId });
        return;
      }

      if (action === 'sugestao:generate') {
        this.onAction?.('sugestao:generate');
        return;
      }

      if (action === 'sugestao:send') {
        const textarea = this.container?.querySelector('[data-field="sugestao-unificada"]') as HTMLTextAreaElement | null;
        const text = textarea?.value?.trim() ?? '';
        this.onAction?.('sugestao:send', { text });
        return;
      }

      if (action === 'resposta:enviar') {
        const text = btn.getAttribute('data-text') || '';
        if (text) {
          this.onAction?.('resposta:enviar', { text });
        }
        return;
      }

      if (action === 'resposta:recusar') {
        this.onAction?.('resposta:recusar');
        return;
      }

      if (action === 'rag:generate') {
        if (this.ragLoading) return;
        this.ragLoading = true;
        this.ragSimilarCount = null;
        this.renderContent();
        this.onAction?.('rag:generate');
        return;
      }

      if (action === 'rag:send') {
        const textarea = this.container?.querySelector('[data-field="rag-suggestion"]') as HTMLTextAreaElement | null;
        const text = textarea?.value?.trim() ?? this.ragSuggestionText;
        this.onAction?.('rag:send', { text });
        return;
      }

      if (action === 'rag:toggle-debug') {
        this.ragDebugOpen = !this.ragDebugOpen;
        this.renderContent();
        return;
      }

      if (action === 'purchase:toggle-expand') {
        this.purchaseBlockExpanded = !this.purchaseBlockExpanded;
        this.renderContent();
        return;
      }

      if (action === 'manual:open-register') {
        this.purchaseFormOpen = true;
        this.renderContent();
        return;
      }

      if (action === 'manual:close-purchase-form') {
        this.purchaseFormOpen = false;
        this.renderContent();
        return;
      }

      if (action === 'manual:submit-purchase') {
        const dateEl = this.container?.querySelector('[data-field="purchase-date"]') as HTMLInputElement | null;
        const valueEl = this.container?.querySelector('[data-field="purchase-value"]') as HTMLInputElement | null;
        const itemsEl = this.container?.querySelector('[data-field="purchase-items"]') as HTMLTextAreaElement | null;
        const notesEl = this.container?.querySelector('[data-field="purchase-notes"]') as HTMLTextAreaElement | null;
        const dateVal = dateEl?.value?.trim();
        if (!dateVal) {
          alert('Informe a data da compra.');
          return;
        }
        const valueNum = valueEl?.value != null && valueEl.value !== '' ? Number(valueEl.value) : undefined;
        if (valueNum !== undefined && (Number.isNaN(valueNum) || valueNum < 0)) {
          alert('Valor deve ser um número maior ou igual a zero.');
          return;
        }
        const itemsRaw = itemsEl?.value?.trim();
        const items = itemsRaw ? itemsRaw.split(',').map(s => s.trim()).filter(Boolean) : undefined;
        const notes = notesEl?.value?.trim() || undefined;
        this.purchaseFormOpen = false;
        this.onAction?.('manual:add-purchase', {
          purchaseDate: dateVal,
          value: valueNum,
          items,
          notes,
        });
        this.renderContent();
        return;
      }

      if (action === 'manual:remove-purchase') {
        const purchaseId = String(btn.getAttribute('data-purchase-id') || '').trim();
        if (purchaseId) this.onAction?.('manual:remove-purchase', { purchaseId });
        return;
      }

      if (action === 'retomar:toggle-expand') {
        this.retomarExpanded = !this.retomarExpanded;
        this.retomarMenuOpenListId = null;
        this.renderContent();
        return;
      }

      if (action === 'retomar:toggle-menu') {
        const listId = String(btn.getAttribute('data-list-id') || '').trim();
        if (!listId) return;
        this.retomarMenuOpenListId = this.retomarMenuOpenListId === listId ? null : listId;
        this.renderContent();
        return;
      }

      if (action === 'retomar-tag:create') {
        this.retomarMenuOpenListId = null;
        this.onAction?.('retomar-tag:create');
        return;
      }

      if (action === 'retomar-tag:toggle') {
        const listId = String(btn.getAttribute('data-list-id') || '').trim();
        if (!listId) return;
        this.retomarMenuOpenListId = null;
        this.onAction?.('retomar-tag:toggle', { listId });
        return;
      }

      if (
        action === 'retomar-tag:view-members' ||
        action === 'retomar-tag:rename' ||
        action === 'retomar-tag:delete'
      ) {
        const listId = String(btn.getAttribute('data-list-id') || '').trim();
        if (!listId) return;

        const blockedDefault = btn.getAttribute('data-blocked-default') === 'true';
        if (blockedDefault) {
          alert('Etiqueta padrao nao permite renomear ou excluir.');
          this.retomarMenuOpenListId = null;
          this.renderContent();
          return;
        }

        this.retomarMenuOpenListId = null;
        this.renderContent();
        this.onAction?.(action, { listId });
        return;
      }

      // Ação genérica (desacoplada)
      this.onAction?.(action);
    });

    // Se drawer começar aberto (raramente), garantir wiring
    this.bindNotesListeners();
  }

  private bindRagAutoSuggestListener(): void {
    if (!this.container) return;
    const el = this.container.querySelector('[data-field="rag-auto-suggest"]') as HTMLInputElement | null;
    if (!el) return;
    el.checked = this.ragAutoSuggestEnabled;
    el.title =
      'Quando ligado, gera sugestão ao chegar mensagem nova do cliente (mesmo fluxo RAG que o botão).';
    el.addEventListener('change', () => {
      const checked = el.checked;
      this.ragAutoSuggestEnabled = checked;
      this.onAction?.('rag:auto-suggest:changed', { enabled: checked });
    });
  }

  private bindNotesListeners(): void {
    if (!this.container) return;
    if (!this.notesOpen) return;

    const notes = this.container.querySelector('[data-field="notes"]') as HTMLTextAreaElement | null;
    const status = this.container.querySelector('[data-field="notes-status"]') as HTMLElement | null;
    if (!notes) return;

    notes.addEventListener('input', () => {
      if (status) status.textContent = 'Salvando...';
      if (this.vm && this.vm.kind === 'ready') this.vm.notes.value = notes.value;

      this.onAction?.('notes:changed', { value: notes.value });

      window.setTimeout(() => {
        if (status) status.textContent = 'Salvo';
        window.setTimeout(() => {
          if (status) status.textContent = 'Salvamento automático';
        }, 800);
      }, 250);
    });
  }

  private renderBadge(label: string): string {
    return `
      <span class="${ATD_CHIP}">
        ${this.escapeHtml(label)}
      </span>
    `;
  }

  private renderPhrasePill(label: string, text: string): string {
    return `
      <button
        type="button"
        class="${ATD_BTN_9} w-full text-left"
        data-action="copy-text"
        data-text="${this.escapeAttr(text)}"
        aria-label="${this.escapeAttr(label)}"
      >
        ${this.escapeHtml(label)}
      </button>
    `;
  }

  private renderEmpty(text: string): string {
    return `
      <div class="rounded-lg border border-border/35 bg-secondary/10 p-3 text-center">
        <div class="text-[11px] text-muted-foreground/95">${this.escapeHtml(text)}</div>
      </div>
    `;
  }

  private async copyToClipboard(text: string): Promise<void> {
    const value = String(text || '');
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
      }
    } catch {
      // fallback abaixo
    }

    // Fallback: textarea temporário
    try {
      const el = document.createElement('textarea');
      el.value = value;
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    } catch {
      // Silenciar: copiar é best-effort
    }
  }

  private escapeHtml(input: string): string {
    const div = document.createElement('div');
    div.textContent = String(input ?? '');
    return div.innerHTML;
  }

  private escapeAttr(input: string): string {
    return this.escapeHtml(input).replace(/\"/g, '&quot;');
  }

  /**
   * Aberto → aguardando pagamento → Fechado (estado local; futuro: filtro / backend).
   * `data-status` + `data-order-pipeline-root` para integração.
   */
  private renderOrderStatusPipeline(): string {
    const cur = this.orderPipelineUi;
    const stages: {
      id: 'aberto' | 'pagamento' | 'fechado';
      line1: string;
      line2?: string;
      title: string;
    }[] = [
      { id: 'aberto', line1: 'Aberto', title: 'Pedido em negociação' },
      {
        id: 'pagamento',
        line1: 'Aguardando',
        line2: 'pagamento',
        title: 'Aguardando confirmação de pagamento',
      },
      { id: 'fechado', line1: 'Fechado', title: 'Pedido fechado' },
    ];
    return `
      <div class="mt-2 grid grid-cols-3 gap-1" role="group" aria-label="Status do pedido">
        ${stages
          .map((s) => {
            const active = cur === s.id;
            const base =
              `${ATD_FOCUS} flex min-h-[2.75rem] flex-col items-center justify-center rounded-lg border px-0.5 py-1 text-center transition-colors duration-150`;
            const cls = active
              ? `${base} border-primary bg-primary/10 ring-1 ring-primary/25`
              : `${base} border-border/35 bg-secondary/10 hover:bg-secondary/22`;
            const l2 = s.line2
              ? `<span class="block text-[7px] leading-none text-muted-foreground">${this.escapeHtml(s.line2)}</span>`
              : '';
            return `
          <button type="button" class="${cls}" data-action="order-status:set" data-status="${s.id}" title="${this.escapeAttr(s.title)}">
            <span class="text-[9px] font-semibold leading-tight text-foreground">${this.escapeHtml(s.line1)}</span>
            ${l2}
          </button>`;
          })
          .join('')}
      </div>`;
  }

  private renderOrderRow(o: { id: string; title: string; subtitle: string; status: string }): string {
    return `
      <div class="rounded-lg border border-border/35 bg-background/45 p-2">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-medium text-foreground/95 truncate">${this.escapeHtml(o.title)}</div>
            <div class="mt-0.5 text-[11px] text-muted-foreground/95 truncate">${this.escapeHtml(o.subtitle)}</div>
          </div>
          <span class="${ATD_CHIP} shrink-0">
            ${this.escapeHtml(o.status)}
          </span>
        </div>
      </div>
    `;
  }

  private isDisabled(actionId: string): boolean {
    if (!this.vm || this.vm.kind !== 'ready') return true;
    const found = this.vm.actions.find(a => a.id === actionId);
    return found?.disabled === true;
  }

  private renderPrimaryButton(actionId: string, label: string, disabled: boolean): string {
    const disabledAttrs = disabled ? 'disabled aria-disabled="true"' : '';
    const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';
    return `
      <button
        type="button"
        class="${ATD_BTN_10_PRI} ${disabledClasses}"
        data-action="${this.escapeHtml(actionId)}"
        ${disabledAttrs}
      >
        ${this.escapeHtml(label)}
      </button>
    `;
  }

  private renderSecondaryButton(actionId: string, label: string, disabled: boolean): string {
    const disabledAttrs = disabled ? 'disabled aria-disabled="true"' : '';
    const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';
    return `
      <button
        type="button"
        class="${ATD_BTN_10_SEC} ${disabledClasses}"
        data-action="${this.escapeHtml(actionId)}"
        ${disabledAttrs}
      >
        ${this.escapeHtml(label)}
      </button>
    `;
  }

  private renderMiniProduct(p: { name: string; priceLabel: string; stockLabel?: string; offerText: string }): string {
    return `
      <div class="rounded-lg border border-border/35 bg-background/45 p-2">
        <div class="text-xs font-medium text-foreground/95 truncate">${this.escapeHtml(p.name)}</div>
        <div class="mt-0.5 text-[11px] text-muted-foreground/95 truncate">${this.escapeHtml(p.priceLabel || '—')}</div>
        <button
          type="button"
          class="${ATD_BTN_9} mt-2 w-full"
          data-action="copy-text"
          data-text="${this.escapeAttr(p.offerText)}"
        >
          Enviar
        </button>
      </div>
    `;
  }

  private formatPurchaseDate(iso: string): string {
    try {
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR');
    } catch {
      return iso;
    }
  }

  private formatChunkDateTime(iso: string | undefined | null): string {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '—';
      return d.toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      } as Intl.DateTimeFormatOptions);
    } catch {
      return '—';
    }
  }

  /** Data de hoje em YYYY-MM-DD (para pré-selecionar no form de registro de compra). */
  private getTodayDateString(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private getConfiancaBadgeAtendimento(confianca: CampoConfianca | undefined): string {
    const level: CampoConfianca = confianca || 'desconhecido';
    const badges: Record<string, string> = {
      alta: 'px-1.5 py-0.5 rounded text-[9px] font-medium bg-green-500/20 text-green-400 border border-green-500/30',
      media: 'px-1.5 py-0.5 rounded text-[9px] font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
      baixa: 'px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-500/20 text-red-400 border border-red-500/30',
      desconhecido: 'px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30',
    };
    const className = badges[level] || badges.desconhecido;
    return `<span class="${className}">${level}</span>`;
  }

  private formatArray(value: string[] | null | undefined): string {
    if (!Array.isArray(value) || value.length === 0) return '—';
    return value.join(', ');
  }

  private formatMaybe(value: string | null | undefined): string {
    const v = String(value ?? '').trim();
    return v || '—';
  }

  private renderFunilTimeline(): string {
    if (!this.vm || this.vm.kind !== 'ready') return ''

    const timeline = this.vm.customer.timeline ?? []
    const timelineHtml = timeline.length > 0
      ? `<div class="flex flex-wrap items-center gap-1.5 mb-2">
          ${timeline.map(t => `<span class="inline-flex items-center rounded-md border border-border/25 bg-secondary/20 px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground/90">${this.escapeHtml(t)}</span>`).join('')}
        </div>`
      : ''

    const confianca = this.vm.customer.confiancaPerfil ?? 0
    const confiancaCor = confianca >= 0.6 ? 'bg-green-500' : confianca >= 0.3 ? 'bg-amber-500' : 'bg-red-500'

    const funilHtml = this.vm.funil.etapas.map((etapa, i) => {
      const isOk = etapa.estado === 'ok'
      const isUpdated = this.vm?.kind === 'ready' && this.vm.customer.updatedFields?.some(f => {
        if (etapa.id === 'produto') return f === 'preferenciasProduto'
        if (etapa.id === 'endereco') return f === 'enderecoEntrega'
        if (etapa.id === 'pagamento') return f === 'formaPagamentoPreferida'
        if (etapa.id === 'prazo') return f === 'urgenciaEntrega'
        return false
      })

      const dotClass = isOk
        ? `w-2.5 h-2.5 rounded-full border ${isUpdated ? 'border-green-400 ring-2 ring-green-400/30' : 'border-green-500/60'} bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.3)]`
        : 'w-2.5 h-2.5 rounded-full border border-border/60 bg-transparent'

      const labelClass = isOk
        ? 'text-[10px] font-medium text-green-400'
        : 'text-[10px] font-medium text-muted-foreground/50'

      return `<div class="flex flex-col items-center gap-1 ${isUpdated ? 'animate-pulse' : ''}">
        <div class="${dotClass}"></div>
        <span class="${labelClass} leading-none">${this.escapeHtml(etapa.label)}</span>
      </div>`
    }).join('')

    return `
      <div class="mt-2 pt-2 border-t border-border/20">
        ${timelineHtml}
        <div class="flex items-start justify-between px-1 mb-1.5">
          ${funilHtml}
        </div>
        <div class="h-1.5 bg-secondary/30 rounded-full overflow-hidden">
          <div class="h-full ${confiancaCor} rounded-full transition-all duration-700 ease-out"
               style="width:${this.vm.funil.progresso}%"></div>
        </div>
      </div>
    `
  }

  private renderPedidoUnificado(): string {
    if (!this.vm || this.vm.kind !== 'ready') return ''
    const p = this.vm.pedido
    return `
      <div class="mt-0">
        ${p.itens.length > 0 ? `
        <div class="space-y-1">
          ${p.itens.map(item => `
            <div class="flex items-center justify-between gap-2 text-[12px] py-0.5">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="w-1 h-1 rounded-full bg-primary/60 shrink-0"></span>
                <span class="text-foreground/90 truncate font-medium"><span class="font-mono text-[10px] text-muted-foreground/60">${item.quantidade}&times;</span> ${this.escapeHtml(item.produtoCatalogo?.nome || item.nomeExtraido)}</span>
              </div>
              <span class="text-muted-foreground text-[11px] shrink-0 tabular-nums">${item.precoTotalCentavos > 0 ? `R$ ${(item.precoTotalCentavos / 100).toFixed(2).replace('.', ',')}` : ''}</span>
            </div>
          `).join('')}
        </div>
        ` : ''}

        ${p.totalCentavos > 0 ? `
        <div class="flex items-center justify-between gap-2 text-[14px] py-1.5 border-t border-border/20 mt-1">
          <span class="text-foreground font-semibold">Total</span>
          <span class="text-foreground font-semibold tabular-nums">R$ ${(p.totalCentavos / 100).toFixed(2).replace('.', ',')}</span>
        </div>` : ''}
      </div>
    `
  }

  private renderPendenciasPedido(): string {
    if (!this.vm || this.vm.kind !== 'ready') return ''
    const pendentes = this.vm.pendentesConfirmacao
    if (!pendentes || pendentes.length === 0) return ''
    return `
      <div class="mt-2 pt-2 border-t border-border/20 space-y-2">
        <div class="text-[10px] font-medium text-foreground/70">Ajustes pendentes</div>
        ${pendentes.map(p => {
          const atual = Array.isArray(p.atual) ? p.atual.join(', ') : String(p.atual ?? '')
          const proposto = Array.isArray(p.proposto) ? p.proposto.join(', ') : String(p.proposto)
          return `
          <div class="flex items-start gap-2 py-1.5 px-2 rounded-md bg-primary/10 border border-primary/15">
            <div class="min-w-0 flex-1">
              <div class="text-[10px] text-muted-foreground mb-0.5">
                ${this.escapeHtml(p.produto || p.campo)}:
                <span class="text-muted-foreground/60">${this.escapeHtml(atual)}</span>
                <span class="text-foreground font-medium"> → ${this.escapeHtml(proposto)}</span>
              </div>
              ${p.evidencias.length > 0 ? `<div class="text-[9px] text-muted-foreground/50 italic">${this.escapeHtml(p.evidencias[0])}</div>` : ''}
            </div>
            <button type="button"
              class="h-6 px-2.5 rounded-md text-[10px] font-medium bg-primary/80 text-primary-foreground hover:bg-primary transition-colors shrink-0 mt-px"
              data-action="order:confirm-pendency"
              data-campo="${this.escapeAttr(p.campo)}"
            >Confirmar</button>
          </div>
        `}).join('')}
      </div>
    `
  }

  private renderDetalhesPedido(): string {
    if (!this.vm || this.vm.kind !== 'ready') return ''
    const c = this.vm.customer
    const p = this.vm.pedidoAtual
    const endereco = c.enderecoEntrega || p?.funil.endereco.valor || ''
    const pagamento = p?.pagamentoMetodo || (c.formaPagamentoPreferida?.length ? c.formaPagamentoPreferida.join(', ') : '') || p?.funil.pagamento.valor || ''
    const prazo = c.urgenciaEntrega || p?.funil.prazo.valor || ''
    const obs = p?.observacoes || (c.observacoesLogisticas?.length ? c.observacoesLogisticas.join('; ') : '') || ''
    const rows = [
      { label: 'Entrega', value: endereco },
      { label: 'Pagamento', value: pagamento },
      { label: 'Prazo', value: prazo },
      { label: 'Obs', value: obs },
    ]
    const hasAny = rows.some(r => r.value)
    if (!hasAny) return ''
    return `
      <div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-md border border-border/20 bg-background/30 p-2">
        ${rows.map(r => `
          <div>
            <div class="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">${r.label}</div>
            <div class="text-[10px] text-foreground/80 mt-px truncate">${r.value ? this.escapeHtml(r.value) : '<span class="text-muted-foreground/40 italic">—</span>'}</div>
          </div>
        `).join('')}
      </div>
    `
  }

  private renderSugestaoAmbiguidade(): string {
    if (!this.vm || this.vm.kind !== 'ready') return ''
    const sug = this.vm.sugestaoAmbiguidade
    if (!sug) return ''

    const metodoLabel: Record<string, string> = {
      reply: 'Inferido por reply',
      ultimo_produto: 'Inferido do contexto',
      llm: 'Inferido por IA ??? pode estar errado',
    }
    const confiancaBorda = sug.confianca === 'alta' ? 'border-green-500/40'
      : sug.confianca === 'media' ? 'border-amber-500/40'
      : 'border-orange-500/40'
    const confiancaFundo = sug.confianca === 'alta' ? 'bg-green-500/[0.04]'
      : sug.confianca === 'media' ? 'bg-amber-500/[0.04]'
      : 'bg-orange-500/[0.06]'

    return `
      <div class="mt-2 rounded-lg border ${confiancaBorda} ${confiancaFundo} p-2">
        <div class="flex items-center gap-2 mb-1.5">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-amber-500/80">Sugest??o autom??tica</span>
          <span class="h-px flex-1 bg-border/20"></span>
        </div>
        <div class="text-[10px] text-muted-foreground mb-1.5">${this.escapeHtml(sug.fraseContexto)}</div>
        <div class="flex items-center justify-between gap-2 py-1 border-b border-border/10">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-[12px] font-medium text-foreground/85">??? ${this.escapeHtml(sug.nomeExtraido)}</span>
          </div>
          <span class="text-[9px] text-muted-foreground/60 shrink-0 italic">${metodoLabel[sug.metodo]}</span>
        </div>
        <div class="flex gap-1.5 mt-2">
          <button type="button"
            class="h-6 px-2.5 rounded text-[10px] font-medium bg-green-600/20 text-green-500 border border-green-500/30 transition-colors hover:bg-green-600/30"
            data-action="ambiguidade:confirmar"
          >Confirmar</button>
          <button type="button"
            class="h-6 px-2.5 rounded text-[10px] font-medium bg-red-600/10 text-red-400 border border-red-500/30 transition-colors hover:bg-red-600/20"
            data-action="ambiguidade:recusar"
          >Recusar</button>
        </div>
      </div>
    `
  }

  private renderOuvinteDebug(): string {
    if (!this.vm || this.vm.kind !== 'ready') return ''
    const debug = this.vm.ouvinteDebug

    // Se não tem nada novo, não mostra (bloco terciário — colapsável vai sumir)
    if (!debug) return ''
    const temAlgoNovo = debug.ultimaMensagemProcessada ||
      (debug.camposExtraidos && debug.camposExtraidos.length > 0) ||
      debug.estadoPercebido ||
      debug.contextoEnviadoCount !== undefined

    if (!temAlgoNovo) return ''

    // Estado percebido
    const estadoHtml = debug.estadoPercebido
      ? (() => {
          const faseLabel: Record<string, string> = {
            lead: 'Lead', draft: 'Draft', open: 'Aberto', completed: 'Completo',
            pos_venda: 'Pós-venda', indeterminado: '?',
          }
          const confiancaIcon: Record<string, string> = { alta: '🟢', media: '🟡', baixa: '🔴' }
          const fase = faseLabel[debug.estadoPercebido.fase] || debug.estadoPercebido.fase
          const icon = confiancaIcon[debug.estadoPercebido.confiancaEstado] || '⚪'
          return `<div class="text-[10px] text-muted-foreground">Confiança do estado: ${icon} ${debug.estadoPercebido.confiancaEstado} · Fase detectada: ${fase}</div>`
        })()
      : ''

    const contextoHtml = debug.contextoEnviadoCount !== undefined
      ? `<div class="text-[10px] text-muted-foreground">Histórico enviado: ${debug.contextoEnviadoCount} mensagens</div>`
      : ''

    const ultMsg = debug.ultimaMensagemProcessada

    return `
      <div class="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/[0.03] p-2"
           style="cursor:pointer"
           data-action="ouvinte:toggle">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-blue-500/80">🧠 Debug Ouvinte</span>
          <span class="h-px flex-1 bg-border/20"></span>
        </div>
        ${ultMsg ? `<div class="text-[11px] text-muted-foreground mb-1">Última msg: <span class="text-blue-400 font-mono">${this.escapeHtml(ultMsg.substring(0, 50))}${ultMsg.length > 50 ? '...' : ''}</span></div>` : ''}
        ${contextoHtml}
        ${estadoHtml}
        ${debug.camposExtraidos && debug.camposExtraidos.length > 0 ? `<div class="text-[10px] text-muted-foreground mt-1">Campos extraídos: ${debug.camposExtraidos.map(c => `${c.campo}=${c.valor.substring(0, 20)}`).join(', ')}</div>` : ''}
        ${debug.sugestaoPendente ? `<div class="text-[10px] text-amber-400 mt-1">📌 Sugestão pendente: ${debug.sugestaoPendente.nomeExtraido}</div>` : ''}
      </div>
    `
  }

  private renderVitrineInline(): string {
    if (!this.vm || this.vm.kind !== 'ready') return ''
    const items = this.vm.vitrine
    if (items.length === 0) return ''

    return `
      <div class="mt-2 rounded-lg border border-border/25 bg-background/30 p-2">
        <div class="flex items-center gap-2 mb-1.5">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Ofertas de hoje</span>
          <span class="h-px flex-1 bg-border/20"></span>
        </div>
        ${items.map(item => `
          <div class="flex items-center justify-between gap-2 py-1 border-b border-border/10 last:border-0">
            <div class="flex-1 min-w-0">
              <span class="text-[11px] text-foreground/85 truncate">${this.escapeHtml(item.nome)}</span>
              <span class="text-[10px] text-muted-foreground ml-1.5 tabular-nums">R$ ${(item.precoCentavos / 100).toFixed(2).replace('.', ',')}</span>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <span class="text-[10px] text-muted-foreground/60 tabular-nums">${item.score.toFixed(1)}</span>
              <button type="button"
                class="h-6 px-2 rounded text-[10px] font-medium border border-primary/30 text-primary/90 transition-colors hover:bg-primary/10 hover:border-primary/50"
                data-action="vitrine:add"
                data-product-id="${this.escapeAttr(item.productId)}"
              >+ add</button>
            </div>
          </div>
        `).join('')}
      </div>
    `
  }

  private renderProximaAcao(): string {
    if (!this.vm || this.vm.kind !== 'ready') return ''
    const acao = this.vm.proximaAcao
    if (!acao) return ''

    return `
      <div class="mt-2 rounded-lg border border-primary/25 bg-primary/[0.04] p-2">
        <div class="flex items-center gap-2 mb-2">
          <div class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-primary/70"></span>
            <span class="text-[9px] font-semibold uppercase tracking-wider text-primary/70">Próxima ação</span>
          </div>
          <span class="text-[10px] font-medium text-foreground/90">${this.escapeHtml(acao.label)}</span>
        </div>
        <textarea
          data-field="sugestao-unificada"
          rows="3"
          class="w-full rounded-md border border-border/35 bg-background/80 px-2 py-1.5 text-[11px] leading-relaxed text-foreground/90 resize-none min-h-[3.5rem] placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40"
          placeholder="${this.escapeAttr(acao.sugestaoTexto)}"
        >${this.escapeHtml(this.vm.sugestaoTexto)}</textarea>
        <div class="flex gap-1.5 mt-1.5">
          <button type="button" class="h-7 px-2.5 rounded-md border border-border/35 bg-secondary/15 text-[10px] font-medium text-foreground/80 transition-colors hover:bg-secondary/25 hover:border-border/50" data-action="sugestao:generate">Gerar</button>
          <button type="button" class="h-7 px-2.5 rounded-md bg-primary/90 text-[10px] font-semibold text-primary-foreground transition-colors hover:bg-primary" data-action="sugestao:send">Enviar</button>
        </div>
      </div>
    `
  }

  private renderOuvinteFieldsCompact(customer: Extract<AtendimentoViewModel, { kind: 'ready' }>['customer']): string {
    const camposConfianca = customer.camposConfianca;
    const updatedFields = customer.updatedFields ?? [];
    const confianca = customer.confiancaPerfil ?? 0;
    const confiancaCor = confianca >= 0.6 ? 'rgb(34,197,94)' : confianca >= 0.3 ? 'rgb(234,179,8)' : 'rgb(239,68,68)';
    const pendentes = this.vm?.kind === 'ready' ? this.vm.pendentesConfirmacao : [];

    const fieldRows = [
      { key: 'preferenciasProduto', label: 'Preferências', value: this.formatArray(customer.preferenciasProduto), confianca: camposConfianca?.preferenciasProduto },
      { key: 'aversoesProduto', label: 'Aversões', value: this.formatArray(customer.aversoesProduto), confianca: camposConfianca?.aversoesProduto },
      { key: 'enderecoEntrega', label: 'Endereço', value: this.formatMaybe(customer.enderecoEntrega), confianca: camposConfianca?.enderecoEntrega },
      { key: 'formaPagamentoPreferida', label: 'Forma pgto', value: this.formatArray(customer.formaPagamentoPreferida), confianca: camposConfianca?.formaPagamentoPreferida },
      { key: 'urgenciaEntrega', label: 'Urgência', value: this.formatMaybe(customer.urgenciaEntrega), confianca: camposConfianca?.urgenciaEntrega },
      { key: 'observacoesLogisticas', label: 'Observações', value: this.formatArray(customer.observacoesLogisticas), confianca: camposConfianca?.observacoesLogisticas },
    ];

    const rowsHtml = fieldRows.map(row => {
      const isUpdated = updatedFields.includes(row.key);
      const isPending = row.confianca === 'baixa' && row.value && row.value !== '—';
      const temPendencia = pendentes.some(p => p.campo === row.key);

      return `
        <div class="flex items-start justify-between gap-2 text-[10px] py-0.5 ${isUpdated ? 'campo-atualizado' : ''} ${temPendencia ? 'campo-pendente' : ''}">
          <span class="text-muted-foreground shrink-0">${this.escapeHtml(row.label)}</span>
          <div class="flex items-center gap-1.5">
            ${isUpdated && row.value && row.value !== '—' ? '<span class="text-[9px] text-green-400 font-medium" style="animation:fadeOutBadge 4s ease-out">✨novo</span>' : ''}
            ${temPendencia ? '<span class="text-[9px] font-medium text-primary/80">◉ confirmar</span>' : isPending ? '<span class="text-[9px] text-muted-foreground/60 font-medium">◉ pendente</span>' : ''}
            <span class="text-foreground text-right">${this.escapeHtml(row.value)}</span>
            ${this.getConfiancaBadgeAtendimento(row.confianca)}
          </div>
        </div>
      `;
    }).join('');

    // Detalhes das pendências
    const pendentesHtml = pendentes.length > 0 ? `
      <div class="mt-1.5 pt-1.5 border-t border-border/20 space-y-1.5">
        ${pendentes.map(p => {
          const atual = Array.isArray(p.atual) ? p.atual.join(', ') : String(p.atual ?? '')
          const proposto = Array.isArray(p.proposto) ? p.proposto.join(', ') : String(p.proposto)
          return `
          <div class="flex items-start gap-2 py-1 px-2 rounded-md bg-primary/10 border border-primary/15">
            <div class="min-w-0 flex-1">
              <div class="text-[10px]">
                <span class="text-muted-foreground">${this.escapeHtml(p.produto ?? p.campo)}:</span>
                <span class="text-muted-foreground/60"> ${this.escapeHtml(atual)}</span>
                <span class="text-foreground font-medium"> → ${this.escapeHtml(proposto)}</span>
              </div>
            </div>
            <button type="button"
              class="h-5 px-2 rounded text-[9px] font-medium bg-primary/80 text-primary-foreground hover:bg-primary transition-colors shrink-0 mt-px"
              data-action="order:confirm-pendency"
              data-campo="${this.escapeAttr(p.campo)}"
            >Confirmar</button>
          </div>
        `}).join('')}
      </div>
    ` : '';

    return `
      <style>
        @keyframes flash-update {
          0%   { background: rgba(34,197,94,0.25); transform: scale(1.02); border-radius: 4px; }
          50%  { background: rgba(34,197,94,0.12); }
          100% { background: transparent; transform: scale(1); }
        }
        @keyframes fadeOutBadge {
          0% { opacity: 1; }
          70% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .campo-atualizado { animation: flash-update 1.5s ease-out; }
        .campo-pendente { border-left: 2px solid rgba(251,191,36,0.5); padding-left: 4px; }
      </style>
      <div class="mt-2 rounded-lg border border-border/35 bg-background/45 p-2 space-y-0.5">
        <div class="flex items-center justify-between gap-2 mb-1">
          <div class="flex items-center gap-1.5">
            <span class="inline-block w-1.5 h-1.5 rounded-full bg-green-400" style="animation:pulse 2s ease-in-out infinite"></span>
            <span class="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/90">Perfil Ouvinte</span>
            ${pendentes.length > 0 ? `<span class="text-[9px] text-amber-400 font-semibold">(${pendentes.length} 🔶)</span>` : ''}
          </div>
          <div class="flex items-center gap-1.5">
            <div class="h-1 w-16 bg-gray-700/50 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-600" style="width:${(confianca * 100).toFixed(0)}%;background:${confiancaCor}"></div>
            </div>
            <span class="text-[9px] text-muted-foreground">${(confianca * 100).toFixed(0)}%</span>
          </div>
        </div>
        ${rowsHtml}
        ${pendentesHtml}
      </div>
    `;
  }

  /**
   * Bloco de resposta sugerida pelo ouvinte-llm (DeepSeek).
   * Aparece quando o LLM detecta compra_nova e gera uma confirmação rápida.
   * Botão "Enviar" envia a mensagem no WhatsApp.
   */
  private renderRespostaSugeridaBlock(): string {
    if (!this.vm || this.vm.kind !== 'ready') return '';

    // Se está processando mas ainda não tem resposta, mostra skeleton
    if (this.processandoOuvinte && !this.vm.respostaSugerida) {
      return `
        <div class="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div class="flex items-center gap-1.5 mb-2">
            <span class="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Confirmação rápida</span>
            <span class="ml-auto text-[9px] text-muted-foreground/70">via DeepSeek</span>
          </div>
          <div class="animate-pulse space-y-2">
            <div class="h-3 bg-emerald-500/10 rounded w-3/4"></div>
            <div class="h-3 bg-emerald-500/10 rounded w-1/2"></div>
          </div>
          <div class="flex gap-2 mt-2.5">
            <div class="flex-1 h-7 bg-emerald-500/10 rounded-lg animate-pulse"></div>
            <div class="flex-1 h-7 bg-background/40 rounded-lg animate-pulse"></div>
          </div>
        </div>
      `;
    }

    // Se não tem resposta e não está processando, não mostra nada
    if (!this.vm.respostaSugerida) return '';

    const texto = this.escapeHtml(this.vm.respostaSugerida)

    return `
      <div class="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
        <div class="flex items-center gap-1.5 mb-2">
          <span class="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Confirmação rápida</span>
          <span class="ml-auto text-[9px] text-muted-foreground/70">via DeepSeek</span>
        </div>
        <div class="text-[12px] leading-relaxed text-foreground/90 mb-2.5 bg-background/40 rounded-md px-2.5 py-2 border border-border/20">
          ${texto}
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors duration-150"
            data-action="resposta:enviar"
            data-text="${this.escapeAttr(this.vm.respostaSugerida)}"
          >
            Enviar
          </button>
          <button
            type="button"
            class="flex-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-background/60 hover:bg-background/90 text-foreground/80 border border-border/30 transition-colors duration-150"
            data-action="resposta:recusar"
          >
            Recusar
          </button>
        </div>
      </div>
    `;
  }

  private renderRagSuggestionBlock(): string {
    if (!this.vm || this.vm.kind !== 'ready') return '';

    const headerTitle = 'Resposta sugerida';
    const placeholder =
      'Use \'Gerar sugestão\' ou ligue o modo automático para usar conversas passadas como base.';
    const autoChecked = this.ragAutoSuggestEnabled ? 'checked' : '';
    const textareaValue = this.escapeHtml(this.ragSuggestionText);
    const textareaDisabled = this.ragLoading ? 'disabled' : '';
    const textareaPlaceholder = this.escapeAttr(placeholder);
    const loadingMessage = 'Buscando conversas similares e gerando sugestão...';
    const similarLine =
      this.ragSimilarCount != null
        ? `<div class="mt-1.5 text-[11px] text-muted-foreground">Baseado em ${this.ragSimilarCount} conversas similares</div>`
        : '';
    const generateDisabled = this.ragLoading ? 'disabled aria-disabled="true"' : '';
    const generateClasses = this.ragLoading ? 'opacity-50 cursor-not-allowed' : '';
    const sendDisabled = this.ragLoading || !this.ragSuggestionText.trim() ? 'disabled aria-disabled="true"' : '';
    const sendClasses = this.ragLoading || !this.ragSuggestionText.trim() ? 'opacity-50 cursor-not-allowed' : '';

    const debugToggleButton = `
      <button
        type="button"
        class="${ATD_FOCUS} mt-2 text-[11px] text-muted-foreground/95 underline-offset-2 transition-colors duration-150 hover:text-foreground hover:underline"
        data-action="rag:toggle-debug"
      >
        ${this.ragDebugOpen ? 'Ocultar detalhes técnicos do RAG' : 'Ver detalhes técnicos do RAG'}
      </button>
    `;

    const debugPanel = this.ragDebugOpen ? this.renderRagDebugPanel() : '';

    const textareaContent = this.ragLoading
      ? `
        <div class="rounded-lg border border-border/35 bg-background/45 p-3 text-[11px] text-muted-foreground/95 flex items-center gap-2">
          <span class="inline-block w-4 h-4 border-2 border-muted-foreground/80 border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>
          ${this.escapeHtml(loadingMessage)}
        </div>`
      : `
        <textarea
          data-field="rag-suggestion"
          rows="4"
          class="w-full ${ATD_INPUT} resize-none min-h-[5rem]"
          placeholder="${textareaPlaceholder}"
          ${textareaDisabled}
        >${textareaValue}</textarea>`;

    return `
      <div class="${ATD_SECTION} p-3">
        <div class="flex items-center justify-between gap-2">
          <button type="button" data-action="rag:toggle-expand" class="group ${ATD_SECTION_TOGGLE} flex-1 min-w-0 pr-1">
            <span>${this.escapeHtml(headerTitle)}</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="transition-transform duration-200 shrink-0 ml-auto text-muted-foreground group-hover:text-foreground ${this.ragBlockExpanded ? 'rotate-180' : ''}">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button
            type="button"
            class="${ATD_ICON_BTN} flex items-center justify-center shrink-0"
            title="Usa conversas passadas como base"
            aria-label="Usa conversas passadas como base"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4M12 8h.01"/>
            </svg>
          </button>
        </div>
        ${this.ragBlockExpanded ? `
        <div class="mt-2">
          <label class="mt-1 mb-2 flex items-center gap-2 text-[11px] text-foreground/95 cursor-pointer select-none">
            <input
              type="checkbox"
              data-field="rag-auto-suggest"
              class="rounded border-border/45 text-primary focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1 focus-visible:ring-offset-background"
              ${autoChecked}
            />
            <span>Gerar sugestão automático</span>
          </label>
          ${textareaContent}
          ${similarLine}
          <div class="mt-2 flex flex-wrap gap-2">
            <button type="button" class="${ATD_BTN_8} ${generateClasses}" data-action="rag:generate" ${generateDisabled}>
              Gerar sugestão
            </button>
            <button type="button" class="${ATD_BTN_8} ${sendClasses}" data-action="rag:send" ${sendDisabled}>
              Enviar para WhatsApp
            </button>
          </div>
          ${debugToggleButton}
          ${debugPanel}
        </div>
        ` : ''}
      </div>
    `;
  }

  private renderRagDebugPanel(): string {
    const info = this.ragDebugInfo;
    if (!info) {
      return `
        <div class="mt-3 border-t border-border/20 pt-3">
          <div class="text-[11px] font-semibold text-foreground">Detalhes técnicos do RAG</div>
          <div class="mt-1 text-[11px] text-muted-foreground">
            Nenhuma consulta RAG foi gerada ainda neste atendimento.
          </div>
        </div>
      `;
    }

    const steps: string[] = [];
    const embedLabel =
      info.timingsMs.embed > 0
        ? `Embedding da conversa atual (${info.timingsMs.embed} ms)`
        : 'Embedding da conversa atual';
    const searchLabel =
      info.timingsMs.search > 0
        ? `Busca no índice vetorial (top ${info.similarResults.length || 0}, ${info.timingsMs.search} ms)`
        : `Busca no índice vetorial (top ${info.similarResults.length || 0})`;
    const promptLabel =
      info.timingsMs.prompt > 0
        ? `Prompt + modelo (${info.timingsMs.prompt} ms)`
        : 'Prompt + modelo';

    steps.push(embedLabel, searchLabel, promptLabel);

    const stepsHtml = steps
      .map(
        (step) => `
      <li class="text-[11px] text-muted-foreground flex items-start gap-1.5">
        <span class="mt-[2px] inline-block w-1.5 h-1.5 rounded-full bg-emerald-500/80"></span>
        <span>${this.escapeHtml(step)}</span>
      </li>`,
      )
      .join('');

    const topResults = info.similarResults.slice(0, 5);

    const chunksHtml = topResults
      .map((result, idx) => {
        const rank = idx + 1;
        const chunk = result.chunk;
        const scoreLabel =
          typeof result.score === 'number' && Number.isFinite(result.score)
            ? result.score.toFixed(2)
            : String(result.score);
        const dateLabel = this.formatChunkDateTime(chunk.timestamp);
        const headerParts = [`[#${rank}] ${chunk.chatId}`, `score=${scoreLabel} (cosine)`];
        if (dateLabel !== '—') {
          headerParts.push(dateLabel);
        }
        const header = headerParts.join(' • ');
        const isExpanded = rank <= 3;
        const body = isExpanded
          ? `<pre class="mt-1 rounded-lg border border-border/30 bg-background/60 p-2 text-[11px] text-muted-foreground whitespace-pre-wrap max-h-24 overflow-auto">${this.escapeHtml(
              chunk.content,
            )}</pre>`
          : `<div class="mt-1 text-[11px] text-muted-foreground italic">Resultado compacto (top ${rank}).</div>`;

        return `
      <div class="rounded-lg border border-border/30 bg-background/40 p-2">
        <div class="text-[11px] font-medium text-foreground truncate">${this.escapeHtml(header)}</div>
        ${body}
      </div>`;
      })
      .join('');

    const experimentSummary = this.renderRagExperimentSummary();

    return `
      <div class="mt-3 border-t border-border/20 pt-3 space-y-3">
        <div class="text-[11px] font-semibold text-foreground">Detalhes técnicos do RAG</div>

        <div class="space-y-1">
          <div class="text-[11px] font-medium text-foreground">Arquivo de prompt</div>
          <button
            type="button"
            class="${ATD_FOCUS} text-[11px] font-medium text-primary/90 underline-offset-2 transition-colors duration-150 hover:text-primary hover:underline"
            title="Abrir arquivo de prompt no editor"
          >
            Abrir src/modules/rag/prompt_gpt.ts
          </button>
        </div>

        <div class="space-y-1">
          <div class="text-[11px] font-medium text-foreground">Fluxo da chamada</div>
          <ul class="space-y-0.5">
            ${stepsHtml}
          </ul>
        </div>

        <div class="space-y-1">
          <div class="text-[11px] font-medium text-foreground">Texto da consulta (conversationText)</div>
          <pre class="rounded-lg border border-border/30 bg-background/60 p-2 text-[11px] text-muted-foreground whitespace-pre-wrap max-h-24 overflow-auto">
${this.escapeHtml(info.conversationText)}
          </pre>
        </div>

        <div class="space-y-1">
          <div class="text-[11px] font-medium text-foreground">Conversas similares (top 5)</div>
          <div class="space-y-1.5">
            ${chunksHtml}
          </div>
        </div>

        <div class="space-y-1">
          <div class="text-[11px] font-medium text-foreground">Prompt enviado para o modelo</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <div class="text-[10px] font-semibold text-muted-foreground mb-0.5">System prompt</div>
              <pre class="rounded-lg border border-border/30 bg-background/60 p-2 text-[11px] text-muted-foreground whitespace-pre-wrap max-h-32 overflow-auto">
${this.escapeHtml(info.promptSystem)}
              </pre>
            </div>
            <div>
              <div class="text-[10px] font-semibold text-muted-foreground mb-0.5">User prompt</div>
              <pre class="rounded-lg border border-border/30 bg-background/60 p-2 text-[11px] text-muted-foreground whitespace-pre-wrap max-h-32 overflow-auto">
${this.escapeHtml(info.promptUser)}
              </pre>
            </div>
          </div>
        </div>

        <div class="space-y-1">
          <div class="text-[11px] font-medium text-foreground">Resposta do modelo</div>
          <pre class="rounded-lg border border-border/30 bg-background/60 p-2 text-[11px] text-muted-foreground whitespace-pre-wrap max-h-24 overflow-auto">
${this.escapeHtml(info.suggestionOriginal)}
          </pre>
        </div>

        ${info.evaluation ? `
        <div class="space-y-1">
          <div class="text-[11px] font-medium text-foreground">Avaliação da sugestão</div>
          <div class="text-[11px] text-muted-foreground">
            Relevância: ${info.evaluation.scoreRelevance.toFixed(2).replace('.', ',')}
            · Fidelidade: ${info.evaluation.scoreFaithfulness.toFixed(2).replace('.', ',')}
            · Estilo: ${info.evaluation.scoreStyle.toFixed(2).replace('.', ',')}
          </div>
        </div>
        ` : ''}

        ${info.baselineNoRag ? `
        <div class="space-y-1">
          <div class="text-[11px] font-medium text-foreground">Resposta sem RAG (baseline)</div>
          <pre class="rounded-lg border border-border/30 bg-background/60 p-2 text-[11px] text-muted-foreground whitespace-pre-wrap max-h-24 overflow-auto">${this.escapeHtml(info.baselineNoRag.suggestion)}</pre>
          <div class="text-[11px] text-muted-foreground">
            Relevância: ${info.baselineNoRag.evaluation.scoreRelevance.toFixed(2).replace('.', ',')}
            · Fidelidade: ${info.baselineNoRag.evaluation.scoreFaithfulness.toFixed(2).replace('.', ',')}
            · Estilo: ${info.baselineNoRag.evaluation.scoreStyle.toFixed(2).replace('.', ',')}
          </div>
        </div>
        ` : ''}

        ${experimentSummary}
      </div>
    `;
  }

  /** Sincroniza bloco RAG com o estado global do `rag-mettri-controller` antes do `render`. */
  public setRagConsultationFieldsFromController(p: {
    suggestionText: string;
    loading: boolean;
    similarCount: number | null;
    debugInfo: RagConsultaDebugInfo | null;
  }): void {
    this.ragSuggestionText = p.suggestionText;
    this.ragLoading = p.loading;
    this.ragSimilarCount = p.similarCount;
    this.ragDebugInfo = p.debugInfo;
  }

  public setRagExperimentStatsBundle(
    week: RagExperimentStats | null,
    today: RagExperimentStats | null,
    total: RagExperimentStats | null,
  ): void {
    this.ragExperimentStatsWeek = week;
    this.ragExperimentStatsToday = today;
    this.ragExperimentStatsTotal = total;
  }

  private renderRagExperimentSummary(): string {
    const stats = this.ragExperimentStatsWeek;
    const todayN = this.ragExperimentStatsToday?.totalEvents;
    const totalN = this.ragExperimentStatsTotal?.totalEvents;

    const countsLine =
      todayN != null || totalN != null
        ? `<div class="text-[11px] text-muted-foreground">Mensagens avaliadas (hoje): ${todayN ?? 0} · Total no experimento: ${totalN ?? 0}</div>`
        : '';

    if (!stats) {
      return `
        <div class="space-y-1">
          <div class="text-[11px] font-medium text-foreground">Dados do experimento (amostra)</div>
          ${countsLine}
          <div class="text-[11px] text-muted-foreground">
            Ainda não há dados suficientes do experimento RAG vs baseline para este período.
          </div>
          <button
            type="button"
            class="${ATD_BTN_8} mt-2"
            data-action="rag:export-experiment"
          >
            Exportar JSON do experimento (completo)
          </button>
        </div>
      `;
    }

    const totalLabel = stats.totalEvents === 1 ? '1 mensagem avaliada' : `${stats.totalEvents} mensagens avaliadas`;

    const formatPct = (value: number): string =>
      `${value.toFixed(0).replace('.', ',')}%`;

    const ragBetter = formatPct(stats.ragBetterPct);
    const baselineBetter = formatPct(stats.baselineBetterPct);
    const tie = formatPct(stats.tiePct);

    const fmt = (v: number): string => v.toFixed(2).replace('.', ',');

    const avgRag = `RAG — Relevância ${fmt(stats.averages.rag.relevance)}, Fidelidade ${fmt(
      stats.averages.rag.faithfulness,
    )}, Estilo ${fmt(stats.averages.rag.style)}`;
    const avgBase = `Baseline — Relevância ${fmt(stats.averages.baseline.relevance)}, Fidelidade ${fmt(
      stats.averages.baseline.faithfulness,
    )}, Estilo ${fmt(stats.averages.baseline.style)}`;

    return `
      <div class="space-y-1">
        <div class="text-[11px] font-medium text-foreground">Dados do experimento (amostra)</div>
        ${countsLine}
        <div class="text-[11px] text-muted-foreground">
          ${this.escapeHtml(totalLabel)} (últimos 7 dias) — RAG melhor em ${this.escapeHtml(ragBetter)}, empate em ${this.escapeHtml(
            tie,
          )}, baseline melhor em ${this.escapeHtml(baselineBetter)}.
        </div>
        <div class="text-[11px] text-muted-foreground">
          ${this.escapeHtml(avgRag)}
        </div>
        <div class="text-[11px] text-muted-foreground">
          ${this.escapeHtml(avgBase)}
        </div>
        <button
          type="button"
          class="${ATD_BTN_8} mt-2"
          data-action="rag:export-experiment"
        >
          Exportar JSON do experimento (completo)
        </button>
        <div class="text-[10px] text-muted-foreground/90">
          Inclui todos os eventos da janela, scores, textos e blocos de 100 para série temporal. Arquivo pode ficar grande.
        </div>
      </div>
    `;
  }

  /** Ícones minúsculos (viewBox 24) para o pipeline. */
  private comercialPipelineSvgIcon(inner: string): string {
    return `<svg class="h-2 w-2 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  }

  /** Linha + ícones bem pequenos: verde = ok (✓), vermelho = falta (ícone da etapa); anel na 1ª falta. */
  private renderComercialPipelineCompact(c: ComercialPanelVm): string {
    const faltNorm = new Set(c.faltantes.map((f) => normalizeComercialStageKey(f)));
    const firstMissing = METTRI_PIPELINE_STAGES.find((s) =>
      faltNorm.has(normalizeComercialStageKey(s.id)),
    );
    const total = METTRI_PIPELINE_STAGES.length;
    const done = METTRI_PIPELINE_STAGES.filter((s) => !faltNorm.has(normalizeComercialStageKey(s.id))).length;

    const segments: string[] = [];
    for (let i = 0; i < METTRI_PIPELINE_STAGES.length; i++) {
      const stage = METTRI_PIPELINE_STAGES[i];
      const missing = faltNorm.has(normalizeComercialStageKey(stage.id));
      const isCurrent = firstMissing?.id === stage.id;
      const title = this.escapeAttr(stage.label);
      const innerSvg = missing ? stage.pendingSvg : COMERCIAL_PIPELINE_CHECK_SVG;
      const circleClass = missing
        ? `border border-destructive/35 bg-destructive/10 text-destructive ${
            isCurrent ? 'ring-2 ring-destructive/40 ring-offset-1 ring-offset-background' : ''
          }`
        : 'border border-primary/30 bg-primary/12 text-primary';
      const iconHtml = this.comercialPipelineSvgIcon(innerSvg);
      segments.push(`
        <div class="flex shrink-0 items-center justify-center" title="${title}">
          <div class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${circleClass}">${iconHtml}</div>
        </div>`);
      if (i < METTRI_PIPELINE_STAGES.length - 1) {
        segments.push(
          `<div class="flex h-4 min-w-[2px] flex-1 items-center self-center"><div class="h-px w-full bg-border/50"></div></div>`,
        );
      }
    }

    return `
      <div class="rounded-md border border-border/35 bg-background/50 px-1.5 py-1">
        <div class="flex items-center justify-between gap-2 mb-1">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Etapas</span>
          <span class="text-[10px] tabular-nums text-muted-foreground/60">${done}/${total}</span>
        </div>
        <div class="mettri-comercial-pipeline-scroll overflow-x-auto min-w-0">
          <div class="flex min-w-[200px] w-full items-center">${segments.join('')}</div>
        </div>
      </div>`;
  }

  /** Uma coluna compacta: linhas "Chave: valor" + bolinha verde/vermelha. */
  private renderComercialSlotsGridFromLines(lines: string[]): string {
    if (lines.length === 0) {
      return `<div class="text-[10px] text-muted-foreground">Sem dados para este chat.</div>`;
    }

    const cells = lines.map((line) => {
      const parsed = parseComercialSlotLine(line);
      if (parsed) {
        const isEmpty = isComercialValueEmpty(parsed.value);
        const valueClass = isEmpty ? 'text-muted-foreground italic' : 'text-foreground';
        const dotClass = isEmpty ? 'bg-destructive' : 'bg-primary';
        return `<div class="flex min-w-0 gap-1.5 rounded border border-border/20 bg-background/30 px-1.5 py-1">
          <span class="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}" aria-hidden="true"></span>
          <div class="min-w-0 flex-1 leading-tight">
            <div class="text-[8px] font-medium uppercase tracking-wide text-muted-foreground">${this.escapeHtml(parsed.label)}</div>
            <div class="mt-px text-[10px] leading-snug ${valueClass}">${this.escapeHtml(parsed.value)}</div>
          </div>
        </div>`;
      }
      return `<div class="min-w-0 rounded border border-border/15 bg-background/20 px-1.5 py-1 text-[10px] leading-snug text-foreground/90">${this.escapeHtml(line)}</div>`;
    });

    return `<div class="grid grid-cols-1 gap-1">${cells.join('')}</div>`;
  }

  /** Placeholder: uma coluna, traço + bolinha vermelha. */
  private renderComercialResumoPlaceholderGrid(): string {
    const cells = COMERCIAL_RESUMO_CAMPOS.map(
      (label) => `<div class="flex min-w-0 gap-1.5 rounded border border-border/20 bg-background/30 px-1.5 py-1">
        <span class="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" aria-hidden="true"></span>
        <div class="min-w-0 flex-1 leading-tight">
          <div class="text-[8px] font-medium uppercase tracking-wide text-muted-foreground">${this.escapeHtml(label)}</div>
          <div class="mt-px text-[10px] text-muted-foreground italic">—</div>
        </div>
      </div>`,
    );
    return `<div class="grid grid-cols-1 gap-1">${cells.join('')}</div>`;
  }

  /** Resumo: pipeline no topo + lista em coluna única com sinais por campo. */
  private renderComercialResumoBlock(
    c: Extract<AtendimentoViewModel, { kind: 'ready' }>['comercial'],
    modoPillClass: string,
    modoLabel: string,
    fechadoBadge: string,
  ): string {
    const lines = splitComercialSlotsLines(String(c.slotsResumo || ''));
    const grid =
      lines.length > 0 ? this.renderComercialSlotsGridFromLines(lines) : this.renderComercialResumoPlaceholderGrid();
    const pipeline = this.renderComercialPipelineCompact(c);

    return `
      <div class="rounded-lg border border-border/40 bg-muted/15 p-1.5">
        ${pipeline}
        <div class="mb-1 flex flex-wrap items-center justify-between gap-1.5 border-b border-border/25 pb-1.5">
          <div class="flex min-w-0 items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0 text-primary/80" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
            <span class="text-[9px] font-semibold uppercase tracking-[0.1em] text-foreground">Resumo do pedido</span>
          </div>
          <div class="flex flex-wrap items-center gap-1">
            <span class="inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-[8px] font-semibold ${modoPillClass}">${this.escapeHtml(modoLabel)}</span>
            ${fechadoBadge}
          </div>
        </div>
        ${grid}
      </div>
    `;
  }

  /** `embedded`: dentro do cartão cliente; `mergedTitle`: título único “Cliente & venda”. */
  private renderComercialBlock(opts?: { embedded?: boolean; mergedTitle?: boolean }): string {
    if (!this.vm || this.vm.kind !== 'ready') return '';

    const embedded = opts?.embedded === true;
    const mergedTitle = opts?.mergedTitle === true;
    const c = this.vm.comercial;
    const modoLabel = c.modo === 'pre_venda' ? 'Pré-venda' : 'Pedido ativo';
    const modoPillClass =
      c.modo === 'pre_venda'
        ? 'border border-border/60 bg-secondary/70 text-secondary-foreground'
        : 'border border-primary/35 bg-primary/10 text-foreground';

    const fechadoBadge = c.pedidoConfirmado
      ? '<span class="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-px text-[8px] font-semibold uppercase tracking-wide text-primary"><span class="h-1 w-1 rounded-full bg-primary"></span>Fechado</span>'
      : '';

    const errorBanner = this.comercialErrorMessage
      ? `<div class="flex gap-2 rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2.5 text-[11px] leading-relaxed text-destructive">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mt-0.5 shrink-0 opacity-90" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          <span>${this.escapeHtml(this.comercialErrorMessage)}</span>
        </div>`
      : '';

    const placeholder = 'Rascunho da próxima mensagem (após gerar).';
    const textareaDisabled = this.comercialLoading ? 'disabled' : '';
    const textareaValue = this.escapeHtml(this.comercialDraftText);
    const textareaPlaceholder = this.escapeAttr(placeholder);

    const textareaContent = this.comercialLoading
      ? `
        <div class="flex min-h-[4rem] items-center justify-center gap-2 rounded-lg border border-border/40 bg-muted/30 px-3 py-4 text-[11px] text-muted-foreground">
          <span class="inline-block h-4 w-4 shrink-0 rounded-full border-2 border-primary/40 border-t-primary animate-spin" aria-hidden="true"></span>
          <span class="font-medium">A gerar sugestão comercial…</span>
        </div>`
      : `
        <textarea
          data-field="comercial-draft"
          rows="3"
          class="min-h-[4.5rem] w-full resize-none rounded-lg border border-border/45 bg-background px-2.5 py-2 text-[12px] leading-relaxed text-foreground shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] placeholder:text-muted-foreground/80 focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)]"
          placeholder="${textareaPlaceholder}"
          ${textareaDisabled}
        >${textareaValue}</textarea>`;

    const generateDisabled = this.comercialLoading ? 'disabled aria-disabled="true"' : '';
    const genExtra = this.comercialLoading ? 'opacity-55 cursor-not-allowed' : '';
    const sendDisabled = this.comercialLoading ? 'disabled aria-disabled="true"' : '';
    const sendExtra = this.comercialLoading ? 'opacity-55 cursor-not-allowed' : '';

    const headerTitle = mergedTitle ? 'Cliente & venda' : 'Comercial';

    const inner = `
        <button type="button" data-action="comercial:toggle-expand" class="group ${ATD_FOCUS} flex w-full items-center gap-2 rounded-lg text-left transition-colors duration-150 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] -mx-1 px-1 py-0.5">
          <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary ring-1 ring-primary/25">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
          </span>
          <span class="min-w-0 flex-1 text-[12px] font-semibold tracking-tight text-foreground">${this.escapeHtml(headerTitle)}</span>
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none" class="shrink-0 text-muted-foreground transition-transform duration-200 group-hover:text-foreground ${this.comercialBlockExpanded ? 'rotate-180' : ''}">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        ${this.comercialBlockExpanded ? `
        <div class="mt-2 space-y-2">
          ${this.renderComercialResumoBlock(c, modoPillClass, modoLabel, fechadoBadge)}
          ${errorBanner}
          <div>
            <label class="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="opacity-70" aria-hidden="true"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
              Próxima mensagem
            </label>
            ${textareaContent}
          </div>
          <div class="flex flex-wrap items-stretch gap-2">
            <button type="button" class="${ATD_BTN_9_PRI_WIDE} ${genExtra}" data-action="comercial:generate" ${generateDisabled}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="opacity-95" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/><path d="M19 3v4"/><path d="M21 5h-4"/></svg>
              Gerar rascunho
            </button>
            <button type="button" class="${ATD_BTN_9_SEC_WIDE} ${sendExtra}" data-action="comercial:send" ${sendDisabled}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="opacity-80" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
              Enviar
            </button>
          </div>
          <div class="flex justify-end border-t border-border/25 pt-2">
            <button type="button" class="${ATD_FOCUS} text-[10px] font-medium text-muted-foreground/90 transition-colors duration-150 hover:text-foreground" data-action="comercial:demo-error">
              ${this.comercialErrorMessage ? 'Ocultar simulação de erro' : 'Simular erro de rede'}
            </button>
          </div>
        </div>
        ` : ''}
    `;

    if (embedded) {
      return `<div class="mt-2 border-t border-border/25 pt-2" data-comercial-embedded>${inner}</div>`;
    }

    return `
      <div class="${ATD_SECTION} p-3">
        ${inner}
      </div>
    `;
  }

  private renderPurchaseBlock(): string {
    if (!this.vm || this.vm.kind !== 'ready') return '';

    const lastPurchase = this.vm.lastPurchase ?? null;
    const headerTitle = 'Registro de compra';
    const sourceLabel =
      lastPurchase && lastPurchase.source === 'AI_DETECTED'
        ? '<div class="mt-0.5 text-[10px] text-primary">Detectado automaticamente pelo mapeamento de compras</div>'
        : '';

    const blockContent =
      lastPurchase !== null
        ? `
          <div class="rounded-lg border border-border/35 bg-background/45 p-2">
            <div class="text-[11px] text-muted-foreground/95">Data: <span class="text-foreground font-medium">${this.escapeHtml(this.formatPurchaseDate(lastPurchase.purchaseDate))}</span></div>
            ${lastPurchase.value !== null && lastPurchase.value !== undefined ? `<div class="mt-0.5 text-[11px] text-muted-foreground/95">Valor: R$ ${Number(lastPurchase.value).toFixed(2)}</div>` : ''}
            ${lastPurchase.items && lastPurchase.items.length > 0 ? `<div class="mt-0.5 text-[11px] text-muted-foreground/95">Itens: ${this.escapeHtml(lastPurchase.items.join(', '))}</div>` : ''}
            ${lastPurchase.notes ? `<div class="mt-0.5 text-[11px] text-muted-foreground/95 truncate">Notas: ${this.escapeHtml(lastPurchase.notes)}</div>` : ''}
            ${sourceLabel}
            <div class="mt-2 flex gap-2">
              <button type="button" class="${ATD_BTN_8} flex-1" data-action="manual:open-register">
                Registrar compra
              </button>
              <button type="button" class="${ATD_BTN_8_DEST} shrink-0" data-action="manual:remove-purchase" data-purchase-id="${this.escapeAttr(lastPurchase.purchaseId)}">
                Remover registro
              </button>
            </div>
          </div>`
        : `
          <div class="text-[11px] text-muted-foreground/95">Nenhuma compra registrada para este chat.</div>
          <button type="button" class="${ATD_BTN_8} mt-2" data-action="manual:open-register">
            Registrar compra
          </button>`;

    const modalHtml = this.purchaseFormOpen
      ? `
        <div class="absolute inset-0 z-[1000]" data-purchase-form-overlay>
          <div class="absolute inset-0 bg-black/50" data-action="manual:close-purchase-form"></div>
          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm glass rounded-2xl border border-border/45 p-3 shadow-md">
            <div class="text-xs font-semibold text-foreground/95 mb-2">Registrar compra</div>
            <div class="flex flex-col gap-2">
              <label class="text-[11px] text-muted-foreground/95">Data da compra (obrigatório)</label>
              <input type="date" required data-field="purchase-date" value="${this.getTodayDateString()}" class="${ATD_INPUT}" />
              <label class="text-[11px] text-muted-foreground/95">Valor (opcional)</label>
              <input type="number" step="0.01" min="0" data-field="purchase-value" placeholder="0,00" class="${ATD_INPUT}" />
              <label class="text-[11px] text-muted-foreground/95">Itens / resumo (opcional)</label>
              <textarea data-field="purchase-items" rows="2" placeholder="Ex.: Item 1, Item 2" class="${ATD_INPUT} resize-none"></textarea>
              <label class="text-[11px] text-muted-foreground/95">Notas (opcional)</label>
              <textarea data-field="purchase-notes" rows="2" class="${ATD_INPUT} resize-none"></textarea>
            </div>
            <div class="mt-3 flex gap-2 justify-end">
              <button type="button" class="${ATD_BTN_9}" data-action="manual:close-purchase-form">Cancelar</button>
              <button type="button" class="${ATD_BTN_9_PRI}" data-action="manual:submit-purchase">Salvar</button>
            </div>
          </div>
        </div>`
      : '';

    return `
      <div class="${ATD_SECTION} p-3">
        <button type="button" data-action="purchase:toggle-expand" class="group ${ATD_SECTION_TOGGLE} w-full">
          <span>${this.escapeHtml(headerTitle)}</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="transition-transform duration-200 ml-auto text-muted-foreground group-hover:text-foreground ${this.purchaseBlockExpanded ? 'rotate-180' : ''}">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        ${this.purchaseBlockExpanded ? `<div class="mt-2">${blockContent}</div>` : ''}
      </div>
      ${modalHtml}
    `;
  }

  private renderRetomarEtiquetasPanel(): string {
    if (!this.vm || this.vm.kind !== 'ready') return '';

    const contadorLabel = this.vm.retomar.contador > 0
      ? this.describeRetomarChamada(this.vm.retomar.contador)
      : 'ainda nao comecou';
    const headerTitle = this.retomarExpanded ? 'Etiquetas Mettri' : 'Etiquetas';
    const etiquetas = this.vm.retomar.etiquetas;

    return `
      <div class="${ATD_SECTION} p-3 mettri-atendimento-retomar-support">
        <div class="mettri-atendimento-etiquetas-header flex items-center justify-between gap-2">
          <button
            type="button"
            data-action="retomar:toggle-expand"
            class="group ${ATD_SECTION_TOGGLE} min-w-0"
          >
            <span class="truncate">${this.escapeHtml(headerTitle)}</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="transition-transform duration-200 shrink-0 text-muted-foreground group-hover:text-foreground ${this.retomarExpanded ? 'rotate-180' : ''}">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button
            type="button"
            data-action="retomar-tag:create"
            class="${ATD_BTN_TOP} shrink-0 px-2 text-[11px]"
          >
            Nova lista
          </button>
        </div>

        <div class="mt-2 text-[11px] text-muted-foreground/95">
          Ciclo atual: <span class="text-foreground font-medium">${this.escapeHtml(contadorLabel)}</span>
        </div>

        ${this.retomarExpanded ? `
          <div class="mt-2 flex flex-col gap-2">
            ${etiquetas.length === 0
              ? `<div class="text-[11px] text-muted-foreground">Nenhuma etiqueta encontrada.</div>`
              : etiquetas.map((list) => this.renderRetomarTagRow(list)).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderRetomarTagRow(list: RetomarEtiquetaVm): string {
    const isSelected = list.isMember;
    const isMenuOpen = this.retomarMenuOpenListId === list.id;
    const colorVar = this.safeTagColorVar(list.color);
    const listId = this.escapeAttr(list.id);
    const rowClass = isSelected
      ? 'mettri-atendimento-etiqueta-chip mettri-atendimento-etiqueta-chip-active'
      : 'mettri-atendimento-etiqueta-chip';
    const defaultBadge = list.isDefault
      ? '<span class="text-[10px] text-muted-foreground">(padrao)</span>'
      : '';

    return `
      <div class="relative">
        <div class="${rowClass} flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border/50 bg-background/70 hover:bg-accent/40 transition-colors duration-150">
          <button
            type="button"
            data-action="retomar-tag:toggle"
            data-list-id="${listId}"
            class="${ATD_FOCUS} flex items-center gap-2 flex-1 min-w-0 text-left rounded-md"
          >
            <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: var(${colorVar})"></span>
            <span class="text-xs font-medium text-foreground/95 truncate">${this.escapeHtml(list.name)}</span>
            ${defaultBadge}
            <span class="text-[11px] text-muted-foreground/95 shrink-0 tabular-nums">(${list.memberCount})</span>
          </button>
          <button
            type="button"
            data-action="retomar:toggle-menu"
            data-list-id="${listId}"
            class="${ATD_ICON_BTN} flex items-center justify-center"
            title="Menu da etiqueta"
            aria-label="Menu da etiqueta"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="opacity-80"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
          </button>
        </div>
        ${isMenuOpen ? this.renderRetomarTagMenu(list) : ''}
      </div>
    `;
  }

  private renderRetomarTagMenu(list: RetomarEtiquetaVm): string {
    const listId = this.escapeAttr(list.id);
    const blocked = list.isDefault ? 'true' : 'false';
    const blockedClass = list.isDefault ? 'text-muted-foreground' : '';

    return `
      <div class="mettri-atendimento-etiqueta-menu absolute right-0 mt-1 w-44 rounded-lg glass border border-border/50 shadow-md z-20 p-0.5">
        <button
          type="button"
          class="${ATD_FOCUS} w-full text-left rounded-md px-2 py-1.5 text-xs text-foreground/95 transition-colors duration-150 hover:bg-accent/60"
          data-action="retomar-tag:view-members"
          data-list-id="${listId}"
        >
          Ver membros
        </button>
        <button
          type="button"
          class="${ATD_FOCUS} w-full text-left rounded-md px-2 py-1.5 text-xs transition-colors duration-150 hover:bg-accent/60 ${blockedClass}"
          data-action="retomar-tag:rename"
          data-list-id="${listId}"
          data-blocked-default="${blocked}"
        >
          Renomear
        </button>
        <button
          type="button"
          class="${ATD_FOCUS} w-full text-left rounded-md px-2 py-1.5 text-xs transition-colors duration-150 hover:bg-destructive/12 ${blockedClass}"
          data-action="retomar-tag:delete"
          data-list-id="${listId}"
          data-blocked-default="${blocked}"
        >
          Excluir
        </button>
      </div>
    `;
  }

  private safeTagColorVar(color: string): string {
    const candidate = String(color || '').trim();
    if (/^--tag-color-[1-8]$/.test(candidate)) return candidate;
    return '--tag-color-1';
  }

  private describeRetomarChamada(contador: number): string {
    const n = Math.max(0, Math.floor(contador));
    if (n <= 0) return 'Sem ciclos';
    if (n === 1) return '1º ciclo';
    if (n === 2) return '2º ciclo';
    if (n === 3) return '3º ciclo';
    return '4º ciclo';
  }

  // ── Aba de intenção ──
  // Mostra o tipo de conversa como uma aba/tab que muda conforme a intenção detectada.

  private renderIntencaoChip(): string {
    if (!this.vm || this.vm.kind !== 'ready') return '';
    const tc = this.vm.tipoConversa;
    const chips: Record<string, { label: string }> = {
      compra_nova: { label: 'Nova compra' },
      suporte_pos_venda: { label: 'Suporte' },
      orcamento: { label: 'Orçamento' },
    };
    const chip = tc ? chips[tc] : null;
    if (!chip) return '';
    return `
      <div class="flex items-center gap-2 mb-2 pb-1.5 border-b border-border/20">
        <span class="w-2 h-2 rounded-full bg-primary/50 shrink-0"></span>
        <span class="text-[11px] font-semibold text-foreground">${this.escapeHtml(chip.label)}</span>
        ${this.renderOrderPill()}
      </div>
    `;
  }

  /** Pastilha "Pedido #33232" — pill Material-style que aparece ao lado do chip
   *  quando o cliente tem um pedido ativo (lead/draft/open/awaiting_payment). */
  private renderOrderPill(): string {
    if (!this.vm || this.vm.kind !== 'ready') return '';
    const pa = this.vm.pedidoAtual;
    if (!pa || !pa.numeroSequencial) return '';
    const padSeq = String(pa.numeroSequencial).padStart(4, '0');
    return `<span class="inline-flex items-center gap-1.5 ml-1 px-2 py-0.5 rounded-lg border border-border/20 bg-card text-[11px] font-semibold text-foreground/90 shadow-sm leading-none"><span class="font-mono tabular-nums">Pedido #${padSeq}</span></span>`;
  }

  /** Badge de estado percebido (fase + confiança) para o header do cliente. */
  private renderEstadoBadge(ep: import('./view-model').EstadoPercebidoVm): string {
    const faseLabel: Record<string, string> = {
      lead: 'Lead',
      draft: 'Draft',
      open: 'Aberto',
      completed: 'Completo',
      pos_venda: 'Pós-venda',
      indeterminado: '?',
    };
    const confiancaColor: Record<string, string> = {
      alta: 'bg-green-500/20 text-green-400 border-green-500/30',
      media: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      baixa: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    const confiancaDot: Record<string, string> = {
      alta: 'bg-green-400',
      media: 'bg-yellow-400',
      baixa: 'bg-red-400',
    };
    const label = faseLabel[ep.fase] || ep.fase;
    const confCls = confiancaColor[ep.confiancaEstado] || confiancaColor.baixa;
    const dotCls = confiancaDot[ep.confiancaEstado] || confiancaDot.baixa;
    return `
      <div class="flex items-center gap-1.5 mt-1">
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-medium ${confCls}">
          <span class="w-1.5 h-1.5 rounded-full ${dotCls}"></span>
          ${this.escapeHtml(label)}
        </span>
        <span class="text-[9px] text-muted-foreground/60">${ep.coletado.length > 0 ? `${ep.coletado.length}/4 preenchido` : 'novo'}</span>
      </div>
    `;
  }

  // ── Bloco PED-00XX (Aba de Pedido) ──
  // Design skill: 3 níveis de fundo, borda sutil 1px, controles sem borda,
  // tipografia 11–13px, hierarquia por peso/opacidade, monoespaçado para números

  private renderPedidoOrderRecord(): string {
    if (!this.vm || this.vm.kind !== 'ready') return '';
    const pa = this.vm.pedidoAtual;
    if (!pa) return '';

    const statusCls: Record<string, string> = {
      lead: 'text-muted-foreground/50',
      draft: 'text-blue-400',
      open: 'text-green-400',
      awaiting_payment: 'text-yellow-400',
      completed: 'text-emerald-400',
      cancelled: 'text-red-400',
      lost: 'text-muted-foreground/30',
    };
    const statusLabel: Record<string, string> = {
      lead: 'Lead', draft: 'Draft', open: 'Aberto',
      awaiting_payment: 'Aguardando', completed: 'Completo',
      cancelled: 'Cancelado', lost: 'Perdido',
    };
    const chipCls = statusCls[pa.status] || statusCls.draft;
    const chipLabel = statusLabel[pa.status] || pa.status;
    const isDraft = pa.status === 'draft';
    const isLead = pa.status === 'lead';
    const padSeq = String(pa.numeroSequencial || 0).padStart(4, '0');

    // ── Estado: Lead (sem itens) ──
    if (isLead && pa.itens.length === 0) {
      return `
        <div class="mt-2 rounded-lg border border-border/20 bg-card p-3">
          <div class="flex items-center gap-2 mb-2">
            <span class="font-mono text-xs font-semibold text-foreground/90">PED-${padSeq}</span>
            <span class="text-[10px] font-medium ${chipCls}">${chipLabel}</span>
          </div>
          <p class="text-[11px] text-muted-foreground/50 leading-relaxed">
            Aguardando inten&ccedil;&atilde;o de compra. O sistema detectar&aacute; produtos quando o cliente escrever.
          </p>
        </div>
      `;
    }

    // ── Itens ──
    const itensHtml = pa.itens.map((i) => {
      const totalStr = i.precoTotalCentavos > 0
        ? `R$ ${(i.precoTotalCentavos / 100).toFixed(2).replace('.', ',')}`
        : '';
      const controls = isDraft
        ? `<span class="flex items-center gap-0.5 ml-1.5">
            <button type="button" class="text-[10px] w-4 h-4 rounded-sm flex items-center justify-center hover:bg-foreground/5 text-muted-foreground/60 transition-colors" data-action="order:updateQty" data-order-id="${this.escapeAttr(pa.orderId)}" data-sku-id="${this.escapeAttr(i.skuId)}" data-qty="${i.quantidade - 1}">−</button>
            <span class="font-mono text-[11px] text-foreground/80 tabular-nums w-3 text-center">${i.quantidade}</span>
            <button type="button" class="text-[10px] w-4 h-4 rounded-sm flex items-center justify-center hover:bg-foreground/5 text-muted-foreground/60 transition-colors" data-action="order:updateQty" data-order-id="${this.escapeAttr(pa.orderId)}" data-sku-id="${this.escapeAttr(i.skuId)}" data-qty="${i.quantidade + 1}">+</button>
            <button type="button" class="text-[10px] w-4 h-4 rounded-sm flex items-center justify-center hover:bg-red-500/5 text-muted-foreground/40 hover:text-red-400 transition-colors" data-action="order:removeItem" data-order-id="${this.escapeAttr(pa.orderId)}" data-sku-id="${this.escapeAttr(i.skuId)}">×</button>
          </span>`
        : '';
      return `
        <div class="flex items-center justify-between gap-2 py-0.5">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="font-mono text-[10px] text-muted-foreground/40 tabular-nums">${i.quantidade}×</span>
            <span class="text-[11px] text-foreground/85 truncate">${this.escapeHtml(i.nome)}</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="font-mono text-[11px] text-foreground/70 tabular-nums shrink-0">${totalStr}</span>
            ${controls}
          </div>
        </div>
      `;
    }).join('');

    // ── Subtotais ──
    const subtotal = pa.itens.reduce((s, i) => s + i.precoTotalCentavos, 0);
    const subtotalStr = subtotal > 0
      ? `R$ ${(subtotal / 100).toFixed(2).replace('.', ',')}`
      : '—';
    const totalStr = pa.totalCentavos > 0
      ? `R$ ${(pa.totalCentavos / 100).toFixed(2).replace('.', ',')}`
      : '';

    // ── Funil ──
    const etapas = ['produto', 'endereco', 'pagamento', 'prazo', 'fechar'] as const;
    const okCount = etapas.filter((e) => pa.funil[e].estado === 'ok').length;
    const progresso = Math.round((okCount / 5) * 100);
    const funilHtml = etapas.map((e) => {
      const ok = pa.funil[e].estado === 'ok';
      return `<span class="text-[10px] ${ok ? 'text-foreground/70' : 'text-muted-foreground/25'}">${ok ? '●' : '○'} ${e.charAt(0).toUpperCase() + e.slice(1)}</span>`;
    }).join(' ');

    // ── Observações ──
    const obsHtml = pa.observacoes
      ? `<div class="text-[10px] text-muted-foreground/40 leading-relaxed mt-0.5">${this.escapeHtml(pa.observacoes)}</div>`
      : '';

    // ── Ações ──
    const canConfirm = isDraft && pa.itens.length > 0;
    const canCancel = pa.status === 'draft' || pa.status === 'open';

    const actionsHtml = (canCancel || canConfirm)
      ? `<div class="flex items-center justify-between mt-2 pt-1.5 border-t border-border/10">
          <span>${canCancel
            ? `<button type="button" class="text-[10px] font-medium text-muted-foreground/40 hover:text-red-400 transition-colors" data-action="order:cancel" data-order-id="${this.escapeAttr(pa.orderId)}">cancelar</button>`
            : ''}</span>
          <span class="flex items-center gap-2">
            ${totalStr ? `<span class="font-mono text-xs font-semibold text-foreground tabular-nums">${totalStr}</span>` : ''}
            ${canConfirm
              ? `<button type="button" class="text-[10px] font-medium text-blue-400 hover:text-blue-300 transition-colors" data-action="order:confirm" data-order-id="${this.escapeAttr(pa.orderId)}">confirmar pedido</button>`
              : ''}
          </span>
        </div>`
      : '';

    return `
      <div class="mt-2 rounded-lg border border-border/20 bg-card p-2.5">
        <div class="flex items-center gap-2 mb-2">
          <span class="font-mono text-xs font-semibold text-foreground/90">PED-${padSeq}</span>
          <span class="text-[10px] font-medium ${chipCls}">${chipLabel}</span>
          ${pa.pagamentoMetodo ? `<span class="text-[10px] text-muted-foreground/30">· ${this.escapeHtml(pa.pagamentoMetodo)}</span>` : ''}
        </div>

        <div class="flex flex-col">
          ${itensHtml}
        </div>

        ${subtotal > 0 ? `
        <div class="flex items-center justify-end gap-3 mt-1.5 pt-1 border-t border-border/10">
          <span class="text-[10px] text-muted-foreground/40">subtotal</span>
          <span class="font-mono text-[11px] text-foreground/60 tabular-nums">${subtotalStr}</span>
        </div>` : ''}

        <div class="flex items-center gap-2 mt-2 pt-1.5 border-t border-border/10">
          <span class="text-[10px] text-muted-foreground/40 shrink-0">funil</span>
          <div class="flex flex-wrap gap-1.5 flex-1">${funilHtml}</div>
          <span class="text-[10px] font-mono text-muted-foreground/25 tabular-nums">${progresso}%</span>
        </div>

        ${obsHtml}

        ${actionsHtml}
      </div>
    `;
  }

  // ── Histórico resumido ──
  // Design skill: tipografia 10px, hierarquia por opacidade extrema,
  // sem emojis, divisores mínimos

  private renderHistoricoCliente(): string {
    if (!this.vm || this.vm.kind !== 'ready') return '';
    const hist = this.vm.historicoPedidos;
    if (hist.length === 0) return '';

    const maxShow = 5;
    const shown = hist.slice(0, maxShow);
    const m = this.vm.metricaCliente;

    const items = shown.map((p) => {
      const padSeq = String(p.numeroSequencial || 0).padStart(4, '0');
      const isOk = p.status === 'completed';
      const isCancel = p.status === 'cancelled';
      const cls = isOk ? 'text-foreground/40' : isCancel ? 'text-muted-foreground/25 line-through' : 'text-muted-foreground/20';
      const totalStr = p.totalCentavos > 0
        ? `<span class="font-mono tabular-nums">R$ ${(p.totalCentavos / 100).toFixed(2).replace('.', ',')}</span>`
        : '';
      return `<span class="text-[10px] whitespace-nowrap ${cls}">PED-${padSeq} ${totalStr}</span>`;
    }).join(' <span class="text-muted-foreground/10">—</span> ');

    const ticketStr = m.ticketMedioCentavos > 0
      ? `R$ ${(m.ticketMedioCentavos / 100).toFixed(2).replace('.', ',')}`
      : '—';

    return `
      <div class="mt-2 pt-1.5 border-t border-border/10">
        <div class="flex flex-wrap gap-x-2 gap-y-0.5">${items}</div>
        <div class="flex items-center gap-3 mt-1">
          <span class="text-[10px] text-muted-foreground/30">ticket m&eacute;dio <span class="text-foreground/50 font-medium">${ticketStr}</span></span>
          <span class="text-[10px] text-muted-foreground/30">${this.escapeHtml(m.frequencia)}</span>
          <span class="text-[10px] text-muted-foreground/30">${m.totalPedidos} pedidos</span>
        </div>
      </div>
    `;
  }
}

