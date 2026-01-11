# WhatsApp Core Module - Proposta de Design

## Visão Geral

Módulo dedicado exclusivamente a **TODAS** as interações com WhatsApp Web. Pense nele como uma "API wrapper" que abstrai toda a complexidade do WhatsApp e expõe uma interface limpa e segura.

## Filosofia: "Poder Total, Responsabilidade Total"

### O que queremos:
- ✅ Usuário de IA tem acesso completo aos recursos do WhatsApp
- ✅ Automação inteligente (não spam, mas automação contextual)
- ✅ Scraping respeitoso (lento, batch, com pausas)
- ✅ Compliance por design (não apenas "não quebrar regras")

### O que NÃO queremos:
- ❌ Spam
- ❌ Violação explícita de políticas
- ❌ Comportamento não-humano detectável
- ❌ Sobrecarga do WhatsApp Web

---

## Estrutura do Módulo

```
src/whatsapp/core/
├── index.js                 # Exporta tudo (API pública)
├── connection-manager.js    # Gerencia conexão
├── message-sender.js        # Envio de mensagens
├── message-capturer.js      # Captura (mover do src/core/)
├── contact-scraper.js       # Extração de contatos
├── search-engine.js         # Busca de mensagens
├── rate-limiter.js          # Controle de frequência
├── policy-enforcer.js       # Compliance
└── utils/
    ├── dom-helpers.js       # Helpers para DOM
    ├── selectors.js         # Seletores do WhatsApp
    └── validators.js        # Validações
```

---

## API Pública (Interface)

### `WhatsAppCore.sendMessage(options)`

Envia uma mensagem com rate limiting e validação.

```javascript
await WhatsAppCore.sendMessage({
  chatId: '5511999999999@c.us',
  text: 'Olá!',
  source: 'mettri',  // 'manual' | 'mettri' | 'autoresponder'
  priority: 'normal' // 'low' | 'normal' | 'high'
});
```

**O que faz internamente:**
1. Valida conteúdo (policy-enforcer)
2. Aguarda rate limit disponível
3. Envia via DOM (simula clique humano)
4. Aguarda confirmação (dois checks)
5. Retorna resultado

**Rate Limiting:**
- Normal: 1 mensagem por 3-5 segundos (aleatório)
- High: 1 mensagem por 1-2 segundos (mais rápido, mas ainda humano)
- Low: 1 mensagem por 10-15 segundos (muito conservador)

### `WhatsAppCore.captureMessages(options)`

Captura mensagens (já existe, mas integrado).

```javascript
const messages = await WhatsAppCore.captureMessages({
  chatId: '5511999999999@c.us',
  limit: 100,
  since: Date.now() - 86400000 // últimas 24h
});
```

### `WhatsAppCore.scrapeContacts(options)`

Extrai lista de contatos.

```javascript
const contacts = await WhatsAppCore.scrapeContacts({
  includeGroups: true,
  includeArchived: false,
  progressCallback: (progress) => console.log(`${progress}%`)
});
```

**Estratégia:**
- Scroll suave (não instantâneo)
- Processa em batches de 50
- Pausa de 500ms entre batches
- Respeita memória (não carrega tudo de uma vez)

### `WhatsAppCore.scrapeConversation(chatId, options)`

Extrai histórico de uma conversa.

```javascript
const messages = await WhatsAppCore.scrapeConversation('5511999999999@c.us', {
  limit: 1000,
  includeMedia: false,
  progressCallback: (progress) => console.log(`${progress}%`)
});
```

**Estratégia:**
- Scroll até o topo (lentamente)
- Captura mensagens conforme aparecem
- Para quando atinge limite ou fim do histórico
- Respeita rate limits (não sobrecarrega DOM)

### `WhatsAppCore.searchMessages(query, options)`

Busca mensagens.

```javascript
const results = await WhatsAppCore.searchMessages('palavra-chave', {
  chatId: '5511999999999@c.us', // opcional (busca em todos se não especificar)
  limit: 100,
  since: Date.now() - 86400000
});
```

**Performance:**
- Usa IndexedDB se disponível (rápido)
- Fallback para busca no DOM (mais lento)
- Cache de resultados frequentes

### `WhatsAppCore.getConnectionStatus()`

Retorna status da conexão.

```javascript
const status = await WhatsAppCore.getConnectionStatus();
// { connected: true, quality: 'good', lastSeen: Date }
```

---

## Rate Limiting - Detalhamento

### Token Bucket Algorithm

```javascript
class RateLimiter {
  constructor(config) {
    this.capacity = config.capacity;        // 20 tokens
    this.refillRate = config.refillRate;     // 1 token/segundo
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
    this.jitter = config.jitter || 0.2;      // 20% variação
  }
  
  async consume(tokens = 1) {
    this.refill();
    
    if (this.tokens < tokens) {
      const waitTime = (tokens - this.tokens) / this.refillRate;
      const jitteredWait = waitTime * (1 + (Math.random() * this.jitter - this.jitter/2));
      await sleep(jitteredWait * 1000);
      this.refill();
    }
    
    this.tokens -= tokens;
  }
  
  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // segundos
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}
```

### Por que Token Bucket?

1. **Permite "bursts"**: Se usuário não enviou nada por 1 minuto, pode enviar 20 de uma vez
2. **Suave**: Não bloqueia completamente, apenas limita taxa
3. **Human-like**: Jitter adiciona variação natural

### Limites por Ação

```javascript
const rateLimits = {
  sendMessage: {
    capacity: 20,
    refillRate: 1,        // 1 por segundo = 60/minuto (WhatsApp permite ~30/min)
    jitter: 0.2
  },
  
  scrapeContacts: {
    capacity: 10,
    refillRate: 0.5,     // 1 a cada 2 segundos
    jitter: 0.3
  },
  
  scrapeConversation: {
    capacity: 5,
    refillRate: 0.2,     // 1 a cada 5 segundos
    jitter: 0.4
  },
  
  search: {
    capacity: 30,
    refillRate: 2,       // 2 por segundo (buscas são leves)
    jitter: 0.1
  }
};
```

---

## Policy Enforcer - Detalhamento

### Validações Implementadas

```javascript
class PolicyEnforcer {
  // 1. Não enviar mensagens idênticas em massa
  validateNoBulkIdentical(messages) {
    if (messages.length > 10) {
      const unique = new Set(messages.map(m => m.text));
      if (unique.size < messages.length * 0.3) {
        throw new Error('Bulk identical messages detected');
      }
    }
  }
  
  // 2. Não enviar para contatos não salvos sem contexto
  validateUnsolicited(chatId, hasPreviousInteraction) {
    if (!hasPreviousInteraction && !this.isContactSaved(chatId)) {
      throw new Error('Unsolicited message to unsaved contact');
    }
  }
  
  // 3. Respeitar limites diários
  validateDailyLimit(count) {
    if (count > 1000) {
      throw new Error('Daily message limit exceeded');
    }
  }
  
  // 4. Detectar padrões suspeitos
  validateSuspiciousPattern(actions) {
    // Ex: Enviar 100 mensagens em 1 minuto = suspeito
    const recent = actions.filter(a => Date.now() - a.timestamp < 60000);
    if (recent.length > 50) {
      throw new Error('Suspicious pattern detected');
    }
  }
}
```

### Modo "Safe" vs "Unrestricted"

```javascript
// Modo Safe (padrão)
const safeMode = {
  enforcePolicies: true,
  maxMessagesPerMinute: 20,
  requireApproval: false,  // Mas valida antes
  blockUnsolicited: true
};

// Modo Unrestricted (usuário assume risco)
const unrestrictedMode = {
  enforcePolicies: false,
  maxMessagesPerMinute: 30,  // Ainda respeita rate limit técnico
  requireApproval: false,
  blockUnsolicited: false
};
```

**Por que ter modo unrestricted?**
- Usuário pode querer automação avançada
- Ele assume responsabilidade
- Ainda respeitamos rate limits técnicos (não quebrar WhatsApp)

---

## Scraping - Estratégia Detalhada

### Por que Scraping é OK?

1. **Dados do próprio usuário**: Ele está autenticado, são os dados dele
2. **Acesso via UI**: Não é hacking, apenas automatiza o que usuário faria manualmente
3. **Respeitoso**: Lento, com pausas, não sobrecarrega
4. **Transparente**: Usuário vê o que está sendo feito

### Estratégia de Scraping de Contatos

```javascript
async function scrapeContacts() {
  // 1. Abrir lista de contatos
  await clickElement('[data-testid="chat"]');
  
  // 2. Scroll suave até o fim
  let previousHeight = 0;
  let currentHeight = document.body.scrollHeight;
  
  while (currentHeight > previousHeight) {
    previousHeight = currentHeight;
    
    // Scroll suave (não instantâneo)
    window.scrollBy(0, 500);
    await sleep(300); // Aguarda renderização
    
    currentHeight = document.body.scrollHeight;
  }
  
  // 3. Extrair contatos em batches
  const contacts = [];
  const contactElements = document.querySelectorAll('[data-testid="chat"]');
  
  for (let i = 0; i < contactElements.length; i += 50) {
    const batch = Array.from(contactElements.slice(i, i + 50));
    const batchData = batch.map(el => extractContactData(el));
    contacts.push(...batchData);
    
    await sleep(500); // Pausa entre batches
  }
  
  return contacts;
}
```

### Estratégia de Scraping de Conversa

```javascript
async function scrapeConversation(chatId, limit = 1000) {
  // 1. Abrir conversa
  await openChat(chatId);
  
  // 2. Scroll até o topo (lentamente)
  let scrollAttempts = 0;
  let previousMessageCount = 0;
  
  while (scrollAttempts < 100 && messages.length < limit) {
    // Scroll para cima
    const messageContainer = findMessageContainer();
    messageContainer.scrollTop = 0;
    
    await sleep(500); // Aguarda novas mensagens carregarem
    
    const currentMessages = extractMessages();
    
    // Se não carregou novas mensagens, parar
    if (currentMessages.length === previousMessageCount) {
      break;
    }
    
    previousMessageCount = currentMessages.length;
    scrollAttempts++;
  }
  
  // 3. Extrair todas as mensagens
  return extractMessages().slice(0, limit);
}
```

---

## Integração com Módulos Existentes

### MessageProcessor

```javascript
// MessageProcessor continua processando
// Mas agora recebe mensagens do WhatsAppCore
WhatsAppCore.on('message_sent', (message) => {
  MessageProcessor.processSimple({
    ...message,
    source: 'mettri'
  });
});
```

### MessageCapturer

```javascript
// MessageCapturer vira parte do WhatsAppCore
// Mas mantém mesma interface
WhatsAppCore.captureMessages() // Internamente usa MessageCapturer
```

### IntegratedPanel

```javascript
// Painel mostra status do WhatsAppCore
const status = WhatsAppCore.getConnectionStatus();
IntegratedPanel.updateStatus(status);
```

---

## Métricas e Observabilidade

### Métricas Expostas

```javascript
const metrics = {
  // Envio
  messagesSent: 0,
  messagesSentSuccess: 0,
  messagesSentFailed: 0,
  averageSendTime: 0,
  
  // Captura
  messagesCaptured: 0,
  captureAccuracy: 0,
  
  // Scraping
  contactsScraped: 0,
  conversationsScraped: 0,
  scrapingErrors: 0,
  
  // Rate Limiting
  rateLimitHits: 0,
  averageWaitTime: 0,
  
  // Compliance
  policyViolations: 0,
  blockedActions: 0
};
```

### Eventos Emitidos

```javascript
// Usuário pode escutar eventos
WhatsAppCore.on('message_sent', (data) => { ... });
WhatsAppCore.on('message_captured', (data) => { ... });
WhatsAppCore.on('rate_limit_hit', (data) => { ... });
WhatsAppCore.on('policy_violation', (data) => { ... });
WhatsAppCore.on('connection_status_changed', (data) => { ... });
```

---

## Decisões de Design

### Por que módulo separado?

1. **Separação de responsabilidades**: WhatsApp é complexo, merece módulo próprio
2. **Testabilidade**: Testar interações com WhatsApp isoladamente
3. **Manutenção**: Mudanças no WhatsApp afetam apenas este módulo
4. **Reutilização**: Outros módulos podem usar WhatsAppCore

### Por que rate limiting no módulo?

1. **Centralizado**: Um lugar para controlar tudo
2. **Consistente**: Mesmos limites em todas as ações
3. **Configurável**: Usuário pode ajustar (dentro de limites seguros)

### Por que policy enforcer?

1. **Proteção**: Evita que usuário seja banido sem querer
2. **Transparência**: Usuário sabe o que está sendo bloqueado e por quê
3. **Flexibilidade**: Modo unrestricted para usuários avançados

---

## Próximos Passos

1. **Discutir esta proposta** com você
2. **Ajustar design** baseado no feedback
3. **Implementar módulo** começando por:
   - `rate-limiter.js` (base para tudo)
   - `message-sender.js` (mais crítico)
   - `policy-enforcer.js` (compliance)
4. **Migrar MessageCapturer** para dentro do módulo
5. **Integrar com módulos existentes**

---

## Perguntas para Discussão

1. **Rate Limits**: Os limites propostos estão adequados? Muito conservadores ou muito agressivos?

2. **Policy Enforcement**: Devemos ter modo "unrestricted" ou sempre forçar compliance?

3. **Scraping**: Scraping deve ser síncrono (bloqueia UI) ou assíncrono (Web Worker)?

4. **Backend**: Devemos planejar backend desde já ou manter 100% client-side por enquanto?

5. **Métricas**: Quais métricas são mais importantes para você?

6. **Prioridades**: Qual funcionalidade implementar primeiro? (sendMessage, scraping, search?)











