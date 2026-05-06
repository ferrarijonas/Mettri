import { describe, expect, it } from 'vitest';
import type { CapturedMessage, MessageDBEntry } from '../../../../src/types/schemas';
import {
  retomarMetricsResolver,
  sortMessagesR2,
} from '../../../../src/modules/marketing/retomar/retomar-metrics-resolver';

function msg(
  p: Partial<CapturedMessage> & Pick<CapturedMessage, 'id' | 'chatId' | 'text' | 'isOutgoing'>,
): CapturedMessage {
  return {
    chatName: p.chatName ?? 'Nome',
    sender: p.sender ?? 'x',
    timestamp: p.timestamp ?? new Date('2025-01-02T12:00:00Z'),
    type: p.type ?? 'text',
    ...p,
  } as CapturedMessage;
}

function sendEntry(
  p: Partial<MessageDBEntry> & Pick<MessageDBEntry, 'id' | 'chatId'>,
): MessageDBEntry {
  return {
    chatName: p.chatName ?? 'Nome',
    sender: p.sender ?? 'me',
    text: p.text ?? 'retomar',
    timestamp: p.timestamp ?? '2025-01-02T12:00:00.000Z',
    isOutgoing: true,
    type: 'text',
    retomarMeta: p.retomarMeta ?? {
      cycleIndex: 1,
      variant: 'A',
      campaignLabel: null,
      accountId: 'acc1',
    },
    ...p,
  } as MessageDBEntry;
}

describe('sortMessagesR2', () => {
  it('ordena por tempo e desempata por id', () => {
    const a = msg({
      id: 'b',
      chatId: 'c',
      text: '2',
      isOutgoing: false,
      timestamp: new Date('2025-01-01T12:00:00Z'),
    });
    const b = msg({
      id: 'a',
      chatId: 'c',
      text: '1',
      isOutgoing: true,
      timestamp: new Date('2025-01-01T12:00:00Z'),
    });
    const out = sortMessagesR2([a, b]);
    expect(out.map(m => m.id)).toEqual(['a', 'b']);
  });
});

describe('retomarMetricsResolver', () => {
  it('um envio e uma incoming depois: 100% e média em minutos correta', async () => {
    const since = new Date('2025-01-01T00:00:00Z');
    const until = new Date('2025-02-01T00:00:00Z');
    const db = {
      getRetomarSends: async (): Promise<MessageDBEntry[]> => [
        sendEntry({
          id: 'out1',
          chatId: '5511@c.us',
          timestamp: '2025-01-02T12:00:00.000Z',
        }),
      ],
      getMessagesByDateRange: async (): Promise<CapturedMessage[]> => [
        msg({
          id: 'cli1',
          chatId: '5511@c.us',
          text: 'ok',
          isOutgoing: false,
          timestamp: new Date('2025-01-02T12:02:00Z'),
        }),
        msg({
          id: 'out1',
          chatId: '5511@c.us',
          text: 'oi',
          isOutgoing: true,
          timestamp: new Date('2025-01-02T12:00:00Z'),
          retomarMeta: { cycleIndex: 1, variant: 'A', campaignLabel: null, accountId: 'acc1' },
        } as CapturedMessage),
      ],
    };
    const r = await retomarMetricsResolver({
      accountId: 'acc1',
      since,
      until,
      cycleIndex: 1,
      messageDB: db,
    });
    expect(r.sentCount).toBe(1);
    expect(r.respondedCount).toBe(1);
    expect(r.responseRate).toBe(100);
    expect(r.avgResponseTimeMinutes).toBe(2);
  });

  it('envio sem incoming: avg null', async () => {
    const since = new Date('2025-01-01T00:00:00Z');
    const until = new Date('2025-02-01T00:00:00Z');
    const db = {
      getRetomarSends: async (): Promise<MessageDBEntry[]> => [
        sendEntry({ id: 'only', chatId: 'x@c.us', timestamp: '2025-01-03T10:00:00.000Z' }),
      ],
      getMessagesByDateRange: async (): Promise<CapturedMessage[]> => [
        msg({
          id: 'only',
          chatId: 'x@c.us',
          text: 'só eu',
          isOutgoing: true,
          timestamp: new Date('2025-01-03T10:00:00Z'),
          retomarMeta: { cycleIndex: 1, variant: 'A', campaignLabel: null, accountId: 'acc1' },
        } as CapturedMessage),
      ],
    };
    const r = await retomarMetricsResolver({
      accountId: 'acc1',
      since,
      until,
      messageDB: db,
    });
    expect(r.sentCount).toBe(1);
    expect(r.respondedCount).toBe(0);
    expect(r.responseRate).toBe(0);
    expect(r.avgResponseTimeMinutes).toBeNull();
  });

  it('sentCount 0: taxa 0 e média null', async () => {
    const db = {
      getRetomarSends: async (): Promise<MessageDBEntry[]> => [],
      getMessagesByDateRange: async (): Promise<CapturedMessage[]> => {
        throw new Error('não deve chamar range sem envios');
      },
    };
    const r = await retomarMetricsResolver({
      accountId: 'acc1',
      since: new Date(0),
      until: new Date(),
      messageDB: db,
    });
    expect(r).toEqual({
      sentCount: 0,
      respondedCount: 0,
      responseRate: 0,
      avgResponseTimeMinutes: null,
    });
  });

  it('dois envios no mesmo chat; uma resposta só após o segundo', async () => {
    const since = new Date('2025-01-01T00:00:00Z');
    const until = new Date('2025-02-01T00:00:00Z');
    const meta = { cycleIndex: 1, variant: 'A', campaignLabel: null, accountId: 'acc1' } as const;
    const db = {
      getRetomarSends: async (): Promise<MessageDBEntry[]> => [
        sendEntry({ id: 'e1', chatId: 'c@c.us', timestamp: '2025-01-05T10:00:00.000Z' }),
        sendEntry({ id: 'e2', chatId: 'c@c.us', timestamp: '2025-01-05T11:00:00.000Z' }),
      ],
      getMessagesByDateRange: async (): Promise<CapturedMessage[]> => [
        msg({
          id: 'r1',
          chatId: 'c@c.us',
          text: 'resposta',
          isOutgoing: false,
          timestamp: new Date('2025-01-05T11:30:00Z'),
        }),
        msg({
          id: 'e2',
          chatId: 'c@c.us',
          text: '2',
          isOutgoing: true,
          timestamp: new Date('2025-01-05T11:00:00Z'),
          retomarMeta: meta,
        } as CapturedMessage),
        msg({
          id: 'e1',
          chatId: 'c@c.us',
          text: '1',
          isOutgoing: true,
          timestamp: new Date('2025-01-05T10:00:00Z'),
          retomarMeta: meta,
        } as CapturedMessage),
      ],
    };
    const r = await retomarMetricsResolver({
      accountId: 'acc1',
      since,
      until,
      messageDB: db,
    });
    expect(r.sentCount).toBe(2);
    expect(r.respondedCount).toBe(1);
    expect(r.responseRate).toBe(50);
    expect(r.avgResponseTimeMinutes).toBe(30);
  });

  it('rejeita since > until', async () => {
    await expect(
      retomarMetricsResolver({
        accountId: 'a',
        since: new Date('2025-02-01'),
        until: new Date('2025-01-01'),
        messageDB: {
          getRetomarSends: async () => [],
          getMessagesByDateRange: async () => [],
        },
      }),
    ).rejects.toThrow(/since/);
  });

  it('propaga erro de getRetomarSends', async () => {
    await expect(
      retomarMetricsResolver({
        accountId: 'a',
        since: new Date(0),
        until: new Date(),
        messageDB: {
          getRetomarSends: async () => {
            throw new Error('db down');
          },
          getMessagesByDateRange: async () => [],
        },
      }),
    ).rejects.toThrow('db down');
  });

  it('falha se envio não aparece na linha do tempo', async () => {
    const db = {
      getRetomarSends: async (): Promise<MessageDBEntry[]> => [
        sendEntry({ id: 'fantasma', chatId: 'c@c.us' }),
      ],
      getMessagesByDateRange: async (): Promise<CapturedMessage[]> => [
        msg({ id: 'outro', chatId: 'c@c.us', text: 'x', isOutgoing: true }),
      ],
    };
    await expect(
      retomarMetricsResolver({
        accountId: 'acc1',
        since: new Date(0),
        until: new Date(),
        messageDB: db,
      }),
    ).rejects.toThrow(/não encontrado/);
  });

  it('filtra por variant', async () => {
    const db = {
      getRetomarSends: async (
        _acc: string,
        opts?: { variant?: 'A' | 'B' },
      ): Promise<MessageDBEntry[]> => {
        const all = [
          sendEntry({ id: 'a1', chatId: 'c1', retomarMeta: { cycleIndex: 1, variant: 'A', campaignLabel: null, accountId: 'acc1' } }),
          sendEntry({ id: 'b1', chatId: 'c2', retomarMeta: { cycleIndex: 1, variant: 'B', campaignLabel: null, accountId: 'acc1' } }),
        ];
        if (opts?.variant === 'A') return all.filter(e => e.retomarMeta?.variant === 'A');
        if (opts?.variant === 'B') return all.filter(e => e.retomarMeta?.variant === 'B');
        return all;
      },
      getMessagesByDateRange: async (_s: Date, _u: Date, chatId?: string): Promise<CapturedMessage[]> => {
        if (chatId === 'c1') {
          return [
            msg({
              id: 'a1',
              chatId: 'c1',
              text: 'A',
              isOutgoing: true,
              retomarMeta: { cycleIndex: 1, variant: 'A', campaignLabel: null, accountId: 'acc1' },
            } as CapturedMessage),
          ];
        }
        return [
          msg({
            id: 'b1',
            chatId: 'c2',
            text: 'B',
            isOutgoing: true,
            retomarMeta: { cycleIndex: 1, variant: 'B', campaignLabel: null, accountId: 'acc1' },
          } as CapturedMessage),
        ];
      },
    };
    const rA = await retomarMetricsResolver({
      accountId: 'acc1',
      since: new Date(0),
      until: new Date(),
      variant: 'A',
      messageDB: db,
    });
    expect(rA.sentCount).toBe(1);
    const rB = await retomarMetricsResolver({
      accountId: 'acc1',
      since: new Date(0),
      until: new Date(),
      variant: 'B',
      messageDB: db,
    });
    expect(rB.sentCount).toBe(1);
  });
});
