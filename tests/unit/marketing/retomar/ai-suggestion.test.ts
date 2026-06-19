import { describe, expect, it } from 'vitest';
import {
  getSkillBody,
  getSkillMeta,
  resetSkillBodyCache,
} from '../../../../src/modules/marketing/retomar/ai-suggestion';

describe('getSkillMeta', () => {
  it('retorna metadados da skill (name, description, whenToUse)', () => {
    resetSkillBodyCache();
    const meta = getSkillMeta();
    expect(meta.name).toBe('retomar-clientes');
    expect(meta.description).toContain('reativação');
    expect(meta.whenToUse).toContain('Gerar msgs por IA');
  });
});

describe('getSkillBody', () => {
  it('retorna corpo da skill sem frontmatter YAML', () => {
    resetSkillBodyCache();
    const body = getSkillBody();
    expect(body).toContain('# Retomar Clientes Inativos');
    expect(body).toContain('## Regras por Ciclo');
    expect(body).toContain('## Dados do Contato');
    expect(body).not.toContain('---');
    expect(body).not.toContain('name:');
  });

  it('retorna cache na segunda chamada (sem re-parse)', () => {
    resetSkillBodyCache();
    const first = getSkillBody();
    const second = getSkillBody();
    expect(second).toBe(first);
  });

  it('resetSkillBodyCache limpa ambos os caches (body e meta)', () => {
    resetSkillBodyCache();
    const body1 = getSkillBody();
    const meta1 = getSkillMeta();
    resetSkillBodyCache();
    const body2 = getSkillBody();
    const meta2 = getSkillMeta();
    expect(body2).toBe(body1);
    expect(meta2.name).toBe(meta1.name);
  });
});
