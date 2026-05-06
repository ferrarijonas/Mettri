import {
  alterarDisponibilidadeProdutoCatalogo,
  carregarSeedInicialCatalogo,
  listarProdutosCatalogo,
  salvarProdutoCatalogo,
} from '../index';
import { catalogoDB } from '../../../storage/catalogo-db';
import type { CatalogoDashboardViewModel } from './view-model';

let hasCheckedFirstAccess = false;

export async function ensureCatalogoSeedOnFirstAccess(): Promise<void> {
  if (hasCheckedFirstAccess) return;
  hasCheckedFirstAccess = true;
  const accountId = getCurrentAccountId();
  await carregarSeedInicialCatalogo(accountId);
}

export async function getCatalogoDashboardViewModel(): Promise<CatalogoDashboardViewModel> {
  const result = await listarProdutosCatalogo(getCurrentAccountId());
  const produtos = result.ok ? result.data.products : [];
  return {
    title: 'Catalogo',
    produtos: produtos.map((produto) => ({
      id: produto.productId,
      sku: produto.sku,
      nome: produto.nome,
      categoria: produto.categoria ?? '',
      precoCentavos: produto.precoCentavos,
      estoqueDisponivel: produto.estoqueDisponivel,
      ativo: produto.ativo,
    })),
  };
}

export async function criarProdutoCatalogo(input: { nome: string; precoReais: number }): Promise<void> {
  const accountId = getCurrentAccountId();
  const listResult = await listarProdutosCatalogo(accountId);
  const produtos = listResult.ok ? listResult.data.products : [];
  const nextSku = `SKU-${String(produtos.length + 1).padStart(3, '0')}`;
  const saveResult = await salvarProdutoCatalogo({
    accountId,
    sku: nextSku,
    nome: input.nome,
    categoria: 'Pães',
    precoCentavos: Math.round(input.precoReais * 100),
    estoqueDisponivel: 0,
    ativo: true,
  });
  if (!saveResult.ok) {
    throw new Error(saveResult.message);
  }
}

export async function editarProdutoCatalogo(input: {
  id: string;
  nome: string;
  precoReais: number;
}): Promise<void> {
  const accountId = getCurrentAccountId();
  const listResult = await listarProdutosCatalogo(accountId);
  if (!listResult.ok) throw new Error(listResult.message);
  const current = listResult.data.products.find((item) => item.productId === input.id);
  if (!current) throw new Error('Produto não encontrado.');
  const saveResult = await salvarProdutoCatalogo({
    accountId,
    productId: input.id,
    sku: current.sku,
    nome: input.nome,
    precoCentavos: Math.round(input.precoReais * 100),
    estoqueDisponivel: current.estoqueDisponivel,
    ativo: current.ativo,
  });
  if (!saveResult.ok) {
    throw new Error(saveResult.message);
  }
}

export async function atualizarProdutoCatalogoInline(input: {
  id: string;
  nome?: string;
  precoCentavos?: number;
  estoqueDisponivel?: number | null;
  categoria?: string;
  ativo?: boolean;
}): Promise<void> {
  const accountId = getCurrentAccountId();
  const listResult = await listarProdutosCatalogo(accountId);
  if (!listResult.ok) throw new Error(listResult.message);
  const current = listResult.data.products.find((item) => item.productId === input.id);
  if (!current) throw new Error('Produto não encontrado.');

  const saveResult = await salvarProdutoCatalogo({
    accountId,
    productId: current.productId,
    sku: current.sku,
    nome: (input.nome ?? current.nome).trim(),
    categoria: (input.categoria ?? current.categoria ?? '').trim() || null,
    precoCentavos: input.precoCentavos ?? current.precoCentavos,
    estoqueDisponivel:
      input.estoqueDisponivel === undefined ? current.estoqueDisponivel : input.estoqueDisponivel,
    ativo: input.ativo ?? current.ativo,
    descricao: current.descricao,
  });
  if (!saveResult.ok) {
    throw new Error(saveResult.message);
  }
}

function buildNextCopySku(baseSku: string, existingSkus: Set<string>): string {
  const cleanBase = String(baseSku || '').trim() || 'SKU';
  let candidate = `${cleanBase}-COPIA`;
  let index = 2;
  while (existingSkus.has(candidate)) {
    candidate = `${cleanBase}-COPIA-${index}`;
    index += 1;
  }
  return candidate;
}

export async function duplicarProdutoCatalogo(id: string): Promise<void> {
  const accountId = getCurrentAccountId();
  const listResult = await listarProdutosCatalogo(accountId);
  if (!listResult.ok) throw new Error(listResult.message);
  const current = listResult.data.products.find((item) => item.productId === id);
  if (!current) throw new Error('Produto não encontrado.');

  const skuSet = new Set(listResult.data.products.map((item) => item.sku));
  const newSku = buildNextCopySku(current.sku, skuSet);
  const saveResult = await salvarProdutoCatalogo({
    accountId,
    sku: newSku,
    nome: `${current.nome} (Copia)`,
    categoria: current.categoria ?? null,
    descricao: current.descricao ?? null,
    precoCentavos: current.precoCentavos,
    estoqueDisponivel: current.estoqueDisponivel,
    ativo: current.ativo,
  });
  if (!saveResult.ok) {
    throw new Error(saveResult.message);
  }
}

export async function excluirProdutoCatalogo(id: string): Promise<void> {
  const accountId = getCurrentAccountId();
  const removed = await catalogoDB.deleteById(accountId, id);
  if (!removed) throw new Error('Produto não encontrado para exclusão.');
}

export async function alternarProdutoCatalogoAtivo(id: string): Promise<void> {
  const accountId = getCurrentAccountId();
  const listResult = await listarProdutosCatalogo(accountId);
  if (!listResult.ok) throw new Error(listResult.message);
  const current = listResult.data.products.find((item) => item.productId === id);
  if (!current) throw new Error('Produto não encontrado.');
  const toggleResult = await alterarDisponibilidadeProdutoCatalogo({
    accountId,
    productId: id,
    ativo: !current.ativo,
  });
  if (!toggleResult.ok) {
    throw new Error(toggleResult.message);
  }
}

function getCurrentAccountId(): string {
  return catalogoDB.getCurrentUserWid() || 'default';
}
