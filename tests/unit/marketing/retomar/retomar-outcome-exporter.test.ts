import { describe, expect, it, vi } from 'vitest';
import type { CapturedMessage, MessageDBEntry } from '../../../../src/types/schemas';
import {
  phoneDigitsFromChatId,
  retomarOutcomeExporter,
  retomarOutcomesFilePath,
  truncateOutcomeText,
} from '../../../../src/modules/marketing/retomar/retomar-outcome-exporter';

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

const meta = { cycleIndex: 1, variant: 'A' as const, campaignLabel: null, accountId: 'acc1' };

describe('truncateOutcomeText', () => {
  it('respeita limite em pontos de código', () => {
    const s = 'a'.repeat(10);
    expect(truncateOutcomeText(s, 500).length).toBe(10);
    expect(truncateOutcomeText(s, 3)).toBe('aaa');
  });
});

describe('phoneDigitsFromChatId', () => {
  it('extrai dígitos antes de @', () => {
    expect(phoneDigitsFromChatId('5511999999999@c.us')).toBe('5511999999999');
    expect(phoneDigitsFromChatId('x@c.us')).toBeNull();
  });
});

describe('retomarOutcomesFilePath', () => {
  it('usa padrão por conta', () => {
    expect(retomarOutcomesFilePath('acc1')).toBe('retomar-outcomes-acc1.jsonl');
  });
});

describe('retomarOutcomeExporter', () => {
  const since = new Date('2025-01-01T00:00:00Z');
  const until = new Date('2025-02-01T00:00:00Z');
  const fixedNow = new Date('2025-01-15T10:00:00.000Z');

  it('3 envios respondidos novos -> 3 linhas JSONL', async () => {
    const appends: string[] = [];
    const state = { exportedSendMessageIds: [] as string[] };
    const db = {
      getRetomarSends: async (): Promise<MessageDBEntry[]> => [
        sendEntry({ id: 's1', chatId: '5511@c.us', timestamp: '2025-01-02T12:00:00.000Z', text: 't1' }),
        sendEntry({ id: 's2', chatId: '5512@c.us', timestamp: '2025-01-03T12:00:00.000Z', text: 't2' }),
        sendEntry({
          id: 's3',
          chatId: '5513@c.us',
          timestamp: '2025-01-04T12:00:00.000Z',
          text: 't3',
          retomarMeta: { cycleIndex: 2, variant: 'B', campaignLabel: 'cmp', accountId: 'acc1' },
        }),
      ],
      getMessagesByDateRange: async (_s: Date, _u: Date, chatId?: string): Promise<CapturedMessage[]> => {
        if (chatId === '5511@c.us') {
          return [
            msg({
              id: 'r1',
              chatId: '5511@c.us',
              text: 'ok1',
              isOutgoing: false,
              timestamp: new Date('2025-01-02T12:15:00Z'),
            }),
            msg({
              id: 's1',
              chatId: '5511@c.us',
              text: 't1',
              isOutgoing: true,
              timestamp: new Date('2025-01-02T12:00:00Z'),
              retomarMeta: meta,
            } as CapturedMessage),
          ];
        }
        if (chatId === '5512@c.us') {
          return [
            msg({
              id: 'r2',
              chatId: '5512@c.us',
              text: 'ok2',
              isOutgoing: false,
              timestamp: new Date('2025-01-03T12:10:00Z'),
            }),
            msg({
              id: 's2',
              chatId: '5512@c.us',
              text: 't2',
              isOutgoing: true,
              timestamp: new Date('2025-01-03T12:00:00Z'),
              retomarMeta: meta,
            } as CapturedMessage),
          ];
        }
        return [
          msg({
            id: 'r3',
            chatId: '5513@c.us',
            text: '',
            isOutgoing: false,
            timestamp: new Date('2025-01-04T12:05:00Z'),
          }),
          msg({
            id: 's3',
            chatId: '5513@c.us',
            text: 't3',
            isOutgoing: true,
            timestamp: new Date('2025-01-04T12:00:00Z'),
            retomarMeta: { cycleIndex: 2, variant: 'B', campaignLabel: 'cmp', accountId: 'acc1' },
          } as CapturedMessage),
        ];
      },
    };

    const r = await retomarOutcomeExporter({
      accountId: 'acc1',
      since,
      until,
      messageDB: db,
      now: fixedNow,
      writer: {
        append: async (_path, text) => {
          appends.push(text);
        },
      },
      exportStateStore: {
        get: async () => ({ exportedSendMessageIds: [...state.exportedSendMessageIds] }),
        set: async (_acc, s) => {
          state.exportedSendMessageIds = s.exportedSendMessageIds;
        },
      },
    });

    expect(r.exportedCount).toBe(3);
    expect(r.skippedCount).toBe(0);
    expect(r.filePath).toBe('retomar-outcomes-acc1.jsonl');
    expect(state.exportedSendMessageIds.sort()).toEqual(['s1', 's2', 's3'].sort());
    expect(appends).toHaveLength(1);
    const lines = appends[0].trim().split('\n');
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      const o = JSON.parse(line) as Record<string, unknown>;
      expect(o.eventId).toMatch(/^retomar-outcome::acc1::s/);
      expect(o.accountId).toBe('acc1');
      expect(o.sendMessageId).toBeDefined();
      expect(o.replyMessageId).toBeDefined();
      expect(o.cycleIndex).toBeDefined();
      expect(o.variant).toBeDefined();
      expect(o.sentAt).toBeDefined();
      expect(o.replyAt).toBeDefined();
      expect(typeof o.responseLagMinutes).toBe('number');
      expect(o.sendText).toBeDefined();
      expect(o.replyText).toBeDefined();
      expect(o.exportedAt).toBe(fixedNow.toISOString());
    }
  });

  it('reexecução idempotente: 0 novos, não chama append de novo', async () => {
    const appendSpy = vi.fn();
    const state = { exportedSendMessageIds: ['s1'] };
    const db = {
      getRetomarSends: async (): Promise<MessageDBEntry[]> => [
        sendEntry({ id: 's1', chatId: '5511@c.us', timestamp: '2025-01-02T12:00:00.000Z' }),
      ],
      getMessagesByDateRange: async (): Promise<CapturedMessage[]> => [
        msg({
          id: 'r1',
          chatId: '5511@c.us',
          text: 'ok',
          isOutgoing: false,
          timestamp: new Date('2025-01-02T12:05:00Z'),
        }),
        msg({
          id: 's1',
          chatId: '5511@c.us',
          text: 'hi',
          isOutgoing: true,
          timestamp: new Date('2025-01-02T12:00:00Z'),
          retomarMeta: meta,
        } as CapturedMessage),
      ],
    };

    const r = await retomarOutcomeExporter({
      accountId: 'acc1',
      since,
      until,
      messageDB: db,
      now: fixedNow,
      writer: { append: appendSpy },
      exportStateStore: {
        get: async () => ({ exportedSendMessageIds: [...state.exportedSendMessageIds] }),
        set: async () => {
          throw new Error('set não deve ser chamado');
        },
      },
    });

    expect(r.exportedCount).toBe(0);
    expect(r.skippedCount).toBe(1);
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it('sem respostas -> 0 exportados', async () => {
    const appendSpy = vi.fn();
    const db = {
      getRetomarSends: async (): Promise<MessageDBEntry[]> => [
        sendEntry({ id: 'solo', chatId: 'x@c.us', timestamp: '2025-01-03T10:00:00.000Z' }),
      ],
      getMessagesByDateRange: async (): Promise<CapturedMessage[]> => [
        msg({
          id: 'solo',
          chatId: 'x@c.us',
          text: 'só envio',
          isOutgoing: true,
          timestamp: new Date('2025-01-03T10:00:00Z'),
          retomarMeta: meta,
        } as CapturedMessage),
      ],
    };

    const r = await retomarOutcomeExporter({
      accountId: 'acc1',
      since,
      until,
      messageDB: db,
      now: fixedNow,
      writer: { append: appendSpy },
      exportStateStore: {
        get: async () => ({ exportedSendMessageIds: [] }),
        set: async () => {
          throw new Error('set não deve ser chamado');
        },
      },
    });

    expect(r.exportedCount).toBe(0);
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it('texto longo -> truncagem', async () => {
    const long = 'x'.repeat(800);
    const appends: string[] = [];
    const db = {
      getRetomarSends: async (): Promise<MessageDBEntry[]> => [
        sendEntry({
          id: 'long',
          chatId: 'c@c.us',
          timestamp: '2025-01-02T12:00:00.000Z',
          text: long,
        }),
      ],
      getMessagesByDateRange: async (): Promise<CapturedMessage[]> => [
        msg({
          id: 'rin',
          chatId: 'c@c.us',
          text: long,
          isOutgoing: false,
          timestamp: new Date('2025-01-02T12:01:00Z'),
        }),
        msg({
          id: 'long',
          chatId: 'c@c.us',
          text: long,
          isOutgoing: true,
          timestamp: new Date('2025-01-02T12:00:00Z'),
          retomarMeta: meta,
        } as CapturedMessage),
      ],
    };

    await retomarOutcomeExporter({
      accountId: 'acc1',
      since,
      until,
      maxTextLength: 500,
      messageDB: db,
      now: fixedNow,
      writer: {
        append: async (_p, t) => {
          appends.push(t);
        },
      },
      exportStateStore: {
        get: async () => ({ exportedSendMessageIds: [] }),
        set: async () => {},
      },
    });

    const o = JSON.parse(appends[0].trim()) as { sendText: string; replyText: string };
    expect(o.sendText.length).toBe(500);
    expect(o.replyText.length).toBe(500);
  });

  it('falha no writer.append -> erro e set não avança', async () => {
    const setSpy = vi.fn();
    const db = {
      getRetomarSends: async (): Promise<MessageDBEntry[]> => [
        sendEntry({ id: 's1', chatId: '5511@c.us', timestamp: '2025-01-02T12:00:00.000Z' }),
      ],
      getMessagesByDateRange: async (): Promise<CapturedMessage[]> => [
        msg({
          id: 'r1',
          chatId: '5511@c.us',
          text: 'ok',
          isOutgoing: false,
          timestamp: new Date('2025-01-02T12:05:00Z'),
        }),
        msg({
          id: 's1',
          chatId: '5511@c.us',
          text: 'hi',
          isOutgoing: true,
          timestamp: new Date('2025-01-02T12:00:00Z'),
          retomarMeta: meta,
        } as CapturedMessage),
      ],
    };

    await expect(
      retomarOutcomeExporter({
        accountId: 'acc1',
        since,
        until,
        messageDB: db,
        now: fixedNow,
        writer: {
          append: async () => {
            throw new Error('disk full');
          },
        },
        exportStateStore: {
          get: async () => ({ exportedSendMessageIds: [] }),
          set: setSpy,
        },
      }),
    ).rejects.toThrow(/Falha ao escrever arquivo/);

    expect(setSpy).not.toHaveBeenCalled();
  });

  it('accountId inválido -> erro explícito', async () => {
    await expect(
      retomarOutcomeExporter({
        accountId: '   ',
        since,
        until,
        messageDB: {
          getRetomarSends: async () => [],
          getMessagesByDateRange: async () => [],
        },
        writer: { append: async () => {} },
        exportStateStore: {
          get: async () => ({ exportedSendMessageIds: [] }),
          set: async () => {},
        },
      }),
    ).rejects.toThrow(/accountId inválido/);
  });
});
