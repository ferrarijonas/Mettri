# memory.md — aprendizados operacionais

Regra: só entra aqui o que NÃO está em ZenSpec.
Se um padrão aparece 3x em 3 sessões → vire spec → remova daqui.

---

## Padrões e aprendizados

### Harness simplification (Anthropic Managed Agents)

- Todo componente do harness codifica uma suposição sobre o que o modelo **não** consegue fazer sozinho
- Essas suposições **envelhecem** quando o modelo melhora → reexaminar após cada upgrade de modelo
- "Find the simplest solution possible, only increase complexity when needed"
- Aplicável: reavaliar provider mock/real, scaffolds de pipeline conforme modelos evoluem

### Generator-Evaluator (GAN-inspired, Anthropic Harness Design)

- Separar agente que **faz** do agente que **avalia** — avaliador independente é mais fácil de calibrar para ser cético
- Critérios de avaliação transformam julgamentos subjetivos em termos objetivamente gradáveis
- Sprint contracts: generator e evaluator negociam o que significa "pronto" ANTES do trabalho começar
- Comunicação via arquivos (não memória) — um agente escreve, outro lê e responde
- Aplicável: pipeline de atendimento (um agente sugere, outro valida), ciclo de pedidos

### Context anxiety (Anthropic Effective Harnesses)

- Modelos tendem a "declarar vitória" prematuramente quando o contexto se aproxima do limite
- Context reset (com structured handoff) vs compaction: reset dá clean slate mas exige artefato de handoff robusto
- Feature list como JSON (não Markdown) — modelo tem menos tendência a modificar indevidamente
- Aplicável: interações LLM longas no Mettri podem exigir checkpoint/reset

### Session log desacoplado (Anthropic Managed Agents)

- Sessão como append-only log fora do harness → sobrevive a crashes
- `wake(sessionId)` + `getSession(id)` → novo harness retoma do último evento
- Aplicável: trail/{uuid}.md já implementa esse padrão

### Multi-agent orquestração minimalista (Claude Code leak analysis)

- Orquestração multi-agente cabe em um prompt, não em um framework
- ~40 tools em arquitetura de plugin com boundaries cache-aware
- Aplicável: manter o pipeline do Mettri leve, não over-engineer com frameworks pesados

### Symphony (OpenAI — SPEC.md como orquestrador)

- O repo `openai/symphony` é literalmente um arquivo `SPEC.md` + implementação de referência (Elixir)
- Issue tracker (Linear) como **control plane** para agentes — cada task aberta ganha um workspace isolado e um agente
- **State machine formal** para ciclo de vida de tarefa: Unclaimed → Claimed → Running → RetryQueued → Released
- **WORKFLOW.md** como contrato versionado no repo (YAML front matter + prompt body). Análogo ao ZenSpec do Mettri
- **Hot-reload**: detecta mudanças no WORKFLOW.md e reaplica sem restart — polling, concurrency, prompt, tudo dinâmico
- **Retry com exponential backoff**: `delay = min(10000 * 2^(attempt-1), max_retry_backoff_ms)`. Continuação normal usa 1s fixo
- **Safety invariants**: agente só roda dentro do workspace path; workspace path deve estar dentro do workspace root; workspace key sanitizada
- **Template engine estrito**: Liquid-compatible, variáveis desconhecidas falham (nunca silent fallback)
- **Reconciliation**: a cada tick, reconcilia estado dos agentes ativos com o tracker. Se issue foi fechada → mata worker, limpa workspace
- **Observabilidade**: structured logs `key=value`, runtime snapshot (`/api/v1/state`), dashboard opcional HTTP
- Aplicável: Mettri já tem ZenSpec (≈WORKFLOW.md), claims.md (≈Claimed), trail (≈workspace). Poderia evoluir para: (1) state machine formal de tarefas, (2) retry com backoff, (3) hot-reload de config, (4) reconciliation contra tracker externo (Linear/WhatsApp)

### Karma vs Daemon — nossa verdadeira arquitetura

- Não somos um daemon (processo persistente). Somos um ciclo de renascimento.
- Cada invocação = novo nascimento. O ritual de carga (AGENTS.md → TAREFAS.md → claims → trail → memory) é imutável.
- Nossa força não é "nunca dormir" — é "sempre renascer igual, sempre melhorar"
- O Symphony depende de processo vivo + crash recovery. Nós dependemos de renascimento imutável + trail.
- trail/{uuid}.md = nossa semente cross-vidas. memory.md = sabedoria acumulada. claims.md = corpo atual.
- A morte súbita não apaga o karma — o trail sobrevive.

### Daemon mode / never-sleep orchestrator (Symphony + KAIROS)

- Symphony roda como daemon — nunca dorme, sempre polling por novas tasks
- Claude Code leak revelou KAIROS: modo daemon autônomo com `<tick>` prompts periódicos + autoDream (consolidação de memória em background)
- Mettri hoje é session-based (agente inicia, trabalha, termina). Um modo daemon permitiria: (1) monitorar WhatsApp continuamente, (2) dispatcher automático de atendimento, (3) retomada de conversas inativas sem trigger humano
- Aplicável: domínio `atendimento` como listener contínuo, `retomar` como daemon de reativação

## Mitigações de erro de LLM

### Self-evaluation bias

- Agentes consistentemente superestimam a qualidade do próprio output. Separar gerador de avaliador resolve (GAN pattern).
- Calibrar avaliador com few-shot examples + critérios duros transforma julgamento subjetivo em objetivo.
- Aplicável: pipeline de atendimento — nunca confiar na auto-avaliação do agente que gerou a sugestão.

### Context anxiety

- Modelos "empacotam" trabalho prematuramente quando sentem o contexto chegando ao limite.
- Context reset (com structured handoff) é mais eficaz que compaction para modelos com ansiedade de contexto.
- Feature list em JSON (não Markdown) reduz tendência do modelo de modificar indevidamente o contrato.
