import { catalogoDB, type CatalogProduct } from '../../storage/catalogo-db';
import { type CatalogoRepository, type CatalogoResult, normalizeText } from './catalogo-types';

export interface CatalogoListFilter {
  search?: string;
  ativo?: boolean;
}

export interface CatalogoListOutput {
  products: CatalogProduct[];
  total: number;
}

export interface CatalogoListDeps {
  catalogoRepository: Pick<CatalogoRepository, 'listByAccount'>;
}

const defaultDeps: CatalogoListDeps = {
  catalogoRepository: catalogoDB,
};

export async function listarProdutosCatalogo(
  accountId: string,
  filtro: CatalogoListFilter | null = null,
  deps: CatalogoListDeps = defaultDeps
): Promise<CatalogoResult<CatalogoListOutput>> {
  const accountIdNormalized = normalizeText(accountId);
  if (!accountIdNormalized) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'accountId é obrigatório.' };
  }

  try {
    const products = await deps.catalogoRepository.listByAccount(accountIdNormalized);
    const searchTerm = normalizeText(String(filtro?.search ?? '')).toLocaleLowerCase();

    const filtered = products.filter(product => {
      if (typeof filtro?.ativo === 'boolean' && product.ativo !== filtro.ativo) {
        return false;
      }

      if (!searchTerm) {
        return true;
      }

      const nome = product.nome.toLocaleLowerCase();
      const sku = product.sku.toLocaleLowerCase();
      return nome.includes(searchTerm) || sku.includes(searchTerm);
    });

    filtered.sort((a, b) => {
      const byUpdatedAt = b.updatedAt.localeCompare(a.updatedAt);
      if (byUpdatedAt !== 0) return byUpdatedAt;
      return a.nome.localeCompare(b.nome);
    });

    return {
      ok: true,
      data: {
        products: filtered,
        total: filtered.length,
      },
    };
  } catch (error) {
    return {
      ok: false,
      errorCode: 'REPOSITORY_ERROR',
      message: error instanceof Error ? error.message : 'Falha ao listar catálogo.',
    };
  }
}
