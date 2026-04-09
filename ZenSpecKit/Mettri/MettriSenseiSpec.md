# Mettri Sensei Spec

Modo de execução: `UI-first/Vertical slice`

Ordem de execução clara, em camadas. Este Sensei é a revisão macro do slice atual: **Retomar V1 com aprovação humana em lote, baseline visível, RAG invisível só para experimento, sem A/B por enquanto e sem conversão definida nesta fase**.

---

## 1. Entradas

Quais arquivos alimentam este Sensei.

| Tipo       | Arquivo                  | Papel                                               |
| ---------- | ------------------------ | --------------------------------------------------- |
| Conceito   | `./MettriConceptSpec.md` | Define o porquê, o que é e fronteiras do Mettri     |
| Engenharia | `./MettriEngSpec.md`     | Define componentes, fluxos, ciclo de vida e API     |
| Stack      | `./MettriStackSpec.md`   | Define ferramentas, pastas, dependências e comandos |

Referências de domínio usadas nesta revisão:

- `./Specs/retomar/spec.md`
- `./Specs/rag/spec.md`
- `./Specs/atendimento/spec.md`

---

## 2. Estado atual do projeto

> **Regra de segurança:** esta seção NUNCA pode ser apagada ou reduzida numa revisão.
> Cada revisão do Sensei DEVE preservar e, se necessário, atualizar esta seção
> com o estado real do projeto. Revisar = adicionar camada, não substituir.

### 2.1 O que o Mettri é (resumo do Concept)

Plataforma de vendas conversacionais que roda como extensão de navegador colada ao WhatsApp Web. Captura mensagens, organiza clientes, sugere próximos passos com IA — sempre com aprovação humana. Alvo: negócios locais e times pequenos. Metáfora: gerente de vendas dentro do WhatsApp.

### 2.2 Componentes existentes (da Eng Spec)

| Componente                 | Metáfora             | Status       | Observação                                      |
| -------------------------- | -------------------- | ------------ | ----------------------------------------------- |
| `selectorManager`          | detetive             | Implementado | Encontra elementos do WhatsApp via fallbacks     |
| `configUpdater`            | central de ordens    | Implementado | Config remota + fallback local                   |
| `messageCapturer`          | gravador de chamadas | Implementado | Intercepta mensagens webpack + DOM               |
| `messageDB`                | arquivo morto        | Implementado | IndexedDB, política "nunca apaga"                |
| `pluginRegistry`           | síndico do prédio    | Implementado | Descobre e registra módulos                      |
| `panelShell`               | prédio colado        | Implementado | Terceira coluna do Mettri                        |
| `atendimentoPanel`         | central de chamadas  | Implementado | Conversas em tempo real + sugestões              |
| `conversationOrchestrator` | maestro              | Implementado | Status da conversa (active/waiting/closed)        |
| `clientDirectoryPanel`     | agenda inteligente   | Implementado | Lista clientes com filtros e histórico           |
| `clientDB`                 | fichário             | Implementado | Cadastro, preferências, métricas por cliente     |
| `reactivationEngine`       | radar de sumidos     | Implementado | Motor de elegibilidade determinístico (4 ciclos) |
| `aiSuggestionEngine`       | copywriter           | Parcial      | Existe para sugestão A/B; será base do baseline  |
| `ragOrquestradorIndexacao` | bibliotecário        | Implementado | Indexa docs/mensagens em índice vetorial         |
| `ragOrquestradorConsulta`  | pesquisador          | Implementado | Busca semântica + monta contexto + chama LLM     |
| `strategyMonitor`              | vigia                | Implementado | Monitora saúde de seletores e capturas           |
| `engineeringContractChecker`   | auditor              | Implementado | Garante regras de engenharia em builds e testes  |

### 2.3 Fluxos que já funcionam

```text
1. Atendimento:  WhatsApp → messageCapturer → messageDB → conversationOrchestrator → atendimentoPanel → messageSender → WhatsApp
2. Reativação:   messageDB → reactivationEngine → listas de inativos → aiSuggestionEngine → marketingPanel → messageSender
3. RAG consulta: messageDB → ragOrquestradorIndexacao → índice → ragOrquestradorConsulta → atendimentoPanel
```

### 2.4 O que este slice adiciona ao projeto

O slice **Retomar V1** não substitui nada acima. Ele adiciona uma camada de **geração de mensagem com contexto + aprovação humana em lote + experimento oculto RAG vs baseline** ao fluxo de reativação existente (fluxo 2).

---

## 3. Saídas

O Sensei gera **dois arquivos**, em escalas diferentes:

| Nome           | Arquivo                 | Escala | O que contém                        |
| -------------- | ----------------------- | ------ | ----------------------------------- |
| Sensei (macro) | `./MettriSenseiSpec.md` | Macro  | Fases, componentes e grandes blocos |
| ZenTarefas     | `./MettriTarefas.md`    | Micro  | Lista mínima de tarefas acionáveis  |

Regra: o Sensei (macro) é lido poucas vezes. O ZenTarefas é lido todo dia.

---

## 4. Pipeline do slice Retomar V1

### 4.1 Fluxo de dados

```text
reactivationEngine (já existe)
        │
        │ lista de clientes sumidos
        ▼
retomarContextResolver ──── monta contexto de cada cliente (últimas msgs do messageDB)
        │
        │ contexto montado
        ├──────────────────────────────────┐
        ▼                                  ▼
retomarBaselineAgent                retomarExperimentOrchestrator (fase 3)
  gera mensagem baseline              │
        │                              ├─ chama ragOrquestradorConsulta (gera texto RAG)
        │                              ├─ compara baseline vs RAG via juiz
        │                              └─ grava log do experimento (RAG nunca aparece na UI)
        ▼
retomarApprovalPanel (UI)
  operador vê lista, edita, aprova
        │
        │ clique "Enviar"
        ▼
retomarSendRecorder
  envia via sendMessageService + grava no messageDB com variant='A' fixo
```

### 4.2 Tabela do pipeline

| Programa                          | Recebe                                       | Faz                                                 | Manda para                                                       |
| --------------------------------- | -------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------- |
| `reactivationEngine`              | histórico (messageDB)                        | Calcula quem está sumido (já existe)                | `retomarContextResolver`                                         |
| `retomarContextResolver`          | lista de chatIds + messageDB                 | Monta contexto (últimas msgs cliente + atendente)   | `retomarBaselineAgent`, `retomarExperimentOrchestrator`          |
| `retomarBaselineAgent`            | contexto montado + bridge para LLM           | Gera 1 mensagem baseline sem chunks RAG             | `retomarApprovalPanel`                                           |
| `retomarApprovalPanel`            | mensagens baseline + lista de pessoas        | Exibe, permite editar e aprovar em lote             | `retomarSendRecorder`                                            |
| `retomarSendRecorder`             | mensagens aprovadas + chatIds                | Envia via sendMessageService, grava no messageDB    | —                                                                |
| `retomarExperimentOrchestrator`   | contexto + baseline + ragOrquestradorConsulta | Gera texto RAG, compara via juiz, grava log        | — (só log, nada na UI)                                           |

---

## 5. Componentes-alvo (macro)

Lista de **unidades técnicas** que vão ganhar ZenSpec + implementação neste slice.

| Nome                            | Tipo         | Fonte principal                            | Depende de                                                       |
| ------------------------------- | ------------ | ------------------------------------------ | ---------------------------------------------------------------- |
| `retomarContextResolver`        | Componente   | `retomar/spec.md` + `rag/spec.md`         | `messageDB`                                                      |
| `retomarBaselineAgent`          | Componente   | `retomar/spec.md` + decisões desta revisão | `MettriBridgeClient`                                             |
| `retomarExperimentOrchestrator` | Orquestrador | `rag/spec.md` + `retomar/spec.md`         | `retomarContextResolver`, `ragOrquestradorConsulta`, `messageDB` |
| `retomarApprovalPanel`          | UI           | `retomar/spec.md` + `atendimento/spec.md` | `reactivationEngine`, `retomarBaselineAgent`, `sendMessageService` |
| `retomarSendRecorder`           | Infra        | `retomar/spec.md` + código atual           | `messageDB`, `retomarContador`, `sendMessageService`             |

Notas desta revisão:

- `reactivationEngine` continua sendo o **radar de sumidos** já descrito na Eng Spec; ele entra aqui como dependência, não como peça nova.
- `ragOrquestradorConsulta` continua existindo; neste slice ele serve de base para o experimento, mas **o texto enviado na UI será sempre o baseline**.
- O A/B existente no módulo Retomar fica **estacionado**. A saída operacional deste slice usa `variant = 'A'` fixo.

---

## 6. Fases (macro)

| Fase | Objetivo                                       | Critério de "pronto"                                                                                    |
| ---- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1    | Fundar contexto e agente baseline              | O sistema consegue montar contexto do cliente e gerar 1 mensagem baseline coerente sem usar chunks      |
| 2    | Ligar revisão humana em lote ao fluxo de envio | O usuário seleciona pessoas, clica "Gerar sugestões", edita se quiser e envia no fluxo atual            |
| 3    | Rodar experimento oculto RAG vs baseline       | O baseline segue visível na UI e o RAG roda só para juiz + log, sem aparecer para o operador            |
| 4    | Endurecer estado, testes e próximos ganchos    | Troca de ciclo limpa o lote anterior, testes cobrem estados-chave e o caminho para conversão fica claro |

---

## 7. Tarefas por fase (macro)

Cada linha combina **entrega humana** (o que muda na vida do operador/dev) com **tarefa técnica** (o trabalho explícito). A coluna *Entrega humana* é a fonte do primeiro verso em `MettriTarefas.md`; a coluna *Tarefa* vira o conteúdo da linha `↳`.

| ID   | Fase | Tipo    | Entrega humana (1 frase)                                                                 | Tarefa                                                                  | Origem                                     | Saída                                                                         | Pode ser paralelo? |
| ---- | ---- | ------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------- | ------------------ |
| RT1  | 1    | ZenSpec | Saber exatamente como o “detetive” monta `Cliente:` / `Atendente:` por chat.             | Criar ZenSpec de `retomarContextResolver`                               | `retomar/spec.md` + `rag/spec.md`          | `./Specs/retomar/retomar-context-resolver.zenspec.md`                         | Não                |
| RT2  | 1    | Código  | Ter código que lê o histórico e devolve o pacote de contexto pronto.                      | Implementar `retomarContextResolver`                                    | RT1                                        | `../../src/modules/marketing/retomar/retomar-context-resolver.ts`             | Não                |
| RT3  | 1    | Teste   | Garantir que borda (vazio, sem recebida, etc.) não quebra em silêncio.                   | Escrever testes de `retomarContextResolver`                             | RT1                                        | `../../tests/unit/marketing/retomar/retomar-context-resolver.test.ts`         | Sim                |
| RT4  | 1    | ZenSpec | Saber como o “copywriter” baseline gera 1 texto sem depender de chunks RAG.              | Criar ZenSpec de `retomarBaselineAgent`                                 | `retomar/spec.md` + decisões desta revisão | `./Specs/retomar/retomar-baseline-agent.zenspec.md`                           | Sim                |
| RT5  | 1    | Código  | Ver a ponte LLM → texto baseline funcionando com o contexto do RT2.                      | Implementar `retomarBaselineAgent`                                      | RT4, RT2                                   | `../../src/modules/marketing/retomar/retomar-baseline-agent.ts`               | Não                |
| RT6  | 1    | Teste   | Provar baseline com bridge mock e falhas explícitas quando faltar contexto.              | Escrever testes de `retomarBaselineAgent`                               | RT4                                        | `../../tests/unit/marketing/retomar/retomar-baseline-agent.test.ts`           | Sim                |
| RT7  | 2    | ZenSpec | Ter regra clara da tela onde o operador vê lista, edita e aprova em lote.                | Criar ZenSpec de `retomarApprovalPanel`                                 | `retomar/spec.md` + decisões desta revisão | `./Specs/retomar/retomar-approval-panel.zenspec.md`                           | Não                |
| RT8  | 2    | Código  | Operador clica “Gerar sugestões” e vê textos baseline na mesa de aprovação.               | Implementar `retomarApprovalPanel` com botão "Gerar sugestões"          | RT7, RT5                                   | `../../src/modules/marketing/retomar/retomar-panel.ts`                        | Não                |
| RT9  | 2    | Teste   | Seleção vazia, troca de ciclo e edição não surpreendem o estado da UI.                   | Escrever testes de estado de `retomarApprovalPanel`                     | RT7                                        | `../../tests/unit/marketing/retomar/retomar-approval-panel.test.ts`           | Sim                |
| RT10 | 2    | ZenSpec | Saber como cada envio fica registrado no histórico com variant fixo neste slice.         | Criar ZenSpec de `retomarSendRecorder`                                  | `retomar/spec.md` + código atual           | `./Specs/retomar/retomar-send-recorder.zenspec.md`                            | Sim                |
| RT11 | 2    | Código  | Cada envio gravado como **A** — sem split A/B até nova decisão.                          | Ajustar `retomarSendRecorder` para usar `variant='A'` fixo neste slice  | RT10                                       | `../../src/modules/marketing/retomar/retomar-panel.ts`                        | Não                |
| RT12 | 2    | Teste   | Gravação pós-envio coberta por testes alinhados à ZenSpec.                               | Escrever testes de `retomarSendRecorder`                                | RT10                                       | `../../tests/unit/marketing/retomar/retomar-send-recorder.test.ts`            | Sim                |
| RT13 | 3    | ZenSpec | Documentar o “juiz escondido”: RAG paralelo, comparação e log sem tela nova.             | Criar ZenSpec de `retomarExperimentOrchestrator`                        | `rag/spec.md` + decisões desta revisão     | `./Specs/retomar/retomar-experiment-orchestrator.zenspec.md`                  | Não                |
| RT14 | 3    | Código  | Experimento roda ao lado do fluxo real; operador continua só vendo baseline.             | Implementar `retomarExperimentOrchestrator`                             | RT13, RT2, RT5                             | `../../src/modules/marketing/retomar/retomar-experiment-orchestrator.ts`      | Não                |
| RT15 | 3    | Teste   | Orquestrador de experimento testável (log/juiz) sem vazar RAG na UI.                     | Escrever testes de `retomarExperimentOrchestrator`                      | RT13                                       | `../../tests/unit/marketing/retomar/retomar-experiment-orchestrator.test.ts`  | Sim                |
| RT16 | 4    | Código  | Trocar de ciclo = mesa limpa; nova leva de textos só após clique explícito.               | Limpar lote gerado ao trocar de ciclo e manter geração só no clique     | Decisões desta revisão                     | `../../src/modules/marketing/retomar/retomar-panel.ts`                        | Não                |
| RT17 | 4    | Teste   | Fluxo tenso (ciclo, seleção, edição antes de enviar) coberto antes de “pronto”.          | Cobrir troca de ciclo, seleção e edição antes do envio                  | RT7, RT13                                  | `../../tests/unit/marketing/retomar/retomar-panel-state.test.ts`              | Sim                |
| RT18 | 4    | Doc     | Quem abre o dia vê legenda + tarefas no formato humano + `↳` técnico.                     | Atualizar `MettriTarefas.md` com foco no slice atual                    | Este Sensei                                | `./MettriTarefas.md`                                                          | Não                |

Regras explícitas deste slice:

- Trio obrigatório por componente: **ZenSpec → Código → Teste**.
- O texto **enviado** e **editável** na UI é sempre o **baseline**.
- O texto com RAG fica **oculto** e serve apenas para juiz + log.
- O contexto do juiz no Retomar V1 é:
  - `Cliente:` última mensagem recebida do cliente
  - `Atendente:` última mensagem real de retomar enviada
- Troca de ciclo limpa o lote anterior; remarcação de pessoas **não** regenera automaticamente.

---

## 8. ZenTarefas (micro)

### 8.1. Pipeline visual do slice

```text
reactivationEngine → retomarContextResolver → retomarBaselineAgent → retomarApprovalPanel → retomarSendRecorder
                                                    ↕ (oculto, fase 3)
                                       retomarExperimentOrchestrator → juiz → log
```

### 8.2. Blocos de trabalho

| Bloco              | Quando usar                                | To-dos mínimos                                                                |
| ------------------ | ------------------------------------------ | ----------------------------------------------------------------------------- |
| Contexto           | Antes de qualquer geração                  | 1) ZenSpec contexto, 2) código, 3) testes                                     |
| Agente baseline    | Quando contexto já existe                  | 1) ZenSpec prompt, 2) código do agente, 3) testes com bridge mockado          |
| Aprovação em lote  | Quando baseline já gera                    | 1) ZenSpec UI, 2) código do painel, 3) testes de estado/seleção              |
| Experimento oculto | Quando o painel já consegue gerar e enviar | 1) ZenSpec orquestrador, 2) código, 3) testes de log/juiz sem expor RAG na UI |
| Endurecimento      | Quando o fluxo já anda de ponta a ponta    | 1) limpar lote ao trocar ciclo, 2) testes de edge cases, 3) docs curtas      |

### 8.3. Formato do `MettriTarefas.md` (micro)

Alinhado ao template global (`ZenSenseiSpec.md` §6.3):

- **Primeira linha** de cada item: `RT<ID> — …` com a **mesma ideia** da coluna *Entrega humana* da §7 (o que muda para humano/IA ao concluir).
- **Segunda linha**: `↳` + detalhe técnico (ZenSpec / código / teste), nome do programa em `código`, caminho ou critério.
- Bloco **O que estamos construindo** no topo = legenda do slice; manter curto e coerente com §4 e §6 deste Sensei.

---

## 9. Ganchos para GitHub

| Alvo       | Como usar                                                                            |
| ---------- | ------------------------------------------------------------------------------------ |
| Issues     | Título sugerido: `RT<ID> — <resumo da entrega humana>`; na descrição, colar a linha `↳` técnica de `MettriTarefas.md` |
| Labels     | Usar `tipo/<Tipo>` e `fase/<Fase>` (ex.: `tipo/ZenSpec`, `tipo/Código`, `fase/1`)  |
| Milestones | Cada fase vira milestone (`Fase 1 - Contexto`, `Fase 2 - Aprovação`, etc.)          |
| PRs        | Ideal: 1 PR por componente do slice (`context`, `agent`, `panel`, `experiment`)     |

Se não usar GitHub, mapear os mesmos IDs para a ferramenta equivalente.

---

## 10. Regras de passagem de fase

| Fase | Pode encerrar quando…                                                                                     |
| ---- | --------------------------------------------------------------------------------------------------------- |
| 1    | `retomarContextResolver` e `retomarBaselineAgent` têm ZenSpec aprovada, código e testes verdes           |
| 2    | O painel permite selecionar, gerar, editar e enviar em lote usando o fluxo atual, sem A/B neste slice   |
| 3    | O experimento grava `rag` vs `baseline` sem expor o RAG na UI e sem quebrar o envio                      |
| 4    | Troca de ciclo limpa o lote anterior, testes de estado cobrem os cenários-chave e o caminho futuro está claro |

---

## 11. Escopo fora

O que este Sensei **não** faz nesta revisão:

- Definir conversão (respondeu/comprou/ambos e janela de tempo).
- Reativar A/B nesta fase.
- Expor o RAG na UI do Retomar.
- Automatizar envio sem aprovação humana.
- Replanejar infra, clientes ou atendimento fora do slice atual.

---

## 12. Registro de mudanças

| ID  | Origem (tarefa/evento)                           | O que mudou                                                                                  | Tarefas afetadas |
| --- | ------------------------------------------------ | -------------------------------------------------------------------------------------------- | ---------------- |
| M01 | Conversa de planejamento do slice Retomar V1     | Slice fixado como baseline visível + RAG oculto para experimento, sem A/B por enquanto       | RT1–RT18         |
| M02 | Revisão de qualidade do Sensei e Tarefas         | Adicionada seção "Estado atual" (inventário do projeto) e seção "Pipeline do slice" com fluxo de dados | Todas    |
| M03 | Clareza do micro (`MettriTarefas`)               | Coluna *Entrega humana* na §7; §8.3 com formato obrigatório; `MettriTarefas.md` com legenda + linha humana + `↳` técnica; template global `ZenSenseiSpec` §6.3 alinhado | RT1–RT18, kit |
