import { describe, expect, it } from 'vitest';
import { explicarSugestao } from '../../../src/modules/oportunidades/explicar-sugestao';
import type { Opportunity, OpportunityContext } from '../../../src/modules/oportunidades/types';

const baseContext = (): OpportunityContext => ({
  chatId: 'c1',
  accountId: 'acc',
  instanteIso: '2026-01-01T12:00:00.000Z',
  turnoAtual: { clienteTexto: 'oi' },
  cliente: { aderenciaScore: 0.5 },
  campanhasAtivasElegiveis: [],
  vitrine: {
    recomendacoes: [
      {
        sku: 'SKU-1',
        nome: 'Produto Um',
        preco: 10,
        estoqueDisponivel: 5,
        margemScore: 0.5,
        pressaoEstoqueScore: 0.5,
        vantagemLogisticaScore: 0.5,
        urgenciaValidadeScore: 0,
      },
    ],
  },
  metadados: { source: 'preview', version: '1' },
});

describe('explicarSugestao', () => {
  it('retorna null quando ranked vazio', () => {
    expect(explicarSugestao({ context: baseContext(), ranked: [] })).toBeNull();
  });

  it('preenche guardrails e texto quando há top1', () => {
    const ranked: Opportunity[] = [
      {
        opportunityId: 'o1',
        sku: 'SKU-1',
        titulo: 'Produto Um',
        campanhaPrioridadeScore: 0,
        urgenciaValidadeScore: 0,
        margemScore: 0.8,
        pressaoEstoqueScore: 0.1,
        vantagemLogisticaScore: 0.1,
        aderenciaClienteScore: 0.5,
        rankingScore: 0.42,
        rankingTuple: [0.42, 0, 0, 0.8, 0.1, 0.1, 'o1'],
        rationale: [],
      },
    ];
    const s = explicarSugestao({ context: baseContext(), ranked });
    expect(s).not.toBeNull();
    expect(s?.guardrails.requireHumanSend).toBe(true);
    expect(s?.guardrails.autoSendAllowed).toBe(false);
    expect(s?.textoSugerido).toContain('Produto Um');
    expect(s?.explicacaoCurta.length).toBeGreaterThan(10);
  });
});
