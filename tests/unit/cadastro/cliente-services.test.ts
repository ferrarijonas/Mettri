import { describe, expect, it } from 'vitest';
import {
  atualizarPerfilOperacionalCliente,
  fornecerFichaClienteParaAtendimento,
  persistirClienteOficial,
} from '../../../src/modules/cadastro';
import type { ClientRecord } from '../../../src/storage/client-db';
import type { CustomerOperationalProfile } from '../../../src/storage/customer-profile-db';
import type { ManualPurchaseRecord } from '../../../src/storage/purchase-db';

function buildClientRecord(partial?: Partial<ClientRecord>): ClientRecord {
  return {
    clientKey: 'chat_5511999999999@c.us',
    whatsAppChatId: '5511999999999@c.us',
    updatedAtIso: '2026-04-21T10:00:00.000Z',
    ...partial,
  };
}

function buildProfile(partial?: Partial<CustomerOperationalProfile>): CustomerOperationalProfile {
  return {
    chatId: '5511999999999@c.us',
    segmentos: ['recorrente'],
    confiancaPerfil: 0.4,
    updatedAtIso: '2026-04-21T10:00:00.000Z',
    modelVersion: 'cadastro-operacional-v1',
    ...partial,
  };
}

function buildPurchase(partial?: Partial<ManualPurchaseRecord>): ManualPurchaseRecord {
  return {
    purchaseId: 'pur_1',
    chatId: '5511999999999@c.us',
    purchaseDateIso: '2026-04-01T00:00:00.000Z',
    value: 100,
    items: ['Produto A'],
    notes: null,
    source: 'MANUAL',
    status: 'ACTIVE',
    createdAtIso: '2026-04-01T00:00:00.000Z',
    ...partial,
  };
}

describe('cadastro/cliente services', () => {
  it('persistirClienteOficial valida chatId e faz upsert com chatId oficial', async () => {
    const upserted: ClientRecord[] = [];
    const result = await persistirClienteOficial(
      {
        chatId: ' 5511999999999@c.us ',
        recordPatch: {
          fullName: 'Maria Silva',
        },
      },
      {
        getByChatId: async () => null,
        upsert: async record => {
          upserted.push(record);
        },
        clock: { nowIso: () => '2026-04-21T12:00:00.000Z' },
      }
    );

    expect(result.ok).toBe(true);
    expect(upserted).toHaveLength(1);
    expect(upserted[0].whatsAppChatId).toBe('5511999999999@c.us');
    expect(upserted[0].fullName).toBe('Maria Silva');
  });

  it('atualizarPerfilOperacionalCliente persiste perfil mínimo com confianca baixa quando sinais insuficientes', async () => {
    const saved: CustomerOperationalProfile[] = [];
    const result = await atualizarPerfilOperacionalCliente(
      {
        chatId: '5511999999999@c.us',
        sinais: {},
      },
      {
        getByChatId: async () => null,
        save: async profile => {
          saved.push(profile);
        },
        clock: { nowIso: () => '2026-04-21T12:00:00.000Z' },
      }
    );

    expect(result.ok).toBe(true);
    expect(saved).toHaveLength(1);
    expect(saved[0].confiancaPerfil).toBe(0);
    expect(saved[0].modelVersion).toBe('cadastro-operacional-v1');
  });

  it('fornecerFichaClienteParaAtendimento agrega cadastro, compra e perfil', async () => {
    const result = await fornecerFichaClienteParaAtendimento('5511999999999@c.us', {
      getClientByChatId: async () => buildClientRecord({ fullName: 'João' }),
      getLastPurchaseByChatId: async () => buildPurchase({ source: 'AI_DETECTED' }),
      getOperationalProfile: async () => buildProfile({ confiancaPerfil: 0.9 }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.cadastro?.fullName).toBe('João');
    expect(result.data.ultimaCompra?.source).toBe('AI_DETECTED');
    expect(result.data.perfilOperacional?.confiancaPerfil).toBe(0.9);
    expect(result.data.flags.cadastroUtil).toBe(true);
  });

  it('fornecerFichaClienteParaAtendimento retorna INVALID_INPUT com chatId vazio', async () => {
    const result = await fornecerFichaClienteParaAtendimento('   ', {
      getClientByChatId: async () => buildClientRecord(),
      getLastPurchaseByChatId: async () => buildPurchase(),
      getOperationalProfile: async () => buildProfile(),
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.errorCode).toBe('INVALID_INPUT');
  });
});
