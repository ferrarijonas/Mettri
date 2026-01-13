import puppeteer, { Browser, Page } from 'puppeteer-core';

const DEFAULT_CDP_URL = 'http://localhost:9222';

export interface CDPConnectionOptions {
  browserURL?: string;
  timeout?: number;
}

export interface ConnectedBrowser {
  browser: Browser;
  close: () => Promise<void>;
}

/**
 * Conecta ao Chrome existente via Chrome DevTools Protocol (CDP)
 * 
 * Requer que o Chrome esteja rodando com --remote-debugging-port=9222
 * 
 * @param options Opções de conexão
 * @returns Browser conectado e função para fechar conexão
 */
export async function connectToChrome(
  options: CDPConnectionOptions = {}
): Promise<ConnectedBrowser> {
  const { browserURL = DEFAULT_CDP_URL, timeout = 30000 } = options;

  try {
    const browser = await puppeteer.connect({
      browserURL,
      defaultViewport: null,
    });

    // Verificar se a conexão está ativa
    const version = await browser.version();
    console.log(`✅ Conectado ao Chrome: ${version}`);

    return {
      browser,
      close: async () => {
        try {
          await browser.disconnect();
          console.log('✅ Desconectado do Chrome');
        } catch (error) {
          console.error('❌ Erro ao desconectar:', error);
        }
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        throw new Error(
          `❌ Não foi possível conectar ao Chrome. Certifique-se de que o Chrome está rodando com --remote-debugging-port=9222\n\n` +
          `Execute: npm run chrome:debug`
        );
      }
      throw new Error(`❌ Erro ao conectar ao Chrome: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Encontra uma aba do Chrome que corresponde a um padrão de URL
 * 
 * @param browser Browser conectado
 * @param urlPattern Padrão de URL para buscar (ex: 'web.whatsapp.com')
 * @returns Página encontrada ou null
 */
export async function findPageByURL(
  browser: Browser,
  urlPattern: string
): Promise<Page | null> {
  const pages = await browser.pages();

  for (const page of pages) {
    const url = page.url();
    if (url.includes(urlPattern)) {
      console.log(`✅ Aba encontrada: ${url}`);
      return page;
    }
  }

  console.log(`⚠️ Nenhuma aba encontrada com padrão: ${urlPattern}`);
  return null;
}

/**
 * Aguarda uma aba específica aparecer
 * 
 * @param browser Browser conectado
 * @param urlPattern Padrão de URL para buscar
 * @param timeout Timeout em milissegundos
 * @returns Página encontrada
 */
export async function waitForPage(
  browser: Browser,
  urlPattern: string,
  timeout = 30000
): Promise<Page> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const page = await findPageByURL(browser, urlPattern);
    if (page) {
      return page;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(
    `Timeout: Aba com padrão '${urlPattern}' não encontrada em ${timeout}ms`
  );
}
