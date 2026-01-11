# Changelog - Mettri WhatsApp Copiloto CRM

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

---

## [1.2.0] - 2024-12-23

### Adicionado
- **Mettri Sentinela** (`src/whatsapp/core/`): A parte física do copiloto - módulo completo para interação com WhatsApp Web
  - `actions-map.js`: Mapeamento completo de TODAS as ações possíveis no WhatsApp Web
  - `action-executor.js`: Executor robusto que tenta múltiplos métodos (clique, teclado, DOM)
  - `index.js`: API pública do WhatsApp Core
- **Aba "Sentinela" no Painel**: Interface completa para visualizar e acompanhar todas as ações disponíveis
  - Lista todas as ações mapeadas por categoria
  - Histórico de ações executadas em tempo real
  - Gravação de ações (toggle para ativar/desativar)
  - Estatísticas de execução (total, sucesso, taxa de sucesso)
- **Sistema de Gravação**: Histórico completo de todas as ações executadas
- **Executor Robusto**: Tenta múltiplos métodos para garantir que ações funcionem:
  - Keyboard (teclado) - mais confiável
  - Click (clique) - funciona na maioria dos casos
  - DOM (manipulação direta) - fallback quando outros falham
  - Scroll (rolagem) - para ações de navegação

### Ações Mapeadas
O sistema mapeia mais de 30 ações do WhatsApp Web, incluindo:
- **Mensagens**: Enviar, responder, encaminhar, deletar, marcar, copiar
- **Contatos**: Abrir chat, buscar, criar grupo, arquivar, silenciar, fixar
- **Navegação**: Rolar para cima/baixo, ir para topo/final
- **Informações**: Abrir info do contato, ver mídia, ver links
- **Grupos**: Adicionar/remover participante, sair do grupo
- **Configurações**: Abrir configurações

### Modificado
- `src/core/message-capturer.js`: **OTIMIZADO** para ser mais rápido e sempre ativo
  - Debouncing de scans (50ms)
  - Processamento em batch paralelo
  - Polling de segurança mais frequente (2s)
  - Menos tentativas, mais rápidas
- `src/ui/integrated-panel.js`: Adicionada aba "Ações" com interface completa
- `content/inject.js`: Adicionado carregamento dos módulos Mettri Sentinela

### Performance
- Captura de mensagens mais rápida (processamento em batch paralelo)
- Debouncing reduz scans desnecessários
- Polling otimizado (2s em vez de 5s)
- Interface responsiva (atualizações não bloqueiam UI)

---

## [1.1.0] - 2024-12-23

### Adicionado
- **Sistema de Captura de Mensagens**: Captura automática de todas as mensagens em tempo real
- **Message Capturer** (`src/core/message-capturer.js`): Módulo dedicado exclusivamente à captura de mensagens (arquitetura modular)
- **IndexedDB Storage** (`src/storage/message-db.js`): Banco de dados local para armazenar mensagens
- **Message Processor** (`src/core/message-processor.js`): Processador que enriquece mensagens com metadados para IA
- **Visualizador de Mensagens**: Dashboard atualizado com lista de mensagens capturadas
- **Exportação JSON**: Botão para exportar todas as mensagens em formato AI-friendly
- **Métricas por Fonte**: Contadores separados para mensagens Manual, Mettri e Auto-responder
- **Documentação**: `docs/MESSAGE_CAPTURER.md` - Documentação técnica completa do módulo de captura

### Estrutura de Dados (AI-Friendly)
Cada mensagem capturada contém:
- `id`: Identificador único
- `chatId`: ID do contato/chat
- `chatName`: Nome do contato
- `content`: Conteúdo da mensagem
- `contentType`: Tipo (text, image, audio, video, document, sticker)
- `direction`: incoming ou outgoing
- `source`: manual, mettri ou autoresponder
- `timestamp`: Momento da mensagem
- `capturedAt`: Momento da captura
- `responseTime`: Tempo de resposta (ms)
- `conversationPhase`: new, ongoing ou closing
- `isFirstContact`: Se é primeiro contato

### Modificado
- `content/inject.js`: Adicionado carregamento do MessageCapturer
- `src/core/dom-observer.js`: **REFATORADO** - Simplificado para apenas observar DOM (captura movida para MessageCapturer)
- `src/core/orchestrator.js`: Inicialização do MessageCapturer em vez de DOMObserver
- `src/ui/integrated-panel.js`: Dashboard redesenhado com estatísticas do MessageDB

### Refatoração Arquitetural
- **Separação de Responsabilidades**: Captura de mensagens isolada no módulo `MessageCapturer`
- **DOMObserver Simplificado**: Agora apenas observa e notifica, sem lógica de captura
- **Arquitetura Modular**: Cada módulo tem responsabilidade única e bem definida

---

## [1.0.0] - 2024-12-23

### Adicionado
- **Base Estável**: Primeira versão funcional da extensão
- **Painel Integrado**: UI como terceira coluna do WhatsApp (sem quebrar layout)
- **Tabs**: Dashboard, Copiloto, Auto-responder, CRM
- **Persistência de Estado**: Lembra se painel estava aberto/fechado
- **Botão Toggle**: Botão flutuante verde para abrir/fechar painel

### Arquitetura
- Manifest V3
- Content Scripts com injeção no Main World
- Módulos: WhatsAppAPI, WhatsAppAdapter, DOMObserver
- Storage: chrome.storage.local

### Arquivos Principais
- `manifest.json`: Configuração da extensão
- `content/inject.js`: Injetor de scripts
- `src/core/orchestrator.js`: Orquestrador de inicialização
- `src/ui/integrated-panel.js`: Painel lateral integrado
- `background/service-worker.js`: Service worker

---

## Roadmap Futuro

### v1.2.0 (Planejado)
- [ ] Integração real com OpenAI/Claude para sugestões
- [ ] Auto-responder funcional com regras
- [ ] Disparador de mensagens programático

### v1.3.0 (Planejado)
- [ ] Varredura de conversas sob demanda
- [ ] Importação de histórico
- [ ] Backend na nuvem para sync

---

## Como Testar

1. Abra `chrome://extensions/`
2. Clique em "Atualizar" na extensão Mettri
3. Dê F5 no WhatsApp Web
4. Converse normalmente - as mensagens serão capturadas
5. Abra o painel (botão verde) para ver as estatísticas

