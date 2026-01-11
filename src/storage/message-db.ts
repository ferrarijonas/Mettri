import type { CapturedMessage } from '../types';

const DB_NAME = 'mettri-db';
const DB_VERSION = 1;
const STORE_MESSAGES = 'messages';

export class MessageDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.init();
  }

  private async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

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

  public async saveMessage(message: CapturedMessage): Promise<void> {
    const db = await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_MESSAGES], 'readwrite');
      const store = transaction.objectStore(STORE_MESSAGES);

      // Convert Date to ISO string for storage
      const messageToStore = {
        ...message,
        timestamp: message.timestamp instanceof Date ? message.timestamp.toISOString() : message.timestamp,
      };

      const request = store.put(messageToStore);

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
        const messages = request.result.map((msg: Record<string, unknown>) => ({
          ...msg,
          timestamp: new Date(msg.timestamp as string),
        })) as CapturedMessage[];

        // Sort by timestamp descending
        messages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

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
        let messages = request.result.map((msg: Record<string, unknown>) => ({
          ...msg,
          timestamp: new Date(msg.timestamp as string),
        })) as CapturedMessage[];

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
}

// Singleton instance
export const messageDB = new MessageDB();
