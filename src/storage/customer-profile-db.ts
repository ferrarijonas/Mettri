import { z } from 'zod';

const DB_NAME_BASE = 'mettri-customer-profile-db';
const DB_VERSION = 3;
const STORE_PROFILES = 'customer_operational_profiles';

function sanitizeWidForDB(wid: string): string {
  return wid.replace(/[@.]/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
}

const OperationalWindowSchema = z.enum(['manha', 'tarde', 'noite']);
const OfferSensitivitySchema = z.enum(['baixa', 'media', 'alta']);
const TicketRangeSchema = z.enum(['baixo', 'medio', 'alto']);
const ProximidadeBandSchema = z.enum(['frio', 'morno', 'quente']);
const RecomputeReasonSchema = z.enum(['turn_end', 'purchase_event', 'scheduled']);
const RfmBandSchema = z.string().min(1);
const CampoConfiancaSchema = z.enum(['desconhecido', 'baixa', 'media', 'alta']);
const UrgenciaEntregaSchema = z.enum(['baixa', 'normal', 'alta']);

const CamposConfiancaSchema = z.object({
  preferenciasProduto: CampoConfiancaSchema.optional(),
  aversoesProduto: CampoConfiancaSchema.optional(),
  enderecoEntrega: CampoConfiancaSchema.optional(),
  formaPagamentoPreferida: CampoConfiancaSchema.optional(),
  urgenciaEntrega: CampoConfiancaSchema.optional(),
  observacoesLogisticas: CampoConfiancaSchema.optional(),
});

const OuvinteCamposSchema = z.object({
  aversoesProduto: z.array(z.string()).optional(),
  enderecoEntrega: z.string().optional(),
  formaPagamentoPreferida: z.array(z.string()).optional(),
  urgenciaEntrega: z.string().optional(),
  observacoesLogisticas: z.array(z.string()).optional(),
  camposConfianca: CamposConfiancaSchema.optional(),
});

const SugestaoProdutoPendenteSchema = z.object({
  nome: z.string().min(1),
  qtd: z.number().positive(),
  nomeExtraido: z.string().min(1),
  confianca: z.enum(['alta', 'media', 'baixa']),
  metodo: z.enum(['reply', 'ultimo_produto', 'llm']),
  evidencia: z.string().min(1),
  criadoEm: z.string().datetime(),
});

export const CustomerOperationalProfileSchema = z.object({
  chatId: z.string().min(1),
  segmentos: z.array(z.string()),
  confiancaPerfil: z.number().min(0).max(1),
  nomeConfiavel: z.string().optional(),
  cadastroUtil: z.boolean().optional(),
  sugestoesPendentes: z.array(SugestaoProdutoPendenteSchema).optional(),
  comportamento: z
    .object({
      janelaAtiva: OperationalWindowSchema.optional(),
      frequenciaContato7d: z.number().int().nonnegative().optional(),
    })
    .optional(),
  historico: z
    .object({
      diasDesdeUltimaCompra: z.number().int().nonnegative().nullable().optional(),
      compras90d: z.number().int().nonnegative().optional(),
      ticketMedioFaixa: TicketRangeSchema.optional(),
    })
    .optional(),
  preferenciasProduto: z.array(z.string()).optional(),
  preferenciasLogistica: z.array(z.string()).optional(),
  sensibilidadeOferta: OfferSensitivitySchema.optional(),
  proximidade: z
    .object({
      score: z.number().min(0).max(1).optional(),
      banda: ProximidadeBandSchema.optional(),
      lastRecomputeReason: RecomputeReasonSchema.optional(),
      lastRecomputeAtIso: z.string().optional(),
    })
    .optional(),
  rfm: z
    .object({
      recenciaDias: z.number().int().nonnegative().optional(),
      frequencia30d: z.number().int().nonnegative().optional(),
      monetario30d: z.number().nonnegative().optional(),
      bandaRecencia: RfmBandSchema.optional(),
      bandaFrequencia: RfmBandSchema.optional(),
      bandaMonetario: RfmBandSchema.optional(),
      score: z.number().optional(),
    })
    .optional(),
  aversoesProduto: z.array(z.string()).optional(),
  enderecoEntrega: z.string().optional(),
  formaPagamentoPreferida: z.array(z.string()).optional(),
  urgenciaEntrega: UrgenciaEntregaSchema.optional(),
  observacoesLogisticas: z.array(z.string()).optional(),
  camposConfianca: CamposConfiancaSchema.optional(),
  pendentesConfirmacao: z
    .array(
      z.object({
        campo: z.string().min(1),
        produto: z.string().optional(),
        atual: z.union([z.string(), z.array(z.string())]).optional(),
        proposto: z.union([z.string(), z.array(z.string())]),
        evidencias: z.array(z.string()),
        confianca: z.number().min(0).max(1),
        criadoEm: z.string().datetime(),
      })
    )
    .optional(),
  updatedAtIso: z.string().datetime(),
  modelVersion: z.string().min(1),
});

export type CustomerOperationalProfile = z.infer<typeof CustomerOperationalProfileSchema>;

export class CustomerProfileDB {
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
    // Mantém alinhamento com outros DBs sem ruído de console em lint estrito.
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
        request.onerror = (): void => reject(request.error);
        request.onsuccess = (): void => {
          this.db = request.result;
          resolve();
        };
        request.onupgradeneeded = (event): void => {
          const db = (event.target as IDBOpenDBRequest).result;
          let store: IDBObjectStore;
          if (!db.objectStoreNames.contains(STORE_PROFILES)) {
            store = db.createObjectStore(STORE_PROFILES, { keyPath: 'chatId' });
          } else {
            store = (request.transaction as IDBTransaction).objectStore(STORE_PROFILES);
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
    if (!this.db) throw new Error('CustomerProfileDB: Database not initialized');
    return this.db;
  }

  async getByChatId(chatId: string): Promise<CustomerOperationalProfile | null> {
    const normalizedChatId = String(chatId || '').trim();
    if (!normalizedChatId) return null;
    const db = await this.ensureReady();

    const result = await this.getByChatIdFromDb(db, normalizedChatId);
    if (result) return result;

    // Fallback: se não encontrou no DB atual, tenta no DB base (migração)
    if (this.currentUserWid) {
      try {
        const baseDb = await this.openDb(DB_NAME_BASE);
        if (baseDb && baseDb.name !== db.name) {
          const baseResult = await this.getByChatIdFromDb(baseDb, normalizedChatId);
          baseDb.close();
          if (baseResult) return baseResult;
        } else if (baseDb) {
          baseDb.close();
        }
      } catch {
        // Silencia erro no fallback
      }
    }

    return null;
  }

  private async getByChatIdFromDb(db: IDBDatabase, chatId: string): Promise<CustomerOperationalProfile | null> {
    if (!db.objectStoreNames.contains(STORE_PROFILES)) return null;
    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_PROFILES], 'readonly');
      const store = tx.objectStore(STORE_PROFILES);
      const req = store.get(chatId);
      req.onerror = (): void => reject(req.error);
      req.onsuccess = (): void => {
        const raw = req.result as unknown;
        if (!raw) return resolve(null);
        try {
          resolve(CustomerOperationalProfileSchema.parse(raw));
        } catch {
          resolve(null);
        }
      };
    });
  }

  private openDb(name: string): Promise<IDBDatabase | null> {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(name, DB_VERSION);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_PROFILES)) {
            db.createObjectStore(STORE_PROFILES, { keyPath: 'chatId' });
          }
        };
      } catch {
        resolve(null);
      }
    });
  }

  async upsert(profile: CustomerOperationalProfile): Promise<void> {
    const validated = CustomerOperationalProfileSchema.parse(profile);
    const db = await this.ensureReady();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_PROFILES], 'readwrite');
      const store = tx.objectStore(STORE_PROFILES);
      const req = store.put(validated);
      req.onerror = (): void => reject(req.error);
      req.onsuccess = (): void => resolve();
    });
  }

  async listByChatIds(chatIds: string[]): Promise<CustomerOperationalProfile[]> {
    const ids = Array.from(
      new Set(chatIds.map(chatId => String(chatId || '').trim()).filter(chatId => chatId.length > 0))
    );
    if (ids.length === 0) return [];

    const records = await Promise.all(ids.map(chatId => this.getByChatId(chatId)));
    return records.filter((record): record is CustomerOperationalProfile => record !== null);
  }
}

export const customerProfileDB = new CustomerProfileDB();
