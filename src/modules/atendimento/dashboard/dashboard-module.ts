/**
 * Atendimento/Dashboard - Submódulo (tela única) dentro do fluxo Atendimento.
 */

import type { ModuleDefinition, PanelFactory, PanelInstance } from '../../../ui/core/module-registry';
import type { EventBus } from '../../../ui/core/event-bus';
import { AtendimentoPanel } from './atendimento-panel';
import { getAtendimentoViewModel, getActiveChatIdDirect } from './provider';
import { emitPanelNavigate } from '../../../ui/core/panel-navigation';
import { orderDB } from '../../../storage/order-db';
import { purchaseDB } from '../../../storage/purchase-db';
import { resolveClientByChatId } from './client-resolver';
import { clientDB } from '../../../storage/client-db';
import { MettriBridgeClient } from '../../../content/bridge-client';
import type { RagConsultaDebugInfo } from '../../../modules/rag';
import { downloadRagExperimentExportJson, readRagExperimentStatsForDashboard } from '../../../modules/rag';
import {
  clearRagAutoRetryPending,
  getRagMettriControllerState,
  runRagMettriConsultation,
  subscribeRagMettriController,
} from '../rag-mettri-controller';
import { sendMessageService } from '../../../infrastructure/services';
import {
  createList as createRetomarList,
  deleteList as deleteRetomarList,
  getMembers as getRetomarMembers,
  getRetomarSupportSnapshot,
  renameList as renameRetomarList,
  toggleMembership,
} from './retomar-support';

const STORAGE_RAG_AUTO_SUGGEST = 'mettri:atendimento:rag:auto-suggest';

const RETOMAR_COLORS: Array<{ var: string; name: string }> = [
  { var: '--tag-color-1', name: 'Verde' },
  { var: '--tag-color-2', name: 'Azul' },
  { var: '--tag-color-3', name: 'Roxo' },
  { var: '--tag-color-4', name: 'Amarelo' },
  { var: '--tag-color-5', name: 'Laranja' },
  { var: '--tag-color-6', name: 'Vermelho' },
  { var: '--tag-color-7', name: 'Indigo' },
  { var: '--tag-color-8', name: 'Verde-agua' },
];

const createAtendimentoDashboardPanel: PanelFactory = async (
  container: HTMLElement,
  eventBus: EventBus
): Promise<PanelInstance> => {
  let currentChatId: string | null = null;
  let lastClientKey: string | null = null;
  let ragAutoSuggestEnabled = false;
  let unsubscribeRagController: (() => void) | null = null;

  async function loadRagAutoSuggestFromStorage(): Promise<boolean> {
    try {
      const bridge = new MettriBridgeClient(4000);
      const obj = await bridge.storageGet([STORAGE_RAG_AUTO_SUGGEST]);
      const v = obj[STORAGE_RAG_AUTO_SUGGEST];
      return v === true || v === '1' || v === 1 || v === 'true';
    } catch {
      return false;
    }
  }

  const getListIdFromPayload = (payload: unknown): string => {
    const listId =
      typeof (payload as { listId?: unknown })?.listId === 'string'
        ? (payload as { listId?: string }).listId
        : '';
    return String(listId || '').trim();
  };

  let ui!: AtendimentoPanel;
  let rerender!: () => Promise<void>;

  async function refreshRagExperimentStatsOnPanel(): Promise<void> {
    try {
      const bridge = new MettriBridgeClient(8000);
      const bundle = await readRagExperimentStatsForDashboard({ bridge });
      if (!bundle) {
        ui.setRagExperimentStatsBundle(null, null, null);
        return;
      }
      ui.setRagExperimentStatsBundle(bundle.week, bundle.today, bundle.total);
    } catch {
      ui.setRagExperimentStatsBundle(null, null, null);
    }
  }

  rerender = async () => {
    ragAutoSuggestEnabled = await loadRagAutoSuggestFromStorage();
    const vm = await getAtendimentoViewModel({ chatId: currentChatId });
    if (vm.kind === 'ready') {
      lastClientKey = vm.customer.clientKey || null;
    } else {
      lastClientKey = null;
    }
    ui.ragAutoSuggestEnabled = ragAutoSuggestEnabled;
    const ctrl = getRagMettriControllerState();
    ui.setRagConsultationFieldsFromController({
      suggestionText: ctrl.ragSuggestionText,
      loading: ctrl.ragLoading,
      similarCount: ctrl.ragSimilarCount,
      debugInfo: (ctrl.ragDebugInfo as RagConsultaDebugInfo | null) ?? null,
    });
    if (vm.kind === 'ready') {
      await refreshRagExperimentStatsOnPanel();
    } else {
      ui.setRagExperimentStatsBundle(null, null, null);
    }
    ui.destroy();
    container.innerHTML = '';
    const element = await ui.render(vm);
    container.appendChild(element);
  };

  const handleRetomarTagAction = async (actionId: string, payload?: unknown): Promise<void> => {
    let chatId = String(currentChatId || '').trim();
    if (!chatId) {
      chatId = String((await getActiveChatIdDirect()) || '').trim();
    }
    if (!chatId) {
      alert('Abra um chat para usar etiquetas.');
      return;
    }

    const listId = getListIdFromPayload(payload);

    try {
      if (actionId === 'retomar-tag:toggle') {
        if (!listId) return;
        await toggleMembership(chatId, listId);
        await rerender();
        return;
      }

      if (actionId === 'retomar-tag:create') {
        const name = prompt('Nome da lista:');
        if (!name || !name.trim()) return;

        const options = RETOMAR_COLORS.map((color, idx) => `${idx + 1}. ${color.name}`).join('\n');
        const choice = prompt(`Escolha uma cor (1-8):\n${options}`);
        const parsed = Number.parseInt(choice || '1', 10);
        const fallbackIdx = Number.isFinite(parsed) ? parsed - 1 : 0;
        const colorIdx = Math.max(0, Math.min(RETOMAR_COLORS.length - 1, fallbackIdx));
        await createRetomarList(name.trim(), RETOMAR_COLORS[colorIdx].var);
        await rerender();
        return;
      }

      const snapshot = await getRetomarSupportSnapshot(chatId);
      const selected = snapshot.etiquetas.find((item) => item.id === listId);
      if (!selected) return;

      if (actionId === 'retomar-tag:view-members') {
        const members = await getRetomarMembers(listId);
        alert(`${selected.name}: ${members.length} membro(s)`);
        return;
      }

      if (actionId === 'retomar-tag:rename') {
        if (selected.isDefault) {
          alert('Etiqueta padrao nao pode ser renomeada.');
          return;
        }
        const newName = prompt('Novo nome da lista:', selected.name);
        if (!newName || !newName.trim()) return;
        await renameRetomarList(listId, newName.trim());
        await rerender();
        return;
      }

      if (actionId === 'retomar-tag:delete') {
        if (selected.isDefault) {
          alert('Etiqueta padrao nao pode ser excluida.');
          return;
        }
        const memberCount = selected.memberCount || 0;
        const memberText = memberCount === 1 ? '1 pessoa' : `${memberCount} pessoas`;
        const message = memberCount > 0
          ? `Tem certeza que deseja excluir a etiqueta "${selected.name}"?\n\nOs ${memberText} nesta etiqueta voltarao ao estado normal.`
          : `Tem certeza que deseja excluir a etiqueta "${selected.name}"?`;
        if (!confirm(message)) return;
        await deleteRetomarList(listId);
        await rerender();
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao executar acao de etiqueta');
    }
  };

  ui = new AtendimentoPanel({
    onAction: async (actionId, payload) => {
      // Integração mínima (sem acoplar UI ao resto)
      if (actionId === 'open-cadastro') {
        emitPanelNavigate(eventBus, 'clientes.directory');
        return;
      }
      if (actionId === 'order:new') {
        const key = String(lastClientKey || '').trim();
        const chatId = String(currentChatId || '').trim();
        if (key && chatId) {
          await orderDB.createOrderDraft({ clientKey: key, chatId });
          await rerender();
        }
        return;
      }

      if (actionId === 'notes:changed') {
        const value = String((payload as any)?.value || '').trimEnd();
        const chatId = String(currentChatId || '').trim();
        if (!chatId) return;

        const resolved = await resolveClientByChatId({ chatId });
        const record = resolved.record;
        const phoneDigits = resolved.phoneDigits;
        const key = String(record?.clientKey || phoneDigits || '').trim();
        if (!key) return;

        // Persistir notas no ClientDB (campo extra; schema é passthrough)
        if (record) {
          await clientDB.upsert({
            ...(record as any),
            notesInternal: value,
            updatedAtIso: new Date().toISOString(),
          } as any);
        } else {
          await clientDB.upsert({
            clientKey: key,
            phoneDigits: phoneDigits || key,
            aliasesDigits: resolved.phoneDigits ? [resolved.phoneDigits] : undefined,
            whatsAppChatId: chatId,
            notesInternal: value,
            updatedAtIso: new Date().toISOString(),
          } as any);
        }

        // Atualizar VM (recarrega do DB)
        await rerender();
        return;
      }

      if (actionId === 'manual:add-purchase') {
        let chatId = String(currentChatId || '').trim();
        if (!chatId) chatId = String((await getActiveChatIdDirect()) || '').trim();
        if (!chatId) {
          alert('Abra um chat para registrar a compra.');
          return;
        }
        const p = payload as { purchaseDate?: string; value?: number; items?: string[]; notes?: string } | undefined;
        const purchaseDateStr = typeof p?.purchaseDate === 'string' ? p.purchaseDate.trim() : '';
        if (!purchaseDateStr) {
          alert('Data da compra é obrigatória.');
          return;
        }
        const purchaseDate = new Date(purchaseDateStr);
        if (Number.isNaN(purchaseDate.getTime())) {
          alert('Data da compra inválida.');
          return;
        }
        const value = p?.value;
        if (value !== undefined && value !== null && (typeof value !== 'number' || value < 0)) {
          alert('Valor deve ser maior ou igual a zero.');
          return;
        }
        try {
          await purchaseDB.addPurchase({
            chatId,
            purchaseDate,
            value,
            items: p?.items,
            notes: p?.notes,
          });
          await rerender();
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Erro ao registrar compra.');
        }
        return;
      }

      if (actionId === 'manual:remove-purchase') {
        const p = payload as { purchaseId?: string } | undefined;
        const purchaseId = typeof p?.purchaseId === 'string' ? p.purchaseId.trim() : '';
        if (!purchaseId) {
          alert('Identificador da compra não informado.');
          return;
        }
        try {
          await purchaseDB.removePurchase(purchaseId);
          await rerender();
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Erro ao remover registro.');
        }
        return;
      }

      if (actionId.startsWith('retomar-tag:')) {
        await handleRetomarTagAction(actionId, payload);
        return;
      }

      if (actionId === 'rag:auto-suggest:changed') {
        const enabled = Boolean((payload as { enabled?: boolean })?.enabled);
        ragAutoSuggestEnabled = enabled;
        ui.ragAutoSuggestEnabled = enabled;
        try {
          const bridge = new MettriBridgeClient(4000);
          await bridge.storageSet({ [STORAGE_RAG_AUTO_SUGGEST]: enabled ? '1' : '0' });
        } catch (err) {
          console.error('[Atendimento] Falha ao persistir modo RAG automático:', err);
        }
        await rerender();
        return;
      }

      if (actionId === 'rag:export-experiment') {
        try {
          const bridge = new MettriBridgeClient(120000);
          const { eventCount, filename } = await downloadRagExperimentExportJson({ bridge });
          alert(
            eventCount === 0
              ? `Exportação concluída (0 eventos). Arquivo: ${filename}`
              : `Exportação concluída: ${eventCount} evento(s). Arquivo: ${filename}`,
          );
        } catch (err) {
          alert(
            err instanceof Error
              ? err.message
              : 'Não foi possível exportar o experimento. Verifique permissão de download e tente de novo.',
          );
        }
        return;
      }

      if (actionId === 'rag:generate') {
        clearRagAutoRetryPending();
        await runRagMettriConsultation(String(currentChatId || '').trim(), 'manual');
        return;
      }

      if (actionId === 'rag:send') {
        const text = String((payload as { text?: string })?.text ?? '').trim();
        if (!text) {
          // Nada a enviar: não dispara integração nem exibe erro.
          return;
        }

        let chatId = String(currentChatId || '').trim();
        if (!chatId) {
          chatId = String((await getActiveChatIdDirect()) || '').trim();
        }

        if (!chatId) {
          alert('Não foi possível enviar pelo WhatsApp. Verifique se a conversa está aberta e tente de novo.');
          return;
        }

        try {
          await sendMessageService.sendText(chatId, text);
          alert('Mensagem enviada no WhatsApp.');
        } catch (error) {
          alert(
            error instanceof Error
              ? error.message
              : 'Não foi possível enviar pelo WhatsApp. Verifique se a conversa está aberta e tente de novo.',
          );
        }
        return;
      }

      console.log('[Atendimento] action:', actionId);
    },
  });

  const onChatChanged = (data: any) => {
    const next = typeof data?.chatId === 'string' ? data.chatId : null;
    currentChatId = next;
    rerender().catch(() => {});
  };

  return {
    async render() {
      eventBus.on('chat:active-changed', onChatChanged);
      unsubscribeRagController?.();
      unsubscribeRagController = subscribeRagMettriController(() => {
        rerender().catch(() => {});
      });
      await rerender();
    },
    destroy() {
      eventBus.off('chat:active-changed', onChatChanged);
      unsubscribeRagController?.();
      unsubscribeRagController = null;
      ui.destroy();
      if (container) container.innerHTML = '';
    },
  };
};

export const AtendimentoDashboardModule: ModuleDefinition = {
  id: 'atendimento.dashboard',
  name: 'Atendimento',
  parent: 'atendimento',
  icon: '🧰',
  dependencies: [],
  panelFactory: createAtendimentoDashboardPanel,
  lazy: true,
};

export function register(registry: { register: (module: ModuleDefinition) => void }): void {
  registry.register(AtendimentoDashboardModule);
}

