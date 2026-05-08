export interface DirectoryClientDraft {
  clientKey: string;
  phoneDigits: string;
  aliasesDigits?: string[];
  whatsAppChatId?: string;
  firstName: string;
  lastName: string;
  nickname: string;
  address: string;
  whatsAppCandidateName?: string;
  nameSource?: 'manual' | 'import' | 'whatsapp';
  updatedAtIso: string;
  preferenciasProduto?: string[];
  aversoesProduto?: string[];
  formaPagamentoPreferida?: string[];
  enderecoEntrega?: string;
  urgenciaEntrega?: string;
  observacoesLogisticas?: string[];
  preferenciasLogistica?: string[];
}

import type { EventBus } from '../../../ui/core/event-bus';
import { emitPanelNavigate } from '../../../ui/core/panel-navigation';
import { classifyNameCandidate } from '../name-likelihood';
import type { ImportFileType, ImportMapping, ParsedTable } from '../import/import-engine';
import { parseFileToTable, inferMappingFromHeaders, mapTableToCanonicalClients, getPreviewByMapping } from '../import/import-engine';
import { LocalHeuristicsSuggester, McpSuggester } from '../import/mapping-suggester';
import { mergeCanonicalClientsIntoClientDB } from '../import/merge-into-clientdb';

function digitsOnly(input: string): string {
  return String(input || '').replace(/\D+/g, '');
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizePhoneDigitsWithAliases(input: string): { phoneDigits: string; aliasesDigits: string[] } {
  const phoneDigits = digitsOnly(input);
  const aliases = new Set<string>();
  if (phoneDigits) aliases.add(phoneDigits);

  // Heurística BR mínima: com/sem “9” após DDD quando começa com 55
  if (phoneDigits.startsWith('55') && phoneDigits.length >= 12 && phoneDigits.length <= 13) {
    const ddi = '55';
    const ddd = phoneDigits.slice(2, 4);
    const rest = phoneDigits.slice(4);

    if (rest.length === 9 && rest.startsWith('9')) {
      aliases.add(`${ddi}${ddd}${rest.slice(1)}`);
    }
    if (rest.length === 8) {
      aliases.add(`${ddi}${ddd}9${rest}`);
    }
  }

  return { phoneDigits, aliasesDigits: Array.from(aliases) };
}

function applyCandidateToClient(params: {
  candidate: string;
  client: DirectoryClientDraft;
}): void {
  const { candidate, client } = params;
  const classified = classifyNameCandidate(candidate);

  // Você preferiu: empresa -> Apelido, pessoa -> Nome/Sobrenome, dúvida -> vazio
  if (classified.kind === 'person') {
    if (!client.firstName) client.firstName = classified.firstName;
    if (!client.lastName && classified.lastName) client.lastName = classified.lastName;
    if (!client.nameSource) client.nameSource = 'whatsapp';
    return;
  }

  if (classified.kind === 'business') {
    if (!client.nickname) client.nickname = classified.nickname;
    if (!client.nameSource) client.nameSource = 'whatsapp';
    return;
  }
}

function displayName(c: DirectoryClientDraft): string {
  const parts = [c.firstName?.trim(), c.lastName?.trim()].filter(Boolean);
  const full = parts.join(' ').trim();
  if (full) return full;
  if (c.nickname?.trim()) return c.nickname.trim();
  return c.phoneDigits ? `+${c.phoneDigits}` : 'Sem nome';
}

interface ImportWizardState {
  file: File;
  type: ImportFileType;
  table: ParsedTable;
  mapping: ImportMapping;
  suggested: ImportMapping;
  overwrite: boolean;
  saveProfile: boolean;
  profileId?: string;
  error?: string;
  result?: { created: number; updated: number; skippedNoIdentity: number; nameApplied?: number; nameRejected?: number };
  running?: boolean;
}

export class ClientesDirectoryPanel {
  private container: HTMLElement | null = null;
  private currentClientKey: string | null = null;
  private searchQuery = '';
  private importWizard: ImportWizardState | null = null;
  private eventBus: EventBus;

  private clients: DirectoryClientDraft[] = [];
  private isLoaded = false;
  private openedFromPendingKey = false;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  public async render(): Promise<HTMLElement> {
    const root = document.createElement('div');
    root.className = 'flex flex-col gap-4';
    this.container = root;
    await this.ensureLoaded();
    this.renderListView();
    const pendingKey = String(this.eventBus.data.pendingClientKey || '').trim();
    if (pendingKey) {
      delete this.eventBus.data.pendingClientKey;
      this.openedFromPendingKey = true;
      this.openClient(pendingKey);
    }
    return root;
  }

  public destroy(): void {
    if (this.container) this.container.innerHTML = '';
    this.container = null;
    this.currentClientKey = null;
    this.searchQuery = '';
  }

  private renderListView(): void {
    if (!this.container) return;

    const filtered = this.filterClients();

    this.container.innerHTML = `
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="text-sm font-semibold text-foreground">Cadastro</div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <button type="button" class="h-9 px-3 rounded-xl border border-border/30 bg-secondary/20 text-xs text-foreground" data-action="export">
            Exportar
          </button>
          <button type="button" class="h-9 px-3 rounded-xl border border-border/30 bg-secondary/20 text-xs text-foreground" data-action="import">
            Importar
          </button>
          <button type="button" class="h-9 px-3 rounded-xl border border-destructive/50 bg-destructive/10 text-destructive text-xs" data-action="reset" title="Limpar todo o cadastro (ClientDB)">
            Resetar
          </button>
          <button type="button" class="h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-medium" data-action="new">
          Novo
          </button>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <input
          type="text"
          class="h-10 w-full rounded-xl border border-border/30 bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground"
          placeholder="Buscar por nome ou telefone"
          value="${this.escapeHtml(this.searchQuery)}"
          data-field="search"
        />
        <button type="button" class="h-10 px-3 rounded-xl border border-border/30 bg-secondary/20 text-xs text-foreground" data-action="clear">
          Limpar
        </button>
      </div>

      <div class="rounded-xl border border-border/30 bg-secondary/10 p-2">
        ${filtered.length === 0 ? this.renderEmptyList() : this.renderClientList(filtered)}
      </div>

      <div class="flex items-center justify-between text-[11px] text-muted-foreground">
        <div>${filtered.length} cliente(s)</div>
        <div></div>
      </div>
    `;

    this.wireListListeners();
  }

  private renderEmptyList(): string {
    return `
      <div class="p-3">
        <div class="text-xs font-medium text-foreground">Sem clientes ainda</div>
        <div class="mt-1 text-[11px] text-muted-foreground">
          Clique em “Novo” para cadastrar.
        </div>
      </div>
    `;
  }

  private renderClientList(items: DirectoryClientDraft[]): string {
    const rows = items
      .slice(0, 200)
      .map((c) => {
        const title = displayName(c);
        const subtitle = c.phoneDigits ? `+${c.phoneDigits}` : 'Sem telefone';
        return `
          <button
            type="button"
            class="w-full text-left rounded-xl px-3 py-2 hover:bg-secondary/20 transition-colors"
            data-action="open"
            data-client-key="${this.escapeHtml(c.clientKey)}"
          >
            <div class="text-xs font-medium text-foreground">${this.escapeHtml(title)}</div>
            <div class="text-[11px] text-muted-foreground">${this.escapeHtml(subtitle)}</div>
          </button>
        `;
      })
      .join('');

    return `<div class="flex flex-col gap-1">${rows}</div>`;
  }

  private wireListListeners(): void {
    if (!this.container) return;

    const searchInput = this.container.querySelector('[data-field="search"]') as HTMLInputElement | null;
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.searchQuery = searchInput.value || '';
        this.renderListView();
      });
    }

    const newBtn = this.container.querySelector('[data-action="new"]') as HTMLButtonElement | null;
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        const draft = this.createNewDraft();
        this.clients.unshift(draft);
        this.openClient(draft.clientKey);
      });
    }

    const importBtn = this.container.querySelector('[data-action="import"]') as HTMLButtonElement | null;
    if (importBtn) {
      importBtn.addEventListener('click', async () => {
        await this.openImportWizard();
      });
    }

    const exportBtn = this.container.querySelector('[data-action="export"]') as HTMLButtonElement | null;
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        await this.exportClients();
      });
    }

    const resetBtn = this.container.querySelector('[data-action="reset"]') as HTMLButtonElement | null;
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        const ok = window.confirm('Resetar todo o cadastro? Todos os clientes serão removidos. Esta ação não pode ser desfeita.');
        if (!ok) return;
        try {
          const { clientDB } = await import('../../../storage/client-db');
          await clientDB.reset();
          this.isLoaded = false;
          this.clients = [];
          this.currentClientKey = null;
          this.renderListView();
        } catch (e) {
          console.error('[ClientesDirectoryPanel] Erro ao resetar:', e);
          window.alert('Erro ao resetar. Verifique o console.');
        }
      });
    }

    const clearBtn = this.container.querySelector('[data-action="clear"]') as HTMLButtonElement | null;
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.searchQuery = '';
        this.renderListView();
      });
    }

    const openButtons = Array.from(this.container.querySelectorAll('[data-action="open"]')) as HTMLButtonElement[];
    openButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-client-key');
        if (key) this.openClient(key);
      });
    });
  }

  private openClient(clientKey: string): void {
    this.currentClientKey = clientKey;
    this.renderDetailView();
  }

  private renderDetailView(): void {
    if (!this.container) return;

    const client = this.clients.find((c) => c.clientKey === this.currentClientKey) || null;
    if (!client) {
      this.currentClientKey = null;
      this.renderListView();
      return;
    }

    // Se ainda não temos nome, tentar derivar automaticamente do “crachá” (quando for confiável).
    if (!client.firstName && !client.lastName && client.whatsAppCandidateName) {
      const before = `${client.firstName}|${client.lastName}|${client.nickname}`;
      applyCandidateToClient({ candidate: client.whatsAppCandidateName, client });
      const after = `${client.firstName}|${client.lastName}|${client.nickname}`;
      if (before !== after) {
        client.updatedAtIso = nowIso();
        this.persistClient(client).catch(() => {});
      }
    }

    const suggested = client.whatsAppCandidateName?.trim();

    this.container.innerHTML = `
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <button type="button" class="h-9 px-3 rounded-xl border border-border/30 bg-secondary/20 text-xs text-foreground" data-action="back">
          Voltar
        </button>
        <div class="flex items-center gap-2">
          <button type="button" class="h-9 px-3 rounded-xl border border-destructive/50 bg-destructive/10 text-destructive text-xs" data-action="reset" title="Limpar todo o cadastro (ClientDB)">
            Resetar
          </button>
          <button type="button" class="h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-medium" data-action="save">
            Salvar
          </button>
        </div>
      </div>

      <div class="rounded-xl border border-border/30 bg-secondary/10 p-3">
        <div class="text-xs font-medium text-foreground">Dados do cliente</div>
        <div class="mt-3 grid grid-cols-2 gap-2">
          ${this.renderInput('Nome', 'firstName', client.firstName)}
          ${this.renderInput('Sobrenome', 'lastName', client.lastName)}
          <div class="col-span-2">${this.renderInput('Apelido', 'nickname', client.nickname)}</div>
          <div class="col-span-2">${this.renderInput('Telefone (somente números)', 'phoneDigits', client.phoneDigits)}</div>
          <div class="col-span-2">${this.renderTextarea('Endereço', 'address', client.address)}</div>
        </div>
      </div>

      <div class="rounded-xl border border-border/30 bg-secondary/10 p-3">
        <div class="text-xs font-medium text-foreground">Perfil Operacional</div>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <div class="col-span-2">${this.renderInput('Preferências produto', 'preferenciasProduto', this.formatArray(client.preferenciasProduto))}</div>
          <div class="col-span-2">${this.renderInput('Aversões', 'aversoesProduto', this.formatArray(client.aversoesProduto))}</div>
          <div class="col-span-2">${this.renderInput('Forma de pagamento', 'formaPagamentoPreferida', this.formatArray(client.formaPagamentoPreferida))}</div>
          <div class="col-span-2">${this.renderInput('Endereço de entrega', 'enderecoEntrega', client.enderecoEntrega || '')}</div>
          <div>${this.renderUrgenciaSelect('Urgência', 'urgenciaEntrega', client.urgenciaEntrega || '')}</div>
          <div>${this.renderInput('Prefs. logística', 'preferenciasLogistica', this.formatArray(client.preferenciasLogistica))}</div>
          <div class="col-span-2">${this.renderTextarea('Observações logísticas', 'observacoesLogisticas', this.formatArray(client.observacoesLogisticas))}</div>
        </div>
      </div>

      <div class="rounded-xl border border-border/30 bg-secondary/10 p-3">
        <div class="text-xs font-medium text-foreground">Nome do WhatsApp (crachá)</div>
        <div class="mt-1 text-[11px] text-muted-foreground">
          Sugestão fraca: pode estar errado. Se estiver estranho, a gente ignora no envio.
        </div>
        <div class="mt-2 text-xs text-foreground">
          ${suggested ? this.escapeHtml(suggested) : '<span class="text-muted-foreground">Sem sugestão</span>'}
        </div>
      </div>

      <div class="rounded-xl border border-border/30 bg-secondary/10 p-3">
        <div class="flex items-center justify-between">
          <div class="text-xs font-medium text-foreground">Compras Registradas</div>
          <button type="button" class="h-7 px-2 rounded-lg border border-border/30 bg-secondary/20 text-[10px] text-foreground" data-action="mapear-compras">
            Mapear compras
          </button>
        </div>
        <div class="mt-2 text-[11px] text-muted-foreground" id="compras-list">
          Carregando compras...
        </div>
      </div>
    `;

    this.wireDetailListeners(client.clientKey);
    this.loadClientPurchases(client.clientKey);
  }

  private renderImportWizard(): void {
    if (!this.container) return;
    const state = this.importWizard;
    if (!state) return;

    const headers = state.table.headers || [];
    const rows = state.table.rows || [];
    const _sampleRows = rows.slice(0, 8);
    const _sampleCols = headers.slice(0, 6);

    // Cálculo simples de impacto: quantas linhas têm identidade (telefone/email) segundo o mapeamento atual.
    const totalRows = rows.length;
    let withIdentity = 0;
    let withoutIdentity = 0;
    if (totalRows > 0 && headers.length > 0) {
      try {
        const canonicalPreview = mapTableToCanonicalClients({
          table: state.table,
          mapping: state.mapping,
          filename: state.file.name,
          importedAtIso: new Date().toISOString(),
          profileId: state.profileId,
          maxRows: totalRows,
        });
        withIdentity = canonicalPreview.length;
        withoutIdentity = Math.max(0, totalRows - withIdentity);
      } catch {
        // Se der erro na prévia, não bloquear o wizard; os números ficam em zero.
      }
    }

    const hasNameMapping =
      typeof state.mapping.fullName === 'number' ||
      typeof state.mapping.firstName === 'number' ||
      typeof state.mapping.lastName === 'number';
    const hasPhone = typeof state.mapping.phone === 'number' || typeof state.mapping.phoneAlt === 'number';
    const disabledImport =
      state.running === true ||
      !!state.error ||
      !headers.length ||
      !hasPhone;

    this.container.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <button type="button" class="h-9 px-3 rounded-xl border border-border/30 bg-secondary/20 text-xs text-foreground" data-action="import-cancel">
          Voltar
        </button>
        <button type="button" class="h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed" data-action="import-run" ${
          disabledImport ? 'disabled' : ''
        }>
          ${state.running ? 'Importando...' : 'Importar'}
        </button>
      </div>

      <div class="rounded-xl border border-border/30 bg-secondary/10 p-3">
        <div class="text-xs font-medium text-foreground">Importar clientes</div>
        <div class="mt-1 text-[11px] text-muted-foreground">
          Arquivo: <span class="text-foreground/80">${this.escapeHtml(state.file.name)}</span>
          • Linhas: <span class="text-foreground/80">${rows.length}</span>
        </div>
        ${
          totalRows > 0
            ? `<div class="mt-1 text-[11px] text-muted-foreground">
                Serão considerados <span class="text-foreground/80">${withIdentity}</span> de <span class="text-foreground/80">${totalRows}</span> registro(s) (com telefone ou email mapeados).
              </div>
              ${
                withoutIdentity > 0
                  ? `<div class="mt-1 text-[11px] text-amber-600">
                      ${withoutIdentity} registro(s) serão ignorados porque não têm telefone nem email válidos.
                    </div>`
                  : ''
              }`
            : ''
        }
        ${
          state.error
            ? `<div class="mt-2 text-[11px] text-destructive">${this.escapeHtml(state.error)}</div>`
            : ''
        }
        ${
          !hasNameMapping && !state.result
            ? `<div class="mt-2 text-[11px] text-amber-600">Nenhum campo de nome mapeado. Os registros serão criados apenas com telefone.</div>`
            : ''
        }
        ${
          state.result
            ? `<div class="mt-2 text-[11px] text-foreground/80">
                Resultado: ${state.result.created} novo(s), ${state.result.updated} atualizado(s), ${state.result.skippedNoIdentity} pulado(s) sem telefone/email.
                ${typeof state.result.nameApplied === 'number' ? ` • ${state.result.nameApplied} com nome aplicado` : ''}
                ${(state.result.nameRejected ?? 0) > 0 ? ` • ${state.result.nameRejected} com nome via fallback` : ''}
              </div>`
            : ''
        }
      </div>

      <div class="rounded-xl border border-border/30 bg-secondary/10 p-3">
        <div class="text-xs font-medium text-foreground">Mapeamento (o que cada coluna significa)</div>
        <div class="mt-2 grid grid-cols-2 gap-2">
          ${this.renderMappingSelect('Telefone (obrigatório)', 'phone', headers, state.mapping.phone)}
          ${this.renderMappingSelect('Telefone 2 (fallback)', 'phoneAlt', headers, state.mapping.phoneAlt)}
          ${this.renderMappingSelect('Nome completo', 'fullName', headers, state.mapping.fullName)}
          ${this.renderMappingSelect('Nome', 'firstName', headers, state.mapping.firstName)}
          ${this.renderMappingSelect('Sobrenome', 'lastName', headers, state.mapping.lastName)}
          ${this.renderMappingSelect('Apelido/Empresa', 'nickname', headers, state.mapping.nickname)}
          ${this.renderMappingSelect('Email', 'email', headers, state.mapping.email)}
          <div class="col-span-2">
            ${this.renderMappingSelect('Endereço (texto livre)', 'addressFreeform', headers, state.mapping.addressFreeform)}
          </div>
        </div>

        <div class="mt-3 flex items-center justify-between gap-3">
          <label class="flex items-start gap-2 text-[11px] text-muted-foreground">
            <input type="checkbox" data-field="import-overwrite" class="mt-[2px] accent-primary" ${state.overwrite ? 'checked' : ''} />
            <span>
              <span class="block">Sobrescrever dados já preenchidos</span>
              <span class="block text-[10px] text-muted-foreground/90">
                Nomes e endereços existentes podem ser trocados pelos dados deste arquivo. Use só se tiver certeza de que o arquivo está mais confiável do que o cadastro atual.
              </span>
            </span>
          </label>
          <label class="flex items-center gap-2 text-[11px] text-muted-foreground">
            <input type="checkbox" data-field="import-save-profile" class="accent-primary" ${state.saveProfile ? 'checked' : ''} />
            Salvar perfil deste arquivo
          </label>
        </div>
      </div>

      <div class="rounded-xl border border-border/30 bg-secondary/10 p-3 overflow-x-auto">
        <div class="text-xs font-medium text-foreground">Prévia por campo mapeado</div>
        <div class="mt-1 text-[11px] text-muted-foreground">Valores que irão para cada campo (primeiras 5 linhas)</div>
        <div class="mt-2 space-y-2">
          ${(() => {
            if (headers.length === 0) return '<div class="text-[11px] text-muted-foreground">Não consegui ler cabeçalho/colunas.</div>';
            const preview = getPreviewByMapping({ table: state.table, mapping: state.mapping, maxRows: 5 });
            const entries: [string, string[]][] = [['Telefone', preview['Telefone'] || []], ['Nome completo', preview['Nome completo'] || []], ['Nome', preview['Nome'] || []], ['Sobrenome', preview['Sobrenome'] || []], ['Apelido', preview['Apelido'] || []], ['Endereço', preview['Endereço'] || []], ['Email', preview['Email'] || []]];
            return entries
              .filter(([, v]) => Array.isArray(v) && v.length > 0)
              .map(([label, vals]) => `<div class="text-[11px]"><span class="font-medium text-muted-foreground">${this.escapeHtml(label)}</span> → ${vals.map(v => this.escapeHtml(v)).join(', ')}</div>`)
              .join('') || '<div class="text-[11px] text-muted-foreground">Mapeie ao menos Telefone para ver a prévia.</div>';
          })()}
        </div>
      </div>
    `;

    this.wireImportWizardListeners();
  }

  private renderMappingSelect(
    label: string,
    field: keyof ImportMapping,
    headers: string[],
    selected: unknown
  ): string {
    const selectedIndex = typeof selected === 'number' ? selected : -1;
    const options = ['<option value="-1">—</option>']
      .concat(
        headers.map((h, idx) => `<option value="${idx}" ${idx === selectedIndex ? 'selected' : ''}>${this.escapeHtml(h)}</option>`)
      )
      .join('');

    return `
      <label class="flex flex-col gap-1">
        <span class="text-[11px] text-muted-foreground">${this.escapeHtml(label)}</span>
        <select class="h-10 rounded-xl border border-border/30 bg-background px-3 text-xs text-foreground" data-field="map-${this.escapeHtml(String(field))}">
          ${options}
        </select>
      </label>
    `;
  }

  private wireImportWizardListeners(): void {
    if (!this.container) return;
    if (!this.importWizard) return;

    const cancelBtn = this.container.querySelector('[data-action="import-cancel"]') as HTMLButtonElement | null;
    cancelBtn?.addEventListener('click', () => {
      this.importWizard = null;
      this.renderListView();
    });

    const overwrite = this.container.querySelector('[data-field="import-overwrite"]') as HTMLInputElement | null;
    overwrite?.addEventListener('change', () => {
      if (!this.importWizard) return;
      this.importWizard.overwrite = overwrite.checked === true;
    });

    const saveProfile = this.container.querySelector('[data-field="import-save-profile"]') as HTMLInputElement | null;
    saveProfile?.addEventListener('change', () => {
      if (!this.importWizard) return;
      this.importWizard.saveProfile = saveProfile.checked === true;
    });

    const onMappingChange = (field: keyof ImportMapping, value: number) => {
      if (!this.importWizard) return;
      if (value < 0) {
        delete (this.importWizard.mapping as any)[field];
      } else {
        (this.importWizard.mapping as any)[field] = value;
      }
      this.renderImportWizard();
    };

    const mapFields: (keyof ImportMapping)[] = [
      'phone',
      'phoneAlt',
      'fullName',
      'firstName',
      'lastName',
      'nickname',
      'email',
      'addressFreeform',
    ];

    for (const f of mapFields) {
      const el = this.container.querySelector(`[data-field="map-${String(f)}"]`) as HTMLSelectElement | null;
      if (!el) continue;
      el.addEventListener('change', () => {
        const idx = Number(el.value);
        onMappingChange(f, idx);
      });
    }

    const runBtn = this.container.querySelector('[data-action="import-run"]') as HTMLButtonElement | null;
    runBtn?.addEventListener('click', () => {
      this.runImportWizard().catch(() => {});
    });
  }

  private async openImportWizard(): Promise<void> {
    if (!this.container) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept =
      '.csv,.tsv,.xlsx,.json,.vcf,text/csv,text/plain,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    input.style.display = 'none';

    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;

      try {
        const parsed = await parseFileToTable(file);
        const table = parsed.table;

        // Se não conseguimos ler o XLSX, orientar a exportar como CSV/TSV.
        if (parsed.type === 'xlsx' && (!table.headers || table.headers.length === 0)) {
          this.importWizard = {
            file,
            type: parsed.type,
            table,
            mapping: {},
            suggested: {},
            overwrite: false,
            saveProfile: false,
            error: 'Não consegui ler esse XLSX aqui. Exporte como CSV/TSV e tente novamente.',
          };
          this.renderImportWizard();
          return;
        }

        // 1) sugestão via MCP (opcional) → se não vier, cair para heurística local
        let suggested: ImportMapping = {};
        try {
          const cfg = await chrome.storage.local.get(['mettri_import_mcp_enabled']);
          const mcpEnabled = cfg?.mettri_import_mcp_enabled === true;
          if (mcpEnabled) {
            const mcp = new McpSuggester({ enabled: true });
            const res = await mcp.suggest(table);
            if (res?.mapping) suggested = res.mapping;
          }
        } catch {
          // ignore
        }

        if (Object.keys(suggested).length === 0) {
          const local = new LocalHeuristicsSuggester();
          suggested =
            (await local.suggest(table))?.mapping ??
            inferMappingFromHeaders(table.headers).suggested;
        }

        // 2) tentar carregar perfil salvo pelo “signature” de headers
        const signature = (table.headers || []).map(h => h.trim().toLowerCase()).join('|');
        const profileKey = `mettri_import_profile_v1_${signature}`;
        let mapping: ImportMapping = { ...suggested };
        let profileId: string | undefined;

        try {
          const stored = await chrome.storage.local.get([profileKey]);
          const raw = stored?.[profileKey] as unknown;
          if (raw && typeof raw === 'object') {
            const rec = raw as Record<string, unknown>;
            if (rec.mapping && typeof rec.mapping === 'object') {
              mapping = rec.mapping as ImportMapping;
              profileId = String(rec.profileId || '');
            }
          }
        } catch {
          // ignore
        }

        this.importWizard = {
          file,
          type: parsed.type,
          table,
          suggested,
          mapping,
          overwrite: false,
          saveProfile: true,
          profileId: profileId || undefined,
        };

        this.renderImportWizard();
      } catch (error) {
        this.importWizard = {
          file,
          type: 'unknown',
          table: { headers: [], rows: [] },
          mapping: {},
          suggested: {},
          overwrite: false,
          saveProfile: false,
          error: error instanceof Error ? error.message : String(error),
        };
        this.renderImportWizard();
      }
    });

    document.body.appendChild(input);
    input.click();
    setTimeout(() => {
      try {
        document.body.removeChild(input);
      } catch {
        // ignore
      }
    }, 0);
  }

  private async runImportWizard(): Promise<void> {
    if (!this.importWizard) return;
    const state = this.importWizard;
    if (state.running) return;

    const hasPhone = typeof state.mapping.phone === 'number' || typeof state.mapping.phoneAlt === 'number';
    if (!hasPhone) {
      this.importWizard.error = 'Selecione ao menos uma coluna de Telefone.';
      this.renderImportWizard();
      return;
    }

    this.importWizard.running = true;
    this.importWizard.error = undefined;
    this.importWizard.result = undefined;
    this.renderImportWizard();

    try {
      const importedAtIso = new Date().toISOString();

      const canonical = mapTableToCanonicalClients({
        table: state.table,
        mapping: state.mapping,
        filename: state.file.name,
        importedAtIso,
        profileId: state.profileId,
      });

      const result = await mergeCanonicalClientsIntoClientDB({
        clients: canonical,
        options: { overwrite: state.overwrite },
      });

      // Salvar perfil (mapeamento) por assinatura de headers
      if (state.saveProfile) {
        try {
          const signature = (state.table.headers || []).map(h => h.trim().toLowerCase()).join('|');
          const profileKey = `mettri_import_profile_v1_${signature}`;
          await chrome.storage.local.set({
            [profileKey]: {
              version: 1,
              profileId: state.profileId || signature.slice(0, 24),
              mapping: state.mapping,
              savedAtIso: importedAtIso,
            },
          });
        } catch {
          // ignore
        }
      }

      this.importWizard.result = result;
      this.importWizard.running = false;

      // Recarregar lista e manter wizard aberto para exibir resultado
      this.isLoaded = false;
      await this.ensureLoaded();
      this.renderImportWizard();
    } catch (error) {
      const w = this.importWizard;
      if (!w) return;
      w.error = error instanceof Error ? error.message : String(error);
      w.running = false;
      this.renderImportWizard();
    }
  }

  private wireDetailListeners(clientKey: string): void {
    if (!this.container) return;

    const backBtn = this.container.querySelector('[data-action="back"]') as HTMLButtonElement | null;
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (this.openedFromPendingKey) {
          this.openedFromPendingKey = false;
          emitPanelNavigate(this.eventBus, 'atendimento.dashboard');
        } else {
          this.currentClientKey = null;
          this.renderListView();
        }
      });
    }

    const resetBtn = this.container.querySelector('[data-action="reset"]') as HTMLButtonElement | null;
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        const ok = window.confirm('Resetar todo o cadastro? Todos os clientes serão removidos. Esta ação não pode ser desfeita.');
        if (!ok) return;
        try {
          const { clientDB } = await import('../../../storage/client-db');
          await clientDB.reset();
          this.isLoaded = false;
          this.clients = [];
          this.currentClientKey = null;
          this.renderListView();
        } catch (e) {
          console.error('[ClientesDirectoryPanel] Erro ao resetar:', e);
          window.alert('Erro ao resetar. Verifique o console.');
        }
      });
    }

    const saveBtn = this.container.querySelector('[data-action="save"]') as HTMLButtonElement | null;
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.saveFromForm(clientKey);
      });
    }

    const mapearBtn = this.container.querySelector('[data-action="mapear-compras"]') as HTMLButtonElement | null;
    if (mapearBtn) {
      mapearBtn.addEventListener('click', () => {
        emitPanelNavigate(this.eventBus, 'cadastro.purchase-mapping');
      });
    }
  }

  private saveFromForm(clientKey: string): void {
    if (!this.container) return;
    const client = this.clients.find((c) => c.clientKey === clientKey);
    if (!client) return;

    const firstName = this.readInputValue('firstName');
    const lastName = this.readInputValue('lastName');
    const nickname = this.readInputValue('nickname');
    const phoneDigitsRaw = this.readInputValue('phoneDigits');
    const address = this.readInputValue('address');

    const normalized = normalizePhoneDigitsWithAliases(phoneDigitsRaw);
    const phoneDigits = normalized.phoneDigits;
    const aliasesDigits = normalized.aliasesDigits;

    client.firstName = firstName;
    client.lastName = lastName;
    client.nickname = nickname;
    client.nameSource = 'manual';
    client.phoneDigits = phoneDigits;
    client.aliasesDigits = aliasesDigits;
    client.address = address;
    client.updatedAtIso = nowIso();

    client.preferenciasProduto = this.parseListField('preferenciasProduto');
    client.aversoesProduto = this.parseListField('aversoesProduto');
    client.formaPagamentoPreferida = this.parseListField('formaPagamentoPreferida');
    client.enderecoEntrega = this.readInputValue('enderecoEntrega');
    client.urgenciaEntrega = this.readSelectValue('urgenciaEntrega');
    client.observacoesLogisticas = this.parseListField('observacoesLogisticas');
    client.preferenciasLogistica = this.parseListField('preferenciasLogistica');

    if (phoneDigits && client.clientKey !== phoneDigits) {
      const existing = this.clients.find((c) => c.clientKey === phoneDigits);
      if (!existing) {
        client.clientKey = phoneDigits;
        this.currentClientKey = phoneDigits;
      }
    }

    this.persistClient(client).catch(() => {});

    this.renderDetailView();
  }

  private parseListField(field: string): string[] | undefined {
    const value = this.readInputValue(field);
    if (!value.trim()) return undefined;
    return value.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  }

  private readSelectValue(field: string): string {
    if (!this.container) return '';
    const el = this.container.querySelector(`[data-field="${field}"]`) as HTMLSelectElement | null;
    return el ? String(el.value || '').trim() : '';
  }

  private readInputValue(field: string): string {
    if (!this.container) return '';
    const el = this.container.querySelector(`[data-field="${field}"]`) as HTMLInputElement | HTMLTextAreaElement | null;
    return el ? String(el.value || '').trim() : '';
  }

  private renderInput(label: string, field: string, value: string): string {
    return `
      <label class="flex flex-col gap-1">
        <span class="text-[11px] text-muted-foreground">${this.escapeHtml(label)}</span>
        <input
          type="text"
          class="h-10 rounded-xl border border-border/30 bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground"
          data-field="${this.escapeHtml(field)}"
          value="${this.escapeHtml(value || '')}"
        />
      </label>
    `;
  }

  private renderUrgenciaSelect(label: string, field: string, value: string): string {
    const options = [
      { value: '', label: '—' },
      { value: 'baixa', label: 'Baixa' },
      { value: 'normal', label: 'Normal' },
      { value: 'alta', label: 'Alta' },
    ];
    const optionsHtml = options
      .map((o) => `<option value="${o.value}" ${o.value === value ? 'selected' : ''}>${o.label}</option>`)
      .join('');
    return `
      <label class="flex flex-col gap-1">
        <span class="text-[11px] text-muted-foreground">${this.escapeHtml(label)}</span>
        <select
          class="h-10 rounded-xl border border-border/30 bg-background px-3 text-xs text-foreground"
          data-field="${this.escapeHtml(field)}"
        >
          ${optionsHtml}
        </select>
      </label>
    `;
  }

  private formatArray(value: string[] | undefined): string {
    if (!Array.isArray(value) || value.length === 0) return '';
    return value.join(', ');
  }

  private renderTextarea(label: string, field: string, value: string): string {
    return `
      <label class="flex flex-col gap-1">
        <span class="text-[11px] text-muted-foreground">${this.escapeHtml(label)}</span>
        <textarea
          class="min-h-[84px] rounded-xl border border-border/30 bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground"
          data-field="${this.escapeHtml(field)}"
        >${this.escapeHtml(value || '')}</textarea>
      </label>
    `;
  }

  private createNewDraft(): DirectoryClientDraft {
    const key = `draft-${Date.now()}`;
    return {
      clientKey: key,
      phoneDigits: '',
      aliasesDigits: [],
      firstName: '',
      lastName: '',
      nickname: '',
      address: '',
      updatedAtIso: nowIso(),
      preferenciasProduto: undefined,
      aversoesProduto: undefined,
      formaPagamentoPreferida: undefined,
      enderecoEntrega: undefined,
      urgenciaEntrega: undefined,
      observacoesLogisticas: undefined,
      preferenciasLogistica: undefined,
    };
  }

  private filterClients(): DirectoryClientDraft[] {
    const q = (this.searchQuery || '').trim().toLowerCase();
    if (!q) return [...this.clients];

    return this.clients.filter((c) => {
      const hay = [
        displayName(c),
        c.phoneDigits,
        c.nickname,
        c.whatsAppCandidateName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return hay.includes(q);
    });
  }

  private escapeHtml(value: string): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private async ensureLoaded(): Promise<void> {
    if (this.isLoaded) return;
    this.isLoaded = true;

    try {
      const { clientDB } = await import('../../../storage/client-db');
      let all = await clientDB.listAll(10000);

      // Se ainda não existe “Cadastro”, pré-popular a partir do histórico (MessageDB).
      // Metáfora: criar RGs básicos a partir do “crachá” que já apareceu nas conversas.
      if (all.length === 0) {
        const wid = clientDB.getCurrentUserWid() || 'default';
        const bootstrapKey = `mettri_clientdb_bootstrap_v1_${wid}`;

        let shouldBootstrap = true;
        try {
          const stored = await chrome.storage.local.get([bootstrapKey]);
          shouldBootstrap = stored?.[bootstrapKey] !== true;
        } catch {
          shouldBootstrap = true;
        }

        if (shouldBootstrap) {
          try {
            const { messageDB } = await import('../../../storage/message-db');
            const lastIncomingByContact = await messageDB.getLastIncomingByContact();

            const batch: Promise<void>[] = [];
            const flush = async () => {
              if (batch.length === 0) return;
              await Promise.allSettled(batch.splice(0, batch.length));
            };

            for (const v of lastIncomingByContact.values()) {
              const phone = String(v.chatId || '').replace('@c.us', '');
              const normalized = normalizePhoneDigitsWithAliases(phone);
              if (!normalized.phoneDigits) continue;

              const draft: DirectoryClientDraft = {
                clientKey: normalized.phoneDigits,
                phoneDigits: normalized.phoneDigits,
                aliasesDigits: normalized.aliasesDigits,
                whatsAppChatId: v.chatId,
                firstName: '',
                lastName: '',
                nickname: '',
                address: '',
                whatsAppCandidateName: v.chatName,
                nameSource: 'whatsapp',
                updatedAtIso: nowIso(),
              };

              applyCandidateToClient({ candidate: v.chatName, client: draft });

              batch.push(
                clientDB.upsert({
                  clientKey: draft.clientKey,
                  phoneDigits: draft.phoneDigits,
                  aliasesDigits: draft.aliasesDigits,
                  whatsAppChatId: draft.whatsAppChatId,
                  whatsAppCandidateName: draft.whatsAppCandidateName,
                  firstName: draft.firstName || undefined,
                  lastName: draft.lastName || undefined,
                  nickname: draft.nickname || undefined,
                  nameSource: draft.nameSource,
                  updatedAtIso: draft.updatedAtIso,
                })
              );

              if (batch.length >= 50) {
                // Não travar a UI com lotes muito grandes
                // (Promise.allSettled é “caravana”: um erro não para o resto).
                 
                await flush();
              }
            }

            await flush();

            try {
              await chrome.storage.local.set({ [bootstrapKey]: true });
            } catch {
              // ignore
            }
          } catch (error) {
            console.warn('[ClientesDirectoryPanel] Falha no bootstrap via MessageDB:', error);
          }
        }

        all = await clientDB.listAll(10000);
      }

      // Enriquecer registros já existentes: se ainda não tem nome, tentar derivar do “crachá”
      const enrichBatch: Promise<void>[] = [];
      const flushEnrich = async () => {
        if (enrichBatch.length === 0) return;
        await Promise.allSettled(enrichBatch.splice(0, enrichBatch.length));
      };

      for (const r of all) {
        const hasName =
          !!(r.firstName && String(r.firstName).trim()) ||
          !!(r.lastName && String(r.lastName).trim()) ||
          !!(r.nickname && String(r.nickname).trim());
        const candidate = (r.whatsAppCandidateName || '').trim();
        if (hasName || !candidate) continue;

        // Aplicar a mesma regra (Pessoa -> Nome/Sobrenome; Empresa -> Apelido)
        const draft: DirectoryClientDraft = {
          clientKey: r.clientKey,
          phoneDigits: r.phoneDigits || '',
          aliasesDigits: r.aliasesDigits || [],
          whatsAppChatId: r.whatsAppChatId,
          firstName: r.firstName || '',
          lastName: r.lastName || '',
          nickname: r.nickname || '',
          address: r.address || '',
          whatsAppCandidateName: r.whatsAppCandidateName,
          nameSource: 'whatsapp',
          updatedAtIso: nowIso(),
        };

        const before = `${draft.firstName}|${draft.lastName}|${draft.nickname}`;
        applyCandidateToClient({ candidate, client: draft });
        const after = `${draft.firstName}|${draft.lastName}|${draft.nickname}`;
        if (before === after) continue;

        enrichBatch.push(
          clientDB.upsert({
            ...r,
            firstName: draft.firstName || undefined,
            lastName: draft.lastName || undefined,
            nickname: draft.nickname || undefined,
            nameSource: draft.nameSource,
            updatedAtIso: nowIso(),
          })
        );

        if (enrichBatch.length >= 50) {
           
          await flushEnrich();
        }
      }

      await flushEnrich();

      // Recarregar após enriquecimento (para UI já nascer preenchida)
      all = await clientDB.listAll(10000);

      this.clients = all.map((c) => ({
        clientKey: c.clientKey,
        phoneDigits: c.phoneDigits || '',
        aliasesDigits: c.aliasesDigits || [],
        whatsAppChatId: c.whatsAppChatId,
        firstName: c.firstName || '',
        lastName: c.lastName || '',
        nickname: c.nickname || '',
        address: (c.addressFreeform || c.address || '') as string,
        whatsAppCandidateName: c.whatsAppCandidateName,
        nameSource: (c as any).nameSource,
        updatedAtIso: c.updatedAtIso,
      }));
    } catch (error) {
      console.warn('[ClientesDirectoryPanel] Falha ao carregar ClientDB:', error);
      this.clients = [];
    }
  }

  private async persistClient(client: DirectoryClientDraft): Promise<void> {
    try {
      const { clientDB } = await import('../../../storage/client-db');
      await clientDB.upsert({
        clientKey: client.clientKey,
        phoneDigits: client.phoneDigits || undefined,
        aliasesDigits: client.aliasesDigits && client.aliasesDigits.length > 0 ? client.aliasesDigits : undefined,
        whatsAppChatId: client.whatsAppChatId,
        fullName: undefined,
        firstName: client.firstName || undefined,
        lastName: client.lastName || undefined,
        nickname: client.nickname || undefined,
        addressFreeform: client.address || undefined,
        address: client.address || undefined, // compat
        whatsAppCandidateName: client.whatsAppCandidateName,
        nameSource: client.nameSource,
        updatedAtIso: client.updatedAtIso,
      });
    } catch (error) {
      console.warn('[ClientesDirectoryPanel] Falha ao persistir cliente:', error);
    }
  }

  private async exportClients(): Promise<void> {
    try {
      const { clientDB } = await import('../../../storage/client-db');
      const all = await clientDB.listAll(10000);
      const day = new Date().toISOString().slice(0, 10);
      const wid = clientDB.getCurrentUserWid() || 'unknown';
      const safe = String(wid).replace(/[@.]/g, '_').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `mettri-clientes-${safe}-${day}.json`;

      const payload = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        wid,
        clients: all,
      };

      const content = JSON.stringify(payload, null, 2);
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // Preferir downloads API (sem depender de gesto do usuário)
      try {
        const { MettriBridgeClient } = await import('../../../content/bridge-client');
        const bridge = new MettriBridgeClient(2500);
        await bridge.downloadsDownload({ url, filename, saveAs: true });
      } catch (e) {
        // Fallback manual com clique
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.rel = 'noopener';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      // Cleanup
      setTimeout(() => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      }, 10_000);
    } catch (error) {
      console.warn('[ClientesDirectoryPanel] Falha ao exportar clientes:', error);
    }
  }

  private async loadClientPurchases(clientKey: string): Promise<void> {
    if (!this.container) return;
    const listEl = this.container.querySelector('#compras-list');
    if (!listEl) return;

    try {
      const { orderDB } = await import('../../../storage/order-db');
      const orders = await orderDB.listByClientKeyAndStatus(clientKey, 'completed', 20);
      if (orders.length === 0) {
        listEl.innerHTML = '<span class="text-muted-foreground">Nenhuma compra registrada</span>';
        return;
      }
      const html = orders
        .slice(0, 10)
        .map((o) => {
          const date = o.createdAtIso ? new Date(o.createdAtIso).toLocaleDateString('pt-BR') : '?';
          const total = o.totalCents ? `R$ ${(o.totalCents / 100).toFixed(2)}` : o.itemsSummary || '—';
          return `<div class="py-1 border-b border-border/20 last:border-0">
            <span class="text-foreground">${date}</span> — <span class="text-muted-foreground">${this.escapeHtml(total)}</span>
          </div>`;
        })
        .join('');
      listEl.innerHTML = html;
    } catch (error) {
      console.warn('[ClientesDirectoryPanel] Falha ao carregar compras:', error);
      listEl.innerHTML = '<span class="text-destructive">Erro ao carregar compras</span>';
    }
  }
}

