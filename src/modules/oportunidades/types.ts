import type { Campaign, CampaignEligibilityOutput } from '../campanhas/types';

/** Campanha ativa com resultado de elegibilidade (estende a costura com campanhas/spec). */
export interface CampanhaComElegibilidade {
  campaign: Campaign;
  eligibility: CampaignEligibilityOutput;
}

export interface VitrineRecomendacaoItem {
  sku: string;
  nome: string;
  preco: number;
  estoqueDisponivel: number | null;
  margemScore: number;
  pressaoEstoqueScore: number;
  vantagemLogisticaScore: number;
  validadeAteIso?: string;
  urgenciaValidadeScore: number;
}

export interface OpportunityContext {
  chatId: string;
  accountId: string;
  instanteIso: string;
  turnoAtual: {
    clienteTexto: string;
    atendenteTexto?: string;
  };
  cliente: {
    customerId?: string;
    nome?: string;
    perfilFactual?: Record<string, unknown>;
    aderenciaScore: number;
  };
  campanhasAtivasElegiveis: CampanhaComElegibilidade[];
  vitrine: {
    recomendacoes: VitrineRecomendacaoItem[];
  };
  metadados: {
    source: 'atendimento' | 'preview';
    version: '1';
  };
}

export interface Opportunity {
  opportunityId: string;
  sku: string;
  titulo: string;
  campanhaId?: string;
  campanhaPrioridadeScore: number;
  urgenciaValidadeScore: number;
  margemScore: number;
  pressaoEstoqueScore: number;
  vantagemLogisticaScore: number;
  aderenciaClienteScore: number;
  rankingScore: number;
  rankingTuple: [number, number, number, number, number, number, string];
  rationale: string[];
}

export interface OfferSuggestion {
  chatId: string;
  opportunityId: string;
  textoSugerido: string;
  explicacaoCurta: string;
  campanhaAplicada?: {
    campanhaId: string;
    nome: string;
  };
  guardrails: {
    requireHumanSend: true;
    autoSendAllowed: false;
  };
}

export interface VitrinePreviewResult {
  context: OpportunityContext;
  opportunitiesRanked: Opportunity[];
  suggestion: OfferSuggestion | null;
}
