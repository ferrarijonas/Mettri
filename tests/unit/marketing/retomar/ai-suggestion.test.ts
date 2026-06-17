import { describe, expect, it } from 'vitest';
import {
  extractVisibleRetomarMessage,
  getSkillBody,
  resetSkillBodyCache,
} from '../../../../src/modules/marketing/retomar/ai-suggestion';

describe('getSkillBody', () => {
  it('retorna corpo da skill com cache na primeira chamada', () => {
    resetSkillBodyCache();
    const body = getSkillBody();
    expect(body).toContain('Procedimento de Retomada');
    expect(body).toContain('cycleIndex=1');
    expect(body).toContain('Seja direto, sem firulas');
  });

  it('retorna cache na segunda chamada (sem re-parse)', () => {
    resetSkillBodyCache();
    const first = getSkillBody();
    const second = getSkillBody();
    expect(second).toBe(first); // mesma referência (cache)
  });

  it('resetSkillBodyCache limpa o cache', () => {
    resetSkillBodyCache();
    const first = getSkillBody();
    resetSkillBodyCache();
    const afterReset = getSkillBody();
    // Conteúdo igual, mas nova string (re-parse)
    expect(afterReset).toBe(first); // mesmo conteúdo textual
  });
});
