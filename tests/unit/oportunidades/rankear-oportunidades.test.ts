import { describe, expect, it, vi } from 'vitest';
import { rankearOportunidades } from '../../../src/modules/oportunidades/rankear-oportunidades';
import type { Opportunity } from '../../../src/modules/oportunidades/types';

function opp(partial: Partial<Opportunity> & Pick<Opportunity, 'opportunityId' | 'sku' | 'titulo'>): Opportunity {
  return {
    campanhaPrioridadeScore: 0,
    urgenciaValidadeScore: 0,
    margemScore: 0,
    pressaoEstoqueScore: 0,
    vantagemLogisticaScore: 0,
    aderenciaClienteScore: 0,
    rankingScore: 0,
    rankingTuple: [0, 0, 0, 0, 0, 0, partial.opportunityId],
    rationale: [],
    ...partial,
  };
}

describe('rankearOportunidades', () => {
  it('ordena por score e desempata por opportunityId crescente', () => {
    const a = opp({
      opportunityId: 'opp_b',
      sku: '1',
      titulo: 'B',
      campanhaPrioridadeScore: 0.5,
      margemScore: 0.5,
    });
    const b = opp({
      opportunityId: 'opp_a',
      sku: '2',
      titulo: 'A',
      campanhaPrioridadeScore: 0.5,
      margemScore: 0.5,
    });
    const ranked = rankearOportunidades([a, b]);
    expect(ranked.map(x => x.opportunityId)).toEqual(['opp_a', 'opp_b']);
  });

  it('lista vazia retorna vazia', () => {
    expect(rankearOportunidades([])).toEqual([]);
  });

  it('aplica clamp e ignora NaN com warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const x = opp({
      opportunityId: 'opp_1',
      sku: 's',
      titulo: 'T',
      margemScore: NaN,
      campanhaPrioridadeScore: 2,
    });
    const [r] = rankearOportunidades([x]);
    expect(r.margemScore).toBe(0);
    expect(r.campanhaPrioridadeScore).toBe(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('é reprodutível com mesmo input', () => {
    const input = [
      opp({ opportunityId: 'z', sku: 'z', titulo: 'Z', urgenciaValidadeScore: 0.9 }),
      opp({ opportunityId: 'y', sku: 'y', titulo: 'Y', urgenciaValidadeScore: 0.2 }),
    ];
    const a = rankearOportunidades(input);
    const b = rankearOportunidades(input);
    expect(a.map(o => o.opportunityId)).toEqual(b.map(o => o.opportunityId));
  });
});
