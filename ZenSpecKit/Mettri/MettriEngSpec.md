# Mettri Eng Spec

Arquitetura clara, sem ambiguidade. Eng Spec diz **a estrutura**; ZenSpec diz **o comportamento**; código diz **como**.  
Este documento segue o template de `ZenEngSpec.md` e é derivado de `MettriConceptSpec`, `project_concept.md` e `project_context.md`.

---

## 1. Intenção

> Esta arquitetura existe para que **negócios locais que vendem pelo WhatsApp** consigam **usar o Mettri como uma extensão estável, modular e evolutiva do WhatsApp Web** sem precisar de **infraestrutura complexa própria, múltiplos sistemas separados ou reescrever o produto a cada mudança do WhatsApp**.

---

## 2. Glossário

| Termo                      | Definição                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `Extensão`                 | Pacote instalável no navegador que adiciona a terceira coluna do Mettri ao WhatsApp Web.     |
| `Domínio`                  | Área de negócio isolada (ex.: `atendimento`, `clientes`, `marketing`, `infraestrutura`).     |
| `Módulo`                   | Unidade de código carregada pelo plugin-system, ligada a um domínio (ex.: `rag`, `retomar`). |
| `Plugin System`            | Mecanismo que descobre, registra e carrega módulos de forma desacoplada e opcional.          |
| `Seletores`                | Estratégias para encontrar elementos do WhatsApp Web no DOM, com cadeia de fallbacks.        |
| `Config remota`            | Documento hospedado fora da extensão que define seletores, flags e regras atualizáveis.      |
| `MessageDB`                | Banco local (IndexedDB) responsável por persistir mensagens e histórico.                     |
| `WA-Sync`                  | Padrão interno de exportação/integração do histórico com sistemas externos.                  |
| `RAG`                      | Recuperação Aumentada por Geração, usada para sugerir respostas e consultas inteligentes.    |
| `Human-in-the-loop`        | Modelo em que a IA só sugere; o humano decide e executa.                                     |
| `Core Domain`              | Domínio central do produto (ex.: `atendimento`, `clientes`).                                 |
| `Supporting Domain`        | Domínio que apoia o core (ex.: `produtos`, `vitrine`, `entrega`, `financeiro`).              |
| `Critical Platform Domain` | Domínio de plataforma sem o qual o produto não funciona (ex.: `infraestrutura`, `suporte`).  |
| `Lifecycle`                | Pontos de entrada que definem início, atualização e fim da extensão no navegador.            |
| `Event Emitter interno`    | Mecanismo de eventos dentro da extensão (não exposto ao usuário final).                      |

---

## 3. Componentes

Para cada componente: nome em `código`, metáfora em **negrito**, resumo e contrato.

### 3.1 Plataforma e Infraestrutura

- `selectorManager` — **detetive**  
  Garante que elementos do WhatsApp sejam encontrados via múltiplos seletores e fallbacks.  
  `Entrada: { target: 'chatList' | 'message' | 'input' | ... }. Saída: HTMLElement | null.`

- `configUpdater` — **central de ordens**  
  Busca e aplica `config remota` (seletores, flags, textos) com fallback local.  
  `Entrada: void. Saída: Promise<ConfigSnapshot>.`

- `messageCapturer` — **gravador de chamadas**  
  Intercepta mensagens (webpack + DOM) e gera eventos de mensagem normalizada.  
  `Entrada: eventos internos do WhatsApp / DOM. Saída: eventos `onMessageCaptured(message)`.`

- `messageDB` — **arquivo morto**  
  Persiste mensagens, conversas e metadados em IndexedDB com política "nunca apaga".  
  `Entrada: MessageRecord. Saída: Promise<void | QueryResult>.`

- `pluginRegistry` — **síndico do prédio**  
  Descobre, registra e disponibiliza módulos de domínio para o shell da UI.  
  `Entrada: manifests de módulos. Saída: lista de módulos carregáveis.`

- `panelShell` — **prédio colado**  
  Terceira coluna fixa que abriga os painéis de domínio (`atendimento`, `clientes`, `marketing`, `rag`).  
  `Entrada: estado global + módulos registrados. Saída: árvore de UI renderizada.`

### 3.2 Domínio: Atendimento

- `atendimentoPanel` — **central de chamadas**  
  Mostra conversas em tempo real e permite responder manualmente ou com sugestão.  
  `Entrada: ConversationState, sugestões opcionais. Saída: ações de envio de mensagem / atualização de estado.`

- `conversationOrchestrator` — **maestro**  
  Coordena status da conversa (`active`, `waiting`, `closed`) e ligação com clientes e pedidos.  
  `Entrada: eventos de mensagem + ações do usuário. Saída: novo estado de `Conversation`.`

### 3.3 Domínio: Clientes

- `clientDirectoryPanel` — **agenda inteligente**  
  Lista clientes com filtros, histórico e métricas.  
  `Entrada: filtros + dados de `Client`. Saída: seleção de cliente e ações de navegação.`

- `clientDB` — **fichário**  
  Mantém cadastro, preferências e métricas agregadas por cliente.  
  `Entrada: ClientRecord. Saída: Promise<void | ClientQuery>.`

### 3.4 Domínio: Marketing / Enviar / Retomar

- `reactivationEngine` — **radar de sumidos**  
  Identifica clientes inativos e gera campanhas de retomada.  
  `Entrada: histórico + regras de inatividade. Saída: listas de clientes-alvo.`

- `aiSuggestionEngine` — **copywriter**  
  Usa histórico + persona + contexto para sugerir mensagens de reativação.  
  `Entrada: cliente + contexto + objetivo. Saída: sugestão de mensagem.`

### 3.5 Domínio: RAG

- `ragOrquestradorIndexacao` — **bibliotecário** (orquestrador)  
  Indexa documentos e mensagens relevantes em um índice vetorial local.  
  `Entrada: documentos / mensagens normalizadas. Saída: índices atualizados.`

- `ragOrquestradorConsulta` — **pesquisador** (orquestrador)  
  Recebe pergunta, faz busca semântica, monta contexto e chama o modelo de linguagem.  
  `Entrada: query + parâmetros de busca. Saída: resposta com trechos de suporte.`

### 3.6 Suporte e Governança

- `strategyMonitor` — **vigia**  
  Monitora saúde de seletores, capturas e módulos, gerando alertas.  
  `Entrada: métricas internas. Saída: eventos de alerta / logs.`

- `engineeringContractChecker` — **auditor**  
  Garante que regras de engenharia (`ENGINEERING_CONTRACT.md`) sejam seguidas em builds e testes.  
  `Entrada: código / resultados de CI. Saída: falhas explícitas ou aprovação.`

Idempotência (pontos de entrada públicos principais):

- `configUpdater.refresh()` → duas chamadas seguidas produzem o mesmo `ConfigSnapshot` final; efeitos duplicados são ignorados.  
- `ragOrquestradorIndexacao.index(doc)` → indexar o mesmo doc duas vezes atualiza o registro, sem duplicar vetores.  
- `ragOrquestradorConsulta.query(q)` → duas chamadas com os mesmos parâmetros geram consultas independentes, sem alterar estado global.  
- `reactivationEngine.run()` → rodar duas vezes no mesmo intervalo não cria campanhas duplicadas; reuso de marcações de envio.

---

## 4. Fluxo

### 4.1 Fluxo principal de atendimento

```text
WhatsApp Web → `messageCapturer` → `messageDB` → `conversationOrchestrator` → `atendimentoPanel` → usuário responde → `messageSender` → WhatsApp Web
```

| Componente                 | Recebe                                | Faz                                          | Manda para                 |
| -------------------------- | ------------------------------------- | -------------------------------------------- | -------------------------- |
| `messageCapturer`          | Eventos de mensagem do WhatsApp / DOM | Normaliza mensagem em formato interno        | `messageDB`                |
| `messageDB`                | Mensagem normalizada                  | Persiste e indexa por conversa/cliente       | `conversationOrchestrator` |
| `conversationOrchestrator` | Mensagens + ações do usuário          | Atualiza estado da conversa e status         | `atendimentoPanel`         |
| `atendimentoPanel`         | Estado de conversa + sugestões        | Exibe UI e captura ação do atendente         | `messageSender`            |
| `messageSender`            | Comando de envio + conteúdo           | Envia mensagem via APIs internas do WhatsApp | WhatsApp Web               |

### 4.2 Fluxo de reativação (marketing / retomar)

```text
`messageDB` → `reactivationEngine` → listas de inativos → `aiSuggestionEngine` → `marketingPanel` → atendente aprova → `messageSender`
```

| Componente           | Recebe                        | Faz                                           | Manda para           |
| -------------------- | ----------------------------- | --------------------------------------------- | -------------------- |
| `reactivationEngine` | Histórico consolidado         | Calcula inativos por regra de dias/frequência | `aiSuggestionEngine` |
| `aiSuggestionEngine` | Cliente + contexto + objetivo | Gera mensagem sugerida                        | `marketingPanel`     |
| `marketingPanel`     | Sugestões + listas            | Mostra, permite editar/aprovar                | `messageSender`      |

### 4.3 Fluxo RAG (consulta)

```text
`messageDB` → `ragOrquestradorIndexacao` → índice vetorial → `ragOrquestradorConsulta` → `atendimentoPanel`
```

| Componente                 | Recebe               | Faz                                     | Manda para                |
| -------------------------- | -------------------- | --------------------------------------- | ------------------------- |
| `ragOrquestradorIndexacao` | Mensagens/documentos | Gera embeddings e atualiza índice       | índice vetorial           |
| Índice vetorial            | Vetores + metadados  | Permite busca aproximada                | `ragOrquestradorConsulta` |
| `ragOrquestradorConsulta`  | Query + parâmetros   | Busca contexto, monta prompt, chama LLM | `atendimentoPanel`        |

Regra: toda seta no diagrama aparece nas tabelas acima, sem atalhos.

---

## 5. Ciclo de vida

### 5.1 Diagrama de estados da extensão

```text
[não carregado] → [inicializando] → [operando] → [degradado] → [recuperando] → [operando]
                                      ↓
                                  [desativado]
```

### 5.2 Tabela de fases

| Estado          | O que acontece                                                                 | Se falhar                                                  |
| --------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `não carregado` | Extensão ainda não foi inicializada.                                           | Não se aplica.                                             |
| `inicializando` | Carrega config local, busca config remota, inicializa seletores e bancos.      | Vai para `degradado` com log de erro e fallback local.     |
| `operando`      | Todos módulos críticos ativos, seletores válidos, capturas estáveis.           | Se seletores quebram, vai para `degradado`.                |
| `degradado`     | Parte da funcionalidade indisponível (ex.: captura parcial, seletor quebrado). | Ativa mecanismos de auto-mapeamento e correção de seletor. |
| `recuperando`   | Auto-mapeamento e atualização de config remota em andamento.                   | Se não recuperar, permanece em `degradado` e notifica.     |
| `desativado`    | Extensão desabilitada pelo usuário ou por incompatibilidade crítica.           | Exibe aviso mínimo, não tenta operar.                      |

Regra: o gatilho de transição para `degradado` é sempre falha de seletor/captura monitorada; o gatilho para `recuperando` é início de rotina de auto-mapeamento ou atualização de config.

---

## 6. API pública

Pontos de contato com o "mundo exterior" (outras partes do código/app que tratamos como clientes desta arquitetura).

- `pluginRegistry.registerModule(manifest)`  
  
  - O que faz: registra um novo módulo de domínio na plataforma.  
  - Grupo: Nuclear.  
  - Idempotência: registrar duas vezes o mesmo `id` mantém a última definição, sem duplicar módulos.

- `configUpdater.refresh()`  
  
  - O que faz: busca e aplica config remota.  
  - Grupo: Lifecycle.  
  - Idempotência: chamadas repetidas com a mesma versão de config não alteram estado.

- `reactivationEngine.run()`  
  
  - O que faz: recalcula listas de clientes inativos.  
  - Grupo: Opcional.  
  - Idempotência: duas execuções consecutivas no mesmo período produzem o mesmo conjunto de listas.

- `ragOrquestradorIndexacao.index(payload)`  
  
  - O que faz: indexa documentos/mensagens em índice vetorial.  
  - Grupo: Nuclear (para RAG).  
  - Idempotência: reindexar o mesmo `id` substitui o registro, sem duplicar.

- `ragOrquestradorConsulta.query(query, options)`  
  
  - O que faz: executa consulta RAG e retorna resposta com contexto.  
  - Grupo: Opcional.  
  - Idempotência: múltiplas chamadas não alteram estado persistente; apenas geram novas respostas.

EventEmitter interno (exemplo):

- `onMessageCaptured(message)`  
  - Assinatura: `subscribe(handler: (message: MessageRecord) => void): UnsubscribeFn`.  
  - Payload: mensagem normalizada com metadados mínimos (id, cliente, timestamp, direção).

---

## 7. Modelo de erros

| Situação                                        | Comportamento                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Falha ao buscar config remota                   | Usa config local, marca estado `degradado`, registra log para futura investigação.          |
| Seletor DOM inválido                            | Ativa fallback da cadeia de seletores; se todos falham, aciona auto-mapeamento.             |
| IndexedDB indisponível                          | Desabilita features que dependem de histórico, exibe aviso e evita operações parciais.      |
| Falha ao indexar documento em RAG               | Marca item como não indexado, registra erro e segue com demais itens.                       |
| Timeout em consulta RAG                         | Retorna erro controlado para a UI e não exibe resposta parcial de IA.                       |
| Falha em sugestão de IA (API externa)           | Volta para modo manual, exibe mensagem amigável e loga contexto mínimo.                     |
| Erro em módulo de plugin (ex.: módulo quebrado) | Isola falha ao módulo, desativa apenas o módulo afetado e mantém shell/infra funcionando.   |
| Versão incompatível de WhatsApp Web detectada   | Marca estado `degradado`, tenta recuperação via nova config; se não conseguir, limita a UI. |

Regra: toda situação de erro acima é rastreável a um componente (`selectorManager`, `configUpdater`, `messageDB`, `ragOrquestrador*`, módulos de plugin) ou a um estado do ciclo de vida (`degradado`).

---

## 8. Decisões e alternativas descartadas

> **Decisão:** Usar IndexedDB local como base principal de histórico.  
> **Alternativa descartada:** Armazenar histórico apenas em backend próprio.  
> **Motivo:** Simplificar onboarding e garantir que o dado existe mesmo sem backend configurado.

> **Decisão:** Focar em interceptação webpack + DOM, com sistema robusto de seletores.  
> **Alternativa descartada:** Depender exclusivamente de APIs documentadas ou de scraping simples.  
> **Motivo:** Garantir robustez diante de mudanças frequentes do WhatsApp Web.

> **Decisão:** Adotar plugin-system por domínios (`atendimento`, `clientes`, `marketing`, `rag`).  
> **Alternativa descartada:** Monólito único com feature flags internas.  
> **Motivo:** Permitir evolução independente de domínios e facilitação de testes/modularização.

> **Decisão:** IA apenas assistiva (human‑in‑the‑loop).  
> **Alternativa descartada:** Bots autônomos com envio automático em massa.  
> **Motivo:** Alinhar com proposta de valor de vendas responsáveis e evitar bloqueios/banimentos.

---

## 9. Distribuição e uso

- **Formato de entrega:** extensão de navegador (Chrome/Chromium), empacotada a partir de build TypeScript para bundle JavaScript consumido pelo navegador.  
- **Jornada mínima do usuário:** instalar extensão → abrir WhatsApp Web → ver terceira coluna do Mettri → começar a usar atendimento/retomar sem configurar servidor próprio.  
- **Pré-requisitos de ambiente:** navegador compatível com extensões; acesso ao WhatsApp Web; suporte a IndexedDB; acesso HTTP(s) opcional a endpoint de config remota e serviços de IA.

---

## 10. Escopo fora

Este documento **não cobre**:

- Implementação detalhada de cada módulo (fica para as ZenSpecs específicas por domínio e componentes).  
- Definições de produto/negócio de preço, planos e contratos comerciais.  
- Estratégias de backend completas para monetização, licenciamento e antifraude (apenas interface conceitual).  
- Detalhes campo a campo de schemas de dados (tratados nas specs de domínio e tipos de código).
