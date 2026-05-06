import { alterarDisponibilidadeProdutoCatalogo, type SetActiveInput } from './alterar-disponibilidade-produto-catalogo';
import { listarProdutosCatalogo, type CatalogoListFilter } from './listar-produtos-catalogo';
import { salvarProdutoCatalogo, type ProductInput } from './salvar-produto-catalogo';
import type { CatalogoResult } from './catalogo-types';

export interface CatalogoCommandInput {
  accountId: string;
  command: 'LIST' | 'SAVE' | 'SET_ACTIVE';
  payload?: unknown;
}

export type CatalogoCommandOutput =
  | { ok: true; data: unknown }
  | { ok: false; errorCode: string; message: string };

export interface CatalogoOrchestratorDeps {
  listarProdutosCatalogo: (
    accountId: string,
    filtro?: CatalogoListFilter | null
  ) => Promise<CatalogoResult<unknown>>;
  salvarProdutoCatalogo: (input: ProductInput) => Promise<CatalogoResult<unknown>>;
  alterarDisponibilidadeProdutoCatalogo: (input: SetActiveInput) => Promise<CatalogoResult<unknown>>;
}

const defaultDeps: CatalogoOrchestratorDeps = {
  listarProdutosCatalogo: (accountId, filtro) => listarProdutosCatalogo(accountId, filtro ?? null),
  salvarProdutoCatalogo,
  alterarDisponibilidadeProdutoCatalogo,
};

function parseListPayload(payload: unknown): CatalogoListFilter | null {
  if (payload == null || typeof payload !== 'object') return null;
  const maybe = payload as { search?: unknown; ativo?: unknown };
  const filtro: CatalogoListFilter = {};
  if (typeof maybe.search === 'string') filtro.search = maybe.search;
  if (typeof maybe.ativo === 'boolean') filtro.ativo = maybe.ativo;
  return filtro;
}

function parseSavePayload(accountId: string, payload: unknown): ProductInput | null {
  if (payload == null || typeof payload !== 'object') return null;
  const maybe = payload as {
    productId?: unknown;
    sku?: unknown;
    nome?: unknown;
    descricao?: unknown;
    precoCentavos?: unknown;
    estoqueDisponivel?: unknown;
    ativo?: unknown;
  };
  if (typeof maybe.sku !== 'string' || typeof maybe.nome !== 'string' || typeof maybe.precoCentavos !== 'number') {
    return null;
  }
  if (maybe.productId !== undefined && typeof maybe.productId !== 'string') return null;
  if (maybe.descricao !== undefined && maybe.descricao !== null && typeof maybe.descricao !== 'string') return null;
  if (maybe.estoqueDisponivel !== undefined && maybe.estoqueDisponivel !== null && typeof maybe.estoqueDisponivel !== 'number') {
    return null;
  }
  if (maybe.ativo !== undefined && typeof maybe.ativo !== 'boolean') return null;

  return {
    accountId,
    productId: maybe.productId,
    sku: maybe.sku,
    nome: maybe.nome,
    descricao: maybe.descricao as string | null | undefined,
    precoCentavos: maybe.precoCentavos,
    estoqueDisponivel: maybe.estoqueDisponivel as number | null | undefined,
    ativo: maybe.ativo,
  };
}

function parseSetActivePayload(accountId: string, payload: unknown): SetActiveInput | null {
  if (payload == null || typeof payload !== 'object') return null;
  const maybe = payload as { productId?: unknown; ativo?: unknown };
  if (typeof maybe.productId !== 'string' || typeof maybe.ativo !== 'boolean') return null;
  return {
    accountId,
    productId: maybe.productId,
    ativo: maybe.ativo,
  };
}

export async function catalogoPanelOrchestrator(
  input: CatalogoCommandInput,
  deps: CatalogoOrchestratorDeps = defaultDeps
): Promise<CatalogoCommandOutput> {
  const accountId = String(input.accountId || '').trim();
  if (!accountId) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'accountId é obrigatório.' };
  }

  if (!input.command) {
    return { ok: false, errorCode: 'INVALID_COMMAND', message: 'command é obrigatório.' };
  }

  try {
    if (input.command === 'LIST') {
      const result = await deps.listarProdutosCatalogo(accountId, parseListPayload(input.payload));
      if (!result.ok) return { ok: false, errorCode: result.errorCode, message: result.message };
      return { ok: true, data: result.data };
    }

    if (input.command === 'SAVE') {
      const payload = parseSavePayload(accountId, input.payload);
      if (!payload) {
        return { ok: false, errorCode: 'INVALID_INPUT', message: 'Payload inválido para comando SAVE.' };
      }
      const result = await deps.salvarProdutoCatalogo(payload);
      if (!result.ok) return { ok: false, errorCode: result.errorCode, message: result.message };
      return { ok: true, data: result.data };
    }

    if (input.command === 'SET_ACTIVE') {
      const payload = parseSetActivePayload(accountId, input.payload);
      if (!payload) {
        return { ok: false, errorCode: 'INVALID_INPUT', message: 'Payload inválido para comando SET_ACTIVE.' };
      }
      const result = await deps.alterarDisponibilidadeProdutoCatalogo(payload);
      if (!result.ok) return { ok: false, errorCode: result.errorCode, message: result.message };
      return { ok: true, data: result.data };
    }

    return { ok: false, errorCode: 'INVALID_COMMAND', message: 'Comando não suportado.' };
  } catch (error) {
    return {
      ok: false,
      errorCode: 'UPSTREAM_ERROR',
      message: error instanceof Error ? error.message : 'Falha na operação de catálogo.',
    };
  }
}
