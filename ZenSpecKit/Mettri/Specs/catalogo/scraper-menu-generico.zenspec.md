---
status: obsoleto
---

# Scraper de Menu Genérico (`menuScraper`)

Esta feature existe para que o sistema consiga extrair produtos de cardápios online de forma genérica, detectando automaticamente a plataforma e usando a estratégia de extração mais adequada.

---

## Conceito

`menuScraper` recebe uma URL de cardápio, detecta a plataforma, extrai os produtos disponíveis e retorna dados estruturados para sincronização com o catálogo Mettri.

É uma camada de abstração que permite sincronizar com qualquer fornecedor de cardápio: MenuDino, iFood, UberEats, Toast, ou sites genéricos.

Panorama: [spec.md](spec.md).

---

## Lógica

### Linha do fluxo

```
url do cardápio  →  menuScraper  →  produtos extraídos
```

### Contrato

**Entrada**

- `input`: `MenuScraperInput`
  - `url: string`
  - `options?: MenuScraperOptions`
    - `cacheTtlMinutes?: number` (padrão: 15)
    - `forceRefresh?: boolean` (padrão: false)

**Saída**

- `saida`: `MenuScraperOutput`
  - `products: ScrapedProduct[]`
  - `platform: PlatformType`
  - `scrapedAt: string` (ISO)
  - `sourceUrl: string`
  - `confidence: number` (0-1)

**Erros**

- `INVALID_URL` -> URL inválida ou não acessível.
- `PLATFORM_UNSUPPORTED` -> plataforma não suportada.
- `EXTRACTION_FAILED` -> falha ao extrair produtos.
- `TIMEOUT` -> tempo agotado (>30s).

### Plataformas Suportadas

| Platform | Tipo | Estratégia |
|-----------|------|--------------|
| `menudino` | plataforma | API → HTML → Puppeteer |
| `ifood` | marketplace | API → HTML |
| `ubereats` | marketplace | API → HTML |
| `toast` | POS | API (documentada) |
| `square` | POS | API (documentada) |
| `generic` | site qualquer | HTML → Puppeteer |

### Estratégia em Cascata

Cada plataforma tenta abordagens em ordem:

1. **API** (se disponível e descoberta)
2. **HTML** (parse de server-side render)
3. **Puppeteer** (render JS - último recurso)

### Detecção de Plataforma

| Método | Como funciona |
|--------|---------------|
| Por URL | DOMÍNIO (ex: `menudino.com`) |
| Por conteúdo | HTML meta tags, scripts |

### Normalização de Dados

Todos os scrapers retornam o mesmo formato:

```typescript
interface ScrapedProduct {
  nome: string;
  precoCentavos: number;
  disponivel: boolean;
  sku?: string;
  categoria?: string;
  descricao?: string;
  imagemUrl?: string;
  confidence: number; // 0-1
}
```

### Regras

- **Se** cache válido **então** retorna dados em cache.
- **Se** `forceRefresh = true` **então** ignora cache.
- **Se** platform não detectada **então** usa `generic`.
- **Se**extraction falha **então** tenta próximo método.
- **Se** todos métodos falham **então** falha com `EXTRACTION_FAILED`.

### Cache

- TTL configurável (padrão: 15 minutos)
- Armazena: JSON.stringify(products), platform, timestamp
- Chave: hash da URL

### Edge cases (Se X -> Y)

- Site retorna 404 → `INVALID_URL`.
- Site bloqueia → tenta Puppeteer.
- Timeout parcial → retorna produtos extraídos até o erro.
- Página vazia → retorna `[]` com confidence 0.

### Critérios de aceitação

- Detecta corretamente MenuDino, iFood, UberEats, Toast.
- Retorna formato consistente para todas plataformas.
- Cache respeita TTL configurado.
- Fallback para generic funciona (Puppeteer).

### Escopo fora

- Escrita em múltiplas plataformas.
- OCR de imagens (futuro).

---

## Interface (painel Mettri)

### Debug

- Campo: URL para testar
- Botão: "Extrair"
- Resultado: lista de produtos com platform detectada

---

## ZenSpecs relacionadas

| Programa | Relação |
|----------|----------|
| `sincronizarCatalogoComSite` | Usa `menuScraper` como dependência |
| `catalogoPanelOrchestrator` | Orquestra sync com site |