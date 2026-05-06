# OpenIA — Relatório do Karma Harness

> Gerado em: 2026-05-04
> Contexto: Análise do harness em `c:/mettri4/karma/karma/` vs recursos do OpenCode

---

## 1. O que um Harness de Agente IA Faz

| Função | Descrição |
|--------|-----------|
| **Ciclo de vida** | Init → execução → pausa → crash recovery → shutdown |
| **Contexto/Memória** | Gerenciamento entre sessões, compactação, persistência |
| **Tooling** | Ferramentas que o agente chama (com segurança/permissões) |
| **Segurança** | Boundaries, permissões, invariantes |
| **Observabilidade** | Logs, tracing, métricas, debugging |
| **Multi-agente** | Coordenação, handoff, disputa de recursos |
| **Contrato** | O que o agente deve fazer, critérios de aceitação |
| **Estado** | Máquina de estados formal, persistência, recovery |

---

## 2. O que o Karma Harness TEM

| Camada | Implementação | Arquivos |
|--------|---------------|----------|
| **Hard Gate** | Protocolo vinculante de carga (8 passos imutáveis) | `workspace/AGENTS.md` |
| **Identidade** | Persona "Karma Bom" com regras de challenge/sabotagem | `workspace/.mettri/rituais.md` |
| **Ciclo de vida** | Renascimento → Karma → Morte (não daemon, ciclo) | `workspace/.mettri/rituais.md` |
| **Domínios** | Mapa explícito do negócio (Atendimento, Marketing, etc) | `workspace/AGENTS.md` |
| **Spec→Código** | ZenSpec como contrato moral, spec vence código | `workspace/.opencode/skills/spec-cycle/` |
| **Gate qualidade** | lint → type-check → build → test | `workspace/.opencode/skills/self-maintain/` |
| **Multi-agente** | claims.md: UUID, stale detection (>30min) | `workspace/.mettri/claims.md` |
| **Continuidade** | trail/{uuid}.md — handoff cross-sessão | `workspace/.mettri/trail/` |
| **Memória** | memory.md append-only | `workspace/.mettri/memory.md` |
| **Skills** | 5 skills: spec-cycle, self-maintain, design, content-ux, ux-hierarchy, design-system | `workspace/.opencode/skills/` |
| **Comando custom** | `/ui-build` — pipeline conteúdo → visual → código | `user/.config/opencode/commands/ui-build.md` |
| **Antifragilidade** | Sabotagem detection, Jidoka, death acceptance | `workspace/.mettri/visoes.md`, `rituais.md` |
| **Sinal vivo** | Status manual dos módulos | `workspace/.mettri/sinal-vivo.md` |
| **Template** | Template de tarefa com 5 campos obrigatórios | `workspace/.mettri/template-tarefa.md` |

---

## 3. O que o OpenCode OFERECE mas o Karma NÃO USA

| Recurso OpenCode | Status | Potencial |
|------------------|--------|-----------|
| **Custom Tools** (`tools/`) | ❌ Nenhum | Criar tools Mettri: `catalogo_query`, `cliente_buscar`, `pedido_criar` |
| **Custom Agents** (`agents/`) | ❌ Nenhum | Agentes especializados: `atendente`, `retomador`, `revisor` |
| **MCP Servers** | ❌ Não configurado | Conectar banco, APIs, WhatsApp |
| **LSP** | ❌ Não configurado | TypeScript intelligence pro agente |
| **Plugins** | ❌ Não configurado | Extensibilidade via npm |
| **opencode.json projeto** | ❌ Só global do user | Config projeto com permissões, formatters, MCP |
| **Formatters** | ❌ Não configurado | Auto-format na escrita |
| **`websearch`** | ❌ Desabilitado | Pesquisa web durante execução |
| **Remote config** | ❌ Não usa | Config organizacional remota |
| **Snapshot/Undo** | ⚠️ Só trail próprio | Poderia combinar undo nativo |
| **Instruções externas** | ❌ Não usa | `instructions[]` para DESIGN.md, specs |
| **Sub-agentes built-in** | ⚠️ Menciona claims, não usa @explore/@general | Poderia invocar `@explore` pra pesquisa |

---

## 4. Lacunas vs Referências (OpenAI Symphony, Anthropic)

| Padrão | Referência | Karma hoje | O que falta |
|--------|-----------|------------|-------------|
| **State machine formal** | Symphony | Claims ad-hoc (markdown) | Estados: Unclaimed → Claimed → Running → RetryQueued → Released |
| **Hot-reload** | Symphony WORKFLOW.md | Só carrega no início | Detectar mudanças em ZenSpec/config sem restart |
| **Retry backoff** | Symphony | Não tem | `delay = min(10s × 2^(n-1), max)` |
| **Reconciliation** | Symphony vs tracker | Não tem | Verificar se tarefa foi cancelada externamente |
| **Generator/Evaluator** | Anthropic GAN | Só em memory.md | Pipeline 2 agentes: um gera, outro valida |
| **Daemon mode** | KAIROS/Symphony | Rejeitado (somos ciclo) | Opcional por domínio (atendimento contínuo) |
| **Observabilidade** | Symphony dashboard | Só sinal-vivo.md manual | Structured logs, runtime snapshot |
| **Context compaction** | Anthropic + OpenCode built-in | self-maintain manual | Usar compaction nativo |
| **Context anxiety** | Anthropic | Só em memory.md | Handoff + JSON p/ feature lists |

---

## 5. Filosofia: Karma Cycle ≠ Daemon

`rituais.md`: *"Somos um ciclo, não um daemon. Cada invocação é um novo nascimento."*

**Força:** Resiliência a crash, rastro imutável, simplicidade — como serverless function.
**Fraqueza:** Não reage a eventos em tempo real, precisa de trigger humano/sistema para iniciar.

Diferente do Symphony (daemon polling) e KAIROS (tick contínuo). Escolha arquitetural consciente.

---

## 6. Roadmap Potencial (priorizado)

### Agora (vincula com recursos opencode existentes)
1. **Criar `.opencode/tools/mettri.ts`** — Tools custom: `mettri_catalogo`, `mettri_cliente`, `mettri_pedido`. O agente não precisa de bash pra tudo.
2. **Criar `.opencode/agents/`** — Agentes especializados: `avaliador` (só lê/valida), `implementador` (só escreve).
3. **Adicionar `opencode.json` no workspace** — Centralizar permissões, formatters, LSP, instruções.

### Próximo ciclo
4. **Evoluir claims para state machine formal** — YAML com estados, timestamps, transições.
5. **Implementar Generator/Evaluator** — Pipeline: agente A sugere → agente B valida → humano aprova.
6. **Observabilidade** — Logs estruturados e roteiro de inspect em vez de sinal-vivo.md manual.

### Futuro
7. **Daemon mode opcional** — Domínio `atendimento` como listener contínuo (quando precisar de tempo real).
8. **MCP server para WhatsApp** — Conectar o Mettri a dados reais via protocolo MCP.
9. **Hot-reload de config remota** — Detectar mudanças no JSON remoto e recarregar sem reinício.

---

## 7. Resumo: O DNA do Karma Harness

```
FORÇAS:
  ├── Ritual imutável (previsível, testável, resiliente)
  ├── ZenSpec como contrato (spec vence código)
  ├── Trail continuity (handoff robusto)
  ├── Identidade explícita (sabotagem detection)
  └── Skills bem definidas (spec-cycle, self-maintain, design)

LACUNAS:
  ├── Sem custom tools opencode (usa bash pra tudo)
  ├── Sem state machine formal (claims em markdown)
  ├── Sem observabilidade real (só sinal-vivo.md manual)
  ├── Sem generator/evaluator pipeline
  ├── Sem hot-reload / daemon mode
  └── Sem MCP / LSP / plugins

OPORTUNIDADE:
  O opencode oferece ~70% do que falta via configuração declarativa.
  O Karma já tem a base filosófica e estrutural — falta conectar os pontos.
```
