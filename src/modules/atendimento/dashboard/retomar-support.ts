import { MettriBridgeClient } from '../../../content/bridge-client';
import { RetomarListsManager, type RetomarList } from '../../marketing/retomar/retomar-lists';
import * as retomarContador from '../../marketing/retomar/retomar-contador';

const DEFAULT_LABELS: Record<string, { name: string; color: string }> = {
  'never-send': { name: 'Bloqueados', color: '--tag-color-6' },
  exclusivos: { name: 'CNPJ', color: '--tag-color-2' },
  inativos: { name: 'Inativos', color: '--tag-color-5' },
};

const LOCKED_DEFAULT_IDS = new Set<string>(Object.keys(DEFAULT_LABELS));

type ListsManagerLike = Pick<
  RetomarListsManager,
  | 'initialize'
  | 'getLists'
  | 'getListsForClient'
  | 'isInList'
  | 'addMember'
  | 'removeMember'
  | 'createList'
  | 'renameList'
  | 'deleteList'
  | 'getMembers'
>;

interface RetomarSupportDeps {
  getAccountId?: () => Promise<string>;
  createListsManager?: (accountId: string) => Promise<ListsManagerLike> | ListsManagerLike;
  getContador?: (accountId: string, chatId: string) => Promise<number>;
}

export interface RetomarSupportEtiqueta {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
  memberCount: number;
  isMember: boolean;
}

export interface RetomarSupportSnapshot {
  accountId: string;
  chatId: string;
  contador: number;
  etiquetas: RetomarSupportEtiqueta[];
}

async function resolveAccountIdFromStorage(): Promise<string> {
  const bridge = new MettriBridgeClient(2500);
  try {
    const result = await bridge.storageGet(['mettri_current_user_wid']);
    const wid = result.mettri_current_user_wid as string | undefined;
    if (typeof wid === 'string' && wid.trim()) {
      return wid.replace(/[^a-zA-Z0-9]/g, '_');
    }
  } catch {
    // Sem conta definida: usar fallback seguro.
  }
  return 'default';
}

export class RetomarSupportService {
  private readonly deps: Required<RetomarSupportDeps>;

  constructor(deps: RetomarSupportDeps = {}) {
    this.deps = {
      getAccountId: deps.getAccountId ?? resolveAccountIdFromStorage,
      createListsManager:
        deps.createListsManager ??
        (async (accountId: string) => {
          return new RetomarListsManager(accountId);
        }),
      getContador: deps.getContador ?? retomarContador.getContador,
    };
  }

  public async getRetomarSupportSnapshot(chatId: string): Promise<RetomarSupportSnapshot> {
    const normalizedChatId = String(chatId || '').trim();
    const accountId = await this.deps.getAccountId();
    const manager = await this.getInitializedManager(accountId);
    const listasDoCliente = new Set(manager.getListsForClient(normalizedChatId));
    const etiquetas = this.normalizeLists(manager.getLists(), manager, normalizedChatId, listasDoCliente);
    const contador = normalizedChatId ? await this.deps.getContador(accountId, normalizedChatId) : 0;

    return {
      accountId,
      chatId: normalizedChatId,
      contador,
      etiquetas,
    };
  }

  public async toggleMembership(chatId: string, listId: string): Promise<void> {
    const normalizedChatId = String(chatId || '').trim();
    const normalizedListId = String(listId || '').trim();
    if (!normalizedChatId) throw new Error('Chat inválido');
    if (!normalizedListId) throw new Error('Etiqueta inválida');

    const { manager, list } = await this.getListById(normalizedListId);
    if (!list) throw new Error('Etiqueta não encontrada');

    if (manager.isInList(normalizedChatId, normalizedListId)) {
      await manager.removeMember(normalizedListId, normalizedChatId);
      return;
    }
    await manager.addMember(normalizedListId, normalizedChatId);
  }

  public async createList(name: string, color: string): Promise<RetomarList> {
    const accountId = await this.deps.getAccountId();
    const manager = await this.getInitializedManager(accountId);
    return manager.createList(name, color);
  }

  public async renameList(listId: string, newName: string): Promise<void> {
    const { manager, list } = await this.getListById(listId);
    if (!list) throw new Error('Etiqueta não encontrada');
    this.assertMutableList(list);
    await manager.renameList(list.id, newName);
  }

  public async deleteList(listId: string): Promise<void> {
    const { manager, list } = await this.getListById(listId);
    if (!list) throw new Error('Etiqueta não encontrada');
    this.assertMutableList(list);
    await manager.deleteList(list.id);
  }

  public async getMembers(listId: string): Promise<string[]> {
    const { manager, list } = await this.getListById(listId);
    if (!list) throw new Error('Etiqueta não encontrada');
    return manager.getMembers(list.id);
  }

  private async getListById(listId: string): Promise<{ manager: ListsManagerLike; list: RetomarList | null }> {
    const normalizedListId = String(listId || '').trim();
    if (!normalizedListId) throw new Error('Etiqueta inválida');
    const accountId = await this.deps.getAccountId();
    const manager = await this.getInitializedManager(accountId);
    const list = manager.getLists().find((item) => item.id === normalizedListId) ?? null;
    return { manager, list };
  }

  private assertMutableList(list: RetomarList): void {
    if (list.isDefault || LOCKED_DEFAULT_IDS.has(list.id)) {
      throw new Error('Etiqueta padrão não pode ser renomeada ou excluída');
    }
  }

  private async getInitializedManager(accountId: string): Promise<ListsManagerLike> {
    const manager = await this.deps.createListsManager(accountId);
    await manager.initialize();
    return manager;
  }

  private normalizeLists(
    lists: RetomarList[],
    manager: ListsManagerLike,
    chatId: string,
    memberships: Set<string>
  ): RetomarSupportEtiqueta[] {
    return lists
      .map((list) => {
        const defaults = DEFAULT_LABELS[list.id];
        const members = manager.getMembers(list.id);
        return {
          id: list.id,
          name: defaults?.name ?? list.name,
          color: defaults?.color ?? list.color,
          isDefault: !!defaults || list.isDefault === true,
          memberCount: members.length,
          isMember: chatId ? memberships.has(list.id) : false,
        };
      })
      .sort((a, b) => {
        const aDefault = LOCKED_DEFAULT_IDS.has(a.id);
        const bDefault = LOCKED_DEFAULT_IDS.has(b.id);
        if (aDefault && !bDefault) return -1;
        if (!aDefault && bDefault) return 1;
        return a.name.localeCompare(b.name, 'pt-BR');
      });
  }
}

const defaultRetomarSupport = new RetomarSupportService();

export async function getRetomarSupportSnapshot(chatId: string): Promise<RetomarSupportSnapshot> {
  return defaultRetomarSupport.getRetomarSupportSnapshot(chatId);
}

export async function toggleMembership(chatId: string, listId: string): Promise<void> {
  return defaultRetomarSupport.toggleMembership(chatId, listId);
}

export async function createList(name: string, color: string): Promise<RetomarList> {
  return defaultRetomarSupport.createList(name, color);
}

export async function renameList(listId: string, newName: string): Promise<void> {
  return defaultRetomarSupport.renameList(listId, newName);
}

export async function deleteList(listId: string): Promise<void> {
  return defaultRetomarSupport.deleteList(listId);
}

export async function getMembers(listId: string): Promise<string[]> {
  return defaultRetomarSupport.getMembers(listId);
}
