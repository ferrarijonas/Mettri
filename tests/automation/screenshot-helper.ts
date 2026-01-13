import { Page } from 'puppeteer-core';
import * as fs from 'fs';
import * as path from 'path';

const RESULTS_DIR = path.join(process.cwd(), 'tests', 'results', 'screenshots');

/**
 * Garante que o diretório de resultados existe
 */
function ensureResultsDir(): void {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

/**
 * Gera nome de arquivo com timestamp
 */
function generateFilename(prefix: string, extension = 'png'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}-${timestamp}.${extension}`;
}

export interface ScreenshotOptions {
  fullPage?: boolean;
  quality?: number;
  type?: 'png' | 'jpeg';
}

/**
 * Captura screenshot de uma página
 * 
 * @param page Página do Puppeteer
 * @param name Nome do screenshot (prefixo)
 * @param options Opções de screenshot
 * @returns Caminho do arquivo salvo
 */
export async function captureScreenshot(
  page: Page,
  name: string,
  options: ScreenshotOptions = {}
): Promise<string> {
  ensureResultsDir();

  const { fullPage = false, quality = 90, type = 'png' } = options;
  const filename = generateFilename(name, type);
  const filepath = path.join(RESULTS_DIR, filename);

  try {
    await page.screenshot({
      path: filepath,
      fullPage,
      type,
      ...(type === 'jpeg' && { quality }),
    });

    console.log(`📸 Screenshot salvo: ${filepath}`);
    return filepath;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`❌ Erro ao capturar screenshot: ${errorMessage}`);
  }
}

/**
 * Captura screenshot de um elemento específico
 * 
 * @param page Página do Puppeteer
 * @param selector Seletor CSS do elemento
 * @param name Nome do screenshot (prefixo)
 * @returns Caminho do arquivo salvo
 */
export async function captureElementScreenshot(
  page: Page,
  selector: string,
  name: string
): Promise<string> {
  ensureResultsDir();

  try {
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Elemento não encontrado: ${selector}`);
    }

    const filename = generateFilename(name);
    const filepath = path.join(RESULTS_DIR, filename);

    await element.screenshot({ path: filepath });

    console.log(`📸 Screenshot de elemento salvo: ${filepath}`);
    return filepath;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`❌ Erro ao capturar screenshot do elemento: ${errorMessage}`);
  }
}
