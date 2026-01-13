# Automação de Testes - Alternativas 2026

## Problema Atual
- WhatsApp detecta automação e bloqueia carregamento
- MCP browser extension não acessa Chrome real
- Playwright cria contexto separado (detectado)

## Alternativas Disponíveis

### Opção 1: Puppeteer Extra + Stealth Plugin
**Status:** Viável, requer configuração

**Vantagens:**
- Stealth plugin tenta disfarçar automação
- Pode funcionar com WhatsApp (variável)
- Integração direta com Chrome
- Pode usar user data directory (persistência)

**Desvantagens:**
- Não funciona 100% (WhatsApp pode detectar)
- Requer manutenção contínua
- Complexidade adicional

**Implementação:**
```typescript
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const browser = await puppeteer.launch({
  headless: false,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    '--user-data-dir=/path/to/persistent/profile',
  ],
});
```

### Opção 2: Chrome DevTools Protocol (CDP) Direto
**Status:** Avançado, controle total

**Vantagens:**
- Controle total sobre Chrome
- Pode usar Chrome existente (--remote-debugging-port)
- Sem barra amarela (se configurado corretamente)
- Acesso direto a abas existentes

**Desvantagens:**
- Complexidade alta
- Requer Chrome aberto manualmente primeiro
- Configuração complexa

**Implementação:**
```typescript
// Conectar ao Chrome existente
const browser = await puppeteer.connect({
  browserURL: 'http://localhost:9222',
});
```

### Opção 3: User Data Directory Persistente
**Status:** Viável, pode funcionar

**Vantagens:**
- Sessão WhatsApp já logada (persiste)
- Não precisa logar toda vez
- Mais rápido que login manual
- Menos detecção (sessão "real")

**Desvantagens:**
- Precisa logar uma vez manualmente
- Perfil isolado (não compartilha com Chrome normal)
- Ainda pode detectar automação

**Implementação:**
```typescript
const userDataDir = path.join(os.tmpdir(), 'mettri-test-profile');

const browser = await puppeteer.launch({
  headless: false,
  userDataDir,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});
```

### Opção 4: Cypress + Chrome Extension Support
**Status:** Limitado, não recomendado

**Cypress não suporta extensões Chrome nativamente.**

### Opção 5: TestCafe
**Status:** Limitado

**TestCafe tem suporte limitado a extensões Chrome.**

### Opção 6: Selenium + ChromeDriver
**Status:** Funcional, mas obsoleto

**Vantagens:**
- Funciona, mas detecção de automação
- Padrão antigo da indústria

**Desvantagens:**
- Mais fácil de detectar que Playwright
- WebDriver protocol é detectável

### Opção 7: Scripts Customizados + Chrome Flags
**Status:** Controle total

**Vantagens:**
- Controle total
- Pode tentar flags experimentais
- Flexibilidade máxima

**Desvantagens:**
- Complexidade muito alta
- Manutenção difícil
- Pode não funcionar

**Flags Experimentais:**
```bash
--disable-blink-features=AutomationControlled
--exclude-switches=enable-automation
--disable-dev-shm-usage
--no-first-run
--no-default-browser-check
--disable-infobars
```

---

## Recomendação por Prioridade

### 1. **User Data Directory + Playwright/Puppeteer** (RECOMENDADO)
- Balance entre viabilidade e funcionalidade
- Sessão persistente = menos detecção
- Implementação relativamente simples

### 2. **Puppeteer Extra + Stealth**
- Tenta disfarçar automação
- Pode funcionar temporariamente
- Requer atualizações constantes

### 3. **CDP Direto (Chrome Existente)**
- Usa Chrome real do usuário
- Precisa abrir Chrome manualmente primeiro
- Controle total, mas complexo

---

## Estratégia Híbrida (Recomendada)

```typescript
// Fluxo híbrido:
1. Desenvolvimento: Chrome normal manual (teste real)
2. Testes automatizados básicos: Playwright (valida estrutura)
3. Testes de integração: User Data Directory + Stealth (tenta WhatsApp)
4. Validação final: Chrome normal manual (sempre)
```

---

## Limitações Fundamentais

**WhatsApp SEMPRE vai detectar automação se:**
- Chrome for aberto via script
- DevTools Protocol for usado
- WebDriver protocol for usado
- Flags de automação estiverem presentes

**Única forma 100% garantida:**
- Chrome normal aberto manualmente
- Extensão carregada manualmente
- Teste manual

---

## Decisão

Baseado em **Lean/TPS - Just-in-Time**:
- Não gastar tempo em soluções que podem não funcionar
- Focar no que funciona (teste manual)
- Automação apenas para validações básicas (não WhatsApp)

**Mas se usuário quer automação:**
- Implementar User Data Directory + Stealth
- Testar e validar funcionamento
- Documentar limitações claramente