import { ActiveChatService } from '../../../infrastructure/active-chat-service';
import type { EventBus } from '../../../ui/core/event-bus';
import { fornecerFichaClienteParaAtendimento, type CampoConfianca } from '../cliente';
import { persistirClienteOficial, type PersistirClienteOficialInput, atualizarPerfilOperacionalCliente, type CustomerOperationalSignals } from '../cliente';
import { purchaseDB, type ManualPurchaseRecord } from '../../../storage/purchase-db';
import type { FichaClienteAtendimento } from '../cliente/types';
import type { OuvirProfileUpdatedEvent } from '../../ouvir/types';

const CADASTRO_OPEN_CLIENT_PROFILE_EVENT = 'cadastro:open-client-profile';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function escapeHtml(value: string): string {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function formatCurrency(value: number | null): string {
  if (typeof value !== 'number') return '—';
  return `R$ ${value.toFixed(2)}`;
}

function formatMaybe(value: string | null | undefined): string {
  const v = String(value ?? '').trim();
  return v || '—';
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const date = new Date(iso);
    return date.toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

function formatArray(value: string[] | null | undefined): string {
  if (!Array.isArray(value)) return '—';
  return value.length ? value.join(', ') : '—';
}

function getConfiancaBadge(confianca: CampoConfianca | undefined): string {
  const level: CampoConfianca = confianca || 'desconhecido';
  const badges: Record<string, string> = {
    alta: 'px-2 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-400 border border-green-500/30',
    media: 'px-2 py-0.5 rounded text-[10px] font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    baixa: 'px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400 border border-red-500/30',
    desconhecido: 'px-2 py-0.5 rounded text-[10px] font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30',
  };
  const className = badges[level] || badges.desconhecido;
  return `<span class="${className}">${level}</span>`;
}

function getSaveStatusIcon(status: SaveStatus): string {
  switch (status) {
    case 'saving':
      return '<span class="text-[10px] animate-pulse text-blue-400">salvando...</span>';
    case 'saved':
      return '<span class="text-[10px] text-green-400">✓ salvo</span>';
    case 'error':
      return '<span class="text-[10px] text-red-400">✗ erro</span>';
    default:
      return '';
  }
}

interface EditableField {
  key: string;
  value: string;
  status: SaveStatus;
  message?: string;
}

interface PurchaseFormData {
  purchaseDate: string;
  value: string;
  items: string;
  notes: string;
}

export class ClienteProfilePanel {
  private container: HTMLElement | null = null;
  private eventBus: EventBus | null = null;
  private activeChatService = new ActiveChatService();
  private currentChatId: string | null = null;
  private loading = false;
  private ficha: FichaClienteAtendimento | null = null;
  private purchases: ManualPurchaseRecord[] = [];
  private error: string | null = null;

  private editableFields: Map<string, EditableField> = new Map();
  private showPurchaseForm = false;
  private purchaseFormData: PurchaseFormData = {
    purchaseDate: new Date().toISOString().split('T')[0],
    value: '',
    items: '',
    notes: '',
  };
  private savingPurchase = false;

  private previousFieldValues: Record<string, string> = {};
  private updatedFields: Set<string> = new Set();
  private ouvinteAtivo = false;
  private processandoOuvinte = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly onOuvinteUpdate = (data: OuvirProfileUpdatedEvent): void => {
    if (data.chatId !== this.currentChatId) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.snapshotFieldValues();
    this.processandoOuvinte = true;
    this.debounceTimer = setTimeout(() => {
      void this.loadFixture().then(() => {
        this.processandoOuvinte = false;
        this.detectUpdatedFields();
        this.renderContent();
        setTimeout(() => {
          if (this.updatedFields.size > 0) {
            this.updatedFields.clear();
            this.renderContent();
          }
        }, 4000);
      });
    }, 500);
  };

  private readonly onOpenClientProfile = (payload?: { chatId?: string }): void => {
    const chatId = String(payload?.chatId || '').trim();
    if (!chatId) return;
    this.currentChatId = chatId;
    void this.loadFixture();
  };

  constructor(eventBus?: EventBus) {
    this.eventBus = eventBus ?? null;
  }

  public async render(): Promise<HTMLElement> {
    const root = document.createElement('div');
    root.className = 'flex flex-col gap-4 p-3';
    this.container = root;

    await this.activeChatService.start();
    this.currentChatId = this.activeChatService.getCurrent();
    this.activeChatService.onChange((chatId) => {
      this.currentChatId = chatId;
      this.ouvinteAtivo = false;
      this.updatedFields.clear();
      void this.loadFixture();
    });
    this.eventBus?.on<{ chatId: string }>(CADASTRO_OPEN_CLIENT_PROFILE_EVENT, this.onOpenClientProfile);
    this.eventBus?.on<OuvirProfileUpdatedEvent>('ouvir:profile-updated', this.onOuvinteUpdate);

    await this.loadFixture();
    return root;
  }

  public destroy(): void {
    this.activeChatService.stop();
    this.eventBus?.off<{ chatId: string }>(CADASTRO_OPEN_CLIENT_PROFILE_EVENT, this.onOpenClientProfile);
    this.eventBus?.off<OuvirProfileUpdatedEvent>('ouvir:profile-updated', this.onOuvinteUpdate);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.container) this.container.innerHTML = '';
    this.container = null;
  }

  private async loadFixture(): Promise<void> {
    this.loading = true;
    this.error = null;
    this.editableFields.clear();
    this.renderContent();

    const chatId = String(this.currentChatId || '').trim();
    if (!chatId) {
      this.loading = false;
      this.ficha = null;
      this.purchases = [];
      this.error = 'Abra um chat no WhatsApp para visualizar o perfil do cliente.';
      this.renderContent();
      return;
    }

    const result = await fornecerFichaClienteParaAtendimento(chatId, undefined, {
      allowPartialOnError: true,
    });

    this.loading = false;
    if (!result.ok) {
      this.ficha = null;
      this.purchases = [];
      this.error = result.message;
      this.renderContent();
      return;
    }

    this.ficha = result.data;

    try {
      this.purchases = await purchaseDB.listActiveByChatId(chatId);
    } catch {
      this.purchases = [];
    }

    this.initEditableFields();
    this.renderContent();
  }

  private snapshotFieldValues(): void {
    this.previousFieldValues = {};
    const perfil = this.ficha?.perfilOperacional;
    if (!perfil) return;
    this.previousFieldValues['preferenciasProduto'] = formatArray(perfil.preferenciasProduto);
    this.previousFieldValues['aversoesProduto'] = formatArray(perfil.aversoesProduto);
    this.previousFieldValues['enderecoEntrega'] = perfil.enderecoEntrega || '';
    this.previousFieldValues['formaPagamentoPreferida'] = formatArray(perfil.formaPagamentoPreferida);
    this.previousFieldValues['observacoesLogisticas'] = formatArray(perfil.observacoesLogisticas);
    this.previousFieldValues['urgenciaEntrega'] = perfil.urgenciaEntrega || '';
    this.previousFieldValues['segmentos'] = formatArray(perfil.segmentos);
  }

  private detectUpdatedFields(): void {
    const perfil = this.ficha?.perfilOperacional;
    if (!perfil) return;
    const current: Record<string, string> = {
      'preferenciasProduto': formatArray(perfil.preferenciasProduto),
      'aversoesProduto': formatArray(perfil.aversoesProduto),
      'enderecoEntrega': perfil.enderecoEntrega || '',
      'formaPagamentoPreferida': formatArray(perfil.formaPagamentoPreferida),
      'observacoesLogisticas': formatArray(perfil.observacoesLogisticas),
      'urgenciaEntrega': perfil.urgenciaEntrega || '',
      'segmentos': formatArray(perfil.segmentos),
    };
    for (const [key, value] of Object.entries(current)) {
      const prev = this.previousFieldValues[key] || '';
      if (value && value !== prev) {
        this.updatedFields.add(key);
      }
    }
    if (this.updatedFields.size > 0) {
      this.ouvinteAtivo = true;
    }
  }

  private initEditableFields(): void {
    const ficha = this.ficha;
    if (!ficha) return;

    const cadastro = ficha.cadastro;
    const perfil = ficha.perfilOperacional;

    this.editableFields.set('fullName', { key: 'fullName', value: cadastro?.fullName || '', status: 'idle' });
    this.editableFields.set('firstName', { key: 'firstName', value: cadastro?.firstName || '', status: 'idle' });
    this.editableFields.set('phoneDigits', { key: 'phoneDigits', value: cadastro?.phoneDigits || '', status: 'idle' });
    this.editableFields.set('email', { key: 'email', value: cadastro?.email || '', status: 'idle' });
    this.editableFields.set('cpfCnpj', { key: 'cpfCnpj', value: cadastro?.cpfCnpj || '', status: 'idle' });
    this.editableFields.set('dataNascimento', { key: 'dataNascimento', value: cadastro?.dataNascimento || '', status: 'idle' });
    this.editableFields.set('address', { key: 'address', value: cadastro?.address || cadastro?.addressFreeform || '', status: 'idle' });
    this.editableFields.set('segmentos', { key: 'segmentos', value: formatArray(perfil?.segmentos), status: 'idle' });
    this.editableFields.set('preferenciasProduto', { key: 'preferenciasProduto', value: formatArray(perfil?.preferenciasProduto), status: 'idle' });
    this.editableFields.set('aversoesProduto', { key: 'aversoesProduto', value: formatArray(perfil?.aversoesProduto), status: 'idle' });
    this.editableFields.set('formaPagamentoPreferida', { key: 'formaPagamentoPreferida', value: formatArray(perfil?.formaPagamentoPreferida), status: 'idle' });
    this.editableFields.set('enderecoEntrega', { key: 'enderecoEntrega', value: perfil?.enderecoEntrega || '', status: 'idle' });
    this.editableFields.set('observacoesLogisticas', { key: 'observacoesLogisticas', value: formatArray(perfil?.observacoesLogisticas), status: 'idle' });
  }

  private async saveField(fieldKey: string, value: string): Promise<void> {
    const chatId = this.ficha?.chatId;
    if (!chatId) return;

    const field = this.editableFields.get(fieldKey);
    if (field) {
      field.status = 'saving';
      this.renderContent();
    }

    const isPerfilOperacionalField = [
      'segmentos', 'preferenciasProduto', 'aversoesProduto',
      'formaPagamentoPreferida', 'enderecoEntrega', 'observacoesLogisticas'
    ].includes(fieldKey);

    let result: Awaited<ReturnType<typeof persistirClienteOficial>> | { ok: boolean; message?: string } = { ok: false };

    if (isPerfilOperacionalField) {
      const sinais: CustomerOperationalSignals = {};
      if (fieldKey === 'segmentos') {
        sinais.segmentos = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
      } else if (fieldKey === 'preferenciasProduto') {
        sinais.preferenciasProduto = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
      } else if (fieldKey === 'aversoesProduto') {
        sinais.aversoesProduto = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
      } else if (fieldKey === 'formaPagamentoPreferida') {
        sinais.formaPagamentoPreferida = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
      } else if (fieldKey === 'enderecoEntrega') {
        sinais.enderecoEntrega = value;
      } else if (fieldKey === 'observacoesLogisticas') {
        sinais.observacoesLogisticas = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
      }

      result = await atualizarPerfilOperacionalCliente({ chatId, sinais });
    } else {
      const input: PersistirClienteOficialInput = {
        chatId,
        recordPatch: {
          [fieldKey]: value || undefined,
        },
      };
      result = await persistirClienteOficial(input);
    }

    const currentField = this.editableFields.get(fieldKey);
    if (!currentField) return;

    if (result.ok) {
      currentField.status = 'saved';
      currentField.value = value;
      if (!isPerfilOperacionalField && this.ficha?.cadastro) {
        (this.ficha.cadastro as Record<string, unknown>)[fieldKey] = value || undefined;
      }
    } else {
      currentField.status = 'error';
      currentField.message = result.message;
    }

    this.renderContent();

    if (currentField.status === 'saved') {
      setTimeout(() => {
        if (currentField.status === 'saved') {
          currentField.status = 'idle';
          this.renderContent();
        }
      }, 2000);
    }
  }

  private async savePurchase(): Promise<void> {
    const chatId = this.ficha?.chatId;
    if (!chatId) return;

    const { purchaseDate, value, items, notes } = this.purchaseFormData;

    if (!purchaseDate) {
      return;
    }

    this.savingPurchase = true;
    this.renderContent();

    try {
      const purchaseDateObj = new Date(purchaseDate);
      const numericValue = parseFloat(value);
      const itemsArray = items
        .split(',')
        .map((i) => i.trim())
        .filter((i) => i.length > 0);

      await purchaseDB.addPurchase({
        chatId,
        purchaseDate: purchaseDateObj,
        value: value && !isNaN(numericValue) ? numericValue : undefined,
        items: itemsArray.length > 0 ? itemsArray : undefined,
        notes: notes || undefined,
        source: 'MANUAL',
      });

      this.purchases = await purchaseDB.listActiveByChatId(chatId);
      this.showPurchaseForm = false;
      this.purchaseFormData = {
        purchaseDate: new Date().toISOString().split('T')[0],
        value: '',
        items: '',
        notes: '',
      };
    } catch (error) {
      console.error('Erro ao salvar compra:', error);
    } finally {
      this.savingPurchase = false;
      this.renderContent();
    }
  }

  private async removePurchase(purchaseId: string): Promise<void> {
    const chatId = this.ficha?.chatId;
    if (!chatId) return;

    try {
      await purchaseDB.removePurchase(purchaseId);
      this.purchases = await purchaseDB.listActiveByChatId(chatId);
      this.renderContent();
    } catch (error) {
      console.error('Erro ao remover compra:', error);
    }
  }

  private renderContent(): void {
    if (!this.container) return;

    if (this.loading) {
      this.container.innerHTML = `
        <div class="glass-subtle rounded-xl p-4">
          <h2 class="text-sm font-semibold text-foreground mb-2">Perfil do cliente</h2>
          <p class="text-xs text-muted-foreground">Carregando ficha de cliente...</p>
        </div>
      `;
      return;
    }

    if (this.error) {
      this.container.innerHTML = `
        <div class="glass-subtle rounded-xl p-4">
          <h2 class="text-sm font-semibold text-foreground mb-2">Perfil do cliente</h2>
          <p class="text-xs text-muted-foreground mb-3">${escapeHtml(this.error)}</p>
          <button type="button" data-action="refresh" class="rounded-xl py-2 px-3 border border-border/50 text-xs font-medium text-foreground hover:bg-secondary/20">
            Atualizar
          </button>
        </div>
      `;
      this.bindListeners();
      return;
    }

    const ficha = this.ficha;
    if (!ficha) return;

    const cadastro = ficha.cadastro;
    const perfil = ficha.perfilOperacional;
    const rfm = perfil?.rfm;
    const proximidade = perfil?.proximidade;
    const camposConfianca = perfil?.camposConfianca as Record<string, CampoConfianca> | undefined;

    const confiancaVal = typeof perfil?.confiancaPerfil === 'number' ? perfil.confiancaPerfil : 0;
    const confiancaCor = confiancaVal >= 0.6 ? 'rgb(34,197,94)' : confiancaVal >= 0.3 ? 'rgb(234,179,8)' : 'rgb(239,68,68)';
    const ouvinteLabel = this.processandoOuvinte
      ? '<span class="text-[10px] text-blue-400">● processando...</span>'
      : this.ouvinteAtivo
        ? '<span class="text-[10px] text-green-400">● Ouvinte ativo</span>'
        : '';

    this.container.innerHTML = `
      <style>
        @keyframes flash-update {
          0%   { background: rgba(34,197,94,0.25); transform: scale(1.02); border-radius: 4px; }
          50%  { background: rgba(34,197,94,0.12); }
          100% { background: transparent; transform: scale(1); }
        }
        .campo-atualizado { animation: flash-update 1.5s ease-out; }
        .badge-novo {
          display: inline-block;
          font-size: 9px;
          color: rgb(34,197,94);
          font-weight: 500;
          margin-left: 4px;
          animation: fadeInOut 4s ease-out;
        }
        @keyframes fadeInOut {
          0% { opacity: 1; }
          70% { opacity: 1; }
          100% { opacity: 0; }
        }
      </style>
      <div class="glass-subtle rounded-xl p-4 space-y-3">
        <div class="flex items-center justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <h2 class="text-sm font-semibold text-foreground">Perfil do cliente</h2>
              ${ouvinteLabel}
            </div>
            <div class="flex items-center gap-2 mt-1">
              <div class="flex-1 h-1.5 bg-gray-700/50 rounded-full overflow-hidden max-w-[120px]">
                <div class="h-full rounded-full transition-all duration-600"
                     style="width:${(confiancaVal * 100).toFixed(0)}%;background:${confiancaCor}">
                </div>
              </div>
              <span class="text-[10px] text-muted-foreground">${(confiancaVal * 100).toFixed(0)}%</span>
            </div>
          </div>
          <button type="button" data-action="refresh" class="text-[11px] text-primary hover:underline shrink-0">Atualizar</button>
        </div>

        <!-- Dados Principais -->
        <div class="rounded-lg border border-border/30 bg-background/40 p-3 text-xs space-y-2">
          <div class="font-medium text-foreground mb-2">Dados principais</div>
          <div class="grid grid-cols-2 gap-x-4 gap-y-1">
            <div><span class="text-muted-foreground">Chat:</span></div>
            <div class="text-foreground truncate">${escapeHtml(ficha.chatId)}</div>

            <div><span class="text-muted-foreground">Nome:</span></div>
            ${this.renderEditableField('fullName', cadastro?.fullName || cadastro?.firstName || '')}

            <div><span class="text-muted-foreground">Telefone:</span></div>
            ${this.renderEditableField('phoneDigits', cadastro?.phoneDigits || '')}

            <div><span class="text-muted-foreground">Email:</span></div>
            ${this.renderEditableField('email', cadastro?.email || '')}

            <div><span class="text-muted-foreground">CPF/CNPJ:</span></div>
            ${this.renderEditableField('cpfCnpj', cadastro?.cpfCnpj || '')}

            <div><span class="text-muted-foreground">Nascimento:</span></div>
            ${this.renderEditableField('dataNascimento', cadastro?.dataNascimento || '')}
          </div>
        </div>

        <!-- Perfil Operacional -->
        <div class="rounded-lg border border-border/30 bg-background/40 p-3 text-xs space-y-2">
          <div class="font-medium text-foreground mb-2">Perfil operacional</div>
          <div class="grid grid-cols-2 gap-x-4 gap-y-1">
            <div><span class="text-muted-foreground">Segmentos:</span></div>
            ${this.renderEditableField('segmentos', formatArray(perfil?.segmentos))}

            <div><span class="text-muted-foreground">Proximidade:</span></div>
            <div class="text-foreground">${escapeHtml(formatMaybe(proximidade?.banda))}${typeof proximidade?.score === 'number' ? ` (${proximidade.score.toFixed(2)})` : ''}</div>

            <div><span class="text-muted-foreground">Sensibilidade:</span></div>
            <div class="text-foreground">${escapeHtml(formatMaybe(perfil?.sensibilidadeOferta))}</div>

            <div><span class="text-muted-foreground">Janela ativa:</span></div>
            <div class="text-foreground">${escapeHtml(formatMaybe(perfil?.comportamento?.janelaAtiva))}</div>

            <div><span class="text-muted-foreground">Frequência (7d):</span></div>
            <div class="text-foreground">${typeof perfil?.comportamento?.frequenciaContato7d === 'number' ? perfil.comportamento.frequenciaContato7d : '—'}</div>
          </div>
        </div>

        <!-- Preferências -->
        <div class="rounded-lg border border-border/30 bg-background/40 p-3 text-xs">
          <div class="font-medium text-foreground mb-2">Preferências</div>
          <div class="space-y-2">
            <div class="grid grid-cols-3 gap-2 text-[11px]">
              <div class="text-muted-foreground">Produtos</div>
              <div class="col-span-1">${this.renderEditableFieldInline('preferenciasProduto', formatArray(perfil?.preferenciasProduto))}</div>
              <div class="text-right">${getConfiancaBadge(camposConfianca?.preferenciasProduto)}</div>
            </div>
            <div class="grid grid-cols-3 gap-2 text-[11px]">
              <div class="text-muted-foreground">Aversões</div>
              <div class="col-span-1">${this.renderEditableFieldInline('aversoesProduto', formatArray(perfil?.aversoesProduto))}</div>
              <div class="text-right">${getConfiancaBadge(camposConfianca?.aversoesProduto)}</div>
            </div>
            <div class="grid grid-cols-3 gap-2 text-[11px]">
              <div class="text-muted-foreground">Forma pgto</div>
              <div class="col-span-1">${this.renderEditableFieldInline('formaPagamentoPreferida', formatArray(perfil?.formaPagamentoPreferida))}</div>
              <div class="text-right">${getConfiancaBadge(camposConfianca?.formaPagamentoPreferida)}</div>
            </div>
          </div>
        </div>

        <!-- Logística -->
        <div class="rounded-lg border border-border/30 bg-background/40 p-3 text-xs">
          <div class="font-medium text-foreground mb-2">Logística</div>
          <div class="space-y-2">
            <div class="grid grid-cols-3 gap-2 text-[11px]">
              <div class="text-muted-foreground">Endereço</div>
              <div class="col-span-1">${this.renderEditableFieldInline('enderecoEntrega', escapeHtml(perfil?.enderecoEntrega || ''))}</div>
              <div class="text-right">${getConfiancaBadge(camposConfianca?.enderecoEntrega)}</div>
            </div>
            <div class="grid grid-cols-3 gap-2 text-[11px]">
              <div class="text-muted-foreground">Observações</div>
              <div class="col-span-1">${this.renderEditableFieldInline('observacoesLogisticas', formatArray(perfil?.observacoesLogisticas))}</div>
              <div class="text-right">${getConfiancaBadge(camposConfianca?.observacoesLogisticas)}</div>
            </div>
            <div class="grid grid-cols-3 gap-2 text-[11px]">
              <div class="text-muted-foreground">Urgência</div>
              <div class="col-span-1 text-foreground">${escapeHtml(formatMaybe(perfil?.urgenciaEntrega))}</div>
              <div class="text-right">${getConfiancaBadge(camposConfianca?.urgenciaEntrega)}</div>
            </div>
          </div>
        </div>

        <!-- Histórico -->
        <div class="rounded-lg border border-border/30 bg-background/40 p-3 text-xs space-y-1">
          <div class="font-medium text-foreground mb-2">Histórico</div>
          <div class="grid grid-cols-3 gap-2">
            <div><span class="text-muted-foreground">Recência:</span> <span class="text-foreground">${typeof perfil?.historico?.diasDesdeUltimaCompra === 'number' ? `${perfil.historico.diasDesdeUltimaCompra} dias` : '—'}</span></div>
            <div><span class="text-muted-foreground">Frequência (90d):</span> <span class="text-foreground">${typeof perfil?.historico?.compras90d === 'number' ? perfil.historico.compras90d : '—'}</span></div>
            <div><span class="text-muted-foreground">Ticket:</span> <span class="text-foreground">${escapeHtml(formatMaybe(perfil?.historico?.ticketMedioFaixa))}</span></div>
          </div>
        </div>

        <!-- RFM -->
        <div class="rounded-lg border border-border/30 bg-background/40 p-3 text-xs space-y-1">
          <div class="font-medium text-foreground">RFM</div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div><span class="text-muted-foreground">Recência:</span> <span class="text-foreground">${typeof rfm?.recenciaDias === 'number' ? `${rfm.recenciaDias}d` : '—'}</span></div>
            <div><span class="text-muted-foreground">Frequência:</span> <span class="text-foreground">${typeof rfm?.frequencia30d === 'number' ? rfm.frequencia30d : '—'}</span></div>
            <div><span class="text-muted-foreground">Monetário:</span> <span class="text-foreground">${typeof rfm?.monetario30d === 'number' ? formatCurrency(rfm.monetario30d) : '—'}</span></div>
            <div><span class="text-muted-foreground">Score:</span> <span class="text-foreground">${typeof rfm?.score === 'number' ? rfm.score : '—'}</span></div>
          </div>
        </div>

        <!-- Compras -->
        <div class="rounded-lg border border-border/30 bg-background/40 p-3 text-xs space-y-2">
          <div class="flex items-center justify-between mb-2">
            <div class="font-medium text-foreground">Compras</div>
            <button type="button" data-action="toggle-purchase-form" class="text-[11px] text-primary hover:underline">
              ${this.showPurchaseForm ? 'Cancelar' : '+ Nova compra'}
            </button>
          </div>

          ${this.showPurchaseForm ? this.renderPurchaseForm() : ''}

          ${this.purchases.length === 0 && !this.showPurchaseForm ? '<p class="text-muted-foreground text-[10px]">Nenhuma compra registrada</p>' : ''}

          ${this.purchases.length > 0 ? `
            <div class="space-y-1 max-h-40 overflow-y-auto">
              ${this.purchases.map(p => `
                <div class="flex items-center justify-between text-[11px] py-1 border-b border-border/20 last:border-0">
                  <div>
                    <span class="text-muted-foreground">${formatDate(p.purchaseDateIso)}</span>
                    <span class="text-foreground ml-2">${formatCurrency(p.value)}</span>
                    <span class="text-[10px] text-muted-foreground ml-2">${p.source === 'AI_DETECTED' ? 'IA' : 'Manual'}</span>
                    ${p.items && p.items.length > 0 ? `<span class="text-muted-foreground ml-2">${formatArray(p.items)}</span>` : ''}
                  </div>
                  <button type="button" data-action="remove-purchase" data-purchase-id="${p.purchaseId}" class="text-red-400 hover:text-red-300 text-[10px]">remover</button>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;

    this.bindListeners();
  }

  private renderEditableField(key: string, displayValue: string): string {
    const field = this.editableFields.get(key);
    const value = field?.value ?? displayValue;
    const status = field?.status ?? 'idle';
    const isUpdated = this.updatedFields.has(key);

    return `
      <div class="flex items-center gap-1 ${isUpdated && value ? 'campo-atualizado' : ''}">
        <input
          type="text"
          data-field="${key}"
          value="${escapeHtml(value)}"
          class="flex-1 bg-transparent border border-transparent hover:border-border/50 focus:border-primary/50 rounded px-1 py-0.5 text-foreground outline-none text-[11px]"
        />
        ${getSaveStatusIcon(status)}
        ${isUpdated && value && value !== '—' ? '<span class="badge-novo">✨novo</span>' : ''}
      </div>
    `;
  }

  private renderEditableFieldInline(key: string, displayValue: string): string {
    const field = this.editableFields.get(key);
    const value = field?.value ?? displayValue;
    const status = field?.status ?? 'idle';
    const isUpdated = this.updatedFields.has(key);

    return `
      <div class="flex items-center gap-1 ${isUpdated && value ? 'campo-atualizado' : ''}">
        <input
          type="text"
          data-field="${key}"
          value="${escapeHtml(value)}"
          class="flex-1 min-w-0 bg-transparent border border-transparent hover:border-border/50 focus:border-primary/50 rounded px-1 py-0.5 text-foreground outline-none text-[10px]"
        />
        ${isUpdated && value && value !== '—' ? '<span class="badge-novo shrink-0">✨novo</span>' : ''}
      </div>
    `;
  }

  private renderPurchaseForm(): string {
    return `
      <div class="space-y-2 p-2 bg-background/30 rounded border border-border/20">
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-muted-foreground text-[10px]">Data</label>
            <input type="date" data-purchase-field="purchaseDate" value="${this.purchaseFormData.purchaseDate}"
              class="w-full bg-transparent border border-border/50 rounded px-2 py-1 text-[11px] text-foreground" />
          </div>
          <div>
            <label class="text-muted-foreground text-[10px]">Valor (R$)</label>
            <input type="number" data-purchase-field="value" value="${this.purchaseFormData.value}" placeholder="0,00"
              class="w-full bg-transparent border border-border/50 rounded px-2 py-1 text-[11px] text-foreground" />
          </div>
        </div>
        <div>
          <label class="text-muted-foreground text-[10px]">Itens (separados por vírgula)</label>
          <input type="text" data-purchase-field="items" value="${escapeHtml(this.purchaseFormData.items)}" placeholder="pizza, refrigerante"
            class="w-full bg-transparent border border-border/50 rounded px-2 py-1 text-[11px] text-foreground" />
        </div>
        <div>
          <label class="text-muted-foreground text-[10px]">Observações</label>
          <input type="text" data-purchase-field="notes" value="${escapeHtml(this.purchaseFormData.notes)}" placeholder="obs..."
            class="w-full bg-transparent border border-border/50 rounded px-2 py-1 text-[11px] text-foreground" />
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" data-action="save-purchase" class="px-3 py-1 bg-primary text-primary-foreground rounded text-[11px] font-medium hover:opacity-90 disabled:opacity-50" ${this.savingPurchase ? 'disabled' : ''}>
            ${this.savingPurchase ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    `;
  }

  private bindListeners(): void {
    if (!this.container) return;

    const refreshButton = this.container.querySelector('[data-action="refresh"]');
    if (refreshButton instanceof HTMLButtonElement) {
      refreshButton.addEventListener('click', () => {
        void this.loadFixture();
      });
    }

    const toggleFormButton = this.container.querySelector('[data-action="toggle-purchase-form"]');
    if (toggleFormButton instanceof HTMLButtonElement) {
      toggleFormButton.addEventListener('click', () => {
        this.showPurchaseForm = !this.showPurchaseForm;
        this.renderContent();
      });
    }

    const savePurchaseButton = this.container.querySelector('[data-action="save-purchase"]');
    if (savePurchaseButton instanceof HTMLButtonElement) {
      savePurchaseButton.addEventListener('click', () => {
        void this.savePurchase();
      });
    }

    this.container.querySelectorAll('[data-action="remove-purchase"]').forEach((btn) => {
      if (btn instanceof HTMLButtonElement) {
        btn.addEventListener('click', () => {
          const purchaseId = btn.dataset.purchaseId;
          if (purchaseId) {
            void this.removePurchase(purchaseId);
          }
        });
      }
    });

    this.container.querySelectorAll('[data-field]').forEach((input) => {
      if (input instanceof HTMLInputElement) {
        const fieldKey = input.dataset.field;
        if (!fieldKey) return;

        input.addEventListener('blur', () => {
          const newValue = input.value;
          const field = this.editableFields.get(fieldKey);
          if (field && field.value !== newValue) {
            void this.saveField(fieldKey, newValue);
          }
        });

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            input.blur();
          }
        });
      }
    });

    this.container.querySelectorAll('[data-purchase-field]').forEach((input) => {
      if (input instanceof HTMLInputElement) {
        input.addEventListener('input', () => {
          const field = input.dataset.purchaseField as keyof PurchaseFormData;
          if (field) {
            this.purchaseFormData[field] = input.value;
          }
        });
      }
    });
  }
}