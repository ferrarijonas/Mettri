import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from '../../../src/modules/rag';

describe('cosineSimilarity (RAG)', () => {
  it('retorna ~1 para vetores idênticos', () => {
    const a = [1, 2, 3];
    const b = [1, 2, 3];

    const score = cosineSimilarity(a, b);

    expect(score).toBeCloseTo(1, 6);
  });

  it('retorna ~0 para vetores ortogonais simples', () => {
    const a = [1, 0];
    const b = [0, 1];

    const score = cosineSimilarity(a, b);

    expect(score).toBeCloseTo(0, 6);
  });

  it('retorna ~-1 para vetores opostos', () => {
    const a = [1, 0];
    const b = [-1, 0];

    const score = cosineSimilarity(a, b);

    expect(score).toBeCloseTo(-1, 6);
  });

  it('retorna 0 quando alguma norma é zero', () => {
    const a = [0, 0];
    const b = [1, 2];

    const score = cosineSimilarity(a, b);

    expect(score).toBe(0);
  });

  it('lança erro para vetores com dimensões diferentes', () => {
    const a = [1, 2, 3];
    const b = [1, 2];

    expect(() => cosineSimilarity(a, b)).toThrowError(/dimensões diferentes/);
  });
});

