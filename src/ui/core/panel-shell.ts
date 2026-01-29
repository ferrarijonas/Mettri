/**
 * Panel Shell - Núcleo de navegação que não conhece módulos específicos
 * 
 * Responsabilidades:
 * - Gerar HTML de tabs dinamicamente baseado em módulos registrados
 * - Gerenciar troca de abas
 * - Renderizar painel do módulo ativo
 * - NÃO conhece módulos específicos (Histórico, Testes, etc.)
 */

import type { ModuleRegistry, ModuleDefinition } from './module-registry';
import type { EventBus } from './event-bus';

export interface PanelShellConfig {
  /** Container HTML onde o painel será renderizado */
  container: HTMLElement;
  
  /** Registry de módulos */
  registry: ModuleRegistry;
  
  /** Event Bus para comunicação */
  eventBus: EventBus;
  
  /** ID do módulo ativo inicialmente */
  defaultModuleId?: string;
}

export class PanelShell {
  private container: HTMLElement;
  private registry: ModuleRegistry;
  private eventBus: EventBus;
  private currentModuleId: string | null = null;
  private activePanelInstance: { module: ModuleDefinition; instance: unknown } | null = null;
  private tabsContainer: HTMLElement | null = null;
  private contentContainer: HTMLElement | null = null;

  constructor(config: PanelShellConfig) {
    this.container = config.container;
    this.registry = config.registry;
    this.eventBus = config.eventBus;
    this.currentModuleId = config.defaultModuleId ?? null;
  }

  /**
   * Inicializa o shell e renderiza a estrutura base
   */
  async init(): Promise<void> {
    console.log('[PanelShell] 🚀 Iniciando PanelShell.init()...');
    console.log('[PanelShell] 📦 Container:', this.container?.id || 'sem id');
    console.log('[PanelShell] 🎯 Módulo padrão:', this.currentModuleId || 'nenhum');
    
    // Descobrir módulos
    console.log('[PanelShell] 🔍 Descobrindo módulos...');
    await this.registry.discoverModules();

    // Criar estrutura HTML
    console.log('[PanelShell] 🏗️ Criando estrutura HTML...');
    this.createHTMLStructure();

    // Renderizar tabs
    console.log('[PanelShell] 📑 Renderizando tabs...');
    this.renderTabs();

    // Renderizar módulo inicial se houver
    if (this.currentModuleId) {
      console.log(`[PanelShell] 🎯 Ativando módulo padrão: "${this.currentModuleId}"`);
      await this.switchToModule(this.currentModuleId);
    } else {
      // Ativar primeiro módulo disponível (pode ser container ou filho)
      console.log('[PanelShell] 🔍 Nenhum módulo padrão, procurando primeiro módulo disponível...');
      const topLevelModules = this.registry.getTopLevelModules();
      console.log(`[PanelShell] 📋 Módulos top-level encontrados: ${topLevelModules.length}`);
      if (topLevelModules.length > 0) {
        const firstModule = topLevelModules[0];
        console.log(`[PanelShell] ✅ Ativando primeiro módulo: "${firstModule.id}"`);
        // Se é container, switchToModule já resolve para primeiro filho
        await this.switchToModule(firstModule.id);
      } else {
        console.warn('[PanelShell] ⚠️ Nenhum módulo top-level encontrado!');
      }
    }
    
    console.log('[PanelShell] ✅ PanelShell.init() concluído!');
  }

  /**
   * Cria a estrutura HTML base do painel
   * Design v0: Não cria tabs (NavBar faz isso), apenas content container
   */
  private createHTMLStructure(): void {
    console.log('[PanelShell] 🏗️ Criando estrutura HTML...');
    console.log('[PanelShell] 📦 Container recebido:', this.container?.id || 'sem id', this.container?.className || 'sem classe');
    
    // Se container já tem estrutura, não recria
    const existingContent = this.container.querySelector('.mettri-content');
    console.log('[PanelShell] 🔍 Procurando por .mettri-content:', existingContent ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO');
    
    if (existingContent) {
      if (existingContent instanceof HTMLElement) {
        this.contentContainer = existingContent;
        console.log('[PanelShell] ♻️ Reutilizando container existente:', existingContent.id || 'sem id');
        return;
      }
      console.warn('[PanelShell] ⚠️ .mettri-content encontrado, mas não é HTMLElement. Recriando...');
    }

    // Design v0: Não criar tabs (NavBar faz isso)
    // Apenas garantir que content container existe
    const contentDiv = document.createElement('div');
    contentDiv.className = 'mettri-content';
    contentDiv.id = 'mettri-content';
    this.contentContainer = contentDiv;

    // Inserir após status bar se existir, senão no início
    const statusBar = this.container.querySelector('.mettri-status-bar');
    if (statusBar) {
      statusBar.after(contentDiv);
    } else {
      // Se não tem status bar, inserir após header
      const header = this.container.querySelector('.mettri-sidebar-header');
      if (header) {
        header.after(contentDiv);
      } else {
        this.container.appendChild(contentDiv);
      }
    }
  }

  /**
   * Renderiza as tabs baseado nos módulos registrados
   * Design v0: Tabs são gerenciadas pela NavBar, então não renderizamos aqui
   */
  private renderTabs(): void {
    // Design v0: NavBar gerencia navegação entre módulos
    // Não precisamos renderizar tabs aqui
    // A NavBar já tem botões para cada módulo principal
  }

  /**
   * Cria uma tab simples (sem sub-módulos)
   */
  public createSimpleTab(module: ModuleDefinition): void {
    if (!this.tabsContainer) return;

    const tabButton = document.createElement('button');
    tabButton.className = 'mettri-tab';
    tabButton.setAttribute('data-module-id', module.id);
    tabButton.textContent = module.icon ? `${module.icon} ${module.name}` : module.name;
    
    tabButton.addEventListener('click', () => {
      this.switchToModule(module.id).catch((error) => {
        console.error(`[PanelShell] Erro ao trocar para módulo "${module.id}":`, error);
      });
    });

    this.tabsContainer.appendChild(tabButton);
  }

  /**
   * Cria uma tab com dropdown (módulo com sub-módulos)
   */
  public createDropdownTab(parentModule: ModuleDefinition, subModules: ModuleDefinition[]): void {
    if (!this.tabsContainer) return;

    // Container do dropdown
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'mettri-tab-dropdown';
    dropdownContainer.setAttribute('data-parent-module-id', parentModule.id);

    // Botão principal (pai)
    const parentButton = document.createElement('button');
    parentButton.className = 'mettri-tab mettri-tab-dropdown-toggle';
    parentButton.textContent = parentModule.icon ? `${parentModule.icon} ${parentModule.name}` : parentModule.name;
    parentButton.innerHTML += ' <span class="mettri-dropdown-arrow">▼</span>';
    
    // Menu dropdown (inicialmente oculto)
    const dropdownMenu = document.createElement('div');
    dropdownMenu.className = 'mettri-tab-dropdown-menu';
    dropdownMenu.style.display = 'none';

    // Criar itens do menu para cada sub-módulo
    subModules.forEach((subModule) => {
      const menuItem = document.createElement('button');
      menuItem.className = 'mettri-tab-dropdown-item';
      menuItem.setAttribute('data-module-id', subModule.id);
      menuItem.textContent = subModule.icon ? `${subModule.icon} ${subModule.name}` : subModule.name;
      
      menuItem.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await this.switchToModule(subModule.id);
          // Fechar dropdown após seleção
          dropdownMenu.style.display = 'none';
          parentButton.classList.remove('active');
        } catch (error) {
          console.error(`[PanelShell] Erro ao trocar para módulo "${subModule.id}":`, error);
        }
      });

      dropdownMenu.appendChild(menuItem);
    });

    // Toggle do dropdown
    let closeDropdownHandler: ((e: MouseEvent) => void) | null = null;
    
    parentButton.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdownMenu.style.display === 'block';
      
      // Fechar outros dropdowns
      this.tabsContainer?.querySelectorAll('.mettri-tab-dropdown-menu').forEach((menu) => {
        (menu as HTMLElement).style.display = 'none';
      });
      this.tabsContainer?.querySelectorAll('.mettri-tab-dropdown-toggle').forEach((btn) => {
        btn.classList.remove('active');
      });
      
      // Remover listener anterior se existir
      if (closeDropdownHandler) {
        document.removeEventListener('click', closeDropdownHandler, true);
        closeDropdownHandler = null;
      }
      
      // Toggle deste dropdown
      if (isOpen) {
        dropdownMenu.style.display = 'none';
        parentButton.classList.remove('active');
      } else {
        dropdownMenu.style.display = 'block';
        parentButton.classList.add('active');
        
        // Adicionar listener para fechar ao clicar fora
        closeDropdownHandler = (e: MouseEvent) => {
          if (!dropdownContainer.contains(e.target as Node)) {
            dropdownMenu.style.display = 'none';
            parentButton.classList.remove('active');
            if (closeDropdownHandler) {
              document.removeEventListener('click', closeDropdownHandler, true);
              closeDropdownHandler = null;
            }
          }
        };
        
        // Usar setTimeout para não fechar imediatamente
        setTimeout(() => {
          document.addEventListener('click', closeDropdownHandler!, true);
        }, 0);
      }
    });

    dropdownContainer.appendChild(parentButton);
    dropdownContainer.appendChild(dropdownMenu);
    this.tabsContainer.appendChild(dropdownContainer);
  }

  /**
   * Troca para um módulo específico
   */
  async switchToModule(moduleId: string): Promise<void> {
    console.log(`[PanelShell] 🔄 switchToModule chamado para: "${moduleId}"`);
    console.log(`[PanelShell] 📋 contentContainer disponível:`, this.contentContainer ? '✅ SIM' : '❌ NÃO');
    console.log(`[PanelShell] 📋 Registry tem ${this.registry.getAllModules().length} módulos registrados`);
    
    const module = this.registry.getModule(moduleId);
    if (!module) {
      console.error(`[PanelShell] ❌ Módulo "${moduleId}" não encontrado.`);
      const allModules = this.registry.getAllModules();
      console.log(`[PanelShell] 📋 Módulos disponíveis no registry (${allModules.length}):`, allModules.map(m => `${m.id} (${m.name})`));
      console.log(`[PanelShell] 🔍 Tentando buscar por variações do ID...`);
      
      // Tentar variações comuns (infraestrutura ↔ infrastructure)
      const variations = [
        moduleId.replace('infraestrutura', 'infrastructure'),
        moduleId.replace('infrastructure', 'infraestrutura'),
        moduleId.split('.').pop() || moduleId,
      ];
      
      for (const variant of variations) {
        if (variant !== moduleId) {
          console.log(`[PanelShell] 🔄 Tentando variação: "${variant}"`);
          const variantModule = this.registry.getModule(variant);
          if (variantModule) {
            console.log(`[PanelShell] ✅ Encontrado módulo com variação: "${variant}" → usando este`);
            await this.switchToModule(variant);
            return;
          }
        }
      }
      
      console.error(`[PanelShell] ❌ Nenhuma variação funcionou para "${moduleId}"`);
      return;
    }
    
    console.log(`[PanelShell] ✅ Módulo encontrado: name="${module.name}", parent="${module.parent || 'none'}", lazy=${module.lazy || false}`);

    // Verificar se é módulo container (sem UI própria)
    // Se for, ativar primeiro sub-módulo automaticamente
    console.log(`[PanelShell] 🔍 Verificando se "${moduleId}" é container...`);
    const subModules = this.registry.getSubModules(moduleId);
    console.log(`[PanelShell] 📋 Sub-módulos de "${moduleId}":`, subModules.length > 0 ? `${subModules.length} encontrados` : 'nenhum');
    if (subModules.length > 0) {
      subModules.forEach((sub, idx) => {
        console.log(`  ${idx + 1}. ${sub.id} (${sub.name})`);
      });
    }
    
    if (subModules.length > 0) {
      // Módulo container: ativar primeiro sub-módulo
      console.log(`[PanelShell] 📦 Módulo "${moduleId}" é container, ativando primeiro sub-módulo: ${subModules[0].id}`);
      await this.switchToModule(subModules[0].id);
      return;
    }
    
    console.log(`[PanelShell] ✅ Módulo "${moduleId}" não é container, prosseguindo com renderização...`);

    // Carregar módulo se for lazy
    if (module.lazy && !this.registry.isModuleLoaded(moduleId)) {
      await this.registry.loadModule(moduleId);
    }

    // Destruir painel anterior se existir
    if (this.activePanelInstance?.instance && typeof this.activePanelInstance.instance === 'object' && 'destroy' in this.activePanelInstance.instance) {
      (this.activePanelInstance.instance as { destroy: () => void }).destroy();
    }

    // Limpar conteúdo anterior do contentContainer antes de renderizar novo módulo
    if (this.contentContainer) {
      // Limpar apenas containers de módulos, não toda a estrutura
      this.contentContainer.querySelectorAll('[data-module-container]').forEach(el => el.remove());
    }

    // Criar novo container para o módulo
    const moduleContainer = document.createElement('div');
    moduleContainer.className = 'mettri-tab-content';
    moduleContainer.setAttribute('data-module-container', moduleId);
    moduleContainer.style.display = 'block';
    moduleContainer.style.width = '100%';
    moduleContainer.style.height = '100%';
    
    if (this.contentContainer) {
      this.contentContainer.appendChild(moduleContainer);
    }

    // Instanciar e renderizar painel
    try {
      console.log(`[PanelShell] 🏭 Chamando panelFactory para "${moduleId}"...`);
      const panelInstanceOrPromise = module.panelFactory(moduleContainer, this.eventBus);
      const panelInstance = panelInstanceOrPromise instanceof Promise 
        ? await panelInstanceOrPromise 
        : panelInstanceOrPromise;
      
      console.log(`[PanelShell] 🎨 Chamando render() do painel...`);
      const renderResult = panelInstance.render();

      // Se render retorna Promise, aguardar
      if (renderResult instanceof Promise) {
        const element = await renderResult;
        if (element instanceof HTMLElement) {
          moduleContainer.appendChild(element);
        }
      } else if (renderResult instanceof HTMLElement) {
        // Se render retorna HTMLElement diretamente, adicionar ao container
        moduleContainer.appendChild(renderResult);
      }

      this.activePanelInstance = {
        module,
        instance: panelInstance,
      };

      this.currentModuleId = moduleId;

      // Atualizar tabs ativas
      this.updateActiveTab(moduleId);

      // Emitir evento
      this.eventBus.emit('panel:module-changed', { moduleId, module });
    } catch (error) {
      console.error(`[PanelShell] Erro ao renderizar módulo "${moduleId}":`, error);
      throw error;
    }
  }

  /**
   * Atualiza qual tab está ativa visualmente
   */
  private updateActiveTab(moduleId: string): void {
    if (!this.tabsContainer) return;

    const module = this.registry.getModule(moduleId);
    if (!module) return;

    // Remover classe active de todas as tabs
    this.tabsContainer.querySelectorAll('.mettri-tab').forEach((tab) => {
      tab.classList.remove('active');
    });
    this.tabsContainer.querySelectorAll('.mettri-tab-dropdown-item').forEach((item) => {
      item.classList.remove('active');
    });

    // Se módulo tem parent, ativar dropdown do pai e item do filho
    if (module.parent) {
      const parentDropdown = this.tabsContainer.querySelector(`[data-parent-module-id="${module.parent}"]`);
      if (parentDropdown) {
        const parentButton = parentDropdown.querySelector('.mettri-tab-dropdown-toggle');
        if (parentButton) {
          parentButton.classList.add('active');
        }
      }

      const activeItem = this.tabsContainer.querySelector(`[data-module-id="${moduleId}"]`);
      if (activeItem) {
        activeItem.classList.add('active');
      }
    } else {
      // Módulo de nível superior: ativar tab diretamente
      const activeTab = this.tabsContainer.querySelector(`[data-module-id="${moduleId}"]`);
      if (activeTab) {
        activeTab.classList.add('active');
      }
    }
  }

  /**
   * Retorna o ID do módulo atualmente ativo
   */
  getCurrentModuleId(): string | null {
    return this.currentModuleId;
  }

  /**
   * Destrói o shell e limpa recursos
   */
  destroy(): void {
    // Destruir painel ativo
    if (this.activePanelInstance?.instance && typeof this.activePanelInstance.instance === 'object' && 'destroy' in this.activePanelInstance.instance) {
      (this.activePanelInstance.instance as { destroy: () => void }).destroy();
    }

    this.activePanelInstance = null;
    this.currentModuleId = null;
  }
}
