import type { Campaign, CampaignMode, CampaignStatus, CampaignType } from './types';

const CAMPAIGN_TYPES: ReadonlySet<CampaignType> = new Set([
  'giro_validade',
  'giro_estoque',
  'margem_inteligente',
  'promo_comercial',
  'lancamento_produto',
  'oportunidade_hiperlocal',
  'recompra_prevista',
  'upsell_cross_sell',
]);

function isIsoReasonable(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export type CampaignValidationResult =
  | { ok: true }
  | { ok: false; errorCode: 'INVALID_INPUT'; message: string };

export function validateCampaignDraft(campaign: Campaign): CampaignValidationResult {
  if (!campaign.nome.trim()) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'Nome da campanha é obrigatório.' };
  }
  if (!CAMPAIGN_TYPES.has(campaign.tipo)) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'Tipo de campanha inválido.' };
  }
  const modo: CampaignMode = campaign.modo;
  if (modo !== 'always_on' && modo !== 'periodo') {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'Modo de campanha inválido.' };
  }
  const status: CampaignStatus = campaign.status;
  if (!['draft', 'active', 'paused', 'ended'].includes(status)) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'Status inválido.' };
  }
  if (!campaign.canais.includes('whatsapp')) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'Canal WhatsApp é obrigatório.' };
  }
  if (campaign.guardrails.requireHumanApproval !== true) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'requireHumanApproval deve ser true.' };
  }
  if (campaign.guardrails.dedupeByChatWindowHours < 0) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'dedupeByChatWindowHours inválido.' };
  }
  if (campaign.guardrails.maxSendsPerChatInPeriod < 1) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'maxSendsPerChatInPeriod deve ser >= 1.' };
  }
  if (modo === 'periodo') {
    const j = campaign.janela;
    if (!j) {
      return { ok: false, errorCode: 'INVALID_INPUT', message: 'Campanha em modo período exige janela.' };
    }
    if (!isIsoReasonable(j.startsAtIso) || !isIsoReasonable(j.endsAtIso)) {
      return { ok: false, errorCode: 'INVALID_INPUT', message: 'Datas da janela inválidas.' };
    }
    if (Date.parse(j.endsAtIso) < Date.parse(j.startsAtIso)) {
      return { ok: false, errorCode: 'INVALID_INPUT', message: 'Janela invertida (fim antes do início).' };
    }
  }
  const p = campaign.prioridadeNormalizada;
  if (p !== undefined && (p < 0 || p > 1)) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'prioridadeNormalizada deve estar entre 0 e 1.' };
  }
  const e = campaign.estoqueMinimoParaGiro;
  if (e !== undefined && (!Number.isFinite(e) || e < 0)) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'estoqueMinimoParaGiro inválido.' };
  }
  return { ok: true };
}
