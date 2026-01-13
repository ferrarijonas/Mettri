# Plano: Alternativas de Automação para Testes

## Objetivo
Automatizar testes da extensão Chrome Mettri, mesmo com limitações de detecção de automação do WhatsApp.

## Análise de Alternativas

### Opção 1: Puppeteer Extra + Stealth Plugin + User Data Directory
**Complexidade:** Média  
**Viabilidade:** Alta  
**Esforço:** 2-3 dias

**Descrição:**
- Usar Puppeteer Extra (não Playwright)
- Plugin Stealth para disfarçar automação
- User Data Directory persistente para manter sessão WhatsApp logada

**Vantagens:**
- Pode funcionar com WhatsApp
- Sessão persistente (não precisa logar sempre)
- Implementação relativamente simples

**Desvantagens:**
- Não funciona 100% (WhatsApp pode detectar)
- Requer manutenção quando Stealth plugin atualiza

**Implementação:**
```bash
npm install puppeteer-extra puppeteer-extra-plugin-stealth
```

**Código:**
```typescript
// tests/automation/puppeteer-stealth.ts
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import os from 'os';

puppeteer.use(StealthPlugin());

const extensionPath = path.join(__dirname, '../../dist');
const userDataDir = path.join(os.tmpdir(), 'mettri-test-profile');

export async function createTestBrowser() {
  return await puppeteer.launch({
    headless: false,
    userDataDir,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--disable-blink-features=AutomationControlled',
    ],
  });
}
```

---

### Opção 2: Conectar ao Chrome Existente (CDP)
**Complexidade:** Alta  
**Viabilidade:** Média  
**Esforço:** 3-4 dias

**Descrição:**
- Usuário abre Chrome manualmente com `--remote-debugging-port=9222`
- Script conecta ao Chrome existente via CDP
- Acessa abas já abertas (incluindo WhatsApp)

**Vantagens:**
- Usa Chrome real do usuário
- Pode acessar abas existentes
- Sem barra amarela (dependendo da configuração)

**Desvantagens:**
- Requer abrir Chrome manualmente primeiro
- Configuração complexa
- Pode ainda ser detectado

**Implementação:**
```typescript
// tests/automation/cdp-connect.ts
import puppeteer from 'puppeteer';

export async function connectToExistingChrome() {
  return await puppeteer.connect({
    browserURL: 'http://localhost:9222',
  });
}
```

**Comando para usuário:**
```bash
# Windows
chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\temp\chrome-debug"

# Ou PowerShell
Start-Process chrome.exe -ArgumentList "--remote-debugging-port=9222"
```

---

### Opção 3: Criar Ferramenta Customizada
**Complexidade:** Muito Alta  
**Viabilidade:** Baixa  
**Esforço:** 1-2 semanas

**Descrição:**
- Criar ferramenta própria baseada em Chrome DevTools Protocol
- Controle total sobre flags e comportamento
- Tentar técnicas avançadas de bypass

**Desvantagens:**
- Complexidade muito alta
- Não garantido que funcione
- Manutenção pesada

---

### Opção 4: Mudar de Plataforma de Teste
**Complexidade:** Muito Alta  
**Viabilidade:** Baixa  
**Esforço:** 2-4 semanas

**Descrições:**
- **Katalon Platform:** Tem IA integrada, mas não resolve detecção WhatsApp
- **GenIA-E2ETest:** Gera testes, mas ainda usa Selenium/Playwright
- **Chrome DevTools MCP:** Específico do Cursor, não resolve problema

**Conclusão:**
Mudar de plataforma não resolve o problema fundamental (detecção de automação).

---

## Recomendação Final

### Estratégia em 3 Fases

#### Fase 1: Puppeteer Extra + Stealth + User Data (RECOMENDADO)
- **Implementar:** Puppeteer Extra com Stealth plugin
- **User Data Directory:** Persistente para manter sessão WhatsApp
- **Testar:** Se funciona com WhatsApp
- **Tempo:** 2-3 dias
- **Expectativa:** Pode funcionar 50-70% das vezes

#### Fase 2: Se Fase 1 falhar, tentar CDP
- **Implementar:** Conectar ao Chrome existente
- **Usuário:** Abre Chrome manualmente com flag
- **Script:** Conecta e testa
- **Tempo:** 3-4 dias
- **Expectativa:** Funciona, mas requer passo manual

#### Fase 3: Aceitar limitação (Fallback)
- **Documentar:** Limitações claramente
- **Estratégia:** Teste manual para WhatsApp
- **Automação:** Apenas para validações básicas

---

## Plano de Implementação (Fase 1)

### Passo 1: Setup Puppeteer Extra
```bash
npm install puppeteer-extra puppeteer-extra-plugin-stealth
npm install --save-dev @types/node
```

### Passo 2: Criar estrutura de testes
```
tests/
  automation/
    puppeteer-stealth.ts  # Setup browser
    whatsapp-test.ts      # Teste específico WhatsApp
    helpers.ts            # Utilitários
```

### Passo 3: Implementar teste básico
- Abrir WhatsApp Web
- Verificar se carrega (não fica no spinner)
- Verificar se extensão está ativa
- Testar funcionalidade básica

### Passo 4: Testar e validar
- Executar múltiplas vezes
- Verificar taxa de sucesso
- Documentar limitações

---

## Decisão Necessária

**Qual opção implementar?**

1. **Puppeteer Extra + Stealth** (Recomendado - começar aqui)
2. **CDP Connect** (Alternativa - mais complexa)
3. **Aceitar limitação** (Fallback - teste manual)

**Recomendação:** Começar com Opção 1 (Puppeteer Extra), testar por 2-3 dias, se não funcionar, considerar Opção 2 ou aceitar limitação.