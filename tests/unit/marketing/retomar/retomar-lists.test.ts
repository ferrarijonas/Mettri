import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * justificado: dublê mínimo de I/O — substitui o bridge/WhatsApp real por um storage em memória
 * para (a) integrar o manager com o motor de elegibilidade e (b) reproduzir falha de `storage.set`,
 * que não é reproduzível em unit sem o dublê. Não mocka regra de negócio.
 */
const bridgeMock = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  const state = { failSet: false };
  return { store, state };
});

vi.mock('../../../../src/content/bridge-client', () => ({
  MettriBridgeClient: class {
    async storageGet(keys: string[]): Promise<Record<string, unknown>> {
      const out: Record<string, unknown> = {};
      for (const key of keys) {
        if (bridgeMock.store.has(key)) out[key] = bridgeMock.store.get(key);
      }
      return out;
    }

    async storageSet(items: Record<string, unknown>): Promise<void> {
      if (bridgeMock.state.failSet) throw new Error('storage.set falhou');
      for (const [key, value] of Object.entries(items)) bridgeMock.store.set(key, value);
    }
  },
}));

import { RetomarListsManager } from '../../../../src/modules/marketing/retomar/retomar-lists';
import { computeEligibleContactsDiagnostics } from '../../../../src/modules/marketing/retomar/eligible-contacts-engine';

const RANGES = [
  { min: 21, max: 41 },
  { min: 42, max: 72 },
  { min: 73, max: 115 },
  { min: 116, max: 168 },
];

describe('RetomarListsManager + elegibilidade', () => {
  beforeEach(() => {
    bridgeMock.store.clear();
    bridgeMock.state.failSet = false;
  });

  it('bloqueado (never-send) fica fora dos elegíveis — não é enviado', async () => {
    const manager = new RetomarListsManager('acc-test');
    await manager.initialize();
    await manager.addMember('never-send', '5511@c.us');

    const lastActivityByChat = new Map([
      ['5511@c.us', { chatId: '5511@c.us', chatName: 'Bloqueado', date: new Date('2026-08-01T12:00:00Z') }],
      ['5522@c.us', { chatId: '5522@c.us', chatName: 'Livre', date: new Date('2026-08-01T12:00:00Z') }],
    ]);

    const { eligible } = computeEligibleContactsDiagnostics({
      now: new Date('2026-09-16T12:00:00Z'),
      lastActivityByChat,
      lastOutgoingByContact: new Map(),
      contadorByChat: {},
      ranges: RANGES,
      minDistance: 21,
      chatIdsInLists: new Set(manager.getMembers('never-send')),
    });

    expect(manager.isInList('5511@c.us', 'never-send')).toBe(true);
    expect(eligible.map((e) => e.chatId)).toEqual(['5522@c.us']);
  });

  it('falha de storage.set propaga erro em addMember (não engole)', async () => {
    const manager = new RetomarListsManager('acc-test');
    await manager.initialize();

    bridgeMock.state.failSet = true;
    await expect(manager.addMember('never-send', '5599@c.us')).rejects.toThrow('storage.set falhou');
  });
});
