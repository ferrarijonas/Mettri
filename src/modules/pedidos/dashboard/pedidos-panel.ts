import type { PedidosViewModel, PedidoCardVm, FiltroStatus } from './view-model';

export type PedidosActionHandler = (actionId: string, payload?: unknown) => Promise<void> | void;

const STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  lead: { label: '○ Lead', cls: 'bg-gray-500/20 text-gray-400 border border-gray-500/30' },
  draft: { label: '○ Draft', cls: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
  open: { label: '○ Aberto', cls: 'bg-green-500/20 text-green-400 border border-green-500/30' },
  awaiting_payment: { label: '◷ Aguardando', cls: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
  completed: { label: '✓ Completo', cls: 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30' },
  cancelled: { label: '✗ Cancelado', cls: 'bg-red-500/20 text-red-400 border border-red-500/30' },
  lost: { label: '◌ Perdido', cls: 'bg-gray-600/20 text-gray-500 border border-gray-600/30' },
};

function formatCentavos(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

function formatIso(iso: string): string {
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm} ${hh}:${min}`;
  } catch {
    return iso.slice(0, 16);
  }
}

export class PedidosPanel {
  private container: HTMLElement | null = null;
  private vm: PedidosViewModel | null = null;
  private onAction: PedidosActionHandler | null = null;
  private expandedOrderId: string | null = null;
  private inputDelay: ReturnType<typeof setTimeout> | null = null;

  constructor(params: { onAction?: PedidosActionHandler } = {}) {
    this.onAction = params.onAction ?? null;
  }

  async render(vm: PedidosViewModel): Promise<HTMLElement> {
    this.vm = vm;
    const root = document.createElement('div');
    root.className = 'flex flex-col gap-3';
    this.container = root;

    if (vm.kind === 'loading') {
      root.innerHTML = this.renderSkeleton();
      return root;
    }

    if (vm.kind === 'empty') {
      root.innerHTML = this.renderEmpty();
      return root;
    }

    if (vm.kind === 'error') {
      root.innerHTML = this.renderError(vm.message);
      this.bindRetry();
      return root;
    }

    // kind === 'ready'
    root.innerHTML = this.renderFiltros() + this.renderMetricas() + this.renderLista() + this.renderFooter();
    this.bindEvents();
    return root;
  }

  destroy(): void {
    if (this.inputDelay) clearTimeout(this.inputDelay);
    this.container = null;
    this.vm = null;
  }

  // ── Estados visuais ──

  private renderSkeleton(): string {
    return `
      <div class="flex flex-col gap-3">
        <div class="flex gap-2">
          ${Array.from({ length: 6 }, () => '<div class="h-8 w-20 rounded-full bg-muted/20 animate-pulse"></div>').join('')}
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          ${Array.from({ length: 4 }, () => '<div class="h-20 rounded-lg bg-muted/20 animate-pulse"></div>').join('')}
        </div>
        ${Array.from({ length: 4 }, () => '<div class="h-14 rounded-lg bg-muted/20 animate-pulse"></div>').join('')}
      </div>
    `;
  }

  private renderEmpty(): string {
    return `
      <div class="flex flex-col items-center justify-center py-12 text-center">
        <div class="text-4xl mb-3">📦</div>
        <p class="text-sm text-muted-foreground">Nenhum pedido ainda.</p>
        <p class="text-xs text-muted-foreground/60 mt-1">
          Os pedidos criados no atendimento aparecer&atilde;o aqui.
        </p>
      </div>
    `;
  }

  private renderError(message: string): string {
    return `
      <div class="flex flex-col items-center justify-center py-8 text-center">
        <p class="text-sm text-red-400 mb-3">${message}</p>
        <button class="pedidos-btn-retry px-4 py-1.5 text-xs rounded-full bg-muted/20 hover:bg-muted/40 text-muted-foreground border border-muted/20">
          Tentar novamente
        </button>
      </div>
    `;
  }

  // ── Filtros ──

  private renderFiltros(): string {
    const vm = this.vm;
    if (!vm || vm.kind !== 'ready') return '';

    const filtros: { value: FiltroStatus; label: string }[] = [
      { value: 'todos', label: 'Todos' },
      { value: 'open', label: 'Abertos' },
      { value: 'draft', label: 'Drafts' },
      { value: 'awaiting_payment', label: 'Aguardando' },
      { value: 'completed', label: 'Completos' },
      { value: 'cancelled', label: 'Cancelados' },
    ];

    const chips = filtros
      .map((f) => {
        const active = vm.filtroStatus === f.value;
        const cls = active
          ? 'bg-brand/20 text-brand border-brand/30'
          : 'bg-transparent text-muted-foreground/70 border-muted/20 hover:bg-muted/10';
        return `<button class="pedidos-filtro-chip text-[11px] px-2.5 py-1 rounded-full border ${cls}" data-filtro="${f.value}">${f.label}</button>`;
      })
      .join('');

    return `
      <div class="flex flex-col gap-2">
        <div class="flex flex-wrap gap-1.5">
          ${chips}
        </div>
        <div class="relative">
          <input
            class="pedidos-busca w-full px-3 py-1.5 text-xs rounded-lg bg-muted/10 border border-muted/20 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-brand/50"
            type="search"
            placeholder="Buscar por cliente ou produto..."
            value="${this.escapeHtml(vm.busca)}"
          />
        </div>
      </div>
    `;
  }

  // ── Métricas ──

  private renderMetricas(): string {
    if (this.vm?.kind !== 'ready') return '';
    const m = this.vm.metricas;

    const cards = [
      { label: 'Abertos', value: String(m.totalAbertos) },
      { label: 'Aguardando', value: String(m.aguardandoPagamento) },
      { label: 'Total hoje', value: formatCentavos(m.totalHojeCentavos) },
      { label: 'Ticket médio', value: formatCentavos(m.ticketMedioCentavos) },
    ];

    return `
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        ${cards
          .map(
            (c) => `
          <div class="flex flex-col items-center p-2.5 rounded-lg bg-card border border-border">
            <span class="text-lg font-bold text-foreground">${c.value}</span>
            <span class="text-[10px] text-muted-foreground/60 uppercase tracking-wider">${c.label}</span>
          </div>
        `
          )
          .join('')}
      </div>
    `;
  }

  // ── Lista de pedidos ──

  private renderLista(): string {
    if (this.vm?.kind !== 'ready') return '';
    const { pedidos } = this.vm;

    if (pedidos.length === 0) {
      return `
        <div class="text-center py-6 text-xs text-muted-foreground/60">
          ${this.vm.busca ? `Nenhum pedido encontrado para "${this.escapeHtml(this.vm.busca)}".` : 'Nenhum pedido neste filtro.'}
        </div>
      `;
    }

    return `
      <div class="flex flex-col gap-2">
        ${pedidos.map((p) => this.renderCard(p)).join('')}
      </div>
    `;
  }

  private renderCard(p: PedidoCardVm): string {
    const isExpanded = this.expandedOrderId === p.orderId;
    const chip = STATUS_CHIP[p.status] || STATUS_CHIP.draft;

    const collapsed = `
      <div class="pedidos-card flex items-center gap-2 p-2.5 rounded-lg bg-card border border-border cursor-pointer hover:bg-card/80 transition-colors" data-order-id="${p.orderId}">
        <span class="font-mono text-xs font-bold text-foreground whitespace-nowrap">PED-${String(p.numeroSequencial).padStart(4, '0')}</span>
        <span class="text-[10px] px-1.5 py-0.5 rounded-full ${chip.cls}">${chip.label}</span>
        <span class="text-xs font-medium text-foreground truncate flex-1 min-w-0">${this.escapeHtml(p.clienteNome)}</span>
        <span class="text-[10px] text-muted-foreground/50 whitespace-nowrap">${this.escapeHtml(p.itensResumo.length > 30 ? p.itensResumo.slice(0, 28) + '...' : p.itensResumo)}</span>
        <span class="text-[10px] text-muted-foreground/40 whitespace-nowrap">${formatIso(p.updatedAtIso)}</span>
        <span class="font-mono text-xs font-medium text-foreground tabular-nums whitespace-nowrap">${formatCentavos(p.totalCentavos)}</span>
      </div>
    `;

    if (!isExpanded) return collapsed;

    const itens = p.itens
      .map(
        (i: PedidoCardVm['itens'][0]) => `
        <div class="flex items-center justify-between py-0.5">
          <span class="text-xs">
            <span class="font-mono text-muted-foreground/60">${i.quantidade}×</span>
            <span class="text-foreground ml-1">${this.escapeHtml(i.nome)}</span>
          </span>
          <span class="font-mono text-xs tabular-nums text-foreground">${formatCentavos(i.precoTotalCentavos)}</span>
        </div>
      `
      )
      .join('');

    const funilEtapas = ['produto', 'endereco', 'pagamento', 'prazo', 'fechar'] as const;
    const funilOk = funilEtapas.filter((e) => p.funil[e].estado === 'ok').length;
    const funilHtml = funilEtapas
      .map((e) => {
        const ok = p.funil[e].estado === 'ok';
        return `<span class="text-[10px] ${ok ? 'text-green-400' : 'text-muted-foreground/40'}">${ok ? '●' : '○'} ${e.charAt(0).toUpperCase() + e.slice(1)}</span>`;
      })
      .join(' ');

    const progressoPct = Math.round((funilOk / 5) * 100);

    const timeline = p.timeline
      .slice(0, 5)
      .map((t) => {
        const time = formatIso(t.iso);
        const de = t.statusAnterior || 'criação';
        const para = t.statusNovo;
        const motivo = t.motivo ? `<br><span class="text-[10px] text-muted-foreground/40">${this.escapeHtml(t.motivo)}</span>` : '';
        return `<div class="text-[10px] text-muted-foreground/60">${time} ${de} → ${para}${motivo}</div>`;
      })
      .join('');

    const obsHtml = p.observacoes
      ? `<div class="text-[10px] text-muted-foreground/60 italic mt-1">Obs: "${this.escapeHtml(p.observacoes)}"</div>`
      : '';

    const pagamentoHtml = p.pagamentoStatus
      ? `<div class="text-[10px] text-muted-foreground/60 mt-1">Pagamento: ${p.pagamentoStatus}${p.pagamentoMetodo ? ` · ${p.pagamentoMetodo}` : ''}</div>`
      : '';

    const canComplete = p.status === 'awaiting_payment';
    const canCancel = p.status === 'draft' || p.status === 'open';
    const canDeliver = p.status === 'open' || p.status === 'awaiting_payment';
    const hasAddress = p.funil.endereco.estado === 'ok' && !!p.funil.endereco.valor;

    const actions = [
      canComplete ? `<button class="pedidos-action-btn text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30" data-action="pedido:complete" data-order-id="${p.orderId}">Marcar como pago</button>` : '',
      canCancel ? `<button class="pedidos-action-btn text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20" data-action="pedido:cancel" data-order-id="${p.orderId}">Cancelar</button>` : '',
      `<button class="pedidos-action-btn text-[10px] px-2 py-0.5 rounded-full bg-muted/20 text-muted-foreground border border-muted/20 hover:bg-muted/40" data-action="pedido:open-atendimento" data-order-id="${p.orderId}" data-chat-id="${this.escapeHtml(p.chatId)}">🔄 Abrir atendimento →</button>`,
    ]
      .filter(Boolean)
      .join(' ');

    const expanded = `
      <div class="pedidos-card p-3 rounded-lg bg-card border border-brand/30">
        <div class="flex items-center gap-2 mb-2 cursor-pointer" data-order-id="${p.orderId}">
          <span class="font-mono text-sm font-bold text-foreground">PED-${String(p.numeroSequencial).padStart(4, '0')}</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded-full ${chip.cls}">${chip.label}</span>
          <span class="text-xs text-muted-foreground/40 ml-auto">${formatIso(p.createdAtIso)}</span>
        </div>
        <div class="flex items-center gap-2 mb-2 text-xs text-muted-foreground/60">
          <span>Cliente: ${this.escapeHtml(p.clienteNome)}</span>
        </div>
        <div class="flex flex-col gap-1.5 mb-2">
          <span class="text-[10px] uppercase tracking-wider text-muted-foreground/40">Itens</span>
          ${itens}
          <div class="border-t border-border/50 mt-1 pt-1 flex flex-col gap-0.5">
            <span class="font-mono text-xs tabular-nums text-foreground text-right">Subtotal: ${formatCentavos(p.itens.reduce((s, i) => s + i.precoTotalCentavos, 0))}</span>
            <span class="font-mono text-xs tabular-nums text-foreground text-right">Total: ${formatCentavos(p.totalCentavos)}</span>
          </div>
        </div>
        <div class="flex flex-col gap-1 mb-2">
          <span class="text-[10px] uppercase tracking-wider text-muted-foreground/40">Funil</span>
          <div class="flex flex-wrap gap-1.5">${funilHtml}</div>
          <div class="h-1 rounded-full bg-muted/20 mt-0.5">
            <div class="h-1 rounded-full bg-green-500/50" style="width:${progressoPct}%"></div>
          </div>
          <span class="text-[10px] text-muted-foreground/40">${progressoPct}%</span>
        </div>
        ${timeline ? `<div class="mb-2"><span class="text-[10px] uppercase tracking-wider text-muted-foreground/40">Timeline</span>${timeline}</div>` : ''}
        ${obsHtml}
        ${pagamentoHtml}
        <div class="flex gap-1.5 mt-2 pt-2 border-t border-border/50">
          ${actions}
        </div>

        ${canDeliver && hasAddress ? `
        <div class="mt-2 pt-2 border-t border-border/50">
          <div class="flex items-center gap-1 mb-1.5">
            <span class="text-[10px] uppercase tracking-wider text-muted-foreground/40">🚚 Entrega</span>
          </div>
          <div class="text-[10px] text-muted-foreground/60 mb-1.5 truncate" title="${this.escapeHtml(p.funil.endereco.valor || '')}">
            ${this.escapeHtml(p.funil.endereco.valor || '')}
          </div>
          <div class="flex gap-1.5">
            <button class="pedidos-action-btn text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30" data-action="delivery:quote" data-order-id="${p.orderId}" data-endereco="${this.escapeHtml(p.funil.endereco.valor || '')}">
              🐝 Cotar frete
            </button>
            <button class="pedidos-action-btn text-[10px] px-2 py-0.5 rounded-full bg-brand/20 text-brand border border-brand/30 hover:bg-brand/30 hidden bee-order-btn" data-action="delivery:order" data-order-id="${p.orderId}">
              🐝 Chamar motoboy
            </button>
          </div>
          <div class="bee-delivery-info text-[10px] text-muted-foreground/40 mt-1"></div>
        </div>
        ` : ''}
      </div>
    `;

    return collapsed + expanded;
  }

  private renderFooter(): string {
    return `
      <div class="text-center">
        <span class="text-[10px] text-muted-foreground/30">
          M&oacute;dulo Pedidos · MVP
        </span>
      </div>
    `;
  }

  // ── Event binding ──

  private bindEvents(): void {
    if (!this.container) return;

    // Filtro chips
    this.container.querySelectorAll<HTMLElement>('.pedidos-filtro-chip').forEach((el) => {
      el.addEventListener('click', () => {
        const filtro = el.dataset.filtro as FiltroStatus | undefined;
        if (filtro) this.onAction?.('filtro:change', { filtro });
      });
    });

    // Busca
    const buscaInput = this.container.querySelector<HTMLInputElement>('.pedidos-busca');
    if (buscaInput) {
      buscaInput.addEventListener('input', () => {
        if (this.inputDelay) clearTimeout(this.inputDelay);
        this.inputDelay = setTimeout(() => {
          this.onAction?.('busca:change', { busca: buscaInput.value });
        }, 300);
      });
      // Preservar foco
      if (this.vm?.kind === 'ready' && this.vm.busca) {
        buscaInput.focus();
        buscaInput.setSelectionRange(buscaInput.value.length, buscaInput.value.length);
      }
    }

    // Cards (colapsar/expandir)
    this.container.querySelectorAll<HTMLElement>('.pedidos-card[data-order-id]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button')) return; // não interceptar cliques em botões
        const orderId = el.dataset.orderId;
        if (orderId) {
          this.expandedOrderId = this.expandedOrderId === orderId ? null : orderId;
          this.onAction?.('pedido:toggle', { orderId: this.expandedOrderId });
        }
      });
    });

    // Botões de ação no detalhe
    this.container.querySelectorAll<HTMLElement>('.pedidos-action-btn').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = el.dataset.action;
        const orderId = el.dataset.orderId;
        const chatId = el.dataset.chatId;
        const endereco = el.dataset.endereco;
        const frete = el.dataset.frete;
        if (action && orderId) {
          this.onAction?.(action, { orderId, chatId, endereco, frete });
        }
      });
    });
  }

  private bindRetry(): void {
    if (!this.container) return;
    const btn = this.container.querySelector<HTMLElement>('.pedidos-btn-retry');
    if (btn) {
      btn.addEventListener('click', () => this.onAction?.('retry'));
    }
  }

  private escapeHtml(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
}
