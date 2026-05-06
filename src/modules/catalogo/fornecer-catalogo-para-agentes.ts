import { catalogoDB } from '../../storage/catalogo-db';
import { type CatalogClock, type CatalogoRepository, type CatalogoResult, normalizeText } from './catalogo-types';

export interface ProdutoSnapshotIA {
  productId: string;
  sku: string;
  nome: string;
  precoCentavos: number;
  estoqueDisponivel: number | null;
  confiancaBase: number;
}

export interface CatalogoSnapshotIA {
  accountId: string;
  generatedAt: string;
  catalogoDisponivel: boolean;
  produtosAtivos: ProdutoSnapshotIA[];
}

export interface CatalogSnapshotDeps {
  catalogoRepository: Pick<CatalogoRepository, 'listByAccount'>;
  clock: CatalogClock;
}

const defaultDeps: CatalogSnapshotDeps = {
  catalogoRepository: catalogoDB,
  clock: {
    nowIso: () => new Date().toISOString(),
  },
};

export async function fornecerCatalogoParaAgentes(
  accountId: string,
  deps: CatalogSnapshotDeps = defaultDeps
): Promise<CatalogoResult<CatalogoSnapshotIA>> {
  const accountIdNormalized = normalizeText(accountId);
  if (!accountIdNormalized) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'accountId é obrigatório.' };
  }

  try {
    const products = await deps.catalogoRepository.listByAccount(accountIdNormalized);
    const produtosAtivos = products
      .filter(product => product.ativo)
      .sort((a, b) => {
        const byName = a.nome.localeCompare(b.nome);
        if (byName !== 0) return byName;
        return a.sku.localeCompare(b.sku);
      })
      .map(
        product =>
          ({
            productId: product.productId,
            sku: product.sku,
            nome: product.nome,
            precoCentavos: product.precoCentavos,
            estoqueDisponivel: product.estoqueDisponivel,
            confiancaBase: 1,
          }) satisfies ProdutoSnapshotIA
      );

    return {
      ok: true,
      data: {
        accountId: accountIdNormalized,
        generatedAt: deps.clock.nowIso(),
        catalogoDisponivel: produtosAtivos.length > 0,
        produtosAtivos,
      },
    };
  } catch (error) {
    return {
      ok: false,
      errorCode: 'REPOSITORY_ERROR',
      message: error instanceof Error ? error.message : 'Falha ao gerar snapshot do catálogo.',
    };
  }
}
