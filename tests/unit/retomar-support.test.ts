import { describe, expect, it } from 'vitest';
import type { RetomarList } from '../../src/modules/marketing/retomar/retomar-lists';
import { RetomarSupportService } from '../../src/modules/atendimento/dashboard/retomar-support';

class FakeListsManager {
  private lists: RetomarList[];
  private members: Record<string, string[]>;
  private seq: number;

  constructor() {
    this.seq = 1;
    this.lists = [
      this.createListStruct('never-send', 'Bloqueados alterado', 'default', '--tag-color-1', true),
      this.createListStruct('exclusivos', 'CNPJ alterado', 'default', '--tag-color-3', true),
      this.createListStruct('inativos', 'Inativos alterado', 'default', '--tag-color-8', true),
      this.createListStruct('custom-1', 'Clientes quentes', 'custom', '--tag-color-4', false),
    ];
    this.members = {
      'never-send': ['chat-9'],
      exclusivos: ['chat-1', 'chat-2'],
      inativos: [],
      'custom-1': ['chat-4'],
    };
    this.refreshCounts();
  }

  public async initialize(): Promise<void> {}

  public getLists(): RetomarList[] {
    return this.lists.map((list) => ({ ...list }));
  }

  public getListsForClient(chatId: string): string[] {
    return Object.entries(this.members)
      .filter(([, ids]) => ids.includes(chatId))
      .map(([id]) => id);
  }

  public isInList(chatId: string, listId?: string): boolean {
    if (!listId) return Object.values(this.members).some((ids) => ids.includes(chatId));
    return (this.members[listId] || []).includes(chatId);
  }

  public async addMember(listId: string, chatId: string): Promise<void> {
    const ids = this.members[listId] || [];
    if (!ids.includes(chatId)) ids.push(chatId);
    this.members[listId] = ids;
    this.refreshCounts();
  }

  public async removeMember(listId: string, chatId: string): Promise<void> {
    this.members[listId] = (this.members[listId] || []).filter((id) => id !== chatId);
    this.refreshCounts();
  }

  public async createList(name: string, color: string): Promise<RetomarList> {
    const list = this.createListStruct(`custom-${this.seq++}`, name.trim(), 'custom', color, false);
    this.lists.push(list);
    this.members[list.id] = [];
    this.refreshCounts();
    return { ...list };
  }

  public async renameList(listId: string, newName: string): Promise<void> {
    const list = this.lists.find((item) => item.id === listId);
    if (!list) throw new Error('Lista não encontrada');
    list.name = newName.trim();
    list.updatedAt = Date.now();
  }

  public async deleteList(listId: string): Promise<void> {
    this.lists = this.lists.filter((item) => item.id !== listId);
    delete this.members[listId];
    this.refreshCounts();
  }

  public getMembers(listId: string): string[] {
    return [...(this.members[listId] || [])];
  }

  private refreshCounts(): void {
    this.lists = this.lists.map((list) => ({
      ...list,
      memberCount: (this.members[list.id] || []).length,
      updatedAt: Date.now(),
    }));
  }

  private createListStruct(
    id: string,
    name: string,
    type: 'default' | 'custom',
    color: string,
    isDefault: boolean
  ): RetomarList {
    return {
      id,
      name,
      type,
      color,
      isDefault,
      memberCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
}

function createService() {
  const manager = new FakeListsManager();
  const service = new RetomarSupportService({
    getAccountId: async () => 'account-test',
    createListsManager: () => manager,
    getContador: async () => 2,
  });
  return { manager, service };
}

describe('retomar-support service', () => {
  it('deve montar snapshot com metadados de UI e nomes padrao canonicos', async () => {
    const { service } = createService();

    const snapshot = await service.getRetomarSupportSnapshot('chat-1');
    const bloqueados = snapshot.etiquetas.find((item) => item.id === 'never-send');
    const cnpj = snapshot.etiquetas.find((item) => item.id === 'exclusivos');

    expect(snapshot.accountId).toBe('account-test');
    expect(snapshot.contador).toBe(2);
    expect(bloqueados?.name).toBe('Bloqueados');
    expect(bloqueados?.color).toBe('--tag-color-6');
    expect(cnpj?.isMember).toBe(true);
    expect(cnpj?.memberCount).toBe(2);
  });

  it('deve alternar membro na etiqueta selecionada', async () => {
    const { manager, service } = createService();

    expect(manager.isInList('chat-7', 'inativos')).toBe(false);
    await service.toggleMembership('chat-7', 'inativos');
    expect(manager.isInList('chat-7', 'inativos')).toBe(true);
    await service.toggleMembership('chat-7', 'inativos');
    expect(manager.isInList('chat-7', 'inativos')).toBe(false);
  });

  it('deve bloquear rename e delete para etiquetas padrao', async () => {
    const { service } = createService();

    await expect(service.renameList('never-send', 'Novo nome')).rejects.toThrow('Etiqueta padrão');
    await expect(service.deleteList('exclusivos')).rejects.toThrow('Etiqueta padrão');
  });

  it('deve permitir renomear e excluir etiqueta customizada', async () => {
    const { manager, service } = createService();

    await service.renameList('custom-1', 'VIP');
    expect(manager.getLists().find((item) => item.id === 'custom-1')?.name).toBe('VIP');

    await service.deleteList('custom-1');
    expect(manager.getLists().some((item) => item.id === 'custom-1')).toBe(false);
  });
});
