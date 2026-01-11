# GitHub Setup - Mettri

Este arquivo documenta a configuracao do projeto no GitHub.

---

## Milestones

| Milestone | Descricao | Prazo |
|-----------|-----------|-------|
| Tier 0 - Fundacao | Setup inicial, UI, captura basica | 2 semanas |
| Tier 1 - Core | CRM, persistencia, seletores remotos | 4 semanas |
| Tier 2 - Inteligencia | AI Copilot, sugestoes, analytics | 6 semanas |
| Tier 3 - Escala | Monetizacao, suporte, multi-usuario | 8 semanas |

---

## Labels

### Prioridade
- `priority:critical` - Bloqueia desenvolvimento
- `priority:high` - Deve ser feito na sprint atual
- `priority:medium` - Pode esperar proxima sprint
- `priority:low` - Nice to have

### Tipo
- `type:feat` - Nova funcionalidade
- `type:bug` - Correcao de bug
- `type:docs` - Documentacao
- `type:refactor` - Refatoracao
- `type:test` - Testes
- `type:chore` - Manutencao

### Area
- `area:ui` - Interface do usuario
- `area:core` - Logica principal
- `area:storage` - Persistencia
- `area:ai` - Inteligencia artificial
- `area:infra` - Infraestrutura

---

## Issues Iniciais (Tier 0)

### Setup
- [ ] #1 - Setup inicial do projeto TypeScript
- [ ] #2 - Configurar ESLint e Prettier
- [ ] #3 - Configurar GitHub Actions CI
- [ ] #4 - Mover codigo legacy

### UI
- [ ] #5 - Criar panel.css com tema WhatsApp
- [ ] #6 - Criar panel.ts com componentes
- [ ] #7 - Integrar panel no WhatsApp Web

### Captura
- [ ] #8 - Criar sistema de seletores com fallback
- [ ] #9 - Implementar message-capturer
- [ ] #10 - Implementar persistencia IndexedDB

### Testes
- [ ] #11 - Configurar Playwright para extensao
- [ ] #12 - Criar testes E2E basicos

---

## Links Rapidos

- [Criar Milestone](https://github.com/ferrarijonas/Mettri/milestones/new)
- [Criar Label](https://github.com/ferrarijonas/Mettri/labels)
- [Criar Issue](https://github.com/ferrarijonas/Mettri/issues/new)
- [Ver Actions](https://github.com/ferrarijonas/Mettri/actions)

---

## Configuracao Inicial Completa

O projeto ja possui:
- [x] README.md profissional
- [x] LICENSE MIT
- [x] .gitignore
- [x] .editorconfig
- [x] ESLint + Prettier
- [x] GitHub Actions CI
- [x] Issue Templates
- [x] PR Template
- [x] TypeScript strict mode
- [x] esbuild bundler
- [x] Playwright E2E
