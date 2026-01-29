/**
 * Estrutura HTML do Painel baseada no design v0
 * 
 * Este arquivo contém apenas a estrutura HTML que será usada no panel.ts
 * Mantém compatibilidade com PanelShell e módulos existentes.
 */

import { getIcon } from './icons/lucide-icons';

export interface PanelV0Structure {
  panelHTML: string;
  navBarHTML: string;
}

/**
 * Gera HTML do painel principal (Sidebar do v0)
 */
export function generatePanelHTML(moduleTitle: string): string {
  return `
    <div class="mettri-sidebar">
      <!-- Header -->
      <div class="mettri-sidebar-header">
        <div class="mettri-sidebar-header-title">
          <span class="mettri-sidebar-title-text">${moduleTitle}</span>
        </div>
        <div class="mettri-sidebar-header-actions">
          <button class="mettri-kebab-menu" id="mettri-kebab-menu" title="Menu">
            ${getIcon('MoreVertical')}
          </button>
          <button class="mettri-header-btn" id="mettri-minimize" title="Minimizar">
            ${getIcon('Minus')}
          </button>
          <button class="mettri-header-btn" id="mettri-close" title="Fechar">
            ${getIcon('X')}
          </button>
        </div>
      </div>

      <!-- Status Bar -->
      <div class="mettri-status-bar">
        <div class="mettri-status-bar-left">
          <div class="mettri-status-dot" id="mettri-status-dot"></div>
          <span class="mettri-status-text" id="mettri-status-text">Sincronizado</span>
        </div>
        <button class="mettri-refresh-btn" id="mettri-refresh" title="Atualizar">
          ${getIcon('RefreshCw')}
        </button>
      </div>

      <!-- Content Area -->
      <div class="mettri-content" id="mettri-content">
        <!-- Conteúdo será gerenciado pelo PanelShell -->
      </div>

      <!-- Footer -->
      <div class="mettri-sidebar-footer">
        <span class="mettri-footer-text">Mettri v2.0.0</span>
      </div>
    </div>
  `;
}

/**
 * Gera HTML da NavBar vertical (lado direito)
 */
export function generateNavBarHTML(): string {
  return `
    <div class="mettri-navbar" id="mettri-navbar">
      <!-- Toggle Sidebar Button -->
      <button class="mettri-navbar-btn" id="mettri-navbar-toggle" title="Fechar painel">
        ${getIcon('ChevronRight')}
      </button>

      <div class="mettri-navbar-divider"></div>

      <!-- Module: Clientes / Histórico -->
      <button class="mettri-navbar-btn mettri-navbar-module" data-module-id="clientes" title="Clientes - Histórico de conversas">
        ${getIcon('Users')}
      </button>

      <!-- Module: Infraestrutura / Testes -->
      <button class="mettri-navbar-btn mettri-navbar-module" data-module-id="infraestrutura" title="Infraestrutura - Testes e Sentinela">
        ${getIcon('Server')}
      </button>

      <!-- Module: Marketing / Reativação -->
      <button class="mettri-navbar-btn mettri-navbar-module" data-module-id="marketing" title="Marketing - Reativação de clientes">
        ${getIcon('Megaphone')}
      </button>

      <div class="mettri-navbar-spacer"></div>

      <!-- Settings -->
      <button class="mettri-navbar-btn" id="mettri-navbar-help" title="Ajuda">
        ${getIcon('HelpCircle')}
      </button>

      <button class="mettri-navbar-btn" id="mettri-navbar-settings" title="Configurações">
        ${getIcon('Settings')}
      </button>

      <!-- Dark Mode Toggle (opcional, pode ser adicionado depois) -->
    </div>
  `;
}

/**
 * Mapeia moduleId para título de exibição
 */
export function getModuleTitle(moduleId: string): string {
  const titleMap: Record<string, string> = {
    'clientes': 'Histórico',
    'clientes.history': 'Histórico',
    'infraestrutura': 'Sentinela',
    'infraestrutura.tests': 'Sentinela',
    'marketing': 'Reativação',
    'marketing.reactivation': 'Reativação',
  };

  // Se é um sub-módulo, pegar pelo parent
  const parts = moduleId.split('.');
  if (parts.length > 1) {
    const parentId = parts[0];
    return titleMap[parentId] || titleMap[moduleId] || moduleId;
  }

  return titleMap[moduleId] || moduleId;
}
