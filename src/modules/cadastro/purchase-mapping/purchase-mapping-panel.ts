/**
 * Painel "Mapear compras já existentes" — 6 estados conforme spec.
 * Spec: specs/cadastro/spec.md seção 14.
 */

import type { MappingSession, MappingStatus } from './types';
import {
  loadSamplePool,
  loadAllChatIds,
  getMessagesForChat,
  buildTranscript,
  extractConcept,
  extractPurchases,
  persistPurchase,
} from './mapping-service';

const STORAGE_KEY_API = 'mettri:openai:apiKey';

interface MettriBridgeStorage {
  storageGet(keys: string[]): Promise<Record<string, unknown>>;
  storageSet(items: Record<string, unknown>): Promise<void>;
}

function getBridge(): MettriBridgeStorage | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { MettriBridge?: MettriBridgeStorage };
  return w.MettriBridge ?? null;
}

function createInitialSession(): MappingSession {
  return {
    status: 'IDLE',
    selectedSampleChatIds: [],
    samplePool: [],
    conceptText: null,
    examplePayloads: [],
    totalChatsToProcess: 0,
    totalChatsProcessed: 0,
    totalPurchasesPersisted: 0,
    totalErrors: 0,
    cancelRequested: false,
  };
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

export class PurchaseMappingPanel {
  private container: HTMLElement | null = null;
  private session: MappingSession = createInitialSession();
  private apiKey: string = '';
  private onProgress?: (session: MappingSession) => void;
  private apiKeySaveState: 'idle' | 'saving' | 'success' | 'error' | 'no-bridge' = 'idle';
  private apiKeyErrorMessage: string | null = null;

  constructor(params: { onProgress?: (session: MappingSession) => void } = {}) {
    this.onProgress = params.onProgress;
  }

  getSession(): MappingSession {
    return { ...this.session };
  }

  async render(): Promise<HTMLElement> {
    const root = document.createElement('div');
    root.className = 'flex flex-col gap-4 p-3';
    this.container = root;
    try {
      await this.loadApiKey();
      this.renderContent();
      this.bindListeners();
    } catch (err) {
      console.error('[PurchaseMappingPanel] render error:', err);
      root.innerHTML = `
        <div class="glass-subtle rounded-xl p-4">
          <h2 class="text-sm font-semibold text-foreground mb-2">Mapear compras já existentes</h2>
          <p class="text-xs text-destructive">Erro ao carregar o painel. Verifique o console (F12) para detalhes.</p>
          <pre class="mt-2 text-[10px] text-muted-foreground overflow-auto">${escapeHtml(err instanceof Error ? err.message : String(err))}</pre>
        </div>
      `;
    }
    return root;
  }

  destroy(): void {
    this.container = null;
  }

  private async loadApiKey(): Promise<void> {
    try {
      this.apiKeySaveState = 'idle';
      this.apiKeyErrorMessage = null;
      const bridge = getBridge();
      if (!bridge) {
        this.apiKey = '';
        return;
      }
      const obj = await bridge.storageGet([STORAGE_KEY_API]);
      this.apiKey =
        typeof obj[STORAGE_KEY_API] === 'string' ? (obj[STORAGE_KEY_API] as string) : '';
    } catch {
      this.apiKey = '';
    }
  }

  private async saveApiKey(key: string): Promise<void> {
    const trimmed = key.trim();
    this.apiKey = trimmed;
    this.apiKeyErrorMessage = null;

    if (!trimmed) {
      this.apiKeySaveState = 'error';
      this.apiKeyErrorMessage = 'Informe uma chave antes de salvar.';
      return;
    }

    try {
      const bridge = getBridge();
      if (!bridge) {
        this.apiKeySaveState = 'no-bridge';
        this.apiKeyErrorMessage =
          'Não foi possível acessar o storage do Mettri. Aguarde o painel ficar "Sincronizado" e tente salvar de novo.';
        return;
      }
      this.apiKeySaveState = 'saving';
      await bridge.storageSet({ [STORAGE_KEY_API]: trimmed });
      this.apiKeySaveState = 'success';
    } catch (err) {
      this.apiKeySaveState = 'error';
      this.apiKeyErrorMessage =
        err instanceof Error
          ? `Erro ao salvar a chave: ${err.message}`
          : 'Erro inesperado ao salvar a chave.';
    }
  }

  private setStatus(status: MappingStatus, patch?: Partial<MappingSession>): void {
    this.session = { ...this.session, status, ...patch };
    this.onProgress?.(this.session);
    this.renderContent();
    this.bindListeners();
  }

  private renderContent(): void {
    if (!this.container) return;
    const s = this.session;

    if (s.status === 'IDLE' || s.status === 'ERROR_SAMPLE' || s.status === 'ERROR_MAPPING') {
      this.renderIdle();
      return;
    }
    if (s.status === 'SAMPLE_LOADING') {
      this.renderSampleLoading();
      return;
    }
    if (s.status === 'SAMPLE_READY') {
      this.renderSampleReady();
      return;
    }
    if (s.status === 'SAMPLE_ANALYZING') {
      this.renderSampleAnalyzing();
      return;
    }
    if (s.status === 'CONCEPT_READY') {
      this.renderConceptReady();
      return;
    }
    if (s.status === 'CONCEPT_APPROVED' || s.status === 'MAPPING_RUNNING') {
      this.renderMappingRunning();
      return;
    }
    if (s.status === 'CANCELLED' || s.status === 'COMPLETED') {
      this.renderCompleted();
      return;
    }
    this.renderIdle();
  }

  private renderIdle(): void {
    if (!this.container) return;
    const hasKey = this.apiKey.length > 0;
    const saveMessage =
      this.apiKeySaveState === 'success'
        ? '<p class="mt-1 text-[11px] text-emerald-600">Chave salva com sucesso neste navegador.</p>'
        : this.apiKeySaveState === 'no-bridge' || this.apiKeySaveState === 'error'
        ? `<p class="mt-1 text-[11px] text-destructive">${escapeHtml(this.apiKeyErrorMessage ?? 'Não foi possível salvar a chave.')}</p>`
        : '';
    const saveButtonLabel =
      this.apiKeySaveState === 'saving' ? 'Salvando…' : 'Salvar chave';
    const saveDisabled = this.apiKeySaveState === 'saving';

    this.container.innerHTML = `
      <div class="glass-subtle rounded-xl p-4">
        <h2 class="text-sm font-semibold text-foreground mb-2">Mapear compras já existentes</h2>
        <p class="text-xs text-muted-foreground mb-3">
          Use uma amostra de conversas para o sistema aprender como seus clientes pedem e quais dados usar no registro de compras.
        </p>
        <div class="mb-3">
          <label class="block text-[11px] text-muted-foreground mb-1">Chave API OpenAI (opcional; pode salvar para não digitar de novo)</label>
          <input type="password" class="w-full rounded-lg border border-border/50 bg-background px-2 py-1.5 text-xs text-foreground" data-field="apiKey" placeholder="sk-..." value="${escapeHtml(this.apiKey)}" />
          <button type="button" class="mt-1 text-[11px] text-primary hover:underline disabled:opacity-50" data-action="saveApiKey" ${
            saveDisabled ? 'disabled' : ''
          }>${saveButtonLabel}</button>
          ${saveMessage}
        </div>
        <button type="button" class="w-full rounded-xl py-2 px-3 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50" data-action="loadSample" ${!hasKey ? 'title="Recomendado: informe a chave OpenAI antes"' : ''}>
          Carregar amostra de contatos
        </button>
        ${this.session.status === 'ERROR_SAMPLE' ? '<p class="mt-2 text-xs text-destructive">Erro ao carregar ou analisar amostra. Tente de novo.</p>' : ''}
      </div>
    `;
  }

  private renderSampleLoading(): void {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="glass-subtle rounded-xl p-4">
        <h2 class="text-sm font-semibold text-foreground mb-2">Mapear compras já existentes</h2>
        <p class="text-xs text-muted-foreground">Carregando contatos…</p>
      </div>
    `;
  }

  private renderSampleReady(): void {
    if (!this.container) return;
    const s = this.session;
    const selectedSet = new Set(s.selectedSampleChatIds);
    const listHtml = s.selectedSampleChatIds
      .map((chatId) => {
        const info = s.samplePool.find((c) => c.chatId === chatId);
        const name = info?.chatName ?? chatId;
        const count = info?.messageCount ?? 0;
        return `<label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" data-chat-id="${escapeHtml(chatId)}" checked /> <span class="text-sm text-foreground">${escapeHtml(name)} (${count} msgs)</span></label>`;
      })
      .join('');
    const canAnalyze = s.selectedSampleChatIds.length === 3;
    this.container.innerHTML = `
      <div class="glass-subtle rounded-xl p-4">
        <h2 class="text-sm font-semibold text-foreground mb-2">Mapear compras já existentes</h2>
        <p class="text-xs text-muted-foreground mb-3">Selecione 3 contatos com mais conversas para análise. Se desmarcar um, outro contato entra no lugar.</p>
        <div class="flex flex-col gap-2 mb-3" data-sample-list>${listHtml}</div>
        <button type="button" class="w-full rounded-xl py-2 px-3 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50" data-action="analyzeSample" ${canAnalyze ? '' : 'disabled'}>
          Analisar amostra
        </button>
      </div>
    `;
  }

  private renderSampleAnalyzing(): void {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="glass-subtle rounded-xl p-4">
        <h2 class="text-sm font-semibold text-foreground mb-2">Mapear compras já existentes</h2>
        <p class="text-xs text-muted-foreground">Analisando 3 conversas… (cerca de 50 msgs de cada)</p>
        <div class="mt-2 h-2 bg-secondary/30 rounded-full overflow-hidden"><div class="h-full w-2/3 bg-primary/50 rounded-full animate-pulse"></div></div>
      </div>
    `;
  }

  private renderConceptReady(): void {
    if (!this.container) return;
    const s = this.session;
    const exampleStr =
      s.examplePayloads.length > 0
        ? JSON.stringify(s.examplePayloads[0], null, 2)
        : '{}';
    this.container.innerHTML = `
      <div class="glass-subtle rounded-xl p-4 space-y-3">
        <h2 class="text-sm font-semibold text-foreground">Mapear compras já existentes</h2>
        <div>
          <div class="text-[11px] font-medium text-muted-foreground mb-1">Como seus clientes costumam pedir</div>
          <div class="rounded-lg border border-border/30 bg-background/50 p-2 text-xs text-foreground whitespace-pre-wrap">${escapeHtml(s.conceptText ?? '')}</div>
        </div>
        <div>
          <div class="text-[11px] font-medium text-muted-foreground mb-1">Dados que usaremos no registro de compra</div>
          <div class="rounded-lg border border-border/30 bg-background/50 p-2 text-xs text-foreground font-mono">${escapeHtml(exampleStr)}</div>
        </div>
        <div class="flex gap-2">
          <button type="button" class="flex-1 rounded-xl py-2 px-3 border border-border/50 text-sm font-medium text-foreground hover:bg-secondary/20 transition-colors" data-action="refuseConcept">Refazer amostra</button>
          <button type="button" class="flex-1 rounded-xl py-2 px-3 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity" data-action="approveConcept">Está bom, mapear em todos os chats</button>
        </div>
      </div>
    `;
  }

  private renderMappingRunning(): void {
    if (!this.container) return;
    const s = this.session;
    const pct = s.totalChatsToProcess > 0 ? Math.round((s.totalChatsProcessed / s.totalChatsToProcess) * 100) : 0;
    this.container.innerHTML = `
      <div class="glass-subtle rounded-xl p-4">
        <h2 class="text-sm font-semibold text-foreground mb-2">Mapear compras já existentes</h2>
        <p class="text-xs text-muted-foreground mb-1">Mapeando compras em todos os chats…</p>
        <p class="text-xs text-foreground mb-2">Conversas analisadas: ${s.totalChatsProcessed} / ${s.totalChatsToProcess}</p>
        <div class="h-2 bg-secondary/30 rounded-full overflow-hidden mb-3"><div class="h-full bg-primary/70 rounded-full transition-all" style="width:${pct}%"></div></div>
        <button type="button" class="w-full rounded-xl py-2 px-3 border border-border/50 text-sm font-medium text-foreground hover:bg-secondary/20" data-action="cancelMapping">Cancelar</button>
      </div>
    `;
  }

  private renderCompleted(): void {
    if (!this.container) return;
    const s = this.session;
    this.container.innerHTML = `
      <div class="glass-subtle rounded-xl p-4">
        <h2 class="text-sm font-semibold text-foreground mb-2">Mapear compras já existentes</h2>
        <p class="text-sm font-medium text-foreground mb-2">Mapeamento concluído.</p>
        <ul class="text-xs text-muted-foreground space-y-1 mb-3">
          <li>${s.totalChatsProcessed} conversas analisadas</li>
          <li>${s.totalPurchasesPersisted} compras registradas</li>
          <li>${s.totalErrors} erros</li>
        </ul>
        <p class="text-[11px] text-muted-foreground mb-3">
          As compras detectadas aparecem na ficha de Atendimento de cada cliente, no bloco "Registro de compra".
        </p>
        <button type="button" class="w-full rounded-xl py-2 px-3 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90" data-action="reset">Mapear de novo</button>
      </div>
    `;
  }

  private bindListeners(): void {
    if (!this.container) return;
    this.container.querySelectorAll('[data-action]').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const action = el.getAttribute('data-action');
      if (!action) return;
      el.addEventListener('click', () => this.handleAction(action, el));
    });
    // Sample list: checkbox change -> replace selection
    this.container.querySelectorAll('[data-sample-list] input[data-chat-id]').forEach((el) => {
      if (!(el instanceof HTMLInputElement)) return;
      el.addEventListener('change', () => {
        const chatId = el.getAttribute('data-chat-id');
        if (!chatId) return;
        if (el.checked) return;
        this.toggleSampleSelection(chatId, false);
      });
    });
  }

  private async handleAction(action: string, _el: HTMLElement): Promise<void> {
    if (action === 'saveApiKey') {
      const input = this.container?.querySelector('[data-field="apiKey"]');
      if (input instanceof HTMLInputElement) {
        await this.saveApiKey(input.value.trim());
        this.renderContent();
        this.bindListeners();
      }
      return;
    }
    if (action === 'loadSample') {
      await this.doLoadSample();
      return;
    }
    if (action === 'analyzeSample') {
      await this.doAnalyzeSample();
      return;
    }
    if (action === 'refuseConcept') {
      this.setStatus('SAMPLE_READY', { conceptText: null, examplePayloads: [] });
      return;
    }
    if (action === 'approveConcept') {
      this.setStatus('CONCEPT_APPROVED');
      await this.doStartMapping();
      return;
    }
    if (action === 'cancelMapping') {
      this.session.cancelRequested = true;
      this.renderContent();
      this.bindListeners();
      return;
    }
    if (action === 'reset') {
      this.session = createInitialSession();
      this.renderContent();
      this.bindListeners();
      return;
    }
  }

  private toggleSampleSelection(chatId: string, _checked: boolean): void {
    const s = this.session;
    const next = s.samplePool.find((c) => !s.selectedSampleChatIds.includes(c.chatId));
    if (!next) return;
    const newSelected = s.selectedSampleChatIds.map((id) => (id === chatId ? next.chatId : id));
    this.setStatus('SAMPLE_READY', { selectedSampleChatIds: newSelected });
  }

  private async doLoadSample(): Promise<void> {
    this.setStatus('SAMPLE_LOADING');
    try {
      const pool = await loadSamplePool();
      if (pool.length < 3) {
        this.setStatus('IDLE', { samplePool: pool });
        alert('Menos de 3 contatos com mensagens. Não é possível continuar.');
        return;
      }
      const selected = pool.slice(0, 3).map((c) => c.chatId);
      this.setStatus('SAMPLE_READY', { samplePool: pool, selectedSampleChatIds: selected });
    } catch (e) {
      console.error('[PurchaseMapping] loadSample', e);
      this.setStatus('ERROR_SAMPLE');
    }
  }

  private async doAnalyzeSample(): Promise<void> {
    const s = this.session;
    if (s.selectedSampleChatIds.length !== 3 || !this.apiKey) {
      if (!this.apiKey) alert('Informe e salve a chave da API OpenAI antes de analisar.');
      return;
    }
    this.setStatus('SAMPLE_ANALYZING');
    try {
      const transcripts: Array<{ chatName: string; transcript: string }> = [];
      for (const chatId of s.selectedSampleChatIds) {
        const msgs = await getMessagesForChat(chatId, 50);
        const info = s.samplePool.find((c) => c.chatId === chatId);
        transcripts.push({
          chatName: info?.chatName ?? chatId,
          transcript: buildTranscript(msgs),
        });
      }
      const result = await extractConcept(this.apiKey, transcripts);
      this.setStatus('CONCEPT_READY', {
        conceptText: result.conceptText,
        examplePayloads: result.examplePayloads,
      });
    } catch (e) {
      console.error('[PurchaseMapping] analyzeSample', e);
      this.setStatus('ERROR_SAMPLE');
      alert(e instanceof Error ? e.message : 'Erro ao analisar amostra.');
    }
  }

  private async doStartMapping(): Promise<void> {
    const s = this.session;
    if (s.status !== 'CONCEPT_APPROVED' || !s.conceptText || !this.apiKey) {
      alert('Conceito aprovado e chave OpenAI são necessários.');
      return;
    }
    const chatIds = await loadAllChatIds();
    this.setStatus('MAPPING_RUNNING', {
      totalChatsToProcess: chatIds.length,
      totalChatsProcessed: 0,
      totalPurchasesPersisted: 0,
      totalErrors: 0,
      cancelRequested: false,
    });
    let totalChatsProcessed = 0;
    let totalPurchasesPersisted = 0;
    let totalErrors = 0;
    for (const chatId of chatIds) {
      if (this.session.cancelRequested) break;
      try {
        const msgs = await getMessagesForChat(chatId, 150);
        const transcript = buildTranscript(msgs);
        const purchases = await extractPurchases(this.apiKey, chatId, transcript, s.conceptText);
        for (const item of purchases) {
          if (this.session.cancelRequested) break;
          if (!item.date) {
            totalErrors++;
            continue;
          }
          try {
            await persistPurchase(chatId, item);
            totalPurchasesPersisted++;
          } catch {
            totalErrors++;
          }
        }
      } catch {
        totalErrors++;
      }
      totalChatsProcessed++;
      this.session.totalChatsProcessed = totalChatsProcessed;
      this.session.totalPurchasesPersisted = totalPurchasesPersisted;
      this.session.totalErrors = totalErrors;
      this.onProgress?.({ ...this.session });
      this.renderContent();
      this.bindListeners();
    }
    this.setStatus(this.session.cancelRequested ? 'CANCELLED' : 'COMPLETED', {
      totalChatsProcessed,
      totalPurchasesPersisted,
      totalErrors,
    });
  }
}
