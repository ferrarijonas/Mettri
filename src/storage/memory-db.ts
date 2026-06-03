import { z } from 'zod';

const DB_NAME = 'mettri-memory-db';
const DB_VERSION = 1;
const STORE_MEMORIES = 'memories';

// ── Zod schemas ──

export const MemoriaTipoEnum = z.enum(['cliente', 'licao', 'negocio', 'referencia']);
export type MemoriaTipo = z.infer<typeof MemoriaTipoEnum>;

export const MemoriaRecordSchema = z.object({
  id: z.number().optional(), // auto-increment pelo IndexedDB
  tipo: MemoriaTipoEnum,
  descricao: z.string().min(1),
  chatId: z.string().optional(),
  dados: z.unknown().optional(),
  criada_em: z.string().datetime(),
  atualizada_em: z.string().datetime(),
});

export type MemoriaRecord = z.infer<typeof MemoriaRecordSchema>;

export const MemoriaInputSchema = z.object({
  tipo: MemoriaTipoEnum,
  descricao: z.string().min(1),
  chatId: z.string().optional(),
  dados: z.unknown().optional(),
});

export type MemoriaInput = z.infer<typeof MemoriaInputSchema>;

export interface MemoriaComFreshness extends MemoriaRecord {
  freshnessWarning?: string;
}

export interface ContagemPorTipo {
  cliente: number;
  licao: number;
  negocio: number;
  referencia: number;
}

// ── MemoryDB ──

export class MemoryDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.init();
  }

  private async init(): Promise<void> {
    if (this.db) return;

    this.initPromise =
      this.initPromise ??
      new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (): void => reject(request.error);
        request.onsuccess = (): void => {
          this.db = request.result;
          resolve();
        };
        request.onupgradeneeded = (event): void => {
          const db = (event.target as IDBOpenDBRequest).result;

          if (!db.objectStoreNames.contains(STORE_MEMORIES)) {
            const store = db.createObjectStore(STORE_MEMORIES, {
              keyPath: 'id',
              autoIncrement: true,
            });
            store.createIndex('tipo', 'tipo', { unique: false });
            store.createIndex('chatId', 'chatId', { unique: false });
            store.createIndex('criada_em', 'criada_em', { unique: false });
            // Índice composto para upsert via merge(tipo + chatId + descricao)
            store.createIndex('tipo_chatId_descricao', ['tipo', 'chatId', 'descricao'], {
              unique: false,
            });
          }
        };
      });

    return await this.initPromise;
  }

  private async ensureReady(): Promise<IDBDatabase> {
    if (this.initPromise) await this.initPromise;
    if (!this.db) throw new Error('MemoryDB: Database not initialized');
    return this.db;
  }

  private daysSince(isoDate: string): number {
    const then = new Date(isoDate).getTime();
    const now = Date.now();
    return Math.floor((now - then) / (1000 * 60 * 60 * 24));
  }

  /**
   * Busca memórias por keyword match na `descricao`.
   * @param chatId  filtrar por chatId (null = busca global)
   * @param query   termo de busca (case-insensitive substring)
   * @param max     máximo de resultados (default 5)
   */
  async getRelevantes(
    chatId: string | null,
    query: string,
    max = 5,
  ): Promise<MemoriaComFreshness[]> {
    const q = String(query || '').toLowerCase().trim();
    if (!q) return [];

    const db = await this.ensureReady();
    const resultados: MemoriaRecord[] = [];

    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_MEMORIES], 'readonly');
      const store = tx.objectStore(STORE_MEMORIES);
      const req = store.openCursor(null, 'prev'); // mais recentes primeiro

      req.onerror = (): void => reject(req.error);
      req.onsuccess = (): void => {
        const cursor = req.result as IDBCursorWithValue | null;
        if (!cursor) {
          const top = resultados.slice(0, max);
          const comWarning = top.map(r => {
            const dias = this.daysSince(r.atualizada_em);
            const freshnessWarning = dias > 2
              ? `⚠️ registrada há ${dias} dia${dias > 1 ? 's' : ''}`
              : undefined;
            return { ...r, freshnessWarning };
          });
          return resolve(comWarning);
        }

        const record = cursor.value as MemoriaRecord;
        const descricao = (record.descricao || '').toLowerCase();

        // Filtro por chatId (se especificado)
        if (chatId !== null) {
          const recordChatId = record.chatId || '';
          if (recordChatId !== chatId) {
            cursor.continue();
            return;
          }
        }

        if (descricao.includes(q)) {
          resultados.push(record);
        }
        cursor.continue();
      };
    });
  }

  /**
   * Busca todas as memórias de um tipo, opcionalmente filtradas por chatId.
   */
  async getPorTipo(tipo: MemoriaTipo, chatId?: string): Promise<MemoriaRecord[]> {
    const db = await this.ensureReady();
    const resultados: MemoriaRecord[] = [];

    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_MEMORIES], 'readonly');
      const store = tx.objectStore(STORE_MEMORIES);
      const index = store.index('tipo');
      const req = index.openCursor(IDBKeyRange.only(tipo));

      req.onerror = (): void => reject(req.error);
      req.onsuccess = (): void => {
        const cursor = req.result as IDBCursorWithValue | null;
        if (!cursor) return resolve(resultados);

        const record = cursor.value as MemoriaRecord;
        if (chatId === undefined || record.chatId === chatId) {
          resultados.push(record);
        }
        cursor.continue();
      };
    });
  }

  /**
   * Upsert por chave composta (tipo + chatId + descricao).
   * Se existir, atualiza `dados` (merge superficial) e `atualizada_em`.
   * Se não existir, insere novo registro.
   */
  async merge(input: MemoriaInput): Promise<MemoriaRecord> {
    const validated = MemoriaInputSchema.parse(input);
    const db = await this.ensureReady();

    // Normaliza chatId: undefined → '' para consistência no índice composto
    const chatId = validated.chatId ?? '';

    // Busca existente pelo índice composto
    const existing = await this.findByCompoundKey(db, validated.tipo, chatId, validated.descricao);

    const agora = new Date().toISOString();

    if (existing) {
      // Merge: dados existentes + novos dados (merge superficial)
      const dadosMerged = existing.dados && validated.dados
        ? { ...(existing.dados as Record<string, unknown>), ...(validated.dados as Record<string, unknown>) }
        : (validated.dados ?? existing.dados);

      const record: MemoriaRecord = {
        ...existing,
        dados: dadosMerged,
        atualizada_em: agora,
      };

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_MEMORIES], 'readwrite');
        const store = tx.objectStore(STORE_MEMORIES);
        const req = store.put(record);
        req.onerror = (): void => reject(req.error);
        req.onsuccess = (): void => resolve();
      });

      return record;
    }

    // Novo registro (chatId normalizado)
    const record: MemoriaRecord = {
      tipo: validated.tipo,
      descricao: validated.descricao,
      chatId,
      dados: validated.dados,
      criada_em: agora,
      atualizada_em: agora,
    };

    const id = await new Promise<number>((resolve, reject) => {
      const tx = db.transaction([STORE_MEMORIES], 'readwrite');
      const store = tx.objectStore(STORE_MEMORIES);
      const req = store.add(record);
      req.onerror = (): void => reject(req.error);
      req.onsuccess = (): void => resolve(req.result as number);
    });

    return { ...record, id };
  }

  /**
   * Retorna contagem de memórias por tipo.
   */
  async listarTipos(): Promise<ContagemPorTipo> {
    const db = await this.ensureReady();
    const contagem: ContagemPorTipo = { cliente: 0, licao: 0, negocio: 0, referencia: 0 };

    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_MEMORIES], 'readonly');
      const store = tx.objectStore(STORE_MEMORIES);
      const index = store.index('tipo');
      const req = index.openCursor();

      req.onerror = (): void => reject(req.error);
      req.onsuccess = (): void => {
        const cursor = req.result as IDBCursorWithValue | null;
        if (!cursor) return resolve(contagem);

        const tipo = (cursor.value as MemoriaRecord).tipo;
        if (tipo in contagem) {
          contagem[tipo]++;
        }
        cursor.continue();
      };
    });
  }

  /**
   * Remove todos os registros do banco (útil para testes).
   */
  async clearAll(): Promise<void> {
    const db = await this.ensureReady();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_MEMORIES], 'readwrite');
      const store = tx.objectStore(STORE_MEMORIES);
      const req = store.clear();
      req.onerror = (): void => reject(req.error);
      req.onsuccess = (): void => resolve();
    });
  }

  private async findByCompoundKey(
    db: IDBDatabase,
    tipo: string,
    chatId: string,
    descricao: string,
  ): Promise<MemoriaRecord | null> {
    const key = [tipo, chatId, descricao];
    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_MEMORIES], 'readonly');
      const store = tx.objectStore(STORE_MEMORIES);
      const index = store.index('tipo_chatId_descricao');
      const req = index.get(IDBKeyRange.only(key));

      req.onerror = (): void => reject(req.error);
      req.onsuccess = (): void => {
        const raw = req.result as MemoriaRecord | undefined;
        resolve(raw ?? null);
      };
    });
  }
}

export const memoryDB = new MemoryDB();
