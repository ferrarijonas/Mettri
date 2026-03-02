import { z } from 'zod';

/**
 * PurchaseDB (registro manual de compra)
 *
 * Metáfora: caderno de "fulano comprou na data X", independente do MessageDB.
 * Spec: specs/atendimento/spec.md
 */

const DB_NAME_BASE = 'mettri-purchases-db';
const DB_VERSION = 1;
const STORE_PURCHASES = 'purchases';

export type PurchaseStatus = 'ACTIVE' | 'REMOVED';

export const ManualPurchaseRecordSchema = z.object({
  purchaseId: z.string().min(1),
  chatId: z.string().min(1),
  purchaseDateIso: z.string().min(1),
  value: z.number().nullable(),
  items: z.array(z.string()).nullable(),
  notes: z.string().nullable(),
  source: z.enum(['MANUAL', 'AI_DETECTED']),
  status: z.enum(['ACTIVE', 'REMOVED']),
  createdAtIso: z.string().datetime(),
});

export type ManualPurchaseRecord = z.infer<typeof ManualPurchaseRecordSchema>;

function sanitizeWidForDB(wid: string): string {
  return wid.replace(/[@.]/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
}

function nowIso(): string {
  return new Date().toISOString();
}

function newPurchaseId(): string {
  return `pur_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export type PurchaseSource = 'MANUAL' | 'AI_DETECTED';

export type AddPurchasePayload = {
  chatId: string;
  purchaseDate: Date;
  value?: number;
  items?: string[];
  notes?: string;
  source?: PurchaseSource;
};

export class PurchaseDB {
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
    console.log(`[PurchaseDB] Banco aberto para usuário: ${wid} (${this.getDBName()})`);
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
          if (!db.objectStoreNames.contains(STORE_PURCHASES)) {
            store = db.createObjectStore(STORE_PURCHASES, { keyPath: 'purchaseId' });
          } else {
            store = (request.transaction as IDBTransaction).objectStore(STORE_PURCHASES);
          }

          if (!store.indexNames.contains('chatId')) {
            store.createIndex('chatId', 'chatId', { unique: false });
          }
          if (!store.indexNames.contains('status')) {
            store.createIndex('status', 'status', { unique: false });
          }
          if (!store.indexNames.contains('chatId_status')) {
            store.createIndex('chatId_status', ['chatId', 'status'], { unique: false });
          }
          if (!store.indexNames.contains('purchaseDateIso')) {
            store.createIndex('purchaseDateIso', 'purchaseDateIso', { unique: false });
          }
        };
      });

    return await this.initPromise;
  }

  private async ensureReady(): Promise<IDBDatabase> {
    if (this.initPromise) await this.initPromise;
    if (!this.db) throw new Error('PurchaseDB: Database not initialized');
    return this.db;
  }

  private validate(record: ManualPurchaseRecord): ManualPurchaseRecord {
    return ManualPurchaseRecordSchema.parse(record);
  }

  async addPurchase(payload: AddPurchasePayload): Promise<ManualPurchaseRecord> {
    const chatId = String(payload.chatId ?? '').trim();
    if (!chatId) throw new Error('PurchaseDB: chatId é obrigatório');
    const purchaseDate = payload.purchaseDate;
    if (!(purchaseDate instanceof Date) || Number.isNaN(purchaseDate.getTime())) {
      throw new Error('PurchaseDB: purchaseDate deve ser uma data válida');
    }
    const value = payload.value;
    if (value !== undefined && value !== null && (typeof value !== 'number' || value < 0)) {
      throw new Error('PurchaseDB: value deve ser >= 0');
    }

    const purchaseDateIso = purchaseDate.toISOString();
    const createdAtIso = nowIso();
    const record: ManualPurchaseRecord = {
      purchaseId: newPurchaseId(),
      chatId,
      purchaseDateIso,
      value: value !== undefined && value !== null ? value : null,
      items: Array.isArray(payload.items) ? payload.items : null,
      notes: typeof payload.notes === 'string' ? payload.notes : null,
      source: (payload.source === 'AI_DETECTED' ? 'AI_DETECTED' : 'MANUAL') as 'MANUAL' | 'AI_DETECTED',
      status: 'ACTIVE',
      createdAtIso,
    };
    const validated = this.validate(record);
    const db = await this.ensureReady();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_PURCHASES], 'readwrite');
      const store = tx.objectStore(STORE_PURCHASES);
      const req = store.put(validated);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
    return validated;
  }

  async removePurchase(purchaseId: string): Promise<void> {
    const id = String(purchaseId ?? '').trim();
    if (!id) throw new Error('PurchaseDB: purchaseId é obrigatório');

    const db = await this.ensureReady();

    const existing = await new Promise<ManualPurchaseRecord | null>((resolve, reject) => {
      const tx = db.transaction([STORE_PURCHASES], 'readonly');
      const store = tx.objectStore(STORE_PURCHASES);
      const req = store.get(id);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const raw = req.result as unknown;
        if (!raw) return resolve(null);
        try {
          resolve(ManualPurchaseRecordSchema.parse(raw));
        } catch {
          resolve(null);
        }
      };
    });

    if (!existing) throw new Error('PurchaseDB: registro não encontrado');

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_PURCHASES], 'readwrite');
      const store = tx.objectStore(STORE_PURCHASES);
      const req = store.put({ ...existing, status: 'REMOVED' as const });
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }

  async getLastActiveByChatId(chatId: string): Promise<ManualPurchaseRecord | null> {
    const cid = String(chatId ?? '').trim();
    if (!cid) return null;

    const db = await this.ensureReady();

    const results = await new Promise<ManualPurchaseRecord[]>((resolve, reject) => {
      const list: ManualPurchaseRecord[] = [];
      const tx = db.transaction([STORE_PURCHASES], 'readonly');
      const store = tx.objectStore(STORE_PURCHASES);
      const index = store.index('chatId_status');
      const req = index.openCursor(IDBKeyRange.only([cid, 'ACTIVE']));

      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result as IDBCursorWithValue | null;
        if (!cursor) return resolve(list);
        try {
          list.push(ManualPurchaseRecordSchema.parse(cursor.value));
        } catch {
          // ignore corrompidos
        }
        cursor.continue();
      };
    });

    if (results.length === 0) return null;
    results.sort((a, b) => b.purchaseDateIso.localeCompare(a.purchaseDateIso));
    return results[0];
  }

  /**
   * Retorna a última compra ACTIVE por contato.
   * Metáfora: percorre o caderno e guarda a folha mais recente de cada cliente.
   */
  async getLastActiveByContact(): Promise<
    Map<
      string,
      {
        chatId: string;
        purchaseDate: Date;
      }
    >
  > {
    const db = await this.ensureReady();
    const grouped = await new Promise<Map<string, ManualPurchaseRecord>>((resolve, reject) => {
      const map = new Map<string, ManualPurchaseRecord>();
      const tx = db.transaction([STORE_PURCHASES], 'readonly');
      const store = tx.objectStore(STORE_PURCHASES);
      const index = store.index('status');
      const req = index.openCursor(IDBKeyRange.only('ACTIVE'));

      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result as IDBCursorWithValue | null;
        if (!cursor) return resolve(map);

        try {
          const record = ManualPurchaseRecordSchema.parse(cursor.value);
          const existing = map.get(record.chatId);
          if (!existing || record.purchaseDateIso > existing.purchaseDateIso) {
            map.set(record.chatId, record);
          }
        } catch {
          // ignora registros corrompidos
        }

        cursor.continue();
      };
    });

    const result = new Map<
      string,
      {
        chatId: string;
        purchaseDate: Date;
      }
    >();

    for (const [chatId, record] of grouped.entries()) {
      const purchaseDate = new Date(record.purchaseDateIso);
      if (Number.isNaN(purchaseDate.getTime())) continue;
      result.set(chatId, {
        chatId,
        purchaseDate,
      });
    }

    return result;
  }
}

export const purchaseDB = new PurchaseDB();
