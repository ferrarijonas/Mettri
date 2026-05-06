import { z } from 'zod';

const DB_NAME_BASE = 'mettri-catalogo-db';
const DB_VERSION = 1;
const STORE_CATALOGO = 'catalogo_products';

function sanitizeWidForDB(wid: string): string {
  return wid.replace(/[@.]/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
}

export const CatalogProductSchema = z.object({
  productId: z.string().min(1),
  accountId: z.string().min(1),
  sku: z.string().min(1),
  nome: z.string().min(1),
  categoria: z.preprocess((value) => (value === undefined ? null : value), z.string().nullable()),
  descricao: z.string().nullable(),
  precoCentavos: z.number().int().nonnegative(),
  estoqueDisponivel: z.number().int().nonnegative().nullable(),
  ativo: z.boolean(),
  updatedAt: z.string().datetime(),
  version: z.number().int().positive(),
});

export type CatalogProduct = z.infer<typeof CatalogProductSchema>;

export class CatalogoDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private currentUserWid: string | null = null;

  constructor() {
    this.initPromise = this.init();
  }

  private getDBName(): string {
    if (this.currentUserWid) return `${DB_NAME_BASE}-${sanitizeWidForDB(this.currentUserWid)}`;
    return DB_NAME_BASE;
  }

  async setUserWid(wid: string): Promise<void> {
    if (this.currentUserWid === wid) return;

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    this.currentUserWid = wid;
    this.initPromise = null;
    await this.init();
    console.log(`[CatalogoDB] Banco aberto para usuário: ${wid} (${this.getDBName()})`);
  }

  getCurrentUserWid(): string | null {
    return this.currentUserWid;
  }

  private async init(): Promise<void> {
    if (this.db && this.db.name === this.getDBName()) return;

    this.initPromise =
      this.initPromise ??
      new Promise((resolve, reject) => {
        const request = indexedDB.open(this.getDBName(), DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          this.db = request.result;
          resolve();
        };
        request.onupgradeneeded = event => {
          const db = (event.target as IDBOpenDBRequest).result;

          let store: IDBObjectStore;
          if (!db.objectStoreNames.contains(STORE_CATALOGO)) {
            store = db.createObjectStore(STORE_CATALOGO, { keyPath: 'productId' });
          } else {
            store = (request.transaction as IDBTransaction).objectStore(STORE_CATALOGO);
          }

          if (!store.indexNames.contains('accountId')) {
            store.createIndex('accountId', 'accountId', { unique: false });
          }
          if (!store.indexNames.contains('accountId_sku')) {
            store.createIndex('accountId_sku', ['accountId', 'sku'], { unique: false });
          }
        };
      });

    return await this.initPromise;
  }

  private async ensureReady(): Promise<IDBDatabase> {
    if (this.initPromise) await this.initPromise;
    if (!this.db) throw new Error('CatalogoDB: Database not initialized');
    return this.db;
  }

  private validate(record: CatalogProduct): CatalogProduct {
    return CatalogProductSchema.parse(record);
  }

  async listByAccount(accountId: string): Promise<CatalogProduct[]> {
    const aid = String(accountId || '').trim();
    if (!aid) return [];
    const db = await this.ensureReady();

    return await new Promise((resolve, reject) => {
      const list: CatalogProduct[] = [];
      const tx = db.transaction([STORE_CATALOGO], 'readonly');
      const store = tx.objectStore(STORE_CATALOGO);
      const index = store.index('accountId');
      const req = index.openCursor(IDBKeyRange.only(aid));

      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result as IDBCursorWithValue | null;
        if (!cursor) return resolve(list);
        try {
          list.push(CatalogProductSchema.parse(cursor.value));
        } catch {
          // ignora registros corrompidos
        }
        cursor.continue();
      };
    });
  }

  async getById(accountId: string, productId: string): Promise<CatalogProduct | null> {
    const aid = String(accountId || '').trim();
    const pid = String(productId || '').trim();
    if (!aid || !pid) return null;
    const db = await this.ensureReady();

    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_CATALOGO], 'readonly');
      const store = tx.objectStore(STORE_CATALOGO);
      const req = store.get(pid);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const raw = req.result as unknown;
        if (!raw) return resolve(null);
        try {
          const parsed = CatalogProductSchema.parse(raw);
          if (parsed.accountId !== aid) return resolve(null);
          return resolve(parsed);
        } catch {
          return resolve(null);
        }
      };
    });
  }

  async getBySku(accountId: string, sku: string): Promise<CatalogProduct | null> {
    const aid = String(accountId || '').trim();
    const skuNormalized = String(sku || '').trim();
    if (!aid || !skuNormalized) return null;
    const db = await this.ensureReady();

    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_CATALOGO], 'readonly');
      const store = tx.objectStore(STORE_CATALOGO);
      const index = store.index('accountId_sku');
      const req = index.get(IDBKeyRange.only([aid, skuNormalized]));
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const raw = req.result as unknown;
        if (!raw) return resolve(null);
        try {
          resolve(CatalogProductSchema.parse(raw));
        } catch {
          resolve(null);
        }
      };
    });
  }

  async insert(record: CatalogProduct): Promise<CatalogProduct> {
    const validated = this.validate(record);
    const db = await this.ensureReady();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_CATALOGO], 'readwrite');
      const store = tx.objectStore(STORE_CATALOGO);
      const req = store.add(validated);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });

    return validated;
  }

  async update(record: CatalogProduct): Promise<CatalogProduct> {
    const validated = this.validate(record);
    const db = await this.ensureReady();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_CATALOGO], 'readwrite');
      const store = tx.objectStore(STORE_CATALOGO);
      const req = store.put(validated);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });

    return validated;
  }

  async deleteById(accountId: string, productId: string): Promise<boolean> {
    const aid = String(accountId || '').trim();
    const pid = String(productId || '').trim();
    if (!aid || !pid) return false;
    const db = await this.ensureReady();

    const existing = await this.getById(aid, pid);
    if (!existing) return false;

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_CATALOGO], 'readwrite');
      const store = tx.objectStore(STORE_CATALOGO);
      const req = store.delete(pid);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });

    return true;
  }
}

export const catalogoDB = new CatalogoDB();
