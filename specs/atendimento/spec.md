# Painel atendimento




---

# Sugestão com histórico (RAG)

## Conceito

Uma mesangem pronta que vem de um sistema RAG, baseada no último turno de conversas.

## Interface

Container dedicado à sugestão de resposta gerada com base no histórico (RAG). Objetivo: exibir uma mensagem pronta para o atendente usar e enviar no WhatsApp, com opção de visualizar detalhes técnicos da sugestão.

### Container principal

- Bloco com título "Resposta sugerida".
- À direita do título: ícone de seta (expandir/colapsar) e, opcionalmente, botão de informação no mesmo padrão do painel (tamanho/estilo dos botões de ação secundários, com `title`/tooltip "Usa conversas passadas como base").
- Conteúdo visível quando expandido.

### Conteúdo (modo padrão)

- **Área de texto:** exibe a sugestão gerada pelo RAG, `<textarea>`
- **Estado vazio (antes de gerar):** placeholder "Clique em 'Gerar sugestão' para usar conversas passadas como base." ou similar.
- **Estado carregando:** spinner ou skeleton no lugar do texto; botão "Gerar sugestão" desativado.
- **Estado com sugestão:** texto preenchido; botão "Usar na conversa") habilitado.

### Ações

- **"Gerar sugestão"** (ou "Gerar resposta"): dispara o fluxo RAG (conversa atual → embedding → busca no banco vetorial → prompt → modelo → sugestão). Preenche a área de texto com o resultado.
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

****Posição no painel:** Este bloco "Sugestão com histórico" fica no painel de Atendimento (terceira coluna), em posição definida no layout (ex.: acima do bloco "Registro de compra"). Mesma hierarquia visual e tipografia do restante do painel.

## Lógica

Esta feature existe para que o atendente consiga responder mais rápido usando conversas passadas como base, sem precisar ler o histórico inteiro manualmente.

### Fluxo `rag:generate` + indexação

```
Primeiro uso: Botão "Gerar sugestão" (UI)  →  ação `rag:generate`  →  `orquestrador_indexacao_rag` (prepara índice em memória)  →  `orquestrador_consulta_rag`  →  UI (sugestão)
Demais usos: Botão "Gerar sugestão" (UI)  →  ação `rag:generate`  →  `orquestrador_consulta_rag`  →  UI (sugestão)
```

#### Regras

- **Se** o usuário clicar em "Gerar sugestão" **e** não houver chat ativo **então** a ação `rag:generate` falha com mensagem de erro na UI e nenhum estado do bloco RAG é alterado.
- **Se** for a primeira vez que o usuário clica em "Gerar sugestão" **então** o módulo Atendimento chama `orquestrador_indexacao_rag` para preparar o índice vetorial em memória antes de chamar `orquestrador_consulta_rag`.
- **Se** a indexação (`orquestrador_indexacao_rag`) falhar **então** o bloco RAG volta ao estado normal (sem loading), não chama `orquestrador_consulta_rag` e a UI exibe uma mensagem de erro explícita.
- **Se** o usuário clicar em "Gerar sugestão" com chat ativo **então** o bloco RAG entra em estado de carregamento e exibe indicador de loading no lugar do `<textarea>`.
- **Se** `orquestrador_consulta_rag` retornar `suggestion` e `chunks` **então** o bloco RAG preenche o `<textarea>` com `suggestion`, atualiza a linha "Baseado em N conversas similares" com `N = chunks.length` e volta ao estado normal (sem loading).
- **Se** `orquestrador_consulta_rag` falhar (erro em embeddings, busca ou modelo) **então** o bloco RAG volta ao estado normal (sem loading), mantém o texto anterior (se houver) e a UI exibe uma mensagem de erro explícita.

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
