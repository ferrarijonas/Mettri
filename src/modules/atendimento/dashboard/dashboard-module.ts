/**
 * Atendimento/Dashboard - Submódulo (tela única) dentro do fluxo Atendimento.
 */

import type { ModuleDefinition, PanelFactory, PanelInstance } from '../../../ui/core/module-registry';
import type { EventBus } from '../../../ui/core/event-bus';
import type { OuvirProfileUpdatedEvent } from '../../ouvir/types';
import { processarUltimaMensagem } from '../../ouvir/ouvinte';
import { AtendimentoPanel } from './atendimento-panel';
import { getAtendimentoViewModel, getActiveChatIdDirect } from './provider';
import { emitPanelNavigate } from '../../../ui/core/panel-navigation';
import { orderDB } from '../../../storage/order-db';
import { purchaseDB } from '../../../storage/purchase-db';
import { customerProfileDB } from '../../../storage/customer-profile-db';
import { atualizarPerfilOperacionalCliente } from '../../cadastro/cliente/atualizar-perfil-operacional-cliente';
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


const RETOMAR_COLORS: { var: string; name: string }[] = [
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
  let updatedFields: string[] | undefined;
  let confiancaPerfil: number | undefined;
  let ultimaIntencao: string | undefined;
  let ultimaRespostaSugerida: string | undefined;
  let processandoOuvinte = false;
  let clearAnimationTimer: ReturnType<typeof setTimeout> | null = null;

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
    const vm = await getAtendimentoViewModel({
      chatId: currentChatId,
      updatedFields,
      confiancaPerfil,
      intencao: ultimaIntencao,
      respostaSugerida: ultimaRespostaSugerida,
    });
    if (vm.kind === 'ready') {
      lastClientKey = vm.customer.clientKey || null;
    } else {
      lastClientKey = null;
    }
    ui.ragAutoSuggestEnabled = ragAutoSuggestEnabled;
    ui.processandoOuvinte = processandoOuvinte;
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

  const onOuvinteProcessing = (data: { chatId: string; startedAtIso: string }) => {
    if (data.chatId !== currentChatId) return;
    processandoOuvinte = true;
    rerender().catch(() => {});
  };

  const onOuvinteUpdate = (data: OuvirProfileUpdatedEvent) => {
    if (data.chatId !== currentChatId) return;
    processandoOuvinte = false;
    if (clearAnimationTimer) clearTimeout(clearAnimationTimer);
    updatedFields = data.camposAtualizados;
    confiancaPerfil = data.confiancaPerfil;
    if (data.intencao) ultimaIntencao = data.intencao;  // LLM classificou
    if (data.respostaSugerida !== undefined) {
      ultimaRespostaSugerida = data.respostaSugerida;  // LLM gerou resposta (substitui)
    } else if (data.intencao && data.intencao !== 'compra_nova') {
      ultimaRespostaSugerida = undefined;  // conversa mudou de rumo, limpa
    }
    // Persiste até enviar/recusar/nova msg do cliente
    rerender().catch(() => {});
    clearAnimationTimer = setTimeout(() => {
      updatedFields = undefined;
      confiancaPerfil = undefined;
      ultimaIntencao = undefined;
      // ultimaRespostaSugerida NÃO é limpa pelo timer — persiste até o atendente agir ou nova msg chegar
      clearAnimationTimer = null;
    }, 4000);
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
        let key = String(lastClientKey || '').trim();
        if (!key) {
          let chatId = String(currentChatId || '').trim();
          if (!chatId) {
            chatId = String((await getActiveChatIdDirect()) || '').trim();
          }
          if (chatId) {
            const resolved = await resolveClientByChatId({ chatId });
            key = String(resolved?.record?.clientKey || resolved?.phoneDigits || '').trim();
          }
        }
        eventBus.data.pendingClientKey = key || '';
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

      if (actionId === 'comercial:generate') {
        // Stub: orquestrador real virá depois; o painel simula loading → rascunho mock.
        return;
      }

      if (actionId === 'order:register-mock') {
        try {
          const chatId = String(currentChatId || (await getActiveChatIdDirect()) || '').trim();
          if (!chatId) { alert('Nenhum chat ativo.'); return; }
          const vm = await getAtendimentoViewModel({ chatId });
          if (vm.kind !== 'ready' || !vm.pedido.itens.length) { alert('Nenhum item no pedido.'); return; }
          const items = vm.pedido.itens.map(i => {
            const nome = i.produtoCatalogo?.nome || i.nomeExtraido;
            return `${i.quantidade}x ${nome}`;
          });
          await purchaseDB.addPurchase({
            chatId,
            purchaseDate: new Date(),
            value: vm.pedido.totalCentavos,
            items,
            notes: `Pedido fechado via atendimento. Total: R$ ${(vm.pedido.totalCentavos / 100).toFixed(2)}`,
            source: 'AI_DETECTED',
          });
          await rerender();
        } catch (err) {
          console.error('[Atendimento] Erro ao registrar pedido:', err);
          alert('Erro ao registrar pedido.');
        }
        return;
      }

      // ── Ações do pedido (OrderRecordV2) ──

      if (actionId === 'order:confirm') {
        const orderId = String((payload as { orderId?: string })?.orderId || '').trim();
        if (!orderId) return;
        try {
          await orderDB.advanceStatus(orderId, 'open');
          await rerender();
        } catch (err) {
          console.error('[Atendimento] Erro ao confirmar pedido:', err);
          alert('Erro ao confirmar pedido.');
        }
        return;
      }

      if (actionId === 'order:cancel') {
        const orderId = String((payload as { orderId?: string })?.orderId || '').trim();
        const motivo = prompt('Motivo do cancelamento:') || '';
        if (!orderId || !motivo.trim()) return;
        try {
          await orderDB.advanceStatus(orderId, 'cancelled', motivo.trim());
          await rerender();
        } catch (err) {
          console.error('[Atendimento] Erro ao cancelar pedido:', err);
          alert('Erro ao cancelar pedido.');
        }
        return;
      }

      if (actionId === 'order:addItem') {
        const p = payload as { orderId?: string; skuId?: string; nome?: string; quantidade?: number; precoUnitarioCentavos?: number };
        const orderId = String(p?.orderId || '').trim();
        if (!orderId || !p?.skuId) return;
        try {
          await orderDB.addItem(orderId, {
            skuId: p.skuId,
            nome: String(p.nome || p.skuId),
            quantidade: p.quantidade || 1,
            precoUnitarioCentavos: p.precoUnitarioCentavos || 0,
          });
          await rerender();
        } catch (err) {
          console.error('[Atendimento] Erro ao adicionar item:', err);
          alert('Erro ao adicionar item.');
        }
        return;
      }

      if (actionId === 'order:removeItem') {
        const orderId = String((payload as { orderId?: string })?.orderId || '').trim();
        const skuId = String((payload as { skuId?: string })?.skuId || '').trim();
        if (!orderId || !skuId) return;
        try {
          await orderDB.removeItem(orderId, skuId);
          await rerender();
        } catch (err) {
          console.error('[Atendimento] Erro ao remover item:', err);
          alert('Erro ao remover item.');
        }
        return;
      }

      if (actionId === 'order:updateQty') {
        const { orderId, skuId, qty } = payload as { orderId?: string; skuId?: string; qty?: number };
        if (!orderId || !skuId || typeof qty !== 'number') return;
        try {
          await orderDB.updateItemQty(orderId, skuId, qty);
          await rerender();
        } catch (err) {
          console.error('[Atendimento] Erro ao atualizar qtd:', err);
          alert('Erro ao atualizar quantidade.');
        }
        return;
      }

      if (actionId === 'order:addObs') {
        const p = payload as { orderId?: string; texto?: string };
        const orderId = String(p?.orderId || '').trim();
        if (!orderId) return;
        try {
          await orderDB.addObservacao(orderId, String(p?.texto || ''));
          await rerender();
        } catch (err) {
          console.error('[Atendimento] Erro ao salvar observação:', err);
        }
        return;
      }

      if (actionId === 'order:markPaid') {
        const orderId = String((payload as { orderId?: string })?.orderId || '').trim();
        if (!orderId) return;
        try {
          await orderDB.advanceStatus(orderId, 'completed', 'Pagamento confirmado');
          await rerender();
        } catch (err) {
          console.error('[Atendimento] Erro ao marcar como pago:', err);
          alert('Erro ao confirmar pagamento.');
        }
        return;
      }

      if (actionId === 'open-pedidos') {
        emitPanelNavigate(eventBus, 'pedidos');
        return;
      }

      if (actionId === 'comercial:send') {
        const text = String((payload as { text?: string })?.text ?? '').trim();
        if (!text) {
          alert('Digite ou gere um rascunho antes de enviar.');
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

      if (actionId === 'resposta:enviar') {
        const text = String((payload as { text?: string })?.text ?? '').trim();
        if (!text) return;

        let chatId = String(currentChatId || '').trim();
        if (!chatId) {
          chatId = String((await getActiveChatIdDirect()) || '').trim();
        }
        if (!chatId) {
          alert('Abra uma conversa para enviar a mensagem.');
          return;
        }

        try {
          await sendMessageService.sendText(chatId, text);
          ultimaRespostaSugerida = undefined;
          await rerender();
        } catch (error) {
          alert(
            error instanceof Error
              ? error.message
              : 'Não foi possível enviar pelo WhatsApp.',
          );
        }
        return;
      }

      if (actionId === 'resposta:recusar') {
        ultimaRespostaSugerida = undefined;
        await rerender();
        return;
      }

      if (actionId === 'ambiguidade:confirmar') {
        const chatId = String(currentChatId || '').trim()
        if (!chatId) return
        const perfil = await customerProfileDB.getByChatId(chatId)
        const sugestoes = perfil?.sugestoesPendentes
        if (!sugestoes || sugestoes.length === 0) return
        await atualizarPerfilOperacionalCliente({
          chatId,
          sinais: {
            preferenciasProduto: [sugestoes[0].nomeExtraido],
            sugestoesPendentes: [],
            lastRecomputeReason: 'turn_end',
            lastRecomputeAtIso: new Date().toISOString(),
          },
        })
        await rerender()
        return
      }

      if (actionId === 'ambiguidade:recusar') {
        const chatId = String(currentChatId || '').trim()
        if (!chatId) return
        await atualizarPerfilOperacionalCliente({
          chatId,
          sinais: {
            sugestoesPendentes: [],
            lastRecomputeReason: 'turn_end',
            lastRecomputeAtIso: new Date().toISOString(),
          },
        })
        await rerender()
        return
      }

      console.log('[Atendimento] action:', actionId);
    },
  });

  const onChatChanged = (data: any) => {
    const next = typeof data?.chatId === 'string' ? data.chatId : null;
    currentChatId = next;
    if (clearAnimationTimer) clearTimeout(clearAnimationTimer);
    updatedFields = undefined;
    confiancaPerfil = undefined;
    processandoOuvinte = false;

    // Reprocessa última mensagem do cliente se perfil estiver desatualizado
    if (next) {
      processarUltimaMensagem(next).then(reprocessou => {
        if (reprocessou) rerender().catch(() => {});
      }).catch(() => {});
    }

    rerender().catch(() => {});
  };

  return {
    async render() {
      eventBus.on('chat:active-changed', onChatChanged);
      eventBus.on('ouvir:processing', onOuvinteProcessing);
      eventBus.on('ouvir:profile-updated', onOuvinteUpdate);
      unsubscribeRagController?.();
      unsubscribeRagController = subscribeRagMettriController(() => {
        rerender().catch(() => {});
      });
      await rerender();
    },
    destroy() {
      eventBus.off('chat:active-changed', onChatChanged);
      eventBus.off('ouvir:processing', onOuvinteProcessing as any);
      eventBus.off('ouvir:profile-updated', onOuvinteUpdate as any);
      unsubscribeRagController?.();
      unsubscribeRagController = null;
      if (clearAnimationTimer) clearTimeout(clearAnimationTimer);
      ui.destroy();
      if (container) container.innerHTML = '';
    },
  };
};

export const AtendimentoDashboardModule: ModuleDefinition = {
  id: 'atendimento.dashboard',
  name: 'Atendimento',
  parent: 'atendimento',
  dependencies: [],
  panelFactory: createAtendimentoDashboardPanel,
  lazy: true,
};

export function register(registry: { register: (module: ModuleDefinition) => void }): void {
  registry.register(AtendimentoDashboardModule);
}

