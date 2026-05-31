import { z } from 'zod';

/**
 * OrderDB v2 — "caderno de pedidos" unificado com ciclo de vida completo.
 *
 * Expande o schema v1 (open / awaiting_payment / closed) com:
 *   lead, draft, lost, cancelled, completed
 *   itens estruturados, timeline, funil, numeroSequencial, intencao
 *
 * Compatível com registros v1 (campos novos são opcionais).
 */

const DB_NAME_BASE = 'mettri-orders-db';
const DB_VERSION = 2;

const STORE_ORDERS = 'orders';

// ── Tipos ──

export type IntencaoTipo = 'compra_nova' | 'suporte_pos_venda' | 'orcamento' | 'outro';

export type OrderStatusV2 =
  | 'lead'
  | 'draft'
  | 'open'
  | 'awaiting_payment'
  | 'completed'
  | 'cancelled'
  | 'lost';

/** Mantido para compatibilidade com código legado */
export type OrderStatus = OrderStatusV2;

// ── Schemas ──

const OrderItemStructSchema = z.object({
  skuId: z.string(),
  nome: z.string(),
  quantidade: z.number().int().positive(),
  precoUnitarioCentavos: z.number().int().nonnegative(),
  precoTotalCentavos: z.number().int().nonnegative(),
});

const FunilEtapaSchema = z.object({
  estado: z.enum(['ok', 'pendente']),
  valor: z.string().nullable(),
});

const TimelineEntrySchema = z.object({
  statusAnterior: z.enum([
    'lead', 'draft', 'open', 'awaiting_payment', 'completed', 'cancelled', 'lost',
  ]).nullable(),
  statusNovo: z.enum([
    'lead', 'draft', 'open', 'awaiting_payment', 'completed', 'cancelled', 'lost',
  ]),
  iso: z.string(),
  motivo: z.string().optional(),
});

export const OrderRecordV2Schema = z.object({
  // Campos originais (v1)
  orderId: z.string().min(1),
  clientKey: z.string().min(1),
  chatId: z.string().min(1),
  status: z.enum([
    'lead', 'draft', 'open', 'awaiting_payment', 'completed', 'cancelled', 'lost',
    'closed', // legado v1 → mapeado como 'completed'
  ]),
  itemsSummary: z.string().optional(),
  totalCents: z.number().int().nonnegative().optional(),
  createdAtIso: z.string().datetime(),
  updatedAtIso: z.string().datetime(),

  // Campos novos (v2)
  numeroSequencial: z.number().int().positive().optional(),
  intencao: z.enum(['compra_nova', 'suporte_pos_venda', 'orcamento', 'outro']).optional(),
  itens: z.array(OrderItemStructSchema).optional(),
  funil: z.object({
    produto: FunilEtapaSchema,
    endereco: FunilEtapaSchema,
    pagamento: FunilEtapaSchema,
    prazo: FunilEtapaSchema,
    fechar: FunilEtapaSchema,
  }).optional(),
  timeline: z.array(TimelineEntrySchema).optional(),
  observacoes: z.string().optional(),
  pagamentoStatus: z.enum(['pendente', 'pago', 'recusado']).optional(),
  pagamentoMetodo: z.string().optional(),
});

export type OrderRecordV2 = z.infer<typeof OrderRecordV2Schema>;

/** Tipo legado, compatível */
export type OrderRecord = OrderRecordV2;

// ── Helpers ──

function emptyFunil() {
  return {
    produto: { estado: 'pendente' as const, valor: null as string | null },
    endereco: { estado: 'pendente' as const, valor: null as string | null },
    pagamento: { estado: 'pendente' as const, valor: null as string | null },
    prazo: { estado: 'pendente' as const, valor: null as string | null },
    fechar: { estado: 'pendente' as const, valor: null as string | null },
  };
}

function sanitizeWidForDB(wid: string): string {
  return wid.replace(/[@.]/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
}

function nowIso(): string {
  return new Date().toISOString();
}

function newOrderId(): string {
  return `ord_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function mapLegacyStatus(status: string): OrderStatusV2 {
  if (status === 'closed') return 'completed';
  if (['lead', 'draft', 'open', 'awaiting_payment', 'completed', 'cancelled', 'lost'].includes(status)) {
    return status as OrderStatusV2;
  }
  return 'open';
}

// ── Transições válidas ──

const VALID_TRANSITIONS: Record<string, OrderStatusV2[]> = {
  lead: ['draft', 'cancelled', 'lost'],
  draft: ['open', 'cancelled', 'lost'],
  open: ['awaiting_payment', 'cancelled'],
  awaiting_payment: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  lost: [],
};

// ── OrderDB ──

export class OrderDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private currentUserWid: string | null = null;
  private nextSeq: number | null = null;
  private seqInitialized = false;

  constructor() {
    this.initPromise = this.init();
  }

  private getDBName(): string {
    if (this.currentUserWid) return `${DB_NAME_BASE}-${sanitizeWidForDB(this.currentUserWid)}`;
    return DB_NAME_BASE;
  }

  async setUserWid(wid: string): Promise<void> {
    if (this.currentUserWid === wid) return;
    if (this.db) { this.db.close(); this.db = null; }
    this.currentUserWid = wid;
    this.initPromise = null;
    this.seqInitialized = false;
    this.nextSeq = null;
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

  async ensureReady(): Promise<IDBDatabase> {
    if (this.initPromise) await this.initPromise;
    if (!this.db) throw new Error('OrderDB: Database not initialized');
    return this.db;
  }

  private validate(record: OrderRecordV2): OrderRecordV2 {
    return OrderRecordV2Schema.parse(record);
  }

  // ── CRUD básico ──

  async upsert(record: OrderRecordV2): Promise<void> {
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

  async getByOrderId(orderId: string): Promise<OrderRecordV2 | null> {
    const id = String(orderId || '').trim();
    if (!id) return null;
    const db = await this.ensureReady();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_ORDERS], 'readonly');
      const store = tx.objectStore(STORE_ORDERS);
      const req = store.get(id);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        try { resolve(req.result ? OrderRecordV2Schema.parse(req.result) : null); }
        catch { resolve(null); }
      };
    });
  }

  // ── Número sequencial ──

  async generateSequentialNumber(): Promise<number> {
    if (!this.seqInitialized) {
      const db = await this.ensureReady();
      let maxSeq = 0;
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_ORDERS], 'readonly');
        const store = tx.objectStore(STORE_ORDERS);
        const req = store.openCursor();
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const cursor = req.result as IDBCursorWithValue | null;
          if (!cursor) return resolve();
          try {
            const r = OrderRecordV2Schema.parse(cursor.value);
            if (r.numeroSequencial && r.numeroSequencial > maxSeq) {
              maxSeq = r.numeroSequencial;
            }
          } catch { /* ignore corrompidos */ }
          cursor.continue();
        };
      });
      this.nextSeq = maxSeq + 1;
      this.seqInitialized = true;
    }
    const seq = this.nextSeq!;
    this.nextSeq = seq + 1;
    return seq;
  }

  // ── Criação de pedido com intenção ──

  async createOrder(params: {
    clientKey: string;
    chatId: string;
    intencao: IntencaoTipo;
  }): Promise<OrderRecordV2> {
    const createdAtIso = nowIso();
    const numeroSequencial = await this.generateSequentialNumber();
    const record: OrderRecordV2 = {
      orderId: newOrderId(),
      clientKey: String(params.clientKey || '').trim(),
      chatId: String(params.chatId || '').trim(),
      status: 'lead',
      intencao: params.intencao,
      numeroSequencial,
      itemsSummary: '',
      itens: [],
      funil: emptyFunil(),
      timeline: [{ statusAnterior: null, statusNovo: 'lead', iso: createdAtIso }],
      createdAtIso,
      updatedAtIso: createdAtIso,
    };
    await this.upsert(record);
    return record;
  }

  // ── Transição de status ──

  async advanceStatus(orderId: string, next: OrderStatusV2, motivo?: string): Promise<OrderRecordV2> {
    const existing = await this.getByOrderId(orderId);
    if (!existing) throw new Error(`OrderDB: pedido ${orderId} não encontrado`);

    const currentStatus = mapLegacyStatus(existing.status);
    const validNext = VALID_TRANSITIONS[currentStatus] || [];
    if (!validNext.includes(next)) {
      throw new Error(`OrderDB: transição inválida ${currentStatus} → ${next}`);
    }

    const updatedAtIso = nowIso();
    const timeline = existing.timeline || [];
    const updated: OrderRecordV2 = {
      ...existing,
      status: next,
      updatedAtIso,
      timeline: [
        ...timeline,
        { statusAnterior: currentStatus, statusNovo: next, iso: updatedAtIso, motivo },
      ],
    };

    await this.upsert(updated);
    return updated;
  }

  // ── Itens (só em draft) ──

  async addItem(orderId: string, item: { skuId: string; nome: string; quantidade: number; precoUnitarioCentavos: number }): Promise<OrderRecordV2> {
    const existing = await this.getByOrderId(orderId);
    if (!existing) throw new Error(`OrderDB: pedido ${orderId} não encontrado`);
    if (existing.status !== 'draft' && existing.status !== 'lead') {
      throw new Error('OrderDB: itens só podem ser alterados em lead ou draft');
    }

    const itens = existing.itens || [];
    const dupe = itens.find((i) => i.skuId === item.skuId);
    if (dupe) throw new Error(`OrderDB: item ${item.skuId} já existe no pedido`);

    const precoTotal = item.quantidade * item.precoUnitarioCentavos;
    itens.push({
      skuId: item.skuId,
      nome: item.nome,
      quantidade: item.quantidade,
      precoUnitarioCentavos: item.precoUnitarioCentavos,
      precoTotalCentavos: precoTotal,
    });

    const subtotal = itens.reduce((s, i) => s + i.precoTotalCentavos, 0);
    const updated: OrderRecordV2 = {
      ...existing,
      itens,
      totalCents: subtotal,
      itemsSummary: itens.map((i) => `${i.quantidade}x ${i.nome}`).join(', '),
      updatedAtIso: nowIso(),
    };
    await this.upsert(updated);
    return updated;
  }

  async removeItem(orderId: string, skuId: string): Promise<OrderRecordV2> {
    const existing = await this.getByOrderId(orderId);
    if (!existing) throw new Error(`OrderDB: pedido ${orderId} não encontrado`);
    if (existing.status !== 'draft' && existing.status !== 'lead') {
      throw new Error('OrderDB: itens só podem ser alterados em lead ou draft');
    }

    const itens = (existing.itens || []).filter((i) => i.skuId !== skuId);
    const subtotal = itens.reduce((s, i) => s + i.precoTotalCentavos, 0);
    const updated: OrderRecordV2 = {
      ...existing,
      itens,
      totalCents: subtotal,
      itemsSummary: itens.map((i) => `${i.quantidade}x ${i.nome}`).join(', '),
      updatedAtIso: nowIso(),
    };
    await this.upsert(updated);
    return updated;
  }

  async updateItemQty(orderId: string, skuId: string, novaQuantidade: number): Promise<OrderRecordV2> {
    if (novaQuantidade <= 0) return await this.removeItem(orderId, skuId);

    const existing = await this.getByOrderId(orderId);
    if (!existing) throw new Error(`OrderDB: pedido ${orderId} não encontrado`);
    if (existing.status !== 'draft' && existing.status !== 'lead') {
      throw new Error('OrderDB: itens só podem ser alterados em lead ou draft');
    }

    const itens = (existing.itens || []).map((i) => {
      if (i.skuId !== skuId) return i;
      return { ...i, quantidade: novaQuantidade, precoTotalCentavos: novaQuantidade * i.precoUnitarioCentavos };
    });

    const subtotal = itens.reduce((s, i) => s + i.precoTotalCentavos, 0);
    const updated: OrderRecordV2 = {
      ...existing,
      itens,
      totalCents: subtotal,
      itemsSummary: itens.map((i) => `${i.quantidade}x ${i.nome}`).join(', '),
      updatedAtIso: nowIso(),
    };
    await this.upsert(updated);
    return updated;
  }

  async addObservacao(orderId: string, texto: string): Promise<OrderRecordV2> {
    const existing = await this.getByOrderId(orderId);
    if (!existing) throw new Error(`OrderDB: pedido ${orderId} não encontrado`);
    const updated: OrderRecordV2 = {
      ...existing,
      observacoes: texto,
      updatedAtIso: nowIso(),
    };
    await this.upsert(updated);
    return updated;
  }

  // ── Consultas ──

  async listOpenByClientKey(clientKey: string, limit = 5): Promise<OrderRecordV2[]> {
    return await this.listByClientKeyAndStatus(clientKey, 'open', limit);
  }

  async listByClientKeyAndStatus(clientKey: string, status: OrderStatusV2, limit = 10): Promise<OrderRecordV2[]> {
    const key = String(clientKey || '').trim();
    if (!key) return [];
    const db = await this.ensureReady();
    return await new Promise((resolve, reject) => {
      const results: OrderRecordV2[] = [];
      const tx = db.transaction([STORE_ORDERS], 'readonly');
      const store = tx.objectStore(STORE_ORDERS);
      const index = store.index('clientKey_status');
      const req = index.openCursor(IDBKeyRange.only([key, status]), 'prev');
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result as IDBCursorWithValue | null;
        if (!cursor) return resolve(results);
        try { results.push(OrderRecordV2Schema.parse(cursor.value)); }
        catch { /* ignore */ }
        if (results.length >= limit) return resolve(results);
        cursor.continue();
      };
    });
  }

  async listActiveByClientKey(clientKey: string, limit = 5): Promise<OrderRecordV2[]> {
    const statuses: OrderStatusV2[] = ['lead', 'draft', 'open', 'awaiting_payment'];
    const all: OrderRecordV2[] = [];
    for (const s of statuses) {
      const batch = await this.listByClientKeyAndStatus(clientKey, s, limit);
      all.push(...batch);
    }
    all.sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso));
    return all.slice(0, limit);
  }

  async listByClientKey(clientKey: string, limit = 20): Promise<OrderRecordV2[]> {
    const key = String(clientKey || '').trim();
    if (!key) return [];
    const db = await this.ensureReady();
    return await new Promise((resolve, reject) => {
      const results: OrderRecordV2[] = [];
      const tx = db.transaction([STORE_ORDERS], 'readonly');
      const store = tx.objectStore(STORE_ORDERS);
      const index = store.index('clientKey');
      const req = index.openCursor(IDBKeyRange.only(key), 'prev');
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result as IDBCursorWithValue | null;
        if (!cursor) return resolve(results);
        try { results.push(OrderRecordV2Schema.parse(cursor.value)); }
        catch { /* ignore */ }
        if (results.length >= limit) return resolve(results);
        cursor.continue();
      };
    });
  }

  async listAll(limit = 50): Promise<OrderRecordV2[]> {
    const db = await this.ensureReady();
    return await new Promise((resolve, reject) => {
      const results: OrderRecordV2[] = [];
      const tx = db.transaction([STORE_ORDERS], 'readonly');
      const store = tx.objectStore(STORE_ORDERS);
      const index = store.index('updatedAtIso');
      const req = index.openCursor(null, 'prev');
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result as IDBCursorWithValue | null;
        if (!cursor) return resolve(results);
        try { results.push(OrderRecordV2Schema.parse(cursor.value)); }
        catch { /* ignore */ }
        if (results.length >= limit) return resolve(results);
        cursor.continue();
      };
    });
  }

  async createOrderDraft(params: { clientKey: string; chatId: string }): Promise<OrderRecordV2> {
    return await this.createOrder({
      clientKey: params.clientKey,
      chatId: params.chatId,
      intencao: 'compra_nova',
    });
  }

  async createOrderLegacy(params: { clientKey: string; chatId: string }): Promise<OrderRecordV2> {
    const createdAtIso = nowIso();
    const record: OrderRecordV2 = {
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
}

export const orderDB = new OrderDB();
