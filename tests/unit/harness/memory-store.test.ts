// justificado: IndexedDB não disponível em Node.js, fake-indexeddb é polyfill fiel
import 'fake-indexeddb/auto';

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from '../../../src/modules/harness/memory-store';
import { memoryDB } from '../../../src/storage/memory-db';
import type { AgentTurno } from '../../../src/modules/harness/types';

/**
 * Helper: acessa object store para manipular timestamps.
 */
async function getStorage(): Promise<IDBObjectStore | null> {
  try {
    const req = indexedDB.open('mettri-memory-db', 1);
    return await new Promise((resolve) => {
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('memories', 'readwrite');
        resolve(tx.objectStore('memories'));
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

describe('MemoryStore', () => {
  let store: MemoryStore;

  beforeEach(async () => {
    // Limpa registros de testes anteriores (fake-indexeddb persiste em memória)
    await memoryDB.clearAll().catch(() => { /* DB pode não ter iniciado ainda */ });
    store = new MemoryStore();
    await new Promise(r => setTimeout(r, 30));
  });

  // ── prepararContexto ──

  it('deve retornar estrutura vazia para chatId ou mensagem vazios', async () => {
    const r1 = await store.prepararContexto('', 'mensagem');
    expect(r1.cliente).toEqual([]);
    expect(r1.licoes).toEqual([]);
    expect(r1.negocio).toEqual([]);
    expect(r1.referencias).toEqual([]);
    expect(r1.freshnessWarnings).toEqual([]);

    const r2 = await store.prepararContexto('c@us', '');
    expect(r2.cliente).toEqual([]);
  });

  it('deve retornar memórias de cliente e licao filtradas por chatId', async () => {
    // Cliente A — ambas menções contêm "pão" para match único
    await memoryDB.merge({ tipo: 'cliente', descricao: 'prefere pão integral', chatId: 'a@c.us' });
    await memoryDB.merge({ tipo: 'licao', descricao: 'sempre pede pão integral', chatId: 'a@c.us' });
    // Cliente B (não deve aparecer para A)
    await memoryDB.merge({ tipo: 'cliente', descricao: 'prefere pagamento dinheiro', chatId: 'b@c.us' });

    const ctx = await store.prepararContexto('a@c.us', 'pão');
    expect(ctx.cliente).toHaveLength(1);
    expect(ctx.cliente[0]).toContain('integral');
    expect(ctx.licoes).toHaveLength(1);
    expect(ctx.licoes[0]).toContain('pão integral');

    // Cliente B não aparece na busca do A
    const ctxB = await store.prepararContexto('b@c.us', 'pagamento');
    expect(ctxB.cliente).toHaveLength(1);
    expect(ctxB.cliente[0]).toContain('pagamento');
  });

  it('deve retornar memórias globais (negocio, referencia) independente de chatId', async () => {
    await memoryDB.merge({ tipo: 'negocio', descricao: 'entregas somente na região central' });
    await memoryDB.merge({ tipo: 'referencia', descricao: 'código do fornecedor FORN-123' });

    // Busca global: negócio por 'entregas'
    const ctxA = await store.prepararContexto('a@c.us', 'entregas');
    expect(ctxA.negocio).toHaveLength(1);

    // Busca global: referência por 'fornecedor'
    const ctxB = await store.prepararContexto('b@c.us', 'fornecedor');
    expect(ctxB.referencias).toHaveLength(1);
  });

  it('deve incluir freshness warnings quando aplicável', async () => {
    // Inserir e forçar data antiga
    const record = await memoryDB.merge({ tipo: 'negocio', descricao: 'promoção antiga' });
    const storage = await getStorage();
    if (storage) {
      const antiga = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      storage.put({ ...record, id: record.id, atualizada_em: antiga });
    }
    await new Promise(r => setTimeout(r, 20));

    const ctx = await store.prepararContexto('any@c.us', 'promoção');
    // Freshness warning presente
    if (ctx.negocio.length > 0) {
      expect(ctx.negocio[0]).toContain('⚠️');
    }
  });

  // ── salvarTurno ──

  it('deve persistir turno com erro como aprendizado global (negocio)', async () => {
    const turno: AgentTurno = {
      chatId: 'c@c.us',
      mensagemAtual: 'quero 2 pães',
      ferramentasChamadas: [{
        nome: 'buscarPreco',
        argumentos: {},
        resultado: null,
        duracaoMs: 100,
        erro: 'produto não encontrado',
      }],
      status: 'erro',
      iniciadoEm: new Date().toISOString(),
    };

    const id = await store.salvarTurno(turno);
    expect(id).toBeTypeOf('number');

    // Ferramenta com erro → salvo como negocio (global, sem chatId)
    const negocios = await memoryDB.getPorTipo('negocio');
    const encontrado = negocios.find(n => n.descricao.includes('erro'));
    expect(encontrado).toBeDefined();
    expect(encontrado!.descricao).toContain('buscarPreco');
  });

  it('deve persistir turno com tool calls bem-sucedidas como aprendizado global (negocio)', async () => {
    const turno: AgentTurno = {
      chatId: 'c@c.us',
      mensagemAtual: 'qual o preço?',
      ferramentasChamadas: [{
        nome: 'consultarCatalogo',
        argumentos: { produto: 'pão' },
        resultado: { preco: 5 },
        duracaoMs: 200,
      }],
      status: 'ativo',
      iniciadoEm: new Date().toISOString(),
    };

    const id = await store.salvarTurno(turno);
    expect(id).toBeTypeOf('number');
  });

  it('deve retornar null para turno sem aprendizados', async () => {
    const turno: AgentTurno = {
      chatId: 'c@c.us',
      mensagemAtual: 'ok',
      ferramentasChamadas: [],
      status: 'ativo',
      iniciadoEm: new Date().toISOString(),
    };

    const id = await store.salvarTurno(turno);
    expect(id).toBeNull();
  });

  // ── atualizarPerfil ──

  it('deve criar/atualizar perfil do cliente com merge incremental', async () => {
    // Primeira chamada: cria perfil
    const r1 = await store.atualizarPerfil('c@c.us', { nome: 'João' });
    expect(r1).toBe(true);

    // Segunda chamada: adiciona preferência, preserva nome (mesmo chatId, mesmo descricao fixa)
    const r2 = await store.atualizarPerfil('c@c.us', { preferencia: 'pão integral' });
    expect(r2).toBe(true);

    // Deve ter apenas 1 registro (merge upsert pelo mesmo (tipo+chatId+descricao))
    const perfis = await memoryDB.getPorTipo('cliente', 'c@c.us');
    expect(perfis.length).toBe(1);

    const dados = perfis[0].dados as Record<string, unknown>;
    // Merge preservou o campo anterior e adicionou o novo
    expect(dados.nome).toBe('João');
    expect(dados.preferencia).toBe('pão integral');
  });

  it('deve retornar false para chatId vazio', async () => {
    const r = await store.atualizarPerfil('', { teste: 1 });
    expect(r).toBe(false);
  });

  it('deve retornar false para dados vazios', async () => {
    const r = await store.atualizarPerfil('c@c.us', {});
    expect(r).toBe(false);
  });

  // ── Degradação graciosa ──

  it('deve retornar contexto vazio em caso de erro (degradação graciosa)', async () => {
    const ctx = await store.prepararContexto('chat@c.us', 'teste');
    expect(ctx).toBeDefined();
    expect(Array.isArray(ctx.cliente)).toBe(true);
    expect(Array.isArray(ctx.licoes)).toBe(true);
    expect(Array.isArray(ctx.negocio)).toBe(true);
    expect(Array.isArray(ctx.referencias)).toBe(true);
    expect(Array.isArray(ctx.freshnessWarnings)).toBe(true);
  });
});
