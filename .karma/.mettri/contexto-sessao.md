# Contexto de Sessão — O que buscar antes de perguntar

Regra: **antes de perguntar ao Jonas, busque no código.**

---

## Informações críticas do negócio

Quando o Jonas menciona "o crédito", "o site do crédito", "cardápio do dia" — buscar no código:

1. **MenuScraper** (`src/infrastructure/menu-scraper.ts`) — já existe, raspamenu de plataformas
2. **Configuração do restaurant** — procurar onde URL do cardápio é definida
3. **Dados do catálogo** — já populado em `catalogoDB`

Se não encontrar → antes de perguntar, предположи o contexto mais provável e teste.

---

## O que fazer quando não sabe algo

1. **grep primeiro** — procurar no código por palavras-chave
2. **ler arquivos relacionados** — seguir imports e dependências
3. **assumir e testar** — propor uma direção, validar se faz sentido
4. **só então perguntar** — se nada disso funcionar

**Nunca pergunte "qual a URL?" sem antes grep por URL no código.**

---

## Em cada sessão

Antes de iniciar qualquer tarefa técnica:

- Leia TAREFAS.md
- Leia última trail (se existir)
- Verifique se há informações no código que respondem sua pergunta

Se precisar perguntar algo → demonstre que já tentou buscar.