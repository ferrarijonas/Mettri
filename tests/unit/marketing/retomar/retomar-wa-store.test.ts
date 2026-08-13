import { describe, expect, it } from 'vitest';
import { extractLastMessageDateFromChatModel } from '../../../../src/infrastructure/services/send-message';

describe('extractLastMessageDateFromChatModel', () => {
  it('lê data de lastMessage (qualquer mensagem, nossa ou do cliente)', () => {
    const d = extractLastMessageDateFromChatModel({
      id: { _serialized: '5511999999999@c.us' },
      lastMessage: { t: 1712500000, id: { fromMe: false } },
    });
    expect(d?.getTime()).toBe(1712500000 * 1000);
  });

  it('aceita aliases __x_lastMessage e _lastMessage', () => {
    const a = extractLastMessageDateFromChatModel({
      __x_lastMessage: { __x_t: 1712500001 },
    });
    expect(a?.getTime()).toBe(1712500001 * 1000);

    const b = extractLastMessageDateFromChatModel({
      _lastMessage: { t: 1712500002 },
    });
    expect(b?.getTime()).toBe(1712500002 * 1000);
  });

  it('usa o mais recente quando múltiplos aliases existem', () => {
    const d = extractLastMessageDateFromChatModel({
      lastMessage: { t: 1000 },
      __x_lastMessage: { t: 2000 },
    });
    expect(d?.getTime()).toBe(2000 * 1000);
  });

  it('retorna null para chat sem lastMessage', () => {
    expect(extractLastMessageDateFromChatModel({ id: { _serialized: 'x@c.us' } })).toBeNull();
  });

  it('retorna null para lastMessage sem timestamp', () => {
    expect(extractLastMessageDateFromChatModel({ lastMessage: { id: { fromMe: true } } })).toBeNull();
  });

  it('retorna null para entrada não-objeto', () => {
    expect(extractLastMessageDateFromChatModel(null)).toBeNull();
    expect(extractLastMessageDateFromChatModel(undefined)).toBeNull();
    expect(extractLastMessageDateFromChatModel('x')).toBeNull();
  });

  it('ignora timestamps inválidos (<= 0)', () => {
    expect(extractLastMessageDateFromChatModel({ lastMessage: { t: 0 } })).toBeNull();
    expect(extractLastMessageDateFromChatModel({ lastMessage: { t: -5 } })).toBeNull();
  });
});
