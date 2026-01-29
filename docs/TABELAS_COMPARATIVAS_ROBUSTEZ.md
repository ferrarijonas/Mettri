# 📊 Tabelas Comparativas: Mettri vs WA-Sync vs WA Web Plus

## 1️⃣ INTERCEPTAÇÃO WEBPACK

| **Aspecto** | **Mettri** | **WA-Sync** | **WA Web Plus** |
|-------------|-----------|-------------|-----------------|
| **Método** | Webpack chunk injection | `window.require()` direto | Webpack chunk injection |
| **Código** | `webpackChunk.push([id], {}, factory)` | `window.require("WAWebCollections")` | `webpackChunk.push([id], {}, factory)` |
| **Fallback Comet** | ✅ Sim (`window.require` + `window.__d`) | ❌ Não | ✅ Sim |
| **Fallback importNamespace** | ✅ Sim (dentro do Comet) | ❌ Não | ✅ Sim |
| **ErrorGuard** | ✅ Sim | ❌ Não | ✅ Sim |
| **Robustez** | ⭐⭐⭐⭐ (4/5) | ⭐⭐⭐ (3/5) | ⭐⭐⭐⭐ (4/5) |
| **Risco de Quebrar** | 🟢 Baixo | 🟡 Médio | 🟢 Baixo |

**Conclusão:** Mettri = WA Web Plus (empatados) > WA-Sync

---

## 2️⃣ BUSCA POR MÓDULOS

### 2.1 Método de Busca

| **Aspecto** | **Mettri** | **WA-Sync** | **WA Web Plus** |
|-------------|-----------|-------------|-----------------|
| **Método Principal** | `findExport()` + busca genérica | `window.require()` direto | `findExport()` |
| **Busca por Nome** | ✅ `findExport("Msg")` | ✅ `require("WAWebCollections")` | ✅ `findExport("Msg")` |
| **Busca por Características** | ✅ Sim (4 estratégias) | ❌ Não | ⚠️ Parcial (alguns módulos) |
| **Estratégias por Módulo** | 3-5 estratégias | 1 estratégia | 1-2 estratégias |

### 2.2 Exemplo: Busca de Msg

| **Estratégia** | **Mettri** | **WA-Sync** | **WA Web Plus** |
|----------------|-----------|-------------|-----------------|
| **1. Objeto N** | ✅ `N.Msg` | ❌ Não usa | ✅ `N.Msg` |
| **2. GroupMetadata** | ✅ `GroupMetadata.default.Msg` | ❌ Não usa | ✅ `GroupMetadata.default.Msg` |
| **3. findExport** | ✅ `findExport("Msg")` | ❌ Não usa | ✅ `findExport("Msg")` |
| **4. Busca Genérica** | ✅ Por características (`.on()`, `.get()`, `_models`) | ❌ Não tem | ❌ Não tem |
| **5. window.Store** | ✅ `window.Store.Chat` (WA-Sync) | ✅ `window.Store.Chat` | ❌ Não usa |

**Total de Estratégias:**
- **Mettri:** 5 estratégias
- **WA-Sync:** 1 estratégia (direto)
- **WA Web Plus:** 3 estratégias

### 2.3 Robustez Busca de Módulos

| **Critério** | **Mettri** | **WA-Sync** | **WA Web Plus** |
|--------------|-----------|-------------|-----------------|
| **Estratégias** | 5 por módulo | 1 por módulo | 1-3 por módulo |
| **Busca Genérica** | ✅ Sim | ❌ Não | ⚠️ Parcial |
| **Funciona se Nome Mudar** | ✅ Sim (busca genérica) | ❌ Não | ❌ Não |
| **Robustez** | ⭐⭐⭐⭐⭐ (5/5) | ⭐⭐⭐ (3/5) | ⭐⭐⭐⭐ (4/5) |
| **Risco de Quebrar** | 🟢 Muito Baixo | 🟡 Médio | 🟢 Baixo |

**Conclusão:** Mettri > WA Web Plus > WA-Sync

---

## 3️⃣ BUSCA POR CHATS

### 3.1 Métodos de Busca

| **Aspecto** | **Mettri** | **WA-Sync** | **WA Web Plus** |
|-------------|-----------|-------------|-----------------|
| **Chat.get()** | ✅ Sim (múltiplos formatos) | ⚠️ Não usa diretamente | ✅ Sim |
| **Chat.find()** | ✅ Sim (múltiplos formatos) | ✅ Sim | ✅ Sim |
| **Chat.getActive()** | ✅ Sim (se enviando para si mesmo) | ❌ Não usa | ❌ Não usa |
| **Cmd.openChatAt()** | ✅ Sim (abre programaticamente) | ❌ Não usa | ✅ Sim |
| **Validação Propriedades** | ✅ Sim (antes de usar) | ❌ Não | ❌ Não |

### 3.2 Estratégias de Busca

| **Estratégia** | **Mettri** | **WA-Sync** | **WA Web Plus** |
|----------------|-----------|-------------|-----------------|
| **1. Chat Ativo** | ✅ Se enviando para si mesmo | ❌ Não | ❌ Não |
| **2. Chat.get()** | ✅ Com 3 formatos de número | ❌ Não usa | ✅ Sim |
| **3. Chat.find()** | ✅ Com 3 formatos de número | ✅ Sim | ✅ Sim |
| **4. Cmd.openChatAt()** | ✅ Abre e aguarda | ❌ Não | ✅ Sim |
| **5. Validação** | ✅ Verifica propriedades | ❌ Não | ❌ Não |

**Total de Estratégias:**
- **Mettri:** 5 estratégias
- **WA-Sync:** 1 estratégia (`Chat.find()`)
- **WA Web Plus:** 2 estratégias (`Chat.get()` → `Chat.find()`)

### 3.3 Normalização de Números

| **Aspecto** | **Mettri** | **WA-Sync** | **WA Web Plus** |
|-------------|-----------|-------------|-----------------|
| **Múltiplos Formatos** | ✅ Sim (3 formatos) | ❌ Não | ❌ Não |
| **Código do País** | ✅ Detecta automaticamente | ❌ Não | ❌ Não |
| **Formato 1** | `3499277591@c.us` | - | - |
| **Formato 2** | `553499277591@c.us` | - | - |
| **Formato 3** | Código do usuário atual | - | - |

### 3.4 Robustez Busca de Chats

| **Critério** | **Mettri** | **WA-Sync** | **WA Web Plus** |
|--------------|-----------|-------------|-----------------|
| **Estratégias** | 5 | 1 | 2 |
| **Normalização** | ✅ Sim | ❌ Não | ❌ Não |
| **Validação** | ✅ Sim | ❌ Não | ❌ Não |
| **Robustez** | ⭐⭐⭐⭐⭐ (5/5) | ⭐⭐⭐⭐ (4/5) | ⭐⭐⭐⭐ (4/5) |
| **Risco de Quebrar** | 🟢 Muito Baixo | 🟢 Baixo | 🟢 Baixo |

**Conclusão:** Mettri > WA-Sync = WA Web Plus

---

## 4️⃣ INSTANCIAÇÃO DE MSGKEY

### 4.1 O que é MsgKey?

**MsgKey** é uma **classe** que representa o identificador único de uma mensagem no WhatsApp.

**Estrutura:**
```typescript
{
  from: WID,        // Quem enviou
  to: WID,          // Para quem
  id: string,       // ID único
  participant?: WID,// Participante (grupos)
  _serialized: string // "true_553499277591@c.us_3EB0119957755460C4211A"
}
```

**Por que precisa ser classe?**
- Objetos simples não têm `_serialized` (propriedade calculada)
- WhatsApp espera instância com métodos (`isGroup()`, `isLid()`, etc)
- Classe tem validação interna

### 4.2 Comparação de Instanciação

| **Aspecto** | **Mettri** | **WA-Sync** | **WA Web Plus** |
|-------------|-----------|-------------|-----------------|
| **Método** | `new MsgKeyClass({...})` | `new window.Store.MsgKey({...})` | `new N.MsgKey({...})` |
| **Busca da Classe** | ✅ 5 estratégias | ✅ Direto | ✅ Direto |
| **Estratégia 1** | `msgKeyModule` é classe | `window.Store.MsgKey` | `N.MsgKey` |
| **Estratégia 2** | `msgKeyModule.default` | - | - |
| **Estratégia 3** | `msgKeyModule.constructor` | - | - |
| **Estratégia 4** | `window.N.MsgKey` | - | - |
| **Estratégia 5** | `interceptors.N.MsgKey` | - | - |
| **Fallback** | ✅ Objeto simples | ❌ Nenhum | ❌ Nenhum |

### 4.3 Robustez Instanciação MsgKey

| **Critério** | **Mettri** | **WA-Sync** | **WA Web Plus** |
|--------------|-----------|-------------|-----------------|
| **Estratégias** | 5 | 1 | 1 |
| **Fallback** | ✅ Objeto simples | ❌ Nenhum | ❌ Nenhum |
| **Robustez** | ⭐⭐⭐⭐⭐ (5/5) | ⭐⭐⭐⭐ (4/5) | ⭐⭐⭐⭐ (4/5) |
| **Risco de Quebrar** | 🟢 Muito Baixo | 🟡 Médio | 🟡 Médio |

**Conclusão:** Mettri > WA-Sync = WA Web Plus

---

## 5️⃣ NOMES DE FUNÇÕES ESPECÍFICAS

### 5.1 Comparação de Busca

| **Aspecto** | **Mettri** | **WA-Sync** | **WA Web Plus** |
|-------------|-----------|-------------|-----------------|
| **Método** | `findExport("addAndSendMsgToChat")` | `require("WAWebSendMsgChatAction")` | `findExport("addAndSendMsgToChat")` |
| **Busca por Nome** | ✅ Sim | ✅ Sim | ✅ Sim |
| **Busca por Características** | ✅ Para coleções | ❌ Não | ⚠️ Parcial |
| **Fallback se Nome Mudar** | ✅ Busca genérica (coleções) | ❌ Quebra | ❌ Quebra |

### 5.2 Exemplo: addAndSendMsgToChat

| **Implementação** | **Como Busca** | **Fallback** | **Robustez** |
|------------------|---------------|--------------|--------------|
| **Mettri** | `findExport("addAndSendMsgToChat")` | ❌ Nenhum (função específica) | ⭐⭐⭐ |
| **WA-Sync** | `require("WAWebSendMsgChatAction")` | ❌ Nenhum | ⭐⭐⭐ |
| **WA Web Plus** | `findExport("addAndSendMsgToChat")` | ❌ Nenhum | ⭐⭐⭐ |

**Observação:** Nenhuma das 3 tem fallback para funções específicas. Se WhatsApp renomear, todas quebram.

### 5.3 Robustez Nomes de Funções

| **Critério** | **Mettri** | **WA-Sync** | **WA Web Plus** |
|--------------|-----------|-------------|-----------------|
| **Funções Específicas** | ⭐⭐⭐ (3/5) | ⭐⭐⭐ (3/5) | ⭐⭐⭐ (3/5) |
| **Coleções** | ⭐⭐⭐⭐⭐ (5/5) | ⭐⭐⭐ (3/5) | ⭐⭐⭐⭐ (4/5) |
| **Robustez Geral** | ⭐⭐⭐⭐ (4/5) | ⭐⭐⭐ (3/5) | ⭐⭐⭐ (3/5) |
| **Risco de Quebrar** | 🟡 Médio (funções) | 🟡 Médio | 🟡 Médio |

**Conclusão:** Mettri (melhor para coleções) > WA Web Plus > WA-Sync

---

## 6️⃣ ASSINATURAS DE FUNÇÃO

### 6.1 Comparação

| **Aspecto** | **Mettri** | **WA-Sync** | **WA Web Plus** |
|-------------|-----------|-------------|-----------------|
| **Validação Antes de Chamar** | ❌ Não | ❌ Não | ❌ Não |
| **Try-Catch** | ✅ Sim (todas chamadas) | ⚠️ Parcial | ⚠️ Parcial |
| **Logs Detalhados** | ✅ Sim | ⚠️ Parcial | ⚠️ Parcial |
| **Detecção de Mudança** | ⚠️ Em runtime (try-catch) | ⚠️ Em runtime | ⚠️ Em runtime |
| **Prevenção de Erro** | ❌ Não previne | ❌ Não previne | ❌ Não previne |

### 6.2 Exemplo: addAndSendMsgToChat

| **Implementação** | **Validação** | **Proteção** |
|------------------|--------------|--------------|
| **Mettri** | ❌ Não valida parâmetros | ✅ Try-catch + logs |
| **WA-Sync** | ❌ Não valida parâmetros | ⚠️ Try-catch parcial |
| **WA Web Plus** | ❌ Não valida parâmetros | ⚠️ Try-catch parcial |

**Observação:** Nenhuma das 3 valida assinatura antes de chamar. Todas dependem de try-catch.

### 6.3 Robustez Assinaturas

| **Critério** | **Mettri** | **WA-Sync** | **WA Web Plus** |
|--------------|-----------|-------------|-----------------|
| **Validação** | ❌ Não | ❌ Não | ❌ Não |
| **Try-Catch** | ✅ Sim | ⚠️ Parcial | ⚠️ Parcial |
| **Robustez** | ⭐⭐⭐ (3/5) | ⭐⭐⭐ (3/5) | ⭐⭐⭐ (3/5) |
| **Risco de Quebrar** | 🟡 Médio | 🟡 Médio | 🟡 Médio |

**Conclusão:** Mettri = WA-Sync = WA Web Plus (empatados - nenhuma valida assinatura)

---

## 📊 RESUMO FINAL - TABELA GERAL

| **Aspecto** | **Mettri** | **WA-Sync** | **WA Web Plus** | **Vencedor** |
|-------------|-----------|-------------|-----------------|--------------|
| **1. Interceptação Webpack** | ⭐⭐⭐⭐ (4/5) | ⭐⭐⭐ (3/5) | ⭐⭐⭐⭐ (4/5) | **Mettri = WA Web Plus** |
| **2. Busca de Módulos** | ⭐⭐⭐⭐⭐ (5/5) | ⭐⭐⭐ (3/5) | ⭐⭐⭐⭐ (4/5) | **Mettri** |
| **3. Busca de Chats** | ⭐⭐⭐⭐⭐ (5/5) | ⭐⭐⭐⭐ (4/5) | ⭐⭐⭐⭐ (4/5) | **Mettri** |
| **4. Instanciação MsgKey** | ⭐⭐⭐⭐⭐ (5/5) | ⭐⭐⭐⭐ (4/5) | ⭐⭐⭐⭐ (4/5) | **Mettri** |
| **5. Nomes de Funções** | ⭐⭐⭐⭐ (4/5) | ⭐⭐⭐ (3/5) | ⭐⭐⭐ (3/5) | **Mettri** |
| **6. Assinaturas** | ⭐⭐⭐ (3/5) | ⭐⭐⭐ (3/5) | ⭐⭐⭐ (3/5) | **Empatados** |
| **ROBUSTEZ GERAL** | ⭐⭐⭐⭐ (4.3/5) | ⭐⭐⭐ (3.3/5) | ⭐⭐⭐⭐ (3.7/5) | **Mettri** |

---

## 🎯 CONCLUSÕES

### Mettri é o Mais Robusto

**Vantagens sobre WA-Sync:**
- ✅ Mais fallbacks (5 estratégias vs 1-2)
- ✅ Busca genérica por características
- ✅ Normalização de números
- ✅ Validação de propriedades

**Vantagens sobre WA Web Plus:**
- ✅ Mais estratégias de fallback
- ✅ Busca genérica mais completa
- ✅ Normalização de números
- ✅ Validação de propriedades

**Pontos Fracos (todas as 3):**
- ⚠️ Nenhuma valida assinatura de função
- ⚠️ Dependem de try-catch para detectar erros

---

## 🚨 RISCO DE QUEBRAR AMANHÃ

| **Cenário** | **Mettri** | **WA-Sync** | **WA Web Plus** |
|-------------|-----------|-------------|-----------------|
| **Atualização Pequena** | 🟢 10-15% | 🟡 20-30% | 🟢 15-20% |
| **Refatoração Média** | 🟢 5-10% | 🟡 15-25% | 🟡 10-15% |
| **Migração Bundler** | 🔴 1-5% | 🔴 1-5% | 🔴 1-5% |

**Conclusão:** Mettri tem menor risco de quebrar em atualizações pequenas/médias.

---

## 📝 FALLBACKS IMPLEMENTADOS

### Mettri - Fallbacks Completos

1. **Bundler:** Comet → Webpack
2. **Busca Msg:** N.Msg → GroupMetadata.default.Msg → findExport("Msg") → Busca genérica
3. **Busca Chat:** Chat.getActive() → Chat.get() → Chat.find() → Cmd.openChatAt() → Validação
4. **MsgKey:** 5 estratégias → Objeto simples
5. **Números:** 3 formatos (original, +55, código do usuário)

### WA-Sync - Fallbacks

1. **Bundler:** ❌ Nenhum
2. **Busca:** ❌ Nenhum (acesso direto)
3. **Chat:** Chat.find() apenas
4. **MsgKey:** ❌ Nenhum (acesso direto)
5. **Números:** ❌ Nenhum

### WA Web Plus - Fallbacks

1. **Bundler:** Comet → Webpack
2. **Busca Msg:** N.Msg → GroupMetadata.default.Msg → findExport("Msg")
3. **Busca Chat:** Chat.get() → Chat.find()
4. **MsgKey:** N.MsgKey (direto)
5. **Números:** ❌ Nenhum

---

**Documentação criada para análise comparativa completa.**
