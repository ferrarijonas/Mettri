import type { MettriBridgeClient } from '../../content/bridge-client';
import type { CatalogProduct } from '../../storage/catalogo-db';
import { listarProdutosCatalogo } from '../catalogo';
import { avaliarElegibilidadeDeCampanha, listarCampanhas } from '../campanhas';
import type { CampaignEligibilityInput } from '../campanhas/types';
import type { CampanhaComElegibilidade, OpportunityContext } from './types';

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function heuristicMargem(precoCentavos: number): number {
  return clamp01(precoCentavos / 80_000);
}

function heuristicPressaoEstoque(estoque: number | null): number {
  if (estoque === null) return 0.15;
  if (estoque > 50) return 0.95;
  if (estoque > 20) return 0.65;
  if (estoque > 5) return 0.35;
  return 0.2;
}

function produtosParaRecomendacoes(
  products: CatalogProduct[],
  vantagemLogisticaPreview: number
): OpportunityContext['vitrine']['recomendacoes'] {
  return products
    .filter(p => p.ativo)
    .map(p => ({
      sku: p.sku,
      nome: p.nome,
      preco: p.precoCentavos / 100,
      estoqueDisponivel: p.estoqueDisponivel,
      margemScore: heuristicMargem(p.precoCentavos),
      pressaoEstoqueScore: heuristicPressaoEstoque(p.estoqueDisponivel),
      vantagemLogisticaScore: clamp01(vantagemLogisticaPreview),
      validadeAteIso: undefined,
      urgenciaValidadeScore: 0,
    }));
}

export interface MontarContextoInput {
  chatId: string;
  accountId: string;
  instanteIso: string;
  turnoAtual: { clienteTexto: string; atendenteTexto?: string };
  clienteNome?: string;
  aderenciaScore?: number;
  contactSnapshot: CampaignEligibilityInput['contactSnapshot'];
  atendimentoSnapshot?: CampaignEligibilityInput['atendimentoSnapshot'];
  retomarSnapshot?: CampaignEligibilityInput['retomarSnapshot'];
  frequencySnapshot?: CampaignEligibilityInput['frequencySnapshot'];
  /** 0..1 — apenas preview até existir rota real */
  vantagemLogisticaPreview?: number;
  metadadosSource?: 'atendimento' | 'preview';
}

export async function montarContextoDeOportunidade(
  bridge: MettriBridgeClient,
  input: MontarContextoInput
): Promise<OpportunityContext> {
  const listCamp = await listarCampanhas(bridge, input.accountId);
  const campaigns = listCamp.ok ? listCamp.data : [];

  const campanhasAtivasElegiveis: CampanhaComElegibilidade[] = [];
  for (const campaign of campaigns) {
    if (campaign.status !== 'active') continue;
    const eligibility = avaliarElegibilidadeDeCampanha({
      campaign,
      chatId: input.chatId,
      accountId: input.accountId,
      nowIso: input.instanteIso,
      contactSnapshot: input.contactSnapshot,
      retomarSnapshot: input.retomarSnapshot,
      atendimentoSnapshot: input.atendimentoSnapshot,
      frequencySnapshot: input.frequencySnapshot,
    });
    if (eligibility.eligible) {
      campanhasAtivasElegiveis.push({ campaign, eligibility });
    }
  }

  const cat = await listarProdutosCatalogo(input.accountId, { ativo: true });
  const products = cat.ok ? cat.data.products : [];
  const vLog = input.vantagemLogisticaPreview ?? 0;

  return {
    chatId: input.chatId,
    accountId: input.accountId,
    instanteIso: input.instanteIso,
    turnoAtual: input.turnoAtual,
    cliente: {
      nome: input.clienteNome,
      aderenciaScore: clamp01(input.aderenciaScore ?? 0.55),
      perfilFactual: undefined,
    },
    campanhasAtivasElegiveis,
    vitrine: {
      recomendacoes: produtosParaRecomendacoes(products, vLog),
    },
    metadados: {
      source: input.metadadosSource ?? 'preview',
      version: '1',
    },
  };
}
