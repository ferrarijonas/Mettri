/**
 * TestConfig
 * 
 * Gerencia configuração de testes, especialmente o número de teste salvo.
 */

export class TestConfig {
  private static readonly STORAGE_KEY = 'mettri_test_number';

  /**
   * Salva número de teste no chrome.storage.local ou localStorage como fallback
   */
  async saveTestNumber(phone: string): Promise<void> {
    try {
      const trimmedPhone = phone.trim();
      
      // Tentar chrome.storage primeiro (se disponível)
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          [TestConfig.STORAGE_KEY]: trimmedPhone
        });
        console.log(`[TEST] Número de teste salvo no chrome.storage: ${trimmedPhone}`);
      } else {
        // Fallback para localStorage (contexto MAIN)
        localStorage.setItem(TestConfig.STORAGE_KEY, trimmedPhone);
        console.log(`[TEST] Número de teste salvo no localStorage: ${trimmedPhone}`);
      }
    } catch (error: any) {
      console.error('[TEST] Erro ao salvar número de teste:', error);
      // Tentar localStorage como fallback
      try {
        localStorage.setItem(TestConfig.STORAGE_KEY, phone.trim());
        console.log(`[TEST] Número salvo no localStorage (fallback): ${phone}`);
      } catch (fallbackError) {
        throw new Error(`Erro ao salvar: ${error?.message || 'Erro desconhecido'}`);
      }
    }
  }

  /**
   * Carrega número de teste salvo
   */
  async getTestNumber(): Promise<string | null> {
    try {
      // Tentar chrome.storage primeiro
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(TestConfig.STORAGE_KEY);
        const phone = result[TestConfig.STORAGE_KEY];
        if (phone) {
          return String(phone);
        }
      }
      
      // Fallback para localStorage
      const phone = localStorage.getItem(TestConfig.STORAGE_KEY);
      return phone ? String(phone) : null;
    } catch (error) {
      console.error('[TEST] Erro ao carregar número de teste:', error);
      // Tentar localStorage como fallback
      try {
        const phone = localStorage.getItem(TestConfig.STORAGE_KEY);
        return phone ? String(phone) : null;
      } catch {
        return null;
      }
    }
  }

  /**
   * Remove número de teste salvo
   */
  async clearTestNumber(): Promise<void> {
    try {
      // Tentar chrome.storage primeiro
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.remove(TestConfig.STORAGE_KEY);
        console.log('[TEST] Número de teste removido do chrome.storage');
      }
      
      // Sempre limpar localStorage também
      localStorage.removeItem(TestConfig.STORAGE_KEY);
      console.log('[TEST] Número de teste removido do localStorage');
    } catch (error: any) {
      console.error('[TEST] Erro ao remover número de teste:', error);
      // Tentar localStorage como fallback
      try {
        localStorage.removeItem(TestConfig.STORAGE_KEY);
      } catch {
        throw new Error(`Erro ao remover: ${error?.message || 'Erro desconhecido'}`);
      }
    }
  }
}

// Instância singleton
export const testConfig = new TestConfig();
