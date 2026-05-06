import type { OportunidadesPreviewVm } from './view-model';

type ActionHandler = (actionId: string, payload?: unknown) => void;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class OportunidadesPreviewPanel {
  private container: HTMLElement | null = null;
  private vm: OportunidadesPreviewVm | null = null;
  private onAction: ActionHandler | null = null;

  constructor(params: { onAction?: ActionHandler } = {}) {
    this.onAction = params.onAction ?? null;
  }

  public render(vm: OportunidadesPreviewVm): HTMLElement {
    this.vm = vm;
    const root = document.createElement('div');
    root.className = 'flex flex-col gap-2 text-[11px] leading-tight';
    this.container = root;
    this.renderContent();
    this.bindListeners();
    return root;
  }

  public update(vm: OportunidadesPreviewVm): void {
    this.vm = vm;
    this.renderContent();
    this.bindListeners();
  }

  public destroy(): void {
    if (this.container) this.container.innerHTML = '';
    this.container = null;
    this.vm = null;
  }

  private bindListeners(): void {
    if (!this.container) return;
    const recalc = this.container.querySelector('[data-action="oportunidades:recalc"]');
    recalc?.addEventListener('click', () => {
      if (!this.onAction || !this.vm) return;
      const chatId = (this.container?.querySelector('[data-field="chatId"]') as HTMLInputElement)?.value ?? this.vm.chatId;
      const clienteTexto =
        (this.container?.querySelector('[data-field="clienteTexto"]') as HTMLTextAreaElement)?.value ?? this.vm.clienteTexto;
      const aderenciaRaw = (this.container?.querySelector('[data-field="aderencia"]') as HTMLInputElement)?.value ?? '';
      const aderencia = Math.min(1, Math.max(0, Number(aderenciaRaw.replace(',', '.')) || 0));
      this.onAction('oportunidades:recalc', { chatId, clienteTexto, aderenciaScore: aderencia });
    });
  }

  private renderContent(): void {
    if (!this.container || !this.vm) return;
    const { result: r, loadError, isLoading } = this.vm;
    const campCount = r?.context.campanhasAtivasElegiveis.length ?? 0;
    const vitrineCount = r?.context.vitrine.recomendacoes.length ?? '—';

    const topRows =
      r?.opportunitiesRanked.slice(0, 8).map(
        o => `
        <tr class="border-b border-border/40">
          <td class="py-1 pr-2 align-top">${escapeHtml(o.sku)}</td>
          <td class="py-1 pr-2 align-top truncate max-w-[120px]" title="${escapeHtml(o.titulo)}">${escapeHtml(o.titulo)}</td>
          <td class="py-1 pr-2 align-top">${o.rankingScore.toFixed(3)}</td>
          <td class="py-1 align-top text-muted-foreground">${o.campanhaId ? escapeHtml(o.campanhaId) : '—'}</td>
        </tr>`,
      ) ?? [];

    const suggestionBlock =
      r?.suggestion != null
        ? `
      <div class="glass-subtle rounded-xl p-2.5 space-y-2">
        <div class="text-[10px] font-semibold text-foreground">Sugestão (só cópia humana)</div>
        <div class="rounded-lg bg-muted/30 px-2 py-1.5 text-[11px] whitespace-pre-wrap">${escapeHtml(r.suggestion.textoSugerido)}</div>
        <div class="text-[10px] text-muted-foreground">${escapeHtml(r.suggestion.explicacaoCurta)}</div>
        <div class="text-[9px] text-amber-600/90">Guardrails: requireHumanSend=true, autoSendAllowed=false</div>
      </div>`
        : `<div class="text-[10px] text-muted-foreground">Sem sugestão (nenhuma oportunidade ranqueada).</div>`;

    this.container.innerHTML = `
      <div class="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-100">
        <strong>Aba Simulador</strong> (dentro de Campanhas) — ranqueia ofertas usando as campanhas <em>ativas</em> (incluindo tipo <em>Oportunidade hiperlocal</em>). Ainda <em>não</em> ligado ao Atendimento/Retomar — é um videogame de treino antes do WhatsApp real.
      </div>

      <div class="glass-subtle rounded-xl p-2.5 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-semibold text-foreground">Ofertas ranqueadas</div>
            <div class="text-[10px] text-muted-foreground">Campanhas elegíveis agora: ${campCount} · Itens vitrine: ${vitrineCount}</div>
          </div>
          <button
            type="button"
            data-action="oportunidades:recalc"
            class="h-8 px-3 rounded-xl bg-primary text-primary-foreground text-[11px] font-medium glow-hover ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}"
            ${isLoading ? 'disabled' : ''}
          >${isLoading ? 'Calculando...' : 'Recalcular'}</button>
        </div>
        ${
          loadError
            ? `<div class="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">${escapeHtml(loadError)}</div>`
            : ''
        }
        <label class="block text-[10px] text-muted-foreground">chatId (simulado)</label>
        <input data-field="chatId" class="w-full rounded-lg border border-border bg-background px-2 py-1 text-[11px]" value="${escapeHtml(this.vm.chatId)}" />
        <label class="block text-[10px] text-muted-foreground">Texto do cliente (última mensagem)</label>
        <textarea data-field="clienteTexto" rows="3" class="w-full rounded-lg border border-border bg-background px-2 py-1 text-[11px] resize-y">${escapeHtml(this.vm.clienteTexto)}</textarea>
        <label class="block text-[10px] text-muted-foreground">Aderência 0–1 (preview)</label>
        <input data-field="aderencia" type="number" step="0.05" min="0" max="1" class="w-full rounded-lg border border-border bg-background px-2 py-1 text-[11px]" value="${escapeHtml(String(this.vm.aderenciaScore))}" />
      </div>

      ${suggestionBlock}

      <div class="glass-subtle rounded-xl p-2.5 overflow-x-auto">
        <div class="text-[10px] font-semibold text-foreground mb-1">Top oportunidades</div>
        <table class="w-full text-[10px]">
          <thead>
            <tr class="text-left text-muted-foreground border-b border-border/60">
              <th class="pb-1 pr-2">SKU</th>
              <th class="pb-1 pr-2">Título</th>
              <th class="pb-1 pr-2">Score</th>
              <th class="pb-1">Campanha</th>
            </tr>
          </thead>
          <tbody>${topRows.join('')}</tbody>
        </table>
      </div>
    `;
  }
}
