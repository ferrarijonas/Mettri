import type { Campaign } from '../campanhas/types';
import type { Opportunity, OpportunityContext } from './types';

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function campaignMatchesSku(c: Campaign, sku: string): boolean {
  const alvo = c.skusAlvo;
  if (!alvo?.length) return true;
  return alvo.some(s => s.toLowerCase() === sku.toLowerCase());
}

function campaignBoost(
  c: Campaign,
  sku: string,
  estoque: number | null
): { score: number; id?: string; label: string } {
  if (!campaignMatchesSku(c, sku)) {
    return { score: 0, label: 'SKU fora do alvo da campanha' };
  }
  if (c.tipo === 'giro_estoque') {
    const min = c.estoqueMinimoParaGiro ?? 1;
    const e = estoque ?? 0;
    if (e < min) {
      return { score: 0, label: 'Estoque abaixo do mínimo da campanha de giro' };
    }
  }
  const score = clamp01(c.prioridadeNormalizada ?? 0.45);
  return { score, id: c.campaignId, label: c.nome };
}

/**
 * Gera uma oportunidade por item da vitrine; prioridade de campanha = máximo entre campanhas elegíveis que casam.
 */
export function detectarOportunidadesPorChat(context: OpportunityContext): Opportunity[] {
  const elegiveis = context.campanhasAtivasElegiveis.filter(x => x.eligibility.eligible);
  const out: Opportunity[] = [];

  for (const reco of context.vitrine.recomendacoes) {
    let bestScore = 0;
    let bestId: string | undefined;
    let bestNome: string | undefined;
    const rationale: string[] = ['Item ativo no catálogo de preview.'];

    for (const { campaign } of elegiveis) {
      const b = campaignBoost(campaign, reco.sku, reco.estoqueDisponivel);
      if (b.score > bestScore) {
        bestScore = b.score;
        bestId = b.id;
        bestNome = b.label;
      }
      if (b.score > 0) {
        rationale.push(`Campanha "${b.label}" reforça oferta (+${b.score.toFixed(2)}).`);
      }
    }

    if (bestScore === 0 && elegiveis.length > 0) {
      rationale.push('Nenhuma campanha elegível casou com este SKU.');
    }

    const opportunityId = `opp_${reco.sku}_${bestId ?? 'sem_campanha'}`;
    out.push({
      opportunityId,
      sku: reco.sku,
      titulo: reco.nome,
      campanhaId: bestId,
      campanhaPrioridadeScore: bestScore,
      urgenciaValidadeScore: reco.urgenciaValidadeScore,
      margemScore: reco.margemScore,
      pressaoEstoqueScore: reco.pressaoEstoqueScore,
      vantagemLogisticaScore: reco.vantagemLogisticaScore,
      aderenciaClienteScore: context.cliente.aderenciaScore,
      rankingScore: 0,
      rankingTuple: [0, 0, 0, 0, 0, 0, opportunityId],
      rationale: bestNome ? [`Campanha principal: ${bestNome}`, ...rationale] : rationale,
    });
  }

  return out;
}
