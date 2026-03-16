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
import { messageDB } from '../../../storage/message-db';
import { MettriBridgeClient } from '../../../content/bridge-client';
import {
  orquestrador_consulta_rag,
  orquestrador_indexacao_rag,
  vectorIndexIDB,
} from '../../../modules/rag';
import { sendMessageService } from '../../../infrastructure/services';
import {
  createList as createRetomarList,
  deleteList as deleteRetomarList,
  getMembers as getRetomarMembers,
  getRetomarSupportSnapshot,
  renameList as renameRetomarList,
  toggleMembership,
} from './retomar-support';

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
  let ragIndexReady = false;
  let ragIndexInProgress = false;

  const getListIdFromPayload = (payload: unknown): string => {
    const listId =
      typeof (payload as { listId?: unknown })?.listId === 'string'
        ? (payload as { listId?: string }).listId
        : '';
    return String(listId || '').trim();
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

  const ui = new AtendimentoPanel({
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

      if (actionId === 'rag:generate') {
        const chatId = String(currentChatId || '').trim();
        if (!chatId) {
          alert('Abra um chat para gerar sugestão com histórico.');
          (ui as any).ragLoading = false;
          await rerender();
          return;
        }

        try {
          // Se índice ainda não foi preparado, rodar a indexação primeiro (Opção B da spec).
          if (!ragIndexReady && !ragIndexInProgress) {
            ragIndexInProgress = true;
            alert('Preparando histórico de conversas (pode levar 1–2 minutos)...');

            const bridge = new MettriBridgeClient(60000);

            await orquestrador_indexacao_rag({
              bridge,
              index: vectorIndexIDB,
              maxMessages: 10_000,
            });

            ragIndexReady = true;
            ragIndexInProgress = false;
          }

          const messagesDesc = await messageDB.getMessages(chatId, 200);
          if (!messagesDesc.length) {
            throw new Error('Nenhuma mensagem encontrada para este chat.');
          }

          const messages = [...messagesDesc].sort(
            (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
          );

          const bridge = new MettriBridgeClient(60000);

          const { suggestion, chunks, debugInfo } = await orquestrador_consulta_rag({
            messages,
            k: 5,
            bridge,
            index: vectorIndexIDB,
          });

          console.log('[Atendimento] RAG chunks usados:', chunks.length);

          (ui as any).ragLoading = false;
          (ui as any).ragSuggestionText = suggestion;
          (ui as any).ragSimilarCount = chunks.length;
          (ui as any).ragDebugInfo = debugInfo;
          await rerender();
        } catch (error) {
          console.error('[Atendimento] Erro ao gerar sugestão RAG:', error);
          alert(
            error instanceof Error
              ? error.message
              : 'Erro ao gerar sugestão com histórico.',
          );
          (ui as any).ragLoading = false;
          (ui as any).ragSimilarCount = null;
          await rerender();
        }
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

  const rerender = async () => {
    const vm = await getAtendimentoViewModel({ chatId: currentChatId });
    if (vm.kind === 'ready') {
      lastClientKey = vm.customer.clientKey || null;
    } else {
      lastClientKey = null;
    }
    ui.destroy();
    container.innerHTML = '';
    const element = await ui.render(vm);
    container.appendChild(element);
  };

  const onChatChanged = (data: any) => {
    const next = typeof data?.chatId === 'string' ? data.chatId : null;
    currentChatId = next;
    rerender().catch(() => {});
  };

  return {
    async render() {
      eventBus.on('chat:active-changed', onChatChanged);
      await rerender();
    },
    destroy() {
      eventBus.off('chat:active-changed', onChatChanged);
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

