# Documentação Técnica - Mettri CRM

## Índice

### 📋 Visão Geral
- **[Executive Summary](./EXECUTIVE_SUMMARY.md)** - Resumo executivo da arquitetura proposta
- **[Architecture Diagram](./ARCHITECTURE_DIAGRAM.md)** - Diagramas visuais da arquitetura

### 🏗️ Arquitetura
- **[Architecture Scalability](./ARCHITECTURE_SCALABILITY.md)** - Arquitetura pensada para 100k usuários
- **[WhatsApp Core Module](./WHATSAPP_CORE_MODULE.md)** - Design detalhado do módulo WhatsApp Core

### 🔧 Módulos
- **[Message Capturer](./MESSAGE_CAPTURER.md)** - Documentação do módulo de captura de mensagens

---

## Visão Geral

O Mettri CRM é uma extensão Chrome que integra IA, auto-responder e CRM diretamente no WhatsApp Web, mantendo compliance com políticas do WhatsApp e escalabilidade para 100k usuários.

## Princípios de Design

1. **Modularidade Extrema**: Cada módulo tem responsabilidade única
2. **Rate Limiting Inteligente**: Respeita limites do WhatsApp enquanto maximiza throughput
3. **Compliance por Design**: Arquitetura que facilita compliance, não apenas "não quebrar regras"
4. **Observabilidade Total**: Métricas, logs e rastreamento em todos os pontos críticos
5. **Fail-Safe**: Sistema continua funcionando mesmo com falhas parciais

## Arquitetura Atual

```
WhatsApp Web
  └── Chrome Extension (Mettri CRM)
      ├── MessageCapturer (captura mensagens)
      ├── MessageProcessor (enriquece dados)
      ├── MessageDB (armazena localmente)
      └── IntegratedPanel (UI integrada)
```

## Arquitetura Proposta

```
WhatsApp Web
  └── Chrome Extension (Mettri CRM)
      ├── WhatsAppCore (módulo dedicado)
      │   ├── MessageSender (envio com rate limiting)
      │   ├── MessageCapturer (captura)
      │   ├── ContactScraper (scraping)
      │   ├── SearchEngine (busca)
      │   ├── RateLimiter (controle de frequência)
      │   └── PolicyEnforcer (compliance)
      ├── MessageProcessor (enriquece dados)
      ├── MessageDB (armazena localmente)
      └── IntegratedPanel (UI integrada)
```

## Roadmap

### ✅ Fase 1: Fundação (Concluída)
- Captura de mensagens
- Armazenamento local (IndexedDB)
- UI integrada

### 🚧 Fase 2: WhatsApp Core (Em Planejamento)
- Rate Limiter
- Message Sender
- Policy Enforcer
- Migração do MessageCapturer

### 📋 Fase 3: Scraping e Busca (Planejado)
- Contact Scraper
- Search Engine
- Indexação otimizada

### 🚀 Fase 4: Escalabilidade (Futuro)
- Web Workers
- Lazy Loading
- Métricas e Observabilidade
- Backend Opcional

## Decisões de Design

### Por que Client-Side First?

1. **Privacidade**: Dados nunca saem do navegador do usuário
2. **Performance**: Sem latência de rede
3. **Custo**: Sem servidores para 100k usuários
4. **Simplicidade**: Menos infraestrutura

### Por que Módulo WhatsApp Core?

1. **Separação de Responsabilidades**: WhatsApp é complexo, merece módulo próprio
2. **Testabilidade**: Testar interações com WhatsApp isoladamente
3. **Manutenção**: Mudanças no WhatsApp afetam apenas este módulo
4. **Reutilização**: Outros módulos podem usar WhatsAppCore

### Por que Rate Limiting no Módulo?

1. **Centralizado**: Um lugar para controlar tudo
2. **Consistente**: Mesmos limites em todas as ações
3. **Configurável**: Usuário pode ajustar (dentro de limites seguros)

## Compliance

### O que é permitido?

✅ **Permitido:**
- Automação de ações que usuário faria manualmente
- Scraping de dados da própria conta do usuário
- Uso de IA para sugestões (não envio automático)
- Análise de conversas para insights

### Estratégia: "Human-in-the-Loop"

```
Usuário → IA Sugere → Usuário Aprova → Envia
```

**Por que funciona:**
- Usuário sempre tem controle final
- IA apenas sugere, não decide
- Padrões são humanos (variações, pausas)
- Compliance garantido por design

## Contribuindo

Antes de implementar qualquer funcionalidade, consulte a documentação relevante:

1. **Arquitetura**: Leia `ARCHITECTURE_SCALABILITY.md`
2. **Módulo específico**: Leia a documentação do módulo
3. **Design**: Discuta mudanças significativas antes de implementar

## Perguntas Frequentes

### Por que não usar backend desde o início?

Backend adiciona complexidade, custo e latência. Começamos client-side e adicionamos backend opcional no futuro se necessário.

### Como garantir que não seremos banidos pelo WhatsApp?

1. Rate limiting rigoroso (mais conservador que limites do WhatsApp)
2. Policy enforcement automático
3. Padrões human-like (variações, pausas)
4. Transparência total (usuário vê o que está sendo feito)

### Como escalar para 100k usuários?

Cada usuário tem sua própria extensão (client-side). Não há estado compartilhado, então escalabilidade é horizontal natural. Backend opcional pode ser adicionado para sincronização, mas não é obrigatório.

## Contato

Para discussões sobre arquitetura ou design, consulte os documentos relevantes ou abra uma issue.











