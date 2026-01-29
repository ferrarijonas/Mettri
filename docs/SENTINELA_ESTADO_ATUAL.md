# 🛡️ Sentinela - Estado Atual e Decisões Arquiteturais

> **Sentinela**: A parte física da extensão que interage diretamente com o WhatsApp Web. Base sólida e robusta para todas as funcionalidades futuras.

---

## 📋 Índice

1. [Contexto e Origem](#contexto-e-origem)
2. [Decisões Arquiteturais](#decisões-arquiteturais)
3. [Estado Atual da Implementação](#estado-atual-da-implementação)
4. [Referência e Aprendizados](#referência-e-aprendizados)
5. [O Que Falta Implementar](#o-que-falta-implementar)
6. [Estratégia de Robustez](#estratégia-de-robustez)

---

## 🎯 Contexto e Origem

### O Problema Inicial

A extensão precisava capturar mensagens do WhatsApp Web, mas enfrentava um desafio fundamental: **isolamento de contexto** entre content scripts e a página.

- Content scripts por padrão executam em contexto isolado
- Não têm acesso direto ao `window` da página
- WhatsApp Web usa bundlers internos (Webpack/Comet) que não são acessíveis em contexto isolado

### A Solução: `world: "MAIN"`

**Decisão:** Usar `world: "MAIN"` no Manifest V3 para executar content scripts no contexto da página.

**Por quê:**
- Permite acesso direto ao `window.require` e `window.webpackChunkwhatsapp_web_client`
- Não requer injeção manual de scripts
- Mais simples e direto que alternativas

**Implementação:**
```json
// manifest.json
"content_scripts": [
  {
    "matches": ["https://web.whatsapp.com/*"],
    "js": ["content.js"],
    "run_at": "document_idle",
    "world": "MAIN"  // ← Chave da solução
  }
]
```

---

## 🏗️ Decisões Arquiteturais

### 1. Interceptação Webpack vs Manipulação DOM

**Escolha:** Interceptação Webpack (via módulos internos)

**Razão:**
- Mais rápido (acesso direto à memória)
- Mais confiável (não depende de estrutura DOM)
- Funciona mesmo quando mensagens não estão visíveis
- Alinhado com referência de mercado

**Implementação:**
- `WhatsAppInterceptors`: Classe que encontra e acessa módulos internos
- `DataScraper`: Classe que escuta eventos dos módulos
- `MessageCapturer`: Classe que processa e armazena mensagens

### 2. Busca Inteligente por Características

**Problema:** Módulos podem ter nomes diferentes ou estrutura variável entre versões.

**Solução:** Busca por características (não apenas por nome).

**Exemplo:**
```typescript
// Buscar Msg por características
const msgCollection = this.find((m: any) => {
  const obj = m?.default || m;
  const hasOn = typeof obj?.on === 'function';
  const hasGet = typeof obj?.get === 'function';
  const hasModels = Array.isArray(obj?._models);
  
  return hasOn && hasGet && hasModels;
});
```

**Benefícios:**
- Funciona mesmo se WhatsApp renomear módulos
- Mais robusto que busca por nome fixo
- Permite fallback automático

### 3. Objeto `N` (Padrão da Referência)

**Decisão:** Seguir padrão da referência: `N = Object.assign({}, GroupMetadata.default)`

**Por quê:**
- Referência comprovada funcionando há anos
- Centraliza acesso a todos os módulos
- Facilita manutenção e debug

**Implementação:**
```typescript
private initializeN(): void {
  const groupMetadataModule = this.findExport('GroupMetadata');
  
  if (groupMetadataModule?.default) {
    this.N = Object.assign({}, groupMetadataModule.default);
  } else if (groupMetadataModule) {
    // Fallback: usar diretamente se não tiver .default
    this.N = Object.assign({}, groupMetadataModule);
  }
}
```

### 4. Validação com Zod

**Decisão:** Validar todos os dados interceptados com Zod antes de usar.

**Razão:**
- Garante integridade dos dados
- Detecta mudanças na estrutura do WhatsApp
- Previne erros em runtime
- Facilita debug

---

## ✅ Estado Atual da Implementação

### O Que Já Funciona

#### 1. Acesso aos Módulos Principais ✅

- **`N.Msg`**: Coleção de mensagens funcionando
- **`N.Contact`**: Coleção de contatos funcionando
- **`N.Label`**: Coleção de labels funcionando
- **`N.Chat`**: Coleção de chats (precisa validação)

**Evidência:**
```
[DEBUG] N.Msg encontrado!
[DEBUG] N.Msg tem método .on()
[DEBUG] N.Msg tem método .get()
[DEBUG] Msg getter result (N.Msg) (JSON - primeiros 1000 chars): [...]
```

#### 2. Busca Inteligente ✅

- Busca por export name (`findExport`)
- Busca por características (`find`)
- Fallback automático quando nome não funciona

#### 3. Eventos Configurados ✅

- `Msg.on('add')` - novas mensagens
- `Msg.on('change')` - mensagens modificadas
- `PresenceCollection.on('change:isOnline')` - presença
- `Chat.on('change:id')` - mudança de chat

#### 4. Validação com Zod ✅

- Schema para mensagens
- Validação antes de processar
- Logs de erro quando validação falha

### O Que Falta Implementar

Ver seção [O Que Falta Implementar](#o-que-falta-implementar) abaixo.

---

## 📚 Referência e Aprendizados

### A Referência

Encontramos uma implementação de referência (`reverse.txt`) que funciona há anos interceptando WhatsApp Web. Analisamos como ela faz:

1. **Inicialização do `N`**:
   ```javascript
   N = Object.assign({}, Ct.findExport("GroupMetadata")?.default)
   ```

2. **Busca de Módulos**:
   - Por export name: `Ct.findExport("ModuleName")`
   - Por características: `Ct.find(m => m?.default?.property === value)`

3. **Eventos**:
   - `N.Msg.on("add")` - novas mensagens
   - `N.Msg.on("change")` - mensagens modificadas
   - `N.Chat.on("change:id")` - mudança de chat
   - `N.Label.on("add remove")` - mudança de labels
   - `N.PresenceCollection.on("change:isOnline")` - presença

4. **Módulos Extras**:
   - Mais de 30 módulos adicionais (envio de mídia, comandos, etc.)
   - Seletores CSS dinâmicos (`N.Classes`)
   - Métodos auxiliares (`N.Chat._find`)

### Aprendizados

1. **Robustez desde o início**: Busca por características é essencial
2. **Fallback sempre**: Nunca depender de um único método
3. **Validação rigorosa**: Zod em todas as entradas
4. **Logs detalhados**: Facilitam debug quando algo quebra

---

## 🎯 O Que Falta Implementar

### Fase 1: Módulos Extras (Prioridade ALTA)

Todos os módulos que a referência usa (linhas 309-348 do `reverse.txt`):

1. **`N.Conn`** - Conexão
2. **`N.SendDelete`** - Deletar mensagens
3. **`N.uploadMedia`** - Enviar mídia
4. **`N.Cmd`** - Comandos (marcar lida, arquivar, etc.)
5. **`N.MediaTypes`** - Tipos de mídia
6. **`N.UserConstructor`** - Construtor de usuário
7. **`N.blockContact`** - Bloquear contato
8. **`N.UploadUtils`** - Utilitários de upload
9. **`N.DownloadManager`** - Gerenciador de download
10. **`N.QueryExist`** - Verificar se existe
11. **`N.USyncQuery` / `N.USyncUser`** - Sincronização
12. **`N.Presence`** - Presença (online/offline)
13. **`N.ChatState`** - Estado do chat (digitando, gravando)
14. **`N.createGroup`** - Criar grupo
15. **`N.getParticipants`** - Participantes do grupo
16. **`N.genMinimalLinkPreview`** - Preview de links
17. **`N.findFirstWebLink`** - Encontrar links
18. **`N.getSearchContext`** - Contexto de busca
19. **`N.sendReactionToMsg`** - Enviar reação
20. **`N.colorIndexToHex`** - Cores
21. **`N.StatusUtils`** - Status
22. **`N.Composing`** - Digitando
23. **`N.ConversationSeen`** - Visto
24. **`N.Playing`** - Tocando
25. **`N.StatusState`** - Estado de status

**Critérios de Implementação:**
- ✅ Busca robusta (por nome E por características)
- ✅ Validação de que módulo existe e funciona
- ✅ Testes unitários
- ✅ Documentação
- ✅ Logs detalhados

### Fase 2: Seletores CSS Dinâmicos (Prioridade ALTA)

**Problema:** Seletores CSS podem mudar quando WhatsApp atualiza.

**Solução:** Buscar seletores dinamicamente do webpack (como referência faz).

**Implementação:**
```typescript
// Buscar seletores do webpack (linha 349 do reverse.txt)
N.Classes = Object.entries(Ct.getModules())?.filter(
  ([t]) => t.includes(Mt("c2Nzcw==")) // "css" em base64
);

// Fallback para seletores fixos (linhas 354-367)
N.Classes = {
  recentMessages: ["_ak8k"],
  contactNames: ["_ak8q", "webp header ._ao3e", ...],
  // ... etc
};
```

**Critérios:**
- ✅ Busca dinâmica do webpack
- ✅ Fallback para seletores fixos
- ✅ Múltiplos seletores por elemento (fallback chain)
- ✅ Atualização automática quando webpack muda

### Fase 3: Métodos Auxiliares (Prioridade MÉDIA)

**Implementação:**
```typescript
// Adicionar N.Chat._find se não existir (linha 368)
N.Chat && !N.Chat._find && (N.Chat._find = t => {
  var e = N.Chat.get(t);
  return e ? Promise.resolve(e) : Promise.resolve({ id: t });
});

// Ajustar N.ChatCollection.findImpl (linha 375)
N.ChatCollection && void 0 === N.ChatCollection.findImpl && 
  void 0 !== N.ChatCollection._find && 
  (N.ChatCollection.findImpl = N.ChatCollection._find);
```

### Fase 4: Eventos Extras (Prioridade MÉDIA)

Eventos adicionais que a referência escuta:

1. **`N.Label.on("add remove")`** - Quando labels mudam
2. **`N.Msg.on("change")`** - Quando mensagem muda (ex: deletada)
3. **`N.Chat.on("change:id")`** - Quando muda de chat (já temos)
4. **`N.PresenceCollection.on("change:isOnline")`** - Presença (já temos)
5. **`N.Msg.on("add")`** - Nova mensagem (já temos)

---

## 🛡️ Estratégia de Robustez

### Princípios

1. **Nunca depender de um único método**
   - Sempre ter fallback
   - Busca por nome + busca por características

2. **Validação rigorosa**
   - Zod em todas as entradas
   - Verificar que módulos existem antes de usar

3. **Logs detalhados**
   - Facilitam debug quando algo quebra
   - Mostram exatamente o que foi encontrado

4. **Testes antes de avançar**
   - Cada módulo deve ser testado isoladamente
   - Validação antes de passar para o próximo

5. **Busca inteligente**
   - Por características, não apenas por nome
   - Funciona mesmo se WhatsApp renomear módulos

### Plano de Implementação

Ver `docs/SENTINELA_PLANO_IMPLEMENTACAO.md` para detalhes completos.

---

## 📊 Métricas de Sucesso

### Critério 1: Acesso aos Módulos
- ✅ `N.Msg`, `N.Contact`, `N.Label`, `N.Chat` funcionando
- ⏳ Todos os módulos extras implementados
- ⏳ Seletores CSS dinâmicos funcionando

### Critério 2: Eventos
- ✅ Eventos básicos funcionando
- ⏳ Todos os eventos extras implementados

### Critério 3: Robustez
- ✅ Busca por características implementada
- ✅ Validação com Zod implementada
- ⏳ Testes unitários para todos os módulos
- ⏳ Testes E2E para fluxos críticos

---

## 🚀 Próximos Passos

1. **Implementar módulos extras** (um por um, com testes)
2. **Implementar seletores CSS dinâmicos**
3. **Adicionar métodos auxiliares**
4. **Implementar eventos extras**
5. **Testes completos e validação**

Ver `docs/SENTINELA_PLANO_IMPLEMENTACAO.md` para plano detalhado.

---

**Última atualização:** 2026-01-11  
**Status:** 🟡 Em desenvolvimento - Base funcionando, módulos extras pendentes
