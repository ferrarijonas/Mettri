# Diagrama de Arquitetura - Mettri CRM

## Visão Geral do Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                    WhatsApp Web (Browser)                      │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              Chrome Extension (Mettri CRM)                │ │
│  │                                                            │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │              WhatsApp Core Module                    │ │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │ │ │
│  │  │  │   Sender     │  │   Capturer   │  │  Scraper  │ │ │ │
│  │  │  │  (Rate Lim)  │  │  (Real-time) │  │  (Batch)   │ │ │ │
│  │  │  └──────┬───────┘  └──────┬───────┘  └─────┬───────┘ │ │ │
│  │  │         │                 │                │          │ │ │
│  │  │  ┌──────┴─────────────────┴────────────────┴──────┐ │ │ │
│  │  │  │         Policy Enforcer + Rate Limiter          │ │ │ │
│  │  │  └─────────────────────────────────────────────────┘ │ │ │
│  │  └──────────────────────┬──────────────────────────────┘ │ │
│  │                         │                                 │ │
│  │  ┌──────────────────────┴──────────────────────────────┐ │ │
│  │  │         Message Processor (Enrichment)             │ │ │
│  │  └──────────────────────┬──────────────────────────────┘ │ │
│  │                         │                                 │ │
│  │  ┌──────────────────────┴──────────────────────────────┐ │ │
│  │  │         MessageDB (IndexedDB)                      │ │ │
│  │  │  - Local Storage                                   │ │ │
│  │  │  - 10k messages cached                            │ │ │
│  │  └────────────────────────────────────────────────────┘ │ │
│  │                                                          │ │
│  │  ┌────────────────────────────────────────────────────┐ │ │
│  │  │         Integrated Panel (UI)                       │ │ │
│  │  │  - Dashboard                                        │ │ │
│  │  │  - Statistics                                       │ │ │
│  │  │  - Message List                                    │ │ │
│  │  └────────────────────────────────────────────────────┘ │ │
│  │                                                          │ │
│  │  ┌────────────────────────────────────────────────────┐ │ │
│  │  │         AI Copilot (Future)                        │ │ │
│  │  │  - Suggestions                                     │ │ │
│  │  │  - Auto-responder                                  │ │ │
│  │  └────────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Fluxo de Envio de Mensagem

```
┌──────────┐
│  Usuário │
└────┬─────┘
     │ 1. Solicita envio
     ▼
┌─────────────────────┐
│  WhatsAppCore       │
│  .sendMessage()     │
└────┬────────────────┘
     │ 2. Valida
     ▼
┌─────────────────────┐
│  Policy Enforcer    │
│  - No spam?         │
│  - Unsolicited?     │
│  - Daily limit?     │
└────┬────────────────┘
     │ 3. Aprova
     ▼
┌─────────────────────┐
│  Rate Limiter       │
│  - Token bucket     │
│  - Aguarda token    │
└────┬────────────────┘
     │ 4. Token disponível
     ▼
┌─────────────────────┐
│  Message Sender     │
│  - Simula clique    │
│  - Envia via DOM    │
└────┬────────────────┘
     │ 5. Enviado
     ▼
┌─────────────────────┐
│  Message Capturer   │
│  - Detecta no DOM   │
│  - Captura          │
└────┬────────────────┘
     │ 6. Processa
     ▼
┌─────────────────────┐
│  Message Processor  │
│  - Enriquece        │
│  - Calcula metadata │
└────┬────────────────┘
     │ 7. Salva
     ▼
┌─────────────────────┐
│  MessageDB          │
│  - IndexedDB        │
└────┬────────────────┘
     │ 8. Atualiza UI
     ▼
┌─────────────────────┐
│  Integrated Panel   │
│  - Stats atualizados│
└─────────────────────┘
```

## Fluxo de Captura de Mensagem

```
┌─────────────────────┐
│  WhatsApp Web       │
│  (Recebe mensagem)  │
└────┬────────────────┘
     │ 1. Renderiza no DOM
     ▼
┌─────────────────────┐
│  MutationObserver   │
│  (Detecta mudança)  │
└────┬────────────────┘
     │ 2. Notifica
     ▼
┌─────────────────────┐
│  Message Capturer   │
│  - Valida elemento  │
│  - Extrai dados     │
└────┬────────────────┘
     │ 3. Processa
     ▼
┌─────────────────────┐
│  Message Processor  │
│  - Enriquece        │
│  - Calcula metadata │
└────┬────────────────┘
     │ 4. Salva
     ▼
┌─────────────────────┐
│  MessageDB          │
│  - IndexedDB        │
└────┬────────────────┘
     │ 5. Atualiza UI
     ▼
┌─────────────────────┐
│  Integrated Panel   │
│  - Stats atualizados│
└─────────────────────┘
```

## Fluxo de Scraping de Contatos

```
┌──────────┐
│  Usuário │
└────┬─────┘
     │ 1. Solicita scraping
     ▼
┌─────────────────────┐
│  WhatsAppCore       │
│  .scrapeContacts()  │
└────┬────────────────┘
     │ 2. Abre lista
     ▼
┌─────────────────────┐
│  Contact Scraper    │
│  - Scroll suave     │
│  - Aguarda render   │
└────┬────────────────┘
     │ 3. Processa batch
     ▼
┌─────────────────────┐
│  Rate Limiter       │
│  - Aguarda token    │
└────┬────────────────┘
     │ 4. Extrai dados
     ▼
┌─────────────────────┐
│  Contact Scraper    │
│  - Extrai 50        │
│  - Pausa 500ms      │
└────┬────────────────┘
     │ 5. Próximo batch
     ▼
     ... (repetir até fim)
     │
     ▼
┌─────────────────────┐
│  Retorna contatos   │
└─────────────────────┘
```

## Arquitetura de Escalabilidade

```
┌─────────────────────────────────────────────────────────────┐
│                    100k Usuários                            │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌───────────────┐              ┌──────────────────┐
│  Client-Side │              │   Backend API    │
│  (Extensão)  │              │   (Opcional)     │
│              │              │                  │
│  - 100% local│◄─────────────►│  - Sync          │
│  - IndexedDB │              │  - Analytics     │
│  - Zero cost │              │  - Backup        │
└───────────────┘              └──────────────────┘
```

## Módulos e Dependências

```
WhatsAppCore
├── depends on: MessageProcessor
├── depends on: MessageDB
└── used by: IntegratedPanel, AI Copilot

MessageProcessor
├── depends on: MessageDB
└── used by: WhatsAppCore, DOMObserver

MessageDB
└── used by: MessageProcessor, IntegratedPanel

IntegratedPanel
├── depends on: MessageDB
└── depends on: WhatsAppCore (status)
```

## Rate Limiting - Token Bucket

```
┌─────────────────────┐
│   Token Bucket      │
│                     │
│  Capacity: 20       │
│  Refill: 1/sec      │
│  Jitter: 20%        │
│                     │
│  [████████████] 15  │
│                     │
│  Consume(1) → 14    │
│  Wait 1s → 15        │
│  Wait 1s → 16       │
│  ...                │
└─────────────────────┘
```

## Compliance Flow

```
┌─────────────────────┐
│   Action Request    │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│  Policy Enforcer   │
│                     │
│  ✓ No spam?         │
│  ✓ Unsolicited?     │
│  ✓ Daily limit?      │
│  ✓ Pattern OK?       │
└────┬────────────────┘
     │
     ├─→ ❌ Blocked → Log + Alert
     │
     └─→ ✅ Approved → Rate Limiter
```

## Estrutura de Arquivos Proposta

```
src/
├── whatsapp/
│   └── core/
│       ├── index.js              # API pública
│       ├── connection-manager.js
│       ├── message-sender.js
│       ├── message-capturer.js   # (mover de src/core/)
│       ├── contact-scraper.js
│       ├── search-engine.js
│       ├── rate-limiter.js
│       ├── policy-enforcer.js
│       └── utils/
│           ├── dom-helpers.js
│           ├── selectors.js
│           └── validators.js
├── core/
│   ├── message-processor.js      # (manter)
│   ├── dom-observer.js            # (simplificado)
│   └── orchestrator.js
├── storage/
│   ├── message-db.js             # (manter)
│   └── local-storage.js
└── ui/
    └── integrated-panel.js
```











