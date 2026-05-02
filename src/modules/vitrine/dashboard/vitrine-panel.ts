import type { VitrineCanal, VitrineDashboardViewModel, VitrineRecomendacaoVm } from './view-model';

type ActionHandler = (actionId: string, payload?: unknown) => void;

function formatDateHour(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatPrice(cents: number | null): string {
  if (cents == null) return '—';
  return `R$ ${(cents / 100).toFixed(2)}`;
}

export class VitrinePanel {
  private container: HTMLElement | null = null;
  private vm: VitrineDashboardViewModel | null = null;
  private onAction: ActionHandler | null = null;
  private canalAtivo: VitrineCanal = 'whatsapp';
  private showJson = false;
  private isLoading = false;
  private loadError: string | null = null;

  constructor(params: { onAction?: ActionHandler } = {}) {
    this.onAction = params.onAction ?? null;
  }

  public async render(vm: VitrineDashboardViewModel): Promise<HTMLElement> {
    this.vm = vm;
    const root = document.createElement('div');
    root.className = 'flex flex-col gap-2 text-[11px] leading-tight';
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

  public setLoading(isLoading: boolean): void {
    this.isLoading = isLoading;
    this.renderContent();
    this.bindListeners();
  }

  public setError(message: string | null): void {
    this.loadError = message;
    this.renderContent();
    this.bindListeners();
  }

  public setCanalAtivo(canal: VitrineCanal): void {
    this.canalAtivo = canal;
    this.renderContent();
    this.bindListeners();
  }

  private getFilteredRecomendacoes(): VitrineRecomendacaoVm[] {
    if (!this.vm) return [];
    return this.vm.recomendacoes.filter((item) => item.canais.includes(this.canalAtivo));
  }

  private renderContent(): void {
    if (!this.container || !this.vm) return;
    const rows = this.getFilteredRecomendacoes();
    const activeLabel = this.vm.canais.find((c) => c.id === this.canalAtivo)?.label ?? this.canalAtivo;

    this.container.innerHTML = `
      <div class="glass-subtle rounded-xl p-2.5">
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="text-xs font-semibold text-foreground">${this.escapeHtml(this.vm.title)}</div>
          <div class="text-[10px] text-muted-foreground truncate">Conta: ${this.escapeHtml(this.vm.accountName)}</div>
        </div>
        <button
          type="button"
          class="h-8 px-3 rounded-xl bg-primary text-primary-foreground text-[11px] font-medium glow-hover ${this.isLoading ? 'opacity-60 cursor-not-allowed' : ''}"
          data-action="vitrine:refresh"
          ${this.isLoading ? 'disabled' : ''}
        >
          ${this.isLoading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>
      ${
        this.loadError
          ? `<div class="mt-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">${this.escapeHtml(
              this.loadError,
            )}</div>`
          : ''
      }
      </div>

      <div class="glass-subtle rounded-xl px-2 py-2">
        <div class="flex items-center gap-1 overflow-x-auto pb-1">
          ${this.vm.canais
            .map((canal) => {
              const active = canal.id === this.canalAtivo;
              const cls = active
                ? 'bg-primary text-primary-foreground border-primary/50'
                : 'bg-secondary/20 text-foreground border-border/30';
              return `
                <button
                  type="button"
                  class="h-7 px-2.5 rounded-full border text-[11px] whitespace-nowrap ${cls}"
                  data-action="vitrine:set-channel"
                  data-channel="${canal.id}"
                >
                  ${this.escapeHtml(canal.label)}
                </button>
              `;
            })
            .join('')}
        </div>
        <div class="mt-1 text-[10px] text-muted-foreground">
          Canal ativo: <span class="text-foreground font-medium">${this.escapeHtml(activeLabel)}</span>
        </div>
      </div>

      <div class="glass-subtle rounded-xl p-1.5">
        ${
          rows.length === 0
            ? `<div class="p-3 text-xs text-muted-foreground">Nenhuma recomendação para este canal.</div>`
            : `
              <div class="flex flex-col gap-1.5">
                ${rows.map((item, idx) => this.renderRecommendationCard(item, idx + 1)).join('')}
              </div>
            `
        }
      </div>

      <div class="glass-subtle rounded-xl px-2.5 py-2">
        <div class="flex items-center justify-between gap-2">
          <div class="text-[10px] text-muted-foreground">
            Gerado: ${this.escapeHtml(formatDateHour(this.vm.generatedAtIso))} · Motor: ${this.escapeHtml(this.vm.version)}
          </div>
          <button
            type="button"
            class="h-7 px-2 rounded-lg border border-border/30 bg-secondary/20 text-[10px] text-foreground"
            data-action="vitrine:toggle-json"
          >
            ${this.showJson ? 'Ocultar JSON' : 'Ver JSON'}
          </button>
        </div>
        ${
          this.vm.warnings.length > 0
            ? `<div class="mt-1 text-[10px] text-amber-600">Warnings: ${this.escapeHtml(this.vm.warnings.join(' | '))}</div>`
            : ''
        }
        ${
          this.showJson
            ? `<pre class="mt-2 rounded-lg border border-border/30 bg-secondary/10 p-2 text-[10px] text-foreground max-h-56 overflow-auto whitespace-pre-wrap">${this.escapeHtml(
                JSON.stringify(this.vm, null, 2),
              )}</pre>`
            : ''
        }
      </div>
    `;
  }

  private renderRecommendationCard(item: VitrineRecomendacaoVm, rank: number): string {
    const motivos = item.motivos
      .map(
        (motivo) => `
      <span class="inline-flex items-center rounded-lg border border-border/30 bg-secondary/20 px-1.5 py-0.5 text-[9px] text-muted-foreground">
        ${this.escapeHtml(motivo)}
      </span>`,
      )
      .join('');

    return `
      <div class="rounded-xl border border-border/25 bg-background/70 p-2">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="text-[10px] text-muted-foreground">#${rank} · <span class="font-mono">${this.escapeHtml(item.skuId)}</span></div>
            <div class="text-[12px] font-semibold text-foreground truncate">${this.escapeHtml(item.nome)}</div>
          </div>
          <span class="inline-flex shrink-0 items-center rounded-lg border border-primary/35 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            ${item.score.toFixed(1)}
          </span>
        </div>
        <div class="mt-1.5 flex flex-wrap gap-1">
          ${motivos}
        </div>
        <div class="mt-1.5 grid grid-cols-3 gap-1.5 text-[10px]">
          <div class="rounded-lg border border-border/25 bg-secondary/15 px-1.5 py-1">
            <div class="text-muted-foreground">Validade</div>
            <div class="text-foreground">${this.escapeHtml(formatDateHour(item.validUntilIso))}</div>
          </div>
          <div class="rounded-lg border border-border/25 bg-secondary/15 px-1.5 py-1">
            <div class="text-muted-foreground">Preço ref</div>
            <div class="text-foreground">${this.escapeHtml(formatPrice(item.precoRef))}</div>
          </div>
          <div class="rounded-lg border border-border/25 bg-secondary/15 px-1.5 py-1">
            <div class="text-muted-foreground">Estoque ref</div>
            <div class="text-foreground">${item.estoqueRef == null ? '—' : String(item.estoqueRef)}</div>
          </div>
        </div>
      </div>
    `;
  }

  private bindListeners(): void {
    if (!this.container) return;

    const refreshBtn = this.container.querySelector('[data-action="vitrine:refresh"]') as HTMLButtonElement | null;
    refreshBtn?.addEventListener('click', () => this.onAction?.('vitrine:refresh'));

    const channelButtons = Array.from(
      this.container.querySelectorAll('[data-action="vitrine:set-channel"]'),
    ) as HTMLButtonElement[];
    channelButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const channel = btn.getAttribute('data-channel') as VitrineCanal | null;
        if (!channel) return;
        this.onAction?.('vitrine:set-channel', { channel });
      });
    });

    const toggleJsonBtn = this.container.querySelector('[data-action="vitrine:toggle-json"]') as HTMLButtonElement | null;
    toggleJsonBtn?.addEventListener('click', () => {
      this.showJson = !this.showJson;
      this.onAction?.('vitrine:toggle-json', { visible: this.showJson });
      this.renderContent();
      this.bindListeners();
    });
  }

  private escapeHtml(value: string): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

