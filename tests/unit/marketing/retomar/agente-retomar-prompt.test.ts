import { describe, expect, it } from 'vitest';
import {
  buildAgenteRetomarMessages,
  parseSkillMarkdown,
} from '../../../../src/modules/marketing/retomar/agente-retomar-prompt';

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

describe('buildAgenteRetomarMessages', () => {
  const skillBody = `# Retomar Clientes

## Regras por Ciclo
- cycleIndex=1: só presença
- cycleIndex=2: pode perguntar leve

## Dados do Contato
firstName: {firstName}
cycleIndex: {cycleIndex}
relationType: {relationType}
daysInactive: {daysInactive}
lastRetomarSentText: {lastRetomarSentText}

Catálogo:
{catalogo}

Histórico:
{conversationThread}

Gere agora a mensagem final.`;

  it('substitui placeholders no corpo da skill', () => {
    const { system, user } = buildAgenteRetomarMessages(skillBody, {
      firstName: 'Ana',
      cycleIndex: 2,
      lastIncomingFromClient: 'Oi',
      lastRetomarSentText: 'Tudo bem?',
      conversationThread: '[cliente] Oi',
      catalogo: 'Pão, Bolo',
    });

    expect(system).toContain('Ana');
    expect(system).toContain('2');
    expect(system).not.toContain('{firstName}');
    expect(system).not.toContain('{cycleIndex}');
    expect(system).toContain('Tudo bem?');
    expect(system).toContain('[cliente] Oi');
    expect(system).toContain('Pão, Bolo');
    expect(user).toBe('Gere a mensagem.');
  });

  it('limita cycleIndex entre 1 e 4', () => {
    const { system } = buildAgenteRetomarMessages(skillBody, {
      firstName: 'Ana',
      cycleIndex: 99,
      lastIncomingFromClient: 'Oi',
      lastRetomarSentText: '',
      conversationThread: '',
    });

    expect(system).toContain('4');
    expect(system).not.toContain('99');
  });

  it('usa sentinelas para campos vazios', () => {
    const { system } = buildAgenteRetomarMessages(skillBody, {
      firstName: '',
      cycleIndex: 1,
      lastIncomingFromClient: 'Oi',
      lastRetomarSentText: '',
      conversationThread: '',
    });

    expect(system).toContain('(não informado)');
    expect(system).toContain('(nenhuma ainda)');
    expect(system).toContain('(sem histórico)');
    expect(system).toContain('(catálogo não disponível)');
  });

  it('preenche relationType com label descritivo', () => {
    const { system } = buildAgenteRetomarMessages(skillBody, {
      firstName: 'Ana',
      cycleIndex: 1,
      lastIncomingFromClient: 'Oi',
      lastRetomarSentText: '',
      conversationThread: '',
      relationType: 'frequente',
    });

    expect(system).toContain('Frequente (quinzenal ou mensal)');
  });
});
