import type { MettriBridgeClient } from '../../../content/bridge-client';
import { OportunidadesPreviewPanel } from './oportunidades-preview-panel';
import { runOportunidadesPreview } from './preview-provider';
import type { OportunidadesPreviewVm } from './view-model';

export interface SimuladorOportunidadesHandle {
  destroy: () => void;
}

/**
 * Monta o simulador de ranking/sugestão dentro de um host (aba Campanhas).
 */
export function mountSimuladorOportunidades(
  container: HTMLElement,
  bridge: MettriBridgeClient
): SimuladorOportunidadesHandle {
  let ui: OportunidadesPreviewPanel | null = null;

  let vm: OportunidadesPreviewVm = {
    chatId: 'preview_chat',
    clienteTexto: 'Quero algo em promoção',
    aderenciaScore: 0.55,
    result: null,
    loadError: null,
    isLoading: true,
  };

  const rerender = async (): Promise<void> => {
    vm = { ...vm, isLoading: true, loadError: null };
    ui?.update(vm);
    try {
      const result = await runOportunidadesPreview({
        bridge,
        chatId: vm.chatId,
        clienteTexto: vm.clienteTexto,
        aderenciaScore: vm.aderenciaScore,
      });
      vm = { ...vm, result, isLoading: false, loadError: null };
    } catch (e) {
      vm = {
        ...vm,
        isLoading: false,
        loadError: e instanceof Error ? e.message : 'Erro ao calcular preview.',
      };
    }
    ui?.update(vm);
  };

  const onRecalc = async (payload?: unknown): Promise<void> => {
    const p = payload as { chatId?: string; clienteTexto?: string; aderenciaScore?: number };
    vm = {
      ...vm,
      chatId: String(p.chatId ?? vm.chatId).trim() || 'preview_chat',
      clienteTexto: String(p.clienteTexto ?? vm.clienteTexto),
      aderenciaScore:
        typeof p.aderenciaScore === 'number' && Number.isFinite(p.aderenciaScore)
          ? Math.min(1, Math.max(0, p.aderenciaScore))
          : vm.aderenciaScore,
    };
    await rerender();
  };

  container.innerHTML = '';
  ui = new OportunidadesPreviewPanel({
    onAction: async (actionId, payload): Promise<void> => {
      if (actionId === 'oportunidades:recalc') await onRecalc(payload);
    },
  });
  container.appendChild(ui.render(vm));
  void rerender();

  return {
    destroy(): void {
      ui?.destroy();
      ui = null;
      container.innerHTML = '';
    },
  };
}
