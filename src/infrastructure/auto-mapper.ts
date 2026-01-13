import type { AutoMappingSession, AutoMappingResult } from '../types';
import { AutoMappingSessionSchema, AutoMappingResultSchema } from '../types/schemas';
import { SelectorManager } from './selector-manager';
import { ConfigUpdater, type SelectorUpdate } from './config-updater';
import { SelectorGenerator } from './auto-mapper/selector-generator';
import { SelectorValidator, type SelectorContext } from './auto-mapper/selector-validator';
import { HitTest } from './auto-mapper/hit-test';

/**
 * Orquestrador principal do sistema de auto-mapeamento.
 * 
 * Responsabilidades:
 * - Orquestrar todo o processo de auto-mapeamento
 * - Gerenciar sessão de mapeamento
 * - Coordenar Generator + Validator + Updater
 * - Implementar loop de tentativa/erro até 100% validado
 * 
 * @see project_context.md seção 3.9.1 - Auto-Mapeamento
 */
export class AutoMapper {
  private session: AutoMappingSession | null = null;
  private generator: SelectorGenerator;
  private validator: SelectorValidator;
  private updater: ConfigUpdater;
  private selectorManager: SelectorManager;
  private hitTest: HitTest;
  private onProgressCallback?: (progress: number) => void;
  private onStatusCallback?: (status: string) => void;

  constructor() {
    this.generator = new SelectorGenerator();
    this.validator = new SelectorValidator();
    this.updater = new ConfigUpdater();
    this.selectorManager = new SelectorManager();
    this.hitTest = new HitTest();
  }

  /**
   * Inicia uma nova sessão de auto-mapeamento.
   * 
   * @param trigger Tipo de trigger (manual, auto, scheduled)
   * @param selectorIds IDs de seletores a mapear (se vazio, mapeia todos)
   */
  async startSession(
    trigger: 'manual' | 'auto' | 'scheduled',
    selectorIds?: string[]
  ): Promise<void> {
    if (this.session && this.session.status === 'active') {
      console.warn('Mettri: Sessão de auto-mapeamento já está ativa');
      return;
    }

    // Determinar quais seletores mapear
    const targets = selectorIds || this.selectorManager.getAllSelectorIds();

    // Criar sessão
    this.session = {
      id: `session-${Date.now()}`,
      startedAt: new Date().toISOString(),
      trigger,
      status: 'active',
      progress: 0,
      targets: targets.map(selectorId => ({
        selectorId,
        element: null,
        attempts: 0,
        status: 'pending',
      })),
      results: [],
    };

    // Validar sessão com Zod
    AutoMappingSessionSchema.parse(this.session);

    console.log(`Mettri: Sessão de auto-mapeamento iniciada (${targets.length} seletores)`);
    this.updateStatus('Sessão iniciada');
  }

  /**
   * Mapeia um elemento específico para um seletor.
   * 
   * @param selectorId ID do seletor a mapear
   * @param element Elemento DOM a mapear
   * @returns Novo seletor CSS ou null se falhar
   */
  async mapElement(selectorId: string, element: HTMLElement): Promise<string | null> {
    if (!this.session) {
      throw new Error('Sessão de auto-mapeamento não iniciada');
    }

    // Encontrar target na sessão
    const target = this.session.targets.find(t => t.selectorId === selectorId);
    if (!target) {
      throw new Error(`Seletor "${selectorId}" não encontrado na sessão`);
    }

    target.status = 'validating';
    target.element = element;
    target.attempts++;

    this.updateStatus(`Mapeando ${selectorId}...`);

    // Gerar candidatos
    const candidates = this.generator.generateCandidates(element);
    console.log(`Mettri: Gerados ${candidates.length} candidatos para ${selectorId}`);

    // Validar cada candidato
    const context: SelectorContext = {
      selectorId,
      expectedCount: 1, // Esperamos que seja único
      mustBeVisible: true,
    };

    for (const candidate of candidates) {
      const result = await this.validator.validate(candidate, element, context);
      if (result.isValid) {
        // Encontrou seletor válido!
        target.status = 'success';
        this.updateStatus(`Seletor válido encontrado para ${selectorId}`);
        return candidate;
      }
    }

    // Nenhum candidato funcionou
    target.status = 'failed';
    this.updateStatus(`Falha ao mapear ${selectorId}`);
    return null;
  }

  /**
   * Valida todos os seletores na sessão.
   * Loop de tentativa/erro até 100% validado.
   * 
   * @returns true se 100% dos seletores foram validados
   */
  async validateAll(): Promise<boolean> {
    if (!this.session) {
      throw new Error('Sessão de auto-mapeamento não iniciada');
    }

    this.session.status = 'validating';
    this.updateStatus('Validando todos os seletores...');

    const total = this.session.targets.length;
    let validated = 0;

    for (const target of this.session.targets) {
      if (target.status === 'success') {
        validated++;
        this.updateProgress((validated / total) * 100);
        continue;
      }

      // Tentar mapear automaticamente (se possível)
      if (target.element) {
        const newSelector = await this.mapElement(target.selectorId, target.element);
        if (newSelector) {
          // Adicionar resultado
          this.session.results.push({
            selectorId: target.selectorId,
            newSelector,
            validated: true,
            validatedAt: new Date().toISOString(),
          });
          validated++;
        }
      }

      this.updateProgress((validated / total) * 100);
    }

    const allValidated = validated === total;
    if (allValidated) {
      this.session.status = 'completed';
      this.updateStatus('Todos os seletores validados com sucesso!');
    } else {
      this.session.status = 'failed';
      this.updateStatus(`Apenas ${validated} de ${total} seletores validados`);
    }

    return allValidated;
  }

  /**
   * Completa a sessão e atualiza configuração remota.
   * 
   * @returns Array de resultados do mapeamento
   */
  async completeSession(): Promise<AutoMappingResult[]> {
    if (!this.session) {
      throw new Error('Sessão de auto-mapeamento não iniciada');
    }

    if (this.session.status !== 'completed') {
      // Tentar validar tudo antes de completar
      const allValidated = await this.validateAll();
      if (!allValidated) {
        throw new Error('Não é possível completar sessão: nem todos os seletores foram validados');
      }
    }

    // Preparar atualizações para envio remoto
    const updates: SelectorUpdate[] = this.session.results.map(result => {
      const definition = this.selectorManager.getSelectorDefinition(result.selectorId);
      const oldSelector = definition?.selectors[0] || 'unknown';

      return {
        selectorId: result.selectorId,
        newSelector: result.newSelector,
        oldSelector,
        validated: result.validated,
      };
    });

    // Atualizar remoto
    this.updateStatus('Enviando atualizações para servidor...');
    const remoteUpdated = await this.updater.updateRemote(updates);

    // Criar resultados finais
    const results: AutoMappingResult[] = this.session.results.map(result => {
      const definition = this.selectorManager.getSelectorDefinition(result.selectorId);
      const oldSelector = definition?.selectors[0] || 'unknown';

      return {
        sessionId: this.session!.id,
        selectorId: result.selectorId,
        oldSelector,
        newSelector: result.newSelector,
        validated: result.validated,
        validatedAt: result.validatedAt || new Date().toISOString(),
        updatedRemote: remoteUpdated,
        updatedAt: remoteUpdated ? new Date().toISOString() : undefined,
      };
    });

    // Validar resultados com Zod
    results.forEach(result => AutoMappingResultSchema.parse(result));

    // Atualizar SelectorManager localmente
    for (const result of results) {
      await this.selectorManager.updateSelector(result.selectorId, result.newSelector);
    }

    this.updateStatus('Sessão completada com sucesso!');
    return results;
  }

  /**
   * Cancela a sessão atual.
   */
  cancelSession(): void {
    if (this.session) {
      this.session.status = 'failed';
      this.updateStatus('Sessão cancelada');
      console.log('Mettri: Sessão de auto-mapeamento cancelada');
    }
    this.session = null;
  }

  /**
   * Obtém o elemento em coordenadas específicas usando hit test.
   * 
   * @param x Coordenada X
   * @param y Coordenada Y
   * @returns Elemento HTMLElement ou null
   */
  getElementAtCoordinates(x: number, y: number): HTMLElement | null {
    return this.hitTest.getElementAt(x, y);
  }

  /**
   * Define callback para atualização de progresso.
   * 
   * @param callback Função chamada quando progresso muda (0-100)
   */
  onProgress(callback: (progress: number) => void): void {
    this.onProgressCallback = callback;
  }

  /**
   * Define callback para atualização de status.
   * 
   * @param callback Função chamada quando status muda
   */
  onStatus(callback: (status: string) => void): void {
    this.onStatusCallback = callback;
  }

  /**
   * Obtém a sessão atual.
   * 
   * @returns Sessão atual ou null
   */
  getSession(): AutoMappingSession | null {
    return this.session;
  }

  /**
   * Atualiza progresso e chama callback.
   */
  private updateProgress(progress: number): void {
    if (this.session) {
      this.session.progress = Math.round(progress);
    }
    if (this.onProgressCallback) {
      this.onProgressCallback(this.session?.progress || 0);
    }
  }

  /**
   * Atualiza status e chama callback.
   */
  private updateStatus(status: string): void {
    if (this.onStatusCallback) {
      this.onStatusCallback(status);
    }
  }
}
