import { Page, ConsoleMessage } from 'puppeteer-core';
import * as fs from 'fs';
import * as path from 'path';

const RESULTS_DIR = path.join(process.cwd(), 'tests', 'results', 'logs');

export interface LogEntry {
  timestamp: string;
  type: 'log' | 'error' | 'warning' | 'info' | 'debug';
  message: string;
  location?: string;
}

/**
 * Garante que o diretório de resultados existe
 */
function ensureResultsDir(): void {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

/**
 * Gera nome de arquivo de log com timestamp
 */
function generateLogFilename(prefix: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}-${timestamp}.json`;
}

/**
 * Coletor de logs do console
 */
export class LogCollector {
  private logs: LogEntry[] = [];
  private page: Page | null = null;

  /**
   * Inicia a coleta de logs de uma página
   */
  startCollecting(page: Page): void {
    this.page = page;
    this.logs = [];

    page.on('console', (msg: ConsoleMessage) => {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        type: this.mapConsoleType(msg.type()),
        message: msg.text(),
        location: this.formatLocation(msg.location()),
      };
      this.logs.push(logEntry);
    });

    page.on('pageerror', (error: Error) => {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        type: 'error',
        message: error.message,
        location: error.stack,
      };
      this.logs.push(logEntry);
    });
  }

  /**
   * Para a coleta de logs
   */
  stopCollecting(): void {
    // Os listeners são automaticamente removidos quando a página fecha
    this.page = null;
  }

  /**
   * Retorna os logs coletados
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Salva os logs em arquivo JSON
   */
  async saveLogs(name: string): Promise<string> {
    ensureResultsDir();

    const filename = generateLogFilename(name);
    const filepath = path.join(RESULTS_DIR, filename);

    try {
      fs.writeFileSync(filepath, JSON.stringify(this.logs, null, 2), 'utf-8');
      console.log(`📝 Logs salvos: ${filepath} (${this.logs.length} entradas)`);
      return filepath;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`❌ Erro ao salvar logs: ${errorMessage}`);
    }
  }

  /**
   * Limpa os logs coletados
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Mapeia tipo do console do Puppeteer para tipo interno
   */
  private mapConsoleType(type: string): LogEntry['type'] {
    switch (type) {
      case 'log':
        return 'log';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      case 'debug':
        return 'debug';
      default:
        return 'log';
    }
  }

  /**
   * Formata localização do log
   */
  private formatLocation(location?: { url?: string; lineNumber?: number; columnNumber?: number }): string | undefined {
    if (!location) return undefined;

    const parts: string[] = [];
    if (location.url) {
      parts.push(location.url);
    }
    if (location.lineNumber !== undefined) {
      parts.push(`L${location.lineNumber}`);
    }
    if (location.columnNumber !== undefined) {
      parts.push(`C${location.columnNumber}`);
    }

    return parts.length > 0 ? parts.join(':') : undefined;
  }
}

/**
 * Cria e configura um coletor de logs
 */
export function createLogCollector(): LogCollector {
  return new LogCollector();
}
