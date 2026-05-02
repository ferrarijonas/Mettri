import { catalogoDB, type CatalogProduct } from '../../storage/catalogo-db';
import { type CatalogClock, type CatalogIdFactory, type CatalogoRepository, type CatalogoResult, normalizeText } from './catalogo-types';

export interface CatalogoSeedOutput {
  seedApplied: boolean;
  insertedCount: number;
  products: CatalogProduct[];
}

export interface CatalogoSeedDeps {
  catalogoRepository: Pick<CatalogoRepository, 'listByAccount' | 'insert'>;
  clock: CatalogClock;
  idFactory: CatalogIdFactory;
}

const defaultDeps: CatalogoSeedDeps = {
  catalogoRepository: catalogoDB,
  clock: {
    nowIso: () => new Date().toISOString(),
  },
  idFactory: {
    newId: () => `cat_${Date.now()}_${Math.random().toString(16).slice(2)}`,
  },
};

interface SeedTemplate {
  sku: string;
  nome: string;
  categoria: string;
  precoCentavos: number;
}

const SEED_V1: SeedTemplate[] = [
  { sku: 'PAO-MULTIGRAOS', nome: 'Pão Multigrãos', categoria: 'Pães', precoCentavos: 2600 },
  { sku: 'PAO-ABOBORA-GIRASSOL', nome: 'Pão de Abóbora & Girassol', categoria: 'Pães', precoCentavos: 2600 },
  { sku: 'PAO-100-INTEGRAL', nome: 'Pão 100% Integral', categoria: 'Pães', precoCentavos: 3200 },
];

export async function carregarSeedInicialCatalogo(
  accountId: string,
  deps: CatalogoSeedDeps = defaultDeps
): Promise<CatalogoResult<CatalogoSeedOutput>> {
  const accountIdNormalized = normalizeText(accountId);
  if (!accountIdNormalized) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'accountId é obrigatório.' };
  }

  try {
    const existing = await deps.catalogoRepository.listByAccount(accountIdNormalized);
    if (existing.length > 0) {
      return {
        ok: true,
        data: {
          seedApplied: false,
          insertedCount: 0,
          products: [],
        },
      };
    }

    const nowIso = deps.clock.nowIso();
    const inserted: CatalogProduct[] = [];
    for (const seed of SEED_V1) {
      const created: CatalogProduct = {
        productId: deps.idFactory.newId(),
        accountId: accountIdNormalized,
        sku: seed.sku,
        nome: seed.nome,
        categoria: seed.categoria,
        descricao: null,
        precoCentavos: seed.precoCentavos,
        estoqueDisponivel: null,
        ativo: true,
        updatedAt: nowIso,
        version: 1,
      };
      inserted.push(await deps.catalogoRepository.insert(created));
    }

    return {
      ok: true,
      data: {
        seedApplied: true,
        insertedCount: inserted.length,
        products: inserted,
      },
    };
  } catch (error) {
    return {
      ok: false,
      errorCode: 'REPOSITORY_ERROR',
      message: error instanceof Error ? error.message : 'Falha ao carregar seed inicial.',
    };
  }
}
