import type { CapturedMessage, MessageDBEntry, SelectorDefinition, SelectorsConfig } from '../../src/types';

/**
 * Dados de teste reutilizáveis para testes unitários
 */

export const validMessage: CapturedMessage = {
  id: 'msg-123',
  chatId: 'chat-456',
  chatName: 'João Silva',
  sender: 'João Silva',
  text: 'Olá, como vai?',
  timestamp: new Date('2026-01-15T10:30:00Z'),
  isOutgoing: false,
  type: 'text',
};

export const validMessageOutgoing: CapturedMessage = {
  id: 'msg-124',
  chatId: 'chat-456',
  chatName: 'João Silva',
  sender: 'Eu',
  text: 'Tudo bem, obrigado!',
  timestamp: new Date('2026-01-15T10:31:00Z'),
  isOutgoing: true,
  type: 'text',
};

export const validDBEntry: MessageDBEntry = {
  id: 'msg-123',
  chatId: 'chat-456',
  chatName: 'João Silva',
  sender: 'João Silva',
  text: 'Olá, como vai?',
  timestamp: '2026-01-15T10:30:00.000Z',
  isOutgoing: false,
  type: 'text',
};

export const validSelectorDefinition: SelectorDefinition = {
  id: 'messageText',
  description: 'Texto da mensagem',
  selectors: ['[data-testid="msg-text"]', '.selectable-text span[dir]'],
  status: 'working',
};

export const validSelectorsConfig: SelectorsConfig = {
  version: '2026.01.15',
  updatedAt: '2026-01-15T10:00:00Z',
  selectors: {
    messageText: validSelectorDefinition,
    messageIn: {
      id: 'messageIn',
      description: 'Mensagem recebida',
      selectors: ['.message-in'],
      status: 'working',
    },
  },
};

// Mensagens inválidas para testes de validação
export const invalidMessageMissingId: Omit<CapturedMessage, 'id'> & { id?: string } = {
  id: '',
  chatId: 'chat-456',
  chatName: 'João Silva',
  sender: 'João Silva',
  text: 'Olá',
  timestamp: new Date(),
  isOutgoing: false,
  type: 'text',
};

export const invalidMessageWrongType = {
  ...validMessage,
  type: 'invalid-type',
};

export const invalidDBEntryWrongTimestamp: Omit<MessageDBEntry, 'timestamp'> & { timestamp: string } = {
  ...validDBEntry,
  timestamp: 'not-a-date',
};

export const invalidSelectorEmptyArray: Omit<SelectorDefinition, 'selectors'> & { selectors: string[] } = {
  ...validSelectorDefinition,
  selectors: [],
};

export const invalidSelectorsConfigWrongDate: Omit<SelectorsConfig, 'updatedAt'> & { updatedAt: string } = {
  ...validSelectorsConfig,
  updatedAt: 'not-a-valid-date',
};
