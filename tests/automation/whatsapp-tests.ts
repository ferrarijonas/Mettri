import { Page } from 'puppeteer-core';
import { captureScreenshot, captureElementScreenshot } from './screenshot-helper.js';
import { LogCollector } from './log-collector.js';
import * as path from 'path';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  screenshot?: string;
  logs?: string;
}

export interface TestSuiteResult {
  timestamp: string;
  tests: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

/**
 * Aguarda o WhatsApp Web estar totalmente carregado
 */
async function waitForWhatsAppLoaded(page: Page, timeout = 30000): Promise<boolean> {
  try {
    // Aguarda o spinner do QR code desaparecer ou o chat aparecer
    await Promise.race([
      page.waitForSelector('[data-testid="conversation-panel-wrapper"]', { timeout }),
      page.waitForSelector('#app > div > div > div:not([aria-label*="QR"])', { timeout }),
    ]);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Teste: Verifica se a página do WhatsApp Web carregou
 */
export async function testWhatsAppLoaded(page: Page): Promise<TestResult> {
  const testName = 'whatsapp-loaded';

  try {
    const loaded = await waitForWhatsAppLoaded(page, 10000);
    
    if (!loaded) {
      await captureScreenshot(page, testName);
      return {
        name: testName,
        passed: false,
        error: 'WhatsApp Web não carregou completamente (ainda no QR code?)',
        screenshot: path.join('tests', 'results', 'screenshots', `${testName}-*.png`),
      };
    }

    await captureScreenshot(page, testName);
    return {
      name: testName,
      passed: true,
      screenshot: path.join('tests', 'results', 'screenshots', `${testName}-*.png`),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      name: testName,
      passed: false,
      error: errorMessage,
    };
  }
}

/**
 * Teste: Verifica se a extensão está carregada (procura por elementos da extensão)
 */
export async function testExtensionLoaded(page: Page): Promise<TestResult> {
  const testName = 'extension-loaded';

  try {
    // Procura por elementos que indicam que a extensão está ativa
    // Isso depende da implementação da extensão
    const extensionIndicators = [
      '[data-mettri-panel]',
      '[data-testid="mettri-panel"]',
      '.mettri-panel',
      '#mettri-panel',
    ];

    let found = false;
    for (const selector of extensionIndicators) {
      try {
        const element = await page.$(selector);
        if (element) {
          found = true;
          await captureElementScreenshot(page, selector, testName);
          break;
        }
      } catch {
        // Continue tentando outros seletores
      }
    }

    if (!found) {
      const screenshotPath = await captureScreenshot(page, testName);
      return {
        name: testName,
        passed: false,
        error: 'Extensão não parece estar carregada (nenhum indicador encontrado)',
        screenshot: screenshotPath,
      };
    }

    const screenshotPath = await captureScreenshot(page, testName);
    return {
      name: testName,
      passed: true,
      screenshot: screenshotPath,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      name: testName,
      passed: false,
      error: errorMessage,
    };
  }
}

/**
 * Teste: Coleta e verifica logs do console
 */
export async function testConsoleLogs(
  page: Page,
  logCollector: LogCollector
): Promise<TestResult> {
  const testName = 'console-logs';

  try {
    // Aguarda alguns segundos para coletar logs
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const logs = logCollector.getLogs();
    const logFilePath = await logCollector.saveLogs(testName);

    // Verifica se há erros críticos
    const errors = logs.filter((log) => log.type === 'error');
    const mettriLogs = logs.filter((log) =>
      log.message.toLowerCase().includes('mettri')
    );

    return {
      name: testName,
      passed: errors.length === 0,
      error:
        errors.length > 0
          ? `${errors.length} erro(s) encontrado(s) no console`
          : undefined,
      logs: logFilePath,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      name: testName,
      passed: false,
      error: errorMessage,
    };
  }
}

/**
 * Executa todos os testes do WhatsApp
 */
export async function runWhatsAppTests(
  page: Page,
  logCollector: LogCollector
): Promise<TestSuiteResult> {
  console.log('🧪 Iniciando testes do WhatsApp...\n');

  const results: TestResult[] = [];

  // Teste 1: WhatsApp carregou
  console.log('1️⃣ Testando se WhatsApp Web carregou...');
  results.push(await testWhatsAppLoaded(page));

  // Teste 2: Extensão carregada
  console.log('2️⃣ Testando se extensão está carregada...');
  results.push(await testExtensionLoaded(page));

  // Teste 3: Logs do console
  console.log('3️⃣ Coletando logs do console...');
  results.push(await testConsoleLogs(page, logCollector));

  // Resumo
  const summary = {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
  };

  console.log('\n📊 Resumo dos testes:');
  console.log(`   Total: ${summary.total}`);
  console.log(`   ✅ Passou: ${summary.passed}`);
  console.log(`   ❌ Falhou: ${summary.failed}\n`);

  return {
    timestamp: new Date().toISOString(),
    tests: results,
    summary,
  };
}
