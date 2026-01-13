# 🎯 Plano: Resolver Problema de Contexto de Execução

> **Data:** 2026-01-11  
> **Objetivo:** Permitir que o Mettri acesse `window.require` e `window.webpackChunkwhatsapp_web_client` do contexto real da página do WhatsApp

---

## 📊 Diagnóstico Confirmado

**Problema:** Content scripts do Chrome executam em contexto isolado e não têm acesso ao `window` real da página onde está o bundler (Comet/Webpack).

**Evidência:**
- `hasRequire: undefined` (não `false`) → propriedade não existe no contexto do content script
- Após 120 tentativas (60s), bundler nunca é encontrado
- Extensão de referência funciona (provavelmente usa world: MAIN)

---

## 🎯 Solução: Injeção de Script na Página (World: MAIN)

### **Estratégia:**
1. Content script (`main.ts`) injeta script na página (executa no contexto da página)
2. Script injetado acessa bundler e comunica com content script via `postMessage`
3. Content script recebe dados e inicializa interceptadores

---

## 📋 Plano de Implementação (Pequenas Partes)

### **Fase 1: Criar Script Injetado (World: MAIN)** ✅

**Arquivo:** `src/infrastructure/page-injector.ts`

**Responsabilidade:**
- Criar script que executa no contexto da página (não isolado)
- Verificar disponibilidade de Comet/Webpack
- Comunicar resultados via `postMessage` para content script

**Código Base:**
```typescript
// Script que será injetado na página (executa no contexto da página)
const injectedScript = `
  (function() {
    // Este código executa no contexto da PÁGINA, não do content script
    // Portanto, tem acesso ao window.require e window.webpackChunkwhatsapp_web_client
    
    function checkBundler() {
      // Verificar Comet
      const hasComet = typeof window.require !== 'undefined' && 
                      typeof window.__d !== 'undefined';
      
      // Verificar Webpack
      const hasWebpack = typeof window.webpackChunkwhatsapp_web_client !== 'undefined' &&
                         Array.isArray(window.webpackChunkwhatsapp_web_client) &&
                         window.webpackChunkwhatsapp_web_client.length > 0;
      
      return {
        cometAvailable: hasComet,
        webpackAvailable: hasWebpack,
        timestamp: Date.now()
      };
    }
    
    // Enviar resultado para content script
    window.postMessage({
      type: 'METTRI_BUNDLER_CHECK',
      data: checkBundler()
    }, '*');
  })();
`;
```

**Teste:**
- [ ] Script injeta corretamente
- [ ] Script executa no contexto da página (verificar no console do WhatsApp)
- [ ] `postMessage` é enviado

---

### **Fase 2: Modificar Content Script para Injetar Script** ✅

**Arquivo:** `src/content/main.ts`

**Mudanças:**
1. Criar método `injectPageScript()` que injeta script na página
2. Criar listener para `window.addEventListener('message')` para receber dados do script injetado
3. Modificar `startBundlerCheck()` para usar injeção em vez de verificação direta

**Código:**
```typescript
private injectPageScript(): void {
  const script = document.createElement('script');
  script.textContent = `
    // Código do page-injector.ts aqui
  `;
  (document.head || document.documentElement).appendChild(script);
  script.remove(); // Remove após execução
}

private setupMessageListener(): void {
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'METTRI_BUNDLER_CHECK') {
      const { cometAvailable, webpackAvailable } = event.data.data;
      // Processar resultado
    }
  });
}
```

**Teste:**
- [ ] Script é injetado corretamente
- [ ] Listener recebe mensagem do script injetado
- [ ] Dados são processados corretamente

---

### **Fase 3: Integrar com WhatsAppInterceptors** ✅

**Arquivo:** `src/infrastructure/whatsapp-interceptors.ts`

**Mudanças:**
1. Modificar `isWebpackAvailable()` para receber dados do script injetado
2. Ou criar novo método que usa dados recebidos via `postMessage`

**Estratégia:**
- Script injetado verifica bundler e envia resultado
- Content script recebe e passa para `WhatsAppInterceptors`
- `WhatsAppInterceptors` usa dados recebidos em vez de verificar diretamente

**Teste:**
- [ ] `WhatsAppInterceptors` recebe dados corretos
- [ ] Inicialização funciona com dados do script injetado

---

### **Fase 4: Implementar Comunicação Bidirecional (Se Necessário)** ⚠️

**Cenário:** Se precisarmos acessar módulos do bundler do content script

**Solução:**
- Script injetado expõe funções no `window` da página
- Content script usa `postMessage` para solicitar execução de código no contexto da página
- Script injetado executa e retorna resultado via `postMessage`

**Exemplo:**
```typescript
// Script injetado
window.__mettriExecute = function(code: string) {
  return eval(code); // Executa no contexto da página
};

// Content script
function executeInPage(code: string): Promise<any> {
  return new Promise((resolve) => {
    const id = Math.random().toString(36);
    window.addEventListener('message', function handler(event) {
      if (event.data?.type === 'METTRI_EXECUTE_RESULT' && 
          event.data.id === id) {
        window.removeEventListener('message', handler);
        resolve(event.data.result);
      }
    });
    
    window.postMessage({
      type: 'METTRI_EXECUTE',
      id,
      code
    }, '*');
  });
}
```

**Teste:**
- [ ] Comunicação bidirecional funciona
- [ ] Execução de código no contexto da página funciona
- [ ] Resultados são retornados corretamente

---

### **Fase 5: Refatorar para Usar World: MAIN (Manifest V3)** 🎯

**Arquivo:** `manifest.json`

**Mudança:**
Manifest V3 suporta `world: "MAIN"` para content scripts (Chrome 95+).

**Código:**
```json
{
  "content_scripts": [
    {
      "matches": ["https://web.whatsapp.com/*"],
      "js": ["content.js"],
      "css": ["panel.css"],
      "run_at": "document_idle",
      "world": "MAIN"  // ← Executa no contexto da página
    }
  ]
}
```

**Vantagem:**
- Mais simples que injeção manual
- Acesso direto ao `window` da página
- Menos código de comunicação

**Desvantagem:**
- Requer Chrome 95+ (não é problema, WhatsApp Web já requer Chrome moderno)
- Código executa no contexto da página (pode conflitar com código da página)

**Teste:**
- [ ] Manifest aceita `world: "MAIN"`
- [ ] Content script tem acesso ao `window` real
- [ ] Bundler é encontrado corretamente

---

## 🔄 Ordem de Implementação Recomendada

### **Opção A: Solução Rápida (Recomendada)**
1. ✅ **Fase 5** (World: MAIN) - Mais simples, menos código
2. Se não funcionar → Fase 1-4 (Injeção manual)

### **Opção B: Solução Robusta**
1. ✅ **Fase 1-2** (Injeção manual) - Funciona em todos os casos
2. ✅ **Fase 3** (Integração)
3. ✅ **Fase 4** (Se necessário)

---

## 📝 Checklist de Validação

### **Teste 1: Verificar Contexto**
- [ ] Abrir WhatsApp Web no Chrome
- [ ] Abrir Console (F12)
- [ ] Executar: `typeof window.require` → deve retornar `"function"` ou `"object"`
- [ ] Executar: `typeof window.webpackChunkwhatsapp_web_client` → deve retornar `"object"`

### **Teste 2: Verificar Injeção**
- [ ] Carregar extensão
- [ ] Verificar no console se script injetado executa
- [ ] Verificar se `postMessage` é enviado

### **Teste 3: Verificar Comunicação**
- [ ] Verificar se content script recebe mensagem
- [ ] Verificar se dados estão corretos
- [ ] Verificar se `WhatsAppInterceptors` inicializa

### **Teste 4: Verificar Funcionalidade**
- [ ] Verificar se bundler é encontrado
- [ ] Verificar se módulos são extraídos
- [ ] Verificar se interceptação de mensagens funciona

---

## 🚨 Riscos e Mitigações

### **Risco 1: Conflito com Código da Página**
**Mitigação:** Usar namespaces únicos (`window.__mettri_*`)

### **Risco 2: CSP (Content Security Policy) Bloqueia Injeção**
**Mitigação:** Usar `world: "MAIN"` em vez de injeção manual

### **Risco 3: Timing - Script Injetado Executa Antes do Bundler**
**Mitigação:** Manter polling/retry no script injetado

### **Risco 4: Chrome Versão Antiga**
**Mitigação:** Verificar versão mínima do Chrome (95+)

---

## 📊 Métricas de Sucesso

### **Critério 1: Bundler Encontrado**
- ✅ `cometAvailable: true` OU `webpackAvailable: true`
- ✅ Em menos de 10 segundos (não 60 segundos)

### **Critério 2: Módulos Extraídos**
- ✅ `WhatsAppInterceptors.initialize()` não lança erro
- ✅ Módulos são encontrados (Msg, ChatCollection, etc.)

### **Critério 3: Interceptação Funciona**
- ✅ Mensagens são capturadas em tempo real
- ✅ Eventos são interceptados corretamente

---

## 🎯 Próximos Passos Imediatos

1. **Testar no Console do WhatsApp:**
   ```javascript
   console.log('require:', typeof window.require);
   console.log('webpack:', typeof window.webpackChunkwhatsapp_web_client);
   ```
   Se existir → confirma que problema é contexto

2. **Implementar Fase 5 (World: MAIN):**
   - Adicionar `"world": "MAIN"` no manifest.json
   - Testar se bundler é encontrado

3. **Se não funcionar, implementar Fase 1-2:**
   - Criar `page-injector.ts`
   - Modificar `main.ts` para injetar script

---

## 📚 Referências

- [Chrome Extension Content Scripts Isolation](https://developer.chrome.com/docs/extensions/mv3/content_scripts/#isolated_world)
- [Chrome Extension World: MAIN](https://developer.chrome.com/docs/extensions/mv3/content_scripts/#isolated_world)
- [MDN: postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)

---

**Status:** 🟡 **Planejado - Aguardando Implementação**

**Prioridade:** 🔴 **CRÍTICA** - Bloqueador principal
