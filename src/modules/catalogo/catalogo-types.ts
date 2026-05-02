import type { CatalogProduct } from '../../storage/catalogo-db';

export type CatalogoErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_COMMAND'
  | 'INVALID_STOCK'
  | 'DUPLICATE_SKU'
  | 'NOT_FOUND'
  | 'REPOSITORY_ERROR'
  | 'UPSTREAM_ERROR';

export type CatalogoResult<T> =
  | { ok: true; data: T }
  | { ok: false; errorCode: CatalogoErrorCode; message: string };

export interface CatalogoRepository {
  listByAccount(accountId: string): Promise<CatalogProduct[]>;
  getById(accountId: string, productId: string): Promise<CatalogProduct | null>;
  getBySku(accountId: string, sku: string): Promise<CatalogProduct | null>;
  insert(record: CatalogProduct): Promise<CatalogProduct>;
  update(record: CatalogProduct): Promise<CatalogProduct>;
}

export interface CatalogClock {
  nowIso(): string;
}

export interface CatalogIdFactory {
  newId(): string;
}

export function normalizeText(value: string): string {
  return String(value || '').trim();
}

export function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}
