import { describe, expect, it } from 'vitest';
import {
  criarClienteContextoVitrine,
  fornecerFichaClienteParaAtendimento,
  type FichaClienteAtendimento,
} from '../../../src/modules/cadastro';
import type { CustomerOperationalProfile } from '../../../src/storage/customer-profile-db';

describe('cadastro/cliente - fornecerFichaClienteParaAtendimento', () => {
  it('deve retornar erro INVALID_INPUT com chatId vazio', async () => {
    const result = await fornecerFichaClienteParaAtendimento(
      '',
      {
        getClientByChatId: async () => null,
        getLastPurchaseByChatId: async () => null,
        getOperationalProfile: async () => null,
      },
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.errorCode).toBe('INVALID_INPUT');
  });

  it('deve degradar com fallback seguro quando store falhar', async () => {
    const result = await fornecerFichaClienteParaAtendimento(
      '5511999999999@c.us',
      {
        getClientByChatId: async () => {
          throw new Error('falha no client store');
        },
        getLastPurchaseByChatId: async () => null,
        getOperationalProfile: async () => null,
      },
      { allowPartialOnError: true },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.cadastro).toBe(null);
    expect(result.data.ultimaCompra).toBe(null);
    expect(result.data.perfilOperacional).toBe(null);
  });

  it('deve montar ficha principal com contrato agregado', async () => {
    const result = await fornecerFichaClienteParaAtendimento(
      '5511888888888@c.us',
      {
        getClientByChatId: async () => ({
          clientKey: '5511888888888',
          phoneDigits: '5511888888888',
          fullName: 'Maria Silva',
          updatedAtIso: '2026-04-21T12:00:00.000Z',
        }),
        getLastPurchaseByChatId: async () => ({
          purchaseId: 'p-1',
          purchaseDateIso: '2026-04-20T12:00:00.000Z',
          value: 129.9,
          items: ['Cafe 250g'],
          notes: null,
          source: 'MANUAL',
        }),
        getOperationalProfile: async () => ({
          chatId: '5511888888888@c.us',
          segmentos: ['recorrente'],
          confiancaPerfil: 0.87,
          rfm: {
            recenciaDias: 7,
            frequencia30d: 3,
            monetario30d: 420,
            bandaRecencia: 'A',
            bandaFrequencia: 'B',
            bandaMonetario: 'A',
            score: 88,
          },
        } as CustomerOperationalProfile),
      },
      { allowPartialOnError: true },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.chatId).toBe('5511888888888@c.us');
    expect(result.data.flags.cadastroUtil).toBe(true);
    expect(result.data.ultimaCompra?.purchaseId).toBe('p-1');
    expect(result.data.perfilOperacional?.rfm?.score).toBe(88);
  });
});

describe('cadastro/cliente - criarClienteContextoVitrine', () => {
  it('deve reaproveitar RFM da ficha sem recalcular', () => {
    const ficha: FichaClienteAtendimento = {
      chatId: '5511777777777@c.us',
      cadastro: {
        clientKey: '5511777777777',
        phoneDigits: '5511777777777',
        fullName: 'Joao',
        updatedAtIso: '2026-04-21T12:00:00.000Z',
      },
      ultimaCompra: null,
      perfilOperacional: {
        chatId: '5511777777777@c.us',
        segmentos: ['vip'],
        confiancaPerfil: 0.66,
        rfm: {
          recenciaDias: 12,
          frequencia30d: 2,
          monetario30d: 190,
          bandaRecencia: 'B',
          bandaFrequencia: 'C',
          bandaMonetario: 'B',
          score: 73,
        },
      } as CustomerOperationalProfile,
      flags: { cadastroUtil: true },
    };

    const contexto = criarClienteContextoVitrine(ficha);
    expect(contexto.perfil.rfm?.score).toBe(73);
    expect(contexto.perfil.rfm?.bandaRecencia).toBe('B');
  });
});
