import { describe, it, expect, beforeEach } from 'vitest';
import { SelectorGenerator } from '../../src/infrastructure/auto-mapper/selector-generator';
import { SelectorValidator } from '../../src/infrastructure/auto-mapper/selector-validator';

describe('SelectorGenerator', () => {
  let generator: SelectorGenerator;

  beforeEach(() => {
    generator = new SelectorGenerator();
  });

  it('deve gerar candidatos a partir de um elemento com data-testid', () => {
    const element = document.createElement('div');
    element.setAttribute('data-testid', 'test-element');
    element.id = 'test-id';

    const candidates = generator.generateCandidates(element);

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]).toBe('[data-testid="test-element"]');
  });

  it('deve gerar candidatos a partir de um elemento com id único', () => {
    const element = document.createElement('div');
    element.id = 'unique-id';
    document.body.appendChild(element);

    const candidates = generator.generateCandidates(element);

    expect(candidates).toContain('#unique-id');
    document.body.removeChild(element);
  });

  it('deve gerar candidatos a partir de classes', () => {
    const element = document.createElement('div');
    element.className = 'message-in container';

    const candidates = generator.generateCandidates(element);

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.some(c => c.includes('.message-in'))).toBe(true);
  });

  it('deve gerar seletor combinado', () => {
    const element = document.createElement('div');
    element.setAttribute('data-testid', 'test-element');

    const combined = generator.generateCombinedSelector(element);

    expect(combined).toBe('[data-testid="test-element"]');
  });
});

describe('SelectorValidator', () => {
  let validator: SelectorValidator;

  beforeEach(() => {
    validator = new SelectorValidator();
    document.body.innerHTML = '';
  });

  it('deve validar seletor que encontra elemento', async () => {
    const element = document.createElement('div');
    element.id = 'test-element';
    document.body.appendChild(element);

    const context = {
      selectorId: 'test',
      expectedCount: 1,
      // Em JSDOM não há layout real (offsetWidth/offsetHeight == 0),
      // então visibilidade visual não é um requisito confiável aqui.
      mustBeVisible: false,
    };

    const result = await validator.validate('#test-element', element, context);

    expect(result.isValid).toBe(true);
    expect(result.element).toBe(element);
  });

  it('deve invalidar seletor que não encontra elemento', async () => {
    const element = document.createElement('div');
    element.id = 'test-element';
    document.body.appendChild(element);

    const context = {
      selectorId: 'test',
      expectedCount: 1,
      mustBeVisible: true,
    };

    const result = await validator.validate('#non-existent', element, context);

    expect(result.isValid).toBe(false);
  });

  it('deve validar unicidade quando esperado', async () => {
    const element1 = document.createElement('div');
    element1.className = 'test-class';
    const element2 = document.createElement('div');
    element2.className = 'test-class';
    document.body.appendChild(element1);
    document.body.appendChild(element2);

    const context = {
      selectorId: 'test',
      expectedCount: 1,
      mustBeVisible: true,
    };

    const result = await validator.validate('.test-class', element1, context);

    expect(result.isUnique).toBe(false);
    expect(result.isValid).toBe(false);
  });

  it('deve fazer validação rápida', () => {
    const element = document.createElement('div');
    element.id = 'quick-test';
    document.body.appendChild(element);

    const isValid = validator.quickValidate('#quick-test', element);

    expect(isValid).toBe(true);
  });
});
