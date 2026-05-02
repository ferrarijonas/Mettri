# RAG

---

## Conceito

Sugestão de resposta no atendimento baseada no histórico: o sistema busca conversas passadas parecidas (por significado), monta um prompt com esses exemplos e o modelo gera uma resposta sugerida. O atendente aprova ou edita antes de enviar.

---

## Pipeline

Detalhes de Interface (toggle automático), escopo **Mettri aberto** (sem obrigar painel de Atendimento visível), critério de mensagem inbound e regras de concorrência por `chatId` ficam na spec de atendimento: [Specs/atendimento/spec.md](../atendimento/spec.md).

### Indexação (uma vez ou sob demanda)

```
MessageDB  →  chunks (turno)  →  embed_index  →  vector store
```

E, em nível de gatilho externo:

```
UI (ação de indexação)  →  orquestrador_indexacao_rag  →  fonte → agrupar_por_turno → embed_index → guardar
```

| Programa                     | Recebe                  | Faz                                          | Manda para            |
| ---------------------------- | ----------------------- | -------------------------------------------- | --------------------- |
| `orquestrador_indexacao_rag` | gatilho da UI / comando | Orquestra leitura, agrupamento e indexação   | — (fim do pipe)       |
| **fonte**                    | chatId? (ou nada)       | Lê MessageDB, ordem asc                      | **agrupar_por_turno** |
| **agrupar_por_turno**        | stream de mensagens     | Agrupa em turnos, monta chunk (content, ids) | **embed_index**       |
| **embed_index**              | stream de chunks        | Chama API embedding por texto                | **guardar**           |
| **guardar**                  | (chunk, vetor)          | Persiste no índice vetorial                  | — (fim do pipe)       |

**Gatilho da indexação (quando rodar este pipeline):**

- **Opção A:** Botão "Preparar histórico" no painel: usuário clica quando quiser; mostrar progresso (ex.: "Indexando… 1.200 / 5.000") via `orquestrador_indexacao_rag`.
- **Opção B:** **Se** o **armazenamento vetorial persistente** (`VectorIndex`, ex. IndexedDB) estiver **vazio** (nenhum registro utilizável para `buscar` — na implementação: `VectorIndex.isEmpty()` resolve `true`, ou equivalente documentado) **e** ocorrer a primeira consulta — **seja** por ação `rag:generate` **seja** por gatilho automático documentado na spec de atendimento — **então** aplicar o mesmo fluxo de preparação: informar o operador (ex.: "Preparando histórico (1–2 min)") e rodar `orquestrador_indexacao_rag` antes da consulta.
- **Reinício do Mettri / extensão:** **Se** o backend `VectorIndex` já persistir dados em disco **então**, após reinício, **não** é obrigatório executar de novo o pipeline completo de `orquestrador_indexacao_rag` **só** porque uma nova sessão em memória começou. O critério é o **estado persistido** (ex.: `isEmpty() === false`), não uma flag só de sessão em RAM. Reindexação completa ou incremental por outro motivo (botão explícito, mudança de versão de índice, política de produto) fica fora deste gatilho obrigatório.
- Pode combinar as duas: botão explícito + first-use se índice **persistente** vazio.

Não rodar em background pesado sem o usuário saber (custo e tempo de API).

- **Se** o modo "gerar sugestão automático" estiver **ligado** na Interface do atendimento **então** o operador foi informado implicitamente pelo controle visível do toggle **e** o sistema pode disparar consultas RAG sem clique adicional (ainda sujeito a erros de API como hoje).

---

### Consulta (manual ou automática)

```
conversa atual  →  embed_consulta  →  busca (top K)  →  prompt+GPT  →  avaliar_sugestao_rag  →  sugestão + debug
```

E, em nível de gatilho externo (dois gatilhos **equivalentes** para o **mesmo** encadeamento interno até `orquestrador_consulta_rag`: embed → buscar → prompt+GPT → avaliar…):

```
UI (ação rag:generate)
     ╲
      ╲──►  orquestrador_consulta_rag  →  embed_consulta  →  buscar  →  prompt+GPT  →  avaliar_sugestao_rag  →  UI
     ╱
Mettri ativo + nova mensagem inbound do cliente no chat ativo do WhatsApp, com modo "gerar sugestão automático" ligado (detalhe de UI, evento e escopo **sem** exigir painel Atendimento visível → spec de atendimento)
```

| Programa                    | Recebe                                                                                                                                                                                                     | Faz                                     | Manda para             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------- |
| `orquestrador_consulta_rag` | **Origem do gatilho:** manual (`rag:generate`) ou automática (toggle + Mettri aberto — ver atendimento). **Entrada de dados:** contexto da conversa (`messages`, `k`, etc.) — mesma assinatura conceitual. | Orquestra consulta, geração e avaliação | UI (sugestão)          |
| `embed_consulta`            | texto (1)                                                                                                                                                                                                  | Gera vetor da conversa atual            | `buscar`               |
| `buscar`                    | vetor + k                                                                                                                                                                                                  | Similaridade no índice, top K           | `prompt+GPT`           |
| `prompt+GPT`                | conversa + chunks                                                                                                                                                                                          | Monta prompt, chama modelo              | `avaliar_sugestao_rag` |
| `avaliar_sugestao_rag`      | conversa + chunks + saída do modelo                                                                                                                                                                        | Avalia sugestão com LLM-as-judge        | UI (via orquestrador)  |

---

## Experimento: RAG vs baseline com juiz LLM

Esta seção descreve o experimento usado para:

- avaliar automaticamente a qualidade das respostas geradas com e sem RAG;
- produzir dados para melhoria contínua do RAG;
- gerar insumos para divulgação (posts, artigos, etc.).

### Objetivo do experimento

- Comparar, para cada sugestão de resposta:
  - **Resposta com RAG** (conversa atual + chunks similares).
  - **Resposta baseline** (conversa atual, sem chunks; `chunks = []`).
- Medir, em ambas, três critérios por meio de um juiz LLM:
  - **Relevância**: trata do que o cliente perguntou?
  - **Fidelidade**: está apoiada na conversa + chunks, sem alucinações?
  - **Estilo Jonas**: segue as regras de escrita do atendente Jonas?

Metáfora: o juiz funciona como um “árbitro” único que apita todas as jogadas e diz se a jogada com RAG foi melhor, igual ou pior que a jogada sem RAG.

### Fluxo do experimento (por chamada de consulta)

Na consulta, o fluxo completo é:

1. `orquestrador_consulta_rag` monta `conversationText` e `currentConversation`.
2. Chama `embed_consulta` + `buscar` para obter `chunks` similares.
3. Chama `prompt+GPT` para gerar a **sugestão com RAG** (`suggestion`).
4. Chama `avaliar_sugestao_rag(currentConversation, chunks, suggestion, bridge)` e grava o resultado em `debugInfo.evaluation`.
5. Chama `prompt+GPT(currentConversation, [], bridge)` para gerar a **sugestão baseline** (`baselineSuggestion`).
6. Chama `avaliar_sugestao_rag(currentConversation, [], baselineSuggestion, bridge)` e grava em `debugInfo.baselineNoRag.evaluation`.
7. `orquestrador_consulta_rag` devolve para a UI:
   - `suggestion` (com RAG),
   - `chunks`,
   - `debugInfo` contendo `evaluation` e `baselineNoRag`.

### Contrato do juiz `avaliar_sugestao_rag`

- **Entrada:**
  - `currentConversation: string` — conversa atual em formato legível (“Cliente: … / Atendente: …”).
  - `chunks: ConversationChunk[]` — lista de exemplos similares (pode ser `[]` no baseline).
  - `suggestion: string` — texto da sugestão a ser avaliada (não pode ser vazia).
  - `bridge: MettriBridgeClient` — usado para ler API key e chamar a API de chat.
- **Saída:**
  - Objeto:
    - `scoreRelevance: number` — `[0, 1]`.
    - `scoreFaithfulness: number` — `[0, 1]`.
    - `scoreStyle: number` — `[0, 1]`.
    - `mode: 'llm'`.
    - `notes?: string` — justificativa curta opcional.
- Validações:
  - Lança erro se `suggestion.trim() === ''`.
  - Lê `mettri:openai:apiKey` via `bridge.storageGet`; se ausente/vazia → erro explícito de configuração.
  - Chama `https://api.openai.com/v1/chat/completions` com `model = 'gpt-4o-mini'`, `temperature = 0.0`.
  - Exige que os três scores estejam em `[0, 1]`; qualquer valor fora do intervalo ou campo ausente resulta em erro.

Obs.: esta função é **pura do ponto de vista do domínio** (sem side effects além da chamada HTTP) e pode ser facilmente mockada via parâmetro opcional `avaliarFn` em `orquestrador_consulta_rag`, para testes.

### Logging do experimento (JSONL)

Para permitir análise posterior (tanto técnica quanto para divulgação), o experimento registra cada chamada relevante em um arquivo de log no formato **JSONL** (um JSON por linha).

#### Estrutura de uma linha de log

Cada linha representa **uma execução bem-sucedida** do fluxo de consulta que inclui RAG + baseline + juiz e gravação no log — **quer** disparada por clique em "Gerar sugestão" (`rag:generate`) **quer** por modo automático na Interface (ver spec de atendimento):

- Campos sugeridos:
  - `timestamp: string` — ISO da hora em que a sugestão foi gerada.
  - `chatId: string` — identificador do chat no painel de Atendimento.
  - `messageId?: string` — id da mensagem cliente que originou a sugestão (quando houver).
  - `currentConversation: string` — texto completo da conversa usada no prompt.
  - `rag`: objeto com:
    - `suggestion: string`.
    - `evaluation: { scoreRelevance: number; scoreFaithfulness: number; scoreStyle: number; notes?: string }`.
  - `baseline`: objeto com:
    - `suggestion: string`.
    - `evaluation: { scoreRelevance: number; scoreFaithfulness: number; scoreStyle: number; notes?: string }`.
  - `chunksSummary`: `Array<{ id: string; chatId: string; timestamp: string; preview: string }>`:
    - `preview` é um trecho curto de `content` (por exemplo, primeiros 120 caracteres).
  - `k: number` — valor de K usado na busca vetorial.
  - `ragPromptVersion?: string` — identificador lógico da versão do prompt RAG.
  - `judgePromptVersion?: string` — versão lógica do prompt do juiz.
  - `indexVersion?: string` — versão do esquema/estratégia do índice vetorial (se aplicável).
  - `model: string` — nome do modelo de chat usado.

#### Regras de logging

- **R1 — Um registro por sucesso de consulta:** cada chamada bem-sucedida de `orquestrador_consulta_rag` (manual ou automática) gera exatamente uma linha no log.
- **R1.1 — Atualização da UI de experimento:** estatísticas exibidas no mini-dashboard (spec de atendimento) podem ser atualizadas com **uma** leitura agregada lógica (ou refresh pontual após sucesso de gravação), sem exigir múltiplas leituras paralelas ao storage por cada redesenho de tela — ver item 9 da spec de atendimento. **Implementação de referência:** `readRagExperimentStatsForDashboard` em [src/modules/rag/experiment_logger.ts](src/modules/rag/experiment_logger.ts) (uma passagem pelas chaves da janela longa, agregando sub-janelas “hoje”, recente ex. 7 dias, e total).
- **R2 — Logging best-effort:** falhas ao escrever no log **não** devem quebrar o fluxo principal de sugestão/atendimento; devem apenas ser registradas em console/telemetria.
- **R3 — Anonimização opcional:** quando necessário para uso público (posts, artigos), dados sensíveis (`chatId`, textos de conversa) podem ser anonimizados ou truncados na etapa de análise, não na gravação.
- **R4 — Tamanho controlado:** o log pode ser rotacionado (ex.: por data ou tamanho máximo); a política de retenção não é crítica para a lógica do RAG, apenas para análise posterior.

### Métricas derivadas esperadas

O log permite calcular, offline:

- Percentual de casos em que:
  - `scoreRag > scoreBaseline` (RAG melhor),
  - `scoreRag ≈ scoreBaseline` (empate dentro de um delta),
  - `scoreRag < scoreBaseline` (RAG pior).
- Evolução temporal de:
  - média de relevância, fidelidade e estilo,
  - por versão de prompt/índice.
- Conjuntos de exemplos:
  - “Top N casos em que RAG ajudou muito” (diferença grande a favor),
  - “Top N casos em que baseline foi melhor” (alerta de problema na busca ou no prompt).

Essas métricas são usadas tanto para melhoria do sistema (ajuste de prompt, índice, parâmetros) quanto para documentação e divulgação dos resultados do experimento.

---

## Onde fica e integração

- **Código (pipeline RAG):** [src/modules/rag/](src/modules/rag/) — tipos, `fonte`, `agrupar_por_turno`, `embed_index`, `guardar`, `embed_consulta`, `buscar`, `orquestrador_indexacao_rag`, `orquestrador_consulta_rag`, `experiment_logger` (incl. agregado para o mini-dashboard).
- **Índice vetorial:** implementação persistente principal `VectorIndexIDB` (`VectorIndex` com `upsertMany`, `query`, `isEmpty`).
- **Orquestração produto (automático + preparação Opção B + consulta):** [src/modules/atendimento/rag-mettri-controller.ts](src/modules/atendimento/rag-mettri-controller.ts) — escuta `message:new` e `chat:active-changed` no `EventBus` do shell; se `VectorIndex.isEmpty()` então `orquestrador_indexacao_rag`, senão segue para `orquestrador_consulta_rag`; mantém estado de sugestão/loading/debug consumível pela UI.
- **Registro dos listeners:** [src/ui/panel.ts](src/ui/panel.ts) — `MettriPanel` chama `registerRagAutoListeners(eventBus)` na construção, para o automático **não** depender do `render` do módulo `atendimento.dashboard`.
- **UI Atendimento:** [src/modules/atendimento/dashboard/](src/modules/atendimento/dashboard/) — bloco "Resposta sugerida" (`rag:generate`, `rag:send`, toggle persistido); sincroniza o estado vindo do controller ao redesenhar e subscreve atualizações para novo `render`. Detalhe de **quando** o evento `message:new` é emitido (visibilidade da lateral) está na spec de atendimento.

---

## Não inclui (escopo fora desta spec)

- Envio efetivo da mensagem no WhatsApp (quem envia é o painel/ bridge).
- Definição do texto exato do prompt ao GPT (pode ficar no orquestrador ou em config).
- Autenticação ou cobrança da API de embeddings/ modelo (uso externo).
- Retenção detalhada do índice vetorial além das regras de limpeza do MessageDB; por padrão, vetores podem ser mantidos mesmo após remoção das mensagens brutas.

---

## Lógica

### fonte

No pipeline de indexação, este programa é o primeiro estágio: lê o MessageDB e alimenta o **agrupar_por_turno**.

```
MessageDB  →  fonte  →  agrupar_por_turno
```

**Objetivo:** Ler mensagens do MessageDB (persistência local das conversas capturadas) e entregá-las em ordem cronológica ascendente para o próximo estágio. Único programa do pipeline de indexação que faz I/O com o banco.

---

##### Entradas

| Nome   | Tipo     | Obrigatório | Descrição                                                                      |
| ------ | -------- | ----------- | ------------------------------------------------------------------------------ |
| chatId | `string` | não         | Se informado, retorna apenas mensagens desse chat. Se omitido, todos os chats. |

**Pré-condição:** MessageDB disponível (já inicializado/aberto). Se o banco estiver vazio ou não houver mensagens para o(s) chat(s) pedido(s), a saída é array vazio.

---

##### Saídas

| Nome     | Tipo                | Descrição                                                                                                                                                                                      |
| -------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| messages | `CapturedMessage[]` | Mensagens lidas do MessageDB, ordenadas por `timestamp` ascendente (mais antiga primeiro). Com `chatId` dado: só desse chat; sem `chatId`: de todos os chats (ordem global asc por timestamp). |

**Contrato para o downstream:** O **agrupar_por_turno** espera mensagens de um único chat por chamada. Se a fonte for chamada sem `chatId`, o orquestrador deve agrupar as mensagens por `chatId` e invocar agrupar_por_turno uma vez por chat.

**Referência do tipo:** `CapturedMessage` tem `id`, `chatId`, `chatName`, `sender`, `text`, `timestamp`, `isOutgoing`, `type` (ex.: `'text'`). Definido em `src/types/schemas.ts`.

---

##### Regras

**R1 — Ordem:** As mensagens na saída estão sempre ordenadas por `timestamp` ascendente (cronológica: mais antiga primeiro).

**R2 — Filtro opcional por chat:** Se `chatId` for passado, incluir apenas mensagens cujo `chatId` seja igual ao informado.

**R3 — Sem filtro de tipo aqui:** A fonte não filtra por `type` nem por texto vazio; entrega todas as mensagens retornadas pelo MessageDB. O **agrupar_por_turno** aplica o filtro (ex.: só `type === 'text'` e texto não vazio).

**R4 — Leitura somente:** Apenas leitura no MessageDB; nenhuma escrita ou alteração.
**R5 — Sem orquestração:** `fonte` não decide gatilhos, quantidade de chamadas nem etapas seguintes do pipeline; essas decisões pertencem ao `orquestrador_indexacao_rag`.

---

##### Edge cases

| Caso                      | Entrada              | Comportamento                                           |
| ------------------------- | -------------------- | ------------------------------------------------------- |
| MessageDB vazio           | qualquer             | Saída `[]`.                                             |
| `chatId` inexistente      | chatId sem mensagens | Saída `[]`.                                             |
| `chatId` informado        | chatId válido        | Saída: mensagens daquele chat, ordem asc.               |
| `chatId` omitido          | —                    | Saída: todas as mensagens de todos os chats, ordem asc. |
| Erro ao acessar MessageDB | —                    | Falha explícita (rejeitar promise / lançar erro).       |

---

##### Critérios de aceitação

- Dado um `chatId` com N mensagens no MessageDB → saída tem N mensagens, ordem ascendente por `timestamp`.
- Dado MessageDB vazio → saída é `[]`.
- Dado `chatId` sem mensagens → saída é `[]`.
- Sem `chatId`, com vários chats no MessageDB → saída contém mensagens de todos os chats, em ordem ascendente global por `timestamp`.
- Cada item da saída é um `CapturedMessage` válido (compatível com o schema do projeto).

---

### agrupar_por_turno

No pipeline de indexação, este programa fica entre `fonte` e `embed_index`:

```
fonte (stream msgs)  →  agrupar_por_turno  →  embed_index
```

**Objetivo:** Receber mensagens em ordem cronológica e emitir uma sequência de chunks (pares turno cliente + turno atendente). Sem I/O externo; função pura.

---

##### Entradas

| Nome     | Tipo                | Obrigatório | Descrição                                                                                |
| -------- | ------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| messages | `CapturedMessage[]` | sim         | Mensagens de um mesmo chat, ordenadas por `timestamp` ascendente (mais antiga primeiro). |

**Pré-condição:** Todas as mensagens do array devem ter o mesmo `chatId`. Se o array estiver vazio → saída é array vazio.

**Filtro de entrada:** Considerar apenas mensagens com `type === 'text'` e `text` legível por humano. Ignorar mensagens com `text` vazio, só espaços ou que sejam claramente payload técnico (ex.: trechos longos em base64, hashes ou IDs binários) — essas não entram no agrupamento.

---

##### Saídas

| Nome   | Tipo                  | Descrição                                                                                                                  |
| ------ | --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| chunks | `ConversationChunk[]` | Um chunk por par completo (turno cliente + turno atendente). Ordem preservada (primeiro par no tempo = primeiro na lista). |

**Schema da saída (ConversationChunk):** Cada chunk é um par **turno do cliente + turno atendente**. Formato:

| Campo         | Tipo     | Descrição                                           |
| ------------- | -------- | --------------------------------------------------- |
| id            | string   | Estável (ex.: chatId + timestamp da 1ª msg)         |
| schemaVersion | string   | Ex.: "1.0" (para evoluir sem quebrar)               |
| content       | string   | "Cliente: …\nAtendente: …" (texto vetorizado)       |
| chatId        | string   | De onde vieram as mensagens                         |
| timestamp     | string   | ISO da primeira msg do par                          |
| messageIds    | string[] | IDs das mensagens que formam o par                  |
| turnSize      | objeto   | { client: N, agent: M } (qtd de msgs em cada turno) |

---

##### Regras

**R1 — Turno do cliente:** Sequência consecutiva de uma ou mais mensagens com `isOutgoing === false` (após filtrar por type e texto não vazio).

**R2 — Turno do atendente:** Sequência consecutiva de uma ou mais mensagens com `isOutgoing === true` (após o mesmo filtro).

**R3 — Par e chunk:** Cada par (turno cliente imediatamente seguido de turno atendente) gera exatamente um chunk. Se não houver turno atendente após um turno cliente, esse turno cliente não gera chunk (é descartado para esta saída).

**R4 — content:** Para cada chunk, `content = "Cliente: " + concatenação dos `text` do turno cliente separados por um espaço + "\nAtendente: " + concatenação dos `text` do turno atendente separados por um espaço.

**R5 — id estável:** `id` deve ser determinístico: mesmo conjunto de mensagens → mesmo id. Ex.: `chatId + "_" + timestamp.toISOString()` da primeira mensagem do par, ou `chatId + "_" + messageIds[0]`.

**R6 — messageIds:** Ordenados na ordem cronológica das mensagens do par (todas as ids do turno cliente, depois todas do turno atendente).

**R7 — turnSize:** `{ client: N, agent: M }` onde N = quantidade de mensagens do turno cliente no par, M = quantidade do turno atendente.

**R8 — Início com atendente:** Se a primeira mensagem (após filtro) for `isOutgoing === true`, ignorar mensagens até aparecer a primeira do cliente; a partir daí aplicar R1–R3.

**R9 — Um único chat:** Se `messages` tiver mais de um `chatId`, o comportamento é indefinido (a spec assume um chat por chamada).

---

##### Edge cases

| Caso                            | Entrada                            | Comportamento                                                                                |
| ------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------- |
| Array vazio                     | `[]`                               | Saída `[]`.                                                                                  |
| Só mensagens do cliente         | todas `isOutgoing === false`       | Saída `[]` (nenhum par completo).                                                            |
| Só mensagens do atendente       | todas `isOutgoing === true`        | Saída `[]`.                                                                                  |
| Primeira msg é do atendente     | [atendente, cliente, atendente, …] | Ignorar a primeira; primeiro par = (cliente, atendente).                                     |
| Última msg é do cliente         | […, cliente, atendente, cliente]   | Último turno cliente sem resposta → não gera chunk; saída tem os pares completos anteriores. |
| Mensagem com text vazio         | msg com `text: ""` ou só espaços   | Mensagem ignorada (não entra em turno).                                                      |
| Mensagem com payload técnico    | msg com base64/hash/ID extenso     | Mensagem tratada como texto não legível e ignorada (não entra em turno).                     |
| Uma msg cliente + uma atendente | exatamente 2 msgs                  | Um chunk com turnSize `{ client: 1, agent: 1 }`.                                             |

---

##### Critérios de aceitação

- Dado array de mensagens em ordem asc com alternância cliente/atendente → saída tem um chunk por par completo.
- Dado array vazio → saída é array vazio.
- Dado só mensagens de um lado → saída é array vazio.
- Dado mesmo array de mensagens em duas chamadas → mesmos chunks e mesmo `id` para o mesmo par.
- Cada chunk tem `content` no formato "Cliente: …\nAtendente: …" e `messageIds` contendo exatamente as ids do par.

---

### embed_index

No pipeline de indexação, este programa fica entre `agrupar_por_turno` e `guardar`:

```
agrupar_por_turno (chunks)  →  embed_index  →  guardar
```

**Objetivo:** Receber chunks já normalizados e gerar embeddings numéricos para cada um, prontos para serem persistidos no índice vetorial pelo `guardar`. Usa o mesmo modelo de embedding e a mesma dimensão `D` definidos para `embed_consulta`.

**Configuração fixa de embedding:**

- Modelo: `text-embedding-3-small` (OpenAI).
- Dimensão do vetor: `D = 1536`.

---

##### Entradas

| Nome   | Tipo                  | Obrigatório | Descrição                                                                                          |
| ------ | --------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| chunks | `ConversationChunk[]` | sim         | Chunks produzidos pelo `agrupar_por_turno`. Ordem deve ser preservada (primeiro chunk = primeiro). |

**Pré-condição:** Cada `ConversationChunk` deve seguir o schema definido em `agrupar_por_turno`, com `content` não vazio (o pipeline anterior garante isso).

---

##### Saídas

| Nome  | Tipo                                               | Descrição                                                                                          |
| ----- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| items | `{ chunk: ConversationChunk; vector: number[] }[]` | Um item por chunk de entrada: o próprio chunk + seu embedding numérico, na mesma ordem de entrada. |

O campo `vector` é um array de números (`number[]`) de dimensão fixa `D = 1536`, igual para todos os vetores e compatível com `embed_consulta`.

---

##### Regras

- **R1 — Ordem preservada:** Para cada `chunks[i]` deve existir exatamente um `items[i]` correspondente, sem reordenar nem pular elementos (a menos em caso de erro global).
- **R2 — Texto de entrada do modelo:** O texto enviado para o modelo de embedding é baseado **diretamente** no campo `content` do chunk, aplicando no máximo normalizações neutras como `trim`.
- **R2.1 — Truncamento de segurança:** Se `content` exceder o limite suportado pelo provedor de embedding, o texto é truncado no final (mantendo o início do turno) para caber no limite de tokens do modelo.
- **R3 — Modelo único por execução:** Dentro de uma mesma execução, todos os embeddings devem ser gerados com o **mesmo modelo de embedding** e mesmas configurações (dimensão, parâmetros), compartilhados com `embed_consulta`.
- **R4 — Dimensão fixa:** Todos os `vector` retornados têm exatamente a mesma dimensão `D`. Se a API devolver dimensão inesperada, deve ser tratado como erro.
- **R5 — Idempotência lógica:** Dado o mesmo array de chunks e a mesma configuração, duas chamadas seguidas de `embed_index` devem produzir vetores compatíveis (diferenças só dentro do ruído numérico do provedor).
- **R6 — Erros de API:** Se a chamada ao serviço de embedding falhar (timeout, erro 5xx, etc.), o programa deve **falhar explicitamente** (promise rejeitada / exceção) e não devolver uma lista parcialmente preenchida; o orquestrador decide re‑tentar ou degradar.
- **R7 — Fonte da API key:** A chave da API de embeddings deve ser lida de um storage local identificado pela chave lógica `mettri:openai:apiKey`; se estiver ausente ou vazia, `embed_index` falha explicitamente com erro de configuração de chave.
- **R8 — Chamada à API de embeddings:** `embed_index` chama a API de embeddings via HTTP `POST https://api.openai.com/v1/embeddings` com body `{ model: "text-embedding-3-small", input: string[] }` e cabeçalho `Authorization: Bearer <apiKey>`.
- **R9 — Batching:** Quando o número de chunks exceder o limite de itens por chamada do provedor, `embed_index` deve dividir o array de textos em lotes (batches) de tamanho fixo e fazer múltiplas chamadas sequenciais, agregando os vetores em um único array final.
- **R10 — Ordem entre batches:** A concatenação dos vetores retornados pelos batches deve preservar a ordem global original dos `chunks`; o `items[i]` sempre corresponde ao `chunks[i]` considerando todos os batches.

---

##### Edge cases

| Caso                      | Entrada                    | Comportamento                                               |
| ------------------------- | -------------------------- | ----------------------------------------------------------- |
| Array vazio               | `[]`                       | Saída `[]` sem chamar o serviço de embedding.               |
| Chunk com `content` vazio | chunk com `content === ""` | Comportamento indefinido (pipeline anterior deve evitar).   |
| Erro na API de embedding  | qualquer                   | Falha explícita (reject/throw), sem lista parcial de items. |

---

##### Critérios de aceitação

- Dado um array de `N` `ConversationChunk` válidos → saída contém `N` itens `{ chunk, vector }` na mesma ordem.
- Todos os `vector` têm a mesma dimensão `D` e são arrays de `number`.
- Dado o mesmo array de chunks e config em duas execuções → os vetores retornados são consistentes (não completamente diferentes a cada chamada).
- Em caso de erro de API de embedding, nenhuma escrita em índice ocorre via `embed_index` (quem persiste é o `guardar`, depois de uma chamada bem‑sucedida).

---

### guardar

No pipeline de indexação, este programa é o último estágio: recebe os embeddings e grava no índice vetorial.

```
embed_index  →  guardar  →  — (fim do pipe)
```

**Objetivo:** Persistir cada par `(chunk, vector)` no índice vetorial, garantindo que o índice esteja pronto para consultas por similaridade.

---

##### Entradas

| Nome  | Tipo                                               | Obrigatório | Descrição                                                                                         |
| ----- | -------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| items | `{ chunk: ConversationChunk; vector: number[] }[]` | sim         | Saída do `embed_index`: um item por chunk, com o mesmo `vector` usado posteriormente em `buscar`. |

**Pré-condições:**

- Todos os `vector` têm mesma dimensão `D` (validado por `embed_index`).
- O backend de índice vetorial (banco/serviço) está disponível e configurado.

**Backend do índice vetorial:**

- Implementado como uma interface lógica `VectorIndex`, responsável por:
  - `upsertMany(items)` — gravar/atualizar cada `(chunk, vector)` identificado por `chunk.id`.
  - `query(queryVector, k)` — retornar os `k` chunks mais similares por similaridade de cosseno.
  - `isEmpty()` — `Promise<boolean>`, `true` quando não há registros persistidos utilizáveis para `buscar` (checagem leve; em IndexedDB, p.ex. `count` na object store, sem exigir carregar todos os vetores em RAM só para saber se há dados).
- Uma implementação **persistente** (ex.: `VectorIndexIDB` em IndexedDB): object store com chave `chunk.id`, dados em disco; o índice permanece ao reabrir o navegador. O fluxo de consulta/indexação RAG no produto usa essa implementação via `rag-mettri-controller` + módulo Atendimento.
- O detalhe de armazenamento é interno ao `VectorIndex` e não faz parte deste contrato.

---

##### Saídas

Este programa não produz dados para o próximo estágio do pipe.

- Sucesso: operação conclui sem erro (promise resolvida / função retorna).
- Falha: erro explícito (reject/throw) indicando que nenhum item foi garantidamente persistido.

---

##### Regras

- **R1 — Upsert por chunk:** Para cada item, se já existir registro com o mesmo `chunk.id` no índice, o registro é substituído (upsert); caso contrário, é criado.
- **R2 — Atomicidade por item:** Cada `(chunk, vector)` é escrito de forma independente; uma falha em um item não deve marcar outro item como escrito com sucesso.
- **R3 — Consistência de metadados:** Os metadados gravados no índice (ex.: `chatId`, `timestamp`, `messageIds`, `turnSize`, `schemaVersion`) devem ser copiados do `chunk` sem alteração semântica.
- **R4 — Nenhum pós‑processamento de vetor:** O `vector` é gravado exatamente como recebido (sem normalização extra não documentada).
- **R5 — Idempotência:** Reexecutar `guardar` com a mesma lista de items deve deixar o índice no mesmo estado lógico (os mesmos registros, com os mesmos vetores e metadados).

---

##### Edge cases

| Caso                       | Entrada                           | Comportamento                                                       |
| -------------------------- | --------------------------------- | ------------------------------------------------------------------- |
| Array vazio                | `[]`                              | Nenhuma escrita; operação conclui em sucesso imediato.              |
| Duplicatas no mesmo batch  | dois items com o mesmo `chunk.id` | O último item do batch sobrescreve o anterior para esse `chunk.id`. |
| Erro de conexão com índice | qualquer                          | Falha explícita; cabe ao orquestrador re‑tentar ou abortar.         |

---

##### Critérios de aceitação

- Dado um array de `N` items válidos, após `guardar` o índice contém `N` registros acessíveis por `chunk.id`.
- Reexecutar `guardar` com o mesmo array não altera o conteúdo lógico dos registros (apenas sobrescreve com os mesmos valores).
- Em caso de erro de backend, nenhum sucesso é sinalizado silenciosamente; o erro é propagado.

---

### orquestrador_indexacao_rag

No pipeline de indexação, este programa recebe o gatilho externo e encadeia `fonte`, `agrupar_por_turno`, `embed_index` e `guardar`:

```
UI (ação de indexação)  →  orquestrador_indexacao_rag  →  fonte → agrupar_por_turno → embed_index → guardar
```

---

##### Entradas

| Nome        | Tipo     | Obrigatório | Descrição                                                                            |
| ----------- | -------- | ----------- | ------------------------------------------------------------------------------------ |
| chatId      | `string` | não         | Se informado, indexa apenas mensagens desse chat. Se omitido, indexa todos os chats. |
| maxMessages | `number` | não         | Limite máximo de mensagens a ler por chat; se omitido, usa o padrão de `fonte`.      |

**Pré-condição:** O backend `MessageDB` e o backend de índice vetorial (`VectorIndex`) estão disponíveis e configurados.

---

##### Saídas

Este programa não produz dados para o próximo estágio do pipe; seu objetivo é deixar o índice vetorial consistente ou falhar explicitamente.

---

##### Regras

- **R1 — Gatilho externo:** Cada chamada a `orquestrador_indexacao_rag` corresponde a um gatilho explícito (ex.: botão "Preparar histórico") **ou** à preparação de first-use quando o **`VectorIndex` persistente** estiver vazio antes da primeira consulta (**seja** manual **seja** automática — ver Opção B e spec de atendimento). **Não** corresponde a "primeira vez nesta sessão em memória" se o disco já tiver índice populado.  
- **R2 — Uso de `fonte`:** O orquestrador chama `fonte` com `(chatId?, maxMessages?)` para obter mensagens ordenadas; se `chatId` for omitido, a orquestração trata cada `chatId` distinto de forma independente.  
- **R3 — Um chat por chamada a `agrupar_por_turno`:** Para cada `chatId`, o orquestrador garante que `agrupar_por_turno` receba apenas mensagens desse chat, na ordem cronológica ascendente.  
- **R4 — Encadeamento por chat:** Para cada chat indexado, o orquestrador aplica `agrupar_por_turno` → `embed_index` → `guardar` preservando a ordem original dos chunks.  
- **R5 — Backend único de índice:** Todas as chamadas a `guardar` dentro de uma execução de `orquestrador_indexacao_rag` usam o mesmo backend `VectorIndex` configurado para o RAG.  
- **R6 — Idempotência lógica:** Reexecutar `orquestrador_indexacao_rag` com o mesmo conjunto de mensagens e mesma configuração deixa o índice em estado lógico equivalente (apenas sobrescritas com os mesmos vetores).  
- **R7 — Propagação de falhas:** Se qualquer etapa (`fonte`, `agrupar_por_turno`, `embed_index` ou `guardar`) falhar, o orquestrador falha explicitamente; não sinaliza sucesso parcial silencioso.  

---

##### Edge cases

| Caso                     | Entrada                             | Comportamento                                                |
| ------------------------ | ----------------------------------- | ------------------------------------------------------------ |
| MessageDB vazio          | qualquer                            | Não há chunks a indexar; execução conclui em sucesso.        |
| `chatId` inexistente     | chatId sem mensagens                | Nenhuma escrita no índice; execução conclui em sucesso.      |
| `chatId` omitido         | vários chats com mensagens          | Cada chat é indexado de forma independente, via mesmo índice |
| Erro em um dos programas | falha em `fonte`/`embed_index`/etc. | Execução falha; nenhuma etapa posterior é considerada feita. |

---

##### Critérios de aceitação

- Dado um chat com N mensagens válidas, após `orquestrador_indexacao_rag` o índice contém embeddings acessíveis para os chunks correspondentes àquelas mensagens.  
- Reexecutar `orquestrador_indexacao_rag` com as mesmas entradas não altera o resultado lógico do índice.  
- Se qualquer chamada a `fonte`, `agrupar_por_turno`, `embed_index` ou `guardar` falhar, a falha é propagada sem mascaramento.  

---

### embed_consulta

No fluxo de consulta, este programa fica entre a conversa atual e `buscar`:

```
conversa atual  →  embed_consulta  →  buscar
```

**Objetivo:** Converter uma representação textual da conversa atual em um vetor numérico (`queryVector`) compatível com os vetores gravados pelo `embed_index`.

---

##### Entradas

| Nome             | Tipo     | Obrigatório | Descrição                                                                                                     |
| ---------------- | -------- | ----------- | ------------------------------------------------------------------------------------------------------------- |
| conversationText | `string` | sim         | Texto que representa a situação atual no atendimento, montado pelo orquestrador a partir da conversa recente. |

**Formato de `conversationText`:**

- Último turno do cliente: concatenação das mensagens recentes com `isOutgoing === false` desde a última mensagem do atendente, considerando apenas mensagens de texto legível (mesmo critério de filtro de `agrupar_por_turno`).
- Turno anterior do atendente (se existir): concatenação das mensagens com `isOutgoing === true` imediatamente anteriores a esse turno do cliente, também apenas com texto legível.
- Texto final:

```
Cliente: <texto do último turno do cliente>
Atendente: <texto do último turno anterior do atendente, se existir>
```

**Pré-condição:** `conversationText` não é vazio após montagem; se não houver turno anterior do atendente, a linha `Atendente:` pode ser omitida. Se todas as mensagens recentes forem não legíveis (ex.: apenas mídia sem transcrição ou payload técnico), não é possível montar `conversationText`.

---

##### Saídas

| Nome        | Tipo       | Descrição                                                            |
| ----------- | ---------- | -------------------------------------------------------------------- |
| queryVector | `number[]` | Vetor de dimensão fixa `D = 1536`, compatível com vetores de índice. |

---

##### Regras

- **R1 — Mesmo modelo de indexação:** `embed_consulta` usa o mesmo modelo de embedding (`text-embedding-3-small`) e a mesma dimensão `D = 1536` utilizados por `embed_index`.
- **R2 — Texto imutável:** O texto enviado para o modelo de embedding é exatamente o `conversationText`, no formato descrito acima (no máximo `trim` global).
- **R3 — Dimensão fixa:** O `queryVector` retornado tem exatamente a mesma dimensão `D = 1536` dos vetores produzidos por `embed_index`. Qualquer outra dimensão é tratada como erro.
- **R4 — Idempotência lógica:** Dado o mesmo `conversationText` e a mesma configuração, duas chamadas seguidas produzem vetores compatíveis (diferenças só dentro do ruído numérico do provedor).
- **R5 — Erros de API:** Se a chamada ao serviço de embedding falhar (timeout, erro 5xx, etc.), o programa deve falhar explicitamente (reject/throw); não há valor default de `queryVector`.

---

##### Edge cases

| Caso                      | Entrada                             | Comportamento                                                                     |
| ------------------------- | ----------------------------------- | --------------------------------------------------------------------------------- |
| Texto vazio               | `conversationText === ""`           | Falha explícita (entrada inválida para `embed_consulta`).                         |
| Sem turno anterior        | sem mensagens recentes do atendente | `conversationText` contém apenas a linha `Cliente: ...`.                          |
| Só mensagens não legíveis | apenas mídia/payload técnico        | Falha explícita (não há texto legível suficiente para montar `conversationText`). |
| Erro na API de embedding  | qualquer                            | Falha explícita; cabe ao orquestrador decidir re‑tentar ou não.                   |
| Resposta sem embeddings   | API retorna `ok` mas `data` vazia   | Falha explícita (erro de `embed_consulta`; nenhum `queryVector` é retornado). \|  |

---

##### Critérios de aceitação

- Dado um `conversationText` válido, `embed_consulta` retorna sempre um único `queryVector` com dimensão `D = 1536`.
- Dado o mesmo `conversationText` e config em duas execuções, os vetores retornados são consistentes (não completamente diferentes a cada chamada).
- Em caso de erro da API de embedding, não é retornado nenhum `queryVector` silencioso; o erro é propagado.

---

### buscar

No fluxo de consulta, este programa fica entre `embed_consulta` (da conversa atual) e `prompt+GPT`:

```
conversa atual  →  embed_consulta  →  buscar  →  prompt+GPT
```

**Objetivo:** Consultar o índice vetorial usando o vetor da conversa atual e retornar os chunks mais similares por significado.

---

##### Entradas

| Nome        | Tipo       | Obrigatório | Descrição                                                     |
| ----------- | ---------- | ----------- | ------------------------------------------------------------- |
| queryVector | `number[]` | sim         | Vetor da conversa atual, gerado por `embed_consulta`.         |
| k           | `number`   | sim         | Quantidade máxima de resultados similares a retornar (top K). |

**Pré-condições:**

- O índice vetorial já contém registros gravados por `guardar`.

- `queryVector` tem a mesma dimensão `D` usada em `guardar`.

- `k` é um inteiro maior ou igual a 1.

- Usa o mesmo backend `VectorIndex` configurado em `guardar` (mesma fonte de dados / storage para vetores).

---

##### Saídas

| Nome    | Tipo                                            | Descrição                                                                 |
| ------- | ----------------------------------------------- | ------------------------------------------------------------------------- |
| results | `{ chunk: ConversationChunk; score: number }[]` | Lista ordenada dos chunks mais similares e sua pontuação de similaridade. |

---

##### Regras

- **R1 — Métrica de similaridade:** A similaridade entre `queryVector` e cada vetor do índice é calculada usando **similaridade de cosseno**.
- **R2 — Ordenação:** `results` é ordenado por `score` decrescente (mais similar primeiro).
- **R3 — Limite K:** O tamanho de `results` é no máximo `k`, ou menor se o índice tiver menos que `k` registros.
- **R4 — Recuperação de chunks:** Para cada resultado, o `chunk` retornado deve ser o mesmo `ConversationChunk` usado em `guardar` (mesmos campos e valores).
- **R5 — Sem filtro implícito:** `buscar` não aplica filtros de negócio adicionais além da similaridade (ex.: período, chatId), a menos que esses filtros sejam especificados em config explícita desta spec.

---

##### Edge cases

| Caso                        | Entrada                    | Comportamento                                   |
| --------------------------- | -------------------------- | ----------------------------------------------- |
| Índice vazio                | nenhum registro no índice  | `results` é `[]`.                               |
| `k` maior que total de docs | `k > total de registros`   | `results.length` é igual ao total de registros. |
| `k` inválido (≤ 0)          | `k <= 0`                   | Falha explícita (entrada inválida).             |
| Dimensão incorreta          | `queryVector.length !== D` | Falha explícita (entrada inválida).             |

---

##### Critérios de aceitação

- Dado um índice com `N` registros e `k <= N` → `results.length` é no máximo `k`, ordenado por similaridade decrescente.
- Dado o mesmo `queryVector`, índice e configuração, duas chamadas seguidas de `buscar` produzem a mesma ordenação e `score` dentro de tolerância numérica.
- Com índice vazio, a saída é sempre `[]`, sem erro.

---

### orquestrador_consulta_rag

No fluxo de consulta, este programa recebe a conversa atual, compõe o texto de consulta, chama `embed_consulta`, `buscar` e `prompt+GPT`, e devolve uma única sugestão para a UI:

```
UI (ação rag:generate)
     ╲
      ╲──►  orquestrador_consulta_rag  →  embed_consulta  →  buscar  →  prompt+GPT  →  UI
     ╱
Mettri ativo + gatilho automático (nova mensagem do cliente, chat ativo WhatsApp, toggle ligado — spec de atendimento)
```

---

##### Entradas

| Nome     | Tipo                | Obrigatório | Descrição                                                                |
| -------- | ------------------- | ----------- | ------------------------------------------------------------------------ |
| messages | `CapturedMessage[]` | sim         | Mensagens recentes de um chat, ordenadas por `timestamp` ascendente.     |
| k        | `number`            | sim         | Quantidade máxima de resultados similares a pedir para `buscar` (top K). |

**Pré-condição:** As mensagens referem-se a um único chat; o índice vetorial persistente já contém dados **ou** foi executada indexação quando o armazenamento estava vazio (quem orquestra a consulta garante Opção B apenas se o `VectorIndex` persistente estiver vazio — ver reinício de sessão na seção de indexação).

---

##### Saídas

| Nome       | Tipo                   | Descrição                                                                                          |
| ---------- | ---------------------- | -------------------------------------------------------------------------------------------------- |
| suggestion | `string`               | Texto da resposta sugerida a ser exibida na interface.                                             |
| chunks     | `ConversationChunk[]`  | Chunks retornados por `buscar`, em ordem de relevância, usados na geração da sugestão.             |
| debugInfo  | `RagConsultaDebugInfo` | Pacote de informações auxiliares para debug e UI (consulta, similares, prompt, tempos, avaliação). |

---

##### Estrutura `RagConsultaDebugInfo`

Representa os dados de apoio que a UI pode exibir no modo desenvolvedor, sem alterar o comportamento da sugestão.

| Campo               | Tipo                                                                                                     | Descrição                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| conversationText    | `string`                                                                                                 | Texto usado como entrada em `embed_consulta` (ex.: "Cliente: …\nAtendente: …").                   |
| currentConversation | `string`                                                                                                 | Representação textual completa da conversa atual enviada a `prompt+GPT`.                          |
| similarResults      | `{ chunk: ConversationChunk; score: number }[]`                                                          | Lista de resultados retornados por `buscar`, com score de similaridade (cosseno).                 |
| promptSystem        | `string`                                                                                                 | Texto do prompt de sistema enviado ao modelo.                                                     |
| promptUser          | `string`                                                                                                 | Texto do prompt de usuário enviado ao modelo (conversa + chunks + instrução final).               |
| timingsMs           | `{ embed: number; search: number; prompt: number }`                                                      | Tempos medidos em milissegundos para embedding, busca e chamada de modelo.                        |
| suggestionOriginal  | `string`                                                                                                 | Texto original retornado pelo modelo antes de qualquer edição feita pelo atendente na UI.         |
| evaluation          | `{ scoreRelevance: number; scoreFaithfulness: number; scoreStyle: number; mode: 'llm'; notes?: string }` | Avaliação automática da sugestão pelo LLM-as-judge (relevância, fidelidade ao contexto e estilo). |

---

##### Regras

- **R1 — Construção de `conversationText`:** O orquestrador monta `conversationText` a partir de `messages` seguindo o formato definido em `embed_consulta` (último turno do cliente e turno anterior do atendente).  
- **R2 — Uso de `embed_consulta`:** O orquestrador chama `embed_consulta(conversationText, bridge)` para obter `queryVector` com dimensão `D`.  
- **R3 — Uso de `buscar`:** O orquestrador chama `buscar(queryVector, k, index)` usando o mesmo backend `VectorIndex` configurado na indexação, obtendo uma lista de resultados `{ chunk, score }` ordenada por relevância (score de similaridade de cosseno, decrescente).  
- **R4 — Remoção de resultados da conversa atual:** Após receber os resultados de `buscar`, o orquestrador descarta quaisquer itens cujo `chunk.messageIds` contenha mensagens presentes em `messages` (a conversa atual); esses chunks não são usados nem em `chunks` nem em `debugInfo.similarResults`.  
- **R5 — Uso de `prompt+GPT`:** O orquestrador chama `prompt+GPT(currentConversation, chunks)` passando uma representação textual da conversa atual (`currentConversation`, alinhada com `conversationText`) e apenas os `chunks` restantes após o filtro de R4.  
- **R6 — Sugestão e dados auxiliares:** O orquestrador retorna exatamente uma `suggestion` produzida por `prompt+GPT`, juntamente com `chunks` (na mesma ordem de relevância dos resultados de `buscar` após o filtro de R4) e `debugInfo` preenchido para permitir à UI exibir detalhes técnicos da consulta RAG.  
- **R7 — Índice vazio ou sem resultados:** Se `buscar` retornar `[]` (ou se todos os resultados forem descartados por R4), o orquestrador ainda chama `prompt+GPT` com `chunks` vazio, confiando apenas em `currentConversation`, respeitando a regra de edge case de `prompt+GPT`.  
- **R8 — Propagação de falhas:** Falhas em `embed_consulta`, `buscar` ou `prompt+GPT` são propagadas explicitamente; o orquestrador não gera sugestões artificiais em caso de erro.  
  - **R9 — Conteúdo de `debugInfo.similarResults`:** `debugInfo.similarResults` contém, no máximo, `k` itens retornados por `buscar` após o filtro de R4 (tipicamente os 5 mais relevantes para a UI), preservando a ordenação por `score` decrescente e o valor numérico exato do score de similaridade.  
  - **R10 — Conteúdo de `debugInfo.timingsMs`:** `debugInfo.timingsMs.embed`, `search` e `prompt` representam tempos não negativos em milissegundos de cada etapa; se alguma etapa não for concluída por erro, o orquestrador falha (R8) e não retorna `debugInfo` parcial.  
  - **R11 — Imutabilidade de `suggestionOriginal`:** `debugInfo.suggestionOriginal` é sempre igual ao texto retornado por `prompt+GPT` na chamada corrente; alterações posteriores feitas pelo atendente na UI não mudam esse campo.  
  - **R12 — Uso de `avaliar_sugestao_rag`:** Após obter `suggestion` de `prompt+GPT`, o orquestrador chama `avaliar_sugestao_rag(currentConversation, chunks, suggestion)` e preenche `debugInfo.evaluation` com o resultado.  
  - **R13 — Falha na avaliação:** Se `avaliar_sugestao_rag` falhar, o orquestrador propaga o erro; não retorna `debugInfo` com campo `evaluation` parcialmente preenchido nem inventa scores.

---

##### Edge cases

| Caso                          | Entrada                     | Comportamento                                                                       |
| ----------------------------- | --------------------------- | ----------------------------------------------------------------------------------- |
| Nenhuma mensagem recente      | `messages` vazio            | Não é possível montar `conversationText`; o orquestrador falha explicitamente.      |
| Apenas mensagens do atendente | todas `isOutgoing === true` | Não há último turno de cliente; o orquestrador falha ou não chama `embed_consulta`. |
| Índice vazio                  | `buscar` retorna `[]`       | `prompt+GPT` é chamado apenas com a conversa atual; ainda há `suggestion`.          |

---

##### Critérios de aceitação

- Dada uma conversa recente válida e um índice previamente populado, `orquestrador_consulta_rag` retorna sempre uma `suggestion` não vazia em caso de sucesso das APIs externas.  
- Com índice vazio, mas conversa válida, ainda é gerada uma sugestão baseada apenas na conversa atual.  
- Em caso de erro em `embed_consulta` ou `prompt+GPT`, o erro é propagado sem mascaramento, permitindo tratamento explícito na UI.  

---

### prompt+GPT

No fluxo de consulta, este programa fica entre `buscar` e a UI:

```
buscar  →  prompt+GPT  →  UI (sugestão)
```

**Objetivo:** Combinar a conversa atual com os chunks recuperados e chamar o modelo de linguagem para gerar uma sugestão de resposta.

---

##### Entradas

| Nome                | Tipo                  | Obrigatório | Descrição                                               |
| ------------------- | --------------------- | ----------- | ------------------------------------------------------- |
| currentConversation | `string`              | sim         | Representação textual da conversa atual no atendimento. |
| chunks              | `ConversationChunk[]` | sim         | Chunks retornados por `buscar`, em ordem de relevância. |

**Pré-condições:**

- O modelo de linguagem (ex.: API GPT) está acessível e configurado.
- O texto de `currentConversation` já está na língua e formato esperados pela UI.

---

##### Saídas

| Nome       | Tipo     | Descrição                                              |
| ---------- | -------- | ------------------------------------------------------ |
| suggestion | `string` | Texto da resposta sugerida a ser exibida na interface. |

---

##### Regras

- **R1 — Uso dos chunks:** O prompt enviado ao modelo deve incluir, de forma estruturada, o conteúdo de `currentConversation` e dos `chunks`, preservando sua ordem de relevância.
- **R2 — Resposta focada:** `suggestion` deve responder à `currentConversation`, usando os `chunks` apenas como contexto, sem copiar trechos irrelevantes.
- **R3 — Resultado único:** Cada chamada de `prompt+GPT` retorna exatamente uma `suggestion` principal (sem lista de alternativas).
- **R4 — Sem efeitos colaterais:** `prompt+GPT` não envia mensagens para o WhatsApp nem altera estado; apenas devolve texto para a UI decidir o que fazer.
- **R5 — Erros de modelo:** Em caso de erro da API do modelo (timeout, 4xx, 5xx), o programa deve falhar explicitamente; cabe ao orquestrador decidir fallback (ex.: mensagem de erro na UI).

---

##### Edge cases

| Caso                   | Entrada                                          | Comportamento                                                                                              |
| ---------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Nenhum chunk relevante | `chunks` vazio                                   | Prompt construído apenas com `currentConversation`; ainda assim há tentativa de gerar `suggestion`.        |
| Conversa muito longa   | `currentConversation` maior que limite do modelo | Orquestrador deve aplicar truncamento/resumo antes de chamar `prompt+GPT` (fora do escopo deste programa). |
| Texto vazio            | `currentConversation === ""` e `chunks` vazio    | Comportamento definido pelo orquestrador (chamar ou não `prompt+GPT`).                                     |

---

##### Critérios de aceitação

- Dada uma `currentConversation` válida e uma lista de `chunks`, o programa sempre retorna uma `suggestion` não vazia em caso de sucesso da API de modelo.
- Com `chunks` vazio e conversa válida, ainda é gerada uma sugestão baseada apenas na conversa atual.
- Em caso de erro da API do modelo, o erro é propagado sem mascaramento, permitindo tratamento explícito na camada de orquestração.

---

### avaliar_sugestao_rag

No fluxo de consulta, este programa fica entre `prompt+GPT` e a devolução da resposta para a UI:

```
buscar  →  prompt+GPT  →  avaliar_sugestao_rag  →  UI (sugestão + debug)
```

**Objetivo:** Receber a conversa atual, os chunks usados e a sugestão gerada pelo modelo e produzir uma avaliação automática (LLM-as-judge) de relevância, fidelidade ao contexto e aderência ao estilo.

---

##### Entrada

| Nome                | Tipo                  | Obrigatório | Descrição                                                                               |
| ------------------- | --------------------- | ----------- | --------------------------------------------------------------------------------------- |
| currentConversation | `string`              | sim         | Representação textual da conversa atual no atendimento, igual à usada em `prompt+GPT`.  |
| chunks              | `ConversationChunk[]` | sim         | Chunks retornados por `buscar` e passados para `prompt+GPT`, em ordem de relevância.    |
| suggestion          | `string`              | sim         | Texto da resposta sugerida retornada por `prompt+GPT` (antes de qualquer edição na UI). |

**Pré-condição:** `suggestion` não é vazia após `trim`; `currentConversation` e `chunks` correspondem aos usados na chamada a `prompt+GPT`.

---

##### Saídas

| Nome       | Tipo                                                                                                     | Descrição                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| evaluation | `{ scoreRelevance: number; scoreFaithfulness: number; scoreStyle: number; mode: 'llm'; notes?: string }` | Avaliação automática da sugestão: relevância, fidelidade ao contexto e estilo, mais metadados. |

Todos os scores são números normalizados no intervalo `[0, 1]`, onde valores mais altos indicam melhor avaliação.

---

##### Regras

- **R1 — Modelo julgador:** `avaliar_sugestao_rag` usa um modelo de linguagem (LLM-as-judge) dedicado à avaliação; não reutiliza a resposta de `prompt+GPT` para gerar scores.  
- **R2 — Escala de scores:** `scoreRelevance`, `scoreFaithfulness` e `scoreStyle` são sempre números entre `0` e `1`, inclusive.  
- **R3 — Relevância:** `scoreRelevance` mede o quanto `suggestion` responde diretamente à intenção do cliente em `currentConversation`, sem fugir do assunto principal.  
- **R4 — Fidelidade ao contexto:** `scoreFaithfulness` mede o quanto as afirmações de `suggestion` são suportadas por `currentConversation` e pelos `chunks`, penalizando informações inventadas (alucinações).  
- **R5 — Estilo:** `scoreStyle` mede o quanto `suggestion` segue as regras de escrita definidas em `specs/estilo.md` (tamanho, tom, expressões proibidas), usando no mínimo um resumo dessas regras no prompt do juiz.  
- **R6 — Modo:** O campo `mode` é sempre o literal `'llm'` nesta implementação; valores diferentes indicariam outro tipo de avaliador (fora do escopo atual).  
- **R7 — Notas opcionais:** O campo `notes`, quando presente, contém um texto curto explicando os principais motivos da avaliação, em linguagem legível para humanos.  
- **R8 — Nenhum efeito colateral:** `avaliar_sugestao_rag` não altera `suggestion`, `chunks` nem qualquer estado externo; apenas devolve `evaluation`.  
- **R9 — Erros de modelo:** Se a chamada ao modelo de avaliação falhar (timeout, erro 4xx/5xx, resposta vazia ou malformada), o programa falha explicitamente; não retorna scores default.

---

##### Edge cases

| Caso                     | Entrada                                 | Comportamento                                                   |
| ------------------------ | --------------------------------------- | --------------------------------------------------------------- |
| Sugestão vazia           | `suggestion.trim() === ""`              | Falha explícita (entrada inválida para avaliação).              |
| Sem chunks relevantes    | `chunks` vazio, conversa válida         | Avalia com base apenas em `currentConversation` e `suggestion`. |
| Conversa muito longa     | `currentConversation` ultrapassa limite | Orquestrador deve truncar antes; fora do escopo deste programa. |
| Erro na API de avaliação | qualquer erro do LLM julgador           | Falha explícita; nenhum `evaluation` parcial é retornado.       |

---

##### Critérios de aceitação

- Dada uma `suggestion` não vazia, `currentConversation` e `chunks` consistentes com a chamada de `prompt+GPT`, `avaliar_sugestao_rag` retorna `evaluation` com três scores no intervalo `[0, 1]` e `mode = 'llm'`.  
- Em caso de erro do modelo avaliador, o erro é propagado sem mascaramento, permitindo tratamento explícito pela camada de orquestração.  
- O preenchimento de `debugInfo.evaluation` em `orquestrador_consulta_rag` reflete exatamente os valores retornados por `avaliar_sugestao_rag`.
