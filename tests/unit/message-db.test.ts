import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MessageDB } from '../../src/storage/message-db';
import { validMessage, invalidMessageMissingId, invalidMessageWrongType } from '../fixtures/test-data';

describe('MessageDB', () => {
  let db: MessageDB;

  beforeEach(() => {
    db = new MessageDB();
  });

  afterEach(async () => {
    // Limpar banco após cada teste
    await db.clearAllMessages();
  });

  describe('saveMessage', () => {
    it('deve salvar mensagem válida', async () => {
      await expect(db.saveMessage(validMessage)).resolves.not.toThrow();
    });

    it('deve rejeitar mensagem inválida (sem campos obrigatórios)', async () => {
      // @ts-expect-error - Testando validação com dados inválidos
      await expect(db.saveMessage(invalidMessageMissingId)).rejects.toThrow();
    });

    it('deve rejeitar mensagem com tipo inválido', async () => {
      // @ts-expect-error - Testando validação com tipo inválido
      await expect(db.saveMessage(invalidMessageWrongType)).rejects.toThrow();
    });

    it('deve converter Date para string ISO ao salvar', async () => {
      await db.saveMessage(validMessage);
      const messages = await db.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].timestamp).toBeInstanceOf(Date);
      expect(messages[0].timestamp.getTime()).toBe(validMessage.timestamp.getTime());
    });
  });

  describe('getMessages', () => {
    it('deve retornar mensagens válidas do IndexedDB', async () => {
      await db.saveMessage(validMessage);
      const messages = await db.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe(validMessage.id);
      expect(messages[0].text).toBe(validMessage.text);
    });

    it('deve converter string ISO para Date ao recuperar', async () => {
      await db.saveMessage(validMessage);
      const messages = await db.getMessages();
      expect(messages[0].timestamp).toBeInstanceOf(Date);
    });

    it('deve ordenar mensagens por timestamp descendente', async () => {
      const message1 = { ...validMessage, id: 'msg-1', timestamp: new Date('2026-01-15T10:00:00Z') };
      const message2 = { ...validMessage, id: 'msg-2', timestamp: new Date('2026-01-15T11:00:00Z') };
      const message3 = { ...validMessage, id: 'msg-3', timestamp: new Date('2026-01-15T09:00:00Z') };

      await db.saveMessage(message1);
      await db.saveMessage(message2);
      await db.saveMessage(message3);

      const messages = await db.getMessages();
      expect(messages).toHaveLength(3);
      expect(messages[0].id).toBe('msg-2'); // Mais recente primeiro
      expect(messages[1].id).toBe('msg-1');
      expect(messages[2].id).toBe('msg-3');
    });

    it('deve filtrar por chatId quando fornecido', async () => {
      const message1 = { ...validMessage, id: 'msg-1', chatId: 'chat-1' };
      const message2 = { ...validMessage, id: 'msg-2', chatId: 'chat-2' };
      const message3 = { ...validMessage, id: 'msg-3', chatId: 'chat-1' };

      await db.saveMessage(message1);
      await db.saveMessage(message2);
      await db.saveMessage(message3);

      const messages = await db.getMessages('chat-1');
      expect(messages).toHaveLength(2);
      expect(messages.every(m => m.chatId === 'chat-1')).toBe(true);
    });

    it('deve respeitar limite de mensagens', async () => {
      // Salvar 5 mensagens
      for (let i = 0; i < 5; i++) {
        await db.saveMessage({ ...validMessage, id: `msg-${i}` });
      }

      const messages = await db.getMessages(undefined, 3);
      expect(messages.length).toBeLessThanOrEqual(3);
    });
  });

  describe('getMessagesByDateRange', () => {
    it('deve retornar mensagens no intervalo de datas', async () => {
      const startDate = new Date('2026-01-15T10:00:00Z');
      const endDate = new Date('2026-01-15T12:00:00Z');

      const message1 = { ...validMessage, id: 'msg-1', timestamp: new Date('2026-01-15T10:30:00Z') };
      const message2 = { ...validMessage, id: 'msg-2', timestamp: new Date('2026-01-15T11:30:00Z') };
      const message3 = { ...validMessage, id: 'msg-3', timestamp: new Date('2026-01-15T13:00:00Z') }; // Fora do range

      await db.saveMessage(message1);
      await db.saveMessage(message2);
      await db.saveMessage(message3);

      const messages = await db.getMessagesByDateRange(startDate, endDate);
      expect(messages).toHaveLength(2);
      expect(messages.map(m => m.id)).toContain('msg-1');
      expect(messages.map(m => m.id)).toContain('msg-2');
      expect(messages.map(m => m.id)).not.toContain('msg-3');
    });

    it('deve filtrar por chatId quando fornecido', async () => {
      const startDate = new Date('2026-01-15T10:00:00Z');
      const endDate = new Date('2026-01-15T12:00:00Z');

      const message1 = { ...validMessage, id: 'msg-1', chatId: 'chat-1', timestamp: new Date('2026-01-15T10:30:00Z') };
      const message2 = { ...validMessage, id: 'msg-2', chatId: 'chat-2', timestamp: new Date('2026-01-15T11:30:00Z') };

      await db.saveMessage(message1);
      await db.saveMessage(message2);

      const messages = await db.getMessagesByDateRange(startDate, endDate, 'chat-1');
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('msg-1');
    });
  });

  describe('deleteMessage', () => {
    it('deve deletar mensagem existente', async () => {
      await db.saveMessage(validMessage);
      await db.deleteMessage(validMessage.id);
      const messages = await db.getMessages();
      expect(messages).toHaveLength(0);
    });
  });

  describe('getMessageCount', () => {
    it('deve retornar contagem correta de mensagens', async () => {
      expect(await db.getMessageCount()).toBe(0);
      await db.saveMessage(validMessage);
      expect(await db.getMessageCount()).toBe(1);
      await db.saveMessage({ ...validMessage, id: 'msg-2' });
      expect(await db.getMessageCount()).toBe(2);
    });
  });

  describe('clearAllMessages', () => {
    it('deve limpar todas as mensagens', async () => {
      await db.saveMessage(validMessage);
      await db.saveMessage({ ...validMessage, id: 'msg-2' });
      await db.clearAllMessages();
      const messages = await db.getMessages();
      expect(messages).toHaveLength(0);
    });
  });
});
