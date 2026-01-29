# Project Context — METTRI
> **Versão:** 1.0.0 | **Última atualização:** Janeiro 2026  
> **Baseado em:** `project_concept.md` (visão conceitual)

---

## 1. Sumário Executivo

### 1.1 O Que É
**METTRI** é uma plataforma de vendas conversacionais para negócios locais, operando como extensão do WhatsApp Web. Transforma conversas em vendas recorrentes sem automação agressiva.

### 1.2 Problema Central
> Conversas no WhatsApp não viram vendas de forma consistente, organizada e escalável.

### 1.3 Proposta de Valor
| Dor | Solução Mettri |
|-----|----------------|
| Mensagens se perdem | Histórico persistente, nunca apaga |
| Atendimento depende de memória | Contexto automático por cliente |
| Cliente some e nunca volta | Reativação inteligente com contexto |
| Automação tradicional é spam | Human-in-the-loop, IA apenas sugere |
| Sistemas são complexos | Design nativo do WhatsApp, mínimo atrito |

### 1.4 Frase-Guia
> *"Transformar conversa em venda, sem perder o humano."*

---

## 2. Bounded Contexts (Domínios)

A arquitetura conceitual define **13 domínios** principais, organizados por responsabilidade:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              METTRI PLATFORM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ╔═══════════════════════════════════════════════════════════════════════╗ │
│  ║                        CAMADA DE NEGÓCIO                              ║ │
│  ╠═══════════════════════════════════════════════════════════════════════╣ │
│  ║  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ║ │
│  ║  │ ATENDIMENTO │  │  CLIENTES   │  │  PRODUTOS   │  │   PEDIDOS   │  ║ │
│  ║  │   (Core)    │  │   (Core)    │  │  (Support)  │  │   (Core)    │  ║ │
│  ║  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  ║ │
│  ║  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ║ │
│  ║  │   VITRINE   │  │   ENTREGA   │  │ FINANCEIRO  │  │  MARKETING  │  ║ │
│  ║  │  (Support)  │  │  (Support)  │  │  (Support)  │  │  (Generic)  │  ║ │
│  ║  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  ║ │
│  ╚═══════════════════════════════════════════════════════════════════════╝ │
│                                                                             │
│  ╔═══════════════════════════════════════════════════════════════════════╗ │
│  ║                     CAMADA DE PLATAFORMA (Crítica)                    ║ │
│  ╠═══════════════════════════════════════════════════════════════════════╣ │
│  ║  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       ║ │
│  ║  │ INFRAESTRUTURA  │  │     SUPORTE     │  │   MONETIZAÇÃO   │       ║ │
│  ║  │   (Critical)    │  │   (Critical)    │  │   (Critical)    │       ║ │
│  ║  │                 │  │                 │  │                 │       ║ │
│  ║  │ • Seletores     │  │ • Doc Viva      │  │ • Licenças      │       ║ │
│  ║  │ • Config Remota │  │ • Bot IA        │  │ • Segurança     │       ║ │
│  ║  └─────────────────┘  └─────────────────┘  └─────────────────┘       ║ │
│  ╚═══════════════════════════════════════════════════════════════════════╝ │
│                                                                             │
│  ╔═══════════════════════════════════════════════════════════════════════╗ │
│  ║                       CAMADA DE GOVERNANÇA                            ║ │
│  ╠═══════════════════════════════════════════════════════════════════════╣ │
│  ║  ┌─────────────────────────────┐  ┌─────────────────────────────┐    ║ │
│  ║  │         AUTONOMIA           │  │        ENGENHARIA           │    ║ │
│  ║  │         (Meta)              │  │         (Meta)              │    ║ │
│  ║  │                             │  │                             │    ║ │
│  ║  │ • Estabilidade              │  │ • Monitoramento             │    ║ │
│  ║  │ • Definição de Pronto       │  │ • Rastreabilidade           │    ║ │
│  ║  │                             │  │ • Integridade               │    ║ │
│  ║  └─────────────────────────────┘  └─────────────────────────────┘    ║ │
│  ╚═══════════════════════════════════════════════════════════════════════╝ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Legenda:
  Critical = Precisa existir desde o dia 1, garante funcionamento e escala
  Core     = Essencial para MVP, diferencial competitivo
  Support  = Necessário para operação, pode ser simplificado
  Generic  = Pode usar soluções de mercado, baixa prioridade inicial
  Meta     = Regras e práticas que governam todos os outros domínios
```

---

## 3. Especificação por Domínio

### 3.1 ATENDIMENTO (Core Domain)

**Responsabilidade:** Central de todas as conversas em tempo real.

| Capacidade | Descrição | Prioridade |
|------------|-----------|------------|
| `conversation.view` | Exibir mensagens em tempo real | P0 |
| `conversation.reply.manual` | Responder digitando | P0 |
| `conversation.reply.suggested` | Responder com sugestão IA | P0 |
| `conversation.to_order` | Converter conversa em pedido | P1 |
| `conversation.log` | Registrar tudo no histórico | P0 |

**Subdomínio: CONTEXTO**

| Capacidade | Descrição | Prioridade |
|------------|-----------|------------|
| `context.temporal` | Dia, horário, turno | P1 |
| `context.environmental` | Clima, feriados, eventos | P2 |
| `context.influence` | Ajustar recomendações por contexto | P2 |

**Regra de Negócio:**
> Contexto influencia sugestões, mas **nunca decide sozinho**. Humano sempre aprova.

**Entidades:**
```typescript
interface Conversation {
  id: string;
  clientId: string;
  messages: Message[];
  status: 'active' | 'waiting' | 'closed';
  startedAt: Date;
  lastMessageAt: Date;
  context: ConversationContext;
}

interface ConversationContext {
  dayOfWeek: number;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  isHoliday: boolean;
  weather?: 'hot' | 'cold' | 'rainy';
  specialEvent?: string;
}
```

---

### 3.2 CLIENTES (Core Domain)

**Responsabilidade:** Gestão completa do relacionamento com cada cliente.

| Capacidade | Descrição | Prioridade |
|------------|-----------|------------|
| `client.profile` | Informações básicas (nome, telefone) | P0 |
| `client.history.conversations` | Histórico de conversas | P0 |
| `client.history.orders` | Histórico de pedidos | P1 |
| `client.preferences.explicit` | Preferências declaradas | P1 |
| `client.preferences.implicit` | Preferências inferidas | P2 |
| `client.tags` | Sistema de tags manuais | P1 |
| `client.notes` | Observações livres | P1 |
| `client.geolocation` | Localização quando disponível | P2 |
| `client.dashboard` | Métricas individuais | P2 |

**Subdomínio: HISTÓRICO**

| Capacidade | Descrição | Prioridade |
|------------|-----------|------------|
| `history.messages.store` | Armazenar todas mensagens | P0 |
| `history.messages.never_delete` | Política de retenção infinita | P0 |
| `history.query` | Buscar no histórico | P1 |
| `history.export.realtime` | Exportar em tempo real via webhook (padrão WA-Sync) | P0 |
| `history.export.batch` | Exportar histórico completo em batches | P1 |
| `history.scrape.chat` | Raspar histórico completo de um chat | P1 |
| `history.scrape.all` | Raspar histórico completo de todos os chats | P1 |
| `history.ordering` | Ordenação via getModelsArray() (padrão WA-Sync) | P0 |

**Regra de Negócio:**
> Histórico **nunca apaga dados**. É base para estado, relatórios e reativação.

**Subdomínio: RECOMENDAÇÃO**

| Capacidade | Descrição | Prioridade |
|------------|-----------|------------|
| `recommendation.products` | Sugerir produtos | P1 |
| `recommendation.messages` | Sugerir mensagens | P0 |
| `recommendation.actions` | Sugerir próximas ações | P2 |

**Regra de Negócio:**
> Recomendação **não executa sem permissão**. Baseada em histórico + cliente + contexto.

**Entidades:**
```typescript
interface Client {
  id: string;
  phone: string;
  name: string;
  whatsappId: string;
  
  // Histórico
  conversations: ConversationSummary[];
  orders: OrderSummary[];
  
  // Preferências
  preferences: {
    explicit: Record<string, unknown>;  // Declaradas pelo cliente
    implicit: Record<string, unknown>;  // Inferidas pelo sistema
  };
  
  // Organização
  tags: string[];
  notes: string[];
  
  // Localização
  geolocation?: {
    lat: number;
    lng: number;
    address?: string;
    zone?: string;
  };
  
  // Métricas
  metrics: {
    firstContact: Date;
    lastContact: Date;
    totalOrders: number;
    totalSpent: number;
    averageTicket: number;
    frequencyDays: number;
  };
  
  // Estado
  status: 'active' | 'inactive' | 'churned';
  inactiveDays: number;
}
```

---

### 3.3 PRODUTOS (Supporting Domain)

**Responsabilidade:** Catálogo de produtos e disponibilidade.

| Capacidade | Descrição | Prioridade |
|------------|-----------|------------|
| `product.catalog` | CRUD de produtos | P1 |
| `product.price` | Preço e variações | P1 |
| `product.category` | Categorização | P1 |
| `product.unit` | Unidade de medida | P1 |
| `product.availability` | Disponibilidade (real ou simbólica) | P1 |

**Entidades:**
```typescript
interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  
  // Preço
  price: number;
  unit: 'un' | 'kg' | 'g' | 'l' | 'ml' | 'porção';
  
  // Disponibilidade
  availability: {
    type: 'real' | 'symbolic';  // Real = estoque, Symbolic = "tem/não tem"
    status: 'available' | 'low' | 'unavailable';
    quantity?: number;
  };
  
  // Vitrine
  showcase: {
    order: number;
    highlight: boolean;
    shortText: string;
    imageId?: string;
  };
}
```

---

### 3.4 VITRINE (Supporting Domain)

**Responsabilidade:** Organizar produtos para exibição ao cliente.

| Capacidade | Descrição | Prioridade |
|------------|-----------|------------|
| `showcase.general` | Vitrine geral (todos clientes) | P1 |
| `showcase.personalized` | Vitrine por cliente | P2 |
| `showcase.order` | Ordenar produtos | P1 |
| `showcase.highlight` | Destacar produtos | P1 |
| `showcase.text` | Textos curtos para conversa | P1 |

**Regra de Negócio:**
> Vitrine serve para **facilitar o que pode ser dito na conversa**.

**Entidades:**
```typescript
interface Showcase {
  id: string;
  type: 'general' | 'personalized';
  clientId?: string;  // Se personalized
  
  products: {
    productId: string;
    order: number;
    highlight: boolean;
    customText?: string;
  }[];
  
  validFrom: Date;
  validUntil?: Date;
}
```

---

### 3.5 PEDIDOS (Core Domain)

**Responsabilidade:** Registrar e gerenciar acordos feitos na conversa.

| Capacidade | Descrição | Prioridade |
|------------|-----------|------------|
| `order.create` | Criar pedido a partir de conversa | P0 |
| `order.items` | Produtos, quantidades, valores | P0 |
| `order.status` | Status do pedido | P0 |
| `order.delivery_type` | Entrega ou retirada | P1 |
| `order.modify` | Alterar pedido (com rastro) | P1 |
| `order.cancel` | Cancelar pedido (com rastro) | P1 |
| `order.history` | Histórico de alterações | P1 |

**Regra de Negócio:**
> Pedido pode ser alterado ou cancelado, mas **sempre mantém rastro**.

**Entidades:**
```typescript
interface Order {
  id: string;
  clientId: string;
  conversationId: string;
  
  // Itens
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    notes?: string;
  }[];
  
  // Valores
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  
  // Entrega
  deliveryType: 'delivery' | 'pickup';
  deliveryAddress?: string;
  deliveryZone?: string;
  scheduledFor?: Date;
  
  // Status
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivering' | 'delivered' | 'cancelled';
  statusHistory: {
    status: string;
    changedAt: Date;
    changedBy: string;
    reason?: string;
  }[];
  
  // Pagamento
  paymentStatus: 'pending' | 'paid' | 'refunded';
  paymentMethod?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 3.6 ENTREGA (Supporting Domain)

**Responsabilidade:** Logística de entrega.

| Capacidade | Descrição | Prioridade |
|------------|-----------|------------|
| `delivery.zones` | Definir zonas de entrega | P2 |
| `delivery.pricing` | Valores por zona/distância | P2 |
| `delivery.calculate` | Calcular frete (auto ou manual) | P2 |
| `delivery.integrate` | Integrar com pedidos | P1 |

**Entidades:**
```typescript
interface DeliveryZone {
  id: string;
  name: string;
  type: 'radius' | 'polygon' | 'neighborhood';
  
  // Definição
  definition: {
    radius?: number;  // km
    polygon?: [number, number][];  // [lat, lng][]
    neighborhoods?: string[];
  };
  
  // Preço
  fee: number;
  freeAbove?: number;  // Frete grátis acima de X
  
  // Tempo
  estimatedMinutes: {
    min: number;
    max: number;
  };
  
  active: boolean;
}
```

---

### 3.7 FINANCEIRO (Supporting Domain)

**Responsabilidade:** Organização financeira básica.

| Capacidade | Descrição | Prioridade |
|------------|-----------|------------|
| `finance.entries` | Entradas (vendas) | P2 |
| `finance.exits` | Saídas (custos) | P2 |
| `finance.pix` | Integração Pix | P2 |
| `finance.bank` | Conexão com bancos | P3 |
| `finance.reconciliation` | Conciliação automática | P3 |
| `finance.reports` | Relatórios e dashboards | P2 |

**Regra de Negócio:**
> Base para **decisões**, não para contabilidade pesada. Simples e acionável.

**Entidades:**
```typescript
interface FinancialEntry {
  id: string;
  type: 'income' | 'expense';
  
  // Valor
  amount: number;
  currency: 'BRL';
  
  // Categorização
  category: string;
  subcategory?: string;
  
  // Origem
  source: 'order' | 'manual' | 'bank_import';
  orderId?: string;
  
  // Pagamento
  paymentMethod: 'pix' | 'cash' | 'card' | 'transfer' | 'other';
  
  // Conciliação
  reconciled: boolean;
  bankTransactionId?: string;
  
  // Timestamps
  date: Date;
  createdAt: Date;
}
```

---

### 3.8 MARKETING (Generic Domain)

**Responsabilidade:** Promoção de produtos e reativação de clientes.

#### 3.8.1 REATIVAÇÃO

| Capacidade | Descrição | Prioridade |
|------------|-----------|------------|
| `reactivation.detect` | Identificar clientes inativos | P1 |
| `reactivation.suggest` | Sugerir mensagem contextual | P1 |
| `reactivation.send` | Enviar (com aprovação) | P1 |
| `reactivation.history` | Respeitar histórico | P0 |

**Regra de Negócio:**
> Reativação **sempre respeita histórico**. Não é spam, é conversa retomada.

#### 3.8.2 TESTES A/B

| Capacidade | Descrição | Prioridade |
|------------|-----------|------------|
| `ab.messages.reply` | Testar mensagens de resposta | P3 |
| `ab.messages.reactivation` | Testar mensagens de reativação | P3 |
| `ab.products.description` | Testar descrições de produtos | P3 |
| `ab.timing` | Testar horários e abordagens | P3 |

#### 3.8.3 IMAGENS

| Capacidade | Descrição | Prioridade |
|------------|-----------|------------|
| `images.generate` | Criar imagens (IA) | P3 |
| `images.enhance` | Melhorar imagens | P3 |
| `images.catalog` | Catálogo com IDs | P2 |

#### 3.8.4 PERSONA

| Capacidade | Descrição | Prioridade |
|------------|-----------|------------|
| `persona.voice` | Tom de voz da marca | P2 |
| `persona.vocabulary` | Vocabulário permitido | P2 |
| `persona.scrape` | Extrair de site/Instagram/WhatsApp | P3 |
| `persona.align` | Alinhar respostas automáticas | P1 |

**Entidades:**
```typescript
interface Persona {
  id: string;
  name: string;
  
  // Tom de voz
  voice: {
    formality: 'formal' | 'neutral' | 'informal';
    warmth: 'cold' | 'neutral' | 'warm' | 'enthusiastic';
    humor: 'none' | 'subtle' | 'frequent';
  };
  
  // Vocabulário
  vocabulary: {
    preferred: string[];      // Palavras a usar
    avoided: string[];        // Palavras a evitar
    signature: string[];      // Expressões da marca
  };
  
  // Exemplos
  examples: {
    greeting: string[];
    farewell: string[];
    thanks: string[];
    apology: string[];
  };
  
  // Fonte
  source?: {
    website?: string;
    instagram?: string;
    whatsappSamples?: string[];
  };
}
```

---

### 3.9 INFRAESTRUTURA (Critical Domain)

**Responsabilidade:** Sistema invisível que mantém tudo funcionando. Garante que a extensão nunca pare.

#### 3.9.1 SELETORES AUTO-CORRIGÍVEIS

| Capacidade | Descrição | Prioridade |
|------------|-----------|------------|
| `selectors.fallback_chain` | Múltiplos seletores por elemento | P0 |
| `selectors.remote_fetch` | Buscar seletores de servidor remoto | P0 |
| `selectors.auto_update` | Atualizar seletores sem reinstalar | P0 |
| `selectors.monitor` | Detectar quebra antes do usuário | P1 |
| `selectors.report` | Reportar seletor quebrado automaticamente | P1 |
| `selectors.auto_mapping.manual` | Ativar via atalho de teclado (Ctrl+Shift+M) | P0 |
| `selectors.auto_mapping.auto` | Ativar automaticamente quando seletor quebra | P0 |
| `selectors.auto_mapping.scheduled` | Verificação agendada/periódica | P1 |
| `selectors.auto_mapping.hit_test` | Usar coordenadas de tela (elementFromPoint) | P0 |
| `selectors.auto_mapping.validate` | Validar 100% dos campos via loop tentativa/erro | P0 |
| `selectors.auto_mapping.update_remote` | Atualizar config remoto automaticamente | P0 |

**Regra de Negócio:**
> Correção de seletor quebrado em **menos de 1 minuto**. Nunca depender de um único seletor.

**Entidades:**
```typescript
interface SelectorDefinition {
  id: string;                    // Ex: "message_container"
  description: string;           // Ex: "Container de mensagem individual"
  selectors: string[];           // Fallback chain, ordem de prioridade
  lastVerified: Date;
  status: 'working' | 'broken' | 'unknown';
}

interface SelectorConfig {
  version: string;               // Ex: "2026.01.10"
  updatedAt: Date;
  selectors: Record<string, SelectorDefinition>;
  checkInterval: number;         // Minutos entre verificações
}

// Exemplo de uso:
const SELECTORS: SelectorConfig = {
  version: "2026.01.10",
  updatedAt: new Date(),
  checkInterval: 5,
  selectors: {
    message_container: {
      id: "message_container",
      description: "Container de mensagem individual",
      selectors: [
        '[data-testid="msg-container"]',      // Primário
        '[data-testid="message-container"]',  // Fallback 1
        '.message-in, .message-out',          // Fallback 2
        '[class*="message"]'                  // Fallback genérico
      ],
      lastVerified: new Date(),
      status: 'working'
    }
  }
};
```

**Subdomínio: PLUGIN SYSTEM**

Sistema de módulos desacoplados e auto-descobríveis que permite escalar para centenas de módulos sem acoplamento.

| Capacidade | Descrição | Prioridade |
|------------|-----------|------------|
| `plugin.registry` | Registry que descobre módulos automaticamente | P0 |
| `plugin.discovery` | Escanear pasta modules/ e carregar módulos | P0 |
| `plugin.hierarchy` | Suportar módulos dentro de módulos (parent/child) | P0 |
| `plugin.lazy_load` | Carregar módulos apenas quando necessário | P0 |
| `plugin.isolation` | Isolamento total entre módulos | P0 |
| `plugin.dependencies` | Resolver dependências entre módulos | P1 |
| `plugin.event_bus` | Comunicação entre módulos via eventos | P1 |

**Regra de Negócio:**
> Cada módulo é **independente**. Adicionar ou remover um módulo não deve afetar outros. Módulos se registram sozinhos.

**Arquitetura:**

```
┌─────────────────────────────────────────────────────────┐
│              PanelShell (Core - Núcleo)                  │
│  - Apenas navegação                                      │
│  - Gerencia ciclo de vida                                │
│  - NÃO conhece módulos específicos                       │
└──────────────────┬──────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│         ModuleRegistry (Descobre Módulos)                │
│  - Escaneia pasta modules/                               │
│  - Carrega *-module.ts automaticamente                  │
│  - Registra hierarquia (parent/child)                    │
│  - Resolve dependências                                  │
└──────────────────┬──────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│         Modules/ (Módulos Independentes)                 │
│  ├── atendimento/                                        │
│  │   ├── atendimento-module.ts                          │
│  │   └── context/                                       │
│  │       └── context-module.ts (sub-módulo)            │
│  ├── clientes/                                           │
│  │   ├── clientes-module.ts                             │
│  │   ├── history/                                        │
│  │   │   └── history-module.ts                          │
│  │   └── recommendation/                                │
│  │       └── recommendation-module.ts                     │
│  └── marketing/                                          │
│      ├── marketing-module.ts                             │
│      ├── reactivation/                                   │
│      │   └── reactivation-module.ts                     │
│      └── ab-tests/                                       │
│          └── ab-tests-module.ts                          │
└─────────────────────────────────────────────────────────┘
```

**Entidades:**

```typescript
interface ModuleDefinition {
  id: string;                    // Ex: "marketing.reactivation"
  name: string;                  // Ex: "Reativação"
  parent?: string;               // Ex: "marketing" (opcional)
  icon?: string;                 // Ex: "🔄"
  dependencies?: string[];       // Ex: ["core.message-db"]
  panel: PanelClass;             // Classe do painel
  lazy?: boolean;                // Carregar apenas quando necessário
}

interface ModuleRegistry {
  modules: Map<string, ModuleDefinition>;
  hierarchy: Map<string, string[]>;  // parent -> children[]
  
  register(module: ModuleDefinition): void;
  getModule(id: string): ModuleDefinition | null;
  getTopLevelModules(): ModuleDefinition[];
  getSubModules(parentId: string): ModuleDefinition[];
  discoverModules(): Promise<void>;
}

// Exemplo de módulo:
export const ReactivationModule: ModuleDefinition = {
  id: 'marketing.reactivation',
  name: 'Reativação',
  parent: 'marketing',
  icon: '🔄',
  dependencies: ['core.message-db'],
  panel: ReactivationPanel,
  lazy: true
};
```

**Fluxo de Descoberta:**

```
1. PanelShell inicializa
   └── Cria ModuleRegistry

2. ModuleRegistry.discoverModules()
   ├── Escaneia src/modules/**/*-module.ts
   ├── Importa cada arquivo
   └── Chama module.register(registry)

3. Cada módulo se registra
   └── registry.register({ id, name, parent, panel, ... })

4. PanelShell gera UI dinamicamente
   ├── getTopLevelModules() → Tabs principais
   ├── getSubModules(parentId) → Sub-menus
   └── Renderiza HTML automaticamente

5. Lazy loading quando necessário
   └── Carrega módulo apenas quando usuário clica na tab
```

**Vantagens:**
- ✅ **Isolamento total**: Módulos não conhecem outros módulos
- ✅ **Descoberta automática**: Não precisa editar panel.ts para adicionar
- ✅ **Hierarquia natural**: Módulos dentro de módulos via `parent`
- ✅ **Performance**: Lazy loading automático
- ✅ **Escalável**: Suporta centenas de módulos sem degradação

**Subdomínio: AUTO-MAPEAMENTO**

Sistema que reconstrói seletores em tempo real através de:
1. **Atalhos de teclado** para identificar elementos focados
2. **Hit Test (document.elementFromPoint)** para achar containers perdidos usando coordenadas de tela
3. **Loop de tentativa e erro** até validar 100% dos campos da API
4. **Atualização automática** do config remoto após sucesso

**Fluxo de Auto-Mapeamento:**

```
1. Trigger (manual/auto/scheduled)
   - Manual: Usuário pressiona Ctrl+Shift+M
   - Auto: Sistema detecta que seletor quebrou
   - Scheduled: Verificação periódica agendada

2. Identificar elementos a mapear
   - Via hit test: document.elementFromPoint(x, y)
   - Via foco: Elemento atual focado (Tab/Shift+Tab)
   - Via click: Elemento clicado pelo usuário

3. Para cada elemento:
   a. Gerar candidatos de seletor CSS
   b. Testar cada candidato no DOM
   c. Validar seletor funciona (encontra elemento correto)

4. Loop até 100% validado
   - Repetir passos 3a-3c até todos os campos validados
   - Registrar tentativas e resultados

5. Quando 100% validado:
   - Atualizar config remoto centralizado
   - Notificar todos os usuários da nova versão
   - Salvar log de mapeamento para auditoria
```

**Entidades:**

```typescript
interface AutoMappingSession {
  id: string;
  startedAt: Date;
  trigger: 'manual' | 'auto' | 'scheduled';
  
  // Elementos sendo mapeados
  targets: {
    selectorId: string;
    element: HTMLElement | null;
    coordinates?: { x: number; y: number };
    attempts: number;
    status: 'pending' | 'validating' | 'success' | 'failed';
  }[];
  
  // Resultados
  results: {
    selectorId: string;
    newSelector: string;
    validated: boolean;
    validatedAt?: Date;
  }[];
  
  // Status
  status: 'active' | 'validating' | 'completed' | 'failed';
  progress: number; // 0-100
}

interface AutoMappingResult {
  sessionId: string;
  selectorId: string;
  oldSelector: string;
  newSelector: string;
  validated: boolean;
  validatedAt: Date;
  updatedRemote: boolean;
  updatedAt?: Date;
}
```

**Regra de Negócio:**
> Auto-mapeamento deve validar **100% dos campos** antes de atualizar config remoto. Atualização é **centralizada** - resultado é enviado para servidor que distribui para todos os usuários.

**API Utilizada:**

- **`document.elementFromPoint(x, y)`**: API nativa do navegador para hit test
  - Retorna elemento DOM em coordenadas específicas
  - Usado para encontrar containers perdidos
  - Performance excelente (microsegundos)
  - Zero dependências externas
  - Funciona em produção dentro do content script

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

#### 3.9.2 CONFIGURAÇÕES REMOTAS (HOT-UPDATE)

| Capacidade | Descrição | Prioridade |
|------------|-----------|------------|
| `config.remote_fetch` | Buscar config de servidor | P0 |
| `config.local_fallback` | Fallback para config local se offline | P0 |
| `config.feature_flags` | Ligar/desligar features remotamente | P0 |
| `config.rollout` | Rollout gradual de features | P1 |
| `config.ab_test` | Testes A/B via config | P2 |

**Regra de Negócio:**
> Atualizações **nunca passam pela Chrome Web Store**. Config remota é a única fonte de verdade.

**Entidades:**
```typescript
interface RemoteConfig {
  version: string;
  updatedAt: Date;
  
  // Seletores DOM (atualizados frequentemente)
  selectors: SelectorConfig;
  
  // Feature flags
  features: {
    [featureId: string]: {
      enabled: boolean;
      rolloutPercentage: number;  // 0-100
      enabledForUsers?: string[]; // IDs específicos
    };
  };
  
  // Mensagens e textos
  messages: {
    [messageId: string]: string;
  };
  
  // Regras de negócio configuráveis
  rules: {
    rateLimit: {
      messagesPerMinute: number;
      scrapingPerMinute: number;
    };
    reactivation: {
      inactiveDaysThreshold: number;
    };
  };
  
  // Endpoints
  endpoints: {
    api: string;
    config: string;
    analytics: string;
  };
}

interface ConfigCache {
  config: RemoteConfig;
  fetchedAt: Date;
  expiresAt: Date;
  source: 'remote' | 'local_cache' | 'bundled';
}
```

---

### 3.10 SUPORTE (Critical Domain)

**Responsabilidade:** Suporte escalável por IA. Resolve 90% das dúvidas sem humano.

#### 3.10.1 DOCUMENTAÇÃO VIVA

| Capacidade | Descrição | Prioridade |
|------------|-----------|------------|
| `docs.auto_generate` | Gerar docs a partir do código | P1 |
| `docs.changelog_auto` | Changelog automático | P1 |
| `docs.error_solutions` | Cada erro gera sua solução | P0 |
| `docs.search` | Busca inteligente por problema | P1 |
| `docs.versioned` | Docs por versão do produto | P2 |

**Regra de Negócio:**
> **Tudo que funciona é documentado automaticamente.** O que é implementado, é explicado.

**Entidades:**
```typescript
interface DocumentationEntry {
  id: string;
  type: 'feature' | 'error' | 'faq' | 'changelog' | 'guide';
  
  // Conteúdo
  title: string;
  content: string;           // Markdown
  summary: string;           // Para busca e bot
  
  // Metadados
  version: string;           // Versão do produto
  createdAt: Date;
  updatedAt: Date;
  
  // Relações
  relatedErrors?: string[];  // IDs de erros relacionados
  relatedFeatures?: string[];
  
  // Analytics
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
}

interface KnownError {
  id: string;
  code: string;              // Ex: "SELECTOR_NOT_FOUND"
  message: string;
  
  // Solução
  solution: string;          // Markdown
  autoFixAvailable: boolean;
  autoFixAction?: string;    // Ex: "refetch_selectors"
  
  // Frequência
  occurrences: number;
  lastSeen: Date;
  
  // Status
  status: 'active' | 'resolved' | 'wont_fix';
}
```

#### 3.10.2 BOT DE SUPORTE IA

| Capacidade | Descrição | Prioridade |
|------------|-----------|------------|
| `bot.knowledge_base` | Acesso à base de conhecimento | P0 |
| `bot.context_aware` | Entender contexto do problema | P1 |
| `bot.step_by_step` | Guiar solução passo a passo | P1 |
| `bot.escalation` | Escalar para humano quando necessário | P1 |
| `bot.learn` | Aprender com resoluções anteriores | P2 |
| `bot.feedback` | Coletar feedback para melhorar | P1 |

**Regra de Negócio:**
> Bot resolve **90% das dúvidas**. Só escala para humano quando realmente necessário.

**Entidades:**
```typescript
interface SupportTicket {
  id: string;
  
  // Usuário
  userId: string;
  userEmail?: string;
  
  // Problema
  category: 'bug' | 'feature' | 'question' | 'billing';
  subject: string;
  description: string;
  
  // Contexto automático
  context: {
    extensionVersion: string;
    browserInfo: string;
    lastError?: string;
    screenshotUrl?: string;
  };
  
  // Resolução
  status: 'open' | 'bot_handling' | 'escalated' | 'resolved' | 'closed';
  resolution?: string;
  resolvedBy: 'bot' | 'human';
  
  // Histórico
  messages: {
    from: 'user' | 'bot' | 'human';
    content: string;
    timestamp: Date;
  }[];
  
  // Feedback
  satisfaction?: 1 | 2 | 3 | 4 | 5;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}
```

---

### 3.11 MONETIZAÇÃO (Critical Domain)

**Responsabilidade:** Cobrança justa e proteção contra pirataria.

#### 3.11.1 LICENCIAMENTO

| Capacidade | Descrição | Prioridade |
|------------|-----------|------------|
| `license.validate` | Validar licença no backend | P0 |
| `license.token` | Token único por usuário | P0 |
| `license.plans` | Diferentes planos (básico, pro, enterprise) | P1 |
| `license.trial` | Período de trial configurável | P1 |
| `license.grace_period` | Período de graça se pagamento falhar | P2 |

**Regra de Negócio:**
> **Validação sempre no backend.** Código client-side nunca decide se usuário pagou.

**Entidades:**
```typescript
interface License {
  id: string;
  userId: string;
  
  // Plano
  plan: 'free' | 'basic' | 'pro' | 'enterprise';
  
  // Validade
  status: 'active' | 'trial' | 'expired' | 'cancelled' | 'grace_period';
  startedAt: Date;
  expiresAt: Date;
  trialEndsAt?: Date;
  
  // Pagamento
  paymentMethod?: 'pix' | 'card' | 'boleto';
  lastPaymentAt?: Date;
  nextPaymentAt?: Date;
  
  // Limites do plano
  limits: {
    messagesPerDay: number;      // -1 = ilimitado
    contactsTotal: number;
    aiSuggestionsPerDay: number;
    historyDays: number;         // -1 = ilimitado
  };
  
  // Features do plano
  features: {
    reactivation: boolean;
    abTesting: boolean;
    multiDevice: boolean;
    prioritySupport: boolean;
    whiteLabel: boolean;
  };
}

interface LicenseValidation {
  valid: boolean;
  license?: License;
  error?: 'expired' | 'not_found' | 'suspended' | 'limit_exceeded';
  message?: string;
  
  // Cache
  validatedAt: Date;
  cacheUntil: Date;
}
```

#### 3.11.2 SEGURANÇA

| Capacidade | Descrição | Prioridade |
|------------|-----------|------------|
| `security.rate_limit` | Rate limiting por conta | P0 |
| `security.abuse_detection` | Detectar uso anormal | P1 |
| `security.auto_block` | Bloqueio automático de abuso | P1 |
| `security.audit_log` | Logs de auditoria | P2 |
| `security.webhooks` | Webhooks para integrações | P2 |

**Regra de Negócio:**
> **Código crítico nunca exposto no client.** Toda validação sensível acontece no backend.

**Entidades:**
```typescript
interface RateLimitConfig {
  userId: string;
  
  limits: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
  
  current: {
    minuteCount: number;
    hourCount: number;
    dayCount: number;
    resetAt: {
      minute: Date;
      hour: Date;
      day: Date;
    };
  };
  
  status: 'ok' | 'warning' | 'blocked';
  blockedUntil?: Date;
}

interface AuditLog {
  id: string;
  userId: string;
  
  // Ação
  action: string;              // Ex: "license.validate", "message.send"
  resource?: string;           // Ex: "contact:123"
  
  // Resultado
  success: boolean;
  error?: string;
  
  // Contexto
  ip: string;
  userAgent: string;
  
  // Timestamp
  timestamp: Date;
}

interface WebhookConfig {
  id: string;
  userId: string;
  
  // Configuração
  url: string;
  events: string[];            // Ex: ["order.created", "message.received"]
  secret: string;              // Para validar assinatura
  
  // Status
  active: boolean;
  lastTriggeredAt?: Date;
  failureCount: number;
}
```

---

### 3.12 AUTONOMIA (Regras do Sistema)

**Responsabilidade:** Regras para funcionamento autônomo do sistema e da IA.

#### 3.12.1 ESTABILIDADE

| Capacidade | Descrição | Prioridade |
|------------|-----------|------------|
| `stability.selector_first` | Se DOM quebrar, foco único é atualizar `selectors.json` | P0 |
| `stability.no_side_changes` | Não mexer em UI/lógica enquanto captura quebrada | P0 |
| `stability.ai_suggest_fix` | IA sugere correção de seletor antes de qualquer outra alteração | P0 |

**Regra de Negócio:**
> Seletor quebrado = **tudo para**. Nenhuma feature nova, nenhuma refatoração. Só consertar seletor.

#### 3.12.2 DEFINIÇÃO DE PRONTO

| Critério | Descrição | Obrigatório |
|----------|-----------|-------------|
| `done.no_any` | Código sem `any` | ✅ |
| `done.strict_ts` | TypeScript Strict mode | ✅ |
| `done.docs_updated` | Documentação atualizada com a nova função | ✅ |
| `done.conventional_commits` | Commits no padrão Conventional Commits | ✅ |
| `done.lint_clean` | Lint sem warnings | ✅ |

---

### 3.13 ENGENHARIA (Práticas Técnicas)

**Responsabilidade:** Garantir qualidade, rastreabilidade e integridade do sistema.

#### 3.13.1 MONITORAMENTO

| Capacidade | Descrição | Prioridade |
|------------|-----------|------------|
| `monitoring.truth_source` | Estado centralizado e único (banco local) | P0 |
| `monitoring.ai_logs` | Logs de execução para cada ação da IA | P1 |
| `monitoring.sync` | Sincronização entre banco local e interface | P1 |
| `monitoring.auto_clean` | Detecta e limpa dados corrompidos automaticamente | P2 |

#### 3.13.2 RASTREABILIDADE

| Capacidade | Descrição | Prioridade |
|------------|-----------|------------|
| `traceability.data_path` | Identifica o caminho de cada dado | P1 |
| `traceability.error_location` | Mostra onde o processo parou se houver erro | P1 |
| `traceability.state_before_action` | IA sabe o estado atual antes de agir | P0 |
| `traceability.telemetry` | Histórico de execução técnico | P2 |

#### 3.13.3 INTEGRIDADE

| Capacidade | Descrição | Prioridade |
|------------|-----------|------------|
| `integrity.pure_functions` | Verifica se as funções são puras e seguras | P1 |
| `integrity.no_duplicates` | Trava execuções duplicadas ou conflitantes | P1 |
| `integrity.validation` | Validação rigorosa de entrada e saída (Zod) | P0 |
| `integrity.local_truth` | Banco local é a fonte final da verdade | P0 |

**Regra de Negócio:**
> **Banco local é a verdade.** Se houver conflito, banco local vence.

---

## 4. Estado Atual vs. Planejado

### 4.1 Mapa de Implementação

| Domínio | Capacidade | Status | Arquivo |
|---------|------------|--------|---------|
| **ATENDIMENTO** | conversation.view | 🟡 Parcial | `src/ui/integrated-panel.js` |
| | conversation.reply.manual | ✅ Funciona | `src/core/whatsapp-adapter.js` |
| | conversation.reply.suggested | ✅ Funciona | `src/copilot/suggestion-engine.js` |
| | conversation.log | ⚪ Não existe | `src/core/message-capturer.js` (vazio) |
| **CLIENTES** | client.profile | ✅ Funciona | `src/crm/contacts.js` |
| | client.tags | ✅ Funciona | `src/crm/tags.js` |
| | client.history | ⚪ Não existe | - |
| **HISTÓRICO** | history.messages.store | ⚪ Não existe | `src/storage/message-db.js` (vazio) |
| **RECOMENDAÇÃO** | recommendation.messages | ✅ Funciona | `src/copilot/ai-service.js` |
| **PRODUTOS** | * | ⚪ Não existe | - |
| **VITRINE** | * | ⚪ Não existe | - |
| **PEDIDOS** | * | ⚪ Não existe | - |
| **ENTREGA** | * | ⚪ Não existe | - |
| **FINANCEIRO** | * | ⚪ Não existe | - |
| **MARKETING** | reactivation.* | ⚪ Não existe | - |
| | persona.* | ⚪ Não existe | - |
| **INFRAESTRUTURA** | selectors.fallback_chain | ⚪ Não existe | - |
| | selectors.remote_fetch | ⚪ Não existe | - |
| | config.remote_fetch | ⚪ Não existe | - |
| | config.feature_flags | ⚪ Não existe | - |
| **SUPORTE** | docs.error_solutions | ⚪ Não existe | - |
| | bot.knowledge_base | ⚪ Não existe | - |
| **MONETIZAÇÃO** | license.validate | ⚪ Não existe | - |
| | security.rate_limit | ⚪ Não existe | - |
| **AUTONOMIA** | stability.selector_first | ⚪ Não existe | - |
| | done.* | 🟡 Parcial | `.cursorrules` |
| **ENGENHARIA** | monitoring.truth_source | ⚪ Não existe | - |
| | traceability.* | ⚪ Não existe | - |
| | integrity.validation | ⚪ Não existe | - |

**Legenda:**
- ✅ Funciona: Código existe e funciona
- 🟡 Parcial: Código existe, funciona parcialmente
- ⚪ Não existe: Precisa ser implementado

### 4.2 Versão Atual: v1.2.0

**O que funciona hoje:**
- Chrome Extension carrega no WhatsApp Web
- UI como terceira coluna (painel integrado)
- Sugestões de IA via OpenAI/Claude
- Auto-responder básico com regras
- Gestão de contatos e tags

**O que NÃO funciona:**
- Captura de mensagens (arquivo vazio)
- Persistência em IndexedDB (arquivo vazio)
- Histórico completo de cliente
- Qualquer coisa de Produtos, Pedidos, Entrega, Financeiro, Marketing

---

## 5. Priorização (Roadmap)

### 5.1 Tiers de Prioridade

```
┌─────────────────────────────────────────────────────────────────┐
│                        TIER 0: FUNDAÇÃO                         │
│  Sem isso, nada funciona. Precisa estar 100% antes de avançar.  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CORE:                                                          │
│  • Message Capturer funcional (captura todas as mensagens)      │
│  • IndexedDB persistindo dados (histórico nunca se perde)       │
│  • Histórico visível no painel (prova que funciona)             │
│                                                                 │
│  INFRAESTRUTURA (Crítico desde dia 1):                          │
│  • Sistema de seletores com fallback chain                      │
│  • Servidor de config remota (pode ser JSON estático)           │
│  • Extensão buscando seletores do servidor                      │
│                                                                 │
│  SUPORTE (Crítico desde dia 1):                                 │
│  • Documentação básica de cada feature                          │
│  • FAQ de erros conhecidos                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       TIER 1: MVP BÁSICO                        │
│       Mínimo para validar com usuário real (1 padaria).         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CORE:                                                          │
│  • Perfil de cliente com histórico                              │
│  • Sugestões contextuais (baseado em histórico)                 │
│  • Reativação básica (detectar cliente inativo + sugerir msg)   │
│  • Produtos simples (catálogo manual)                           │
│                                                                 │
│  INFRAESTRUTURA:                                                │
│  • Feature flags funcionando                                    │
│  • Monitoramento de seletores quebrados                         │
│                                                                 │
│  MONETIZAÇÃO:                                                   │
│  • Validação de licença no backend (free tier)                  │
│  • Rate limiting básico                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TIER 2: MVP COMPLETO                       │
│          Produto vendável para early adopters.                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CORE:                                                          │
│  • Pedidos (criar, status, histórico)                           │
│  • Vitrine do dia                                               │
│  • Persona (tom de voz configurável)                            │
│  • Dashboard com métricas básicas                               │
│                                                                 │
│  SUPORTE:                                                       │
│  • Bot de suporte IA funcionando                                │
│  • Base de conhecimento indexada                                │
│                                                                 │
│  MONETIZAÇÃO:                                                   │
│  • Planos pagos (básico, pro)                                   │
│  • Integração com gateway de pagamento                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       TIER 3: ESCALA                            │
│              Features para crescer e reter (100k usuários).     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CORE:                                                          │
│  • Entrega (zonas, cálculo de frete)                            │
│  • Financeiro (entradas, saídas, Pix)                           │
│  • Marketing (testes A/B, imagens)                              │
│  • Multi-atendente                                              │
│                                                                 │
│  INFRAESTRUTURA:                                                │
│  • Monitoramento 24/7 de seletores                              │
│  • Rollout gradual de features                                  │
│  • CDN para assets e config                                     │
│                                                                 │
│  SUPORTE:                                                       │
│  • Bot IA com aprendizado contínuo                              │
│  • Sistema de tickets com escalation                            │
│                                                                 │
│  MONETIZAÇÃO:                                                   │
│  • Plano enterprise                                             │
│  • Webhooks para integrações                                    │
│  • White-label                                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Próxima Sprint: TIER 0

| # | Área | Task | Descrição | Estimativa |
|---|------|------|-----------|------------|
| 1 | Core | `message-capturer.ts` | Captura de mensagens via DOM | 4h |
| 2 | Core | `message-db.ts` | Persistência IndexedDB | 4h |
| 3 | Core | Integração | Mensagem capturada → salva automaticamente | 2h |
| 4 | Core | UI de histórico | Exibir mensagens capturadas no painel | 3h |
| 5 | Infra | `selector-config.json` | Arquivo JSON com seletores e fallbacks | 2h |
| 6 | Infra | `selector-manager.ts` | Busca seletores, tenta fallbacks | 3h |
| 7 | Infra | Servidor config | JSON estático (GitHub Pages ou CDN) | 1h |
| 8 | Suporte | `README.md` atualizado | Documentação de instalação e uso | 2h |
| 9 | Suporte | `TROUBLESHOOTING.md` | FAQ de erros conhecidos | 1h |
| 10 | QA | Testes E2E | Validar fluxo completo com Playwright | 3h |

**Total estimado:** ~25h (~3-4 dias de trabalho focado)

---

## 6. Decisões Arquiteturais (ADRs)

### ADR-001: Client-Side First
**Decisão:** Todo processamento no navegador, sem servidor.  
**Razão:** Privacidade, custo zero, escalabilidade natural.  
**Consequência:** Dados ficam no dispositivo, sync futuro será opcional.

### ADR-002: Human-in-the-Loop
**Decisão:** IA nunca age sozinha, sempre precisa aprovação.  
**Razão:** Evitar erros catastróficos, manter confiança, compliance.  
**Consequência:** Menos automação agressiva, mais controle para usuário.

### ADR-003: Histórico Imutável
**Decisão:** Nunca deletar dados de histórico.  
**Razão:** Base para IA, reativação, relatórios.  
**Consequência:** Storage cresce indefinidamente, precisa estratégia de archive.

### ADR-004: Modularidade por Domínio
**Decisão:** Cada bounded context em pasta separada.  
**Razão:** Substituir partes sem quebrar todo.  
**Consequência:** Mais arquivos, mas menos acoplamento.

### ADR-005: TypeScript Obrigatório
**Decisão:** Todo código novo em TypeScript.  
**Razão:** Type safety, documentação automática, menos bugs.  
**Consequência:** Migrar código existente gradualmente.

### ADR-006: Seletores Auto-Corrigíveis
**Decisão:** Sistema de fallback chain com múltiplos seletores por elemento + fetch remoto.  
**Razão:** WhatsApp muda seletores frequentemente, extensão não pode quebrar.  
**Consequência:** Requer servidor para hospedar config de seletores (pode ser estático/CDN).

### ADR-007: Hot-Update via Config Remota
**Decisão:** Configurações (seletores, features, regras) vêm de servidor remoto, não da extensão.  
**Razão:** Chrome Web Store demora 1-7 dias para aprovar updates.  
**Consequência:** Extensão busca config ao iniciar e periodicamente. Fallback para cache local.

### ADR-008: Suporte Self-Service por IA
**Decisão:** Bot de IA como primeira linha de suporte, documentação auto-gerada.  
**Razão:** 100k usuários = 1.000 tickets/dia impossível de atender manualmente.  
**Consequência:** Investir em base de conhecimento antes de escalar usuários.

### ADR-009: Validação de Licença no Backend
**Decisão:** Toda validação de pagamento/licença acontece no servidor.  
**Razão:** Código JavaScript pode ser facilmente modificado/pirateado.  
**Consequência:** Requer backend mesmo para plano gratuito (para validar que é gratuito).

### ADR-010: Arquitetura para 100k Desde o Dia 1
**Decisão:** Infraestrutura, Suporte e Monetização são domínios críticos desde o início.  
**Razão:** Refatorar depois é muito mais caro do que planejar antes.  
**Consequência:** Mais trabalho inicial, mas escala suave.

---

## 7. Design Sistêmico

### 7.1 Design Global
- Inspirado no WhatsApp Web
- Aparência nativa do sistema
- Mínimo atrito entre Chrome e WhatsApp
- Terceira coluna, não popup flutuante

### 7.2 Design por Capacidade
- Cada domínio terá sua própria UI quando necessário
- UI de Atendimento = central de conversas
- UI de Clientes = perfil expandido
- UI de Produtos = catálogo visual
- UI de Pedidos = lista com status
- UI de Relatórios = dashboards

---

## 8. Glossário

| Termo | Definição |
|-------|-----------|
| **Conversa** | Thread de mensagens com um cliente |
| **Cliente** | Pessoa que interage via WhatsApp |
| **Pedido** | Acordo comercial registrado a partir de conversa |
| **Reativação** | Retomar conversa com cliente inativo |
| **Vitrine** | Produtos organizados para exibição |
| **Contexto** | Informações do momento (dia, hora, clima) |
| **Persona** | Identidade de voz da marca |
| **Human-in-the-loop** | Humano sempre aprova ações da IA |
| **Seletor** | Query CSS que identifica elemento no DOM do WhatsApp |
| **Fallback Chain** | Lista ordenada de seletores alternativos |
| **Hot-Update** | Atualização sem passar pela Chrome Web Store |
| **Config Remota** | Configurações buscadas de servidor externo |
| **Feature Flag** | Toggle para ligar/desligar funcionalidade remotamente |
| **Documentação Viva** | Docs gerados automaticamente do código |
| **Bot de Suporte** | IA que responde dúvidas antes de humano |
| **Licença** | Permissão de uso vinculada a pagamento |
| **Rate Limiting** | Controle de frequência de ações |
| **Autonomia** | Regras para funcionamento autônomo do sistema |
| **Estabilidade** | Prioridade máxima: manter seletores funcionando |
| **Definição de Pronto** | Critérios obrigatórios para considerar tarefa completa |
| **Truth Source** | Fonte única da verdade (banco local) |
| **Rastreabilidade** | Capacidade de seguir o caminho de cada dado |
| **Integridade** | Garantia de que dados são válidos e consistentes |

---

## 9. Documentos Relacionados

| Documento | Propósito |
|-----------|-----------|
| `project_concept.md` | Visão conceitual original |
| `tech_stack.md` | Stack técnica detalhada |
| `progress.md` | Status de implementação |
| `.cursorrules` | Regras para o Cursor AI |
| `docs/ARCHITECTURE_DIAGRAM.md` | Diagramas visuais |
| `CHANGELOG.md` | Histórico de versões |

---

> **Este documento é a fonte de verdade para o que o Mettri é e faz.**  
> Atualize sempre que houver mudanças na visão, arquitetura ou prioridades.
