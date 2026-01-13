import type { SelectorsConfig, SelectorDefinition } from '../types';
import { SelectorsConfigSchema } from '../types/schemas';
import selectorsConfigRaw from '../../config/selectors.json';

/**
 * Gerenciador de seletores com fallback chain e detecção de quebra.
 * 
 * Responsabilidades:
 * - Carregar seletores de config/selectors.json ou remoto
 * - Implementar fallback chain (tentar cada seletor até um funcionar)
 * - Detectar quando seletores quebram
 * - Cachear seletores validados
 * 
 * @see project_context.md seção 3.9.1 - Seletores Auto-Corrigíveis
 */
export class SelectorManager {
  private config: SelectorsConfig;
  private cache: Map<string, string>; // selectorId -> working selector
  private validationCache: Map<string, boolean>; // selectorId -> isValid

  constructor() {
    // Validar e carregar configuração
    this.config = SelectorsConfigSchema.parse(selectorsConfigRaw);
    this.cache = new Map();
    this.validationCache = new Map();
  }

  /**
   * Obtém um seletor funcional para o ID especificado.
   * Tenta cada seletor na cadeia de fallback até encontrar um que funcione.
   * 
   * @param selectorId ID do seletor (ex: "conversationPanel")
   * @returns Seletor CSS funcional ou null se nenhum funcionar
   */
  async getSelector(selectorId: string): Promise<string | null> {
    // Verificar cache primeiro
    const cached = this.cache.get(selectorId);
    if (cached) {
      // Validar se cache ainda é válido
      const isValid = await this.validateSelector(selectorId, cached);
      if (isValid) {
        return cached;
      }
      // Cache inválido, remover
      this.cache.delete(selectorId);
    }

    // Buscar definição do seletor
    const definition = this.config.selectors[selectorId];
    if (!definition) {
      console.warn(`Mettri: Seletor "${selectorId}" não encontrado na configuração`);
      return null;
    }

    // Tentar cada seletor na cadeia de fallback
    for (const selector of definition.selectors) {
      const isValid = await this.validateSelector(selectorId, selector);
      if (isValid) {
        // Cachear seletor funcional
        this.cache.set(selectorId, selector);
        return selector;
      }
    }

    // Nenhum seletor funcionou
    console.warn(`Mettri: Todos os seletores para "${selectorId}" estão quebrados`);
    return null;
  }

  /**
   * Valida se um seletor CSS encontra elementos no DOM.
   * 
   * @param selectorId ID do seletor (para contexto)
   * @param selector Seletor CSS a validar
   * @returns true se o seletor encontra pelo menos um elemento
   */
  async validateSelector(selectorId: string, selector: string): Promise<boolean> {
    // Verificar cache de validação
    const cacheKey = `${selectorId}:${selector}`;
    const cached = this.validationCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    try {
      // Tentar encontrar elemento no DOM
      const element = document.querySelector(selector);
      const isValid = element !== null;

      // Cachear resultado
      this.validationCache.set(cacheKey, isValid);

      return isValid;
    } catch (error) {
      // Seletor CSS inválido
      console.warn(`Mettri: Seletor CSS inválido para "${selectorId}": ${selector}`, error);
      this.validationCache.set(cacheKey, false);
      return false;
    }
  }

  /**
   * Detecta quais seletores estão quebrados.
   * 
   * @returns Array de IDs de seletores quebrados
   */
  async detectBrokenSelectors(): Promise<string[]> {
    const broken: string[] = [];

    for (const selectorId of Object.keys(this.config.selectors)) {
      const workingSelector = await this.getSelector(selectorId);
      if (!workingSelector) {
        broken.push(selectorId);
      }
    }

    return broken;
  }

  /**
   * Atualiza um seletor na configuração.
   * 
   * @param selectorId ID do seletor a atualizar
   * @param newSelector Novo seletor CSS (será adicionado ao início da cadeia de fallback)
   */
  async updateSelector(selectorId: string, newSelector: string): Promise<void> {
    const definition = this.config.selectors[selectorId];
    if (!definition) {
      throw new Error(`Seletor "${selectorId}" não encontrado na configuração`);
    }

    // Adicionar novo seletor ao início da cadeia (maior prioridade)
    definition.selectors.unshift(newSelector);

    // Limpar caches relacionados
    this.cache.delete(selectorId);
    this.validationCache.clear(); // Limpar todo o cache de validação para forçar revalidação

    // Atualizar status
    definition.status = 'working';
    definition.lastVerified = new Date();

    console.log(`Mettri: Seletor "${selectorId}" atualizado com: ${newSelector}`);
  }

  /**
   * Obtém a definição completa de um seletor.
   * 
   * @param selectorId ID do seletor
   * @returns Definição do seletor ou null se não encontrado
   */
  getSelectorDefinition(selectorId: string): SelectorDefinition | null {
    return this.config.selectors[selectorId] || null;
  }

  /**
   * Obtém todos os IDs de seletores disponíveis.
   * 
   * @returns Array de IDs de seletores
   */
  getAllSelectorIds(): string[] {
    return Object.keys(this.config.selectors);
  }

  /**
   * Limpa todos os caches.
   * Útil quando o DOM muda significativamente.
   */
  clearCache(): void {
    this.cache.clear();
    this.validationCache.clear();
  }

  /**
   * Obtém a versão atual da configuração de seletores.
   * 
   * @returns Versão da configuração
   */
  getConfigVersion(): string {
    return this.config.version;
  }
}
