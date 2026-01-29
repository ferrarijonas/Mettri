/**
 * UserSessionModal - Modal de configurações da conta
 * 
 * Modal que exibe informações da conta do usuário e permite ações como exportar dados e limpar cache.
 */

import type { UserSession } from '../../types';
import { getIcon } from '../icons/lucide-icons';
import { messageDB } from '../../storage/message-db';
import { MettriBridgeClient } from '../../content/bridge-client';
import { LocalBatchExporter } from '../../infrastructure/local-batch-exporter';

type ExportStateV1 = {
  version: 1;
  lastSuccessIso?: string;
  pending?: boolean;
};

export class UserSessionModal {
  private overlay: HTMLElement | null = null;
  private modal: HTMLElement | null = null;
  private isOpen: boolean = false;
  private bridge = new MettriBridgeClient(2500);

  constructor() {
    // Modal será criado quando necessário
  }

  /**
   * Abre o modal com informações da sessão do usuário.
   */
  show(session: UserSession | null): void {
    if (this.isOpen) {
      this.close();
      return;
    }

    this.createModal(session);
    this.isOpen = true;
  }

  /**
   * Fecha o modal.
   */
  close(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    this.isOpen = false;
  }

  /**
   * Cria o modal com informações da sessão.
   */
  private createModal(session: UserSession | null): void {
    // Overlay
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.close();
      }
    });

    // Modal
    const modal = document.createElement('div');
    modal.className = 'glass rounded-2xl border border-border/50 p-6 w-96 max-w-[90vw] max-h-[90vh] overflow-y-auto';
    modal.style.backgroundColor = 'var(--mettri-bg, #ffffff)';
    modal.style.color = 'var(--mettri-text, #0A1014)';

    if (!session) {
      modal.innerHTML = `
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold">Conta</h2>
          <button class="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center" id="mettri-user-modal-close">
            ${getIcon('X')}
          </button>
        </div>
        <div class="text-center py-8 text-muted-foreground">
          <p>Nenhuma conta detectada</p>
        </div>
      `;
    } else {
      // Avatar grande
      const avatarHtml = session.profilePicUrl
        ? `<img src="${this.escapeHtml(session.profilePicUrl)}" alt="Avatar" class="w-20 h-20 rounded-full object-cover border-2 border-border">`
        : `<div class="w-20 h-20 rounded-full bg-primary-foreground/20 flex items-center justify-center text-2xl border-2 border-border">
            ${this.getInitials(session)}
          </div>`;

      modal.innerHTML = `
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold">Conta</h2>
          <button class="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center" id="mettri-user-modal-close">
            ${getIcon('X')}
          </button>
        </div>

        <div class="flex flex-col items-center mb-6">
          ${avatarHtml}
          <h3 class="text-lg font-semibold mt-4">${this.escapeHtml(session.name || 'Usuário')}</h3>
          ${session.phoneNumber ? `<p class="text-sm text-muted-foreground mt-1">${this.escapeHtml(session.phoneNumber)}</p>` : ''}
        </div>

        <div class="space-y-2">
          <button class="w-full rounded-lg border border-border bg-background hover:bg-accent px-4 py-3 flex items-center gap-3 transition-colors" id="mettri-user-modal-export">
            ${getIcon('Download')}
            <span class="flex-1 text-left">Exportar dados desta conta</span>
          </button>

          <button class="w-full rounded-lg border border-border bg-background hover:bg-accent px-4 py-3 flex items-center gap-3 transition-colors" id="mettri-user-modal-export-batch">
            ${getIcon('Download')}
            <span class="flex-1 text-left">Exportar lote (JSONL)</span>
          </button>

          <button class="w-full rounded-lg border border-border bg-background hover:bg-accent px-4 py-3 flex items-center gap-3 transition-colors" id="mettri-user-modal-clear">
            ${getIcon('Trash2')}
            <span class="flex-1 text-left">Limpar cache desta conta</span>
          </button>

          <button class="w-full rounded-lg border border-border bg-background hover:bg-accent px-4 py-3 flex items-center gap-3 transition-colors" id="mettri-user-modal-info">
            ${getIcon('Info')}
            <span class="flex-1 text-left">Sobre esta conta</span>
          </button>
        </div>

        <div class="mt-6 pt-4 border-t border-border">
          <p class="text-xs text-muted-foreground">
            <strong>WID:</strong> <code class="text-xs">${this.escapeHtml(session.wid)}</code>
          </p>
          <p class="text-xs text-muted-foreground mt-2" id="mettri-export-status">
            Export automático: verificando...
          </p>
        </div>
      `;
    }

    // Event listeners
    const closeBtn = modal.querySelector('#mettri-user-modal-close');
    closeBtn?.addEventListener('click', () => this.close());

    if (session) {
      const exportBtn = modal.querySelector('#mettri-user-modal-export');
      exportBtn?.addEventListener('click', () => this.handleExport());

      const exportBatchBtn = modal.querySelector('#mettri-user-modal-export-batch');
      exportBatchBtn?.addEventListener('click', () => this.handleExportBatch());

      const clearBtn = modal.querySelector('#mettri-user-modal-clear');
      clearBtn?.addEventListener('click', () => this.handleClear());

      const infoBtn = modal.querySelector('#mettri-user-modal-info');
      infoBtn?.addEventListener('click', () => this.handleInfo(session));
    }

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.modal = modal;

    // Atualizar status do export (assíncrono)
    if (session) {
      this.updateExportStatus(modal).catch(() => {});
    }
  }

  /**
   * Obtém iniciais do usuário.
   */
  private getInitials(session: UserSession): string {
    if (session.name) {
      return session.name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    }
    return '?';
  }

  /**
   * Escapa HTML para prevenir XSS.
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Exporta dados da conta atual.
   */
  private async handleExport(): Promise<void> {
    try {
      const messages = await messageDB.exportMessages();
      const dataStr = JSON.stringify(messages, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mettri-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Mostrar feedback
      this.showToast('Dados exportados com sucesso!');
    } catch (error) {
      console.error('[UserSessionModal] Erro ao exportar:', error);
      this.showToast('Erro ao exportar dados', true);
    }
  }

  /**
   * Exporta um lote em formato JSONL (padrão para futura ingestão em warehouse/banco).
   * Este clique funciona como “gesto do usuário” para permitir download via <a download>.
   */
  private async handleExportBatch(): Promise<void> {
    try {
      const exporter = new LocalBatchExporter();
      const result = await exporter.exportManual();
      if (result.ok) {
        this.showToast('Lote exportado com sucesso!');
      } else {
        this.showToast('Não foi possível exportar o lote', true);
      }
      // Atualizar status após tentativa
      if (this.modal) {
        this.updateExportStatus(this.modal).catch(() => {});
      }
    } catch (error) {
      console.error('[UserSessionModal] Erro ao exportar lote:', error);
      this.showToast('Erro ao exportar lote', true);
    }
  }

  private async updateExportStatus(modal: HTMLElement): Promise<void> {
    const el = modal.querySelector('#mettri-export-status') as HTMLElement | null;
    if (!el) return;

    try {
      const result = await this.bridge.storageGet(['mettri_export_state_v1']);
      const state = (result?.mettri_export_state_v1 ?? null) as ExportStateV1 | null;

      if (!state || state.version !== 1) {
        el.textContent = 'Export automático: ainda não executou.';
        return;
      }

      if (state.pending) {
        el.textContent = 'Export automático: pendente (abra e clique “Exportar lote”).';
        return;
      }

      if (state.lastSuccessIso) {
        el.textContent = `Export automático: ok (último: ${state.lastSuccessIso})`;
        return;
      }

      el.textContent = 'Export automático: ainda não executou.';
    } catch {
      el.textContent = 'Export automático: indisponível.';
    }
  }

  /**
   * Limpa cache da conta atual.
   */
  private async handleClear(): Promise<void> {
    if (!confirm('Tem certeza que deseja limpar todos os dados desta conta? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      await messageDB.clearAllMessages();
      this.showToast('Cache limpo com sucesso!');
      // Fechar modal após limpar
      setTimeout(() => this.close(), 1000);
    } catch (error) {
      console.error('[UserSessionModal] Erro ao limpar cache:', error);
      this.showToast('Erro ao limpar cache', true);
    }
  }

  /**
   * Mostra informações técnicas da conta.
   */
  private handleInfo(session: UserSession): void {
    const info = `
Conta WhatsApp

WID: ${session.wid}
Nome: ${session.name || 'Não disponível'}
Telefone: ${session.phoneNumber || 'Não disponível'}
Foto: ${session.profilePicUrl ? 'Disponível' : 'Não disponível'}

Banco de dados: mettri-db-${session.wid.replace(/[@.]/g, '_')}
    `.trim();

    alert(info);
  }

  /**
   * Mostra toast de feedback.
   */
  private showToast(message: string, isError: boolean = false): void {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded-lg text-sm z-[10001] ${
      isError ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  /**
   * Destrói o modal.
   */
  public destroy(): void {
    this.close();
  }
}
