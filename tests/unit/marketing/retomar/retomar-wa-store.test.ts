import { describe, expect, it } from 'vitest';
import {
  extractLastMessageDateFromChatModel,
  extractLastMessageDateFromChatModelAsync,
  extractPhoneDigitsFromChatModel,
} from '../../../../src/infrastructure/services/send-message';

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

describe('extractLastMessageDateFromChatModelAsync (fallback msgs — chat @lid)', () => {
  it('usa lastMessage direto quando existe (mesmo comportamento da sync)', async () => {
    const d = await extractLastMessageDateFromChatModelAsync({
      lastMessage: { t: 1712500000 },
    });
    expect(d?.getTime()).toBe(1712500000 * 1000);
  });

  it('usa o MAIOR entre lastMessage e msgs (não subestima a última msg trocada)', async () => {
    const d = await extractLastMessageDateFromChatModelAsync({
      lastMessage: { t: 1712500000 }, // mais antigo
      msgs: {
        _models: [{ t: 1712600000 }, { t: 1712550000 }], // msgs mais novas
      },
    });
    expect(d?.getTime()).toBe(1712600000 * 1000);
  });

  it('usa lastMessage quando ele é mais novo que as msgs', async () => {
    const d = await extractLastMessageDateFromChatModelAsync({
      lastMessage: { t: 1712700000 },
      msgs: { _models: [{ t: 1712500000 }] },
    });
    expect(d?.getTime()).toBe(1712700000 * 1000);
  });

  it('fallback: varre a coleção msgs e usa o timestamp mais recente', async () => {
    const d = await extractLastMessageDateFromChatModelAsync({
      id: { _serialized: '69037354705100@lid' },
      msgs: {
        _models: [
          { t: 1000, id: { fromMe: false } },
          { t: 2000, id: { fromMe: true } },
          { t: 1500 },
        ],
      },
    });
    expect(d?.getTime()).toBe(2000 * 1000);
  });

  it('fallback com getModelsArray assíncrono', async () => {
    const d = await extractLastMessageDateFromChatModelAsync({
      ms: {
        getModelsArray: async () => [{ t: 5000 }, { t: 3000 }],
      },
    });
    expect(d?.getTime()).toBe(5000 * 1000);
  });

  it('usa __x_t quando t ausente', async () => {
    const d = await extractLastMessageDateFromChatModelAsync({
      msgs: { _models: [{ __x_t: 7000 }] },
    });
    expect(d?.getTime()).toBe(7000 * 1000);
  });

  it('retorna null quando não há msgs nem lastMessage', async () => {
    expect(await extractLastMessageDateFromChatModelAsync({ id: { _serialized: 'x@lid' } })).toBeNull();
    expect(await extractLastMessageDateFromChatModelAsync(null)).toBeNull();
  });

  it('ignora msgs sem timestamp válido', async () => {
    expect(await extractLastMessageDateFromChatModelAsync({ msgs: { _models: [{ t: 0 }, {}] } })).toBeNull();
  });
});

describe('extractPhoneDigitsFromChatModel', () => {
  it('@c.us: extrai do sid', () => {
    expect(extractPhoneDigitsFromChatModel({ id: { _serialized: '5511999999999@c.us' } })).toBe('5511999999999');
  });

  it('@lid: extrai de __x_contact.__x_phoneNumber', () => {
    expect(
      extractPhoneDigitsFromChatModel({
        id: { _serialized: '69037354705100@lid' },
        __x_contact: { __x_phoneNumber: '+55 11 99999-9999' },
      })
    ).toBe('5511999999999');
  });

  it('@lid sem __x_phoneNumber: fallback para contact.id.user', () => {
    expect(
      extractPhoneDigitsFromChatModel({
        id: { _serialized: '69037354705100@lid' },
        __x_contact: { id: { user: '5511999999999' } },
      })
    ).toBe('5511999999999');
  });

  it('@lid sem dados de contato: retorna vazio', () => {
    expect(extractPhoneDigitsFromChatModel({ id: { _serialized: '69037354705100@lid' } })).toBe('');
  });

  it('grupo/outro: retorna vazio', () => {
    expect(extractPhoneDigitsFromChatModel({ id: { _serialized: '123@g.us' } })).toBe('');
  });

  it('entrada não-objeto: retorna vazio', () => {
    expect(extractPhoneDigitsFromChatModel(null)).toBe('');
  });
});
