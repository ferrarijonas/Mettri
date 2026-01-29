# 🚀 Próximos Passos para Bot Funcional

## ✅ O que JÁ TEMOS (Base Sólida)

### 1. **Envio de Mensagens** ✅
- ✅ `addAndSendMsgToChat` - Funciona perfeitamente
- ✅ `sendTextMsgToChat` - Funciona perfeitamente
- ✅ Instanciação correta de MsgKey como classe
- ✅ Normalização de números (código do país)
- ✅ Detecção de envio para si mesmo

### 2. **Leitura de Mensagens** ✅
- ✅ `DataScraper` - Intercepta mensagens via webpack
- ✅ `MessageCapturer` - Captura do DOM
- ✅ `messageDB` - Armazena no IndexedDB
- ✅ Validação com Zod

### 3. **Identificação de Contatos** ✅
- ✅ `Contact` - Coleção de contatos
- ✅ `Chat` - Coleção de conversas
- ✅ `User` - Usuário atual logado
- ✅ `PresenceCollection` - Status online/offline

### 4. **Histórico** ✅
- ✅ `messageDB` - Banco de dados local
- ✅ `HistoryPanel` - Visualização de histórico
- ✅ Ordenação cronológica (1/1 com WhatsApp)

---

## ❌ O que FALTA para Bot Funcional

### 🔴 **CRÍTICO - Prioridade 1**

#### 1. **Sistema de Resposta Automática** (Bot Engine)
**Status:** ❌ Não existe no código atual

**O que precisa:**
```typescript
// src/core/bot-engine.ts
class BotEngine {
  // 1. Escutar mensagens recebidas
  onMessageReceived(msg: CapturedMessage) {
    // 2. Verificar se deve responder automaticamente
    if (shouldAutoRespond(msg)) {
      // 3. Processar comando ou regra
      const response = processMessage(msg);
      // 4. Enviar resposta
      sendResponse(msg.chatId, response);
    }
  }
}
```

**Integração necessária:**
- Conectar com `DataScraper.messageCallbacks`
- Usar `whatsappInterceptors` para enviar
- Usar `messageDB` para contexto

---

#### 2. **Sistema de Regras/Comandos** (Rules Manager)
**Status:** ❌ Existe código antigo em `whatsapp-copilot-crm`, mas não integrado

**O que precisa:**
```typescript
// src/core/rules-manager.ts
interface Rule {
  trigger: string | RegExp;  // "oi", /^\/comando/, etc
  response: string | ((msg) => string);
  enabled: boolean;
}

class RulesManager {
  // Regras simples: se mensagem contém "oi" → responde "Olá!"
  // Comandos: /help → mostra ajuda
  // Regex: /^\/pedido (.+)/ → processa pedido
}
```

**Exemplos de regras:**
- `"oi"` → `"Olá! Como posso ajudar?"`
- `"/help"` → Lista de comandos
- `"/pedido produto1"` → Cria pedido
- `"horario"` → Mostra horário de funcionamento

---

#### 3. **Contexto de Conversa** (Chat Context)
**Status:** ⚠️ Parcial (existe `messageDB`, falta contexto ativo)

**O que precisa:**
```typescript
// src/core/chat-context.ts
class ChatContext {
  // Manter estado da conversa atual
  getContext(chatId: string) {
    return {
      lastMessages: messageDB.getRecentMessages(chatId, 10),
      contactInfo: Contact.get(chatId),
      isFirstTime: !messageDB.hasHistory(chatId),
      lastInteraction: messageDB.getLastMessage(chatId)
    };
  }
}
```

**Uso:**
- Bot pode responder baseado no histórico
- Evitar respostas repetitivas
- Personalizar resposta por contato

---

### 🟡 **IMPORTANTE - Prioridade 2**

#### 4. **Interface de Configuração do Bot**
**Status:** ❌ Não existe

**O que precisa:**
- Aba "Bot" no painel
- Toggle para ativar/desativar bot
- Lista de regras (adicionar/editar/remover)
- Teste de regras em tempo real

**UI sugerida:**
```
┌─────────────────────────────┐
│ Bot                         │
├─────────────────────────────┤
│ [✓] Bot Ativo               │
│                             │
│ Regras:                     │
│ ┌─────────────────────────┐ │
│ │ "oi" → "Olá!"    [✏️] [🗑]│ │
│ │ "/help" → "Comandos..." │ │
│ │                         │ │
│ │ [+ Adicionar Regra]     │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

---

#### 5. **Processamento de Comandos**
**Status:** ❌ Não existe

**O que precisa:**
```typescript
// src/core/command-processor.ts
class CommandProcessor {
  processCommand(msg: CapturedMessage) {
    if (msg.text.startsWith('/')) {
      const [cmd, ...args] = msg.text.split(' ');
      
      switch(cmd) {
        case '/help':
          return this.showHelp();
        case '/pedido':
          return this.createOrder(args);
        case '/status':
          return this.showStatus();
        default:
          return 'Comando não reconhecido. Digite /help para ajuda.';
      }
    }
  }
}
```

**Comandos básicos sugeridos:**
- `/help` - Lista comandos disponíveis
- `/status` - Status do pedido
- `/pedido <produto>` - Criar pedido
- `/cancelar` - Cancelar pedido
- `/contato` - Informações de contato

---

#### 6. **Tratamento de Erros e Logs**
**Status:** ⚠️ Parcial (existe logging básico)

**O que precisa:**
- Logs estruturados de respostas do bot
- Tratamento de erros ao enviar mensagem
- Retry automático em caso de falha
- Notificações quando bot não consegue responder

---

### 🟢 **NICE TO HAVE - Prioridade 3**

#### 7. **Integração com IA (Opcional)**
**Status:** ❌ Não existe

**O que precisa:**
- API para gerar respostas com IA
- Contexto da conversa para IA
- Fallback para regras quando IA falha

---

#### 8. **Analytics do Bot**
**Status:** ❌ Não existe

**O que precisa:**
- Contador de mensagens respondidas
- Taxa de sucesso de respostas
- Tempo médio de resposta
- Comandos mais usados

---

## 🎯 Plano de Implementação Sugerido

### **Fase 1: Bot Básico (1-2 dias)**
1. ✅ Criar `BotEngine` que escuta mensagens
2. ✅ Criar `RulesManager` com regras simples
3. ✅ Integrar com `DataScraper` e `whatsappInterceptors`
4. ✅ Testar: enviar "oi" para si mesmo → bot responde "Olá!"

### **Fase 2: Comandos (1 dia)**
1. ✅ Criar `CommandProcessor`
2. ✅ Implementar comandos básicos (`/help`, `/status`)
3. ✅ Integrar com `BotEngine`

### **Fase 3: Interface (1 dia)**
1. ✅ Criar aba "Bot" no painel
2. ✅ Toggle ativar/desativar
3. ✅ Lista de regras (CRUD)
4. ✅ Teste de regras

### **Fase 4: Contexto (1 dia)**
1. ✅ Criar `ChatContext`
2. ✅ Usar histórico para personalizar respostas
3. ✅ Evitar respostas repetitivas

---

## 📋 Checklist Mínimo para Bot Funcional

- [ ] **Bot Engine** escuta mensagens recebidas
- [ ] **Rules Manager** tem pelo menos 3 regras funcionando
- [ ] **Integração** entre captura → processamento → envio
- [ ] **Teste básico**: Enviar "oi" → receber resposta automática
- [ ] **Toggle** para ativar/desativar bot
- [ ] **Logs** de todas as respostas do bot

---

## 🚀 Próximo Passo Imediato

**Sugestão:** Começar com **Fase 1 - Bot Básico**

1. Criar `src/core/bot-engine.ts`
2. Criar `src/core/rules-manager.ts`
3. Integrar com `DataScraper.messageCallbacks`
4. Testar com regra simples: `"oi" → "Olá! Como posso ajudar?"`

**Tempo estimado:** 2-3 horas para ter um bot básico funcionando!

---

## 💡 Exemplo de Código Inicial

```typescript
// src/core/bot-engine.ts
import { whatsappInterceptors } from '../infrastructure/whatsapp-interceptors';
import { RulesManager } from './rules-manager';
import { messageDB } from '../storage/message-db';

export class BotEngine {
  private rulesManager: RulesManager;
  private enabled: boolean = false;

  constructor() {
    this.rulesManager = new RulesManager();
  }

  async start() {
    // Escutar mensagens recebidas
    const scraper = /* obter DataScraper */;
    scraper.onMessage((msg) => {
      if (this.enabled && !msg.isOutgoing) {
        this.processMessage(msg);
      }
    });
  }

  private async processMessage(msg: CapturedMessage) {
    // Verificar regras
    const response = this.rulesManager.match(msg.text);
    
    if (response) {
      // Enviar resposta
      await this.sendResponse(msg.chatId, response);
    }
  }

  private async sendResponse(chatId: string, text: string) {
    // Usar whatsappInterceptors para enviar
    const chat = await whatsappInterceptors.Chat.get(chatId);
    if (chat) {
      // Usar mesma lógica de sendTextMsgToChat
      // ...
    }
  }
}
```

---

**Conclusão:** Com a base que temos (envio + leitura), falta principalmente a **lógica de decisão** (quando responder) e a **integração** entre captura e resposta. É totalmente viável ter um bot básico funcionando em 1-2 dias! 🎉
