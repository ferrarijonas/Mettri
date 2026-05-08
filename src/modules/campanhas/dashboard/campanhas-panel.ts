import type { CampaignStatus, CampaignType } from '../types';
import { TIPO_LABELS } from './provider';
import type { CampanhasDashboardVm, CampanhasEditorVm } from './view-model';

type ActionHandler = (actionId: string, payload?: unknown) => void;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/`/g, '&#96;');
}

const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: 'Rascunho',
  active: 'Ativa',
  paused: 'Pausada',
  ended: 'Encerrada',
};

export class CampanhasPanel {
  private root: HTMLElement | null = null;
  private listaPane: HTMLElement | null = null;
  private simuladorHost: HTMLElement | null = null;
  private vm: CampanhasDashboardVm | null = null;
  private onAction: ActionHandler | null = null;

  constructor(params: { onAction?: ActionHandler } = {}) {
    this.onAction = params.onAction ?? null;
  }

  public getSimuladorHost(): HTMLElement | null {
    return this.simuladorHost;
  }

  public render(vm: CampanhasDashboardVm): HTMLElement {
    this.vm = vm;
    this.root = document.createElement('div');
    this.root.className = 'flex flex-col gap-2 text-[11px] leading-tight';

    const tabBar = document.createElement('div');
    tabBar.className = 'flex gap-1 p-0.5 rounded-xl bg-secondary/20';
    tabBar.innerHTML = `
      <button type="button" data-action="campanhas:tab" data-tab="lista" class="flex-1 h-8 rounded-lg text-[11px] font-medium ${
        vm.activeTab === 'lista' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary/40'
      }">Campanhas</button>
      <button type="button" data-action="campanhas:tab" data-tab="simulador" class="flex-1 h-8 rounded-lg text-[11px] font-medium ${
        vm.activeTab === 'simulador' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary/40'
      }">Simulador (ofertas)</button>
    `;

    this.listaPane = document.createElement('div');
    this.listaPane.className = vm.activeTab === 'lista' ? 'flex flex-col gap-2' : 'hidden';

    const simPane = document.createElement('div');
    simPane.className = vm.activeTab === 'simulador' ? 'flex flex-col gap-2 min-h-[120px]' : 'hidden';
    this.simuladorHost = document.createElement('div');
    this.simuladorHost.className = 'flex flex-col gap-2';
    simPane.appendChild(this.simuladorHost);

    this.root.appendChild(tabBar);
    this.root.appendChild(this.listaPane);
    this.root.appendChild(simPane);

    this.renderListaContent();
    this.bindRootListeners(tabBar);
    return this.root;
  }

  public update(vm: CampanhasDashboardVm): void {
    this.vm = vm;
    if (!this.root || !this.listaPane) return;

    const tabBar = this.root.querySelector('[data-action="campanhas:tab"]')?.parentElement;
    if (tabBar) {
      tabBar.querySelectorAll('[data-action="campanhas:tab"]').forEach(btn => {
        const t = (btn as HTMLElement).dataset.tab;
        const active = t === vm.activeTab;
        btn.className = `flex-1 h-8 rounded-lg text-[11px] font-medium ${
          active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary/40'
        }`;
      });
    }

    const panes = this.root.children;
    const listaEl = panes[1] as HTMLElement;
    const simEl = panes[2] as HTMLElement;
    if (listaEl) listaEl.className = vm.activeTab === 'lista' ? 'flex flex-col gap-2' : 'hidden';
    if (simEl) simEl.className = vm.activeTab === 'simulador' ? 'flex flex-col gap-2 min-h-[120px]' : 'hidden';

    this.renderListaContent();
  }

  private renderListaContent(): void {
    if (!this.listaPane || !this.vm) return;
    const vm = this.vm;
    const { editor } = vm;

    const tipoOptions = (Object.keys(TIPO_LABELS) as CampaignType[])
      .map(
        t =>
          `<option value="${t}" ${t === editor.tipo ? 'selected' : ''}>${escapeHtml(TIPO_LABELS[t])}</option>`,
      )
      .join('');

    const rows =
      vm.items.length === 0
        ? `<div class="p-3 text-xs text-muted-foreground">Nenhuma campanha ainda. Crie uma abaixo.</div>`
        : vm.items
            .map(item => {
              const sel = editor.mode === 'edit' && editor.campaignId === item.campaignId;
              return `
          <button type="button" data-action="campanhas:select" data-id="${escapeAttr(item.campaignId)}"
            class="w-full text-left rounded-xl border px-2 py-1.5 mb-1 ${
              sel ? 'border-primary/60 bg-primary/10' : 'border-border/30 bg-background/60 hover:bg-secondary/20'
            }">
            <div class="font-semibold text-foreground truncate">${escapeHtml(item.nome)}</div>
            <div class="text-[10px] text-muted-foreground">${escapeHtml(item.tipoLabel)} · ${escapeHtml(item.modo)} ·
              <span class="${
                item.status === 'active'
                  ? 'text-emerald-600'
                  : item.status === 'paused'
                    ? 'text-amber-600'
                    : item.status === 'ended'
                      ? 'text-zinc-500'
                      : ''
              }">${escapeHtml(STATUS_LABEL[item.status])}</span>
            </div>
          </button>`;
            })
            .join('');

    const opErr = vm.operationError
      ? `<div class="rounded-xl border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-destructive">${escapeHtml(vm.operationError)}</div>`
      : '';
    const listErr = vm.listError
      ? `<div class="rounded-xl border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-destructive">${escapeHtml(vm.listError)}</div>`
      : '';

    const id = editor.campaignId ?? '';
    const statusActions =
      editor.mode === 'edit' && id
        ? `
      <div class="flex flex-wrap gap-1 mt-2">
        <button type="button" data-action="campanhas:status" data-status="active" data-id="${escapeAttr(id)}"
          class="h-7 px-2 rounded-lg bg-emerald-600/90 text-white text-[10px]">Ativar</button>
        <button type="button" data-action="campanhas:status" data-status="paused" data-id="${escapeAttr(id)}"
          class="h-7 px-2 rounded-lg bg-amber-600/90 text-white text-[10px]">Pausar</button>
        <button type="button" data-action="campanhas:status" data-status="ended" data-id="${escapeAttr(id)}"
          class="h-7 px-2 rounded-lg bg-zinc-600/90 text-white text-[10px]">Encerrar</button>
      </div>`
        : '';

    this.listaPane.innerHTML = `
      <div class="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-100">
        <strong>Preview local</strong> — campanhas guardadas na extensão. O tipo <em>Oportunidade hiperlocal</em> é uma campanha como as outras; o <strong>Simulador</strong> mostra como o motor ranqueia ofertas (ainda sem plug no Atendimento).
      </div>
      ${opErr}
      ${listErr}
      <div class="flex items-center justify-between gap-2">
        <div class="text-xs font-semibold text-foreground">Lista</div>
        <div class="flex gap-1">
          <button type="button" data-action="campanhas:refresh" class="h-8 px-2 rounded-xl border border-border/40 text-[11px]">Atualizar</button>
          <button type="button" data-action="campanhas:new" class="h-8 px-3 rounded-xl bg-primary text-primary-foreground text-[11px] font-medium">Nova</button>
        </div>
      </div>
      <div class="rounded-xl border border-border/30 bg-secondary/10 p-1.5 max-h-[220px] overflow-y-auto">${rows}</div>

      <div class="glass-subtle rounded-xl p-2.5 space-y-2 border border-border/30">
        <div class="text-[10px] font-semibold text-foreground">
          ${editor.mode === 'new' ? 'Nova campanha' : `Editar · ${escapeHtml(STATUS_LABEL[editor.status])}`}
        </div>
        <label class="block text-[9px] text-muted-foreground">Nome</label>
        <input data-editor="nome" class="w-full h-8 rounded-lg border border-border bg-background px-2 text-[11px]" value="${escapeAttr(editor.nome)}" />
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[9px] text-muted-foreground">Tipo</label>
            <select data-editor="tipo" class="w-full h-8 rounded-lg border border-border bg-background px-1 text-[11px]">${tipoOptions}</select>
          </div>
          <div>
            <label class="block text-[9px] text-muted-foreground">Modo</label>
            <select data-editor="modo" class="w-full h-8 rounded-lg border border-border bg-background px-1 text-[11px]">
              <option value="always_on" ${editor.modo === 'always_on' ? 'selected' : ''}>Sempre ligada</option>
              <option value="periodo" ${editor.modo === 'periodo' ? 'selected' : ''}>Período</option>
            </select>
          </div>
        </div>
        <div data-editor-periodo class="${editor.modo === 'periodo' ? '' : 'hidden'} space-y-1">
          <label class="block text-[9px] text-muted-foreground">Janela (início / fim)</label>
          <div class="grid grid-cols-2 gap-1">
            <input data-editor="janelaStart" type="datetime-local" class="w-full h-8 rounded-lg border border-border bg-background px-1 text-[10px]" value="${escapeAttr(editor.janelaStart)}" />
            <input data-editor="janelaEnd" type="datetime-local" class="w-full h-8 rounded-lg border border-border bg-background px-1 text-[10px]" value="${escapeAttr(editor.janelaEnd)}" />
          </div>
          <input data-editor="timezone" class="w-full h-7 rounded-lg border border-border bg-background px-2 text-[10px]" placeholder="Timezone" value="${escapeAttr(editor.timezone)}" />
        </div>
        <label class="block text-[9px] text-muted-foreground">Objetivo</label>
        <textarea data-editor="objetivo" rows="2" class="w-full rounded-lg border border-border bg-background px-2 py-1 text-[11px] resize-y">${escapeHtml(editor.objetivo)}</textarea>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[9px] text-muted-foreground">Prioridade 0–1</label>
            <input data-editor="prioridade" type="text" class="w-full h-8 rounded-lg border border-border bg-background px-2 text-[11px]" value="${escapeAttr(editor.prioridadeText)}" />
          </div>
          <div>
            <label class="block text-[9px] text-muted-foreground">Estoque mín. (giro)</label>
            <input data-editor="estoqueMin" type="text" class="w-full h-8 rounded-lg border border-border bg-background px-2 text-[11px]" value="${escapeAttr(editor.estoqueMinText)}" />
          </div>
        </div>
        <label class="block text-[9px] text-muted-foreground">SKUs alvo (vírgula; vazio = todos)</label>
        <input data-editor="skus" class="w-full h-8 rounded-lg border border-border bg-background px-2 text-[11px]" value="${escapeAttr(editor.skusText)}" />
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[9px] text-muted-foreground">Dedup (horas)</label>
            <input data-editor="dedupe" type="number" min="0" class="w-full h-8 rounded-lg border border-border bg-background px-2 text-[11px]" value="${escapeAttr(editor.dedupeHours)}" />
          </div>
          <div>
            <label class="block text-[9px] text-muted-foreground">Máx envios / período</label>
            <input data-editor="maxSends" type="number" min="1" class="w-full h-8 rounded-lg border border-border bg-background px-2 text-[11px]" value="${escapeAttr(editor.maxSends)}" />
          </div>
        </div>
        ${statusActions}
        <button type="button" data-action="campanhas:save" class="w-full h-9 rounded-xl bg-primary text-primary-foreground text-[11px] font-medium">
          Salvar
        </button>
      </div>
    `;

    this.bindListaListeners();
  }

  private collectEditorFromDom(): CampanhasEditorVm | null {
    const pane = this.listaPane;
    if (!pane || !this.vm) return null;
    const e = this.vm.editor;
    const q = (name: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null =>
      pane.querySelector(`[data-editor="${name}"]`);
    const nome = (q('nome') as HTMLInputElement)?.value ?? '';
    const tipoRaw = (q('tipo') as HTMLSelectElement)?.value ?? e.tipo;
    const tipo: CampaignType = tipoRaw in TIPO_LABELS ? (tipoRaw as CampaignType) : e.tipo;
    const modo = (q('modo') as HTMLSelectElement)?.value as CampanhasEditorVm['modo'];
    return {
      ...e,
      nome,
      tipo,
      modo,
      objetivo: (q('objetivo') as HTMLTextAreaElement)?.value ?? '',
      prioridadeText: (q('prioridade') as HTMLInputElement)?.value ?? '0.5',
      skusText: (q('skus') as HTMLInputElement)?.value ?? '',
      estoqueMinText: (q('estoqueMin') as HTMLInputElement)?.value ?? '',
      janelaStart: (q('janelaStart') as HTMLInputElement)?.value ?? '',
      janelaEnd: (q('janelaEnd') as HTMLInputElement)?.value ?? '',
      timezone: (q('timezone') as HTMLInputElement)?.value ?? 'America/Sao_Paulo',
      dedupeHours: (q('dedupe') as HTMLInputElement)?.value ?? '24',
      maxSends: (q('maxSends') as HTMLInputElement)?.value ?? '3',
    };
  }

  private bindRootListeners(tabBar: HTMLElement): void {
    tabBar.querySelectorAll('[data-action="campanhas:tab"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = (btn as HTMLElement).dataset.tab as 'lista' | 'simulador';
        this.onAction?.('campanhas:tab', { tab });
      });
    });
  }

  private bindListaListeners(): void {
    if (!this.listaPane) return;
    this.listaPane.querySelectorAll('[data-action="campanhas:select"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.id;
        if (id) this.onAction?.('campanhas:select', { campaignId: id });
      });
    });
    this.listaPane.querySelector('[data-action="campanhas:new"]')?.addEventListener('click', () => {
      this.onAction?.('campanhas:new');
    });
    this.listaPane.querySelector('[data-action="campanhas:refresh"]')?.addEventListener('click', () => {
      this.onAction?.('campanhas:refresh');
    });
    this.listaPane.querySelector('[data-action="campanhas:save"]')?.addEventListener('click', () => {
      const editor = this.collectEditorFromDom();
      if (editor) this.onAction?.('campanhas:save', { editor });
    });
    this.listaPane.querySelectorAll('[data-action="campanhas:status"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const status = (btn as HTMLElement).dataset.status as CampaignStatus;
        const id = (btn as HTMLElement).dataset.id;
        if (id && status) this.onAction?.('campanhas:status', { campaignId: id, status });
      });
    });

    const modoSel = this.listaPane.querySelector('[data-editor="modo"]') as HTMLSelectElement | null;
    const periodoBlock = this.listaPane.querySelector('[data-editor-periodo]') as HTMLElement | null;
    modoSel?.addEventListener('change', () => {
      if (!periodoBlock) return;
      periodoBlock.classList.toggle('hidden', modoSel.value !== 'periodo');
    });
  }

  public destroy(): void {
    this.root = null;
    this.listaPane = null;
    this.simuladorHost = null;
    this.vm = null;
    this.onAction = null;
  }
}
