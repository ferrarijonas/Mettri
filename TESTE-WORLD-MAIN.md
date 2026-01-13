# 🧪 Teste: World MAIN - Acesso ao Contexto da Página

## ✅ O Que Foi Implementado

1. **Adicionado `"world": "MAIN"` no `manifest.json`**
   - Content script agora executa no contexto da página (não isolado)
   - Tem acesso direto ao `window.require` e `window.webpackChunkwhatsapp_web_client`

2. **Adicionado log de inicialização**
   - Log confirma que está executando no contexto MAIN

## 🧪 Como Testar

### Passo 1: Recarregar a Extensão

1. Abra `chrome://extensions/`
2. Encontre a extensão "Mettri"
3. Clique no ícone de **recarregar** (🔄) para aplicar as mudanças do manifest

### Passo 2: Abrir WhatsApp Web

1. Abra `https://web.whatsapp.com` no Chrome
2. Faça login normalmente
3. Abra o Console do Desenvolvedor (F12 → Console)

### Passo 3: Verificar Logs

**Logs Esperados:**

```
[METTRI] Inicializando no contexto MAIN (acesso ao window da página)
[DEBUG] Attempt 1: { ... }
```

**O que procurar:**

1. ✅ **Log de inicialização aparece** → Confirma que está no contexto MAIN
2. ✅ **`hasRequire: true` ou `webpackAvailable: true`** → Bundler encontrado!
3. ✅ **`cometAvailable: true` OU `webpackAvailable: true`** → Sistema funcionando

### Passo 4: Verificar no Console do WhatsApp

Execute no console do WhatsApp (F12):

```javascript
// Verificar se window.require existe
console.log('window.require:', typeof window.require);
console.log('window.__d:', typeof window.__d);
console.log('webpackChunk:', typeof window.webpackChunkwhatsapp_web_client);
```

**Resultado Esperado:**
- `window.require`: `"function"` ou `"object"`
- `window.__d`: `"function"` ou `"object"`
- `webpackChunk`: `"object"` (se for array)

### Passo 5: Verificar Se Bundler Foi Encontrado

**Sucesso se:**
- ✅ Log mostra `cometAvailable: true` OU `webpackAvailable: true`
- ✅ Log mostra `[DEBUG] Bundler found!`
- ✅ Log mostra `Mettri: WhatsAppInterceptors inicializado com sucesso`
- ✅ Mensagens começam a ser capturadas

**Falha se:**
- ❌ Após 60 segundos, ainda mostra `webpackAvailable: false` e `cometAvailable: false`
- ❌ Log mostra `Timeout reached`
- ❌ Nenhuma mensagem é capturada

---

## 🔍 Diagnóstico

### Se Funcionou ✅

- Bundler foi encontrado em menos de 10 segundos
- Módulos são extraídos corretamente
- Interceptação de mensagens funciona

**Próximo passo:** Validar que interceptação de mensagens funciona em tempo real

### Se NÃO Funcionou ❌

**Possíveis causas:**

1. **Chrome versão antiga (< 95)**
   - Verificar: `chrome://version/`
   - Solução: Atualizar Chrome

2. **Manifest não foi recarregado**
   - Verificar: Recarregar extensão novamente
   - Verificar: Fechar e reabrir WhatsApp Web

3. **World: MAIN não é suportado**
   - Verificar: Chrome DevTools → Console → Erros
   - Solução: Implementar injeção manual (Fase 1-4 do plano)

**Se não funcionar, próxima ação:**
- Implementar Fase 1-4 do plano (injeção manual via `document.createElement('script')`)

---

## 📊 Métricas de Sucesso

### Critério 1: Bundler Encontrado
- ✅ `cometAvailable: true` OU `webpackAvailable: true`
- ✅ Em menos de 10 segundos (não 60 segundos)

### Critério 2: Módulos Extraídos
- ✅ `WhatsAppInterceptors.initialize()` não lança erro
- ✅ Log mostra `Mettri: WhatsAppInterceptors inicializado com sucesso`

### Critério 3: Interceptação Funciona
- ✅ Mensagens são capturadas em tempo real
- ✅ Eventos são interceptados corretamente

---

## 🚨 Troubleshooting

### Erro: "world is not a valid property"
- **Causa:** Chrome versão antiga
- **Solução:** Atualizar Chrome para versão 95+

### Erro: "Cannot read property 'require' of undefined"
- **Causa:** Ainda está no contexto isolado
- **Solução:** Verificar se manifest foi recarregado corretamente

### Bundler não encontrado após 10 segundos
- **Causa:** Pode ser timing ou world: MAIN não funcionou
- **Solução:** Implementar injeção manual (Fase 1-4)

---

**Status:** 🟡 **Aguardando Teste**

**Próximo passo após teste:**
- Se funcionou → Validar interceptação
- Se não funcionou → Implementar injeção manual
