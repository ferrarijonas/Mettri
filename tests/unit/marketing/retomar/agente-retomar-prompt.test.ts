import { describe, expect, it } from 'vitest';
import {
  buildAgenteRetomarMessages,
  parseAgenteRetomarMarkdown,
  resetAgenteRetomarPromptCache,
} from '../../../../src/modules/marketing/retomar/agente-retomar-prompt';

describe('parseAgenteRetomarMarkdown', () => {
  it('extrai SYSTEM e USER até o próximo ##', () => {
    const md = `
## SYSTEM
Alpha line one.

## USER
Beta {firstName} tail.

## OUTPUT
ignored
`;
    const { system, userTemplate } = parseAgenteRetomarMarkdown(md);
    expect(system).toContain('Alpha line one');
    expect(system).not.toContain('Beta');
    expect(userTemplate).toContain('Beta {firstName} tail');
    expect(userTemplate).not.toContain('ignored');
  });

  it('falha sem secções', () => {
    expect(() => parseAgenteRetomarMarkdown('no headers')).toThrow('SYSTEM');
  });

  it('não confunde ## USER dentro de texto com o cabeçalho real', () => {
    const md = `Nota: veja **## USER** no guia.

## SYSTEM
Alpha.

## USER
Oi {firstName}

## OUTPUT
ignorado
`;
    const { system, userTemplate } = parseAgenteRetomarMarkdown(md);
    expect(system.trim()).toBe('Alpha.');
    expect(userTemplate).toBe('Oi {firstName}');
    expect(userTemplate).not.toContain('**');
  });
});

describe('buildAgenteRetomarMessages', () => {
  it('preenche placeholders e limita cycleIndex a 1–4', () => {
    resetAgenteRetomarPromptCache();
    const thread = '[cliente] Oi\n[padaria] Boa tarde!';
    const { user } = buildAgenteRetomarMessages({
      firstName: 'Ana',
      cycleIndex: 99,
      lastIncomingFromClient: 'Oi',
      lastRetomarSentText: '',
      conversationThread: thread,
    });
    expect(user).toContain('Ana');
    expect(user).toContain('4');
    expect(user).not.toContain('99');
    expect(user).toContain(thread);
    expect(user).toContain('Histórico recente da conversa');
    expect(user).toContain('nenhuma ainda');
  });
});
