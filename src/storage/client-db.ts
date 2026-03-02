import { z } from 'zod';

/**
 * ClientDB (MVP)
 *
 * Metáfora: é o “RG” do cliente (dados que você controla),
 * diferente do “crachá” do WhatsApp (pushname).
 */

const DB_NAME_BASE = 'mettri-clients-db';
const DB_VERSION = 2;
const STORE_CLIENTS = 'clients';

export const ClientRecordSchema = z.object({
  clientKey: z.string().min(1, 'clientKey não pode ser vazio'),
  phoneDigits: z.string().optional(), // MVP: pode existir enquanto rascunho
  aliasesDigits: z.array(z.string()).optional(),
  whatsAppChatId: z.string().optional(),

  // Import (internacional): nome bruto quando vier
  fullName: z.string().optional(),

  firstName: z.string().optional(),
  lastName: z.string().optional(),
  nickname: z.string().optional(),
  // Endereço: texto livre (mínimo internacional)
  addressFreeform: z.string().optional(),
  // Compatibilidade: UI antiga usa address
  address: z.string().optional(),

  // Contatos (futuro-proof)
  phones: z
    .array(
      z.object({
        raw: z.string().min(1),
        digits: z.string().optional(),
        e164: z.string().optional(),
        label: z.string().optional(),
      })
    )
    .optional(),
  emails: z.array(z.string()).optional(),

  // Metadados de import
  sourceMeta: z
    .object({
      filename: z.string().optional(),
      importedAtIso: z.string().datetime().optional(),
      profileId: z.string().optional(),
    })
    .optional(),
  confidence: z.record(z.number().min(0).max(1)).optional(),

  // De onde veio o nome atual (para unificação/precedência)
  // Metáfora: caneta (manual/import) vs lápis (WhatsApp).
  nameSource: z.enum(['manual', 'import', 'whatsapp']).optional(),

  whatsAppCandidateName: z.string().optional(),
  updatedAtIso: z.string().datetime({ message: 'updatedAtIso deve ser ISO 8601' }),
}).passthrough();

export type ClientRecord = z.infer<typeof ClientRecordSchema>;

function sanitizeWidForDB(wid: string): string {
  return wid.replace(/[@.]/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
}

export function digitsOnly(input: string): string {
  return String(input || '').replace(/\D+/g, '');
}

/**
 * Normaliza telefone e gera aliases BR (com/sem “9” após DDD) quando possível.
 *
 * Metáfora: é “mapa de apelidos do mesmo telefone”.
 */
export function normalizePhoneDigitsWithAliases(input: string): {
  phoneDigits: string;
  aliasesDigits: string[];
  clientKey: string;
} {
  const phoneDigits = digitsOnly(input);
  const aliases = new Set<string>();
  if (phoneDigits) aliases.add(phoneDigits);

  // Heurística BR mínima + útil:
  // Suportar o mesmo número com/sem DDI (55) e com/sem “9” após DDD.
  //
  // Metáfora: o mesmo cliente pode vir com “sobrenome” (55) ou sem.
  const addBrVariants = (digits: string): void => {
    const d = digitsOnly(digits);
    if (!d) return;
    aliases.add(d);

    // Caso 1: com DDI 55
    if (d.startsWith('55') && d.length >= 12 && d.length <= 13) {
      const ddi = '55';
      const ddd = d.slice(2, 4);
      const rest = d.slice(4); // 8 ou 9

      // Variante sem DDI
      aliases.add(`${ddd}${rest}`);

      // com/sem 9
      if (rest.length === 9 && rest.startsWith('9')) {
        aliases.add(`${ddi}${ddd}${rest.slice(1)}`);
        aliases.add(`${ddd}${rest.slice(1)}`);
      }
      if (rest.length === 8) {
        aliases.add(`${ddi}${ddd}9${rest}`);
        aliases.add(`${ddd}9${rest}`);
      }
      return;
    }

    // Caso 2: sem DDI, mas parece BR (DDD+8/9)
    if (!d.startsWith('55') && (d.length === 10 || d.length === 11)) {
      const ddd = d.slice(0, 2);
      const rest = d.slice(2); // 8 ou 9

      // Variante com DDI
      aliases.add(`55${d}`);

      if (rest.length === 9 && rest.startsWith('9')) {
        aliases.add(`${ddd}${rest.slice(1)}`);
        aliases.add(`55${ddd}${rest.slice(1)}`);
      }
      if (rest.length === 8) {
        aliases.add(`${ddd}9${rest}`);
        aliases.add(`55${ddd}9${rest}`);
      }
    }
  };

  addBrVariants(phoneDigits);

  const aliasesDigits = Array.from(aliases);

  // MVP: clientKey = phoneDigits canônico (primeiro alias, priorizando o mais longo)
  const clientKey = aliasesDigits.sort((a, b) => b.length - a.length)[0] || phoneDigits || `draft-${Date.now()}`;

  return { phoneDigits, aliasesDigits, clientKey };
}

export class ClientDB {
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
    console.log(`[ClientDB] Banco aberto para usuário: ${wid} (${this.getDBName()})`);
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
          if (!db.objectStoreNames.contains(STORE_CLIENTS)) {
            store = db.createObjectStore(STORE_CLIENTS, { keyPath: 'clientKey' });
          } else {
            store = (request.transaction as IDBTransaction).objectStore(STORE_CLIENTS);
          }

          // Garantir índices (idempotente)
          if (!store.indexNames.contains('phoneDigits')) {
            store.createIndex('phoneDigits', 'phoneDigits', { unique: false });
          }
          if (!store.indexNames.contains('updatedAtIso')) {
            store.createIndex('updatedAtIso', 'updatedAtIso', { unique: false });
          }
          // Lookup reverso por chatId (útil para Atendimento)
          if (!store.indexNames.contains('whatsAppChatId')) {
            store.createIndex('whatsAppChatId', 'whatsAppChatId', { unique: false });
          }
        };
      });

    return await this.initPromise;
  }

  private async ensureReady(): Promise<IDBDatabase> {
    if (this.initPromise) await this.initPromise;
    if (!this.db) throw new Error('ClientDB: Database not initialized');
    return this.db;
  }

  private validate(record: ClientRecord): ClientRecord {
    return ClientRecordSchema.parse(record);
  }

  async upsert(record: ClientRecord): Promise<void> {
    const validated = this.validate(record);
    const db = await this.ensureReady();

    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_CLIENTS], 'readwrite');
      const store = tx.objectStore(STORE_CLIENTS);
      const req = store.put(validated);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }

  async getByKey(clientKey: string): Promise<ClientRecord | null> {
    const db = await this.ensureReady();

    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_CLIENTS], 'readonly');
      const store = tx.objectStore(STORE_CLIENTS);
      const req = store.get(clientKey);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const raw = req.result as unknown;
        if (!raw) return resolve(null);
        try {
          resolve(ClientRecordSchema.parse(raw));
        } catch (e) {
          reject(e);
        }
      };
    });
  }

  async getByPhoneDigits(phoneDigits: string): Promise<ClientRecord | null> {
    const digits = digitsOnly(phoneDigits);
    if (!digits) return null;

    const db = await this.ensureReady();

    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_CLIENTS], 'readonly');
      const store = tx.objectStore(STORE_CLIENTS);
      const index = store.index('phoneDigits');
      const req = index.openCursor(IDBKeyRange.only(digits), 'next');

      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve(null);
        try {
          resolve(ClientRecordSchema.parse(cursor.value));
        } catch (e) {
          reject(e);
        }
      };
    });
  }

  async listAll(limit: number = 5000): Promise<ClientRecord[]> {
    const db = await this.ensureReady();

    return await new Promise((resolve, reject) => {
      const results: ClientRecord[] = [];
      const tx = db.transaction([STORE_CLIENTS], 'readonly');
      const store = tx.objectStore(STORE_CLIENTS);
      const req = store.openCursor();

      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve(results);

        try {
          results.push(ClientRecordSchema.parse(cursor.value));
        } catch {
          // ignorar registro corrompido
        }

        if (results.length >= limit) return resolve(results);
        cursor.continue();
      };
    });
  }

  /**
   * Limpa todos os registros do cadastro (reset total).
   * Útil para corrigir dados incorretos (ex.: nome do negócio em vez do cliente).
   */
  async reset(): Promise<void> {
    const db = await this.ensureReady();

    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_CLIENTS], 'readwrite');
      const store = tx.objectStore(STORE_CLIENTS);
      const req = store.clear();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }

  async getByWhatsAppChatId(chatId: string): Promise<ClientRecord | null> {
    const id = String(chatId || '').trim();
    if (!id) return null;

    const db = await this.ensureReady();

    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_CLIENTS], 'readonly');
      const store = tx.objectStore(STORE_CLIENTS);

      // Se o index ainda não existir por algum motivo, não travar.
      if (!store.indexNames.contains('whatsAppChatId')) return resolve(null);

      const index = store.index('whatsAppChatId');
      const req = index.openCursor(IDBKeyRange.only(id), 'next');

      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve(null);
        try {
          resolve(ClientRecordSchema.parse(cursor.value));
        } catch (e) {
          reject(e);
        }
      };
    });
  }
}

export const clientDB = new ClientDB();

