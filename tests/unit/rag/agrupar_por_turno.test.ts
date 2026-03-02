import { describe, it, expect } from 'vitest';
import type { CapturedMessage } from '../../../src/types';
import { agrupar_por_turno } from '../../../src/modules/rag';
import { validMessage } from '../../fixtures/test-data';

function createMessage(overrides: Partial<CapturedMessage>): CapturedMessage {
  return {
    ...validMessage,
    ...overrides,
  };
}

describe('agrupar_por_turno (RAG)', () => {
  it('array vazio retorna []', () => {
    const result = agrupar_por_turno([]);
    expect(result).toEqual([]);
  });

  it('só mensagens do cliente retorna []', () => {
    const messages: CapturedMessage[] = [
      createMessage({
        id: 'c1',
        isOutgoing: false,
        text: 'Oi',
        timestamp: new Date('2026-01-01T10:00:00Z'),
      }),
      createMessage({
        id: 'c2',
        isOutgoing: false,
        text: 'Tudo bem?',
        timestamp: new Date('2026-01-01T10:01:00Z'),
      }),
    ];

    const result = agrupar_por_turno(messages);
    expect(result).toEqual([]);
  });

  it('só mensagens do atendente retorna []', () => {
    const messages: CapturedMessage[] = [
      createMessage({
        id: 'a1',
        isOutgoing: true,
        sender: 'Atendente',
        text: 'Olá',
        timestamp: new Date('2026-01-01T10:00:00Z'),
      }),
      createMessage({
        id: 'a2',
        isOutgoing: true,
        sender: 'Atendente',
        text: 'Posso ajudar?',
        timestamp: new Date('2026-01-01T10:01:00Z'),
      }),
    ];

    const result = agrupar_por_turno(messages);
    expect(result).toEqual([]);
  });

  it('primeira mensagem é do atendente: ignora até aparecer cliente', () => {
    const clientTs = new Date('2026-01-01T10:01:00Z');
    const messages: CapturedMessage[] = [
      createMessage({
        id: 'a0',
        isOutgoing: true,
        sender: 'Atendente',
        text: 'Mensagem inicial do atendente',
        timestamp: new Date('2026-01-01T10:00:00Z'),
      }),
      createMessage({
        id: 'c1',
        isOutgoing: false,
        text: 'Oi, tudo bem?',
        timestamp: clientTs,
      }),
      createMessage({
        id: 'a1',
        isOutgoing: true,
        sender: 'Atendente',
        text: 'Tudo e você?',
        timestamp: new Date('2026-01-01T10:02:00Z'),
      }),
    ];

    const result = agrupar_por_turno(messages);

    expect(result).toHaveLength(1);
    const chunk = result[0];
    expect(chunk.messageIds).toEqual(['c1', 'a1']);
    expect(chunk.turnSize).toEqual({ client: 1, agent: 1 });
    expect(chunk.timestamp).toBe(clientTs.toISOString());
  });

  it('última mensagem é do cliente sem resposta: ignora último turno do cliente', () => {
    const firstClientTs = new Date('2026-01-01T10:00:00Z');
    const messages: CapturedMessage[] = [
      createMessage({
        id: 'c1',
        isOutgoing: false,
        text: 'Primeira pergunta',
        timestamp: firstClientTs,
      }),
      createMessage({
        id: 'a1',
        isOutgoing: true,
        sender: 'Atendente',
        text: 'Primeira resposta',
        timestamp: new Date('2026-01-01T10:01:00Z'),
      }),
      createMessage({
        id: 'c2',
        isOutgoing: false,
        text: 'Segunda pergunta sem resposta',
        timestamp: new Date('2026-01-01T10:02:00Z'),
      }),
    ];

    const result = agrupar_por_turno(messages);

    expect(result).toHaveLength(1);
    const chunk = result[0];
    expect(chunk.messageIds).toEqual(['c1', 'a1']);
    expect(chunk.turnSize).toEqual({ client: 1, agent: 1 });
    expect(chunk.timestamp).toBe(firstClientTs.toISOString());
  });

  it('mensagens com texto vazio ou só espaços são ignoradas', () => {
    const clientTs = new Date('2026-01-01T10:00:00Z');
    const messages: CapturedMessage[] = [
      createMessage({
        id: 'c1',
        isOutgoing: false,
        text: 'Oi',
        timestamp: clientTs,
      }),
      createMessage({
        id: 'c2',
        isOutgoing: false,
        text: '   ',
        timestamp: new Date('2026-01-01T10:00:30Z'),
      }),
      createMessage({
        id: 'a1',
        isOutgoing: true,
        sender: 'Atendente',
        text: 'Olá, como posso ajudar?',
        timestamp: new Date('2026-01-01T10:01:00Z'),
      }),
      createMessage({
        id: 'a2',
        isOutgoing: true,
        sender: 'Atendente',
        text: '',
        timestamp: new Date('2026-01-01T10:01:30Z'),
      }),
    ];

    const result = agrupar_por_turno(messages);

    expect(result).toHaveLength(1);
    const chunk = result[0];
    expect(chunk.messageIds).toEqual(['c1', 'a1']);
    expect(chunk.turnSize).toEqual({ client: 1, agent: 1 });
  });

  it('um par simples (1 cliente + 1 atendente) monta chunk corretamente', () => {
    const clientTs = new Date('2026-01-01T10:00:00Z');
    const client = createMessage({
      id: 'c1',
      isOutgoing: false,
      text: 'Oi, tudo bem?',
      timestamp: clientTs,
    });
    const agent = createMessage({
      id: 'a1',
      isOutgoing: true,
      sender: 'Atendente',
      text: 'Tudo bem, e você?',
      timestamp: new Date('2026-01-01T10:01:00Z'),
    });

    const result = agrupar_por_turno([client, agent]);

    expect(result).toHaveLength(1);
    const chunk = result[0];

    expect(chunk.turnSize).toEqual({ client: 1, agent: 1 });
    expect(chunk.content).toBe('Cliente: Oi, tudo bem?\nAtendente: Tudo bem, e você?');
    expect(chunk.messageIds).toEqual(['c1', 'a1']);
    expect(chunk.timestamp).toBe(clientTs.toISOString());
    expect(chunk.chatId).toBe(client.chatId);
    expect(chunk.id).toBe(`${client.chatId}_${clientTs.toISOString()}`);
  });

  it('vários turnos múltiplos (mais de uma mensagem por turno)', () => {
    const client1Ts = new Date('2026-01-01T10:00:00Z');
    const messages: CapturedMessage[] = [
      createMessage({
        id: 'c1',
        isOutgoing: false,
        text: 'Oi',
        timestamp: client1Ts,
      }),
      createMessage({
        id: 'c2',
        isOutgoing: false,
        text: 'Tudo bem por aí?',
        timestamp: new Date('2026-01-01T10:00:30Z'),
      }),
      createMessage({
        id: 'a1',
        isOutgoing: true,
        sender: 'Atendente',
        text: 'Olá, tudo bem sim.',
        timestamp: new Date('2026-01-01T10:01:00Z'),
      }),
      createMessage({
        id: 'a2',
        isOutgoing: true,
        sender: 'Atendente',
        text: 'Como posso ajudar hoje?',
        timestamp: new Date('2026-01-01T10:01:30Z'),
      }),
      createMessage({
        id: 'c3',
        isOutgoing: false,
        text: 'Quero saber sobre o plano X.',
        timestamp: new Date('2026-01-01T10:02:00Z'),
      }),
      createMessage({
        id: 'a3',
        isOutgoing: true,
        sender: 'Atendente',
        text: 'Claro, vou te explicar.',
        timestamp: new Date('2026-01-01T10:03:00Z'),
      }),
    ];

    const result = agrupar_por_turno(messages);

    expect(result).toHaveLength(2);

    const firstChunk = result[0];
    expect(firstChunk.turnSize).toEqual({ client: 2, agent: 2 });
    expect(firstChunk.messageIds).toEqual(['c1', 'c2', 'a1', 'a2']);
    expect(firstChunk.content).toBe(
      'Cliente: Oi Tudo bem por aí?\nAtendente: Olá, tudo bem sim. Como posso ajudar hoje?',
    );

    const secondChunk = result[1];
    expect(secondChunk.turnSize).toEqual({ client: 1, agent: 1 });
    expect(secondChunk.messageIds).toEqual(['c3', 'a3']);
  });

  it('gera mesmos chunks e mesmo id para o mesmo array de mensagens', () => {
    const messages: CapturedMessage[] = [
      createMessage({
        id: 'c1',
        isOutgoing: false,
        text: 'Oi',
        timestamp: new Date('2026-01-01T10:00:00Z'),
      }),
      createMessage({
        id: 'a1',
        isOutgoing: true,
        sender: 'Atendente',
        text: 'Olá',
        timestamp: new Date('2026-01-01T10:01:00Z'),
      }),
    ];

    const result1 = agrupar_por_turno(messages);
    const result2 = agrupar_por_turno(messages);

    expect(result1).toEqual(result2);
    expect(result1[0].id).toBe(result2[0].id);
  });
});

