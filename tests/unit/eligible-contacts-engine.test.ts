import { describe, expect, it } from 'vitest';
import { computeEligibleContacts } from '../../src/modules/marketing/retomar/eligible-contacts-engine';

describe('eligible-contacts-engine', () => {
  it('deve retornar apenas contatos elegiveis da faixa atual do contador', () => {
    const now = new Date(2026, 1, 18, 10, 0, 0);
    const result = computeEligibleContacts({
      now,
      lastActivityByChat: new Map([
        ['a@c.us', { chatId: 'a@c.us', chatName: 'A', date: new Date(2026, 0, 20, 9, 0, 0) }], // 29 dias
        ['b@c.us', { chatId: 'b@c.us', chatName: 'B', date: new Date(2026, 0, 10, 9, 0, 0) }], // 39 dias
      ]),
      lastOutgoingByContact: new Map(),
      contadorByChat: {
        'a@c.us': 0,
        'b@c.us': 1,
      },
      ranges: [
        { min: 21, max: 41 },
        { min: 42, max: 72 },
        { min: 73, max: 115 },
        { min: 116, max: Infinity },
      ],
      minDistance: 21,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.chatId).toBe('a@c.us');
    expect(result[0]?.rangeIndex).toBe(0);
  });

  it('deve excluir quando nao respeita distancia minima entre envios', () => {
    const now = new Date(2026, 1, 18, 10, 0, 0);
    const result = computeEligibleContacts({
      now,
      lastActivityByChat: new Map([
        ['a@c.us', { chatId: 'a@c.us', chatName: 'A', date: new Date(2026, 0, 20, 9, 0, 0) }],
      ]),
      lastOutgoingByContact: new Map([
        ['a@c.us', { lastOutgoingAt: new Date(2026, 1, 10, 10, 0, 0) }], // 8 dias
      ]),
      contadorByChat: {
        'a@c.us': 0,
      },
      ranges: [
        { min: 21, max: 41 },
        { min: 42, max: 72 },
        { min: 73, max: 115 },
        { min: 116, max: Infinity },
      ],
      minDistance: 21,
    });

    expect(result).toHaveLength(0);
  });

  it('deve excluir contatos que estao em listas', () => {
    const now = new Date(2026, 1, 18, 10, 0, 0);
    const result = computeEligibleContacts({
      now,
      lastActivityByChat: new Map([
        ['a@c.us', { chatId: 'a@c.us', chatName: 'A', date: new Date(2026, 0, 20, 9, 0, 0) }],
      ]),
      lastOutgoingByContact: new Map(),
      contadorByChat: {
        'a@c.us': 0,
      },
      ranges: [
        { min: 21, max: 41 },
        { min: 42, max: 72 },
        { min: 73, max: 115 },
        { min: 116, max: Infinity },
      ],
      minDistance: 21,
      chatIdsInLists: new Set(['a@c.us']),
    });

    expect(result).toHaveLength(0);
  });

  it('deve ordenar por mais inativos primeiro', () => {
    const now = new Date(2026, 1, 18, 10, 0, 0);
    const result = computeEligibleContacts({
      now,
      lastActivityByChat: new Map([
        ['a@c.us', { chatId: 'a@c.us', chatName: 'A', date: new Date(2026, 0, 20, 9, 0, 0) }], // 29
        ['b@c.us', { chatId: 'b@c.us', chatName: 'B', date: new Date(2026, 0, 1, 9, 0, 0) }], // 48
      ]),
      lastOutgoingByContact: new Map(),
      contadorByChat: {
        'a@c.us': 0,
        'b@c.us': 1,
      },
      ranges: [
        { min: 21, max: 41 },
        { min: 42, max: 72 },
        { min: 73, max: 115 },
        { min: 116, max: Infinity },
      ],
      minDistance: 21,
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.chatId).toBe('b@c.us');
    expect(result[1]?.chatId).toBe('a@c.us');
  });
});
