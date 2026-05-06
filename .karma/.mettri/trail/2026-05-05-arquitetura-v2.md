# Sessão — 2026-05-05 — Construção do KARMA v2

inicio: 2026-05-05T00:00:00Z
fim: 2026-05-05T12:30:00Z
status: concluido

---

## O que foi feito

### Análise do Claude Code (repos_estudo)
- 57 prompts mapeados e classificados em 4 categorias (Ferramentas, Memorias, Servicos, Sistema)
- 5 antologias produzidas (Estrutural-Funcionalista, Pipeline, Ontologia, Cibernetica, Organizacional)
- Análise 80/20 (Pareto) aplicada: 11 prompts entregam 80% do valor
- 3 rodadas de peer review (concordar → discordar → convergir)
- 20 simulações de devs novos — 28 falhas encontradas, 5 melhorias urgentes

### Arquitetura KARMA v2
- Pipeline de 6 fases: Portão Duro → Despertar → Despacho → Agir → Verificar → Consolidar
- Auto-cura N1-N4 com contador de tentativas
- Sistema de tarefas Symphony-like (SPEC.md, trail.md, briefing.md)
- Sabotagem detection por domínio (avaliador adversarial)
- Memória cross-sessão (@sonhador)
- Claims como máquina de estados YAML (substitui claims.md manual)

### Agentes
- build = Karma (deepseek-v4-pro) — orquestrador com pipeline
- plan = Karma planejador (deepseek-v4-flash) — 1:1 Claude #9+#12+#6
- implementador (deepseek-v4-flash, hidden) — código + gate-runner
- avaliador (nemotron-3-super-free, hidden) — adversarial read-only
- sonhador (minimax-m2.5-free, hidden) — consolidação de memória

### Arquivos criados (22 arquivos)
- opencode.json (per-project, permissões, modelos por agente)
- AGENTS.md (reescrito: pipeline 6 fases + Hard Gate + auto-cura)
- .mettri/identidade.md (persona + doutrina AGIL + sabotagens globais)
- .mettri/claims.yaml (coordenação formal)
- .mettri/thresholds.yaml (parâmetros de controle)
- .mettri/sabotagens/_global.md (8 sabotagens universais)
- .mettri/sabotagens/ATENDIMENTO.md (catálogo específico)
- .mettri/template-SPEC.md, template-trail.md, template-briefing.md, template-relatorio.md
- .opencode/agents/karma-build.md, karma-plan.md, implementador.md, avaliador.md, sonhador.md
- .opencode/skills/identidade.md
- TAREFAS.md (modificado: dashboard com links)

### Localização
- Projeto Mettri: C:\Mettri4\.karma\
- Standalone: c:\karma\workspace\

---

## Decisões importantes

1. **Nome é Karma** (sem "Bom", sem "Mettri")
2. **Plan Mode 1:1 com Claude** — absorve #9 (entrar em modo plano), #12 (TODO), #6 (task creation)
3. **Build Mode = Karma orquestrador** — não precisa de agente "orquestrador" separado
4. **3 subagentes hidden** — implementador, avaliador, sonhador. Tab só alterna build/plan.
5. **Modelos**: Pro no build, Flash no plan+implementador, Nemotron free no avaliador, MiniMax free no sonhador
6. **Per-project opencode.json** — zero contaminação fora da pasta .karma\
7. **Índices, não livros** — SPEC.md como contrato canônico, trails append-only, memory.md com tags
8. **Comunicação por arquivos** — trail, briefing, SPEC.md. Sem mensageria inter-agente.
9. **openIA.md** — separar o que opencode já oferece do que o Karma adiciona
10. **Plan Mode resolve 7 das 28 falhas** da simulação — aprovação humana antes de implementar

---

## O que NÃO foi feito (próximo)

- [ ] Conectar OpenCode Zen (para usar modelos free: nemotron, minimax)
- [ ] Criar primeiras SPEC.md reais para tarefas do TAREFAS.md
- [ ] Testar pipeline completo com tarefa real ("Implementa CM1")
- [ ] Testar classificação de intenção ("Me explica o RAG")
- [ ] Testar continuação de sessão ("Continua de onde paramos")
- [ ] Criar sabotagens para outros domínios (MARKETING, CATALOGO, RAG)
- [ ] Criar custom tools: claims.ts, index.ts
- [ ] Migrar ZenSpecKit pra dentro do workspace ou ajustar paths

---

## Como usar

1. Abrir terminal em C:\Mettri4\.karma\
2. opencode carrega automaticamente KARMA v2
3. Tab = alterna entre Plan (planejar) e Build (executar)
4. Digitar tarefa → agente classifica intenção → cria SPEC.md → pergunta "Prosseguir?"
5. Em Plan Mode: revisa SPEC.md, ajusta, aprova
6. Em Build Mode: confirma → agente implementa → gate → @avaliador verifica → @sonhador consolida
7. Sair da pasta .karma\ → opencode volta ao normal, zero contaminação
