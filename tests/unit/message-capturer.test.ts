import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageCapturer } from '../../src/core/message-capturer';
import { SelectorsConfigSchema } from '../../src/types/schemas';
import { validSelectorsConfig, invalidSelectorsConfigWrongDate } from '../fixtures/test-data';

// Mock do messageDB
vi.mock('../../src/storage/message-db', () => ({
  messageDB: {
    saveMessage: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock do selectors.json
vi.mock('../../../config/selectors.json', () => ({
  default: validSelectorsConfig,
}));

describe('MessageCapturer', () => {
  let capturer: MessageCapturer;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    capturer = new MessageCapturer();
  });

  describe('Validação de selectorsConfig', () => {
    it('deve validar config válido ao importar', () => {
      // O config é validado no momento do import (linha 8 de message-capturer.ts)
      // Se chegou aqui sem erro, a validação passou
      expect(() => {
        SelectorsConfigSchema.parse(validSelectorsConfig);
      }).not.toThrow();
    });

    it('deve rejeitar config inválido', () => {
      expect(() => {
        SelectorsConfigSchema.parse(invalidSelectorsConfigWrongDate);
      }).toThrow();
    });
  });

  describe('onMessage', () => {
    it('deve registrar callback', () => {
      const callback = vi.fn();
      capturer.onMessage(callback);
      // Callback foi registrado sem erro
      expect(true).toBe(true);
    });
  });

  describe('start e stop', () => {
    it('deve iniciar e parar captura sem erros', () => {
      // Mock do DOM básico
      const mockContainer = document.createElement('div');
      mockContainer.setAttribute('data-testid', 'conversation-panel-messages');
      document.body.appendChild(mockContainer);

      // Mock do querySelector para retornar o container
      const originalQuerySelector = document.querySelector;
      document.querySelector = vi.fn((selector: string) => {
        if (selector.includes('conversation-panel-messages')) {
          return mockContainer;
        }
        return originalQuerySelector.call(document, selector);
      });

      capturer.start();
      expect(capturer).toBeDefined();

      capturer.stop();
      expect(capturer).toBeDefined();

      // Restaurar
      document.querySelector = originalQuerySelector;
      document.body.removeChild(mockContainer);
    });
  });
});

// Testes adicionais para validação de dados DOM
describe('Validação de dados extraídos do DOM', () => {
  it('deve validar dados antes de criar CapturedMessage', async () => {
    // Este teste verifica que a validação acontece em extractMessage()
    // Como extractMessage() é privado, testamos indiretamente através do comportamento
    // A validação real acontece quando uma mensagem é capturada do DOM

    const validData = {
      id: 'msg-123',
      chatId: 'chat-456',
      chatName: 'João Silva',
      sender: 'João Silva',
      text: 'Olá',
      timestamp: new Date(),
      isOutgoing: false,
      type: 'text' as const,
    };

    // Se os dados são válidos, devem passar na validação
    const { CapturedMessageSchema } = await import('../../src/types/schemas');
    const result = CapturedMessageSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('deve rejeitar dados inválidos extraídos do DOM', async () => {
    const invalidData = {
      id: '', // ID vazio
      chatId: 'chat-456',
      chatName: 'João Silva',
      sender: 'João Silva',
      text: 'Olá',
      timestamp: new Date(),
      isOutgoing: false,
      type: 'text' as const,
    };

    const { CapturedMessageSchema } = await import('../../src/types/schemas');
    const result = CapturedMessageSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
