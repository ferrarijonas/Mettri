/**
 * Teste do RAG fonte com IndexedDB real no navegador.
 * Abre Chrome com a extensão carregada e a página rag-test.html.
 */
import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.join(__dirname, '../../dist');
const userDataDir = path.join(os.tmpdir(), 'mettri-rag-e2e');

test.describe('RAG fonte (IndexedDB real)', () => {
  test('fonte com banco real no navegador', async () => {
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker', { timeout: 10000 });
    }
    const extensionId = serviceWorker.url().split('/')[2];

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/rag-test.html`);

    const result = page.locator('#result');
    await expect(result).toHaveAttribute('data-status', 'ok', { timeout: 15000 });
    await expect(result).toContainText('OK');

    await context.close();
  });
});
