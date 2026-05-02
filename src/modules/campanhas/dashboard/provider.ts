import type { MettriBridgeClient } from '../../../content/bridge-client';
import { catalogoDB } from '../../../storage/catalogo-db';
import type { Campaign } from '../types';
import { listarCampanhas } from '../campaign-crud';
import type { CampanhaListItemVm, CampanhasDashboardVm, CampanhasEditorVm } from './view-model';

const UI_ACTOR = 'mettri-campanhas-ui';

const TIPO_LABELS: Record<Campaign['tipo'], string> = {
  giro_validade: 'Giro validade',
  giro_estoque: 'Giro estoque',
  margem_inteligente: 'Margem inteligente',
  promo_comercial: 'Promo comercial',
  lancamento_produto: 'Lançamento',
  oportunidade_hiperlocal: 'Oportunidade hiperlocal',
  recompra_prevista: 'Recompra prevista',
  upsell_cross_sell: 'Upsell / cross-sell',
};

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(s: string): string {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function getCampanhasAccountId(): string {
  return catalogoDB.getCurrentUserWid() || 'default';
}

export function getUiActor(): string {
  return UI_ACTOR;
}

export function defaultEditor(): CampanhasEditorVm {
  const start = new Date();
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    mode: 'new',
    campaignId: null,
    nome: '',
    tipo: 'promo_comercial',
    modo: 'always_on',
    status: 'draft',
    objetivo: '',
    prioridadeText: '0.5',
    skusText: '',
    estoqueMinText: '',
    janelaStart: toDatetimeLocal(start.toISOString()),
    janelaEnd: toDatetimeLocal(end.toISOString()),
    timezone: 'America/Sao_Paulo',
    dedupeHours: '24',
    maxSends: '3',
  };
}

export function campaignToEditor(c: Campaign): CampanhasEditorVm {
  return {
    mode: 'edit',
    campaignId: c.campaignId,
    nome: c.nome,
    tipo: c.tipo,
    modo: c.modo,
    status: c.status,
    objetivo: c.objetivo,
    prioridadeText: String(c.prioridadeNormalizada ?? 0.5),
    skusText: (c.skusAlvo ?? []).join(', '),
    estoqueMinText: c.estoqueMinimoParaGiro != null ? String(c.estoqueMinimoParaGiro) : '',
    janelaStart: c.janela ? toDatetimeLocal(c.janela.startsAtIso) : '',
    janelaEnd: c.janela ? toDatetimeLocal(c.janela.endsAtIso) : '',
    timezone: c.janela?.timezone ?? 'America/Sao_Paulo',
    dedupeHours: String(c.guardrails.dedupeByChatWindowHours),
    maxSends: String(c.guardrails.maxSendsPerChatInPeriod),
  };
}

function parseSkus(text: string): string[] | undefined {
  const parts = text
    .split(/[,;\n]+/)
    .map(s => s.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

export function editorToNewCampaignPayload(
  editor: CampanhasEditorVm
): Omit<Campaign, 'campaignId' | 'createdAtIso' | 'updatedAtIso'> {
  const prioridade = parseFloat(editor.prioridadeText.replace(',', '.'));
  const dedupe = Math.max(0, parseInt(editor.dedupeHours, 10) || 0);
  const maxSends = Math.max(1, parseInt(editor.maxSends, 10) || 1);
  const janela =
    editor.modo === 'periodo'
      ? {
          startsAtIso: fromDatetimeLocal(editor.janelaStart),
          endsAtIso: fromDatetimeLocal(editor.janelaEnd),
          timezone: editor.timezone.trim() || 'America/Sao_Paulo',
        }
      : undefined;
  const estRaw = editor.estoqueMinText.trim();
  const estMin = estRaw ? Math.max(0, parseInt(editor.estoqueMinText, 10) || 0) : undefined;

  return {
    nome: editor.nome.trim(),
    tipo: editor.tipo,
    modo: editor.modo,
    status: 'draft',
    objetivo: editor.objetivo.trim() || '—',
    canais: ['whatsapp'],
    publico: {},
    guardrails: {
      requireHumanApproval: true,
      dedupeByChatWindowHours: dedupe,
      maxSendsPerChatInPeriod: maxSends,
    },
    createdBy: UI_ACTOR,
    updatedBy: UI_ACTOR,
    skusAlvo: parseSkus(editor.skusText),
    prioridadeNormalizada: Number.isFinite(prioridade) ? Math.min(1, Math.max(0, prioridade)) : 0.5,
    estoqueMinimoParaGiro: estMin,
    janela,
  };
}

export function editorToPatch(editor: CampanhasEditorVm): Partial<Campaign> {
  const prioridade = parseFloat(editor.prioridadeText.replace(',', '.'));
  const dedupe = Math.max(0, parseInt(editor.dedupeHours, 10) || 0);
  const maxSends = Math.max(1, parseInt(editor.maxSends, 10) || 1);
  const janela =
    editor.modo === 'periodo'
      ? {
          startsAtIso: fromDatetimeLocal(editor.janelaStart),
          endsAtIso: fromDatetimeLocal(editor.janelaEnd),
          timezone: editor.timezone.trim() || 'America/Sao_Paulo',
        }
      : undefined;
  const estRaw = editor.estoqueMinText.trim();
  const estMin = estRaw ? Math.max(0, parseInt(editor.estoqueMinText, 10) || 0) : undefined;

  const patch: Partial<Campaign> = {
    nome: editor.nome.trim(),
    tipo: editor.tipo,
    modo: editor.modo,
    objetivo: editor.objetivo.trim() || '—',
    skusAlvo: parseSkus(editor.skusText),
    prioridadeNormalizada: Number.isFinite(prioridade) ? Math.min(1, Math.max(0, prioridade)) : undefined,
    estoqueMinimoParaGiro: estMin,
    guardrails: {
      requireHumanApproval: true,
      dedupeByChatWindowHours: dedupe,
      maxSendsPerChatInPeriod: maxSends,
    },
  };
  if (editor.modo === 'always_on') {
    patch.janela = undefined;
  } else {
    patch.janela = janela;
  }
  return patch;
}

export async function getCampanhasDashboardViewModel(
  bridge: MettriBridgeClient,
  params: { activeTab: 'lista' | 'simulador'; editor: CampanhasEditorVm; operationError?: string | null }
): Promise<CampanhasDashboardVm> {
  const accountId = getCampanhasAccountId();
  const list = await listarCampanhas(bridge, accountId);
  if (!list.ok) {
    return {
      accountId,
      activeTab: params.activeTab,
      items: [],
      editor: params.editor,
      listError: list.message,
      operationError: params.operationError ?? null,
    };
  }
  const items: CampanhaListItemVm[] = list.data.map(c => ({
    campaignId: c.campaignId,
    nome: c.nome,
    tipo: c.tipo,
    tipoLabel: TIPO_LABELS[c.tipo],
    modo: c.modo,
    status: c.status,
    prioridade: c.prioridadeNormalizada,
    updatedAtIso: c.updatedAtIso,
  }));
  return {
    accountId,
    activeTab: params.activeTab,
    items,
    editor: params.editor,
    listError: null,
    operationError: params.operationError ?? null,
  };
}

export { TIPO_LABELS };
