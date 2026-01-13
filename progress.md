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

---

## Documentos Relacionados

| Documento | Proposito |
|-----------|-----------|
| `project_concept.md` | Visao conceitual |
| `project_context.md` | Especificacoes tecnicas |
| `tech_stack.md` | Stack tecnologica |
| `.cursorrules` | Regras para o Cursor AI |

---

> Este arquivo deve estar sempre sincronizado com as Issues e Milestones do GitHub.
