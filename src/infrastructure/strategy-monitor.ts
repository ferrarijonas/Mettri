/**
 * StrategyMonitor
 * 
 * Sistema de monitoramento passivo que registra qual estratégia de busca
 * funcionou para cada módulo do WhatsApp.
 * 
 * Objetivo: Identificar estratégias redundantes e validar robustez do sistema.
 */

interface StrategyStat {
  used: number;          // Quantas vezes foi usada
  success: number;       // Quantas vezes funcionou
  lastUsed: Date | null; // Última vez que foi usada
}

interface ModuleStats {
  module: string;        // Nome do módulo (Msg, Chat, MsgKey, etc)
  totalCalls: number;    // Total de chamadas ao getter
  strategies: Map<number, StrategyStat>; // Estatísticas por estratégia
  neverUsed: Set<number>; // Estratégias que nunca foram usadas
}

interface StrategyReportModule {
  module: string;
  totalCalls: number;
  strategies: {
    strategy: number;
    used: number;
    success: number;
    successRate: number;  // 0-100%
    lastUsed: Date | null;
  }[];
  neverUsed: number[];
  mostUsed: number | null; // Estratégia mais usada
}

interface StrategyReport {
  modules: Record<string, StrategyReportModule>;
  summary: {
    totalModules: number;
    totalCalls: number;
    redundantStrategies: number; // Total de estratégias nunca usadas
  };
}

/**
 * Monitor de estratégias de busca de módulos.
 * 
 * Registra automaticamente qual estratégia funcionou em cada chamada,
 * permitindo identificar:
 * - Estratégias redundantes (nunca usadas)
 * - Estratégias mais usadas
 * - Taxa de sucesso de cada estratégia
 */
export class StrategyMonitor {
  private static stats: Map<string, ModuleStats> = new Map();
  private static enabled: boolean = true;
  private static debugMode: boolean = false;

  /**
   * Habilita ou desabilita o monitoramento.
   * Útil para desabilitar em produção se necessário.
   */
  static setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Habilita ou desabilita logs detalhados.
   * Quando habilitado, loga cada uso de estratégia.
   */
  static setDebugMode(debug: boolean): void {
    this.debugMode = debug;
  }

  /**
   * Registra uso de uma estratégia para um módulo.
   * 
   * @param module Nome do módulo (Msg, Chat, MsgKey, etc)
   * @param strategy Número da estratégia (1, 2, 3, etc)
   * @param success Se a estratégia funcionou (true) ou falhou (false)
   */
  static record(module: string, strategy: number, success: boolean): void {
    if (!this.enabled) {
      return;
    }

    // Inicializar estatísticas do módulo se não existir
    if (!this.stats.has(module)) {
      this.stats.set(module, {
        module,
        totalCalls: 0,
        strategies: new Map(),
        neverUsed: new Set(),
      });
    }

    const moduleStats = this.stats.get(module)!;
    moduleStats.totalCalls++;

    // Inicializar estatísticas da estratégia se não existir
    if (!moduleStats.strategies.has(strategy)) {
      moduleStats.strategies.set(strategy, {
        used: 0,
        success: 0,
        lastUsed: null,
      });
      // Adicionar à lista de nunca usadas inicialmente
      moduleStats.neverUsed.add(strategy);
    }

    const strategyStat = moduleStats.strategies.get(strategy)!;
    strategyStat.used++;
    if (success) {
      strategyStat.success++;
      strategyStat.lastUsed = new Date();
      // Remover da lista de nunca usadas
      moduleStats.neverUsed.delete(strategy);
    }

    // Log detalhado se debug mode estiver ativo
    if (this.debugMode) {
      const status = success ? '✅' : '❌';
      console.log(`[STRATEGY] ${module}: estratégia ${strategy} ${status} (total: ${moduleStats.totalCalls})`);
    }
  }

  /**
   * Obtém relatório completo de estatísticas.
   */
  static getReport(): StrategyReport {
    const modules: Record<string, StrategyReportModule> = {};
    let totalCalls = 0;
    let redundantStrategies = 0;

    for (const [moduleName, moduleStats] of this.stats.entries()) {
      const strategies: StrategyReportModule['strategies'] = [];
      let mostUsed: number | null = null;
      let maxUsed = 0;

      // Processar cada estratégia
      for (const [strategyNum, strategyStat] of moduleStats.strategies.entries()) {
        const successRate = strategyStat.used > 0
          ? Math.round((strategyStat.success / strategyStat.used) * 100)
          : 0;

        strategies.push({
          strategy: strategyNum,
          used: strategyStat.used,
          success: strategyStat.success,
          successRate,
          lastUsed: strategyStat.lastUsed,
        });

        // Identificar estratégia mais usada
        if (strategyStat.used > maxUsed) {
          maxUsed = strategyStat.used;
          mostUsed = strategyNum;
        }
      }

      // Ordenar estratégias por uso (mais usada primeiro)
      strategies.sort((a, b) => b.used - a.used);

      modules[moduleName] = {
        module: moduleName,
        totalCalls: moduleStats.totalCalls,
        strategies,
        neverUsed: Array.from(moduleStats.neverUsed).sort((a, b) => a - b),
        mostUsed,
      };

      totalCalls += moduleStats.totalCalls;
      redundantStrategies += moduleStats.neverUsed.size;
    }

    return {
      modules,
      summary: {
        totalModules: this.stats.size,
        totalCalls,
        redundantStrategies,
      },
    };
  }

  /**
   * Obtém estatísticas de um módulo específico.
   */
  static getModuleStats(module: string): StrategyReportModule | null {
    const report = this.getReport();
    return report.modules[module] || null;
  }

  /**
   * Limpa todas as estatísticas.
   */
  static clear(): void {
    this.stats.clear();
    if (this.debugMode) {
      console.log('[STRATEGY] Estatísticas limpas');
    }
  }

  /**
   * Exporta estatísticas em formato JSON.
   */
  static export(): string {
    const report = this.getReport();
    return JSON.stringify(report, null, 2);
  }

  /**
   * Imprime relatório formatado no console.
   */
  static printReport(): void {
    const report = this.getReport();

    console.log('\n📊 RELATÓRIO DE ESTRATÉGIAS\n');
    console.log('='.repeat(60));
    console.log(`Total de módulos: ${report.summary.totalModules}`);
    console.log(`Total de chamadas: ${report.summary.totalCalls}`);
    console.log(`Estratégias redundantes: ${report.summary.redundantStrategies}`);
    console.log('='.repeat(60));
    console.log('');

    for (const [moduleName, moduleData] of Object.entries(report.modules)) {
      console.log(`\n📦 ${moduleName}`);
      console.log(`   Total de chamadas: ${moduleData.totalCalls}`);
      console.log(`   Estratégia mais usada: ${moduleData.mostUsed || 'N/A'}`);
      console.log(`   Estratégias nunca usadas: ${moduleData.neverUsed.length > 0 ? moduleData.neverUsed.join(', ') : 'Nenhuma'}`);
      console.log('');
      console.log('   Estratégias:');
      
      for (const strategy of moduleData.strategies) {
        const status = strategy.used > 0 ? '✅' : '❌';
        const rate = strategy.successRate > 0 ? `${strategy.successRate}%` : '0%';
        console.log(`   ${status} Estratégia ${strategy.strategy}: ${strategy.used}x usado, ${rate} sucesso`);
      }
    }

    console.log('\n' + '='.repeat(60));
  }

  /**
   * Verifica se há estratégias redundantes.
   * Retorna true se houver estratégias nunca usadas.
   */
  static hasRedundantStrategies(): boolean {
    const report = this.getReport();
    return report.summary.redundantStrategies > 0;
  }

  /**
   * Obtém lista de todas as estratégias redundantes.
   */
  static getRedundantStrategies(): Array<{ module: string; strategies: number[] }> {
    const report = this.getReport();
    const redundant: Array<{ module: string; strategies: number[] }> = [];

    for (const [moduleName, moduleData] of Object.entries(report.modules)) {
      if (moduleData.neverUsed.length > 0) {
        redundant.push({
          module: moduleName,
          strategies: moduleData.neverUsed,
        });
      }
    }

    return redundant;
  }
}

// Expor globalmente para acesso via console (debug)
if (typeof window !== 'undefined') {
  (window as any).StrategyMonitor = StrategyMonitor;
}
