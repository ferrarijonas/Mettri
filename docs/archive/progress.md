# Progress - Mettri

> Sincronizado com GitHub Milestones e Issues
> Baseado em: `project_concept.md`, `project_context.md`, `tech_stack.md`

---

## Tier 0 - Fundacao

### Bloco 0.1: Setup GitHub

| ID | Tarefa | Status | Issue |
|----|--------|--------|-------|
| T0-001 | Criar repositorio Mettri no GitHub | Concluido | - |
| T0-002 | Configurar Milestone "Tier 0 - Fundacao" | Concluido | - |
| T0-003 | Criar labels padrao | Concluido | - |
| T0-004 | Criar issues para cada tarefa | Pendente | - |

### Bloco 0.2: Setup Projeto

| ID | Tarefa | Status | Issue |
|----|--------|--------|-------|
| T0-005 | Criar .gitignore, LICENSE, .editorconfig | Concluido | #1 |
| T0-006 | Criar .prettierrc e eslint.config.js | Concluido | #2 |
| T0-007 | Criar .github/ (CI, templates) | Concluido | #3 |
| T0-008 | Mover codigo antigo para legacy/ | Concluido | #4 |

### Bloco 0.3: Setup TypeScript

| ID | Tarefa | Status | Issue |
|----|--------|--------|-------|
| T0-009 | Criar package.json | Concluido | #5 |
| T0-010 | Criar tsconfig.json | Concluido | #5 |
| T0-011 | Criar esbuild.config.js | Concluido | #5 |
| T0-012 | Criar manifest.json v3 | Concluido | #6 |

### Bloco 0.4: UI no WhatsApp

| ID | Tarefa | Status | Issue |
|----|--------|--------|-------|
| T0-013 | Criar panel.css | Concluido | #7 |
| T0-014 | Criar panel.ts | Concluido | #7 |
| T0-015 | Criar content/main.ts | Concluido | #8 |

### Bloco 0.4.5: Auto-Mapeamento de Seletores (URGENTE)

**PRIORIDADE CRÍTICA:** Esta funcionalidade foi priorizada porque a captura de mensagens (Bloco 0.5) depende diretamente de seletores funcionais. Sem auto-mapeamento, qualquer mudança no DOM do WhatsApp quebra a captura.

| ID | Tarefa | Status | Issue |
|----|--------|--------|-------|
| T0-015.1 | Documentar auto-mapeamento em project_concept.md | Concluido | - |
| T0-015.2 | Documentar auto-mapeamento em project_context.md | Concluido | - |
| T0-015.3 | Documentar auto-mapeamento em tech_stack.md | Concluido | - |
| T0-015.4 | Criar infrastructure/auto-mapper.ts | Pendente | - |
| T0-015.5 | Implementar atalho de teclado (Ctrl+Shift+M) | Pendente | - |
| T0-015.6 | Implementar hit test (document.elementFromPoint) | Pendente | - |
| T0-015.7 | Implementar loop de validação (tentativa/erro) | Pendente | - |
| T0-015.8 | Implementar atualização automática do config remoto | Pendente | - |
| T0-015.9 | Integrar auto-mapper com selector-manager | Pendente | - |
| T0-015.10 | Testes E2E do auto-mapeamento | Pendente | - |

**Dependência:** Bloco 0.5 (Captura de Mensagens) requer seletores funcionais. Auto-mapeamento garante que seletores sejam reconstruídos automaticamente quando quebrarem.

### Bloco 0.4.7: Plugin System - Arquitetura Modular (PRIORIDADE ALTA)

> **Objetivo:** Implementar sistema de módulos desacoplados e auto-descobríveis para permitir escalabilidade sem acoplamento. Suporta hierarquia (módulos dentro de módulos) e lazy loading.

| ID | Tarefa | Status | Issue |
|----|--------|--------|-------|
| T0-040 | Criar ModuleRegistry (descobre módulos) | Concluido | - |
| T0-041 | Implementar escaneamento de pasta modules/ | Pendente | - |
| T0-042 | Implementar registro automático de módulos | Concluido | - |
| T0-043 | Criar PanelShell (core, apenas navegação) | Concluido | - |
| T0-044 | Implementar suporte a hierarquia (parent/child) | Concluido | - |
| T0-045 | Implementar lazy loading de módulos | Concluido | - |
| T0-052 | Criar módulos pais (clientes, infrastructure, marketing) | Concluido | - |
| T0-053 | Implementar renderização de dropdown para hierarquia | Concluido | - |
| T0-054 | Atualizar CSS para suportar dropdown tabs | Concluido | - |
| T0-046 | Criar EventBus para comunicação entre módulos | Concluido | - |
| T0-047 | Mover painéis existentes para modules/ | Concluido | - |
| T0-048 | Refatorar panel.ts para usar PanelShell | Concluido | - |
| T0-049 | Testes unitários do ModuleRegistry | Pendente | - |
| T0-050 | Testes E2E do Plugin System | Pendente | - |
| T0-051 | Documentar arquitetura do Plugin System | Pendente | - |
| T0-052 | Criar módulos pais (clientes, infrastructure, marketing) | Concluido | - |
| T0-053 | Implementar renderização de dropdown para hierarquia | Concluido | - |
| T0-054 | Atualizar CSS para suportar dropdown tabs | Concluido | - |

**Dependência:** Este bloco é pré-requisito para escalar para muitos módulos. Permite adicionar/remover módulos sem quebrar outros.

**Critérios de Conclusão:**
- ✅ ModuleRegistry descobre módulos automaticamente
- ✅ PanelShell não conhece módulos específicos
- ✅ Módulos se registram sozinhos
- ✅ Suporta hierarquia (módulos dentro de módulos)
- ✅ Lazy loading funcionando
- ✅ Isolamento total entre módulos
- ✅ Testes passando

### Bloco 0.4.6: Interceptação Webpack - Base (CONCLUÍDO)

> **Status:** ✅ Base funcionando. Acesso aos módulos principais (Msg, Contact, Label, Chat) implementado com busca robusta.

| ID | Tarefa | Status | Issue |
|----|--------|--------|-------|
| T0-022 | Criar WhatsAppInterceptors.ts (Module Finder) | Concluido | - |
| T0-023 | Implementar findExport, find, filter | Concluido | - |
| T0-024 | Extrair módulos (GroupMetadata, ChatCollection, Msg) | Concluido | - |
| T0-025 | Criar DataScraper.ts (interceptação de eventos) | Concluido | - |
| T0-026 | Implementar Msg.on("add") listener | Concluido | - |
| T0-027 | Implementar Msg.on("change") listener | Concluido | - |
| T0-030 | Integrar DataScraper com MessageCapturer | Concluido | - |
| T0-032 | Adicionar error handling robusto | Concluido | - |
| T0-033 | Adicionar validação Zod para dados interceptados | Concluido | - |
| T0-035 | Implementar world: "MAIN" no manifest | Concluido | - |
| T0-036 | Implementar busca inteligente por características | Concluido | - |
| T0-037 | Implementar objeto N (padrão referência) | Concluido | - |
| T0-038 | Documentar estado atual e decisões arquiteturais | Concluido | - |

**Resultado:** Base da Sentinela funcionando. Mensagens sendo capturadas via webpack.

---

## Tier 1 - Sentinela (Parte Física do WhatsApp)

> **Sentinela:** A parte física da extensão que interage diretamente com o WhatsApp Web. Base sólida e robusta para todas as funcionalidades futuras.

### Bloco 1.1: Módulos Extras da Referência (PRIORIDADE ALTA)

> **Objetivo:** Implementar todos os 25 módulos extras que a referência usa, um por um, com busca robusta, validação e testes.

| ID | Tarefa | Status | Issue |
|----|--------|--------|-------|
| T1-001 | Implementar N.Conn (Conexão) | Pendente | - |
| T1-002 | Implementar N.SendDelete (Deletar Mensagens) | Pendente | - |
| T1-003 | Implementar N.uploadMedia (Enviar Mídia) | Pendente | - |
| T1-004 | Implementar N.Cmd (Comandos) | Pendente | - |
| T1-005 | Implementar N.MediaTypes (Tipos de Mídia) | Pendente | - |
| T1-006 | Implementar N.UserConstructor (Construtor de Usuário) | Pendente | - |
| T1-007 | Implementar N.blockContact (Bloquear Contato) | Pendente | - |
| T1-008 | Implementar N.UploadUtils (Utilitários de Upload) | Pendente | - |
| T1-009 | Implementar N.DownloadManager (Gerenciador de Download) | Pendente | - |
| T1-010 | Implementar N.QueryExist (Verificar se Existe) | Pendente | - |
| T1-011 | Implementar N.USyncQuery (Sincronização Query) | Pendente | - |
| T1-012 | Implementar N.USyncUser (Sincronização User) | Pendente | - |
| T1-013 | Implementar N.Presence (Presença) | Pendente | - |
| T1-014 | Implementar N.ChatState (Estado do Chat) | Pendente | - |
| T1-015 | Implementar N.createGroup (Criar Grupo) | Pendente | - |
| T1-016 | Implementar N.getParticipants (Participantes do Grupo) | Pendente | - |
| T1-017 | Implementar N.genMinimalLinkPreview (Preview de Links) | Pendente | - |
| T1-018 | Implementar N.findFirstWebLink (Encontrar Links) | Pendente | - |
| T1-019 | Implementar N.getSearchContext (Contexto de Busca) | Pendente | - |
| T1-020 | Implementar N.sendReactionToMsg (Enviar Reação) | Pendente | - |
| T1-021 | Implementar N.colorIndexToHex (Cores) | Pendente | - |
| T1-022 | Implementar N.StatusUtils (Status) | Pendente | - |
| T1-023 | Implementar N.Composing (Digitando) | Pendente | - |
| T1-024 | Implementar N.ConversationSeen (Visto) | Pendente | - |
| T1-025 | Implementar N.Playing (Tocando) | Pendente | - |
| T1-026 | Implementar N.StatusState (Estado de Status) | Pendente | - |

**Critérios para cada módulo:**
- Busca robusta (por nome E por características)
- Validação de que módulo existe e funciona
- Teste unitário
- Documentação
- Logs detalhados

**Regra:** Não avançar para próximo módulo sem validar completamente o anterior.

### Bloco 1.2: Seletores CSS Dinâmicos (PRIORIDADE ALTA)

> **Objetivo:** Implementar busca dinâmica de seletores CSS do webpack, com fallback para seletores fixos.

| ID | Tarefa | Status | Issue |
|----|--------|--------|-------|
| T1-027 | Implementar função Mt() (base64 decode) | Pendente | - |
| T1-028 | Implementar busca de módulos CSS do webpack | Pendente | - |
| T1-029 | Implementar processamento de seletores encontrados | Pendente | - |
| T1-030 | Implementar fallback para seletores fixos | Pendente | - |
| T1-031 | Implementar múltiplos seletores por elemento (fallback chain) | Pendente | - |
| T1-032 | Integrar N.Classes com SelectorManager | Pendente | - |
| T1-033 | Implementar atualização automática quando webpack muda | Pendente | - |
| T1-034 | Testes E2E de seletores CSS dinâmicos | Pendente | - |

**Dependência:** Bloco 1.1 (módulos extras) deve estar completo ou pelo menos N.Classes deve estar funcionando.

### Bloco 1.3: Métodos Auxiliares (PRIORIDADE MÉDIA)

> **Objetivo:** Adicionar métodos auxiliares no N.Chat e N.ChatCollection para garantir compatibilidade.

| ID | Tarefa | Status | Issue |
|----|--------|--------|-------|
| T1-035 | Implementar N.Chat._find (se não existir) | Pendente | - |
| T1-036 | Implementar N.ChatCollection.findImpl (se necessário) | Pendente | - |
| T1-037 | Testes unitários dos métodos auxiliares | Pendente | - |
| T1-038 | Validação dos métodos auxiliares | Pendente | - |

### Bloco 1.4: Eventos Extras (PRIORIDADE MÉDIA)

> **Objetivo:** Implementar todos os eventos extras que a referência escuta.

| ID | Tarefa | Status | Issue |
|----|--------|--------|-------|
| T1-039 | Implementar N.Label.on("add remove") listener | Pendente | - |
| T1-040 | Melhorar N.Msg.on("change") - detectar mensagens deletadas | Pendente | - |
| T1-041 | Implementar backup de mensagens antes de deletar | Pendente | - |
| T1-042 | Melhorar N.Chat.on("change:id") - atualizar UI | Pendente | - |
| T1-043 | Implementar limpeza de mensagens deletadas do chat anterior | Pendente | - |
| T1-044 | Testes unitários dos eventos extras | Pendente | - |
| T1-045 | Testes E2E dos eventos extras | Pendente | - |

### Bloco 1.5: Testes e Validação Final (PRIORIDADE ALTA)

> **Objetivo:** Garantir que tudo funciona corretamente e está robusto.

| ID | Tarefa | Status | Issue |
|----|--------|--------|-------|
| T1-046 | Testes unitários de todos os getters de módulos | Pendente | - |
| T1-047 | Testes unitários de busca por características | Pendente | - |
| T1-048 | Testes unitários de validação com Zod | Pendente | - |
| T1-049 | Testes unitários de métodos auxiliares | Pendente | - |
| T1-050 | Testes unitários de seletores CSS dinâmicos | Pendente | - |
| T1-051 | Testes E2E de captura de mensagens em tempo real | Pendente | - |
| T1-052 | Testes E2E de eventos disparando corretamente | Pendente | - |
| T1-053 | Testes E2E de seletores CSS funcionando | Pendente | - |
| T1-054 | Testes E2E de módulos extras funcionando | Pendente | - |
| T1-055 | Testes de robustez - WhatsApp muda nome de módulo | Pendente | - |
| T1-056 | Testes de robustez - WhatsApp muda seletores CSS | Pendente | - |
| T1-057 | Testes de robustez - Estrutura de mensagem muda | Pendente | - |
| T1-058 | Documentação completa da Sentinela | Pendente | - |
| T1-059 | Código sem warnings | Pendente | - |
| T1-060 | TypeScript strict mode | Pendente | - |

**Dependência:** Todos os blocos anteriores devem estar completos.

### Bloco 1.6: Aba de Testes e Verificação (PRIORIDADE ALTA)

> **Objetivo:** Criar aba visual no painel para testar e verificar todos os módulos da Sentinela.

| ID | Tarefa | Status | Issue |
|----|--------|--------|-------|
| T1-061 | Criar estrutura básica da aba "Testes" | Pendente | - |
| T1-062 | Implementar campo de número de teste | Pendente | - |
| T1-063 | Implementar salvar número de teste (chrome.storage) | Pendente | - |
| T1-064 | Criar module-tester.ts (sistema de testes) | Pendente | - |
| T1-065 | Implementar função testModule() básica | Pendente | - |
| T1-066 | Listar todos os módulos na aba | Pendente | - |
| T1-067 | Mostrar status de cada módulo (✅/❌) | Pendente | - |
| T1-068 | Implementar botão [Testar] individual | Pendente | - |
| T1-069 | Implementar botão [Testar Todos] | Pendente | - |
| T1-070 | Implementar botão [Ver] (detalhes do módulo) | Pendente | - |
| T1-071 | Implementar botão [Logs] (logs detalhados) | Pendente | - |
| T1-072 | Criar relatório de testes | Pendente | - |
| T1-073 | Implementar exportar JSON do relatório | Pendente | - |
| T1-074 | Testes E2E da aba de testes | Pendente | - |

**Critérios:**
- Número de teste salvo e usado automaticamente
- Todos os módulos listados com status
- Testes individuais e em lote funcionando
- Detalhes e logs acessíveis

### Bloco 1.7: Histórico Melhorado (PRIORIDADE ALTA)

> **Objetivo:** Melhorar visualização do histórico para agrupar por contato e facilitar análise.

| ID | Tarefa | Status | Issue |
|----|--------|--------|-------|
| T1-075 | Criar função groupMessagesByContact() | Pendente | - |
| T1-076 | Criar estrutura básica da aba "Histórico" | Pendente | - |
| T1-077 | Implementar lista de contatos (com contagem) | Pendente | - |
| T1-078 | Mostrar preview da última mensagem | Pendente | - |
| T1-079 | Implementar busca de contatos | Pendente | - |
| T1-080 | Implementar clicar em contato (abre histórico) | Pendente | - |
| T1-081 | Mostrar histórico completo do contato | Pendente | - |
| T1-082 | Organizar mensagens por data/hora | Pendente | - |
| T1-083 | Mostrar quem enviou (contato/usuário) | Pendente | - |
| T1-084 | Implementar botão [Exportar para IA] | Pendente | - |
| T1-085 | Implementar paginação (carregar mais) | Pendente | - |
| T1-086 | Implementar filtros (data, tipo, ordenação) | Pendente | - |
| T1-087 | Melhorar layout visual do histórico | Pendente | - |
| T1-088 | Testes E2E do histórico melhorado | Pendente | - |

**Critérios:**
- Mensagens agrupadas por contato
- Lista de contatos funcional
- Histórico completo por contato
- Exportação para IA funcionando
- Filtros e busca funcionando

---

## Métricas Atualizadas

| Métrica | Valor |
|---------|-------|
| **Tier 0 - Total de tarefas** | 38 |
| **Tier 0 - Concluídas** | 30 |
| **Tier 0 - Em progresso** | 0 |
| **Tier 0 - Pendentes** | 8 |
| **Tier 1 (Sentinela) - Total de tarefas** | 88 |
| **Tier 1 (Sentinela) - Concluídas** | 0 |
| **Tier 1 (Sentinela) - Pendentes** | 88 |
| **Total geral de tarefas** | 126 |
| **Total concluídas** | 30 |
| **Total pendentes** | 96 |
| **Sprint iniciada** | 2026-01-11 |
| **Estimativa Sentinela** | 15-20 dias (implementação robusta com testes) |

### Bloco 0.5: Captura de Mensagens

| ID | Tarefa | Status | Issue |
|----|--------|--------|-------|
| T0-016 | Criar config/selectors.json | Concluido | #9 |
| T0-017 | Criar message-capturer.ts | Concluido | #9 |
| T0-018 | Criar message-db.ts (IndexedDB) | Concluido | #10 |
| T0-018.1 | **DEPENDÊNCIA:** Auto-mapeamento deve estar funcional | Bloqueado | - |

### Bloco 0.6: Testes e Validacao

| ID | Tarefa | Status | Issue |
|----|--------|--------|-------|
| T0-019 | Criar playwright.config.ts | Concluido | #11 |
| T0-020 | Criar testes E2E | Concluido | #11 |
| T0-021 | Atualizar README.md | Concluido | #12 |

---

## Metricas

| Metrica | Valor |
|---------|-------|
| Total de tarefas | 31 |
| Concluidas | 23 |
| Em progresso | 0 |
| Pendentes | 8 (auto-mapeamento + criar issues) |
| Bloqueadas | 1 (captura de mensagens depende de auto-mapeamento) |
| Sprint iniciada | 2026-01-11 |
| Estimativa | 5-6 dias (ajustado devido a auto-mapeamento) |

---

## Historico de Atualizacoes

| Data | Alteracao |
|------|-----------|
| 2026-01-11 | Criacao do arquivo progress.md |
| 2026-01-11 | T0-005 a T0-021 concluidos |
| 2026-01-11 | Projeto pronto para primeiro commit |
| 2026-01-11 | **URGENTE:** Adicionado Bloco 0.4.5 - Auto-Mapeamento (prioridade critica) |
| 2026-01-11 | Documentacao de auto-mapeamento concluida (T0-015.1 a T0-015.3) |
| 2026-01-11 | Bloco 0.5 (Captura) marcado como bloqueado ate auto-mapeamento estar funcional |
| 2026-01-11 | **SENTINELA:** Bloco 0.4.6 (Interceptação Webpack - Base) concluído |
| 2026-01-11 | **SENTINELA:** Acesso aos módulos principais (Msg, Contact, Label, Chat) funcionando |
| 2026-01-11 | **SENTINELA:** Busca inteligente por características implementada |
| 2026-01-11 | **SENTINELA:** Objeto N (padrão referência) implementado |
| 2026-01-11 | **SENTINELA:** Documentação completa criada (SENTINELA_ESTADO_ATUAL.md, SENTINELA_PLANO_IMPLEMENTACAO.md) |
| 2026-01-11 | **SENTINELA:** Tier 1 criado com 60 tarefas para equiparar referência |
| 2026-01-11 | **SENTINELA:** Adicionado Bloco 1.6 (Aba de Testes) - 14 tarefas |
| 2026-01-11 | **SENTINELA:** Adicionado Bloco 1.7 (Histórico Melhorado) - 14 tarefas |
| 2026-01-11 | Criado HISTORICO_SIMPLES.md para documentação rápida |
| 2026-01-11 | Criado PLANO_ABA_TESTES_HISTORICO.md com plano detalhado |
| 2026-01-29 | **UI:** Visual 100% isolado em Shadow DOM; `panel.css`/temas carregados via `<link>` no ShadowRoot (sem CSS global no `manifest.json`) |
| 2026-02-08 | **Marketing - Retomar:** Etiquetas Bloqueados/CNPJ; modo dia e modo etiqueta; kebab adicionar/remover/mover; listas customizadas; refinamento e push. |

---

## Documentos Relacionados

| Documento | Proposito |
|-----------|-----------|
| `project_concept.md` | Visao conceitual |
| `project_context.md` | Especificacoes tecnicas |
| `tech_stack.md` | Stack tecnologica |
| `.cursorrules` | Regras para o Cursor AI |
| `docs/SENTINELA_ESTADO_ATUAL.md` | Estado atual da Sentinela e decisões arquiteturais |
| `docs/SENTINELA_PLANO_IMPLEMENTACAO.md` | Plano detalhado para implementar todos os módulos extras |
| `docs/PLANO_ABA_TESTES_HISTORICO.md` | Plano para aba de testes e histórico melhorado |
| `HISTORICO_SIMPLES.md` | Histórico simples do projeto (uma linha por coisa) |

---

> Este arquivo deve estar sempre sincronizado com as Issues e Milestones do GitHub.
