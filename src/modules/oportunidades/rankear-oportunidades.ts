import type { Opportunity } from './types';

function clamp01(n: number): number {
  if (Number.isNaN(n)) {
    console.warn('[rankearOportunidades] Fator NaN tratado como 0.');
    return 0;
  }
  return Math.min(1, Math.max(0, n));
}

/**
 * Ranking determinístico (ZenSpec: rankear-oportunidades.zenspec.md).
 * Metáfora: fila do hospital — critérios fixos, sem sorte.
 */
export function rankearOportunidades(opportunities: Opportunity[]): Opportunity[] {
  if (!Array.isArray(opportunities)) return [];

  const scored = opportunities.map(opp => {
    const urgenciaValidadeScore = clamp01(opp.urgenciaValidadeScore);
    const campanhaPrioridadeScore = clamp01(opp.campanhaPrioridadeScore);
    const margemScore = clamp01(opp.margemScore);
    const pressaoEstoqueScore = clamp01(opp.pressaoEstoqueScore);
    const vantagemLogisticaScore = clamp01(opp.vantagemLogisticaScore);
    const aderenciaClienteScore = clamp01(opp.aderenciaClienteScore);

    const rankingScore =
      0.24 * urgenciaValidadeScore +
      0.22 * campanhaPrioridadeScore +
      0.16 * margemScore +
      0.14 * pressaoEstoqueScore +
      0.12 * vantagemLogisticaScore +
      0.12 * aderenciaClienteScore;

    const rankingTuple: Opportunity['rankingTuple'] = [
      rankingScore,
      urgenciaValidadeScore,
      campanhaPrioridadeScore,
      margemScore,
      pressaoEstoqueScore,
      vantagemLogisticaScore,
      opp.opportunityId,
    ];

    return {
      ...opp,
      urgenciaValidadeScore,
      campanhaPrioridadeScore,
      margemScore,
      pressaoEstoqueScore,
      vantagemLogisticaScore,
      aderenciaClienteScore,
      rankingScore,
      rankingTuple,
    };
  });

  return scored.sort((a, b) => {
    const ta = a.rankingTuple;
    const tb = b.rankingTuple;
    for (let i = 0; i < 6; i++) {
      const diff = (tb[i] as number) - (ta[i] as number);
      if (diff !== 0) return diff;
    }
    return ta[6].localeCompare(tb[6]);
  });
}
