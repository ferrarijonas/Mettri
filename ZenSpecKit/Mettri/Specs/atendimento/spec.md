# Painel atendimento

---

# Sugestão com histórico (RAG)

## Conceito

Uma mensagem pronta que vem de um sistema RAG, baseada no último turno de conversas. Pipeline RAG completo (consulta, juiz, experimento, JSONL): [Specs/rag/spec.md](../rag/spec.md).

## Interface

Container dedicado à sugestão de resposta gerada com base no histórico (RAG). Objetivo: exibir uma mensagem pronta para o atendente usar e enviar no WhatsApp, com opção de visualizar detalhes técnicos da sugestão.

### Container principal

- Bloco com título "Resposta sugerida".
- À direita do título: ícone de seta (expandir/colapsar) e, opcionalmente, botão de informação no mesmo padrão do painel (tamanho/estilo dos botões de ação secundários, com `title`/tooltip "Usa conversas passadas como base").
- Conteúdo visível quando expandido.

### Conteúdo (modo padrão)

- **Controle "Gerar sugestão automático":** toggle ou checkbox com rótulo curto e tooltip que deixe claro que, **com o Mettri aberto** (interface principal carregada — não é necessário estar com o **módulo/painel de Atendimento** visível), mensagens novas do cliente podem disparar o mesmo fluxo RAG que o botão. Estados **ligado** e **desligado** devem ser claramente visíveis. Comportamento esperado: pode persistir a preferência entre sessões via chave lógica no storage (determinístico: **Se** o usuário fechar o app **então** ao reabrir o estado do toggle reflete o valor persistido, quando a implementação oferecer persistência).
  - **Implementação atual (emitir evento):** o barramento emite `message:new` quando uma mensagem é capturada **e** a área lateral do Mettri está **visível** (`isVisible` no shell); com a lateral recolhida, o modo automático **não** recebe o evento, ainda que a extensão esteja carregada. **Melhoria futura (opcional):** emitir a captura independentemente da visibilidade da lateral e tratar custo/listeners por módulo (ex. Histórico).
- **Área de texto:** exibe a sugestão gerada pelo RAG, `<textarea>`
- **Estado vazio (antes de gerar):** placeholder que indique gerar por botão ou automático (ex.: "Use 'Gerar sugestão' ou ligue o modo automático para usar conversas passadas como base.") ou similar.
- **Estado carregando:** spinner ou skeleton no lugar do texto; botão "Gerar sugestão" desativado (vale para disparo manual **ou** automático enquanto `orquestrador_consulta_rag` estiver em curso).
- **Estado com sugestão:** texto preenchido; botão "Usar na conversa") habilitado.

### Ações

- **"Gerar sugestão"** (ou "Gerar resposta"): dispara manualmente o fluxo RAG (conversa atual → embedding → busca no banco vetorial → prompt → modelo → avaliação/juiz e logging do experimento conforme spec RAG). Preenche a área de texto com o resultado.
- **"Enviar para WhatsApp"**:
  - Só fica habilitado quando houver texto de sugestão carregado (estado com sugestão).
  - Usa sempre o **chat atual do painel Atendimento** como destino de envio.
  - Em caso de erro de envio, mantém o texto intacto no `<textarea>` e exibe mensagem amigável pedindo para verificar se a conversa está aberta e tentar novamente.
  - Em caso de sucesso, opcionalmente exibe um toast/alert simples de confirmação (ex.: "Mensagem enviada no WhatsApp.") sem limpar o texto sugerido.

### Estados visuais

- Container colapsado: só título e seta; sem área de texto nem botões.
- Container expandido sem sugestão: área de texto vazia/placeholder + botão "Gerar sugestão" ativo.
- Container expandido carregando: área em loading, "Gerar sugestão" desativado.
- Container expandido com sugestão: texto preenchido, "Gerar sugestão" e "Enviar" ativos (ou só "Enviar" se não quiser regerar).

### Hierarquia

- Título da seção em evidência.
- Abaixo: área de texto (sugestão).
- Abaixo: linha de botões (Gerar sugestão | Enviar para WhatsApp).
- Linha "Baseado em N conversas similares" logo abaixo da área de texto, exibida sempre que houver sugestão gerada; `N` é igual à quantidade de conversas similares retornadas pelo módulo RAG.

### Detalhes técnicos do RAG (modo desenvolvedor)

Esta sub-seção visual existe para que quem estiver analisando o comportamento do RAG consiga inspecionar o contexto usado na geração (consulta, conversas similares, prompt e resposta) sem impactar o fluxo normal do atendente.

- Abaixo da linha "Baseado em N conversas similares", exibir link ou botão textual "Ver detalhes técnicos do RAG" que expande/colapsa um painel de detalhes dentro do mesmo card.
- Quando o painel de detalhes estiver expandido, exibir as seguintes seções, em ordem:
1. **Arquivo de prompt**
   - Exibir linha "Prompt GPT:" seguida de link "Abrir src/modules/rag/prompt_gpt.ts".
   - Ao acionar o link, o ambiente abre o arquivo `src/modules/rag/prompt_gpt.ts` no editor para leitura/edição do prompt, sem alterar o estado da sugestão atual.
2. **Fluxo da chamada**
   - Exibir lista textual com as etapas da chamada RAG, no formato:
     - "Embedding da conversa atual (X ms)"
     - "Busca no índice vetorial (top 5, Y ms)"
     - "Prompt + modelo (Z ms)"
   - Os tempos X, Y e Z são exibidos em milissegundos, arredondados para inteiro, quando disponíveis; se alguma etapa não fornecer tempo, omitir apenas o sufixo "(… ms)" para aquela linha.
3. **Texto da consulta (conversationText)**
   - Exibir bloco somente leitura com o texto que foi usado como entrada para `embed_consulta` (formato "Cliente: …" e, se houver, "Atendente: …").
   - O bloco deve ser rolável verticalmente se o conteúdo ultrapassar a altura definida.
4. **Conversas similares (top 5)**
   - Exibir lista das até 5 conversas similares retornadas pelo módulo RAG, ordenadas por score de similaridade de cosseno em ordem decrescente.
   - Para cada item, exibir:
     - posição na lista (1 a 5),
     - identificador do chat (ex.: `chatId` ou rótulo equivalente),
     - data/hora de referência, se estiver disponível no chunk,
     - score de similaridade no formato decimal com duas casas (ex.: `score=0.83 (cosine)`).
   - Os 3 primeiros itens (top 3) devem ser exibidos já expandidos, com o texto do turno em formato somente leitura (cliente/atendente).
   - Os itens 4 e 5 devem ser exibidos inicialmente em forma compacta (linha única com identificador e score) com controle "Expandir"; ao expandir, o texto completo do turno é exibido tal como nos 3 primeiros.
   - Se houver menos de 5 resultados, listar apenas os retornados, mantendo a regra de destacar até 3 como expandidos e os demais como compactos.
5. **Prompt enviado para o modelo**
   - Exibir dois blocos de texto somente leitura:
     - **System prompt:** o conteúdo do campo `system` usado na chamada ao modelo.
     - **User prompt:** o conteúdo do campo `user`, incluindo a conversa atual, os exemplos do histórico e a instrução final de geração.
   - Os blocos devem ser roláveis se o texto ultrapassar a altura definida, sem quebrar o layout principal do painel.
6. **Resposta do modelo**
   - Exibir a resposta original retornada pelo modelo antes de qualquer edição do atendente, em bloco somente leitura.
   - O texto exibido deve ser idêntico ao valor usado para preencher o `<textarea>` da sugestão no modo padrão.
7. **Avaliação automática da sugestão**
   - Exibir, em linha única abaixo da resposta do modelo, os scores de avaliação retornados pelo RAG (quando disponíveis), no formato:  
     - "Relevância: X · Fidelidade: Y · Estilo: Z", onde `X`, `Y` e `Z` são números de 0 a 1 com duas casas decimais (ex.: `0,87`).
   - Quando não houver avaliação (por erro ou em versões do RAG que não a produzam), omitir completamente esta linha, sem placeholder.
   - Estes scores são apenas informativos para modo desenvolvedor; não bloqueiam nem alteram o envio da mensagem pelo atendente.
8. **Resposta sem RAG (baseline)**
   - Exibir, abaixo da avaliação do item 7, um bloco de comparação contendo a resposta que o modelo geraria **sem** os chunks do histórico (apenas com `currentConversation` e chunks vazio).
   - O bloco contém:
     - Título "Resposta sem RAG (baseline)".
     - Texto da resposta em bloco somente leitura, mesmo estilo visual do item 6 (Resposta do modelo).
     - Linha de avaliação no mesmo formato do item 7: "Relevância: X · Fidelidade: Y · Estilo: Z".
   - Quando não houver dados de baseline (campo `baselineNoRag` ausente em `debugInfo`), omitir o bloco inteiro, sem placeholder.
   - O baseline é puramente informativo para modo desenvolvedor; não altera o texto da sugestão principal nem o fluxo de envio.
9. **Resumo do experimento (mini-dashboard)**
   - Objetivo: dar ao operador/desenvolvedor uma visão rápida de como o experimento RAG vs baseline está se comportando, sem sair do painel.
   - Exibir, em uma pequena área abaixo do bloco de baseline (ou logo após a seção de detalhes técnicos), um resumo com:
     - Contador de mensagens avaliadas / total no experimento: **incrementa** quando uma linha JSONL do experimento for gravada com sucesso (regra R1 da spec RAG — uma linha por sucesso de `orquestrador_consulta_rag`), **quer** o disparo tenha sido manual **quer** automático; exibir por exemplo: "Mensagens avaliadas (hoje): N" e "Total no experimento: M".
     - Percentuais agregados recentes (ex.: últimos 7 dias ou janela configurável), no formato:
       - "RAG melhor que baseline: P1%".
       - "Empate (diferença pequena): P2%".
       - "Baseline melhor que RAG: P3%".
     - Média recente dos scores de estilo, relevância e fidelidade para RAG e baseline, em texto simples, por exemplo:
       - "Estilo Jonas (RAG, 7 dias): 0,72".
       - "Fidelidade (RAG, 7 dias): 0,88".
   - Este resumo deve ser claramente marcado como **“Dados do experimento (amostra)”** para deixar explícito que é informação de laboratório, não garantia individual daquela conversa.
   - **Leitura dos dados (simplificação):** a UI não precisa impor várias leituras paralelas ao storage por cada redesenho do painel; basta **um** consumo lógico das estatísticas (por exemplo uma função que devolve o pacote já agregado para exibição, ou leitura disparada após sucesso de gravação JSONL / ao abrir o bloco de detalhes). O contrato é **o que** mostrar (N, M, janela, percentuais), não **quantas** chamadas de baixo nível fazer.
   - **Implementação atual:** uso de `readRagExperimentStatsForDashboard` (spec RAG / `experiment_logger`) num único passe ao redesenhar o dashboard quando o view-model está **pronto** (há chat no contexto do Atendimento). Sem chat ativo nesse contexto, o mini-dashboard não carrega números (estado vazio/neutro), sem múltiplas leituras paralelas por métrica.
10. **Lista rápida de casos extremos (opcional/futuro)**
    - Opcionalmente, o painel pode oferecer um link "Ver exemplos do experimento" que abre (em modal ou nova aba interna) uma lista curta de:
    - 3 conversas em que o RAG foi **muito melhor** que o baseline (diferença grande a favor nos scores).
    - 3 conversas em que o baseline foi **melhor** que o RAG.
    - Para cada item, exibir:
      - um trecho da conversa (resumido/anônimo),
      - as duas respostas (RAG e baseline),
      - os respectivos scores.
    - Esta visualização serve apenas para análise e divulgação; não altera o fluxo de atendimento.

****Posição no painel:** Este bloco "Sugestão com histórico" fica no painel de Atendimento (terceira coluna), em posição definida no layout (ex.: acima do bloco "Registro de compra"). Mesma hierarquia visual e tipografia do restante do painel.

## Lógica

Esta feature existe para que o atendente consiga responder mais rápido usando conversas passadas como base, sem precisar ler o histórico inteiro manualmente.

### Fluxo `rag:generate` + indexação

```
Primeiro uso (índice vazio): Gatilho manual `rag:generate` OU primeira consulta automática (com toggle ligado)  →  `orquestrador_indexacao_rag` (prepara índice)  →  `orquestrador_consulta_rag`  →  UI (sugestão)
Demais usos manuais: Botão "Gerar sugestão" (UI)  →  ação `rag:generate`  →  `orquestrador_consulta_rag`  →  UI (sugestão)
```

#### Regras

- **Se** o usuário clicar em "Gerar sugestão" **e** não houver chat ativo **então** a ação `rag:generate` falha com mensagem de erro na UI e nenhum estado do bloco RAG é alterado.
- **Se** for a primeira consulta com índice vazio — **seja** por clique em "Gerar sugestão" **seja** por gatilho automático com toggle ligado — **então** a orquestração de produto (hoje em [src/modules/atendimento/rag-mettri-controller.ts](src/modules/atendimento/rag-mettri-controller.ts), partilhada pelo manual e pelo automático) chama `orquestrador_indexacao_rag` para preparar o índice vetorial antes de chamar `orquestrador_consulta_rag` (Opção B da spec RAG; “vazio” = `VectorIndex.isEmpty()` ou equivalente).
- **Se** a indexação (`orquestrador_indexacao_rag`) falhar **então** o bloco RAG volta ao estado normal (sem loading), não chama `orquestrador_consulta_rag` e a UI exibe uma mensagem de erro explícita.
- **Se** o usuário clicar em "Gerar sugestão" com chat ativo **então** o bloco RAG entra em estado de carregamento e exibe indicador de loading no lugar do `<textarea>`.
- **Se** `orquestrador_consulta_rag` retornar `suggestion` e `chunks` **então** o bloco RAG preenche o `<textarea>` com `suggestion`, atualiza a linha "Baseado em N conversas similares" com `N = chunks.length` e volta ao estado normal (sem loading).
- **Se** `orquestrador_consulta_rag` falhar (erro em embeddings, busca ou modelo) **então** o bloco RAG volta ao estado normal (sem loading), mantém o texto anterior (se houver) e a UI exibe uma mensagem de erro explícita.

### Fluxo automático (nova mensagem do cliente + toggle)

Metáfora: o modo automático é como um "assistente que ouve a campainha" — só entra se você deixar a chave ligada; se estiver desligada, ninguém corre até a porta.

#### Escopo do gatilho (Mettri aberto vs painel Atendimento)

- O toggle vive na Interface do bloco "Resposta sugerida", mas o **gatilho de negócio** do automático é: **Mettri carregado e ativo** o suficiente para receber o evento de nova mensagem (captura → MessageDB / barramento equivalente), **sem** exigir que o usuário tenha o **módulo de Atendimento** aberto ou em foco.
- **Se** o Mettri **não** estiver carregado (extensão/painel fechado) **então** o fluxo automático **não** roda — não há ouvinte nem contexto de produto.
- **Implementação atual:** os listeners do automático estão registados no `EventBus` do [src/ui/panel.ts](src/ui/panel.ts) (`registerRagAutoListeners`); a lógica compartilhada com o manual vive em [src/modules/atendimento/rag-mettri-controller.ts](src/modules/atendimento/rag-mettri-controller.ts). O módulo `atendimento.dashboard` apenas **sincroniza** estado para a UI ao redesenhar.
- **Contrato alvo (Zen):** **toggle ligado** + **evento de nova mensagem disponível no barramento** + **mensagem válida no chat ativo do WhatsApp** → mesma sequência RAG que o manual (ver spec RAG para índice persistente e Opção B). **Hoje**, “evento disponível” inclui a condição de **lateral visível** (ver bullet do toggle acima); alinhar no futuro se o produto relaxar esse gate.

#### Regras

- **Se** o modo "Gerar sugestão automático" estiver **desligado** **então** mensagens novas do cliente **não** disparam `orquestrador_consulta_rag`.
- **Se** o modo estiver **ligado** **e** o Mettri estiver no escopo acima **e** chegar **nova mensagem inbound do cliente** no **chat que está ativo no WhatsApp** (critério alinhado ao MessageDB / captura: texto legível, mesmo espírito de "mensagem válida" que o RAG usa para montar contexto) **então** montar o contexto do **chat correspondente** e executar a **mesma sequência** que o manual: preparação de índice apenas quando o armazenamento vetorial estiver **realmente vazio** (ver spec RAG — não confundir com flag só de sessão), depois `orquestrador_consulta_rag` (incluindo avaliação/juiz e logging do experimento JSONL conforme spec RAG).
- **Se** não houver `chatId` resolvível para aquele evento **então** não iniciar o fluxo automático **e** a UI deve falhar de forma explícita (mensagem clara) ou não disparar a consulta — uma política única, documentada na implementação.
- **Concorrência (mesmo `chatId`):** **Se** já existir uma consulta RAG em **loading** para aquele `chatId` **então** não iniciar segunda consulta em paralelo. **Se**, após concluir a consulta, o turno do cliente tiver mudado (nova mensagem) **então** permitir **uma** nova execução automática para refletir o turno atual — evita paralelismo caótico e sugestões silenciosamente defasadas.
- **Manual vs automático:** **Se** o usuário acionar "Gerar sugestão" (`rag:generate`) **então** qualquer pedido pendente de “rodar de novo” só do fluxo automático para aquele chat deve ser **cancelado** antes da nova execução, para não encadear dois contextos (implementação: limpeza explícita antes de `runRagMettriConsultation` manual).
- **Mudança de chat ativo:** **Se** o `chatId` ativo no WhatsApp mudar **e** não houver consulta RAG em loading **então** limpar sugestão/contagens de debug exibidas no estado global partilhado, para não mostrar texto do chat anterior até nova geração (implementação: `chat:active-changed` no controller).
- **Se** o gatilho automático iniciar `orquestrador_consulta_rag` para o chat ativo **então** o bloco "Resposta sugerida" segue as mesmas regras visuais de carregamento e preenchimento do `<textarea>` que no fluxo manual.

### Fluxo `rag:send`

```
Bloco "Resposta sugerida"  →  ação `rag:send`  →  serviço sendMessageService.sendText  →  WhatsApp Web
```

#### Contrato da ação `rag:send`

- **Entrada**:
  - `text: string` — conteúdo atual do `<textarea>` da resposta sugerida (ou o último texto de sugestão gerado, quando o textarea não tiver sido editado).
  - `chatId: string` — chat ativo no painel Atendimento, resolvido a partir de `currentChatId` (com fallback para `getActiveChatIdDirect()` quando necessário) antes de chamar o serviço de envio.
- **Dependência externa**:
  - Serviço `sendMessageService.sendText(chatIdOrPhone, text)` definido em `src/infrastructure/services/send-message.ts`.

#### Regras determinísticas

- **Se** o usuário clicar em "Enviar para WhatsApp" **e** `text` estiver vazio (após `trim`) **então** o fluxo de envio não chama `sendMessageService.sendText` (nenhuma integração é disparada).
- **Se** o usuário clicar em "Enviar para WhatsApp" **e** não houver `chatId` ativo resolvido **então** o módulo de Atendimento interrompe o fluxo e a UI exibe mensagem clara do tipo: "Não foi possível enviar pelo WhatsApp. Verifique se a conversa está aberta e tente de novo.".
- **Se** `rag:send` chamar `sendMessageService.sendText(chatId, text)` **e** o serviço lançar erro **então** o texto permanece no `<textarea>`, nenhuma nova tentativa automática é feita e a UI exibe uma mensagem de erro amigável (derivada de `error.message` quando disponível).
- **Se** o envio for bem-sucedido **então** a UI pode exibir um toast/alert simples de sucesso (ex.: "Mensagem enviada no WhatsApp.") e **mantém** o texto da sugestão para possível reuso/edição futura.

---

## Registro manual de compra

Permitir que o usuário registre explicitamente que uma compra ocorreu em um determinado chatId, garantindo:

- Persistência local independente do MessageDB.
- Disponibilidade para consulta da última compra ativa por cliente.
- Independência da retenção de mensagens (90 dias / 10k limite).
- Auditabilidade e reversibilidade.

### **Objetivo mensurável:**

Cada acionamento válido do evento manual deve resultar em um registro persistido e consultável, associado a um único chatId.

**Escopo**

- Registro manual explícito.
- Associação obrigatória a chatId.
- Persistência em store própria (não MessageDB).
- Múltiplas compras por chat.
- Remoção lógica.
- Consulta da última compra ativa.

**Non-goals**

- Não depende da existência da mensagem original.
- Não depende do MessageDB.
- Não utiliza IA.
- Não detecta automaticamente.
- Não altera mensagens.
- Não depende de retenção de 90 dias.
- Não executa pagamento.
- Não valida valor.

**Entradas**

``Evento obrigatório:`

`manual:add-purchase`

    Payload:`

`{     chatId: string,     purchaseDate: Date,     alue?: number,     items?: string[],     notes?: string }`

**Validações determinísticas**:
Se chatId for null, undefined ou string vazia → rejeitar.

Se purchaseDate não for Date válido → rejeitar.

Se value existir e value < 0 → rejeitar.  

**Saídas**

Objeto persistido ManualPurchaseRecord:

`{  purchaseId: string,  chatId: string,  purchaseDate: Date,  value: number | null,  items: string[] | null,  notes: string | null,  source: "MANUAL",  status: "ACTIVE" | "REMOVED",  createdAt: Date }`

Persistido em store independente: PurchaseDB.

## **Regras**

**6.1 Criação**

Se evento manual:add-purchase ocorrer
E validações forem satisfeitas
→ então criar novo ManualPurchaseRecord

Com:

purchaseId único

status = ACTIVE

source = MANUAL

createdAt = now()

**6.2 Independência do MessageDB**

****Se mensagem original for apagada por retenção (90 dias ou 10k limite)
→ registro manual NÃO deve ser afetado.

**6.3 Múltiplas Compras**

****Se já existirem compras para o mesmo chatId
→ permitir novo registro
→ não sobrescrever registros anteriores.

**6.4 Remoção**

****Evento:

manual:remove-purchase(purchaseId)

Se purchaseId existir
→ alterar status = REMOVED
→ manter registro no banco.

Se não existir
→ rejeitar evento.

**6.5 Consulta da Última Compra**

****Evento:

manual:get-last-purchase(chatId)

Processo:

Filtrar registros onde:

chatId = input

status = ACTIVE

Ordenar por purchaseDate descendente.

Retornar primeiro registro.

Se nenhum existir → retornar null.

**6.6 Idempotência (Proteção Opcional)**

********Se dois eventos forem recebidos com:

Mesmo chatId

Mesmo purchaseDate

Mesmo value

Dentro de janela de 5 segundos

→ permitir ambos (não bloquear), pois usuário pode registrar duas compras legítimas.

Não aplicar deduplicação automática.

ACTIVE

REMOVED

Transições válidas:

ACTIVE → REMOVED

Transições inválidas:

REMOVED → ACTIVE

**8.** **Eventos**

manual:add-purchase

manual:remove-purchase

manual:get-last-purchase

Nenhum evento implícito permitido.

**9. Invariantes**

****Todo registro possui purchaseId único.

Todo registro possui chatId.

Todo registro possui purchaseDate.

Nenhum registro ACTIVE pode ser fisicamente apagado.

Consulta de última compra considera apenas ACTIVE.

PurchaseDB não depende do ciclo de vida do MessageDB.

**10. Edge Cases**

****Usuário registra compra com data futura
→ permitido.

Usuário registra compra sem valor
→ permitido.

Usuário remove última compra
→ próxima ACTIVE mais recente torna-se última.

Usuário remove todas as compras
→ consulta retorna null.

Chat nunca teve compra
→ consulta retorna null.

**11.Critérios de Aceitação**

****Dado evento válido
→ registro persistido.

Dado múltiplas compras no mesmo chat
→ consulta retorna a mais recente ACTIVE.

Dado remoção
→ status muda para REMOVED.

Dado remoção da última compra
→ sistema retorna a próxima válida.

Dados devem permanecer mesmo após limpeza do MessageDB.

---

## 12. Interface no painel Atendimento (parte visual)

O registro manual de compra é exposto no painel Atendimento como um bloco dedicado, abaixo do card "Pedido" e acima de "Frases" / "Produto".

### 12.1 Bloco "Registro de compra"

- Cabeçalho: título "Registro de compra", opcionalmente colapsável (chevron).
- **Sempre exibir o botão "Registrar compra"**, que abre o fluxo de registro, permitindo adicionar múltiplas compras para o mesmo chatId.
- Quando existe última compra (ACTIVE): exibir card com data da compra, valor (se houver), itens/resumo (se houver), botão "Registrar compra" e botão "Remover registro" que dispara manual:remove-purchase(purchaseId).
- Quando não existe: texto "Nenhuma compra registrada para este chat." e botão "Registrar compra" que abre o fluxo de registro.
- Dados exibidos vêm da consulta manual:get-last-purchase(chatId) realizada pelo provider ao montar o ViewModel do Atendimento.

### 12.2 Fluxo "Registrar compra"

- Ao clicar em "Registrar compra", exibir formulário (modal ou painel inline) com:
  - Data da compra (vem pré-prenchida com data atual).
  - Valor (opcional).
  - Itens / resumo (opcional).
  - Notas (opcional).
- Botões "Cancelar" e "Salvar". Ao salvar, disparar evento manual:add-purchase com chatId do chat ativo e payload preenchido; após sucesso, atualizar a vista (rerender) para exibir a nova última compra.
- Validações de entrada (chatId, purchaseDate, value ≥ 0) seguem a seção 4; erros exibidos na UI de forma clara.

### 12.3 Onde implementar

- Renderização e interação: src/modules/atendimento/dashboard/atendimento-panel.ts — novo bloco no layout e, se aplicável, modal/form de registro.
- Dados e eventos: ViewModel do Atendimento deve incluir `lastPurchase` (ou equivalente) preenchido via `manual:get-last-purchase(chatId)`; ações de UI disparam eventos tratados no módulo (ex.: [dashboard-module.ts](src/modules/atendimento/dashboard/dashboard-module.ts)) que invocam a camada de persistência (PurchaseDB / eventos do spec).

---

# Comercial no WhatsApp (funil + estado da conversa)

Esta feature existe para que o atendente veja o **estado da conversa** (onde está no **funil**), receba um **rascunho da próxima mensagem** alinhado a isso e **grave o pedido** ao fechar.

Contratos nas ZenSpecs filhas (tabela no fim). Formato: [ZenSpec.md](../../../ZenSpecKit/ZenSpec.md).

## Conceito

Uma conversa = `chatId` + mensagens no **MessageDB**.

**Estado da conversa** = objeto **`estadoVenda`**: modo (pré-venda ou pedido), **funil** em **slots**, o que falta (**faltantes**) e se já fechou (`pedidoConfirmado`).

O LLM lê esse estado e devolve **rascunho da próxima mensagem** (RAG opcional: [rag/spec.md](../rag/spec.md)); ao fechar com dados mínimos → **`RegistrarPedido`**; **Pagamentos** corre à parte.

## Lógica

### Composição (estilo Unix)

- Cada programa (nome sempre em `código`) é **uma transformação**: **entrada → saída**; contrato (campos, erros, edge cases) **só** na ZenSpec filha desse nome (tabela no fim).
- A ordem das setas do fluxo vem de **um orquestrador explícito**. **Não** existe pipeline “implícito” na UI, no LLM ou em vários sítios ao mesmo tempo (alinhado a [ZenSpec.md](../../../ZenSpecKit/ZenSpec.md): orquestrador declarado).
- **Se** uma etapa falhar **então** falha **explícita**; **não** passar meia-verdade para a etapa seguinte nem sucesso parcial silencioso.

### As 4 peças

| Peça           | O quê é                                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Entrada        | `chatId` + mensagens.                                                                                                                  |
| `estadoVenda`  | **Estado da conversa** + **funil** (ver tabela seguinte).                                                                              |
| Rascunho (LLM) | Lê `estadoVenda` + turno; envio automático só com **PortaoEnvio**.                                                                     |
| Saída          | Rascunho na UI; humano envia no normal; **Se** fechou com dados mínimos **então** `RegistrarPedido` grava (regra e timing nas filhas). |

### Campos do estado (`estadoVenda`)

| Campo              | O quê é                                                       |
| ------------------ | ------------------------------------------------------------- |
| `modo`             | `pre_venda` ou `pedido_ativo`.                                |
| `slots`            | Itens, logística, horário, valor/forma, upsell?, confirmação. |
| `faltantes`        | O que falta perguntar.                                        |
| `pedidoConfirmado` | `true` só quando `Venda` disser que fechou.                   |

**Ordem dos slots (guia, não obriga uma mensagem por passo):** dúvidas → pedido claro → retirada/entrega → hora → valor → upsell → confirmação/resumo.

### Nota de evolução — Perfil de cliente operacional (genérico)

No orquestrador canónico, sinais de **perfil factual** vão em **`ClienteResolvido.perfilFactual`** (sub-chamada ao programa `Perfil` dentro de `IdentificarCliente`). Como evolução compatível, o domínio pode expor um perfil operacional interno (não psicológico), com campos factuais para apoiar `Venda` e `ContextoResposta`:

- Nome confiável e qualidade de cadastro.
- Comportamento de conversa (janela horária, frequência de contacto).
- Histórico de compra resumido (recência/frequência, sem dados sensíveis).
- Preferências de produto e logística.
- Sensibilidade a oferta (baixa/média/alta) com score de confiança.

Regra de produto: estes campos são de apoio e devem ser sempre explicáveis por fatos observáveis (mensagens, compras e regras), sem inferência sensível.

**Fonte agregada de ficha:** quando existir integração, leitura canónica por `chatId` segue [../cadastro/fornecer-ficha-cliente-para-atendimento.zenspec.md](../cadastro/fornecer-ficha-cliente-para-atendimento.zenspec.md) e ownership em [../cadastro/spec.md](../cadastro/spec.md) (secções 19–21). `IdentificarCliente` continua a expor `ClienteResolvido`; o enriquecimento de perfil no pipeline pode combinar tags locais com dados da ficha quando `deps` incluírem essa leitura.

### Selo no cabeçalho do painel (Novo / Contato / Ativo / Recorrente)

Objetivo: um único chip próximo ao nome do cliente, derivado de **sinais objetivos** (não muda a cada turno de LLM).

| Valor exibido      | Condição (implementação atual)                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **Recorrente**     | **Duas ou mais** compras com `status` **ACTIVE** em `PurchaseDB` para o `chatId`.                                         |
| **Ativo**          | **Exatamente uma** compra ACTIVE para o `chatId` (primeira compra no registro; pós–onboard comercial até segunda compra). |
| **Contato**        | **Zero** compras ACTIVE **e** existe pelo menos **uma mensagem** persistida para o `chatId` no **MessageDB**.             |
| **Novo** (estrito) | **Zero** compras ACTIVE **e** zero mensagens capturadas no Mettri para esse chat.                                         |

**Ouvinte:** o programa [ouvir](ouvir/spec.md) **enriquece** o perfil operacional a partir do texto das mensagens; **não** é a fonte canónica do bit “houve conversa”. O bit “Contato” usa **captura** (histórico no Mettri). Pode haver mensagens capturadas e o ouvinte ainda não ter persistido campos no perfil.

**Implementação:** `getAtendimentoViewModel` usa `purchaseDB.listActiveByChatId` (contagem) + `messageDB.getMessages(chatId, 1)` (existência de conversa capturada).

**Relacionamento inicial (agente / UX):** com **zero compras** ACTIVE, se existir pelo menos uma mensagem **recebida** do cliente no `MessageDB`, calcula-se a data da **primeira** inbound (`getFirstIncomingCapturedAtForChat`). Enquanto `agora - primeiraInbound < 48h`, o view-model expõe `relacionamentoInicialParaAgente: true` e o painel pode mostrar uma dica curta ao operador (o chip já pode ser **Contato** — a dica complementa o tom de onboard). Após 48h ou após qualquer compra ACTIVE, o flag fica `false`. Constante `RELACIONAMENTO_INICIAL_HORAS = 48` no provider (evolução: configurável).

### Pipeline

Os primeiros programas até `fornecerVitrineParaPipelineComercial` são **só ajuda** (no início podem devolver quase nada). O miolo é **atualizar estado da conversa / funil → preparar prompt → rascunho da próxima mensagem**. O pacote vai **acumulando** de etapa em etapa (como saída de um comando vira entrada do seguinte). **Única porta de entrada** à cadeia a partir da UI ou serviço: **`comercialPipelineOrchestrator`** (detalhe em [orquestrar-pipeline-comercial-whatsapp.zenspec.md](orquestrar-pipeline-comercial-whatsapp.zenspec.md)).

**Papel de promoções e perfil:** promoções ativas e priorização entram pela **vitrine** (`VitrineSaida`). **Perfil factual** (tags) pode ser obtido **dentro** de `IdentificarCliente` (`perfilFactual` em `ClienteResolvido`) — ver [identificar-cliente.zenspec.md](identificar-cliente.zenspec.md). Não há chaves `promo` nem `perfil` soltas no `EnriquecimentoComercial`.

```
Gatilho → comercialPipelineOrchestrator → IdentificarCliente → Produtos → fornecerVitrineParaPipelineComercial → Venda → ContextoResposta → SugestaoWhatsApp → saída para UI
```

| Programa                               | Recebe                                                                                                                               | Faz                                                                 | Manda para                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------- |
| `comercialPipelineOrchestrator`        | `chatId`, janela de mensagens, persona? (opcional), flags de automação? (opcional), dependências (MessageDB, …)                      | Chama a sub-cadeia em ordem; propaga falhas; devolve pacote para UI | — (devolve resultado ao chamador)                         |
| `IdentificarCliente`                   | `chatId`, deps, opcionalmente mensagens para perfil                                                                                  | Resolve cliente + opcional `perfilFactual`                          | `Produtos`                                                |
| `Produtos`                             | texto, catálogo?                                                                                                                     | Match, preço, confiança                                             | `fornecerVitrineParaPipelineComercial` (via orquestrador) |
| `fornecerVitrineParaPipelineComercial` | ver [../vitrine/fornecer-vitrine-para-pipeline-comercial.zenspec.md](../vitrine/fornecer-vitrine-para-pipeline-comercial.zenspec.md) | `Promo` interno + `gerarRecomendacoesVitrine`; devolve `vitrine`    | `Venda` (pacote já montado)                               |
| `Venda`                                | mensagens, estado antes, `enriquecimento` completo                                                                                   | Atualiza `estadoVenda` (funil)                                      | `ContextoResposta`                                        |
| `ContextoResposta`                     | `estadoVenda`, turno, `enriquecimento`                                                                                               | Pacote para o LLM                                                   | `SugestaoWhatsApp`                                        |
| `SugestaoWhatsApp`                     | pacote, persona, RAG?                                                                                                                | Rascunho + portão                                                   | UI                                                        |
| `RegistrarPedido`                      | fecho + dados mínimos                                                                                                                | Grava pedido                                                        | —                                                         |

**Mais regras:** ausência de campanha ativa não impede vitrine; recomendações da vitrine não substituem preço/estoque canónico; match fraco em `Produtos` → não afirmar preço/produto sem confirmar; compra manual (secção acima) e `RegistrarPedido` podem conviver (detalhe na filha de pedido).

**Pagamentos (à parte):** `Pedido ou evento manual → Pagamentos → financeiro?` — não trava o rascunho.

| Programa     | Faz                                    |
| ------------ | -------------------------------------- |
| `Pagamentos` | Estado do pagamento (pendente/pago/…). |

**PortaoEnvio:** padrão = só rascunho na UI, humano envia ([RAG](#sugestão-com-histórico-rag) igual espírito); automático = opt-in + portão ok; portão falhou → sem auto-envio “escondido”.

**Edge cases:** entrada inválida → falha explícita ou não gera (uma política na filha); erro externo/LLM → falha explícita.

### Costura (checklist mãe)

| De                                     | Para                                   | O que tem de bater                                                                        |
| -------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------- |
| `comercialPipelineOrchestrator`        | `IdentificarCliente`                   | `ComercialOrchestratorInput` satisfaz contrato da filha orquestrador.                     |
| `IdentificarCliente`                   | `Produtos`                             | `ClienteResolvido` da filha ⊆ entrada `clienteResolvido` de `Produtos`.                   |
| `Produtos`                             | `fornecerVitrineParaPipelineComercial` | `ProdutosSaida` + turno coerentes com filhas; catálogo opcional.                          |
| `fornecerVitrineParaPipelineComercial` | `Venda`                                | `EnriquecimentoComercial` (`cliente`, `produtos`, `vitrine`) ⊆ entrada de `Venda`.        |
| `Venda`                                | `ContextoResposta`                     | Objeto **`estadoVenda`** idêntico ao tipo canónico da filha `Venda`.                      |
| `ContextoResposta`                     | `SugestaoWhatsApp`                     | Objeto `LlmTurnPackage` da filha `ContextoResposta` ⊆ entrada de `SugestaoWhatsApp`.      |
| `SugestaoWhatsApp`                     | UI                                     | `RascunhoComercial.texto` alimenta textarea; envio conforme filha (assistido/automático). |
| `Venda`                                | `RegistrarPedido`                      | Só quando `pedidoConfirmado` + `OrderDraft` mínimo (filhas alinhadas).                    |

**Mapa de sequência e tipos agregados:** [orquestrar-pipeline-comercial-whatsapp.zenspec.md](orquestrar-pipeline-comercial-whatsapp.zenspec.md).

## Interface (painel Atendimento — bloco Comercial)

**Papel:** este bloco passa a ocupar a **parte principal** da **terceira coluna** do painel Atendimento (referência futura de layout: [atendimento-panel.ts](../../../src/modules/atendimento/dashboard/atendimento-panel.ts)). O bloco **Resposta sugerida (RAG)** mantém-se como secção **acima** do Comercial; o Comercial fica **abaixo** do RAG e **acima** de “Registro de compra” / “Pedido” / restantes cards, salvo revisão de produto.

**Regra de ouro (UI):** a UI **mostra** estado e rascunho e **dispara** `comercialPipelineOrchestrator`; **não** recalcula o funil nem inventa slots — isso é sempre responsabilidade da cadeia na Lógica.

### Hierarquia visual (de cima para baixo)

1. **Cabeçalho do bloco** — título ex.: “Comercial” ou “Venda no WhatsApp”; opcional colapsar (chevron) como outros cards.
2. **Resumo do funil** — lê só espelho do `estadoVenda`: `modo` (pré-venda / pedido ativo), lista curta de **faltantes**, badge ou texto **Fechado** quando `pedidoConfirmado` (só leitura).
3. **Rascunho da próxima mensagem** — área principal (`<textarea>` ou equivalente): texto devolvido por `SugestaoWhatsApp`; estados vazio / carregando / erro como no bloco RAG (spinner, mensagem explícita).
4. **Ações** — “Gerar rascunho” (chama orquestrador), “Enviar no WhatsApp” (usa chat ativo; mesmo espírito que envio assistido do RAG), toggle ou equivalente para **automático** só se existir opt-in + **PortaoEnvio** (ver filha `SugestaoWhatsApp`).
5. **Pedido** — botão ou fluxo “Registrar pedido” visível quando as regras da filha `RegistrarPedido` permitem (ou sempre com validação); **não** substitui o bloco “Registro manual de compra” da spec acima.

### Campo / ecrã (casadinho com o back)

| Origem (back)                   | Onde no ecrã                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| `estadoVenda.modo`              | Resumo do funil (etiqueta).                                                                   |
| `estadoVenda.faltantes`         | Lista ou chips no resumo.                                                                     |
| `estadoVenda.pedidoConfirmado`  | Badge “Fechado” / cor de estado.                                                              |
| `estadoVenda.slots` (subcampos) | Opcional: secção colapsável “Detalhe do pedido” (só leitura ou edição mínima conforme filha). |
| Rascunho (`SugestaoWhatsApp`)   | Textarea principal.                                                                           |
| Erro da cadeia / timeout        | Banner ou toast abaixo do cabeçalho; texto legível.                                           |
| Loading da cadeia               | Desativa “Gerar rascunho”; spinner na área do rascunho.                                       |

### ZenSpecs filhas (`Specs/atendimento/` + vitrine + pedidos)

| Ficheiro                                                                                                                         | Programa                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [classificar-intencao-conversa.zenspec.md](classificar-intencao-conversa.zenspec.md)                                             | `ClassificarIntencao` (passo 0 do pipeline)                               |
| [modelo-pedido-unificado.zenspec.md](modelo-pedido-unificado.zenspec.md)                                                         | `OrderRecordV2` (contrato de dados, partilhado com módulo `pedidos`)      |
| [bloco-pedidos-no-painel.zenspec.md](bloco-pedidos-no-painel.zenspec.md)                                                         | Bloco de pedidos dentro do painel Atendimento                             |
| [orquestrar-pipeline-comercial-whatsapp.zenspec.md](orquestrar-pipeline-comercial-whatsapp.zenspec.md)                           | `comercialPipelineOrchestrator`                                           |
| [identificar-cliente.zenspec.md](identificar-cliente.zenspec.md)                                                                 | `IdentificarCliente`                                                      |
| [produtos-preco-e-estoque.zenspec.md](produtos-preco-e-estoque.zenspec.md)                                                       | `Produtos`                                                                |
| [promocoes-do-periodo.zenspec.md](promocoes-do-periodo.zenspec.md)                                                               | `Promo` (subcomponente interno da `Vitrine`; não contrato público)        |
| [perfil-factual-do-cliente.zenspec.md](perfil-factual-do-cliente.zenspec.md)                                                     | `Perfil` (sub-chamada em `IdentificarCliente`, não passo do orquestrador) |
| [../vitrine/fornecer-vitrine-para-pipeline-comercial.zenspec.md](../vitrine/fornecer-vitrine-para-pipeline-comercial.zenspec.md) | `fornecerVitrineParaPipelineComercial`                                    |
| [../vitrine/spec.md](../vitrine/spec.md)                                                                                         | Módulo vitrine (contratos `VitrineEntrada` / `VitrineSaida`)              |
| [atualizar-contexto-de-venda.zenspec.md](atualizar-contexto-de-venda.zenspec.md)                                                 | `Venda`                                                                   |
| [preparar-contexto-de-resposta.zenspec.md](preparar-contexto-de-resposta.zenspec.md)                                             | `ContextoResposta`                                                        |
| [orquestrar-sugestao-whatsapp.zenspec.md](orquestrar-sugestao-whatsapp.zenspec.md)                                               | `SugestaoWhatsApp`, `PortaoEnvio`                                         |
| [registrar-pedido-obrigatorio.zenspec.md](registrar-pedido-obrigatorio.zenspec.md)                                               | `RegistrarPedido`                                                         |
| [confirmar-pagamento.zenspec.md](confirmar-pagamento.zenspec.md)                                                                 | `Pagamentos`                                                              |
| [atendimento-unificado.zenspec.md](atendimento-unificado.zenspec.md)                                                              | Nova UI unificada (Funil + Pedido + Vitrine + Sugestão)                   |
| [../pedidos/spec.md](../pedidos/spec.md)                                                                                          | Módulo `pedidos` (visão global de pedidos da conta)                       |

---

# Classificação de intenção da conversa

Esta feature existe para que, ao abrir um chat, o sistema determine se a conversa é uma **compra nova, suporte pós-venda, orçamento, dúvida ou outro** — permitindo que o pipeline comercial crie automaticamente um pedido (`lead`), carregue um pedido existente, ou adapte o tom da resposta.

## Conceito

Classificação determinística baseada em heurísticas textuais + histórico do cliente + sinais do Ouvinte. Reavaliada a cada novo turno de mensagem do cliente. Se o tipo de conversa mudar (ex.: cliente começa pedindo, depois reclama de entrega), o sistema reclassifica.

Contrato completo: [classificar-intencao-conversa.zenspec.md](classificar-intencao-conversa.zenspec.md).

---

# Modelo de Pedido Unificado

Esta feature existe para que todos os programas do domínio partilhem um único contrato de pedido (`OrderRecordV2`) com ciclo de vida completo: `lead` → `draft` → `open` → `awaiting_payment` → `completed`, substituindo a fragmentação entre `OrderDB` atual e `PurchaseDB`.

## Conceito

Um registro único por pedido, desde a primeira intenção até a entrega. Número sequencial (`PED-0001`) global por conta. Timeline imutável de transições. Itens estruturados (sku, nome, qty, preço). Mutável apenas em `draft`; imutável a partir de `open`.

Contrato completo: [modelo-pedido-unificado.zenspec.md](modelo-pedido-unificado.zenspec.md).

## Integração com módulo Pedidos

O módulo `pedidos` ([../pedidos/spec.md](../pedidos/spec.md)) é um módulo irmão que consome o mesmo `OrderDB` para fornecer uma visão global de todos os pedidos da conta, com filtros, métricas e ações em lote. O painel de atendimento mostra o pedido do cliente atual; o módulo pedidos mostra todos.

Interface do bloco de pedidos dentro do atendimento: [bloco-pedidos-no-painel.zenspec.md](bloco-pedidos-no-painel.zenspec.md).

### Escopo fora

Código, API financeira, schema fino, redefinir RAG (só [consumo rag/spec.md](../rag/spec.md)).