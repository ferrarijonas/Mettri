import { describe, it, expect } from 'vitest';
import { daysBetweenByCalendar } from '../../src/modules/marketing/retomar/inactive-days';

describe('inactive-days', () => {
  it('deve calcular 21 dias (3 semanas) por calendário', () => {
    // 30/01/2026 é sexta-feira. 09/01/2026 é sexta-feira (3 sextas atrás).
    const now = new Date(2026, 0, 30, 12, 0, 0);
    const lastIncoming = new Date(2026, 0, 9, 8, 0, 0);
    expect(daysBetweenByCalendar(now, lastIncoming)).toBe(21);
  });

  it('não deve ser afetado por horário (23:59 vs 00:01)', () => {
    const now = new Date(2026, 0, 30, 0, 1, 0);
    const lastIncoming = new Date(2026, 0, 9, 23, 59, 0);
    expect(daysBetweenByCalendar(now, lastIncoming)).toBe(21);
  });
});

