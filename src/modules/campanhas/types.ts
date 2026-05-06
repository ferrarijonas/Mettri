/**
 * Contratos alinhados a ZenSpecKit/Mettri/Specs/campanhas/spec.md
 * + campos MVP para preview (skusAlvo, prioridade, estoque).
 */

export type CampaignType =
  | 'giro_validade'
  | 'giro_estoque'
  | 'margem_inteligente'
  | 'promo_comercial'
  | 'lancamento_produto'
  | 'oportunidade_hiperlocal'
  | 'recompra_prevista'
  | 'upsell_cross_sell';

export type CampaignMode = 'always_on' | 'periodo';

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'ended';

export interface Campaign {
  campaignId: string;
  nome: string;
  tipo: CampaignType;
  modo: CampaignMode;
  status: CampaignStatus;
  objetivo: string;
  canais: ['whatsapp'];
  publico: {
    includeTags?: string[];
    excludeTags?: string[];
    minDaysInactive?: number;
    maxDaysInactive?: number;
    minRecencyDaysFromPurchase?: number;
    maxRecencyDaysFromPurchase?: number;
    bairrosPermitidos?: string[];
  };
  janela?: {
    startsAtIso: string;
    endsAtIso: string;
    timezone: string;
  };
  guardrails: {
    requireHumanApproval: true;
    dedupeByChatWindowHours: number;
    maxSendsPerChatInPeriod: number;
  };
  createdAtIso: string;
  updatedAtIso: string;
  createdBy: string;
  updatedBy: string;
  /** MVP preview: SKUs explícitos; vazio = heurística ampla no motor de oportunidades */
  skusAlvo?: string[];
  /** 0..1 — usado no ranking de oportunidades */
  prioridadeNormalizada?: number;
  /** Para tipo giro_estoque */
  estoqueMinimoParaGiro?: number;
}

export interface CampaignEligibilityGates {
  statusGate: 'ok' | 'blocked';
  modeGate: 'ok' | 'blocked';
  audienceGate: 'ok' | 'blocked';
  frequencyGate: 'ok' | 'blocked';
  humanGate: 'ok' | 'blocked';
}

export interface CampaignEligibilityOutput {
  eligible: boolean;
  reasons: string[];
  gates: CampaignEligibilityGates;
  nextCheckAtIso?: string;
}

export interface CampaignEligibilityInput {
  campaign: Campaign;
  chatId: string;
  accountId: string;
  nowIso: string;
  contactSnapshot: {
    tags: string[];
    bairro?: string;
    daysInactive?: number;
    daysFromLastPurchase?: number;
    blocked?: boolean;
  };
  retomarSnapshot?: {
    contadorAtual?: 0 | 1 | 2 | 3 | 4;
    lastOutgoingAtIso?: string;
  };
  atendimentoSnapshot?: {
    chatAberto: boolean;
    operadorDisponivel: boolean;
  };
  frequencySnapshot?: {
    sendsInPeriod: number;
    lastSendAtIso?: string;
  };
}
