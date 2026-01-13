# Tech Stack — METTRI
> **Versão:** 1.0.0 | **Última atualização:** Janeiro 2026  
> **Decisão arquitetural:** Extensão Chrome + Playwright para testes + Backend leve

---

## 1. Visão Geral

### 1.1 Filosofia

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRINCÍPIOS DE STACK                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. CLIENT-FIRST: Máximo no navegador, mínimo no servidor      │
│  2. TYPESCRIPT: Type safety em todo código novo                 │
│  3. PLAYWRIGHT: IA pode testar e verificar automaticamente     │
│  4. MODULAR: Trocar partes sem quebrar o todo                  │
│  5. ESCALÁVEL: Arquitetura para 100k, foco em 10               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Diagrama de Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AMBIENTE DE PRODUÇÃO                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         NAVEGADOR (Chrome)                          │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │                    WhatsApp Web                             │   │   │
│  │  │  ┌───────────────────────────────────────────────────────┐  │   │   │
│  │  │  │              EXTENSÃO METTRI (TypeScript)             │  │   │   │
│  │  │  │                                                       │  │   │   │
│  │  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │  │   │   │
│  │  │  │  │ Capturer│  │ Copilot │  │   CRM   │  │   UI    │  │  │   │   │
│  │  │  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  │  │   │   │
│  │  │  │       └─────────────┴───────────┴─────────────┘      │  │   │   │
│  │  │  │                         │                            │  │   │   │
│  │  │  │                    IndexedDB                         │  │   │   │
│  │  │  └───────────────────────────────────────────────────────┘  │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    │ HTTPS                                  │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         BACKEND (Supabase)                          │   │
│  │                                                                     │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐               │   │
│  │  │ Config  │  │ License │  │  Auth   │  │Analytics│               │   │
│  │  │ Remota  │  │Validate │  │         │  │         │               │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         AMBIENTE DE DESENVOLVIMENTO                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Playwright (Headed Mode)                         │   │
│  │                                                                     │   │
│  │  • Abre Chrome com extensão carregada                              │   │
│  │  • Navega para WhatsApp Web                                        │   │
│  │  • Executa testes E2E                                              │   │
│  │  • IA (Cursor) pode verificar resultados                           │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Stack por Camada

### 2.1 Frontend (Extensão Chrome)

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| **TypeScript** | 5.x+ | Linguagem principal |
| **Chrome Extension API** | Manifest V3 | Plataforma |
| **IndexedDB** | - | Storage local (mensagens, cache) |
| **chrome.storage** | - | Storage sync (config) |
| **Vanilla CSS** | - | Estilos (sem framework) |
| **Zod** | 3.x | Validação de dados em runtime |
| **document.elementFromPoint()** | - | Hit test para auto-mapeamento |
| **webpackChunkwhatsapp_web_client** | N/A | Interceptação de módulos WhatsApp |

**Por que Zod:**
- ✅ Zero dependências
- ✅ TypeScript-first (infere tipos automaticamente)
- ✅ Bundle pequeno (~12kb)
- ✅ Validação em runtime + compile time
- ✅ MIT License, muito estável

**Por que document.elementFromPoint() para Auto-Mapeamento:**

A API `document.elementFromPoint(x, y)` foi escolhida para hit test no sistema de auto-mapeamento:

- ✅ **Nativo do navegador**: Zero dependências, funciona imediatamente
- ✅ **Performance excelente**: Resposta em microsegundos
- ✅ **Funciona em produção**: Disponível em content scripts sem configuração extra
- ✅ **Precisão**: Retorna elemento exato em coordenadas específicas
- ✅ **Simplicidade**: API simples e direta
- ✅ **Client-first**: Alinhado com arquitetura client-first do projeto

**Limitações e Considerações:**

- ⚠️ Funciona apenas dentro do contexto da página (mesma origem)
- ⚠️ Não funciona com elementos em iframes de origem diferente
- ⚠️ Limitado ao que está visível na viewport (elementos ocultos não são detectados)
- ✅ Para o caso de uso (auto-mapeamento no WhatsApp Web), essas limitações são aceitáveis

**Uso no Auto-Mapeamento:**

```typescript
// Exemplo de uso em auto-mapeamento
const element = document.elementFromPoint(mouseX, mouseY);
if (element) {
  // Analisa elemento e gera seletor CSS
  const selector = generateSelector(element);
  // Valida seletor funciona
  const validated = validateSelector(selector);
}
```

**Estrutura de Build:**
```
src/                          # Código fonte TypeScript
├── types/                    # Definições de tipos
├── core/                     # Núcleo da extensão
├── infrastructure/           # Seletores, config remota
├── ui/                       # Interface
└── ...

dist/                         # Build compilado
├── manifest.json
├── background.js
├── content.js
└── ...
```

**Build Tools:**
| Ferramenta | Propósito |
|------------|-----------|
| **esbuild** | Bundler rápido para extensões |
| **TypeScript** | Compilação e type checking |
| **ESLint** | Linting |
| **Prettier** | Formatação |

### 2.2 Backend (Supabase)

| Tecnologia | Propósito |
|------------|-----------|
| **Supabase** | BaaS (Backend as a Service) |
| **PostgreSQL** | Banco de dados (via Supabase) |
| **Supabase Auth** | Autenticação |
| **Supabase Edge Functions** | Serverless functions |
| **Supabase Storage** | Arquivos (imagens, exports) |

**Por que Supabase:**
- ✅ Free tier generoso (50k MAU, 500MB DB)
- ✅ PostgreSQL real (não NoSQL limitado)
- ✅ Auth pronto
- ✅ Real-time subscriptions
- ✅ Edge functions (Deno)
- ✅ Self-host possível no futuro

**Estrutura:**
```
supabase/
├── migrations/               # SQL migrations
├── functions/                # Edge functions (TypeScript)
│   ├── validate-license/
│   ├── get-config/
│   └── report-error/
└── seed.sql                  # Dados iniciais
```

### 2.3 Testes (Playwright)

| Tecnologia | Propósito |
|------------|-----------|
| **Playwright** | E2E testing com extensão |
| **Vitest** | Unit tests |
| **MSW** | Mock Service Worker (mock API) |

**Configuração Playwright com Extensão:**
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    // Chrome com extensão carregada
    browserName: 'chromium',
    launchOptions: {
      args: [
        '--disable-extensions-except=./dist',
        '--load-extension=./dist',
      ],
    },
    headless: false,  // Headed para ver o que acontece
  },
});
```

**Estrutura de Testes:**
```
tests/
├── unit/                     # Vitest unit tests
│   ├── selector-manager.test.ts
│   └── message-processor.test.ts
├── e2e/                      # Playwright E2E
│   ├── message-capture.spec.ts
│   ├── suggestion-flow.spec.ts
│   └── config-update.spec.ts
└── fixtures/                 # Dados de teste
```

### 2.4 Inteligência Artificial

| Tecnologia | Propósito | Free Tier |
|------------|-----------|-----------|
| **OpenAI API** | Sugestões de resposta | Usuário usa própria key |
| **Anthropic Claude** | Fallback/alternativa | Usuário usa própria key |

**Estratégia:**
- Usuário fornece sua própria API key
- Mettri nunca armazena keys no servidor
- Keys ficam em `chrome.storage.local` (criptografado)
- Zero custo de IA para o Mettri

**Fallback Chain:**
```typescript
// src/copilot/ai-service.ts
const AI_PROVIDERS = [
  { name: 'openai', priority: 1 },
  { name: 'anthropic', priority: 2 },
  { name: 'local', priority: 3 }  // Respostas pré-definidas
];
```

**Por que não IA proprietária:**
- Custo proibitivo em escala (100k usuários = $$$)
- Usuário controla seus gastos
- Privacidade: conversas não passam por nosso servidor

---

### 2.5 DevOps

| Tecnologia | Propósito | Free Tier |
|------------|-----------|-----------|
| **GitHub Actions** | CI/CD | 2.000 min/mês |
| **GitHub Pages** | Hosting de config estática | Ilimitado |
| **Sentry** | Error tracking | 5k eventos/mês |
| **Supabase Dashboard** | Monitoring de backend | Incluído |

**Alternativas Free para Error Tracking:**

| Opção | Free Tier | Quando usar |
|-------|-----------|-------------|
| **Sentry** | 5k eventos/mês | Padrão, mais features |
| **GlitchTip** | Self-host ilimitado | Se precisar mais eventos |
| **Highlight.io** | 1k sessões/mês | Se quiser session replay |

**Pipeline CI/CD:**
```yaml
# .github/workflows/main.yml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test:unit
      
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build
      - run: npx playwright install chromium
      - run: npm run test:e2e
      
  deploy-config:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - run: |
          # Deploy selector config to GitHub Pages
          cp config/selectors.json docs/
      - uses: peaceiris/actions-gh-pages@v3
```

### 2.6 Analytics

| Tecnologia | Propósito | Free Tier |
|------------|-----------|-----------|
| **Plausible** | Analytics simples | Self-host ilimitado |
| **Umami** | Analytics self-hosted | Open source |
| **PostHog** | Product analytics | 1M eventos/mês |

**Decisão:** Começar com analytics mínimo via Supabase.

```typescript
// Analytics via Supabase (zero custo extra)
interface AnalyticsEvent {
  event: string;           // Ex: "suggestion_accepted"
  userId: string;          // Hash, não identificável
  metadata?: object;
  timestamp: Date;
}

// Eventos agregados, nunca dados pessoais
```

**Quando migrar para PostHog:**
- Quando precisar de funis de conversão
- Quando precisar de feature flags avançados
- Quando free tier do Supabase apertar

---

### 2.7 Documentação

| Tecnologia | Propósito | Free Tier |
|------------|-----------|-----------|
| **VitePress** | Docs estáticos | Open source |
| **GitHub Pages** | Hosting | Ilimitado |
| **Mintlify** | Docs bonitos | 1 projeto free |

**Decisão:** VitePress + GitHub Pages (zero custo).

```
docs/
├── .vitepress/
│   └── config.ts
├── guide/
│   ├── getting-started.md
│   ├── installation.md
│   └── troubleshooting.md
├── api/
│   └── reference.md
└── index.md
```

**Documentação Viva:**
- Changelog gerado automaticamente do Git
- Erros conhecidos documentados via issues
- Search via Algolia DocSearch (free para open source)

---

## 3. Infraestrutura de Config Remota

### 3.1 Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONFIG REMOTA FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GitHub Repo                                                    │
│  └── config/selectors.json                                      │
│           │                                                     │
│           │ push                                                │
│           ▼                                                     │
│  GitHub Actions                                                 │
│  └── deploy to GitHub Pages                                     │
│           │                                                     │
│           ▼                                                     │
│  GitHub Pages (CDN)                                             │
│  └── https://mettri4.github.io/config/selectors.json           │
│           │                                                     │
│           │ fetch (a cada 5 min)                                │
│           ▼                                                     │
│  Extensão Mettri                                                │
│  └── SelectorManager.fetchConfig()                              │
│           │                                                     │
│           ▼                                                     │
│  IndexedDB (cache)                                              │
│  └── Fallback se offline                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Estrutura do Config

```typescript
// config/selectors.json
{
  "version": "2026.01.10.1",
  "updatedAt": "2026-01-10T12:00:00Z",
  "checkInterval": 5,  // minutos
  
  "selectors": {
    "message_container": {
      "id": "message_container",
      "description": "Container de mensagem individual",
      "selectors": [
        "[data-testid=\"msg-container\"]",
        "[data-testid=\"message-container\"]",
        ".message-in, .message-out",
        "[class*=\"message\"]"
      ]
    },
    "chat_list": {
      "id": "chat_list",
      "description": "Lista de conversas",
      "selectors": [
        "[data-testid=\"chat-list\"]",
        "[aria-label*=\"Chat list\"]",
        "#pane-side"
      ]
    },
    "compose_box": {
      "id": "compose_box",
      "description": "Campo de digitação",
      "selectors": [
        "[data-testid=\"conversation-compose-box-input\"]",
        "[contenteditable=\"true\"][data-tab]",
        "footer [contenteditable=\"true\"]"
      ]
    },
    "send_button": {
      "id": "send_button",
      "description": "Botão de enviar mensagem",
      "selectors": [
        "[data-testid=\"send\"]",
        "[aria-label*=\"Send\"]",
        "button[aria-label*=\"Enviar\"]"
      ]
    }
  },
  
  "features": {
    "copilot": { "enabled": true, "rollout": 100 },
    "autoresponder": { "enabled": true, "rollout": 100 },
    "reactivation": { "enabled": false, "rollout": 0 }
  },
  
  "endpoints": {
    "api": "https://your-project.supabase.co",
    "config": "https://mettri4.github.io/config"
  }
}
```

---

## 4. Segurança e Rate Limiting

### 4.1 Rate Limiting

| Tecnologia | Propósito | Free Tier |
|------------|-----------|-----------|
| **Upstash Redis** | Rate limiting serverless | 10k req/dia |
| **Supabase RLS** | Row Level Security | Incluído |
| **Token Bucket** | Algoritmo client-side | Zero custo |

**Implementação Client-Side (Zero Custo):**
```typescript
// src/infrastructure/rate-limiter.ts
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens/segundo

  canProceed(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens--;
      return true;
    }
    return false;
  }
}

// Limites human-like para WhatsApp
const LIMITS = {
  messagesPerMinute: 3,
  scrapingPerMinute: 10,
  apiCallsPerMinute: 20,
};
```

### 4.2 Segurança de API Keys

```typescript
// Keys nunca vão para o servidor
// Armazenadas localmente com chrome.storage.local
chrome.storage.local.set({
  openai_key: encrypted(userKey),
});

// Criptografia simples com Web Crypto API
async function encrypt(text: string): Promise<string> {
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  return btoa(String.fromCharCode(...iv, ...new Uint8Array(ciphertext)));
}
```

### 4.3 Validação de Licença

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO DE VALIDAÇÃO                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Extensão                                                       │
│  └── Ação premium (ex: reativação)                             │
│           │                                                     │
│           │ POST /validate-license                              │
│           ▼                                                     │
│  Supabase Edge Function                                         │
│  └── Verifica token + plano + limites                          │
│           │                                                     │
│           │ { valid: true, features: [...] }                    │
│           ▼                                                     │
│  Extensão                                                       │
│  └── Cache resultado (5 min)                                   │
│  └── Executa ou bloqueia ação                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Proteção contra bypass:**
- Validação no servidor, nunca no client
- Token único por instalação
- Rate limiting por conta
- Features premium requerem resposta válida do servidor

---

## 5. Dependências do Projeto

### 5.1 package.json

```json
{
  "name": "mettri4",
  "version": "1.2.0",
  "type": "module",
  "scripts": {
    "dev": "esbuild --watch",
    "build": "npm run type-check && esbuild",
    "type-check": "tsc --noEmit",
    "lint": "eslint src/",
    "format": "prettier --write src/",
    "test:unit": "vitest run",
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "docs:dev": "vitepress dev docs",
    "docs:build": "vitepress build docs"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "@types/chrome": "^0.0.260",
    "esbuild": "^0.20.0",
    "eslint": "^8.56.0",
    "prettier": "^3.2.0",
    "typescript": "^5.3.0",
    "vitepress": "^1.0.0",
    "vitest": "^1.2.0"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "zod": "^3.22.0"
  }
}
```

### 5.2 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "types": ["chrome"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

---

## 6. Migração Gradual para TypeScript

### 6.1 Estratégia

```
FASE 1: Setup (agora)
├── Configurar tsconfig.json
├── Configurar esbuild
├── Manter .js existentes funcionando
└── Novos arquivos em .ts

FASE 2: Tipos (próxima sprint)
├── Criar src/types/ com interfaces
├── Tipar entidades principais
└── Usar JSDoc nos .js existentes

FASE 3: Migração (gradual)
├── Converter arquivos críticos primeiro
│   ├── selector-manager.ts
│   ├── config-manager.ts
│   └── message-capturer.ts
├── Um arquivo por PR
└── Manter testes passando

FASE 4: Completo (futuro)
├── Todos os arquivos em .ts
├── Strict mode habilitado
└── Zero "any"
```

### 6.2 Prioridade de Migração

| Prioridade | Arquivo | Razão |
|------------|---------|-------|
| 1 | `infrastructure/selector-manager.ts` | Crítico, precisa de tipos |
| 2 | `infrastructure/config-manager.ts` | Crítico, precisa de tipos |
| 3 | `core/message-capturer.ts` | Core, precisa de tipos |
| 4 | `storage/message-db.ts` | Core, precisa de tipos |
| 5 | `copilot/ai-service.ts` | Integração externa |
| ... | Resto | Gradual |

---

## 7. Custos Estimados

### 7.1 Fase MVP (0-1.000 usuários)

| Serviço | Plano | Custo/mês |
|---------|-------|-----------|
| Supabase | Free | R$ 0 |
| GitHub Pages | Free | R$ 0 |
| Sentry | Free | R$ 0 |
| Domínio | - | ~R$ 50/ano |
| **Total** | | **~R$ 5/mês** |

### 7.2 Fase Crescimento (1.000-10.000 usuários)

| Serviço | Plano | Custo/mês |
|---------|-------|-----------|
| Supabase | Pro | ~R$ 125 |
| Sentry | Team | ~R$ 130 |
| CDN (Cloudflare) | Free | R$ 0 |
| **Total** | | **~R$ 300/mês** |

### 7.3 Fase Escala (10.000-100.000 usuários)

| Serviço | Plano | Custo/mês |
|---------|-------|-----------|
| Supabase | Pro + add-ons | ~R$ 500-1.500 |
| Sentry | Business | ~R$ 400 |
| CDN | Pro | ~R$ 100 |
| Monitoring extra | - | ~R$ 200 |
| **Total** | | **~R$ 1.500-2.500/mês** |

---

## 8. Decisões Técnicas

### 8.1 Por que não React/Vue/Svelte?

**Decisão:** Manter Vanilla JS/TS para UI.

**Razão:**
- Extensão Chrome tem bundle size limit
- Performance é crítica (roda dentro do WhatsApp)
- Menos dependências = menos bugs
- UI é simples (painel lateral)

**Quando reconsiderar:**
- Se UI ficar muito complexa (muitos estados)
- Se precisar de componentes reutilizáveis demais

### 8.2 Por que esbuild e não Webpack/Vite?

**Decisão:** esbuild para bundling.

**Razão:**
- 100x mais rápido que Webpack
- Zero config para casos simples
- Suporte nativo a TypeScript
- Perfeito para extensões

### 8.3 Por que Supabase e não Firebase?

**Decisão:** Supabase como backend.

**Razão:**
- PostgreSQL real (queries SQL complexas)
- Open source (pode self-host)
- Free tier mais generoso
- Edge functions em TypeScript (não JS limitado)
- Real-time sem custo extra

### 8.4 Por que Playwright e não Puppeteer/Cypress?

**Decisão:** Playwright para E2E.

**Razão:**
- Suporte nativo a extensões Chrome
- Melhor API para automação
- Cross-browser (futuro)
- Mantido pela Microsoft (estável)
- Modo headed funciona bem

---

## 9. Ambiente de Desenvolvimento

### 9.1 Setup Local

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/mettri4.git
cd mettri4

# 2. Instale dependências
npm install

# 3. Instale Playwright browsers
npx playwright install chromium

# 4. Build da extensão
npm run build

# 5. Carregue no Chrome
# chrome://extensions → Modo desenvolvedor → Carregar sem compactação → selecione ./dist

# 6. Rode testes
npm run test:unit        # Unit tests
npm run test:e2e:headed  # E2E com browser visível
```

### 9.2 Workflow de Desenvolvimento

```
1. Crie branch: git checkout -b feature/nome-da-feature

2. Desenvolva com watch:
   npm run dev

3. Teste manualmente no Chrome:
   - Atualize extensão (chrome://extensions)
   - Teste no WhatsApp Web

4. Rode testes:
   npm run test:unit
   npm run test:e2e:headed

5. Commit e PR:
   git add .
   git commit -m "feat: descrição"
   git push origin feature/nome-da-feature

6. CI valida automaticamente:
   - Lint
   - Type check
   - Unit tests
   - E2E tests
```

---

## 10. Documentos Relacionados

| Documento | Propósito |
|-----------|-----------|
| `project_concept.md` | Visão conceitual |
| `project_context.md` | Especificações detalhadas |
| `progress.md` | Status de implementação |
| `.cursorrules` | Regras para Cursor AI |
| `CHANGELOG.md` | Histórico de versões |

---

> **Este documento define a stack técnica do Mettri.**  
> Atualize quando houver mudanças significativas em tecnologias ou arquitetura.
