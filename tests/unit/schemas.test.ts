import { describe, it, expect } from 'vitest';
import {
  CapturedMessageSchema,
  SelectorDefinitionSchema,
  SelectorsConfigSchema,
  MessageDBEntrySchema,
  messageToDBEntry,
  dbEntryToMessage,
} from '../../src/types/schemas';
import {
  validMessage,
  validMessageOutgoing,
  validDBEntry,
  validSelectorDefinition,
  validSelectorsConfig,
  invalidMessageMissingId,
  invalidMessageWrongType,
  invalidDBEntryWrongTimestamp,
  invalidSelectorEmptyArray,
  invalidSelectorsConfigWrongDate,
} from '../fixtures/test-data';

describe('CapturedMessageSchema', () => {
  it('deve validar mensagem válida', () => {
    const result = CapturedMessageSchema.safeParse(validMessage);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validMessage);
    }
  });

  it('deve validar mensagem enviada (outgoing)', () => {
    const result = CapturedMessageSchema.safeParse(validMessageOutgoing);
    expect(result.success).toBe(true);
  });

  it('deve rejeitar mensagem com ID vazio', () => {
    const result = CapturedMessageSchema.safeParse(invalidMessageMissingId);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContainEqual('id');
    }
  });

  it('deve rejeitar mensagem com tipo inválido', () => {
    const result = CapturedMessageSchema.safeParse(invalidMessageWrongType);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContainEqual('type');
    }
  });

  it('deve rejeitar mensagem sem chatId', () => {
    const message = { ...validMessage, chatId: '' };
    const result = CapturedMessageSchema.safeParse(message);
    expect(result.success).toBe(false);
  });

  it('deve rejeitar mensagem sem chatName', () => {
    const message = { ...validMessage, chatName: '' };
    const result = CapturedMessageSchema.safeParse(message);
    expect(result.success).toBe(false);
  });

  it('deve rejeitar mensagem sem sender', () => {
    const message = { ...validMessage, sender: '' };
    const result = CapturedMessageSchema.safeParse(message);
    expect(result.success).toBe(false);
  });

  it('deve aceitar todos os tipos válidos de mensagem', () => {
    const types = ['text', 'image', 'audio', 'video', 'document', 'sticker'] as const;
    types.forEach(type => {
      const message = { ...validMessage, type };
      const result = CapturedMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });
  });
});

describe('SelectorDefinitionSchema', () => {
  it('deve validar seletor válido', () => {
    const result = SelectorDefinitionSchema.safeParse(validSelectorDefinition);
    expect(result.success).toBe(true);
  });

  it('deve rejeitar seletor com array vazio', () => {
    const result = SelectorDefinitionSchema.safeParse(invalidSelectorEmptyArray);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContainEqual('selectors');
    }
  });

  it('deve rejeitar seletor sem ID', () => {
    const selector = { ...validSelectorDefinition, id: '' };
    const result = SelectorDefinitionSchema.safeParse(selector);
    expect(result.success).toBe(false);
  });

  it('deve rejeitar seletor sem description', () => {
    const selector = { ...validSelectorDefinition, description: '' };
    const result = SelectorDefinitionSchema.safeParse(selector);
    expect(result.success).toBe(false);
  });

  it('deve aceitar status válidos', () => {
    const statuses = ['working', 'broken', 'unknown'] as const;
    statuses.forEach(status => {
      const selector = { ...validSelectorDefinition, status };
      const result = SelectorDefinitionSchema.safeParse(selector);
      expect(result.success).toBe(true);
    });
  });

  it('deve aceitar lastVerified opcional', () => {
    const selectorWithDate = { ...validSelectorDefinition, lastVerified: new Date() };
    const result = SelectorDefinitionSchema.safeParse(selectorWithDate);
    expect(result.success).toBe(true);
  });

  it('deve aceitar seletor sem lastVerified', () => {
    const result = SelectorDefinitionSchema.safeParse(validSelectorDefinition);
    expect(result.success).toBe(true);
  });
});

describe('SelectorsConfigSchema', () => {
  it('deve validar config válido', () => {
    const result = SelectorsConfigSchema.safeParse(validSelectorsConfig);
    expect(result.success).toBe(true);
  });

  it('deve rejeitar config com updatedAt inválido', () => {
    const result = SelectorsConfigSchema.safeParse(invalidSelectorsConfigWrongDate);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContainEqual('updatedAt');
    }
  });

  it('deve rejeitar config sem version', () => {
    const config = { ...validSelectorsConfig, version: '' };
    const result = SelectorsConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('deve validar estrutura de seletores', () => {
    const result = SelectorsConfigSchema.safeParse(validSelectorsConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.selectors).toBeDefined();
      expect(typeof result.data.selectors).toBe('object');
    }
  });
});

describe('MessageDBEntrySchema', () => {
  it('deve validar entrada válida', () => {
    const result = MessageDBEntrySchema.safeParse(validDBEntry);
    expect(result.success).toBe(true);
  });

  it('deve rejeitar entrada com timestamp inválido', () => {
    const result = MessageDBEntrySchema.safeParse(invalidDBEntryWrongTimestamp);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContainEqual('timestamp');
    }
  });

  it('deve aceitar timestamp como string ISO válida', () => {
    const entry = { ...validDBEntry, timestamp: '2026-01-15T10:30:00.000Z' };
    const result = MessageDBEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
  });

  it('deve rejeitar entrada sem ID', () => {
    const entry = { ...validDBEntry, id: '' };
    const result = MessageDBEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });
});

describe('Helpers de Conversão', () => {
  it('messageToDBEntry deve converter Date para string ISO', () => {
    const dbEntry = messageToDBEntry(validMessage);
    expect(dbEntry.timestamp).toBe(validMessage.timestamp.toISOString());
    expect(typeof dbEntry.timestamp).toBe('string');
    expect(dbEntry.id).toBe(validMessage.id);
    expect(dbEntry.chatId).toBe(validMessage.chatId);
  });

  it('dbEntryToMessage deve converter string ISO para Date', () => {
    const message = dbEntryToMessage(validDBEntry);
    expect(message.timestamp).toBeInstanceOf(Date);
    expect(message.timestamp.toISOString()).toBe(validDBEntry.timestamp);
    expect(message.id).toBe(validDBEntry.id);
    expect(message.chatId).toBe(validDBEntry.chatId);
  });

  it('round-trip: message → DB entry → message deve preservar dados', () => {
    const dbEntry = messageToDBEntry(validMessage);
    const restoredMessage = dbEntryToMessage(dbEntry);

    expect(restoredMessage.id).toBe(validMessage.id);
    expect(restoredMessage.chatId).toBe(validMessage.chatId);
    expect(restoredMessage.chatName).toBe(validMessage.chatName);
    expect(restoredMessage.sender).toBe(validMessage.sender);
    expect(restoredMessage.text).toBe(validMessage.text);
    expect(restoredMessage.isOutgoing).toBe(validMessage.isOutgoing);
    expect(restoredMessage.type).toBe(validMessage.type);
    expect(restoredMessage.timestamp.getTime()).toBe(validMessage.timestamp.getTime());
  });
});
