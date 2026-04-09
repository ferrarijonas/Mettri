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

****Entradas****

``Evento obrigatório:`

`manual:add-purchase`

    Payload:`

`{
    chatId: string,
    purchaseDate: Date,
    alue?: number,
    items?: string[],
    notes?: string
}`

**Validações determinísticas**:
Se chatId for null, undefined ou string vazia → rejeitar.

Se purchaseDate não for Date válido → rejeitar.

Se value existir e value < 0 → rejeitar.  

**Saídas**

Objeto persistido ManualPurchaseRecord:

`{
 purchaseId: string,
 chatId: string,
 purchaseDate: Date,
 value: number | null,
 items: string[] | null,
 notes: string | null,
 source: "MANUAL",
 status: "ACTIVE" | "REMOVED",
 createdAt: Date
}`

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

# Gestor de vendas conversacional (pré-venda + pedido + sugestão WhatsApp)

Esta feature existe para que **o atendente** consiga **conduzir pré-venda e pedido no WhatsApp** com contexto de cliente, catálogo (incluindo **estoque**), promoções e funil explícito, recebendo **sugestões** alinhadas ao negócio — **sem** perder o **human-in-the-loop** no envio padrão, e com caminho para **envio automático** apenas quando **portões de segurança** permitirem.

Formato Zen: ver [ZenSpecKit/ZenSpecKit/ZenSpec.md](../../../ZenSpecKit/ZenSpec.md) — **spec mãe** aqui; **contratos finos** dos programas nas ZenSpecs filhas (tabela de ficheiros abaixo).

## Conceito

O Mettri trata o WhatsApp Web como canal único operacional: mensagens normalizadas no **MessageDB**, identidade de chat (`chatId`) como chave primária. **Pré-venda** cobre relacionamento, dúvidas/disponibilidade e compromissos (“me avisa quando…”) até existir **pedido ativo**. **Pedido ativo** segue um **funil** de negócio com **slots** (itens, retirada/entrega, horário, valor/Pix, upsell, confirmação). **Tom e estilo** da marca vivem num **único bloco** (persona + regras) injetado no *system* do modelo, reforçado por **RAG** quando aplicável ([Specs/rag/spec.md](../rag/spec.md)). **Registrar pedido** é **obrigatório** quando o negócio conclui um pedido confirmado (registo estruturado, não só texto). **Pagamento** tem ciclo próprio (**`Pagamentos`**) e pode integrar um módulo financeiro depois; não substitui o registo de pedido.

Metáfora: **um gerente de loja** que prepara a próxima frase e a ficha do pedido; **o atendente** fala no microfone; **auto-envio** é “abrir o microfone sozinho” só quando a **casa** achar seguro.

## Modos e funil

### Pré-venda (fora da numeração do funil fechado)

- Relacionamento, saudação, tom.
- Dúvidas e disponibilidade (cardápio, “tem hoje?”, links) — primeiro “passo de negócio” quando ainda **não** há pedido fechável.
- Compromissos e recados (intenção futura, lembretes, “avisar quando…”).

### Pedido ativo — funil (7 passos na conversa com o cliente)

1. **Dúvidas / disponibilidade** (continua aplicável durante o pedido como pergunta lateral).
2. **Início da venda** — intenção clara de pedir.
3. **Entrega ou retirada** (+ endereço quando necessário).
4. **Horário** — estimativa ou janela.
5. **Valor** — total e forma (ex. Pix).
6. **Upsell / venda cruzada** — quando couber.
7. **Confirmação + despedida** — resumo do pedido, observações relevantes e encerramento útil; revisão **obrigatória** como **conteúdo** deste passo (não precisa ser “passo 8” separado para o cliente).

**Nota:** Slots podem ser preenchidos **de uma só vez** (“burst”); o funil é guia lógico, não fila rígida obrigatória mensagem a mensagem.

## Integração catálogo, estoque e vitrine

- **`Produtos`:** resolve menções em texto para produto canônico, **preço vigente** e **disponibilidade/estoque** conforme módulo de dados (fonte única por conta/negócio). Saída com **confiança** quando houver ambiguidade.
- **`Promo`:** injeta ofertas/vitrine **do período** como contexto estruturado (lista curta, datas, prioridade), sem o modelo “inventar” campanha.
- Relação com **Registro manual de compra** (secção acima): pedido estruturado (**`RegistrarPedido`**) e compra manual podem coexistir; a spec filha de `RegistrarPedido` deve alinhar se há vínculo opcional entre **Order** e **ManualPurchaseRecord** ou fluxos independentes até segunda ordem.

## Pipeline principal (linha)

```
MessageDB
  → IdentificarCliente
  → Produtos (preço + estoque)
  → Promo
  → Perfil
  → Venda
  → ContextoResposta
  → SugestaoWhatsApp
  → WhatsApp (UI / envio)
  → RegistrarPedido (gatilho: pedido confirmado; obrigatório)
```

**Pagamentos** (paralelo ao ciclo de sugestão, não bloqueia geração de texto):

```
Pedido registrado ou evento manual  →  Pagamentos (status: pendente/pago/…)  →  integração financeira (futuro, opcional)
```

## Tabela de programas (`Programa | Recebe | Faz | Manda para`)

Contratos detalhados, edge cases e critérios de aceitação ficam nas **ZenSpecs filhas**; esta tabela é o panorama obrigatório da spec mãe.

| Programa             | Recebe                                                                                                       | Faz                                                                                                           | Manda para                |
| -------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `IdentificarCliente` | `chatId`, leituras de cadastro/cliente                                                                       | Resolve ou referencia ficha do cliente                                                                        | `Produtos`                |
| `Produtos`           | Turno/texto + catálogo com **estoque**                                                                       | Match de produto, preço snapshot, disponibilidade                                                             | `Promo`                   |
| `Promo`              | `accountId`, instante, regras de vitrine                                                                     | Lista promoções ativas do período                                                                             | `Perfil`                  |
| `Perfil`             | Cliente + sinais mínimos do histórico                                                                        | Perfil factual (ex. novo/recorrente, pistas retirada/entrega)                                                 | `Venda`                   |
| `Venda`              | Mensagens + snapshot anterior + saídas acima                                                                 | Modo pré-venda vs pedido ativo, **slots**, estágio, faltantes, **pedidoConfirmado** (booleano ou equivalente) | `ContextoResposta`        |
| `ContextoResposta`   | Saída de `Venda` + memória de curto prazo                                                                    | Texto/estrutura para o LLM + **próxima ação** priorizada                                                      | `SugestaoWhatsApp`        |
| `SugestaoWhatsApp`   | Pacote acima + persona única + RAG opcional ([rag/spec.md](../rag/spec.md))                                  | Orquestra chamada ao modelo; aplica **PortaoEnvio**                                                           | UI / canal de envio       |
| `RegistrarPedido`    | Pedido confirmado (estrutura mínima: cliente, itens com ids/preços snapshot, logística, totais, observações) | **Persiste** pedido; falha explícita se obrigatório e dados insuficientes                                     | — (ou eventos downstream) |
| `Pagamentos`         | Identificador do pedido + evidência (manual ou API futura)                                                   | Atualiza estado de pagamento                                                                                  | Financeiro (opcional)     |

## Agentes (chamadas LLM)

- **A1 — Geração:** uma chamada principal para texto da resposta; persona+regras no *system*; contexto vindo de `ContextoResposta` + chunks RAG quando ativo.
- **A2 — Juiz (opcional):** avaliação/guarda para **modo automático** ou métricas; não é necessário para o MVP de sugestão assistida.

## PortaoEnvio (assistido vs automático)

- **Padrão:** sugestão exibida; **humano** envia (alinhado a [Sugestão com histórico (RAG)](#sugestão-com-histórico-rag)).
- **Automático:** somente se **explicitamente** habilitado (toggle/botão) **e** **PortaoEnvio** passar (regras determinísticas na ZenSpec de `SugestaoWhatsApp`: pedido claro, dados críticos resolvidos, match de produto acima de limiar, etc., a definir).
- **Se** PortaoEnvio falhar **então** degradar para sugestão assistida ou pedir confirmação extra — sem envio silencioso inseguro.

## ZenSpecs filhas (criar/atualizar na pasta `Specs/atendimento/`)

Nomes de ficheiro em infinitivo, completando “Este programa existe para ___”:

| Ficheiro sugerido                          | Programa                                   |
| ------------------------------------------ | ------------------------------------------ |
| `identificar-cliente.zenspec.md`           | `IdentificarCliente`                       |
| `produtos-preco-e-estoque.zenspec.md`      | `Produtos`                                 |
| `promocoes-do-periodo.zenspec.md`          | `Promo`                                    |
| `perfil-factual-do-cliente.zenspec.md`     | `Perfil`                                   |
| `atualizar-contexto-de-venda.zenspec.md`   | `Venda`                                    |
| `preparar-contexto-de-resposta.zenspec.md` | `ContextoResposta`                         |
| `orquestrar-sugestao-whatsapp.zenspec.md`  | `SugestaoWhatsApp` (+ PortaoEnvio + A1/A2) |
| `registrar-pedido-obrigatorio.zenspec.md`  | `RegistrarPedido`                          |
| `confirmar-pagamento.zenspec.md`           | `Pagamentos`                               |

## Escopo fora (desta secção)

- Implementação concreta em TypeScript (caminhos de src).
- Contrato de API de módulo financeiro externo.
- Definição do schema físico de `Order`/`Purchase` além do mínimo citado (fica nas filhas).
- Substituição do RAG: o gestor **consome** o RAG existente, não o redefine.

## Lógica — regra de ouro

- **Se** `Venda` determinar **pedido confirmado** segundo regras da filha **e** dados mínimos para `RegistrarPedido` estiverem satisfeitos **então** **`RegistrarPedido` deve executar com sucesso** antes de considerar o fluxo de venda fechado no sistema (pode ser no mesmo tick que o envio da mensagem de confirmação ou imediatamente após, conforme ZenSpec filha; não pode ficar “só no ar”).
- **Se** `Produtos` devolver baixa confiança no match **então** o fluxo de sugestão **não** deve afirmar produto/preço como fato sem confirmação (comportamento explícito na filha `Produtos` e `ContextoResposta`).
