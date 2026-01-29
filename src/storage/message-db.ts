import type { CapturedMessage, MessageDBEntry } from '../types';
import {
  CapturedMessageSchema,
  MessageDBEntrySchema,
  messageToDBEntry,
  dbEntryToMessage,
} from '../types/schemas';
import { z } from 'zod';

const DB_NAME_BASE = 'mettri-db';
const DB_VERSION = 1;
const STORE_MESSAGES = 'messages';

export class MessageDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private currentUserWid: string | null = null;

  constructor() {
    // Inicializa com banco padrão para compatibilidade
    // Pode ser trocado para banco específico via setUserWid()
    this.initPromise = this.init();
  }

  /**
   * Sanitiza WID para uso como nome de banco de dados.
   */
  private sanitizeWidForDB(wid: string): string {
    return wid.replace(/[@.]/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  }

  /**
   * Retorna o nome do banco de dados baseado no userWid atual.
   */
  private getDBName(): string {
    if (this.currentUserWid) {
      const sanitized = this.sanitizeWidForDB(this.currentUserWid);
      return `${DB_NAME_BASE}-${sanitized}`;
    }
    return DB_NAME_BASE; // Banco padrão para compatibilidade
  }

  /**
   * Define o WID do usuário atual e abre o banco correspondente.
   * Fecha o banco atual se existir e abre um novo.
   */
  async setUserWid(wid: string): Promise<void> {
    if (this.currentUserWid === wid) {
      // Mesmo usuário, não precisa fazer nada
      return;
    }

    // Fechar banco atual se existir
    if (this.db) {
      this.db.close();
      this.db = null;
    }

    this.currentUserWid = wid;
    this.initPromise = null; // Reset init promise

    // Inicializar novo banco
    await this.init();
    console.log(`[MessageDB] Banco aberto para usuário: ${wid} (${this.getDBName()})`);
  }

  /**
   * Retorna o WID do usuário atual.
   */
  getCurrentUserWid(): string | null {
    return this.currentUserWid;
  }

  private async init(): Promise<void> {
    // Se já está inicializado e o banco está aberto, não precisa fazer nada
    if (this.db && this.db.name === this.getDBName()) {
      return;
    }

    return new Promise((resolve, reject) => {
      const dbName = this.getDBName();
      const request = indexedDB.open(dbName, DB_VERSION);

      request.onerror = () => {
        console.error('Mettri: Failed to open database');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('Mettri: Database opened successfully');
        resolve();
      };

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create messages store
        if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
          const store = db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' });
          store.createIndex('chatId', 'chatId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('chatId_timestamp', ['chatId', 'timestamp'], { unique: false });
        }
      };
    });
  }

  private async ensureReady(): Promise<IDBDatabase> {
    if (this.initPromise) {
      await this.initPromise;
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  /**
   * Valida uma mensagem capturada usando o schema Zod.
   * Lança erro descritivo se a validação falhar.
   */
  private validateMessage(message: CapturedMessage): CapturedMessage {
    try {
      return CapturedMessageSchema.parse(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Mettri: Falha ao validar mensagem:', error.errors);
        throw new Error(`Falha ao validar mensagem: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Valida dados brutos recuperados do IndexedDB.
   * Garante que dados corrompidos não sejam retornados.
   */
  private validateDBEntry(entry: unknown): MessageDBEntry {
    try {
      return MessageDBEntrySchema.parse(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Mettri: Dados corrompidos no IndexedDB:', error.errors);
        throw new Error(`Falha ao validar mensagem do banco: ${error.message}`);
      }
      throw error;
    }
  }

  public async saveMessage(message: CapturedMessage): Promise<void> {
    // Validar entrada
    const validatedMessage = this.validateMessage(message);

    // Converter usando helper
    const dbEntry = messageToDBEntry(validatedMessage);

    // Validar formato de storage
    const validatedEntry = this.validateDBEntry(dbEntry);

    const db = await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_MESSAGES], 'readwrite');
      const store = transaction.objectStore(STORE_MESSAGES);

      const request = store.put(validatedEntry);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  public async getMessages(chatId?: string, limit = 100): Promise<CapturedMessage[]> {
    const db = await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_MESSAGES], 'readonly');
      const store = transaction.objectStore(STORE_MESSAGES);

      let request: IDBRequest;

      if (chatId) {
        const index = store.index('chatId');
        request = index.getAll(chatId, limit);
      } else {
        request = store.getAll(null, limit);
      }

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const messages = request.result
          .map((rawEntry: unknown): CapturedMessage | null => {
            try {
              // Validar formato do IndexedDB
              const validatedEntry = this.validateDBEntry(rawEntry);
              // Converter para CapturedMessage
              return dbEntryToMessage(validatedEntry);
            } catch (error) {
              console.error('Mettri: Erro ao processar mensagem do banco:', error);
              return null;
            }
          })
          .filter((msg: CapturedMessage | null): msg is CapturedMessage => msg !== null);

        // Sort by timestamp descending
        messages.sort((a: CapturedMessage, b: CapturedMessage) => b.timestamp.getTime() - a.timestamp.getTime());

        resolve(messages);
      };
    });
  }

  public async getMessagesByDateRange(
    startDate: Date,
    endDate: Date,
    chatId?: string
  ): Promise<CapturedMessage[]> {
    const db = await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_MESSAGES], 'readonly');
      const store = transaction.objectStore(STORE_MESSAGES);
      const index = store.index('timestamp');

      const range = IDBKeyRange.bound(startDate.toISOString(), endDate.toISOString());
      const request = index.getAll(range);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        let messages = request.result
          .map((rawEntry: unknown): CapturedMessage | null => {
            try {
              // Validar formato do IndexedDB
              const validatedEntry = this.validateDBEntry(rawEntry);
              // Converter para CapturedMessage
              return dbEntryToMessage(validatedEntry);
            } catch (error) {
              console.error('Mettri: Erro ao processar mensagem do banco:', error);
              return null;
            }
          })
          .filter((msg: CapturedMessage | null): msg is CapturedMessage => msg !== null);

        // Filter by chatId if provided
        if (chatId) {
          messages = messages.filter(m => m.chatId === chatId);
        }

        resolve(messages);
      };
    });
  }

  public async deleteMessage(messageId: string): Promise<void> {
    const db = await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_MESSAGES], 'readwrite');
      const store = transaction.objectStore(STORE_MESSAGES);
      const request = store.delete(messageId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  public async clearAllMessages(): Promise<void> {
    const db = await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_MESSAGES], 'readwrite');
      const store = transaction.objectStore(STORE_MESSAGES);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  public async getMessageCount(): Promise<number> {
    const db = await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_MESSAGES], 'readonly');
      const store = transaction.objectStore(STORE_MESSAGES);
      const request = store.count();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  public async exportMessages(): Promise<CapturedMessage[]> {
    return this.getMessages(undefined, 10000); // Export up to 10k messages
  }

  /**
   * Agrupa mensagens por contato.
   * Retorna um mapa onde a chave é o chatId e o valor contém informações do contato e suas mensagens.
   */
  public async groupMessagesByContact(): Promise<Map<string, {
    chatId: string;
    chatName: string;
    messageCount: number;
    lastMessage: CapturedMessage | null;
    lastMessageTime: Date | null;
  }>> {
    const db = await this.ensureReady();
    const contactsMap = new Map<string, {
      chatId: string;
      chatName: string;
      messageCount: number;
      lastMessage: CapturedMessage | null;
      lastMessageTime: Date | null;
    }>();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_MESSAGES], 'readonly');
      const store = transaction.objectStore(STORE_MESSAGES);
      // Usar índice de timestamp para percorrer na ordem correta (mais recente primeiro)
      const index = store.index('timestamp');
      const request = index.openCursor(null, 'prev'); // 'prev' = ordem descendente (mais recente primeiro)

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          // Processamento completo - já está ordenado por timestamp descendente
          resolve(contactsMap);
          return;
        }

        const rawEntry = cursor.value as unknown;
        try {
          const validatedEntry = this.validateDBEntry(rawEntry);
          const message = dbEntryToMessage(validatedEntry);

          const existing = contactsMap.get(message.chatId);
          if (!existing) {
            // Primeira mensagem deste contato (como estamos percorrendo do mais recente para o mais antigo,
            // a primeira mensagem encontrada já é a mais recente)
            contactsMap.set(message.chatId, {
              chatId: message.chatId,
              chatName: message.chatName,
              messageCount: 1,
              lastMessage: message,
              lastMessageTime: message.timestamp,
            });
          } else {
            // Incrementar contador apenas
            // Como estamos percorrendo do mais recente para o mais antigo,
            // a primeira mensagem já foi definida como lastMessage
            existing.messageCount++;
          }
        } catch (error) {
          console.error('Mettri: Erro ao processar mensagem no agrupamento:', error);
        }

        cursor.continue();
      };
    });
  }

  /**
   * Obtém todas as mensagens de um contato específico, ordenadas por data.
   */
  public async getContactMessages(chatId: string, limit = 1000): Promise<CapturedMessage[]> {
    return this.getMessages(chatId, limit);
  }
}

// Singleton instance
// IMPORTANTE: Não inicializa automaticamente - deve chamar setUserWid() ou init() manualmente
export const messageDB = new MessageDB();
