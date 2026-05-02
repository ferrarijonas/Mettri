import { describe, expect, it } from 'vitest';
import { mergeLastOutgoingMaps } from '../../../../src/modules/marketing/retomar/merge-last-outgoing';

describe('mergeLastOutgoingMaps', () => {
  it('usa a data mais recente entre IDB e storage Retomar', () => {
    const idb = new Map([
      [
        '5511@c.us',
        { chatId: '5511@c.us', chatName: 'A', lastOutgoingAt: new Date('2026-01-01T12:00:00Z') },
      ],
    ]);
    const st = { '5511@c.us': '2026-02-01T12:00:00.000Z' };
    const m = mergeLastOutgoingMaps(idb, st);
    expect(m.get('5511@c.us')?.lastOutgoingAt.toISOString()).toBe('2026-02-01T12:00:00.000Z');
  });

  it('IDB mais recente que storage', () => {
    const idb = new Map([
      [
        '5522@c.us',
        { chatId: '5522@c.us', chatName: 'B', lastOutgoingAt: new Date('2026-03-15T10:00:00Z') },
      ],
    ]);
    const st = { '5522@c.us': '2026-01-01T10:00:00.000Z' };
    const m = mergeLastOutgoingMaps(idb, st);
    expect(m.get('5522@c.us')?.lastOutgoingAt.toISOString()).toBe('2026-03-15T10:00:00.000Z');
  });

  it('inclui fallback WA quando mais recente', () => {
    const idb = new Map<string, { chatId: string; chatName: string; lastOutgoingAt: Date }>();
    const st: Record<string, string> = {};
    const wa = new Map([['5533@c.us', new Date('2026-04-01T00:00:00Z')]]);
    const m = mergeLastOutgoingMaps(idb, st, wa);
    expect(m.get('5533@c.us')?.lastOutgoingAt.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('max entre as três fontes', () => {
    const idb = new Map([
      [
        '5544@c.us',
        { chatId: '5544@c.us', chatName: 'D', lastOutgoingAt: new Date('2026-01-10T00:00:00Z') },
      ],
    ]);
    const st = { '5544@c.us': '2026-02-10T00:00:00.000Z' };
    const wa = new Map([['5544@c.us', new Date('2026-03-10T00:00:00Z')]]);
    const m = mergeLastOutgoingMaps(idb, st, wa);
    expect(m.get('5544@c.us')?.lastOutgoingAt.toISOString()).toBe('2026-03-10T00:00:00.000Z');
  });
});
