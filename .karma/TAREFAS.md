# Karma — Painel de Tarefas

> **Este arquivo é o DASHBOARD HUMANO.** Você escreve aqui o que quer fazer.
> O Karma transforma cada item em SPEC.md (contrato canônico em tarefas/{id}/SPEC.md).
> 
> **Como usar:**
> 
> - Adicione tarefas soltas abaixo. O Karma expande em SPEC.md.
> - Marque [x] quando concluído. O Karma move para concluídas/.
> - Use links `[T-XXX]` para ver o contrato completo da tarefa.
> - Se o Karma criar uma tarefa que você não pediu, risque com [~].

## 🎯 Em Andamento

(Nenhuma — aguardando dispatch)

## 📋 Pendentes

### RETOMAR (Reativação — UI completa)

- [R1] UI: Lista clientes inativos com selector — `src/modules/marketing/retomar/retomar-panel.ts`
- [R2] UI: Botão "Gerar msg IA" com loading state — `src/modules/marketing/retomar/retomar-panel.ts`
- [R3] UI: Botão "Enviar" → WhatsApp — `src/modules/marketing/retomar/retomar-panel.ts`
- [R4] UI: Métricas (enviados, resposta %) — `src/modules/marketing/retomar/retomar-panel.ts`
- [R5] Teste E2E: fluxo completo Retomar — `tests/e2e/`
- [RET-01] Melhorias de resposta agentica
- [RET-02] Integrar com catálogo (sugerir produto na reativação)

### ATENDIMENTO (Painel Comercial)

- [A1] UI: Ficha cliente (nome, badges, tipo) — `src/modules/atendimento/dashboard/atendimento-panel.ts`
- [A2] UI: Funil visual (5 etapas) — `src/modules/atendimento/dashboard/atendimento-panel.ts`
- [A3] UI: Botão "Gerar sugestão" (usa LLM) — `src/modules/atendimento/dashboard/atendimento-panel.ts`
- [A4] Action: Criar pedido do funil — `src/modules/atendimento/dashboard/atendimento-panel.ts`
- [A5] Teste E2E: chat → pedido — `tests/e2e/`

### ATENDIMENTO/OUVIR

- [OUV-01] Testar cenários de ambiguidade: "hoje tem X e Y" → "quero dois" (sem reply)
- [OUV-02] Testar cenários de ambiguidade: cliente usa reply após várias msgs → contexto correto
- [OUV-03] Vincular ao painel comercial (sugestão aparece)
- [O-DET] Detecção de reassinatura comportamental — `src/modules/ouvir/extrator.ts`

### ATENDIMENTO/COMERCIAL (CM1-CM9)

- [CM1] Funil + rascunho no painel
- [CM2] Estados vazio/loading/erro
- [CM3] Botão "Gerar rascunho"
- [CM4] Funil real (Venda atualiza)
- [CM5] Enriquecimento vazio não quebra
- [CM6] LLM devolve texto
- [CM7] Enviar WhatsApp
- [CM8] Pedido gravado
- [CM9] Portão automático

### ATENDIMENTO/AGENTE DE RESPOSTA

- [AG-01] Painel UI
- [AG-02] spec→código

### INFRAESTRUTURA (Atualização Remota)

- [U1] Estrutura de config remoto (JSON) — `src/infrastructure/`
- [U2] Fetch on load + fallback local — `src/infrastructure/config-updater.ts`
- [U3] Selector.update() via remote — `src/infrastructure/selector-manager.ts`
- [U4] Feature flag via remote — `src/infrastructure/`
- [U5] Teste: mudar remote sem reinstall — `tests/e2e/`

### INFRAESTRUTURA (Geral)

- [INF-01] MCP Server (Stats: contatos, msgs/semana...)
- [INF-02] REST fallback
- [INF-03] WhatsApp selectors

### CATÁLOGO

- [CAT-01] Precisão/preço cruzamento site
- [CAT-02] Configuração por negócio (URL do cardápio)

### MELHORIAS DO AGENTE (Harness OpenAI-inspired)

- [HAR-01] Adicionar linter de arquitetura de módulos — `scripts/`
- [HAR-02] Implementar coleta de lixo automatizada — `.mettri/relatorio-coleta-lixo.md`
- [HAR-03] Criar índice do ZenSpecKit — `ZenSpecKit/INDICE.md`
- [HAR-04] Expor observabilidade para o agente — `scripts/inspect-*.mjs`
- [HAR-05] Registrar objetivo de acesso a dados — `.mettri/objectives.md`

## ✅ Concluídas

### ATENDIMENTO/OUVIR

- [x] [OUV-SPEC] 8 ZenSpecs (Specs/ouvir/)
- [x] [OUV-COD] Código (ouvinte, extrator, ambiguidade, validador...)
- [x] [OUV-EVT] Evento `ouvir:profile-updated`
- [x] [OUV-SINAL] Cliente novo: mostrar sinal na UI
- [x] [OUV-CAD] Popular cadastro automaticamente
- [x] [A1-FIX] Parsing de quantidade com unidades/símbolos — `ambiguidade.ts:71-107`

### ATENDIMENTO/AGENTE DE RESPOSTA

- [x] [LLM-01] LLMProvider — 17 testes
- [x] [LLM-02] agent-tools — 14 testes
- [x] [LLM-03] agent-prompt — 11 testes
- [x] [LLM-04] orchestrator — 8 testes

### CATÁLOGO

- [x] [CAT-SPEC] Specs + código (modules/catalogo/)

## ❌ Canceladas

(Nenhuma)

---

## ⚡ Novo Pedido (exemplos)

- "Implementa CM1 do funil comercial"
- "Corrige o bug do cardápio que não carrega"
- "Adiciona campo desconto no OrderRecordV2"
- "Continua de onde paramos"
