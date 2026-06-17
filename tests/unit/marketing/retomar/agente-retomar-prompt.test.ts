import { describe, expect, it } from 'vitest';
import {
  buildAgenteRetomarMessages,
  parseAgenteRetomarMarkdown,
  parseSkillMarkdown,
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

describe('parseSkillMarkdown', () => {
  it('extrai YAML frontmatter e corpo de SKILL.md válido', () => {
    const md = `---
name: retomar-clientes
description: Gera mensagem de reativação
whenToUse: Quando o usuário clica "Gerar msgs por IA"
---

# Procedimento de Retomada

Regras de ciclo.`;
    const { meta, body } = parseSkillMarkdown(md);
    expect(meta.name).toBe('retomar-clientes');
    expect(meta.description).toBe('Gera mensagem de reativação');
    expect(meta.whenToUse).toBe('Quando o usuário clica "Gerar msgs por IA"');
    expect(body).toContain('# Procedimento de Retomada');
    expect(body).toContain('Regras de ciclo');
  });

  it('lança erro se frontmatter YAML ausente', () => {
    expect(() => parseSkillMarkdown('# Sem frontmatter')).toThrow('frontmatter');
  });

  it('lança erro se campo "name" ausente no frontmatter', () => {
    const md = `---
description: algo
---
corpo`;
    expect(() => parseSkillMarkdown(md)).toThrow('name');
  });

  it('extrai corpo mesmo com frontmatter mínimo', () => {
    const md = `---
name: x
---
body only`;
    const { meta, body } = parseSkillMarkdown(md);
    expect(meta.name).toBe('x');
    expect(meta.description).toBe('');
    expect(meta.whenToUse).toBe('');
    expect(body).toBe('body only');
  });
});

describe('buildAgenteRetomarMessages com skillContent', () => {
  it('usa skillContent como system quando fornecido', () => {
    resetAgenteRetomarPromptCache();
    const skillBody = '# Skill de Retomada\n\nRegras de ciclo.';
    const { system, user } = buildAgenteRetomarMessages({
      firstName: 'Ana',
      cycleIndex: 1,
      lastIncomingFromClient: 'Oi',
      lastRetomarSentText: '',
      conversationThread: '[cliente] Oi',
      skillContent: skillBody,
    });
    expect(system).toBe(skillBody);
    expect(system).toContain('Skill de Retomada');
  });

  it('fallback para system do agente_retomar.md sem skillContent', () => {
    resetAgenteRetomarPromptCache();
    const { system } = buildAgenteRetomarMessages({
      firstName: 'Ana',
      cycleIndex: 1,
      lastIncomingFromClient: 'Oi',
      lastRetomarSentText: '',
      conversationThread: '[cliente] Oi',
    });
    // Deve conter conteúdo do agente_retomar.md original
    expect(system).toContain('Jonas');
  });

  it('fallback para system do agente_retomar.md com skillContent vazio', () => {
    resetAgenteRetomarPromptCache();
    const { system } = buildAgenteRetomarMessages({
      firstName: 'Ana',
      cycleIndex: 1,
      lastIncomingFromClient: 'Oi',
      lastRetomarSentText: '',
      conversationThread: '[cliente] Oi',
      skillContent: '',
    });
    expect(system).toContain('Jonas');
  });
});
