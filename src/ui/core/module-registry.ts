/**
 * Module Registry - Sistema de descoberta e gerenciamento de módulos
 * 
 * Descobre módulos automaticamente via escaneamento de arquivos *-module.ts
 * Gerencia hierarquia (módulos dentro de módulos) e dependências
 */

import type { EventBus } from './event-bus';
import type { ModuleUpdater } from '../../infrastructure/module-updater';

/**
 * Factory function para criar instância do painel
 * Permite diferentes tipos de construtores
 */
export type PanelFactory = (
  container: HTMLElement,
  eventBus: EventBus
) => PanelInstance | Promise<PanelInstance>;

/**
 * Definição de um módulo
 */
export interface ModuleDefinition {
  /** ID único do módulo (ex: 'clientes.history', 'marketing.retomar') */
  id: string;
  
  /** Nome exibido na UI */
  name: string;
  
  /** ID do módulo pai (opcional, para hierarquia) */
  parent?: string;
  
  /** Ícone opcional (emoji ou string) */
  icon?: string;
  
  /** IDs de módulos que este módulo depende */
  dependencies?: string[];
  
  /** Factory function para criar instância do painel */
  panelFactory: PanelFactory;
  
  /** Se true, módulo só carrega quando necessário (lazy loading) */
  lazy?: boolean;
  
  /** Caminho do arquivo do módulo (usado para lazy loading dinâmico) */
  modulePath?: string;

  /**
   * Submódulo padrão quando este módulo é um container (tem filhos).
   * Evita depender de ordenação alfabética de IDs.
   *
   * Ex.: "marketing.enviar.retomar"
   */
  defaultSubModuleId?: string;
}

/**
 * Interface que todos os painéis devem implementar
 */
export interface PanelInstance {
  /** Renderiza o painel no container (pode retornar Promise) */
  render(): void | Promise<void> | HTMLElement | Promise<HTMLElement>;
  
  /** Limpa recursos quando painel é desmontado */
  destroy?(): void;
}

/**
 * Registry que gerencia todos os módulos da aplicação
 */
export class ModuleRegistry {
  private modules = new Map<string, ModuleDefinition>();
  private hierarchy = new Map<string, string[]>(); // parent -> children[]
  private loadedModules = new Set<string>();
  private moduleUpdater: ModuleUpdater | null = null;

  /**
   * Define o ModuleUpdater para carregar módulos remotos
   */
  setModuleUpdater(updater: ModuleUpdater): void {
    this.moduleUpdater = updater;
  }

  /**
   * Registra um módulo no registry
   */
  register(module: ModuleDefinition): void {
    console.log(`[ModuleRegistry] 🔵 Registrando módulo: id="${module.id}", name="${module.name}", parent="${module.parent || 'none'}"`);
    
    // Validar ID único
    if (this.modules.has(module.id)) {
      console.warn(`[ModuleRegistry] ⚠️ Módulo "${module.id}" já está registrado. Substituindo...`);
    }

    // Validar dependências
    if (module.dependencies) {
      const missingDeps = module.dependencies.filter(dep => !this.modules.has(dep));
      if (missingDeps.length > 0) {
        console.warn(
          `[ModuleRegistry] ⚠️ Módulo "${module.id}" tem dependências faltando: ${missingDeps.join(', ')}`
        );
      }
    }

    // Registrar módulo
    this.modules.set(module.id, module);

    // Atualizar hierarquia
    if (module.parent) {
      if (!this.hierarchy.has(module.parent)) {
        this.hierarchy.set(module.parent, []);
        console.log(`[ModuleRegistry] 📁 Criando hierarquia para parent: "${module.parent}"`);
      }
      this.hierarchy.get(module.parent)!.push(module.id);
      console.log(`[ModuleRegistry] 📂 Adicionando "${module.id}" como filho de "${module.parent}"`);
    }

    console.log(`[ModuleRegistry] ✅ Módulo registrado com sucesso: ${module.id} (total: ${this.modules.size})`);
  }

  /**
   * Retorna um módulo por ID
   */
  getModule(id: string): ModuleDefinition | null {
    const module = this.modules.get(id) ?? null;
    if (!module) {
      console.warn(`[ModuleRegistry] ❌ Módulo "${id}" não encontrado.`);
      console.log(`[ModuleRegistry] 📋 Módulos disponíveis (${this.modules.size}):`, Array.from(this.modules.keys()));
    } else {
      console.log(`[ModuleRegistry] ✅ Módulo "${id}" encontrado: name="${module.name}", parent="${module.parent || 'none'}"`);
    }
    return module;
  }

  /**
   * Retorna todos os módulos de nível superior (sem parent)
   */
  getTopLevelModules(): ModuleDefinition[] {
    return Array.from(this.modules.values())
      .filter(module => !module.parent)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  /**
   * Retorna todos os sub-módulos de um módulo pai
   */
  getSubModules(parentId: string): ModuleDefinition[] {
    const childIds = this.hierarchy.get(parentId) ?? [];
    return childIds
      .map(id => this.modules.get(id))
      .filter((module): module is ModuleDefinition => module !== undefined)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  /**
   * Retorna todos os módulos registrados
   */
  getAllModules(): ModuleDefinition[] {
    return Array.from(this.modules.values());
  }

  /**
   * Descobre módulos automaticamente escaneando pasta modules/
   * 
   * Por enquanto, usa registro manual via registerAllModules().
   * No futuro, pode escanear arquivos *-module.ts automaticamente.
   */
  async discoverModules(): Promise<void> {
    console.log('[ModuleRegistry] 🔍 Iniciando descoberta de módulos...');

    try {
      // Importar e registrar todos os módulos
      console.log('[ModuleRegistry] 📦 Importando módulos de ../../modules/index...');
      const { registerAllModules } = await import('../../modules/index');
      console.log('[ModuleRegistry] 📋 Chamando registerAllModules()...');
      registerAllModules(this);
      
      console.log(`[ModuleRegistry] ✅ Descoberta concluída. ${this.modules.size} módulos registrados:`);
      Array.from(this.modules.keys()).forEach(id => {
        const mod = this.modules.get(id)!;
        console.log(`  - ${id} (${mod.name})${mod.parent ? ` → filho de ${mod.parent}` : ' → top-level'}`);
      });
    } catch (error) {
      console.error('[ModuleRegistry] ❌ Erro ao descobrir módulos:', error);
      throw error;
    }
  }

  /**
   * Carrega um módulo lazy (import dinâmico)
   * Verifica cache remoto antes de carregar local
   */
  async loadModule(id: string): Promise<ModuleDefinition | null> {
    const module = this.getModule(id);
    if (!module) {
      console.warn(`[ModuleRegistry] Módulo "${id}" não encontrado.`);
      return null;
    }

    // Se já está carregado, retorna
    if (this.loadedModules.has(id)) {
      return module;
    }

    // Tentar carregar módulo remoto primeiro (se disponível)
    const remoteCode = await this.loadRemoteModule(id);
    if (remoteCode) {
      try {
        // Criar contexto isolado para executar código remoto
        // O código compilado deve exportar o módulo em uma variável global
        const globalName = `MettriModule_${id.replace(/\./g, '_')}`;
        
        // Criar função register temporária para capturar registro
        let capturedModule: ModuleDefinition | null = null;
        const tempRegistry = {
          register: (mod: ModuleDefinition) => {
            capturedModule = mod;
            // Registrar no registry real
            this.register(mod);
          }
        };
        
        // Executar código remoto com registry temporário disponível
        const executeCode = new Function('register', `
          ${remoteCode}
          // Tentar chamar register se disponível
          if (typeof register === 'function') {
            try {
              const module = typeof ${globalName} !== 'undefined' ? ${globalName} : null;
              if (module && module.module) {
                register(module.module);
              } else if (module && module.id) {
                register(module);
              }
            } catch (e) {
              console.warn('[ModuleRegistry] Erro ao registrar módulo remoto:', e);
            }
          }
        `);
        
        executeCode(tempRegistry.register);
        
        // Se módulo foi capturado, usar ele
        if (capturedModule) {
          this.loadedModules.add(id);
          console.log(`[ModuleRegistry] ✅ Módulo "${id}" carregado do cache remoto`);
          return capturedModule;
        }
        
        // Fallback: tentar buscar da variável global diretamente
        const globalModule = (window as any)[globalName];
        if (globalModule) {
          if (globalModule.module) {
            this.register(globalModule.module);
            this.loadedModules.add(id);
            console.log(`[ModuleRegistry] ✅ Módulo "${id}" carregado do cache remoto (via global)`);
            return this.getModule(id);
          } else if (globalModule.id === id) {
            this.register(globalModule);
            this.loadedModules.add(id);
            console.log(`[ModuleRegistry] ✅ Módulo "${id}" carregado do cache remoto (via global)`);
            return this.getModule(id);
          }
        }
      } catch (error) {
        console.error(`[ModuleRegistry] Erro ao executar módulo remoto "${id}":`, error);
        // Fallback para código local
      }
    }

    // Fallback: carregar módulo local
    if (module.modulePath && module.lazy) {
      try {
        const loaded = await import(module.modulePath);
        // Módulo pode exportar uma função register() que atualiza a definição
        if (loaded.register) {
          loaded.register(this);
        }
        this.loadedModules.add(id);
        console.log(`[ModuleRegistry] ✅ Módulo "${id}" carregado localmente`);
      } catch (error) {
        console.error(`[ModuleRegistry] Erro ao carregar módulo "${id}":`, error);
        return null;
      }
    } else {
      // Módulo não é lazy ou já está disponível
      this.loadedModules.add(id);
    }

    return module;
  }

  /**
   * Carrega módulo do cache remoto (se disponível)
   */
  private async loadRemoteModule(id: string): Promise<string | null> {
    if (!this.moduleUpdater) {
      return null;
    }

    try {
      const code = await this.moduleUpdater.getModuleCode(id);
      return code;
    } catch (error) {
      console.warn(`[ModuleRegistry] Não foi possível carregar módulo remoto "${id}":`, error);
      return null;
    }
  }

  /**
   * Verifica se um módulo está carregado
   */
  isModuleLoaded(id: string): boolean {
    return this.loadedModules.has(id);
  }

  /**
   * Limpa todos os módulos registrados (útil para testes)
   */
  clear(): void {
    this.modules.clear();
    this.hierarchy.clear();
    this.loadedModules.clear();
  }
}
