// justificado: IndexedDB não disponível em Node.js, fake-indexeddb é polyfill fiel
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { MessageCapturer } from '../../src/core/message-capturer';
import { SelectorsConfigSchema } from '../../src/types/schemas';
import { CapturedMessageSchema } from '../../src/types/schemas';
import { validSelectorsConfig, invalidSelectorsConfigWrongDate } from '../fixtures/test-data';

/**
 * MessageCapturer — testes sem mocks de módulo.
 *
 * Dependências de infraestrutura (DataScraper, webhookService, whatsappInterceptors)
 * não estão disponíveis em Node.js — start() lança erro conforme design.
 * As funções de validação Zod e o registro de callbacks são testáveis diretamente.
 * message-db e client-db usam IndexedDB real (fake-indexeddb via setup global).
 */
describe('MessageCapturer', () => {
  it('deve criar instância sem erro', () => {
    const capturer = new MessageCapturer();
    expect(capturer).toBeDefined();
    expect(capturer).toBeInstanceOf(MessageCapturer);
  });

  it('deve registrar callback sem erro', () => {
    const capturer = new MessageCapturer();
    const callback = () => {};
    expect(() => capturer.onMessage(callback)).not.toThrow();
  });

  it('deve falhar ao start sem webpack disponível', async () => {
    const capturer = new MessageCapturer();
    await expect(capturer.start()).rejects.toThrow('Webpack não disponível');
  });

  it('stop deve ser seguro mesmo sem start', () => {
    const capturer = new MessageCapturer();
    expect(() => capturer.stop()).not.toThrow();
  });

  it('getStats deve retornar estado inicial', () => {
    const capturer = new MessageCapturer();
    const stats = capturer.getStats();
    expect(stats.isUsingWebpack).toBe(false);
    expect(stats.webpackMessages).toBe(0);
    expect(stats.webpackEvents).toBe(0);
  });

  it('resetAndRetry deve falhar sem webpack', async () => {
    const capturer = new MessageCapturer();
    await expect(capturer.resetAndRetry()).rejects.toThrow();
  });
});

describe('Validação de CapturedMessageSchema (Zod)', () => {
  it('deve validar dados válidos', () => {
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

    const result = CapturedMessageSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('deve rejeitar dados com ID vazio', () => {
    const invalidData = {
      id: '',
      chatId: 'chat-456',
      chatName: 'João Silva',
      sender: 'João Silva',
      text: 'Olá',
      timestamp: new Date(),
      isOutgoing: false,
      type: 'text' as const,
    };

    const result = CapturedMessageSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('deve validar config de seletores válido', () => {
    expect(() => {
      SelectorsConfigSchema.parse(validSelectorsConfig);
    }).not.toThrow();
  });

  it('deve rejeitar config de seletores inválido', () => {
    expect(() => {
      SelectorsConfigSchema.parse(invalidSelectorsConfigWrongDate);
    }).toThrow();
  });
});
