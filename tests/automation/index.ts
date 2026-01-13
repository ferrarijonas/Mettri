#!/usr/bin/env node

import { connectToChrome, findPageByURL, waitForPage } from './cdp-browser.js';
import { LogCollector, createLogCollector } from './log-collector.js';
import { runWhatsAppTests } from './whatsapp-tests.js';
import * as fs from 'fs';
import * as path from 'path';

const REPORTS_DIR = path.join(process.cwd(), 'tests', 'results', 'reports');

/**
 * Garante que o diretório de relatórios existe
 */
function ensureReportsDir(): void {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

/**
 * Salva relatório de testes em JSON
 */
function saveReport(report: any): string {
  ensureReportsDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `report-${timestamp}.json`;
  const filepath = path.join(REPORTS_DIR, filename);

  fs.writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`📄 Relatório salvo: ${filepath}`);

  return filepath;
}

/**
 * Função principal
 */
async function main() {
  console.log('🚀 Iniciando testes automatizados via CDP\n');

  let connectedBrowser;

  try {
    // 1. Conectar ao Chrome
    console.log('1️⃣ Conectando ao Chrome...');
    connectedBrowser = await connectToChrome();
    const { browser } = connectedBrowser;

    // 2. Encontrar aba do WhatsApp Web
    console.log('2️⃣ Procurando aba do WhatsApp Web...');
    let page = await findPageByURL(browser, 'web.whatsapp.com');

    if (!page) {
      console.log('⚠️ Aba do WhatsApp Web não encontrada. Aguardando...');
      page = await waitForPage(browser, 'web.whatsapp.com', 30000);
    }

    // 3. Configurar coletor de logs
    console.log('3️⃣ Configurando coleta de logs...');
    const logCollector = createLogCollector();
    logCollector.startCollecting(page);

    // 4. Executar testes
    console.log('4️⃣ Executando testes...\n');
    const testResults = await runWhatsAppTests(page, logCollector);

    // 5. Salvar relatório
    console.log('5️⃣ Salvando relatório...');
    const reportPath = saveReport(testResults);

    // 6. Finalizar
    logCollector.stopCollecting();

    console.log('\n✅ Testes concluídos!\n');
    console.log(`📊 Resumo: ${testResults.summary.passed}/${testResults.summary.total} testes passaram`);
    console.log(`📄 Relatório: ${reportPath}\n`);

    // Exit code baseado no resultado
    process.exit(testResults.summary.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Erro durante execução dos testes:');
    console.error(error);

    if (connectedBrowser) {
      await connectedBrowser.close();
    }

    process.exit(1);
  } finally {
    if (connectedBrowser) {
      await connectedBrowser.close();
    }
  }
}

// Executar se for chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
}

export { main };
