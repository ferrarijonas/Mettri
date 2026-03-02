import type { AtendimentoViewModel } from './view-model';
import type { RagConsultaDebugInfo } from '../../../modules/rag';

type ActionHandler = (actionId: string, payload?: unknown) => void;
type RetomarEtiquetaVm = Extract<AtendimentoViewModel, { kind: 'ready' }>['retomar']['etiquetas'][number];

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
  private notesOpen: boolean = false;
  private retomarExpanded: boolean = true;
  private retomarMenuOpenListId: string | null = null;
  private purchaseBlockExpanded: boolean = true;
  private purchaseFormOpen: boolean = false;
  private ragBlockExpanded: boolean = true;
  private ragSuggestionText: string = '';
  private ragLoading: boolean = false;
  private ragSimilarCount: number | null = null;
  private ragDebugOpen: boolean = false;
  private ragDebugInfo: RagConsultaDebugInfo | null = null;

  constructor(params: { onAction?: ActionHandler } = {}) {
    this.onAction = params.onAction ?? null;
  }

  public async render(vm: AtendimentoViewModel): Promise<HTMLElement> {
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
        <div class="glass-subtle rounded-xl p-3">
          <div class="text-sm font-semibold text-foreground">${this.escapeHtml(this.vm.title)}</div>
          <div class="text-xs text-muted-foreground mt-1">
            ${this.escapeHtml(this.vm.hint)}
          </div>
        </div>
      `;
      return;
    }

    const demoBadge = this.vm.demoBadge
      ? `<span class="ml-2 inline-flex items-center rounded-lg border border-border/30 bg-secondary/20 px-2 py-0.5 text-[10px] text-muted-foreground">${this.escapeHtml(this.vm.demoBadge)}</span>`
      : '';

    const badges = this.vm.customer.badges.slice(0, 2).map(b => this.renderBadge(b)).join('');
    const hasMoreBadges = this.vm.customer.badges.length > 2;
    const moreBadges = hasMoreBadges ? this.renderBadge(`+${this.vm.customer.badges.length - 2}`) : '';

    const retomarPanel = this.renderRetomarEtiquetasPanel();

    // Layout compacto: sem scroll. Notas ficam em “gaveta”.
    this.container.innerHTML = `
      <div class="relative flex flex-col gap-3 h-full overflow-hidden">
        <!-- Drawer de Notas -->
        <div class="absolute inset-0 z-[1000] ${this.notesOpen ? '' : 'hidden'}" data-notes-drawer>
          <div class="absolute inset-0 bg-black/50" data-action="notes:close"></div>
          <div class="absolute top-0 left-0 right-0 glass rounded-b-2xl border border-border/50 p-3">
            <div class="flex items-center justify-between">
              <div class="text-xs font-semibold text-foreground">Notas</div>
              <button type="button" class="w-8 h-8 rounded-xl border border-border/30 bg-secondary/20 text-xs text-foreground" data-action="notes:close">Fechar</button>
            </div>
            <textarea
              class="mt-2 w-full min-h-28 rounded-xl border border-border/30 bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground"
              placeholder="${this.escapeHtml(this.vm.notes.placeholder)}"
              data-field="notes"
            >${this.escapeHtml(this.vm.notes.value)}</textarea>
            <div class="mt-2 text-[11px] text-muted-foreground" data-field="notes-status">Salvamento automático</div>
          </div>
        </div>

        <!-- Topo: Identidade -->
        <div class="glass-subtle rounded-xl p-3">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="text-sm font-semibold text-foreground truncate">
                ${this.escapeHtml(this.vm.customer.displayName)}${demoBadge}
              </div>
              <div class="mt-0.5 text-[11px] text-muted-foreground truncate">
                <span class="font-medium">${this.escapeHtml(this.vm.customer.phoneLabel)}</span>
                <span class="mx-1">•</span>
                <span class="font-mono">${this.escapeHtml(this.vm.customer.chatId)}</span>
              </div>
              <div class="mt-2 flex flex-wrap gap-1.5">
                ${badges}${moreBadges}
              </div>
            </div>

            <div class="flex flex-col gap-2">
              <button type="button" class="h-8 px-3 rounded-xl border border-border/30 bg-secondary/20 text-[11px] text-foreground" data-action="open-cadastro">
                Cadastro
              </button>
              <button type="button" class="h-8 px-3 rounded-xl border border-border/30 bg-secondary/20 text-[11px] text-foreground" data-action="notes:open">
                Notas
              </button>
            </div>
          </div>
        </div>

        ${retomarPanel}

        <!-- Card principal: Pedido (pipeline + ações) -->
        <div class="glass-subtle rounded-xl p-3 flex-1 overflow-hidden flex flex-col">
          <div class="flex items-center justify-between">
            <div class="text-xs font-semibold text-foreground">Pedido</div>
            <div class="text-[11px] text-muted-foreground">
              ${this.escapeHtml(this.vm.kpis.map(k => `${k.label}:${k.value}`).slice(0, 2).join(' • '))}
            </div>
          </div>

          <!-- Pipeline -->
          <div class="mt-2 grid grid-cols-3 gap-2">
            ${this.renderStage('Aberto')}
            ${this.renderStage('Pagamento')}
            ${this.renderStage('Fechado')}
          </div>

          <!-- Pedidos ativos -->
          <div class="mt-2 flex-1 overflow-hidden">
            <div class="flex flex-col gap-2 max-h-full overflow-hidden">
              ${this.vm.orders.length === 0 ? this.renderEmpty('Nenhum pedido aberto.') : this.vm.orders.slice(0, 2).map(o => this.renderOrderRow(o)).join('')}
            </div>
          </div>

          <!-- Ação principal -->
          <div class="mt-3 grid grid-cols-2 gap-2">
            ${this.renderPrimaryButton('order:new', 'Novo pedido', this.isDisabled('order:new'))}
            ${this.renderSecondaryButton('order:continue', 'Continuar', this.isDisabled('order:continue'))}
          </div>
        </div>

        ${this.renderRagSuggestionBlock()}
        ${this.renderPurchaseBlock()}

        <!-- Rodapé compacto: Frases + Produto -->
        <div class="grid grid-cols-2 gap-3">
          <div class="glass-subtle rounded-xl p-3">
            <div class="text-xs font-semibold text-foreground">Frases</div>
            <div class="mt-2 flex flex-col gap-2">
              ${this.vm.phrases.slice(0, 3).map(p => this.renderPhrasePill(p.label, p.text)).join('')}
            </div>
          </div>
          <div class="glass-subtle rounded-xl p-3">
            <div class="text-xs font-semibold text-foreground">Produto</div>
            <div class="mt-2">
              ${this.vm.products.slice(0, 1).map(p => this.renderMiniProduct(p)).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
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

      if (action === 'rag:toggle-expand') {
        this.ragBlockExpanded = !this.ragBlockExpanded;
        this.renderContent();
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
      <span class="inline-flex items-center rounded-lg border border-border/30 bg-secondary/20 px-2 py-0.5 text-[10px] text-muted-foreground">
        ${this.escapeHtml(label)}
      </span>
    `;
  }

  private renderPhrasePill(label: string, text: string): string {
    return `
      <button
        type="button"
        class="h-9 px-3 rounded-xl border border-border/30 bg-secondary/20 text-[11px] text-foreground hover:bg-secondary/30"
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
      <div class="rounded-xl border border-border/30 bg-secondary/10 p-3 text-center">
        <div class="text-[11px] text-muted-foreground">${this.escapeHtml(text)}</div>
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

  private renderStage(label: string): string {
    return `
      <div class="rounded-xl border border-border/30 bg-secondary/10 p-2">
        <div class="text-[10px] text-muted-foreground">${this.escapeHtml(label)}</div>
        <div class="mt-1 text-xs font-semibold text-foreground">•</div>
      </div>
    `;
  }

  private renderOrderRow(o: { id: string; title: string; subtitle: string; status: string }): string {
    return `
      <div class="rounded-xl border border-border/30 bg-background/40 p-2">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-medium text-foreground truncate">${this.escapeHtml(o.title)}</div>
            <div class="mt-0.5 text-[11px] text-muted-foreground truncate">${this.escapeHtml(o.subtitle)}</div>
          </div>
          <span class="inline-flex items-center rounded-lg border border-border/30 bg-secondary/20 px-2 py-0.5 text-[10px] text-muted-foreground">
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
    const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : 'glow-hover hover:opacity-95';
    return `
      <button
        type="button"
        class="h-10 rounded-xl bg-primary text-primary-foreground text-xs font-medium ${disabledClasses}"
        data-action="${this.escapeHtml(actionId)}"
        ${disabledAttrs}
      >
        ${this.escapeHtml(label)}
      </button>
    `;
  }

  private renderSecondaryButton(actionId: string, label: string, disabled: boolean): string {
    const disabledAttrs = disabled ? 'disabled aria-disabled="true"' : '';
    const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-secondary/30';
    return `
      <button
        type="button"
        class="h-10 rounded-xl border border-border/30 bg-secondary/20 text-xs font-medium text-foreground ${disabledClasses}"
        data-action="${this.escapeHtml(actionId)}"
        ${disabledAttrs}
      >
        ${this.escapeHtml(label)}
      </button>
    `;
  }

  private renderMiniProduct(p: { name: string; priceLabel: string; stockLabel?: string; offerText: string }): string {
    return `
      <div class="rounded-xl border border-border/30 bg-background/40 p-2">
        <div class="text-xs font-medium text-foreground truncate">${this.escapeHtml(p.name)}</div>
        <div class="mt-0.5 text-[11px] text-muted-foreground truncate">${this.escapeHtml(p.priceLabel || '—')}</div>
        <button
          type="button"
          class="mt-2 w-full h-9 rounded-xl border border-border/30 bg-secondary/20 text-[11px] text-foreground"
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

  private renderRagSuggestionBlock(): string {
    if (!this.vm || this.vm.kind !== 'ready') return '';

    const headerTitle = 'Resposta sugerida';
    const placeholder = 'Clique em \'Gerar sugestão\' para usar conversas passadas como base.';
    const textareaValue = this.escapeHtml(this.ragSuggestionText);
    const textareaDisabled = this.ragLoading ? 'disabled' : '';
    const textareaPlaceholder = this.escapeAttr(placeholder);
    const loadingMessage = 'Buscando conversas similares e gerando sugestão...';
    const similarLine =
      this.ragSimilarCount != null
        ? `<div class="mt-1.5 text-[11px] text-muted-foreground">Baseado em ${this.ragSimilarCount} conversas similares</div>`
        : '';
    const generateDisabled = this.ragLoading ? 'disabled aria-disabled="true"' : '';
    const generateClasses = this.ragLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-secondary/30';
    const sendDisabled = this.ragLoading || !this.ragSuggestionText.trim() ? 'disabled aria-disabled="true"' : '';
    const sendClasses =
      this.ragLoading || !this.ragSuggestionText.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-secondary/30';

    const debugToggleButton = `
      <button
        type="button"
        class="mt-2 text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        data-action="rag:toggle-debug"
      >
        ${this.ragDebugOpen ? 'Ocultar detalhes técnicos do RAG' : 'Ver detalhes técnicos do RAG'}
      </button>
    `;

    const debugPanel = this.ragDebugOpen ? this.renderRagDebugPanel() : '';

    const textareaContent = this.ragLoading
      ? `
        <div class="rounded-xl border border-border/30 bg-background/40 p-3 text-[11px] text-muted-foreground flex items-center gap-2">
          <span class="inline-block w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>
          ${this.escapeHtml(loadingMessage)}
        </div>`
      : `
        <textarea
          data-field="rag-suggestion"
          rows="4"
          class="w-full rounded-xl border border-border/30 bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground resize-none"
          placeholder="${textareaPlaceholder}"
          ${textareaDisabled}
        >${textareaValue}</textarea>`;

    return `
      <div class="glass-subtle rounded-xl p-3">
        <div class="flex items-center justify-between gap-2">
          <button type="button" data-action="rag:toggle-expand" class="flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-primary transition-colors text-left flex-1 min-w-0">
            <span>${this.escapeHtml(headerTitle)}</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="transition-transform shrink-0 ml-auto ${this.ragBlockExpanded ? 'rotate-180' : ''}">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button
            type="button"
            class="w-6 h-6 rounded-md hover:bg-accent transition-colors text-muted-foreground flex items-center justify-center shrink-0"
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
          ${textareaContent}
          ${similarLine}
          <div class="mt-2 flex gap-2">
            <button type="button" class="h-8 px-3 rounded-xl border border-border/30 bg-secondary/20 text-[11px] text-foreground ${generateClasses}" data-action="rag:generate" ${generateDisabled}>
              Gerar sugestão
            </button>
            <button type="button" class="h-8 px-3 rounded-xl border border-border/30 bg-secondary/20 text-[11px] text-foreground ${sendClasses}" data-action="rag:send" ${sendDisabled}>
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

    return `
      <div class="mt-3 border-t border-border/20 pt-3 space-y-3">
        <div class="text-[11px] font-semibold text-foreground">Detalhes técnicos do RAG</div>

        <div class="space-y-1">
          <div class="text-[11px] font-medium text-foreground">Arquivo de prompt</div>
          <button
            type="button"
            class="text-[11px] text-primary hover:underline underline-offset-2"
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
          <div class="rounded-xl border border-border/30 bg-background/40 p-2">
            <div class="text-[11px] text-muted-foreground">Data: <span class="text-foreground font-medium">${this.escapeHtml(this.formatPurchaseDate(lastPurchase.purchaseDate))}</span></div>
            ${lastPurchase.value !== null && lastPurchase.value !== undefined ? `<div class="mt-0.5 text-[11px] text-muted-foreground">Valor: R$ ${Number(lastPurchase.value).toFixed(2)}</div>` : ''}
            ${lastPurchase.items && lastPurchase.items.length > 0 ? `<div class="mt-0.5 text-[11px] text-muted-foreground">Itens: ${this.escapeHtml(lastPurchase.items.join(', '))}</div>` : ''}
            ${lastPurchase.notes ? `<div class="mt-0.5 text-[11px] text-muted-foreground truncate">Notas: ${this.escapeHtml(lastPurchase.notes)}</div>` : ''}
            ${sourceLabel}
            <div class="mt-2 flex gap-2">
              <button type="button" class="flex-1 h-8 px-3 rounded-xl border border-border/30 bg-secondary/20 text-[11px] text-foreground hover:bg-secondary/30" data-action="manual:open-register">
                Registrar compra
              </button>
              <button type="button" class="h-8 px-3 rounded-xl border border-destructive/50 bg-destructive/10 text-[11px] text-destructive hover:bg-destructive/20" data-action="manual:remove-purchase" data-purchase-id="${this.escapeAttr(lastPurchase.purchaseId)}">
                Remover registro
              </button>
            </div>
          </div>`
        : `
          <div class="text-[11px] text-muted-foreground">Nenhuma compra registrada para este chat.</div>
          <button type="button" class="mt-2 h-8 px-3 rounded-xl border border-border/30 bg-secondary/20 text-[11px] text-foreground hover:bg-secondary/30" data-action="manual:open-register">
            Registrar compra
          </button>`;

    const modalHtml = this.purchaseFormOpen
      ? `
        <div class="absolute inset-0 z-[1000]" data-purchase-form-overlay>
          <div class="absolute inset-0 bg-black/50" data-action="manual:close-purchase-form"></div>
          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm glass rounded-2xl border border-border/50 p-3">
            <div class="text-xs font-semibold text-foreground mb-2">Registrar compra</div>
            <div class="flex flex-col gap-2">
              <label class="text-[11px] text-muted-foreground">Data da compra (obrigatório)</label>
              <input type="date" required data-field="purchase-date" value="${this.getTodayDateString()}" class="rounded-xl border border-border/30 bg-background px-3 py-2 text-xs text-foreground" />
              <label class="text-[11px] text-muted-foreground">Valor (opcional)</label>
              <input type="number" step="0.01" min="0" data-field="purchase-value" placeholder="0,00" class="rounded-xl border border-border/30 bg-background px-3 py-2 text-xs text-foreground" />
              <label class="text-[11px] text-muted-foreground">Itens / resumo (opcional)</label>
              <textarea data-field="purchase-items" rows="2" placeholder="Ex.: Item 1, Item 2" class="rounded-xl border border-border/30 bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground resize-none"></textarea>
              <label class="text-[11px] text-muted-foreground">Notas (opcional)</label>
              <textarea data-field="purchase-notes" rows="2" class="rounded-xl border border-border/30 bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground resize-none"></textarea>
            </div>
            <div class="mt-3 flex gap-2 justify-end">
              <button type="button" class="h-9 px-3 rounded-xl border border-border/30 bg-secondary/20 text-[11px] text-foreground" data-action="manual:close-purchase-form">Cancelar</button>
              <button type="button" class="h-9 px-3 rounded-xl bg-primary text-primary-foreground text-[11px] font-medium" data-action="manual:submit-purchase">Salvar</button>
            </div>
          </div>
        </div>`
      : '';

    return `
      <div class="glass-subtle rounded-xl p-3">
        <button type="button" data-action="purchase:toggle-expand" class="flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-primary transition-colors w-full text-left">
          <span>${this.escapeHtml(headerTitle)}</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="transition-transform ml-auto ${this.purchaseBlockExpanded ? 'rotate-180' : ''}">
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
      <div class="glass-subtle rounded-xl p-3 mettri-atendimento-retomar-support">
        <div class="mettri-atendimento-etiquetas-header flex items-center justify-between">
          <button
            type="button"
            data-action="retomar:toggle-expand"
            class="flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-primary transition-colors"
          >
            <span>${this.escapeHtml(headerTitle)}</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="transition-transform ${this.retomarExpanded ? 'rotate-180' : ''}">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button
            type="button"
            data-action="retomar-tag:create"
            class="h-7 px-2 rounded-lg border border-border/40 bg-secondary/20 text-[11px] text-foreground hover:bg-secondary/30 transition-colors"
          >
            Nova lista
          </button>
        </div>

        <div class="mt-2 text-[11px] text-muted-foreground">
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
        <div class="${rowClass} flex items-center gap-2 px-2.5 py-2 rounded-xl border border-border/60 bg-background/70 hover:bg-accent/50 transition-colors">
          <button
            type="button"
            data-action="retomar-tag:toggle"
            data-list-id="${listId}"
            class="flex items-center gap-2 flex-1 min-w-0 text-left"
          >
            <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: var(${colorVar})"></span>
            <span class="text-xs font-medium text-foreground truncate">${this.escapeHtml(list.name)}</span>
            ${defaultBadge}
            <span class="text-[11px] text-muted-foreground shrink-0">(${list.memberCount})</span>
          </button>
          <button
            type="button"
            data-action="retomar:toggle-menu"
            data-list-id="${listId}"
            class="w-6 h-6 rounded-md hover:bg-accent transition-colors text-xs text-muted-foreground"
            title="Menu da etiqueta"
          >
            ⋯
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
      <div class="mettri-atendimento-etiqueta-menu absolute right-0 mt-1 w-44 rounded-xl glass border border-border/60 shadow-xl z-20 p-1">
        <button
          type="button"
          class="w-full text-left rounded-lg px-2 py-1.5 text-xs hover:bg-accent transition-colors"
          data-action="retomar-tag:view-members"
          data-list-id="${listId}"
        >
          Ver membros
        </button>
        <button
          type="button"
          class="w-full text-left rounded-lg px-2 py-1.5 text-xs hover:bg-accent transition-colors ${blockedClass}"
          data-action="retomar-tag:rename"
          data-list-id="${listId}"
          data-blocked-default="${blocked}"
        >
          Renomear
        </button>
        <button
          type="button"
          class="w-full text-left rounded-lg px-2 py-1.5 text-xs hover:bg-destructive/10 transition-colors ${blockedClass}"
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
}

