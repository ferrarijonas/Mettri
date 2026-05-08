import puppeteer, { Browser, Page } from 'puppeteer-core';
import { connectToChrome, ConnectedBrowser } from '../../tests/automation/cdp-browser';

export type PlatformType = 
  | 'menudino' 
  | 'ifood' 
  | 'ubereats' 
  | 'toast' 
  | 'square'
  | 'generic';

export interface ScrapedProduct {
  nome: string;
  precoCentavos: number;
  disponivel: boolean;
  sku?: string;
  categoria?: string;
  descricao?: string;
  imagemUrl?: string;
  confidence: number;
}

export interface MenuScraperInput {
  url: string;
  options?: {
    cacheTtlMinutes?: number;
    forceRefresh?: boolean;
  };
}

export interface MenuScraperOutput {
  products: ScrapedProduct[];
  platform: PlatformType;
  scrapedAt: string;
  sourceUrl: string;
  confidence: number;
}

interface CacheEntry {
  products: ScrapedProduct[];
  platform: PlatformType;
  timestamp: number;
  sourceUrl: string;
}

const DEFAULT_CDP_URL = 'http://localhost:9222';
const DEFAULT_TTL_MINUTES = 15;

const PLATFORM_PATTERNS: Record<PlatformType, RegExp[]> = {
  menudino: [/menudino\.com/i, /cardapio\.menu/i],
  ifood: [/ifood\.com\.br/i, /ifood/i],
  ubereats: [/ubereats\.com/i, /ubereats/i],
  toast: [/toastpos\.com/i, /toast\.com/i],
  square: [/squareup\.com/i, /square\.com/i],
  generic: [],
};

const PRODUCT_SELECTORS: Record<PlatformType, string[]> = {
  menudino: [
    '.product-card',
    '.menu-item',
    '.prato-item',
    '[data-product]',
    '.item-product',
  ],
  ifood: [
    '.product-item',
    '.item-card',
    '[data-testid="product-item"]',
  ],
  ubereats: [
    '[data-testid="menu-item"]',
    '.u-bg',
    '.item-card',
  ],
  toast: [
    '.menu-item',
    '.product-item',
    '[data-item-id]',
  ],
  square: [
    '.item-card',
    '.menu-item',
    '[data-id]',
  ],
  generic: [
    '.product',
    '.menu-item',
    '.item',
    '[class*="product"]',
    '[class*="item"]',
  ],
};

export class MenuScraper {
  private cache: Map<string, CacheEntry> = new Map();

  async scrape(input: MenuScraperInput): Promise<MenuScraperOutput> {
    const { url, options } = input;
    const { 
      cacheTtlMinutes = DEFAULT_TTL_MINUTES, 
      forceRefresh = false 
    } = options || {};

    if (!url || !this.isValidUrl(url)) {
      throw new Error('INVALID_URL');
    }

    const cacheKey = this.getCacheKey(url);

    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && this.isCacheValid(cached, cacheTtlMinutes)) {
        return {
          products: cached.products,
          platform: cached.platform,
          scrapedAt: new Date(cached.timestamp).toISOString(),
          sourceUrl: cached.sourceUrl,
          confidence: 0.9,
        };
      }
    }

    const platform = this.detectPlatform(url);
    let products: ScrapedProduct[] = [];
    let confidence = 0;

    try {
      const result = await this.scrapeByPlatform(url, platform);
      products = result.products;
      confidence = result.confidence;
    } catch (error) {
      if (platform === 'generic') {
        throw new Error('EXTRACTION_FAILED');
      }
      
      console.warn(`⚠️ Fallback para generic após falha em ${platform}`);
      const fallback = await this.scrapeByPlatform(url, 'generic');
      products = fallback.products;
      confidence = fallback.confidence * 0.5;
    }

    const now = Date.now();
    this.cache.set(cacheKey, {
      products,
      platform,
      timestamp: now,
      sourceUrl: url,
    });

    return {
      products,
      platform,
      scrapedAt: new Date(now).toISOString(),
      sourceUrl: url,
      confidence,
    };
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private getCacheKey(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `menu_scraper_${hash}`;
  }

  private isCacheValid(entry: CacheEntry, ttlMinutes: number): boolean {
    const now = Date.now();
    const ttlMs = ttlMinutes * 60 * 1000;
    return now - entry.timestamp < ttlMs;
  }

  private detectPlatform(url: string): PlatformType {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      for (const [platform, patterns] of Object.entries(PLATFORM_PATTERNS)) {
        if (platform === 'generic') continue;
        
        for (const pattern of patterns) {
          if (pattern.test(hostname)) {
            return platform as PlatformType;
          }
        }
      }
    } catch {
      console.warn('⚠️ URL inválida para detecção');
    }

    return 'generic';
  }

  private async scrapeByPlatform(
    url: string, 
    platform: PlatformType
  ): Promise<{ products: ScrapedProduct[]; confidence: number }> {
    const strategies = [
      () => this.scrapeViaApi(url, platform),
      () => this.scrapeViaHtml(url, platform),
      () => this.scrapeViaPuppeteer(url, platform),
    ];

    for (const strategy of strategies) {
      try {
        const result = await strategy();
        if (result.products.length > 0) {
          return result;
        }
      } catch (error) {
        console.warn(`⚠️ Estratégia falhou para ${platform}:`, error);
      }
    }

    return { products: [], confidence: 0 };
  }

  private async scrapeViaApi(
    url: string, 
    platform: PlatformType
  ): Promise<{ products: ScrapedProduct[]; confidence: number }> {
    const apiEndpoints: Record<PlatformType, string | null> = {
      menudino: this.guessApiEndpoint(url, 'menudino'),
      ifood: this.guessApiEndpoint(url, 'ifood'),
      ubereats: this.guessApiEndpoint(url, 'ubereats'),
      toast: this.guessApiEndpoint(url, 'toast'),
      square: this.guessApiEndpoint(url, 'square'),
      generic: null,
    };

    const endpoint = apiEndpoints[platform];
    if (!endpoint) {
      throw new Error('PLATFORM_UNSUPPORTED');
    }

    try {
      const response = await fetch(endpoint, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; MettriBot/1.0)',
        },
      });

      if (!response.ok) {
        throw new Error(`API retornou ${response.status}`);
      }

      const data = await response.json();
      return this.normalizeApiResponse(data, platform);
    } catch (error) {
      throw new Error(`API_FAILED: ${error}`);
    }
  }

  private guessApiEndpoint(url: string, platform: PlatformType): string | null {
    try {
      const urlObj = new URL(url);
      
      switch (platform) {
        case 'menudino':
          return `https://api.menudino.com/merchants/c6109a6f-2faf-11ee-9964-0022483864db/products`;
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  private async scrapeViaHtml(
    url: string, 
    platform: PlatformType
  ): Promise<{ products: ScrapedProduct[]; confidence: number }> {
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'text/html',
          'User-Agent': 'Mozilla/5.0 (compatible; MettriBot/1.0)',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      return this.parseHtmlProducts(html, platform);
    } catch (error) {
      throw new Error(`HTML_FAILED: ${error}`);
    }
  }

  private async scrapeViaPuppeteer(
    url: string, 
    platform: PlatformType
  ): Promise<{ products: ScrapedProduct[]; confidence: number }> {
    let browser: ConnectedBrowser | null = null;

    try {
      browser = await connectToChrome({ browserURL: DEFAULT_CDP_URL });
      
      const page = await browser.browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      await this.waitForProducts(page, platform);

      const products = await this.extractProductsFromPage(page, platform);
      
      return { products, confidence: 0.7 };
    } catch (error) {
      throw new Error(`PUPPETEER_FAILED: ${error}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private async waitForProducts(page: Page, platform: PlatformType): Promise<void> {
    const selectors = PRODUCT_SELECTORS[platform];
    const timeout = 15000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      for (const selector of selectors) {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          return;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  private async extractProductsFromPage(
    page: Page, 
    platform: PlatformType
  ): Promise<ScrapedProduct[]> {
    const products: ScrapedProduct[] = [];
    const selectors = PRODUCT_SELECTORS[platform];

    for (const selector of selectors) {
      const elements = await page.$$(selector);
      
      for (const element of elements) {
        try {
          const product = await this.extractProductFromElement(element, platform);
          if (product.nome) {
            products.push(product);
          }
        } catch {
          // Elemento inválido, continua
        }
      }

      if (products.length > 0) {
        break;
      }
    }

    return products;
  }

  private async extractProductFromElement(
    element: any, 
    platform: PlatformType
  ): Promise<ScrapedProduct> {
    const nome = await this.extractText(element, [
      '[class*="name"]',
      '[class*="title"]',
      'h3',
      'h4',
    ]);

    const preco = await this.extractPrice(element, [
      '[class*="price"]',
      '[class*="valor"]',
      '[class*="preco"]',
    ]);

    const disponivel = await this.checkAvailable(element);

    return {
      nome: nome || 'Produto sem nome',
      precoCentavos: preco || 0,
      disponivel,
      confidence: 0.6,
    };
  }

  private async extractText(element: any, selectors: string[]): Promise<string> {
    for (const selector of selectors) {
      try {
        const el = await element.$(selector);
        if (el) {
          const text = await el.evaluate((e: Element) => e.textContent?.trim());
          if (text) return text;
        }
      } catch {
        // Selector não encontrado
      }
    }
    return '';
  }

  private async extractPrice(element: any, selectors: string[]): Promise<number> {
    for (const selector of selectors) {
      try {
        const el = await element.$(selector);
        if (el) {
          const text = await el.evaluate((e: Element) => e.textContent?.trim());
          if (text) {
            const cleaned = text.replace(/[^\d,\.]/g, '').replace(',', '.');
            const value = parseFloat(cleaned);
            if (!isNaN(value)) {
              return Math.round(value * 100);
            }
          }
        }
      } catch {
        // Selector não encontrado
      }
    }
    return 0;
  }

  private async checkAvailable(element: any): Promise<boolean> {
    try {
      const classes = await element.evaluate((e: Element) => e.className);
      const unavailable = ['unavailable', 'disabled', 'out-of-stock', 'esgotado'];
      
      for (const term of unavailable) {
        if (classes.toLowerCase().includes(term)) {
          return false;
        }
      }
    } catch {
      // Assume disponível se não conseguir verificar
    }
    return true;
  }

  private parseHtmlProducts(
    html: string, 
    platform: PlatformType
  ): { products: ScrapedProduct[]; confidence: number } {
    const products: ScrapedProduct[] = [];
    const selectors = PRODUCT_SELECTORS[platform];

    for (const selector of selectors) {
      const regex = this.createProductRegex(selector);
      const matches = html.match(regex);

      if (matches) {
        for (const match of matches) {
          const product = this.parseProductHtml(match, platform);
          if (product.nome) {
            products.push(product);
          }
        }
      }

      if (products.length > 0) {
        break;
      }
    }

    return { products, confidence: 0.4 };
  }

  private createProductRegex(selector: string): RegExp {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`<(?:article|div|li)[^>]*>.*?</(?:article|div|li)>`, 'gi');
  }

  private parseProductHtml(html: string, platform: PlatformType): ScrapedProduct {
    const nomeMatch = html.match(/<[^>]*(?:name|title)[^>]*>([^<]+)</i);
    const nome = nomeMatch ? nomeMatch[1].trim() : '';

    const precoMatch = html.match(/R?\$?\s*(\d+[.,]\d{2})/);
    const preco = precoMatch 
      ? Math.round(parseFloat(precoMatch[1].replace(',', '.')) * 100) 
      : 0;

    const disponivel = !html.includes('unavailable') && !html.includes('disabled');

    return {
      nome,
      precoCentavos: preco,
      disponivel,
      confidence: 0.3,
    };
  }

  private normalizeApiResponse(
    data: any, 
    platform: PlatformType
  ): { products: ScrapedProduct[]; confidence: number } {
    const products: ScrapedProduct[] = [];
    const items = data.items || data.products || data.data || [];

    for (const item of items) {
      products.push({
        nome: item.name || item.nome || item.title || '',
        precoCentavos: item.price ? Math.round(item.price * 100) : 0,
        disponivel: item.available !== false,
        sku: item.sku || item.id,
        categoria: item.category || item.categoria,
        descricao: item.description || item.descricao,
        confidence: 0.8,
      });
    }

    return { products, confidence: 0.8 };
  }

  clearCache(): void {
    this.cache.clear();
  }

  getPlatform(): PlatformType {
    return 'generic';
  }
}

export const menuScraper = new MenuScraper();

export async function scrapeMenu(input: MenuScraperInput): Promise<MenuScraperOutput> {
  const scraper = new MenuScraper();
  return scraper.scrape(input);
}