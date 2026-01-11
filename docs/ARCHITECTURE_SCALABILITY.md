# Arquitetura Escalável - Mettri CRM para 100k Usuários

## Visão Geral

Este documento descreve a arquitetura pensada para escalar o Mettri CRM para **100.000 usuários simultâneos**, mantendo performance, confiabilidade e compliance com políticas do WhatsApp.

## Princípios de Design

### 1. **Modularidade Extrema**
Cada módulo tem responsabilidade única e pode ser escalado independentemente.

### 2. **Rate Limiting Inteligente**
Respeitar limites do WhatsApp enquanto maximiza throughput legítimo.

### 3. **Compliance por Design**
Arquitetura que facilita compliance, não apenas "não quebrar regras".

### 4. **Observabilidade Total**
Métricas, logs e rastreamento em todos os pontos críticos.

### 5. **Fail-Safe**
Sistema continua funcionando mesmo com falhas parciais.

---

## Arquitetura de Módulos

### Módulo: WhatsApp Core (`src/whatsapp/core/`)

**Responsabilidade ÚNICA:** Toda interação com WhatsApp Web.

```
src/whatsapp/core/
├── connection-manager.js    # Gerencia conexão/desconexão
├── message-sender.js        # Envio de mensagens (com rate limiting)
├── message-capturer.js      # Captura de mensagens (já existe, mover)
├── contact-scraper.js       # Extração de contatos/conversas
├── search-engine.js         # Busca de mensagens/contatos
├── policy-enforcer.js       # Garante compliance com políticas
└── rate-limiter.js          # Controla frequência de ações
```

#### Por que separar?

1. **Escalabilidade:** Cada funcionalidade pode ser otimizada independentemente
2. **Testabilidade:** Testes unitários focados
3. **Manutenção:** Mudanças no WhatsApp afetam apenas um módulo
4. **Compliance:** Policy enforcer centralizado facilita auditoria

---

## Estratégia de Escalabilidade

### 1. **Arquitetura Híbrida (Client-Side + Backend)**

```
┌─────────────────────────────────────────────────────────────┐
│                   100k Usuários                            │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌───────────────┐              ┌──────────────────┐
│  Client-Side │              │   Backend API    │
│  (Extensão)  │              │   (Opcional)     │
│              │              │                  │
│ - Captura    │◄────────────►│ - Sincronização │
│ - UI         │              │ - Analytics      │
│ - Cache      │              │ - Rate Limiting  │
└───────────────┘              │ - Compliance     │
                               └──────────────────┘
```

**Decisão:** Começar 100% client-side, mas arquitetura permite backend futuro.

### 2. **Rate Limiting por Usuário**

```javascript
// Estratégia: "Human-like behavior"
const rateLimits = {
  messagesPerMinute: 20,      // WhatsApp permite ~30, usamos 20 (seguro)
  messagesPerHour: 200,       // Limite conservador
  contactsPerMinute: 10,     // Scraping de contatos
  searchesPerMinute: 30,     // Buscas são leves
  dailyMessageLimit: 1000    // Limite diário por segurança
};
```

**Por que isso funciona:**
- WhatsApp detecta padrões não-humanos (envios muito rápidos, repetitivos)
- Nosso rate limiter simula comportamento humano (variações, pausas)
- Limites conservadores evitam bloqueios

### 3. **Cache Inteligente**

```javascript
// Estratégia de cache em camadas
Cache Layers:
1. Memory Cache (últimas 100 mensagens) - Instantâneo
2. IndexedDB (últimas 10k mensagens) - Rápido
3. Backend Sync (opcional) - Persistente
```

**Benefícios:**
- Reduz carga no WhatsApp Web
- Melhora performance da UI
- Permite offline-first

---

## Módulo WhatsApp Core - Detalhamento

### `connection-manager.js`

**Responsabilidade:** Gerenciar conexão com WhatsApp Web.

```javascript
// Funcionalidades:
- Detectar quando WhatsApp está conectado/desconectado
- Reconectar automaticamente se cair
- Monitorar qualidade da conexão
- Emitir eventos de status (connected, disconnected, reconnecting)
```

**Escalabilidade:**
- Cada usuário tem sua própria instância
- Não há estado compartilhado
- Fail-safe: continua funcionando mesmo com conexão instável

### `message-sender.js`

**Responsabilidade:** Enviar mensagens com rate limiting e validação.

```javascript
// Funcionalidades:
- Enviar mensagem única
- Enviar em lote (com rate limiting)
- Validar conteúdo antes de enviar
- Retry automático em caso de falha
- Tracking de mensagens enviadas
```

**Rate Limiting:**
```javascript
// Estratégia: Token Bucket
class MessageSender {
  constructor() {
    this.bucket = new TokenBucket({
      capacity: 20,           // 20 tokens
      refillRate: 1,           // 1 token por segundo
      jitter: 0.2              // 20% de variação (human-like)
    });
  }
  
  async send(message) {
    await this.bucket.consume(1);  // Aguarda token disponível
    // Envia mensagem
  }
}
```

**Compliance:**
- Validação de conteúdo (evita spam)
- Delay aleatório entre envios (simula humano)
- Respeita limites diários

### `contact-scraper.js`

**Responsabilidade:** Extrair contatos e conversas do WhatsApp Web.

```javascript
// Funcionalidades:
- Listar todos os contatos
- Extrair informações de contato (nome, foto, status)
- Listar conversas de um contato
- Extrair histórico de mensagens
- Respeitar rate limits (não sobrecarregar DOM)
```

**Estratégia de Scraping:**
```javascript
// 1. Scroll suave (não instantâneo)
// 2. Aguardar renderização (MutationObserver)
// 3. Batch processing (processa em lotes de 50)
// 4. Pausas entre batches (simula humano)
// 5. Respeita limites de memória
```

**Por que isso é OK:**
- Usuário está autenticado (é a conta dele)
- Dados são acessíveis via UI (não é hacking)
- Scraping é lento e respeitoso (não sobrecarrega)
- Usuário tem controle total (pode parar a qualquer momento)

### `search-engine.js`

**Responsabilidade:** Buscar mensagens e contatos.

```javascript
// Funcionalidades:
- Buscar mensagens por texto
- Buscar contatos por nome
- Buscar por data/período
- Buscar por tipo (texto, mídia, etc)
- Indexação local (IndexedDB)
```

**Performance:**
- Indexação em background
- Busca incremental (não recarrega tudo)
- Cache de resultados frequentes

### `policy-enforcer.js`

**Responsabilidade:** Garantir compliance com políticas do WhatsApp.

```javascript
// Funcionalidades:
- Validar conteúdo antes de enviar
- Detectar padrões de spam
- Bloquear ações que violam políticas
- Log de ações para auditoria
- Alertas ao usuário sobre limites
```

**Políticas Implementadas:**
```javascript
const policies = {
  // Não enviar mensagens idênticas em massa
  noBulkIdentical: true,
  
  // Não enviar para contatos não salvos sem interação prévia
  noUnsolicited: true,
  
  // Respeitar rate limits
  respectRateLimits: true,
  
  // Não automatizar ações suspeitas
  noSuspiciousAutomation: true
};
```

**Por que isso é importante:**
- WhatsApp pode banir contas que violam políticas
- Compliance proativo evita problemas
- Usuário tem controle (pode desabilitar validações se quiser)

---

## Estratégia de Compliance

### O que é permitido?

✅ **Permitido:**
- Automação de ações que o usuário faria manualmente
- Scraping de dados da própria conta do usuário
- Uso de IA para sugestões (não envio automático)
- Análise de conversas para insights

### O que é arriscado?

⚠️ **Arriscado (mas possível com cuidado):**
- Envio em massa (precisa rate limiting rigoroso)
- Mensagens automáticas (precisa ser contextual)
- Scraping agressivo (precisa ser lento e respeitoso)

### O que evitar?

❌ **Evitar:**
- Spam (mensagens não solicitadas)
- Envio para contatos não salvos sem contexto
- Padrões não-humanos (envios muito rápidos/repetitivos)
- Bypass de limites do WhatsApp

### Estratégia: "Human-in-the-Loop"

```
Usuário → IA Sugere → Usuário Aprova → Envia
```

**Por que funciona:**
- Usuário sempre tem controle final
- IA apenas sugere, não decide
- Padrões são humanos (variações, pausas)
- Compliance é garantido pelo design

---

## Escalabilidade para 100k Usuários

### Desafios

1. **Cada usuário tem sua própria extensão**
   - ✅ Não há estado compartilhado
   - ✅ Escalabilidade horizontal natural
   - ⚠️ Desafio: Sincronização (se houver backend)

2. **WhatsApp Web pode limitar**
   - ⚠️ Múltiplas abas podem causar problemas
   - ✅ Solução: Detectar e gerenciar abas duplicadas

3. **Performance do navegador**
   - ⚠️ 100k usuários = 100k instâncias
   - ✅ Cada instância é leve (client-side)
   - ✅ IndexedDB é eficiente (não bloqueia UI)

### Soluções

#### 1. **Lazy Loading**
```javascript
// Carregar módulos apenas quando necessário
if (userWantsScraping) {
  await loadModule('contact-scraper');
}
```

#### 2. **Web Workers para Processamento Pesado**
```javascript
// Scraping e processamento em background
const worker = new Worker('whatsapp/scraper-worker.js');
worker.postMessage({ action: 'scrape', contacts: [...] });
```

#### 3. **Debouncing e Throttling**
```javascript
// Evitar processamento excessivo
const debouncedCapture = debounce(captureMessage, 100);
const throttledUpdate = throttle(updateUI, 1000);
```

#### 4. **Batch Processing**
```javascript
// Processar em lotes para não bloquear UI
async function processBatch(items, batchSize = 50) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(process));
    await sleep(100); // Pausa entre batches
  }
}
```

---

## Métricas e Observabilidade

### Métricas Essenciais

```javascript
const metrics = {
  // Performance
  messagesCapturedPerSecond: 0,
  messagesSentPerSecond: 0,
  averageResponseTime: 0,
  
  // Compliance
  rateLimitHits: 0,
  policyViolations: 0,
  blockedActions: 0,
  
  // Qualidade
  captureAccuracy: 0,      // % de mensagens capturadas corretamente
  sendSuccessRate: 0,     // % de mensagens enviadas com sucesso
  duplicateRate: 0,        // % de mensagens duplicadas
  
  // Sistema
  memoryUsage: 0,
  cpuUsage: 0,
  connectionStatus: 'connected'
};
```

### Logging Estruturado

```javascript
// Todos os logs incluem contexto
logger.info('message_sent', {
  messageId: '...',
  chatId: '...',
  timestamp: Date.now(),
  source: 'mettri',
  rateLimitRemaining: 15
});
```

---

## Roadmap de Implementação

### Fase 1: Fundação (Atual)
- ✅ Módulo de captura básico
- ✅ IndexedDB para armazenamento
- ✅ UI integrada

### Fase 2: WhatsApp Core (Próximo)
- [ ] `connection-manager.js`
- [ ] `message-sender.js` com rate limiting
- [ ] `policy-enforcer.js`
- [ ] `rate-limiter.js`

### Fase 3: Scraping e Busca
- [ ] `contact-scraper.js`
- [ ] `search-engine.js`
- [ ] Indexação otimizada

### Fase 4: Escalabilidade
- [ ] Web Workers para processamento pesado
- [ ] Lazy loading de módulos
- [ ] Métricas e observabilidade
- [ ] Backend opcional (sincronização)

### Fase 5: Compliance Avançado
- [ ] Detecção proativa de violações
- [ ] Alertas ao usuário
- [ ] Modo "safe" (compliance máximo)

---

## Decisões de Design

### Por que Client-Side First?

1. **Privacidade:** Dados nunca saem do navegador do usuário
2. **Performance:** Sem latência de rede
3. **Custo:** Sem servidores para 100k usuários
4. **Simplicidade:** Menos infraestrutura

### Por que Backend Opcional?

1. **Sincronização:** Usuário pode querer acessar de múltiplos dispositivos
2. **Analytics:** Insights agregados (com consentimento)
3. **Backup:** Backup automático na nuvem
4. **Colaboração:** Compartilhamento de regras/IA entre equipes

### Por que Modularidade Extrema?

1. **Manutenção:** Mudanças isoladas não quebram tudo
2. **Testes:** Testes unitários focados
3. **Performance:** Carregar apenas o necessário
4. **Escalabilidade:** Otimizar módulos independentemente

---

## Conclusão

Esta arquitetura foi pensada para:
- ✅ Escalar para 100k usuários
- ✅ Respeitar políticas do WhatsApp
- ✅ Manter performance
- ✅ Facilitar manutenção
- ✅ Permitir evolução futura

**Próximo passo:** Implementar módulo WhatsApp Core com foco em `message-sender.js` e `rate-limiter.js`.











