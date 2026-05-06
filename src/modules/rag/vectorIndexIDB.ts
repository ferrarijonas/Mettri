import type { ConversationChunk } from './agrupar_por_turno';
import { EMBEDDING_DIMENSION } from './embedding-config';
import { cosineSimilarity } from './similarity';
import type { VectorIndex, VectorIndexQueryResult } from './vectorIndex';

export const RAG_INDEX_DB_NAME = 'mettri-rag-index';
const DB_VERSION = 1;
const STORE_VECTORS = 'vectors';

interface StoredRecord {
  chunk: ConversationChunk;
  vector: number[];
}

interface IDBRecord {
  id: string;
  chunk: ConversationChunk;
  vector: number[];
}

export class VectorIndexIDB implements VectorIndex {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private records: StoredRecord[] = [];
  private loaded = false;

  constructor(private dbName: string = RAG_INDEX_DB_NAME) {}

  private async open(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_VECTORS)) {
          db.createObjectStore(STORE_VECTORS, { keyPath: 'id' });
        }
      };
    });
  }

  async isEmpty(): Promise<boolean> {
    await this.open();
    if (!this.db) {
      throw new Error('IndexedDB não inicializado.');
    }
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_VECTORS, 'readonly');
      const store = tx.objectStore(STORE_VECTORS);
      const req = store.count();
      req.onsuccess = () => resolve((req.result ?? 0) === 0);
      req.onerror = () => reject(req.error);
    });
  }

  private async loadAllIntoMemory(): Promise<void> {
    if (!this.db || this.loaded) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_VECTORS, 'readonly');
      const store = tx.objectStore(STORE_VECTORS);
      const req = store.getAll();

      req.onsuccess = () => {
        const rows = (req.result ?? []) as IDBRecord[];
        this.records = rows.map((r) => ({ chunk: r.chunk, vector: r.vector }));
        this.loaded = true;
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  private async ensureReady(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = (async () => {
      await this.open();
      await this.loadAllIntoMemory();
    })();

    await this.initPromise;
  }

  async upsertMany(items: { chunk: ConversationChunk; vector: number[] }[]): Promise<void> {
    if (!items.length) return;

    await this.ensureReady();
    if (!this.db) throw new Error('IndexedDB não inicializado.');

    const byId = new Map<string, StoredRecord>();
    for (const record of this.records) {
      byId.set(record.chunk.id, record);
    }
    for (const item of items) {
      byId.set(item.chunk.id, { chunk: item.chunk, vector: item.vector });
    }
    this.records = Array.from(byId.values());

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_VECTORS, 'readwrite');
      const store = tx.objectStore(STORE_VECTORS);

      for (const item of items) {
        const row: IDBRecord = {
          id: item.chunk.id,
          chunk: item.chunk,
          vector: item.vector,
        };
        store.put(row);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async query(queryVector: number[], k: number): Promise<VectorIndexQueryResult[]> {
    if (!Array.isArray(queryVector)) {
      throw new Error('queryVector deve ser um array numérico.');
    }
    if (queryVector.length !== EMBEDDING_DIMENSION) {
      throw new Error(
        `Dimensão inválida para queryVector: esperado ${EMBEDDING_DIMENSION}, recebido ${queryVector.length}.`,
      );
    }
    if (!Number.isInteger(k) || k <= 0) {
      throw new Error('k deve ser um inteiro maior ou igual a 1.');
    }

    await this.ensureReady();

    if (!this.records.length) {
      return [];
    }

    const scored: VectorIndexQueryResult[] = this.records.map((record) => ({
      chunk: record.chunk,
      score: cosineSimilarity(queryVector, record.vector),
    }));

    scored.sort((a, b) => b.score - a.score);

    if (k >= scored.length) {
      return scored;
    }
    return scored.slice(0, k);
  }
}

export const vectorIndexIDB = new VectorIndexIDB();
