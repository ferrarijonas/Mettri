import { z } from 'zod';

/**
 * OrderDB (MVP)
 *
 * Metáfora: é o “caderno de pedidos” do cliente.
 * Separado do ClientDB (RG) e do MessageDB (histórico).
 */

const DB_NAME_BASE = 'mettri-orders-db';
const DB_VERSION = 1;

const STORE_ORDERS = 'orders';

export type OrderStatus = 'open' | 'awaiting_payment' | 'closed';

export const OrderRecordSchema = z.object({
  orderId: z.string().min(1),
  clientKey: z.string().min(1),
  chatId: z.string().min(1),
  status: z.enum(['open', 'awaiting_payment', 'closed']),
  itemsSummary: z.string().optional(),
  totalCents: z.number().int().nonnegative().optional(),
  createdAtIso: z.string().datetime(),
  updatedAtIso: z.string().datetime(),
});

export type OrderRecord = z.infer<typeof OrderRecordSchema>;

function sanitizeWidForDB(wid: string): string {
  return wid.replace(/[@.]/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
}

function nowIso(): string {
  return new Date().toISOString();
}

function newOrderId(): string {
  return `ord_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export class OrderDB {
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
    console.log(`[OrderDB] Banco aberto para usuário: ${wid} (${this.getDBName()})`);
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
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          let store: IDBObjectStore;
          if (!db.objectStoreNames.contains(STORE_ORDERS)) {
            store = db.createObjectStore(STORE_ORDERS, { keyPath: 'orderId' });
          } else {
            store = (request.transaction as IDBTransaction).objectStore(STORE_ORDERS);
          }

          // Índices para consultas rápidas
          if (!store.indexNames.contains('clientKey')) {
            store.createIndex('clientKey', 'clientKey', { unique: false });
          }
          if (!store.indexNames.contains('status')) {
            store.createIndex('status', 'status', { unique: false });
          }
          if (!store.indexNames.contains('clientKey_status')) {
            store.createIndex('clientKey_status', ['clientKey', 'status'], { unique: false });
          }
          if (!store.indexNames.contains('updatedAtIso')) {
            store.createIndex('updatedAtIso', 'updatedAtIso', { unique: false });
          }
        };
      });

    return await this.initPromise;
  }

  private async ensureReady(): Promise<IDBDatabase> {
    if (this.initPromise) await this.initPromise;
    if (!this.db) throw new Error('OrderDB: Database not initialized');
    return this.db;
  }

  private validate(record: OrderRecord): OrderRecord {
    return OrderRecordSchema.parse(record);
  }

  async upsert(record: OrderRecord): Promise<void> {
    const validated = this.validate(record);
    const db = await this.ensureReady();

    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_ORDERS], 'readwrite');
      const store = tx.objectStore(STORE_ORDERS);
      const req = store.put(validated);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }

  async listOpenByClientKey(clientKey: string, limit: number = 5): Promise<OrderRecord[]> {
    return await this.listByClientKeyAndStatus(clientKey, 'open', limit);
  }

  async listByClientKeyAndStatus(clientKey: string, status: OrderStatus, limit: number = 10): Promise<OrderRecord[]> {
    const key = String(clientKey || '').trim();
    if (!key) return [];

    const db = await this.ensureReady();

    return await new Promise((resolve, reject) => {
      const results: OrderRecord[] = [];
      const tx = db.transaction([STORE_ORDERS], 'readonly');
      const store = tx.objectStore(STORE_ORDERS);
      const index = store.index('clientKey_status');
      const req = index.openCursor(IDBKeyRange.only([key, status]), 'prev');

      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result as IDBCursorWithValue | null;
        if (!cursor) return resolve(results);
        try {
          results.push(OrderRecordSchema.parse(cursor.value));
        } catch {
          // ignore corrompidos
        }
        if (results.length >= limit) return resolve(results);
        cursor.continue();
      };
    });
  }

  async listActiveByClientKey(clientKey: string, limit: number = 5): Promise<OrderRecord[]> {
    const open = await this.listByClientKeyAndStatus(clientKey, 'open', limit);
    const awaiting = await this.listByClientKeyAndStatus(clientKey, 'awaiting_payment', limit);
    // Merge simples por updatedAtIso (mais recente primeiro)
    const merged = [...open, ...awaiting].sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso));
    return merged.slice(0, limit);
  }

  async createOrderDraft(params: { clientKey: string; chatId: string }): Promise<OrderRecord> {
    const createdAtIso = nowIso();
    const record: OrderRecord = {
      orderId: newOrderId(),
      clientKey: String(params.clientKey || '').trim(),
      chatId: String(params.chatId || '').trim(),
      status: 'open',
      itemsSummary: '',
      createdAtIso,
      updatedAtIso: createdAtIso,
    };
    await this.upsert(record);
    return record;
  }

  async advanceStatus(orderId: string, next: OrderStatus): Promise<void> {
    const id = String(orderId || '').trim();
    if (!id) return;

    const db = await this.ensureReady();

    const existing = await new Promise<OrderRecord | null>((resolve, reject) => {
      const tx = db.transaction([STORE_ORDERS], 'readonly');
      const store = tx.objectStore(STORE_ORDERS);
      const req = store.get(id);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const raw = req.result as unknown;
        if (!raw) return resolve(null);
        try {
          resolve(OrderRecordSchema.parse(raw));
        } catch (e) {
          reject(e);
        }
      };
    });

    if (!existing) return;

    await this.upsert({
      ...existing,
      status: next,
      updatedAtIso: nowIso(),
    });
  }
}

export const orderDB = new OrderDB();

