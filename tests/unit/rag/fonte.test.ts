import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CapturedMessage } from '../../../src/types';
import { MessageDB } from '../../../src/storage/message-db';
import { fonte } from '../../../src/modules/rag/fonte';
import { agrupar_por_turno } from '../../../src/modules/rag';
import { validMessage } from '../../fixtures/test-data';

function createMockMessage(id: string, chatId: string, ts: Date): CapturedMessage {
  return { ...validMessage, id, chatId, timestamp: ts };
}

describe('fonte (RAG)', () => {
  it('com chatId e mensagens retorna ordem ascendente por timestamp', async () => {
    const msg1 = createMockMessage('m1', 'c1', new Date('2026-01-01T10:00:00Z'));
    const msg2 = createMockMessage('m2', 'c1', new Date('2026-01-01T09:00:00Z'));
    const msg3 = createMockMessage('m3', 'c1', new Date('2026-01-01T11:00:00Z'));

    const mockGetMessages = vi.fn().mockResolvedValue([msg1, msg2, msg3]);
    const db = { getMessages: mockGetMessages } as unknown as MessageDB;

    const result = await fonte({ chatId: 'c1', db });

    expect(mockGetMessages).toHaveBeenCalledWith('c1', 50_000);
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('m2');
    expect(result[1].id).toBe('m1');
    expect(result[2].id).toBe('m3');
  });

  it('MessageDB vazio retorna []', async () => {
    const mockGetMessages = vi.fn().mockResolvedValue([]);
    const db = { getMessages: mockGetMessages } as unknown as MessageDB;

    const result = await fonte({ db });

    expect(result).toEqual([]);
  });

  it('chatId sem mensagens retorna []', async () => {
    const mockGetMessages = vi.fn().mockResolvedValue([]);
    const db = { getMessages: mockGetMessages } as unknown as MessageDB;

    const result = await fonte({ chatId: 'chat-inexistente', db });

    expect(mockGetMessages).toHaveBeenCalledWith('chat-inexistente', 50_000);
    expect(result).toEqual([]);
  });

  it('sem chatId com vários chats retorna todas as mensagens em ordem asc', async () => {
    const msgA = createMockMessage('a', 'chat-A', new Date('2026-01-01T12:00:00Z'));
    const msgB = createMockMessage('b', 'chat-B', new Date('2026-01-01T10:00:00Z'));
    const msgC = createMockMessage('c', 'chat-A', new Date('2026-01-01T11:00:00Z'));

    const mockGetMessages = vi.fn().mockResolvedValue([msgA, msgB, msgC]);
    const db = { getMessages: mockGetMessages } as unknown as MessageDB;

    const result = await fonte({ db });

    expect(mockGetMessages).toHaveBeenCalledWith(undefined, 50_000);
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('b');
    expect(result[1].id).toBe('c');
    expect(result[2].id).toBe('a');
  });

  it('erro do DB rejeita a promise', async () => {
    const mockGetMessages = vi.fn().mockRejectedValue(new Error('DB falhou'));
    const db = { getMessages: mockGetMessages } as unknown as MessageDB;

    await expect(fonte({ db })).rejects.toThrow('DB falhou');
  });
});

describe('fonte (RAG) com MessageDB real', () => {
  let db: MessageDB;

  beforeEach(() => {
    db = new MessageDB();
  });

  afterEach(async () => {
    await db.clearAllMessages();
  });

  it('retorna mensagens em ordem ascendente (DB real)', async () => {
    const msg1 = { ...validMessage, id: 'r1', chatId: 'chat-x', timestamp: new Date('2026-01-01T11:00:00Z') };
    const msg2 = { ...validMessage, id: 'r2', chatId: 'chat-x', timestamp: new Date('2026-01-01T09:00:00Z') };
    const msg3 = { ...validMessage, id: 'r3', chatId: 'chat-x', timestamp: new Date('2026-01-01T10:00:00Z') };

    await db.saveMessage(msg1);
    await db.saveMessage(msg2);
    await db.saveMessage(msg3);

    const result = await fonte({ chatId: 'chat-x', db });

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('r2');
    expect(result[1].id).toBe('r3');
    expect(result[2].id).toBe('r1');
  });

  it('DB vazio retorna [] (real)', async () => {
    const result = await fonte({ db });
    expect(result).toEqual([]);
  });

  it('filtra por chatId e ordena asc (real)', async () => {
    await db.saveMessage({ ...validMessage, id: 'a1', chatId: 'c1', timestamp: new Date('2026-01-01T12:00:00Z') });
    await db.saveMessage({ ...validMessage, id: 'a2', chatId: 'c2', timestamp: new Date('2026-01-01T10:00:00Z') });
    await db.saveMessage({ ...validMessage, id: 'a3', chatId: 'c1', timestamp: new Date('2026-01-01T11:00:00Z') });

    const result = await fonte({ chatId: 'c1', db });

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('a3');
    expect(result[1].id).toBe('a1');
    expect(result.every(m => m.chatId === 'c1')).toBe(true);
  });

  it('integra fonte + agrupar_por_turno para um chat (DB real)', async () => {
    const chatId = 'chat-rag-integra';
    const firstClientTs = new Date('2026-01-01T10:00:00Z');

    // Mensagens do chat alvo (cliente, cliente, atendente)
    await db.saveMessage({
      ...validMessage,
      id: 'c1',
      chatId,
      text: 'Oi',
      isOutgoing: false,
      timestamp: firstClientTs,
    });

    await db.saveMessage({
      ...validMessage,
      id: 'c2',
      chatId,
      text: 'Quero saber sobre o plano X',
      isOutgoing: false,
      timestamp: new Date('2026-01-01T10:01:00Z'),
    });

    await db.saveMessage({
      ...validMessage,
      id: 'a1',
      chatId,
      sender: 'Atendente',
      text: 'Claro, vou te explicar.',
      isOutgoing: true,
      timestamp: new Date('2026-01-01T10:02:00Z'),
    });

    // Mensagem de outro chat, que não deve entrar no agrupamento
    await db.saveMessage({
      ...validMessage,
      id: 'other-1',
      chatId: 'outro-chat',
      text: 'Mensagem de outro chat',
      isOutgoing: false,
      timestamp: new Date('2026-01-01T09:00:00Z'),
    });

    const messagesFromFonte = await fonte({ chatId, db });
    const chunks = agrupar_por_turno(messagesFromFonte);

    expect(messagesFromFonte.every(m => m.chatId === chatId)).toBe(true);
    expect(chunks).toHaveLength(1);

    const chunk = chunks[0];
    expect(chunk.chatId).toBe(chatId);
    expect(chunk.timestamp).toBe(firstClientTs.toISOString());
    expect(chunk.messageIds).toEqual(['c1', 'c2', 'a1']);
    expect(chunk.turnSize).toEqual({ client: 2, agent: 1 });
    expect(chunk.content).toBe(
      'Cliente: Oi Quero saber sobre o plano X\nAtendente: Claro, vou te explicar.',
    );
    expect(chunk.id).toBe(`${chatId}_${firstClientTs.toISOString()}`);
  });
});
