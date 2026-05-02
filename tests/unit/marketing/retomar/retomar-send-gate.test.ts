import { describe, expect, it } from 'vitest';
import { evaluateRetomarSendGate } from '../../../../src/modules/marketing/retomar/retomar-send-gate';

describe('evaluateRetomarSendGate', () => {
  const noon = new Date('2026-04-09T12:00:00.000Z');

  it('permite 1.ª tentativa (contador 0) com qualquer índice de faixa 0–3', () => {
    for (let i = 0; i <= 3; i++) {
      const r = evaluateRetomarSendGate({
        now: noon,
        contador: 0,
        pendingRangeIndex: i,
        minDistance: 21,
        lastOutgoingFromWhatsApp: null,
      });
      expect(r.ok).toBe(true);
    }
  });

  it('bloqueia quando contador > 0 e índice da fila não bate', () => {
    const r = evaluateRetomarSendGate({
      now: noon,
      contador: 2,
      pendingRangeIndex: 1,
      minDistance: 21,
      lastOutgoingFromWhatsApp: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('contador=2');
  });

  it('permite quando contador alinha com índice', () => {
    const r = evaluateRetomarSendGate({
      now: noon,
      contador: 2,
      pendingRangeIndex: 2,
      minDistance: 21,
      lastOutgoingFromWhatsApp: new Date('2026-03-01T12:00:00.000Z'),
    });
    expect(r.ok).toBe(true);
  });

  it('bloqueia ciclo completo', () => {
    const r = evaluateRetomarSendGate({
      now: noon,
      contador: 4,
      pendingRangeIndex: 3,
      minDistance: 21,
      lastOutgoingFromWhatsApp: null,
    });
    expect(r.ok).toBe(false);
  });

  it('bloqueia se último envio está dentro do respiro mínimo', () => {
    const r = evaluateRetomarSendGate({
      now: noon,
      contador: 1,
      pendingRangeIndex: 1,
      minDistance: 21,
      lastOutgoingFromWhatsApp: new Date('2026-04-01T12:00:00.000Z'),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('Respiro mínimo');
  });

  it('rejeita índice fora de 0–3', () => {
    const r = evaluateRetomarSendGate({
      now: noon,
      contador: 0,
      pendingRangeIndex: 4,
      minDistance: 21,
      lastOutgoingFromWhatsApp: null,
    });
    expect(r.ok).toBe(false);
  });
});
