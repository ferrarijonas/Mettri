import { catalogoDB, type CatalogProduct } from '../../storage/catalogo-db';
import { type CatalogClock, type CatalogoRepository, type CatalogoResult, normalizeText } from './catalogo-types';

export interface SetActiveInput {
  accountId: string;
  productId: string;
  ativo: boolean;
}

export interface CatalogoSetActiveDeps {
  catalogoRepository: Pick<CatalogoRepository, 'getById' | 'update'>;
  clock: CatalogClock;
}

const defaultDeps: CatalogoSetActiveDeps = {
  catalogoRepository: catalogoDB,
  clock: {
    nowIso: () => new Date().toISOString(),
  },
};

export async function alterarDisponibilidadeProdutoCatalogo(
  input: SetActiveInput,
  deps: CatalogoSetActiveDeps = defaultDeps
): Promise<CatalogoResult<CatalogProduct>> {
  const accountId = normalizeText(input.accountId);
  const productId = normalizeText(input.productId);
  if (!accountId || !productId) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'accountId e productId são obrigatórios.' };
  }

  try {
    const existing = await deps.catalogoRepository.getById(accountId, productId);
    if (!existing) {
      return { ok: false, errorCode: 'NOT_FOUND', message: 'Produto não encontrado.' };
    }

    if (existing.ativo === input.ativo) {
      return { ok: true, data: existing };
    }

    const updated: CatalogProduct = {
      ...existing,
      ativo: input.ativo,
      updatedAt: deps.clock.nowIso(),
      version: existing.version + 1,
    };

    const saved = await deps.catalogoRepository.update(updated);
    return { ok: true, data: saved };
  } catch (error) {
    return {
      ok: false,
      errorCode: 'REPOSITORY_ERROR',
      message: error instanceof Error ? error.message : 'Falha ao alterar disponibilidade.',
    };
  }
}
