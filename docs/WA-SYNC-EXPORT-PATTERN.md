# 📚 Padrão de Exportação WA-Sync - Documentação Completa

**Data:** 2026-01-XX  
**Fonte:** Análise do código-fonte da extensão WA-Sync (versão 1.0.8)

---

## 🎯 Resumo Executivo

A WA-Sync exporta mensagens do WhatsApp usando **dois modos principais**:

1. **Tempo Real (Reactive)**: Captura cada nova mensagem via event listeners
2. **Histórico/Batch Sync**: Raspagem completa de chats antigos com paginação

**Arquitetura fundamental**: Usa `window.Store.Chat.getModelsArray()` para obter ordem correta dos chats, e `Store.ConversationMsgs.loadEarlierMsgs()` para carregar histórico.

---

## 1️⃣ EXPORTAÇÃO EM TEMPO REAL

### Como funciona:

```
WhatsApp Web → Store.Msg.on("add") → EventListener → postMessage → Bridge → Background → Webhook/API
```

### 1.1 Event Listeners (EventListeners.js)

A WA-Sync registra listeners nos eventos do WhatsApp **no momento da inicialização**:

```javascript
// Store.js - Linha final
window.Store.Msg.on("add", async e => {
    if (e.isNewMsg) {
        window.onAddMessageEvent(await window.WWebJS.getMessageModel(e))
    }
})
```

**Eventos capturados:**
- ✅ `Msg.on("add")` - Nova mensagem (recebida/enviada)
- ✅ `Msg.on("change:type")` - Mudança de tipo de mensagem
- ✅ `Msg.on("change:ack")` - Status de leitura (✓, ✓✓, ✓✓ azul)
- ✅ `Msg.on("change:body change:caption")` - Edição de mensagem
- ✅ `Msg.on("remove")` - Mensagem revogada
- ✅ `Chat.on("remove")` - Chat removido
- ✅ `Chat.on("change:archive")` - Chat arquivado
- ✅ `Chat.on("change:unreadCount")` - Contagem de não lidas

### 1.2 Serialização (EventListeners.js)

Toda mensagem é serializada antes de enviar:

```javascript
function serializeData(e) {
    try {
        return JSON.parse(JSON.stringify(e))  // Deep clone seguro
    } catch(e) {
        return { error: "Serialization failed", message: e.message }
    }
}
```

### 1.3 Estrutura da Mensagem Exportada

Baseado em `models/Message.js`, cada mensagem tem:

```javascript
{
    // Identificação
    id: {
        fromMe: boolean,
        remote: string,      // Ex: "553194799111@c.us"
        id: string,          // ID único da mensagem
        _serialized: string  // Ex: "false_553194799111@c.us_3A65218D5F9029233BB7"
    },
    
    // Conteúdo
    body: string,            // Texto da mensagem
    type: string,            // "chat", "image", "video", "audio", etc
    caption: string,         // Legenda (para mídia)
    
    // Metadados
    timestamp: number,       // Unix timestamp (segundos)
    from: string,            // Remetente (chatId)
    to: string,              // Destinatário
    fromMe: boolean,         // Se foi enviada por você
    author: string,          // Autor (para grupos)
    
    // Chat relacionado
    chatId: string,          // ID do chat
    fromChat: string,
    toChat: string,
    
    // Mídia
    hasMedia: boolean,
    mimetype: string,        // "image/jpeg", "video/mp4", etc
    filename: string,
    size: number,
    mediaKey: string,
    
    // Outros
    isForwarded: boolean,
    isStatus: boolean,
    quotedMsg: {...},        // Mensagem citada
    location: {...},         // Localização
    vCards: [...],          // Contatos
    links: [...],           // Links detectados
    // ... mais campos
}
```

**Importante**: Cada mensagem mantém `chatId` e `author` (para grupos), permitindo agrupar por contato.

---

## 2️⃣ EXPORTAÇÃO HISTÓRICA (RASPAGEM)

### Como funciona:

```
1. Obtém todos os chats → Store.Chat.getModelsArray()
2. Para cada chat:
   a. Obtém chat completo → Store.Chat.find(chatId)
   b. Carrega mensagens antigas → ConversationMsgs.loadEarlierMsgs()
   c. Obtém todas as mensagens → chat.getAllMsgs()
   d. Agrupa em batches (50 msg/batch)
   e. Envia para webhook/API
```

### 2.1 Obter Lista de Chats (MessageHandlers.js)

```javascript
case "WA_SYNC_GET_ALL_CHATS":
    // Usa getModelsArray() - JÁ VEM NA ORDEM CORRETA
    const chats = window.Store.Chat.getModelsArray().map(chat => {
        return {
            id: chat.id?._serialized || chat.id?.toString(),
            name: chat.name || chat.formattedTitle || chat.contact?.name || "Unknown",
            isGroup: "g.us" === chat.id?.server || chat.isGroup || false,
            unreadCount: chat.unreadCount || 0,
            // ... mais campos
        }
    })
```

**Ponto crítico**: `getModelsArray()` retorna na **ordem do WhatsApp** (mais recente primeiro). Não precisa ordenar manualmente.

### 2.2 Carregar Mensagens de um Chat (MessageHandlers.js)

```javascript
case "WA_SYNC_GET_MESSAGES":
    const chatId = message.chatId;
    const limit = message.limit || 100;
    
    // 1. Obter chat
    const chat = await window.WWebJS.getChat(chatId, { getAsModel: false });
    
    // 2. Carregar mensagens antigas (paginação)
    let hasMore = true;
    while (hasMore) {
        const earlierMsgs = await window.Store.ConversationMsgs.loadEarlierMsgs(chat);
        hasMore = !!(earlierMsgs && earlierMsgs.length > 0);
    }
    
    // 3. Obter TODAS as mensagens carregadas
    const allMsgs = chat.getAllMsgs() || [];
    
    // 4. Limitar e serializar
    const messages = allMsgs.slice(0, limit).map(msg => {
        return await window.WWebJS.getMessageModel(msg);
    });
```

**Processo de paginação:**
- `loadEarlierMsgs()` carrega mais mensagens antigas
- Continua até não retornar mais mensagens
- `getAllMsgs()` retorna todas as mensagens já carregadas
- **Ordem**: Mais antigas primeiro (ordem cronológica natural)

### 2.3 Batch Sync (CustomIntegration.js)

```javascript
async syncMessages(messages, options = {}) {
    const batchSize = this.config.messagesPerBatch;  // Padrão: 50
    
    // Processa em lotes de 50
    for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        
        // Envia batch para webhook
        await this.sendBatchToService(batch);
        
        // Delay entre batches (2 segundos)
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}
```

**Padrão de exportação:**
- ✅ Batch de 50 mensagens por vez
- ✅ Delay de 2s entre batches (evitar rate limit)
- ✅ Retry automático em caso de falha
- ✅ Progress tracking por chat

---

## 3️⃣ ORDENAÇÃO E AGRUPAMENTO

### 3.1 Ordem dos Chats

**WA-Sync não ordena manualmente** - confia no WhatsApp:

```javascript
// CORRETO (WA-Sync)
const chats = window.Store.Chat.getModelsArray()  // Já vem ordenado

// ERRADO (não fazer)
chats.sort((a, b) => b.timestamp - a.timestamp)   // Desnecessário
```

**Por que funciona:**
- `getModelsArray()` retorna na ordem que o WhatsApp mantém internamente
- WhatsApp ordena por propriedade `t` (timestamp última interação)
- Ordem: **Mais recente primeiro** (igual feed visual)

### 3.2 Ordem das Mensagens

**Dentro de cada chat**, as mensagens são:

1. **Carregadas em ordem cronológica** (mais antiga → mais recente)
   - Via `loadEarlierMsgs()` que faz paginação de trás pra frente
   - `getAllMsgs()` retorna na ordem carregada

2. **Mantidas nessa ordem ao exportar**
   - Não reordena - mantém ordem original
   - Cada mensagem tem `timestamp` para ordenação externa se necessário

### 3.3 Agrupamento por Contato

**Como agrupa mensagens por contato:**

```javascript
// Cada mensagem tem:
{
    chatId: "553194799111@c.us",    // ID do chat/contato
    from: "553194799111@c.us",      // Remetente
    fromMe: false,                  // Se você enviou
    author: "553194799111@c.us"     // Autor (grupos)
}

// Para agrupar:
const messagesByContact = messages.reduce((acc, msg) => {
    const contactId = msg.chatId || msg.from;
    if (!acc[contactId]) {
        acc[contactId] = [];
    }
    acc[contactId].push(msg);
    return acc;
}, {});
```

**Para grupos:**
- `chatId` = ID do grupo (ex: `"120363123456789012@g.us"`)
- `author` = Quem enviou dentro do grupo
- `isGroup: true` identifica grupos

---

## 4️⃣ GRUPOS vs CONTATOS

### 4.1 Identificação

```javascript
// MessageHandlers.js - GET_ALL_CHATS
const isGroup = "g.us" === chat.id?.server || chat.isGroup || false;

// ID de contato: "553194799111@c.us"
// ID de grupo:   "120363123456789012@g.us"
```

### 4.2 Estrutura de Chat (Grupo)

```javascript
{
    id: "120363123456789012@g.us",
    name: "Nome do Grupo",
    isGroup: true,
    groupMetadata: {
        subject: "Nome do Grupo",
        desc: "Descrição do grupo",
        participants: [
            { id: "553194799111@c.us", isAdmin: false },
            { id: "5534936186847@c.us", isAdmin: true },
            // ...
        ],
        owner: "5534936186847@c.us",
        creation: 1640000000,
        size: 5
    }
}
```

### 4.3 Mensagens em Grupos

```javascript
{
    chatId: "120363123456789012@g.us",  // ID do grupo
    from: "120363123456789012@g.us",    // ID do grupo
    author: "553194799111@c.us",        // ⭐ Quem enviou (dentro do grupo)
    fromMe: false,                      // Se você enviou
    body: "Olá pessoal!",
    timestamp: 1640000000
}
```

**Diferença crítica:**
- Para grupos: `author` identifica quem enviou
- Para contatos: `from` identifica o contato (mas pode ser você se `fromMe: true`)

---

## 5️⃣ PADRÃO DE EXPORTAÇÃO PARA PLANILHA

### 5.1 Estrutura de Dados (Excel/Sheets)

Baseado no código, o padrão seria:

| timestamp | chatId | chatName | isGroup | author | authorName | fromMe | body | type | mediaUrl |
|-----------|--------|----------|---------|--------|------------|--------|------|------|----------|
| 1640000000 | 553194799111@c.us | João Silva | false | 553194799111@c.us | João Silva | false | Oi! | chat | |
| 1640000001 | 553194799111@c.us | João Silva | false | 5534936186847@c.us | Você | true | Tudo bem? | chat | |
| 1640000002 | 120363123456789012@g.us | Grupo Família | true | 553194799111@c.us | João Silva | false | Feliz Natal! | chat | |

**Colunas principais:**
1. `timestamp` - Ordem cronológica
2. `chatId` - Identificador único do chat
3. `chatName` - Nome do contato/grupo
4. `isGroup` - Se é grupo (true/false)
5. `author` - Quem enviou (para grupos)
6. `authorName` - Nome de quem enviou
7. `fromMe` - Se você enviou
8. `body` - Texto da mensagem
9. `type` - Tipo (chat, image, video, etc)
10. `mediaUrl` - URL da mídia (se houver)

### 5.2 Ordem de Exportação

**Para um chat específico:**
```
1. Ordena por timestamp (crescente = mais antiga → mais recente)
2. Mantém ordem cronológica dentro do chat
```

**Para múltiplos chats:**
```
1. Agrupa por chatId
2. Dentro de cada grupo, ordena por timestamp
3. Ordem dos grupos: pode ser por nome alfabético ou ordem do WhatsApp
```

---

## 6️⃣ FLUXO COMPLETO: TEMPO REAL + HISTÓRICO

### 6.1 Cenário 1: Mensagem Nova (Tempo Real)

```
1. Usuário recebe/envia mensagem
2. WhatsApp atualiza Store.Msg
3. Evento "add" dispara → Store.Msg.on("add")
4. EventListener serializa mensagem
5. postMessage para bridge
6. Bridge envia para background
7. Background envia para webhook/API (integração ativa)
8. Mensagem exportada IMEDIATAMENTE
```

**Tempo de latência:** < 100ms (quase instantâneo)

### 6.2 Cenário 2: Sincronização Histórica

```
1. Usuário clica "Sync all chats manually"
2. Background obtém todos os chats → Chat.getModelsArray()
3. Para cada chat (na ordem do WhatsApp):
   a. Obtém chat → Chat.find(chatId)
   b. Carrega histórico → loadEarlierMsgs() (loop até não ter mais)
   c. Obtém todas as mensagens → getAllMsgs()
   d. Agrupa em batches de 50
   e. Envia batch → webhook/API
   f. Delay 2s entre batches
   g. Atualiza progresso
4. Ao terminar, marca como "synced"
```

**Tempo estimado:**
- 1000 chats com 50 mensagens cada = ~33 minutos (50 msg/batch × 2s delay)

---

## 7️⃣ PONTOS CRÍTICOS APRENDIDOS

### ✅ O que a WA-Sync faz bem:

1. **Usa `getModelsArray()`** - Ordem correta do WhatsApp
2. **Event listeners passivos** - Não polling, apenas escuta
3. **Paginação com `loadEarlierMsgs()`** - Carrega histórico completo
4. **Batch processing** - Evita sobrecarga da API
5. **Retry automático** - Resiliente a falhas
6. **Serialização segura** - Usa `toJSON()` quando disponível

### ❌ O que a WA-Sync NÃO faz:

1. **Não ordena manualmente** - Confia no WhatsApp
2. **Não filtra duplicatas** - Assume que WhatsApp não duplica
3. **Não tem deduplicação** - Mensagens podem aparecer múltiplas vezes se sync rodar várias vezes
4. **Não exporta para Google Sheets diretamente** - Apenas webhook (Google Sheets está "coming soon")

---

## 8️⃣ APLICAÇÃO PARA METTRI

### O que podemos aprender:

1. **Para ordenação de chats:**
   ```typescript
   // ✅ CORRETO
   const chats = Chat.getModelsArray()  // Se disponível
   
   // ✅ FALLBACK (se getModelsArray não existe)
   const chats = Chat._models
       .filter(chat => chat.t != null && chat.t > 0)
       .sort((a, b) => b.t - a.t)  // Mais recente primeiro
   ```

2. **Para histórico:**
   ```typescript
   // Carregar mensagens antigas
   let hasMore = true;
   while (hasMore) {
       const earlier = await Store.ConversationMsgs.loadEarlierMsgs(chat);
       hasMore = !!(earlier && earlier.length > 0);
   }
   
   // Obter todas
   const allMsgs = chat.getAllMsgs() || [];
   ```

3. **Para tempo real:**
   ```typescript
   // Registrar listener UMA VEZ na inicialização
   Store.Msg.on("add", async (msg) => {
       if (msg.isNewMsg) {
           const serialized = await serializeMessage(msg);
           handleNewMessage(serialized);
       }
   });
   ```

---

## 9️⃣ ESTRUTURA DE DADOS COMPLETA

### 9.1 Mensagem Serializada (Padrão WA-Sync)

```json
{
    "event": "message",
    "timestamp": 1640000000000,
    "instanceId": "wa-sync-instance-1",
    "data": {
        "message": {
            "id": {
                "fromMe": false,
                "remote": "553194799111@c.us",
                "_serialized": "false_553194799111@c.us_3A65218D5F9029233BB7"
            },
            "body": "Olá!",
            "type": "chat",
            "timestamp": 1640000000,
            "from": "553194799111@c.us",
            "fromMe": false,
            "author": null,
            "chatId": "553194799111@c.us",
            "hasMedia": false
        },
        "chat": {
            "id": "553194799111@c.us",
            "name": "João Silva",
            "isGroup": false
        },
        "contact": {
            "id": "553194799111@c.us",
            "name": "João Silva",
            "pushname": "João",
            "phoneNumber": "553194799111"
        }
    }
}
```

### 9.2 Mensagem em Grupo

```json
{
    "event": "message",
    "data": {
        "message": {
            "chatId": "120363123456789012@g.us",
            "author": "553194799111@c.us",  // ⭐ Quem enviou
            "body": "Feliz Natal!",
            "fromMe": false
        },
        "chat": {
            "id": "120363123456789012@g.us",
            "name": "Grupo Família",
            "isGroup": true,
            "groupMetadata": {
                "subject": "Grupo Família",
                "participants": [...],
                "size": 5
            }
        },
        "contact": {
            "id": "553194799111@c.us",
            "name": "João Silva"  // ⭐ Autor da mensagem
        }
    }
}
```

---

## 🔟 CONCLUSÕES

### Respostas às suas perguntas:

1. **"Como exporta em tempo real?"**
   - ✅ Event listeners (`Msg.on("add")`) capturam cada nova mensagem
   - ✅ Serializa e envia IMEDIATAMENTE para webhook/API
   - ✅ Mantém ordem cronológica (timestamp)
   - ✅ Agrupa por `chatId` automaticamente

2. **"Como raspa histórico?"**
   - ✅ Usa `Chat.getModelsArray()` para todos os chats
   - ✅ Para cada chat, `loadEarlierMsgs()` em loop até não ter mais
   - ✅ `getAllMsgs()` retorna todas as mensagens
   - ✅ Envia em batches de 50 com delay de 2s

3. **"Como lida com grupos?"**
   - ✅ Identifica por `chatId` terminando em `@g.us`
   - ✅ Campo `author` identifica quem enviou dentro do grupo
   - ✅ Campo `groupMetadata` tem participantes, admin, etc
   - ✅ Exporta igual contatos, mas com `author` preenchido

4. **"Ordem certa?"**
   - ✅ Chats: `getModelsArray()` já vem ordenado (mais recente primeiro)
   - ✅ Mensagens: Ordem cronológica (mais antiga → mais recente) dentro de cada chat
   - ✅ Mantém ordem do WhatsApp, não reordena manualmente

---

**Documentação criada para referência futura do METTRI.**
