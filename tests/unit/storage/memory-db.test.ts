// justificado: IndexedDB não disponível em Node.js, fake-indexeddb é polyfill fiel
import 'fake-indexeddb/auto';

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryDB, memoryDB, type MemoriaInput } from '../../../src/storage/memory-db';

/**
 * Helper: manipula o IndexedDB diretamente para forçar timestamps antigos.
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

describe('MemoryDB', () => {
  let db: MemoryDB;

  beforeEach(async () => {
    // Limpa registros de testes anteriores (fake-indexeddb persiste em memória)
    await memoryDB.clearAll().catch(() => { /* DB pode não ter iniciado ainda */ });
    db = new MemoryDB();
    await new Promise(r => setTimeout(r, 30));
  });

  // ── merge / CRUD ──

  it('deve inserir memória via merge', async () => {
    const input: MemoriaInput = {
      tipo: 'cliente',
      descricao: 'cliente prefere entrega rápida',
      chatId: '5511999999999@c.us',
      dados: { urgencia: 'alta' },
    };

    const record = await db.merge(input);
    expect(record.id).toBeTypeOf('number');
    expect(record.tipo).toBe('cliente');
    expect(record.descricao).toBe('cliente prefere entrega rápida');
    expect(record.chatId).toBe('5511999999999@c.us');
    expect(record.criada_em).toBeDefined();
    expect(record.atualizada_em).toBeDefined();
  });

  it('deve fazer upsert: mesma (tipo+chatId+descricao) atualiza em vez de duplicar', async () => {
    const input: MemoriaInput = {
      tipo: 'negocio',
      descricao: 'horário de funcionamento: 8h-18h',
      dados: { horario: '8h-18h' },
    };

    const r1 = await db.merge(input);
    const r2 = await db.merge({ ...input, dados: { horario: '9h-19h' } });

    // Mesmo id = atualizou, não inseriu novo
    expect(r2.id).toBe(r1.id);
    // Dados merged: horario atualizado
    expect((r2.dados as Record<string, unknown>).horario).toBe('9h-19h');
  });

  it('deve criar registros separados para descricoes diferentes', async () => {
    const r1 = await db.merge({ tipo: 'cliente', descricao: 'gosta de pão integral', chatId: 'c1' });
    const r2 = await db.merge({ tipo: 'cliente', descricao: 'prefere pagamento dinheiro', chatId: 'c1' });
    expect(r2.id).not.toBe(r1.id);
  });

  // ── getRelevantes (keyword match) ──

  it('deve encontrar memórias por keyword match na descricao', async () => {
    await db.merge({ tipo: 'negocio', descricao: 'entregas somente na região central' });
    await db.merge({ tipo: 'negocio', descricao: 'desconto para pagamento à vista' });

    const results = await db.getRelevantes(null, 'entregas', 5);
    expect(results).toHaveLength(1);
    expect(results[0].descricao).toContain('entregas');
  });

  it('deve fazer match case-insensitive', async () => {
    await db.merge({ tipo: 'negocio', descricao: 'Pão Francês R$ 1,50' });
    const results = await db.getRelevantes(null, 'pão', 5);
    expect(results).toHaveLength(1);
  });

  it('deve filtrar por chatId quando especificado', async () => {
    await db.merge({ tipo: 'cliente', descricao: 'cliente A', chatId: 'a@c.us' });
    await db.merge({ tipo: 'cliente', descricao: 'cliente B', chatId: 'b@c.us' });

    const results = await db.getRelevantes('a@c.us', 'cliente', 5);
    expect(results).toHaveLength(1);
    expect(results[0].chatId).toBe('a@c.us');
  });

  it('deve buscar global quando chatId é null', async () => {
    await db.merge({ tipo: 'negocio', descricao: 'regra global', dados: { val: 1 } });
    await db.merge({ tipo: 'cliente', descricao: 'regra do joão', chatId: 'joao@c.us' });

    // Busca global sem filtro de chatId
    const results = await db.getRelevantes(null, 'regra', 5);
    expect(results).toHaveLength(2); // encontra ambas
  });

  // ── getRelevantes freshness warning ──

  it('deve incluir freshness warning para memórias com >2 dias', async () => {
    // Inserir e forçar atualizada_em para 3 dias atrás
    const record = await db.merge({ tipo: 'negocio', descricao: 'promoção antiga' });
    // Modificar diretamente o registro no IndexedDB com data antiga
    const storage = await getStorage();
    if (storage) {
      const antiga = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      storage.put({
        ...record,
        id: record.id,
        atualizada_em: antiga,
      });
    }

    // Pequena espera para o put completar
    await new Promise(r => setTimeout(r, 20));
    const results = await db.getRelevantes(null, 'promoção', 5);
    expect(results).toHaveLength(1);
    expect(results[0].freshnessWarning).toBeDefined();
    expect(results[0].freshnessWarning).toContain('⚠️');
    expect(results[0].freshnessWarning).toContain('dia');
  });

  // ── getPorTipo ──

  it('deve listar memórias por tipo', async () => {
    await db.merge({ tipo: 'cliente', descricao: 'c1', chatId: 'x' });
    await db.merge({ tipo: 'cliente', descricao: 'c2', chatId: 'x' });
    await db.merge({ tipo: 'negocio', descricao: 'n1' });

    const clientes = await db.getPorTipo('cliente');
    expect(clientes).toHaveLength(2);

    const negocios = await db.getPorTipo('negocio');
    expect(negocios).toHaveLength(1);
  });

  it('deve filtrar getPorTipo por chatId', async () => {
    await db.merge({ tipo: 'cliente', descricao: 'joao', chatId: 'j@c.us' });
    await db.merge({ tipo: 'cliente', descricao: 'maria', chatId: 'm@c.us' });

    const joao = await db.getPorTipo('cliente', 'j@c.us');
    expect(joao).toHaveLength(1);
    expect(joao[0].chatId).toBe('j@c.us');
  });

  // ── listarTipos ──

  it('deve retornar contagem por tipo', async () => {
    await db.merge({ tipo: 'cliente', descricao: 'c1', chatId: 'x' });
    await db.merge({ tipo: 'cliente', descricao: 'c2', chatId: 'x' });
    await db.merge({ tipo: 'licao', descricao: 'l1', chatId: 'x' });
    await db.merge({ tipo: 'negocio', descricao: 'n1' });
    await db.merge({ tipo: 'referencia', descricao: 'r1' });

    const tipos = await db.listarTipos();
    expect(tipos.cliente).toBe(2);
    expect(tipos.licao).toBe(1);
    expect(tipos.negocio).toBe(1);
    expect(tipos.referencia).toBe(1);
  });

  it('deve retornar 0 para tipos sem registros', async () => {
    const tipos = await db.listarTipos();
    expect(tipos.cliente).toBe(0);
    expect(tipos.licao).toBe(0);
    expect(tipos.negocio).toBe(0);
    expect(tipos.referencia).toBe(0);
  });
});
