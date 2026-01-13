# Guia de Atualização para Interceptação Webpack - REVISADO

> **Versão:** 2.0 | **Data:** 2026-01-11  
> **Para:** Desenvolvedor Júnior  
> **Objetivo:** Migrar de manipulação DOM pura para interceptação webpack + DOM como fallback

---

## 📋 Sumário

1. [Visão Geral](#1-visão-geral)
2. [Atualização dos Arquivos de Documentação](#2-atualização-dos-arquivos-de-documentação)
3. [Código DOM Antigo a Modificar (NÃO Remover)](#3-código-dom-antigo-a-modificar-não-remover)
4. [Como Baixar o JSON de Seletores](#4-como-baixar-o-json-de-seletores)
5. [Estrutura do Webpack](#5-estrutura-do-webpack)
6. [Implementação Passo a Passo](#6-implementação-passo-a-passo)
7. [Riscos e Limitações](#7-riscos-e-limitações)
8. [Estratégia de Migração Gradual](#8-estratégia-de-migração-gradual)
9. [Debugging](#9-debugging)
10. [Checklist Completo](#10-checklist-completo)

---

## 1. Visão Geral

### O Que É Interceptação Webpack?

Sistema que acessa módulos internos do WhatsApp via `window.webpackChunkwhatsapp_web_client`. Intercepta eventos diretamente da memória (não apenas DOM), tornando a captura mais rápida e confiável.

### Por Que Fazer Isso?

| Aspecto | Webpack | DOM |
|---------|---------|-----|
| **Performance** | ⚡ Muito rápido (memória direta) | 🐌 Mais lento (querySelector) |
| **Confiabilidade** | ⚠️ Pode quebrar (estrutura interna) | ✅ Mais estável (CSS público) |
| **Dados Disponíveis** | ✅ Metadados completos | ⚠️ Apenas o que está no DOM |
| **Eventos** | ✅ Em tempo real (antes do DOM) | ⚠️ Após renderização |
| **Manutenção** | ⚠️ Requer atualização frequente | ✅ Menos manutenção |

### Estratégia Híbrida

1. **Tentar webpack primeiro** (se disponível)
2. **Se webpack falhar ou não disponível** → DOM fallback
3. **Logar qual método está sendo usado** (para debug)

---

## 2. Atualização dos Arquivos de Documentação

### A. `project_concept.md` — Adicionar seção de interceptação

Adicionar após a seção `### auto-mapeamento`:

```markdown
### interceptação webpack
Sistema que acessa módulos internos do WhatsApp via webpack.
Intercepta eventos diretamente da memória (não apenas DOM).
Mais rápido e confiável que manipulação de DOM.
Funciona via window.webpackChunkwhatsapp_web_client.
Extrai GroupMetadata, ChatCollection, Msg, User.
Intercepta eventos: Msg.on("add"), Msg.on("change"), PresenceCollection.
Fallback para DOM quando webpack não disponível.
```

### B. `project_context.md` — Expandir seção 3.9.1

Na seção `3.9.1 SELETORES AUTO-CORRIGÍVEIS`, adicionar:

```markdown
**Subdomínio: INTERCEPTAÇÃO WEBPACK**

Sistema que acessa módulos internos do WhatsApp Web via webpack chunk.

**Módulos Extraídos:**
- `GroupMetadata`: Metadados de grupos
- `ChatCollection`: Coleção de chats
- `Msg`: Modelo de mensagem
- `User`: Usuário atual
- `sendTextMsgToChat`: Enviar mensagem
- `addAndSendMsgToChat`: Adicionar e enviar
- `MsgKey`: Chave de mensagem

**Eventos Interceptados:**
- `Msg.on("add")`: Nova mensagem recebida
- `Msg.on("change")`: Mensagem modificada
- `PresenceCollection.on("change:isOnline")`: Status online/offline
- `Chat.on("change:id")`: Mudança de chat ativo

**Arquitetura:**
```
WhatsApp Web (webpack)
    ↓
WhatsAppInterceptors (encontra webpackChunkwhatsapp_web_client)
    ↓
DataScraper (intercepta eventos)
    ↓
MessageCapturer (combina webpack + DOM)
    ↓
MessageDB (persistência)
```

**Regra de Negócio:**
> Interceptação webpack é **prioritária**. DOM é apenas fallback quando webpack não disponível.

**Entidades:**
```typescript
interface WhatsAppInterceptors {
  webpackChunk: any;
  modules: Map<string, () => any>;
  
  findExport(exportName: string): any;
  find(predicate: (module: any) => boolean): any;
  filter(predicate: (module: any) => boolean): any[];
  
  // Módulos extraídos
  GroupMetadata: any;
  ChatCollection: any;
  Msg: any;
  User: any;
}

interface DataScraper {
  interceptors: WhatsAppInterceptors;
  messageCallbacks: Array<(msg: any) => void>;
  
  start(): Promise<void>;
  onMessage(callback: (msg: any) => void): void;
  onPresenceChange(callback: (data: any) => void): void;
}
```
```

### C. `tech_stack.md` — Adicionar tecnologias

Na tabela `2.1 Frontend`, adicionar:

```markdown
| **webpackChunkwhatsapp_web_client** | N/A | Interceptação de módulos WhatsApp |
```

Adicionar nova seção após `8.5`:

```markdown
### 8.6 Por que Interceptação Webpack?

**Decisão:** Usar `window.webpackChunkwhatsapp_web_client` para acessar módulos internos do WhatsApp Web.

**Razão:**
- **Acesso Direto à Memória:** Intercepta eventos diretamente dos modelos do WhatsApp, não apenas do DOM
- **Performance:** Mais rápido que MutationObserver + querySelector
- **Confiabilidade:** Dados vêm diretamente da fonte, menos sujeito a mudanças de CSS
- **Eventos em Tempo Real:** `Msg.on("add")` dispara antes mesmo da mensagem aparecer no DOM
- **Dados Ricos:** Acesso a metadados completos (timestamps precisos, IDs, status, etc.)

**Limitações e Considerações:**
- **Estrutura Interna:** WhatsApp pode mudar estrutura de webpack a qualquer momento
- **Error Handling:** Try/catch robusto necessário - pode falhar silenciosamente
- **Fallback:** Sempre manter fallback para DOM quando webpack não disponível
- **Type Safety:** Módulos webpack não têm tipos TypeScript - usar `any` com validação Zod

**Exemplo de Uso:**
```typescript
// src/infrastructure/whatsapp-interceptors.ts
export class WhatsAppInterceptors {
  async initialize(): Promise<void> {
    if (!window.webpackChunkwhatsapp_web_client) {
      throw new Error("Cannot find bundler");
    }
    // ... inicialização
  }
  
  findExport(exportName: string): any {
    // Busca módulo por nome de export
  }
}
```
```

### D. `progress.md` — Adicionar novo bloco

Adicionar após `Bloco 0.4.6`:

```markdown
### Bloco 0.4.6: Interceptação Webpack (PRIORIDADE ALTA)
> **Prioridade:** Alta. Substitui manipulação DOM pura por interceptação de memória.
| ID | Tarefa | Status | Issue |
|----|--------|--------|-------|
| T0-022 | Criar WhatsAppInterceptors.ts (Module Finder) | Pendente | - |
| T0-023 | Implementar findExport, find, filter | Pendente | - |
| T0-024 | Extrair módulos (GroupMetadata, ChatCollection, Msg) | Pendente | - |
| T0-025 | Criar DataScraper.ts (interceptação de eventos) | Pendente | - |
| T0-026 | Implementar Msg.on("add") listener | Pendente | - |
| T0-027 | Implementar Msg.on("change") listener | Pendente | - |
| T0-028 | Criar RemoteSelectorsManager.ts | Pendente | - |
| T0-029 | Configurar GitHub Pages para selectors.json | Pendente | - |
| T0-030 | Integrar DataScraper com MessageCapturer | Pendente | - |
| T0-031 | Marcar selector-scanner.ts como deprecated (NÃO remover) | Pendente | - |
| T0-032 | Adicionar error handling robusto | Pendente | - |
| T0-033 | Adicionar validação Zod para dados interceptados | Pendente | - |
| T0-034 | Testes E2E de interceptação webpack | Pendente | - |

**Dependência:** Este bloco permite que MessageCapturer use dados de memória (webpack) em vez de apenas DOM, tornando captura mais rápida e confiável.
```

---

## 3. Código DOM Antigo a Modificar (NÃO Remover)

### ⚠️ IMPORTANTE: NÃO Remover Código DOM

O código DOM atual (`selector-scanner.ts`, `MessageCapturer` com MutationObserver) deve ser **mantido como fallback**, não removido.

### Arquivos para Marcar como Deprecated (NÃO Remover)

#### 1. `src/infrastructure/selector-scanner.ts`
- **Ação:** Adicionar comentário no topo do arquivo:
  ```typescript
  /**
   * @deprecated Usar interceptação webpack quando disponível.
   * Mantido como fallback para casos onde webpack não está disponível.
   * 
   * TODO: Remover apenas após 3+ meses de webpack funcionando 100% em produção.
   */
  ```
- **Motivo:** Varredura DOM manual será substituída por acesso direto aos módulos, mas deve permanecer como fallback

#### 2. `src/core/message-capturer.ts`
- **Ação:** Modificar para usar estratégia híbrida:
  ```typescript
  // Estrutura sugerida:
  async start(): Promise<void> {
    // 1. Tentar interceptação webpack (prioritária)
    try {
      await this.dataScraper.start();
      this.isUsingWebpack = true;
      console.log('Mettri: Usando interceptação webpack para captura');
    } catch (error) {
      // 2. Fallback para DOM
      console.warn('Mettri: Webpack não disponível, usando fallback DOM');
      this.setupDOMObserver();
      this.isUsingWebpack = false;
    }
  }
  ```
- **Motivo:** Manter MutationObserver como fallback quando webpack falhar

---

## 4. Como Baixar o JSON de Seletores

O código deles busca de: `https://wa-web-plus.web.app/classes.json`

### Baixar o JSON

```bash
# Opção 1: Via curl
curl "https://wa-web-plus.web.app/classes.json" -o config/selectors-wawplus.json

# Opção 2: Via navegador
# Abrir: https://wa-web-plus.web.app/classes.json
# Salvar como: config/selectors-wawplus.json
```

### Estrutura Esperada

```json
{
  "recentMessages": ["_ak8k"],
  "contactNames": ["_ak8q", "webp header ._ao3e", "_ahxy", "_ahxt"],
  "contactPhotos": ["_ak8h img", "webp header img"],
  "chatItem": ["#pane-side div[role=\"row\"]"],
  "conversationMessages": ["message-in", "message-out"],
  "textMessageComposerContainer": "._ak1r > div",
  "messageActionButtonsContainer": "._amj_",
  "messageReactionButtonsContainer": "x1c4vz4f xs83m0k...",
  "sidebarButton": ["header > header div:has(> .html-span:first-of-type)"],
  "chatButton": ["#main header div:has(> .html-span:first-of-type)[data-tab]"],
  "container": [".two > div:nth-of-type(5)"]
}
```

### Converter para Nosso Formato

**Nota Importante:**
- O `classes.json` deles contém seletores CSS que podem ser úteis como fallback
- **NÃO substituir** nosso sistema de seletores, apenas usar como referência
- Converter para nosso formato (`config/selectors.json`) mantendo nossa estrutura
- Manter nossos seletores como primários, deles como fallback adicional

```json
{
  "version": "2026.01.11",
  "updatedAt": "2026-01-11T00:00:00Z",
  "selectors": {
    "chatItem": {
      "id": "chatItem",
      "description": "Item individual na lista de conversas",
      "selectors": ["#pane-side div[role=\"row\"]"],
      "status": "working"
    },
    "conversationMessages": {
      "id": "conversationMessages",
      "description": "Mensagens na conversa",
      "selectors": ["message-in", "message-out"],
      "status": "working"
    }
    // ... outros
  }
}
```

---

## 5. Estrutura do Webpack

### Como Funciona o webpackChunk

```javascript
window.webpackChunkwhatsapp_web_client = [
  [
    [moduleId],  // Array de IDs de módulos
    {            // Objeto com funções de módulos
      [moduleId]: () => moduleExports
    }
  ]
]
```

### Como Acessar Módulos

```typescript
// Injetar chunk para expor módulos
const modules: Record<string, () => any> = {};
const chunk = window.webpackChunkwhatsapp_web_client;
const randomId = Math.random().toString(36).substring(7);

chunk.push([[randomId], {}, (module: any) => {
  for (const id in module.m) {
    modules[id] = () => module(id);
  }
}]);

// Agora modules contém todos os módulos acessíveis
```

### Verificação de Disponibilidade

```typescript
function isWebpackAvailable(): boolean {
  return typeof window !== 'undefined' && 
         Array.isArray(window.webpackChunkwhatsapp_web_client) &&
         window.webpackChunkwhatsapp_web_client.length > 0;
}
```

**Uso:**
- Sempre verificar antes de inicializar interceptação
- Se não disponível, usar fallback DOM imediatamente
- Logar aviso quando webpack não disponível

### Estrutura de uma Mensagem (Msg)

```typescript
interface WhatsAppMessage {
  id: {
    _serialized: string;  // Ex: "false_5511999999999@c.us_3EB0123456789ABCDEF"
    fromMe: boolean;
    remote: string;       // JID do remetente
    to: string;           // JID do destinatário
  };
  __x_body?: string;     // Corpo da mensagem
  __x_text?: string;     // Texto processado
  __x_type?: string;     // "chat", "image", "video", etc.
  __x_t?: number;        // Timestamp Unix
  __x_from?: {
    _serialized: string;
    user: string;
    server: string;
  };
  __x_senderObj?: {
    name: string;
    pushname: string;
  };
  isNewMsg: boolean;
  self: "in" | "out";
}
```

**Nota:** Propriedades com `__x_` são propriedades internas do WhatsApp. Podem mudar sem aviso.

---

## 6. Implementação Passo a Passo

### Passo 1: Criar WhatsAppInterceptors.ts

```typescript
// src/infrastructure/whatsapp-interceptors.ts
export class WhatsAppInterceptors {
  private webpackChunk: any;
  private modules: Map<string, () => any> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    if (!this.isWebpackAvailable()) {
      throw new Error("Cannot find bundler");
    }

    this.webpackChunk = window.webpackChunkwhatsapp_web_client;
    
    // Injetar chunk para expor módulos
    const modules: Record<string, () => any> = {};
    const randomId = Math.random().toString(36).substring(7);
    
    this.webpackChunk.push([[randomId], {}, (module: any) => {
      for (const id in module.m) {
        modules[id] = () => module(id);
      }
    }]);

    // Mapear módulos
    Object.entries(modules).forEach(([id, getModule]) => {
      this.modules.set(id, getModule);
    });

    this.initialized = true;
  }

  private isWebpackAvailable(): boolean {
    return typeof window !== 'undefined' && 
           Array.isArray(window.webpackChunkwhatsapp_web_client) &&
           window.webpackChunkwhatsapp_web_client.length > 0;
  }

  findExport(exportName: string): any {
    for (const getModule of this.modules.values()) {
      try {
        const module = getModule();
        const keys = [
          ...Object.keys(module?.default || {}),
          ...Object.keys(module || {})
        ];
        if (keys.includes(exportName)) {
          return module?.default?.[exportName] || module?.[exportName];
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  find(predicate: (module: any) => boolean): any {
    for (const getModule of this.modules.values()) {
      try {
        const module = getModule();
        if (predicate(module)) {
          return module;
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  filter(predicate: (module: any) => boolean): any[] {
    const results: any[] = [];
    for (const getModule of this.modules.values()) {
      try {
        const module = getModule();
        if (predicate(module)) {
          results.push(module);
        }
      } catch {
        continue;
      }
    }
    return results;
  }

  // Getters para módulos comuns
  get Msg(): any {
    return this.findExport("Msg") || 
           this.find(m => m?.default?.prototype?.isNewMsg !== undefined);
  }

  get ChatCollection(): any {
    return this.findExport("ChatCollection");
  }

  get User(): any {
    return this.findExport("getMaybeMePnUser") || 
           this.findExport("getMaybeMeLidUser");
  }

  get GroupMetadata(): any {
    return this.findExport("GroupMetadata");
  }
}
```

### Passo 2: Criar DataScraper.ts

```typescript
// src/infrastructure/data-scraper.ts
import { WhatsAppInterceptors } from './whatsapp-interceptors';
import { z } from 'zod';

// Schema Zod para validar mensagens interceptadas
const MessageSchema = z.object({
  id: z.object({
    _serialized: z.string(),
    fromMe: z.boolean(),
  }),
  __x_body: z.string().optional(),
  __x_text: z.string().optional(),
  __x_type: z.string().optional(),
  __x_t: z.number().optional(),
  isNewMsg: z.boolean().optional(),
  self: z.enum(["in", "out"]).optional(),
});

type MessageCallback = (msg: any) => void;
type PresenceCallback = (data: any) => void;

export class DataScraper {
  private interceptors: WhatsAppInterceptors;
  private messageCallbacks: MessageCallback[] = [];
  private presenceCallbacks: PresenceCallback[] = [];
  private isRunning = false;

  constructor() {
    this.interceptors = new WhatsAppInterceptors();
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    try {
      await this.interceptors.initialize();
      
      // Interceptar eventos de mensagem
      const Msg = this.interceptors.Msg;
      if (Msg) {
        Msg.on("add", (msg: any) => {
          try {
            // Validar com Zod
            const validated = MessageSchema.parse(msg);
            this.messageCallbacks.forEach(cb => cb(validated));
          } catch (error) {
            console.warn("Mettri: Erro ao validar mensagem interceptada:", error);
          }
        });

        Msg.on("change", (msg: any) => {
          try {
            const validated = MessageSchema.parse(msg);
            this.messageCallbacks.forEach(cb => cb(validated));
          } catch (error) {
            console.warn("Mettri: Erro ao validar mensagem modificada:", error);
          }
        });
      }

      // Interceptar eventos de presença
      const PresenceCollection = this.interceptors.findExport("PresenceCollection");
      if (PresenceCollection) {
        PresenceCollection.on("change:isOnline", (data: any) => {
          this.presenceCallbacks.forEach(cb => cb(data));
        });
      }

      this.isRunning = true;
      console.log("Mettri: DataScraper iniciado com sucesso");
    } catch (error) {
      console.error("Mettri: Erro ao iniciar DataScraper:", error);
      throw error;
    }
  }

  onMessage(callback: MessageCallback): void {
    this.messageCallbacks.push(callback);
  }

  onPresenceChange(callback: PresenceCallback): void {
    this.presenceCallbacks.push(callback);
  }

  stop(): void {
    this.isRunning = false;
    this.messageCallbacks = [];
    this.presenceCallbacks = [];
  }
}
```

### Passo 3: Modificar MessageCapturer.ts

```typescript
// src/core/message-capturer.ts
import { DataScraper } from '../infrastructure/data-scraper';

export class MessageCapturer {
  private observer: MutationObserver | null = null;
  private dataScraper: DataScraper | null = null;
  private isUsingWebpack = false;
  // ... resto do código

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // 1. Tentar interceptação webpack (prioritária)
    try {
      this.dataScraper = new DataScraper();
      await this.dataScraper.start();
      
      this.dataScraper.onMessage((msg) => {
        this.processInterceptedMessage(msg);
      });

      this.isUsingWebpack = true;
      console.log('Mettri: Usando interceptação webpack para captura');
    } catch (error) {
      // 2. Fallback para DOM
      console.warn('Mettri: Webpack não disponível, usando fallback DOM:', error);
      await this.setupDOMObserver();
      this.isUsingWebpack = false;
    }
  }

  private async setupDOMObserver(): Promise<void> {
    const targetNode = await this.findMessageContainer();
    if (!targetNode) {
      console.warn('Mettri: Message container not found, retrying...');
      setTimeout(() => this.setupDOMObserver(), 1000);
      return;
    }

    this.observer = new MutationObserver(mutations => {
      this.handleMutations(mutations);
    });

    this.observer.observe(targetNode, {
      childList: true,
      subtree: true,
    });
  }

  private processInterceptedMessage(msg: any): void {
    // Converter mensagem interceptada para formato CapturedMessage
    const captured: CapturedMessage = {
      id: msg.id._serialized,
      text: msg.__x_body || msg.__x_text || '',
      timestamp: msg.__x_t ? new Date(msg.__x_t * 1000) : new Date(),
      fromMe: msg.id.fromMe,
      // ... outros campos
    };

    // Validar com Zod
    const validated = CapturedMessageSchema.parse(captured);
    
    // Salvar no banco
    messageDB.saveMessage(validated).catch(error => {
      console.error('Mettri: Erro ao salvar mensagem:', error);
    });

    // Notificar callbacks
    this.callbacks.forEach(cb => cb(validated));
  }
}
```

---

## 7. Riscos e Limitações

### Riscos

- ⚠️ **Estrutura Interna**: WhatsApp pode mudar estrutura de webpack a qualquer momento
- ⚠️ **Sem Garantias**: Não há documentação oficial, tudo é reverse-engineered
- ⚠️ **Breaking Changes**: Uma atualização do WhatsApp pode quebrar tudo
- ⚠️ **Type Safety**: Módulos não têm tipos TypeScript (usar `any` com validação Zod)

### Mitigações

- ✅ **Fallback DOM**: Sempre manter DOM como fallback
- ✅ **Validação Rigorosa**: Validar todos os dados com Zod
- ✅ **Error Handling**: Try/catch em todas as chamadas
- ✅ **Monitoramento**: Logar quando webpack falha para detectar quebras rapidamente
- ✅ **Testes E2E**: Testar em múltiplas versões do WhatsApp Web

### Error Handling Robusto

```typescript
// Try/catch em TODAS as chamadas webpack
try {
  const msg = interceptors.Msg.get(msgId);
  if (!msg) throw new Error("Message not found");
  
  const validated = MessageSchema.parse({
    id: msg.id._serialized,
    text: msg.__x_body || msg.__x_text || "",
    timestamp: msg.__x_t ? new Date(msg.__x_t * 1000) : new Date(),
    // ... outros campos
  });
  
  return validated;
} catch (error) {
  console.warn("Mettri: Erro ao interceptar mensagem via webpack, usando DOM fallback");
  return this.captureViaDOM(msgId);
}
```

**Regras:**
- **Try/catch em TODAS as chamadas webpack**: Módulos podem não existir
- **Validação de tipos**: Usar Zod para validar dados interceptados
- **Fallback silencioso**: Se webpack falhar, usar DOM sem logar erro (evitar spam)
- **Retry logic**: Tentar re-inicializar webpack se falhar na primeira vez
- **Timeout**: Se webpack não inicializar em 5 segundos, usar DOM

---

## 8. Estratégia de Migração Gradual

### Fase 1: Implementar Webpack (sem remover DOM)

- [ ] Criar `WhatsAppInterceptors.ts`
- [ ] Criar `DataScraper.ts`
- [ ] Manter `MessageCapturer` usando DOM
- [ ] Testar webpack isoladamente

### Fase 2: Integração Híbrida

- [ ] Modificar `MessageCapturer` para tentar webpack primeiro
- [ ] Se webpack disponível → usar
- [ ] Se webpack falhar → fallback DOM
- [ ] Logar qual método está sendo usado
- [ ] Monitorar logs por 1 semana

### Fase 3: Otimização (após validação)

- [ ] Se webpack funcionar 100% por 1 mês → considerar DOM como fallback apenas
- [ ] Manter DOM para casos edge (webpack não disponível)
- [ ] Documentar que webpack é prioritário

### Nunca

- ❌ Remover código DOM antes de validar webpack
- ❌ Assumir que webpack sempre estará disponível
- ❌ Ignorar erros de webpack silenciosamente

---

## 9. Debugging

### Verificar se webpack está disponível

```javascript
// No console do WhatsApp Web (F12)
console.log(window.webpackChunkwhatsapp_web_client);
// Deve retornar array com módulos
```

### Listar módulos disponíveis

```javascript
// No console
const chunk = window.webpackChunkwhatsapp_web_client;
console.log(chunk[0][0].slice(0, 20)); // Primeiros 20 IDs de módulos
```

### Encontrar módulo manualmente

```javascript
// Buscar módulo que contém "Msg"
const chunk = window.webpackChunkwhatsapp_web_client;
// ... código de busca (ver reverse.txt linhas 228-380)
```

### Testar interceptação de mensagem

```javascript
// Após inicializar interceptors
const Msg = interceptors.Msg;
Msg.on("add", (msg) => {
  console.log("Nova mensagem interceptada:", msg);
});
```

### Logs Úteis

- `Mettri: Webpack disponível: true/false`
- `Mettri: Usando interceptação webpack para captura`
- `Mettri: Webpack falhou, usando fallback DOM`
- `Mettri: Módulo Msg encontrado: true/false`

### Dados Úteis do Console para Fornecer

Para entender melhor o que fazer, seria útil ter:

#### A. Estrutura do webpackChunk:
```javascript
// No console do WhatsApp Web (F12):
console.log(window.webpackChunkwhatsapp_web_client);
// Copiar estrutura (primeiros 50 módulos)
```

#### B. Módulos disponíveis:
```javascript
// No console:
Object.keys(window.webpackChunkwhatsapp_web_client[0][1]).slice(0, 20)
// Mostra IDs dos primeiros módulos
```

#### C. Exemplo de módulo GroupMetadata:
```javascript
// Tentar encontrar manualmente:
const chunk = window.webpackChunkwhatsapp_web_client;
// Executar código de busca e copiar resultado
```

#### D. Estrutura de uma mensagem (Msg):
```javascript
// Após interceptar uma mensagem:
// Copiar objeto completo de uma mensagem (sem dados sensíveis)
```

---

## 10. Checklist Completo

### Documentação

- [ ] Atualizar `project_concept.md` com seção de interceptação
- [ ] Atualizar `project_context.md` com subdomínio de interceptação webpack
- [ ] Atualizar `tech_stack.md` com webpackChunkwhatsapp_web_client
- [ ] Atualizar `progress.md` com Bloco 0.4.6

### Código

- [ ] Baixar `classes.json` deles e converter para nosso formato
- [ ] Marcar `src/infrastructure/selector-scanner.ts` como deprecated (NÃO remover)
- [ ] Documentar que MutationObserver será fallback
- [ ] Criar `src/infrastructure/whatsapp-interceptors.ts`
- [ ] Criar `src/infrastructure/data-scraper.ts`
- [ ] Modificar `src/core/message-capturer.ts` para usar estratégia híbrida

### Testes e Validação

- [ ] Testar que webpack está disponível no WhatsApp Web atual
- [ ] Verificar que módulos esperados existem (Msg, ChatCollection, etc.)
- [ ] Implementar fallback DOM quando webpack falhar
- [ ] Adicionar logs para debug (qual método está sendo usado)
- [ ] Validar dados interceptados com Zod antes de usar
- [ ] Testar em diferentes versões do WhatsApp Web
- [ ] Documentar limitações conhecidas do webpack

### Issues

- [ ] Criar issue no GitHub para cada tarefa do Bloco 0.4.6

---

## Arquivos de Referência

O dev júnior deve consultar:
- `reverse.txt` linhas 228-380: Como eles fazem Module Finder
- `reverse.txt` linhas 759-1049: Como interceptam eventos
- `reverse.txt` linha 73580: URL do classes.json deles

---

## Resumo

O dev júnior atualiza a documentação para refletir a mudança de DOM puro para interceptação webpack + DOM como fallback. O código antigo de varredura DOM será mantido como fallback, não removido.

**Princípios:**
1. Webpack é prioritário, mas DOM é essencial como fallback
2. Sempre validar dados interceptados com Zod
3. Error handling robusto em todas as chamadas webpack
4. Migração gradual: implementar, testar, validar, otimizar
5. Nunca remover código DOM antes de validar webpack em produção
