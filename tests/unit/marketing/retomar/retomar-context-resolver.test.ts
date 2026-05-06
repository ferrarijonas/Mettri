import { describe, expect, it } from 'vitest';
import type { CapturedMessage } from '../../../../src/types/schemas';
import {
  resolveRetomarContextForChat,
  retomarContextResolver,
} from '../../../../src/modules/marketing/retomar/retomar-context-resolver';

function msg(p: Partial<CapturedMessage> & Pick<CapturedMessage, 'id' | 'chatId' | 'text' | 'isOutgoing'>): CapturedMessage {
  return {
    chatName: p.chatName ?? 'Nome',
    sender: p.sender ?? 'x',
    timestamp: p.timestamp ?? new Date('2025-01-02T12:00:00Z'),
    type: p.type ?? 'text',
    ...p,
  } as CapturedMessage;
}

describe('retomarContextResolver', () => {
  it('rejeita chatIds inválidos', async () => {
    await expect(
      retomarContextResolver({
        chatIds: 'x' as unknown as string[],
        accountId: 'acc',
        messageDB: { getMessages: async () => [] },
      }),
    ).rejects.toThrow('chatIds');

    await expect(
      retomarContextResolver({
        chatIds: ['ok', ''],
        accountId: 'acc',
        messageDB: { getMessages: async () => [] },
      }),
    ).rejects.toThrow('chatId vazio');
  });

  it('exclui chat sem mensagem recebida legível', async () => {
    const db = {
      getMessages: async (_chatId: string): Promise<CapturedMessage[]> => [
        msg({
          id: '1',
          chatId: '5511@c.us',
          text: 'só eu',
          isOutgoing: true,
          sender: 'me',
        }),
      ],
    };
    const out = await retomarContextResolver({
      chatIds: ['5511@c.us'],
      accountId: 'acc',
      messageDB: db,
    });
    expect(out).toHaveLength(0);
  });

  it('monta só Cliente: quando não há retomar', async () => {
    const db = {
      getMessages: async (): Promise<CapturedMessage[]> => [
        msg({
          id: '1',
          chatId: '5511@c.us',
          text: 'Oi, tudo bem?',
          isOutgoing: false,
          sender: 'them',
        }),
      ],
    };
    const out = await retomarContextResolver({
      chatIds: ['5511@c.us'],
      accountId: 'acc1',
      messageDB: db,
    });
    expect(out).toHaveLength(1);
    expect(out[0].contextText).toBe('Cliente: Oi, tudo bem?');
    expect(out[0].clientText).toBe('Oi, tudo bem?');
    expect(out[0].attendantText).toBeUndefined();
    expect(out[0].conversationThread).toBe('[cliente] Oi, tudo bem?');
  });

  it('acrescenta Atendente: com última retomar da mesma conta', async () => {
    const db = {
      getMessages: async (): Promise<CapturedMessage[]> => [
        msg({
          id: '1',
          chatId: '5511@c.us',
          text: 'Novo',
          isOutgoing: false,
          sender: 'them',
          timestamp: new Date('2025-01-03T12:00:00Z'),
        }),
        msg({
          id: '2',
          chatId: '5511@c.us',
          text: 'Última retomar',
          isOutgoing: true,
          sender: 'me',
          timestamp: new Date('2025-01-02T12:00:00Z'),
          retomarMeta: { cycleIndex: 1, variant: 'A', campaignLabel: null, accountId: 'acc1' },
        } as CapturedMessage),
      ],
    };
    const out = await retomarContextResolver({
      chatIds: ['5511@c.us'],
      accountId: 'acc1',
      messageDB: db,
    });
    expect(out[0].contextText).toContain('Cliente: Novo');
    expect(out[0].contextText).toContain('Atendente: Última retomar');
    expect(out[0].attendantText).toBe('Última retomar');
    expect(out[0].conversationThread).toBe(
      '[padaria] Última retomar\n[cliente] Novo',
    );
  });

  it('ignora retomar de outra conta', async () => {
    const db = {
      getMessages: async (): Promise<CapturedMessage[]> => [
        msg({
          id: '1',
          chatId: '5511@c.us',
          text: 'Cliente fala',
          isOutgoing: false,
          sender: 'them',
        }),
        msg({
          id: '2',
          chatId: '5511@c.us',
          text: 'Outra conta',
          isOutgoing: true,
          sender: 'me',
          retomarMeta: { cycleIndex: 1, variant: 'A', campaignLabel: null, accountId: 'outra' },
        } as CapturedMessage),
      ],
    };
    const out = await retomarContextResolver({
      chatIds: ['5511@c.us'],
      accountId: 'acc1',
      messageDB: db,
    });
    expect(out[0].contextText).toBe('Cliente: Cliente fala');
    expect(out[0].attendantText).toBeUndefined();
    expect(out[0].conversationThread).toBe(
      '[padaria] Outra conta\n[cliente] Cliente fala',
    );
  });

  it('conversationThread intercala cliente e padaria em ordem cronológica', async () => {
    const db = {
      getMessages: async (): Promise<CapturedMessage[]> => [
        msg({
          id: 'a',
          chatId: '5511@c.us',
          text: 'Terceiro',
          isOutgoing: false,
          sender: 'them',
          timestamp: new Date('2025-01-05T12:00:00Z'),
        }),
        msg({
          id: 'b',
          chatId: '5511@c.us',
          text: 'Meio da padaria',
          isOutgoing: true,
          sender: 'me',
          timestamp: new Date('2025-01-04T12:00:00Z'),
        }),
        msg({
          id: 'c',
          chatId: '5511@c.us',
          text: 'Primeiro do cliente',
          isOutgoing: false,
          sender: 'them',
          timestamp: new Date('2025-01-03T12:00:00Z'),
        }),
      ],
    };
    const out = await retomarContextResolver({
      chatIds: ['5511@c.us'],
      accountId: 'acc1',
      messageDB: db,
    });
    expect(out[0].conversationThread).toBe(
      '[cliente] Primeiro do cliente\n[padaria] Meio da padaria\n[cliente] Terceiro',
    );
  });
});

describe('resolveRetomarContextForChat', () => {
  it('retorna null para lista vazia', async () => {
    const r = await resolveRetomarContextForChat({ getMessages: async () => [] }, 'x@c.us', 'acc');
    expect(r).toBeNull();
  });
});
