/**
 * RetomarListsManager
 *
 * Gerencia etiquetas (listas) de clientes do módulo Retomar.
 * - Listas padrão: Bloqueados (never-send), CNPJ (exclusivos); podem ser renomeadas/excluídas.
 * - Listas customizadas via "Nova lista"; persistência em chrome.storage por conta.
 * - Cliente em qualquer lista não aparece no modo dia (só na etiqueta correspondente).
 */

import { MettriBridgeClient } from '../../../content/bridge-client';

export interface RetomarList {
  id: string;
  name: string;
  type: 'default' | 'custom';
  color: string; // Variável CSS: --tag-color-1, --tag-color-2, etc.
  isDefault: boolean;
  memberCount: number;
  createdAt: number;
  updatedAt: number;
}

interface ListMembers {
  [listId: string]: string[]; // chatId[]
}

export class RetomarListsManager {
  private bridge: MettriBridgeClient;
  private accountId: string;
  private lists: RetomarList[] = [];
  private members: ListMembers = {};
  private storageKeyLists: string;
  private storageKeyMembers: string;

  constructor(accountId: string) {
    this.bridge = new MettriBridgeClient(2500);
    this.accountId = accountId;
    this.storageKeyLists = `retomarLists_${accountId}`;
    this.storageKeyMembers = `retomarListMembers_${accountId}`;
  }

  /**
   * Inicializa o gerenciador e cria listas padrão se não existirem.
   */
  async initialize(): Promise<void> {
    await this.loadLists();
    await this.loadMembers();

    // Criar listas padrão se não existirem
    const hasNeverSend = this.lists.some(l => l.id === 'never-send');
    const hasExclusivos = this.lists.some(l => l.id === 'exclusivos');

    if (!hasNeverSend) {
      await this.createDefaultList('never-send', 'Bloqueados', '--tag-color-6');
    }
    if (!hasExclusivos) {
      await this.createDefaultList('exclusivos', 'CNPJ', '--tag-color-2');
    }
  }

  /**
   * Cria uma lista padrão (não pode ser excluída ou renomeada).
   */
  private async createDefaultList(id: string, name: string, color: string): Promise<void> {
    const list: RetomarList = {
      id,
      name,
      type: 'default',
      color,
      isDefault: true,
      memberCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.lists.push(list);
    this.members[id] = [];
    await this.saveLists();
    await this.saveMembers();
  }

  /**
   * Carrega listas do storage.
   */
  private async loadLists(): Promise<void> {
    try {
      const result = await this.bridge.storageGet([this.storageKeyLists]);
      const stored = result[this.storageKeyLists] as RetomarList[] | undefined;
      if (Array.isArray(stored)) {
        this.lists = stored;
      }
    } catch (error) {
      console.error('[RETOMAR LISTS] Erro ao carregar listas:', error);
      this.lists = [];
    }
  }

  /**
   * Carrega membros do storage.
   */
  private async loadMembers(): Promise<void> {
    try {
      const result = await this.bridge.storageGet([this.storageKeyMembers]);
      const stored = result[this.storageKeyMembers] as ListMembers | undefined;
      if (stored && typeof stored === 'object') {
        this.members = stored;
      }
    } catch (error) {
      console.error('[RETOMAR LISTS] Erro ao carregar membros:', error);
      this.members = {};
    }
  }

  /**
   * Salva listas no storage.
   */
  private async saveLists(): Promise<void> {
    try {
      await this.bridge.storageSet({ [this.storageKeyLists]: this.lists });
    } catch (error) {
      console.error('[RETOMAR LISTS] Erro ao salvar listas:', error);
    }
  }

  /**
   * Salva membros no storage.
   */
  private async saveMembers(): Promise<void> {
    try {
      await this.bridge.storageSet({ [this.storageKeyMembers]: this.members });
    } catch (error) {
      console.error('[RETOMAR LISTS] Erro ao salvar membros:', error);
    }
  }

  /**
   * Retorna todas as listas.
   */
  getLists(): RetomarList[] {
    return [...this.lists];
  }

  /**
   * Cria uma lista customizada.
   */
  async createList(name: string, color: string): Promise<RetomarList> {
    if (!name.trim()) {
      throw new Error('Nome da lista não pode estar vazio');
    }

    // Validar cor (deve ser uma das 8 variáveis CSS pré-definidas)
    const validColors = [
      '--tag-color-1', '--tag-color-2', '--tag-color-3', '--tag-color-4',
      '--tag-color-5', '--tag-color-6', '--tag-color-7', '--tag-color-8',
    ];
    if (!validColors.includes(color)) {
      throw new Error('Cor inválida');
    }

    const id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const list: RetomarList = {
      id,
      name: name.trim(),
      type: 'custom',
      color,
      isDefault: false,
      memberCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.lists.push(list);
    this.members[id] = [];
    await this.saveLists();
    await this.saveMembers();

    return list;
  }

  /**
   * Remove uma lista. Todas as listas podem ser excluídas (incluindo Bloqueados e CNPJ).
   */
  async deleteList(listId: string): Promise<void> {
    const list = this.lists.find(l => l.id === listId);
    if (!list) {
      throw new Error('Lista não encontrada');
    }

    this.lists = this.lists.filter(l => l.id !== listId);
    delete this.members[listId];
    await this.saveLists();
    await this.saveMembers();
  }

  /**
   * Renomeia uma lista. Todas as listas podem ser renomeadas (incluindo Bloqueados e CNPJ).
   */
  async renameList(listId: string, newName: string): Promise<void> {
    if (!newName.trim()) {
      throw new Error('Nome da lista não pode estar vazio');
    }

    const list = this.lists.find(l => l.id === listId);
    if (!list) {
      throw new Error('Lista não encontrada');
    }

    list.name = newName.trim();
    list.updatedAt = Date.now();
    await this.saveLists();
  }

  /**
   * Adiciona um cliente a uma lista (idempotente).
   */
  async addMember(listId: string, chatId: string): Promise<void> {
    const list = this.lists.find(l => l.id === listId);
    if (!list) {
      throw new Error('Lista não encontrada');
    }

    if (!this.members[listId]) {
      this.members[listId] = [];
    }

    // Idempotência: não adicionar se já estiver na lista
    if (!this.members[listId].includes(chatId)) {
      this.members[listId].push(chatId);
      list.memberCount = this.members[listId].length;
      list.updatedAt = Date.now();
      await this.saveLists();
      await this.saveMembers();
    }
  }

  /**
   * Remove um cliente de uma lista.
   */
  async removeMember(listId: string, chatId: string): Promise<void> {
    const list = this.lists.find(l => l.id === listId);
    if (!list) {
      throw new Error('Lista não encontrada');
    }

    if (this.members[listId]) {
      this.members[listId] = this.members[listId].filter(id => id !== chatId);
      list.memberCount = this.members[listId].length;
      list.updatedAt = Date.now();
      await this.saveLists();
      await this.saveMembers();
    }
  }

  /**
   * Verifica se um cliente está em alguma lista (ou em uma lista específica).
   */
  isInList(chatId: string, listId?: string): boolean {
    if (listId) {
      return this.members[listId]?.includes(chatId) ?? false;
    }
    // Verificar em todas as listas
    return Object.values(this.members).some(memberList => memberList.includes(chatId));
  }

  /**
   * Retorna IDs das listas que contêm o cliente.
   */
  getListsForClient(chatId: string): string[] {
    const listIds: string[] = [];
    for (const [id, memberList] of Object.entries(this.members)) {
      if (memberList.includes(chatId)) {
        listIds.push(id);
      }
    }
    return listIds;
  }

  /**
   * Retorna membros de uma lista.
   */
  getMembers(listId: string): string[] {
    return [...(this.members[listId] || [])];
  }
}
