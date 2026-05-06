import { catalogoDB, type CatalogProduct } from '../../storage/catalogo-db';
import {
  type CatalogClock,
  type CatalogIdFactory,
  type CatalogoRepository,
  type CatalogoResult,
  normalizeOptionalText,
  normalizeText,
} from './catalogo-types';

export interface ProductInput {
  productId?: string;
  accountId: string;
  sku: string;
  nome: string;
  categoria?: string | null;
  descricao?: string | null;
  precoCentavos: number;
  estoqueDisponivel?: number | null;
  ativo?: boolean;
}

export interface CatalogoSaveDeps {
  catalogoRepository: Pick<CatalogoRepository, 'getById' | 'getBySku' | 'insert' | 'update'>;
  clock: CatalogClock;
  idFactory: CatalogIdFactory;
}

const defaultDeps: CatalogoSaveDeps = {
  catalogoRepository: catalogoDB,
  clock: {
    nowIso: () => new Date().toISOString(),
  },
  idFactory: {
    newId: () => `cat_${Date.now()}_${Math.random().toString(16).slice(2)}`,
  },
};

function validateInput(input: ProductInput): { ok: true } | { ok: false; errorCode: 'INVALID_INPUT' | 'INVALID_STOCK'; message: string } {
  const accountId = normalizeText(input.accountId);
  const sku = normalizeText(input.sku);
  const nome = normalizeText(input.nome);

  if (!accountId || !sku || !nome) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'accountId, sku e nome são obrigatórios.' };
  }
  if (!Number.isInteger(input.precoCentavos) || input.precoCentavos < 0) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'precoCentavos deve ser inteiro e >= 0.' };
  }
  if (
    input.estoqueDisponivel !== undefined &&
    input.estoqueDisponivel !== null &&
    (!Number.isInteger(input.estoqueDisponivel) || input.estoqueDisponivel < 0)
  ) {
    return { ok: false, errorCode: 'INVALID_STOCK', message: 'estoqueDisponivel deve ser inteiro >= 0 ou null.' };
  }
  return { ok: true };
}

export async function salvarProdutoCatalogo(
  input: ProductInput,
  deps: CatalogoSaveDeps = defaultDeps
): Promise<CatalogoResult<CatalogProduct>> {
  const validation = validateInput(input);
  if (!validation.ok) return validation;

  const accountId = normalizeText(input.accountId);
  const sku = normalizeText(input.sku);
  const nome = normalizeText(input.nome);
  const categoria = normalizeOptionalText(input.categoria);
  const descricao = normalizeOptionalText(input.descricao);
  const estoqueDisponivel = input.estoqueDisponivel ?? null;
  const productIdInput = normalizeText(input.productId ?? '');

  try {
    const existingBySku = await deps.catalogoRepository.getBySku(accountId, sku);
    if (existingBySku && existingBySku.productId !== productIdInput) {
      return { ok: false, errorCode: 'DUPLICATE_SKU', message: 'Já existe produto com esse SKU para a conta.' };
    }

    if (!productIdInput) {
      const created: CatalogProduct = {
        productId: deps.idFactory.newId(),
        accountId,
        sku,
        nome,
        categoria,
        descricao,
        precoCentavos: input.precoCentavos,
        estoqueDisponivel,
        ativo: input.ativo ?? true,
        updatedAt: deps.clock.nowIso(),
        version: 1,
      };
      const inserted = await deps.catalogoRepository.insert(created);
      return { ok: true, data: inserted };
    }

    const existingById = await deps.catalogoRepository.getById(accountId, productIdInput);
    if (!existingById) {
      return { ok: false, errorCode: 'NOT_FOUND', message: 'Produto não encontrado para atualização.' };
    }

    const updated: CatalogProduct = {
      ...existingById,
      sku,
      nome,
      categoria,
      descricao,
      precoCentavos: input.precoCentavos,
      estoqueDisponivel,
      ativo: input.ativo ?? existingById.ativo,
      updatedAt: deps.clock.nowIso(),
      version: existingById.version + 1,
    };
    const saved = await deps.catalogoRepository.update(updated);
    return { ok: true, data: saved };
  } catch (error) {
    return {
      ok: false,
      errorCode: 'REPOSITORY_ERROR',
      message: error instanceof Error ? error.message : 'Falha ao salvar produto.',
    };
  }
}
