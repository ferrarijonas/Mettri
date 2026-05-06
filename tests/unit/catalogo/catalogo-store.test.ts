import { beforeEach, describe, expect, it } from 'vitest';
import {
  alterarDisponibilidadeProdutoCatalogo,
  carregarSeedInicialCatalogo,
  fornecerCatalogoParaAgentes,
  salvarProdutoCatalogo,
} from '../../../src/modules/catalogo';
import type { CatalogProduct } from '../../../src/storage/catalogo-db';

interface InMemoryRepo {
  records: CatalogProduct[];
  listByAccount: (accountId: string) => Promise<CatalogProduct[]>;
  getById: (accountId: string, productId: string) => Promise<CatalogProduct | null>;
  getBySku: (accountId: string, sku: string) => Promise<CatalogProduct | null>;
  insert: (record: CatalogProduct) => Promise<CatalogProduct>;
  update: (record: CatalogProduct) => Promise<CatalogProduct>;
}

function createRepo(): InMemoryRepo {
  const records: CatalogProduct[] = [];
  return {
    records,
    async listByAccount(accountId: string): Promise<CatalogProduct[]> {
      return records.filter((item) => item.accountId === accountId);
    },
    async getById(accountId: string, productId: string): Promise<CatalogProduct | null> {
      return records.find((item) => item.accountId === accountId && item.productId === productId) ?? null;
    },
    async getBySku(accountId: string, sku: string): Promise<CatalogProduct | null> {
      return records.find((item) => item.accountId === accountId && item.sku === sku) ?? null;
    },
    async insert(record: CatalogProduct): Promise<CatalogProduct> {
      records.push(record);
      return record;
    },
    async update(record: CatalogProduct): Promise<CatalogProduct> {
      const idx = records.findIndex((item) => item.productId === record.productId && item.accountId === record.accountId);
      if (idx >= 0) records[idx] = record;
      return record;
    },
  };
}

describe('catalogo-store', () => {
  const accountId = 'conta-teste';
  let repo: InMemoryRepo;
  let idCounter = 0;

  beforeEach(() => {
    repo = createRepo();
    idCounter = 0;
  });

  it('carrega seed inicial apenas quando catálogo está vazio', async () => {
    const deps = {
      catalogoRepository: repo,
      clock: { nowIso: () => '2026-04-20T10:00:00.000Z' },
      idFactory: { newId: () => `cat-${++idCounter}` },
    };

    const first = await carregarSeedInicialCatalogo(accountId, deps);
    const second = await carregarSeedInicialCatalogo(accountId, deps);

    expect(first.ok).toBe(true);
    expect(first.ok && first.data.insertedCount).toBe(3);
    expect(second.ok).toBe(true);
    expect(second.ok && second.data.seedApplied).toBe(false);
    expect((await repo.listByAccount(accountId)).length).toBe(3);
  });

  it('salva produto novo e atualiza produto existente', async () => {
    const deps = {
      catalogoRepository: repo,
      clock: { nowIso: () => '2026-04-20T10:00:00.000Z' },
      idFactory: { newId: () => `cat-${++idCounter}` },
    };
    const created = await salvarProdutoCatalogo(
      {
        accountId,
        sku: 'SKU-001',
        nome: 'Produto teste',
        precoCentavos: 2500,
        estoqueDisponivel: 12,
      },
      deps,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.productId).toContain('cat-');
    expect(created.data.sku).toBe('SKU-001');

    const updated = await salvarProdutoCatalogo(
      {
        accountId,
        productId: created.data.productId,
        sku: 'SKU-001',
        nome: 'Produto teste atualizado',
        precoCentavos: 2700,
        estoqueDisponivel: 9,
        ativo: false,
      },
      deps,
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.data.nome).toBe('Produto teste atualizado');
    expect(updated.data.precoCentavos).toBe(2700);
    expect(updated.data.estoqueDisponivel).toBe(9);
    expect(updated.data.ativo).toBe(false);
  });

  it('bloqueia SKU duplicado', async () => {
    const deps = {
      catalogoRepository: repo,
      clock: { nowIso: () => '2026-04-20T10:00:00.000Z' },
      idFactory: { newId: () => `cat-${++idCounter}` },
    };
    await salvarProdutoCatalogo(
      { accountId, sku: 'SKU-001', nome: 'Produto A', precoCentavos: 1000, estoqueDisponivel: 3 },
      deps,
    );

    const duplicated = await salvarProdutoCatalogo(
      {
        accountId,
        sku: 'SKU-001',
        nome: 'Produto B',
        precoCentavos: 1300,
        estoqueDisponivel: 4,
      },
      deps,
    );
    expect(duplicated.ok).toBe(false);
    expect(!duplicated.ok && duplicated.errorCode).toBe('DUPLICATE_SKU');
  });

  it('altera disponibilidade de produto', async () => {
    const saveDeps = {
      catalogoRepository: repo,
      clock: { nowIso: () => '2026-04-20T10:00:00.000Z' },
      idFactory: { newId: () => `cat-${++idCounter}` },
    };
    const product = await salvarProdutoCatalogo(
      {
        accountId,
        sku: 'SKU-009',
        nome: 'Produto disponibilidade',
        precoCentavos: 999,
        estoqueDisponivel: 2,
      },
      saveDeps,
    );
    expect(product.ok).toBe(true);
    if (!product.ok) return;
    const changed = await alterarDisponibilidadeProdutoCatalogo(
      {
        accountId,
        productId: product.data.productId,
        ativo: false,
      },
      {
        catalogoRepository: repo,
        clock: { nowIso: () => '2026-04-20T12:00:00.000Z' },
      },
    );
    expect(changed.ok).toBe(true);
    expect(changed.ok && changed.data.ativo).toBe(false);
  });

  it('fornece snapshot para agentes somente com produtos ativos', async () => {
    const deps = {
      catalogoRepository: repo,
      clock: { nowIso: () => '2026-04-20T10:00:00.000Z' },
      idFactory: { newId: () => `cat-${++idCounter}` },
    };
    const active = await salvarProdutoCatalogo(
      {
        accountId,
        sku: 'SKU-ATIVO',
        nome: 'Produto ativo',
        precoCentavos: 1500,
        estoqueDisponivel: 6,
        ativo: true,
      },
      deps,
    );
    await salvarProdutoCatalogo(
      {
        accountId,
        sku: 'SKU-INATIVO',
        nome: 'Produto inativo',
        precoCentavos: 1800,
        estoqueDisponivel: 5,
        ativo: false,
      },
      deps,
    );

    const snapshot = await fornecerCatalogoParaAgentes(accountId, {
      catalogoRepository: repo,
      clock: { nowIso: () => '2026-04-20T11:00:00.000Z' },
    });
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok || !active.ok) return;
    expect(snapshot.data.produtosAtivos).toHaveLength(1);
    expect(snapshot.data.produtosAtivos[0].productId).toBe(active.data.productId);
    expect(snapshot.data.produtosAtivos[0].sku).toBe('SKU-ATIVO');
  });
});
