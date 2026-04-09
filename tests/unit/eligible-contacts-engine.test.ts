import { describe, expect, it } from 'vitest';
import {
  computeEligibleContacts,
  computeEligibleContactsDiagnostics,
} from '../../src/modules/marketing/retomar/eligible-contacts-engine';

describe('eligible-contacts-engine', () => {
  it('com contador > 0 só elegível quando faixa de dias bate com o contador', () => {
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
        { min: 116, max: 168 },
      ],
      minDistance: 21,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.chatId).toBe('a@c.us');
    expect(result[0]?.rangeIndex).toBe(0);
  });

  it('contador 0: elegível em qualquer faixa (ex.: lista importada, compra antiga)', () => {
    const now = new Date(2026, 3, 8, 12, 0, 0);
    const result = computeEligibleContacts({
      now,
      lastActivityByChat: new Map([
        // ~130 dias → ainda na 4ª faixa (teto 168 para régua frequente)
        ['old@c.us', { chatId: 'old@c.us', chatName: 'Velho', date: new Date(2025, 10, 28, 10, 0, 0) }],
        ['mid@c.us', { chatId: 'mid@c.us', chatName: 'Médio', date: new Date(2026, 1, 1, 10, 0, 0) }], // ~66 dias → faixa 1
      ]),
      lastOutgoingByContact: new Map(),
      contadorByChat: {},
      ranges: [
        { min: 21, max: 41 },
        { min: 42, max: 72 },
        { min: 73, max: 115 },
        { min: 116, max: 168 },
      ],
      minDistance: 21,
    });

    expect(result).toHaveLength(2);
    const byId = new Map(result.map(r => [r.chatId, r]));
    expect(byId.get('mid@c.us')?.rangeIndex).toBe(1);
    expect(byId.get('old@c.us')?.rangeIndex).toBe(3);
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
        { min: 116, max: 168 },
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
        { min: 116, max: 168 },
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
        { min: 116, max: 168 },
      ],
      minDistance: 21,
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.chatId).toBe('b@c.us');
    expect(result[1]?.chatId).toBe('a@c.us');
  });

  it('diagnostics: soma dos motivos = totalScanned; outgoing recente conta faixa', () => {
    const now = new Date(2026, 1, 18, 10, 0, 0);
    const ranges = [
      { min: 21, max: 41 },
      { min: 42, max: 72 },
      { min: 73, max: 115 },
      { min: 116, max: 168 },
    ];
    const { eligible, stats } = computeEligibleContactsDiagnostics({
      now,
      lastActivityByChat: new Map([
        ['listed@c.us', { chatId: 'listed@c.us', chatName: 'L', date: new Date(2026, 0, 20, 9, 0, 0) }],
        ['future@c.us', { chatId: 'future@c.us', chatName: 'F', date: new Date(2026, 2, 1, 9, 0, 0) }],
        ['young@c.us', { chatId: 'young@c.us', chatName: 'Y', date: new Date(2026, 1, 10, 9, 0, 0) }],
        ['badcnt@c.us', { chatId: 'badcnt@c.us', chatName: 'BC', date: new Date(2026, 0, 20, 9, 0, 0) }],
        ['out1@c.us', { chatId: 'out1@c.us', chatName: 'O1', date: new Date(2026, 0, 20, 9, 0, 0) }],
        ['ok@c.us', { chatId: 'ok@c.us', chatName: 'OK', date: new Date(2026, 0, 20, 9, 0, 0) }],
      ]),
      lastOutgoingByContact: new Map([['out1@c.us', { lastOutgoingAt: new Date(2026, 1, 10, 10, 0, 0) }]]),
      contadorByChat: { 'badcnt@c.us': 2 },
      ranges,
      minDistance: 21,
      chatIdsInLists: new Set(['listed@c.us']),
    });

    const sum =
      stats.excludedInList +
      stats.excludedNegativeDays +
      stats.excludedOutsideRegua +
      stats.excludedContadorComplete +
      stats.excludedContadorMismatch +
      stats.excludedRecentOutgoing +
      stats.included;

    expect(stats.totalScanned).toBe(6);
    expect(sum).toBe(stats.totalScanned);
    expect(stats.excludedInList).toBe(1);
    expect(stats.excludedNegativeDays).toBe(1);
    expect(stats.excludedOutsideRegua).toBe(1);
    expect(stats.excludedContadorMismatch).toBe(1);
    expect(stats.excludedRecentOutgoing).toBe(1);
    expect(stats.recentOutgoingBlockedPerRange[0]).toBe(1);
    expect(eligible).toHaveLength(1);
    expect(eligible[0]?.chatId).toBe('ok@c.us');
  });
});
