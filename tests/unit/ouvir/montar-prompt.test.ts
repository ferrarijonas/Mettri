import { describe, it, expect } from 'vitest';
import { montarPrompt } from '../../../src/modules/ouvir/monta-prompt';

describe('montarPrompt', () => {
  it('deve montar system + user prompt com identidade e extracao', () => {
    const result = montarPrompt({
      identidade: true,
      extracao: true,
      resposta: false,
      mensagem: 'quero 2 paes',
      catalogoCandidatos: ['Pao Frances'],
    });

    expect(result.systemPrompt).toContain('Pão de Verdade');
    expect(result.systemPrompt).toContain('extraia APENAS');
    expect(result.userPrompt).toContain('quero 2 paes');
    expect(result.userPrompt).toContain('Pao Frances');
  });

  it('deve incluir seção de resposta quando solicitado', () => {
    const result = montarPrompt({
      identidade: true,
      extracao: true,
      resposta: true,
      mensagem: 'quero 2 brigadeiros',
      catalogoCandidatos: ['Brigadeiro'],
    });

    expect(result.systemPrompt).toContain('confirmação curta');
    expect(result.systemPrompt).toContain('3 e 24 palavras');
  });

  it('deve mostrar perfil vazio quando profile é null', () => {
    const result = montarPrompt({
      identidade: false,
      extracao: true,
      resposta: false,
      mensagem: 'teste',
      catalogoCandidatos: [],
    });

    const user = JSON.parse(result.userPrompt.split('\n---\n')[1]);
    expect(user.mensagem).toBe('teste');
    expect(user.catalogo).toEqual([]);
    expect(user.perfil_atual).toEqual({});
  });

  it('deve mostrar SÓ campos vazios no perfil', () => {
    const result = montarPrompt({
      identidade: false,
      extracao: true,
      resposta: false,
      mensagem: 'quero 2 paes',
      catalogoCandidatos: [],
      profile: {
        nomeConfiavel: 'João',
        enderecoEntrega: 'Rua Tal',
        formaPagamentoPreferida: ['dinheiro'],
      } as any,
    });

    // nome, endereco e formaPagamento estão preenchidos → não aparecem no perfil_atual
    const user = JSON.parse(result.userPrompt.split('\n---\n')[1]);
    expect(Object.keys(user.perfil_atual)).toHaveLength(0);
  });

  it('deve mostrar campos vazios que precisam ser extraídos', () => {
    const result = montarPrompt({
      identidade: false,
      extracao: true,
      resposta: false,
      mensagem: 'quero 2 paes',
      catalogoCandidatos: [],
      profile: {
        nomeConfiavel: 'João',
        // endereco vazio, formaPagamento vazio
      } as any,
    });

    const user = JSON.parse(result.userPrompt.split('\n---\n')[1]);
    expect(user.perfil_atual.endereco).toBeNull();
    // formaPagamento deve estar vazio também (se profile não tiver)
    expect(user.perfil_atual.formaPagamento).toBeNull();
  });
});
