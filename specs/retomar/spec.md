# Painel Retomar

---

## Cálculo das datas por tipo de relação

Dado um tipo de relação, calcular as 4 datas futuras de retomada.

**Entrada:** Escolha entre 1, 2, 3 ou digite X (customizado).

- 1 = 21 dias  
- 2 = 44 dias  
- 3 = 74 dias  
- 4 = X (valor digitado)

**Cálculo:**

- Data1 = hoje + (valor × 1)  
- Data2 = hoje + (valor × 2)  
- Data3 = hoje + (valor × 3,5)  
- Data4 = hoje + (valor × 5,5)

**Saída:** Data1, Data2, Data3, Data4.

---

## Etiquetas (listas e membros)

O módulo de etiquetas é um conjunto de listas nomeadas. Cada etiqueta tem nome (e no código: id, cor, contagem de membros) e guarda um conjunto de membros (ex.: identificadores de contato/chat).

**Listas:** Criar lista (com nome), Renomear lista, Excluir lista, Listar todas as listas.

**Membros:** Adicionar um membro a uma lista, Remover um membro de uma lista, Saber em quais listas um membro está, Listar os membros de uma lista.

---

# Algoritmo de busca de contatos para retomar conversas

BDD: Dado / Quando / Então.

## Contrato do motor (entrada e saída)

### 1. Objetivo

Definir um motor determinístico de elegibilidade e agrupamento de contatos para o fluxo "Retomar", que:

- Liste apenas contatos com data de referência válida na fonte selecionada.
- Respeite um tempo mínimo de afastamento.
- Adapte o tempo mínimo após ≥2 compras.
- Interrompa definitivamente após 4 tentativas sem compra.
- Reinicie imediatamente após nova compra.

O motor não envia mensagens.  
O motor não altera estado externo.  
O motor apenas calcula elegibilidade e faixa da régua.

### 2. Escopo

**Inclui:**

- Cálculo de dias de inatividade.
- Aplicação da régua proporcional.
- Respeito à distância mínima entre mensagens enviadas.
- Exclusão de contatos inelegíveis.
- Classificação por faixa (rangeIndex 0–3).
- Bloqueio após 4 tentativas.
- Reset lógico após compra.

**Não inclui:**

- Envio de mensagens.
- Persistência de contador.
- Detecção de compra por IA.
- Alteração de etiquetas.
- Cálculo da média entre compras (apenas consome o valor).

### 3. Non-goals

- Não decidir conteúdo da mensagem.
- Não priorizar contatos.
- Não executar side effects.
- Não classificar perfis (Frequente, Pontual, Sazonal).
- Não calcular média histórica (apenas receber valor pronto).

### 4. Entradas

#### 4.1 lastActivityByChat

Mapa:

```
chatId → {
  date: Date,
  chatName: string
}
```

**Regra:**

- `date` é a referência para calcular dias de inatividade (ex.: última mensagem recebida ou data da última compra).
- Quem invoca o motor é que escolhe a fonte (MessageDB ou PurchaseDB).
- Contatos ausentes do mapa são inelegíveis.

**Nota:** A fonte é escolhida externamente (seletor no painel). O motor não conhece a origem da data. Ver seção 10.

#### 4.2 lastOutgoingByContact

Mapa:

```
chatId → {
  lastOutgoingAt: Date
}
```

- Opcional por chat.
- Se inexistente → considerar que nunca enviou.

#### 4.3 contadorByChat

Mapa:

```
chatId → integer (0..4)
```

- Sem entrada → assumir 0.

**Significado:**

- 0 = nenhuma mensagem enviada
- 1–3 = última chamada enviada
- 4 = quarta já enviada (desistente)

#### 4.4 ranges

Array `ReguaRange[4]`

Cada item:

```typescript
{
  min: integer,
  max: integer | Infinity
}
```

**Invariantes:**

- Ordenado crescente.
- Não sobreposto.
- `ranges[3].max` pode ser `Infinity` (faixa aberta).

**Nota:** Compatível com a estrutura `ReguaRange` de `inactive-days.ts`.

#### 4.5 minDistance

Número inteiro ≥ 1

Representa dias mínimos entre mensagens enviadas.

#### 4.6 chatIdsInLists

`Set<chatId>` ou array de chatIds

Se modo de exclusão estiver ativo:

- Se `chatId ∈ chatIdsInLists` → excluir.

### 5. Saídas

Lista de objetos:

```typescript
{
  chatId: string,
  chatName: string,
  daysInactive: integer,
  rangeIndex: integer (0..3),
  phone?: string
}
```

**Ordenação:** decrescente por `daysInactive` (mais "frios" primeiro).

Nunca retornar contato fora de faixa válida.

O painel pode adicionar campos adicionais (ex.: firstName resolvido, status, listIds) após receber essa lista.

### 6. Regras

#### 6.1 Elegibilidade Base

**Regra:** Apenas contatos presentes em `lastActivityByChat` entram no fluxo Retomar.

- Se `chatId` não estiver em `lastActivityByChat` → EXCLUIR (sem data de referência na fonte escolhida).
- Quando a fonte for **última compra**, ausência no mapa implica sem compra registrada.
- Quando a fonte for **última mensagem**, ausência no mapa implica sem mensagem recebida registrada.
- Se `contadorByChat[chatId] = 4` → EXCLUIR (desistente após 4 tentativas).
- Se `chatId ∈ chatIdsInLists` → EXCLUIR (em lista de exclusão).

#### 6.2 Cálculo de Inatividade

```
daysInactive = floor((now - referenceDate) / 1 dia)
```

- Se `daysInactive < 0` → EXCLUIR.

#### 6.3 Identificação da Faixa

Para cada `range i`:

Se:

```
daysInactive >= range[i].min
E (range[i].max === Infinity OU daysInactive <= range[i].max)
```

Então:

```
rangeIndex = i
```

Se nenhuma faixa corresponder → EXCLUIR.

#### 6.4 Regra de Progressão por Contador

Se:

```
rangeIndex ≠ contadorAtual
```

Então EXCLUIR.

**Nota:** O contador marca a última chamada enviada (0 = nenhuma, 1-3 = última chamada, 4 = desistente). O motor só retorna contatos cujo `rangeIndex` corresponda ao contador atual.

#### 6.5 Distância Mínima Entre Mensagens

Se existir `lastOutgoingAt`:

Calcular:

```
daysSinceOutgoing = floor((now - lastOutgoingAt) / 1 dia)
```

Se:

```
daysSinceOutgoing < minDistance
```

Então EXCLUIR.

### 7. Invariantes

- Determinismo: mesmas entradas → mesma saída.
- Nunca modificar dados de entrada.
- Nunca inferir compra (apenas consome dados fornecidos).

### 8. Edge Cases

**Caso 1 — Data futura**

- Se `referenceDate > now` → excluir.

**Caso 2 — ranges malformados**

- Se `ranges.length ≠ 4` → erro explícito.

**Caso 3 — ranges sobrepostos**

- Se `range[i].min ≤ range[i-1].max` → erro explícito.

**Caso 4 — contador > 4**

- Se contador inválido → erro explícito.

**Caso 5 — minDistance ≤ 0**

- Erro explícito.

**Caso 6 — Mudança de minDistance entre execuções**

- Motor não recalcula faixas retroativas.
- Aplicação imediata na próxima execução.

### 9. Critérios de Aceitação

**Cenário 1 — Primeira Mensagem**

Dado:

- contador = 0
- daysInactive = 15
- range[0] = { min: 14, max: 27 }

Então:

→ contato retornado com rangeIndex 0

**Cenário 2 — Ainda Não Atingiu Faixa**

Dado:

- contador = 0
- daysInactive = 10
- range[0] = { min: 14, max: 27 }

Então:

→ contato não retornado

**Cenário 3 — Segunda Mensagem**

Dado:

- contador = 1
- daysInactive dentro de range[1]

Então:

→ contato retornado com rangeIndex 1

**Cenário 4 — Violação de Distância**

Dado:

- daysInactive válido
- daysSinceOutgoing < minDistance

Então:

→ contato não retornado

**Cenário 5 — Desistência**

Dado:

- contador = 4

Então:

→ contato nunca aparece na saída

**Cenário 6 — Nova Compra**

Dado:

- contador resetado para 0
- referenceDate atualizado

Então:

→ fluxo reinicia normalmente

### 10. Notas de implementação

**Fonte da data de referência (plugável):**

- O painel expõe um **seletor** para o usuário escolher: "Última mensagem" ou "Última compra". O adaptador monta `lastActivityByChat` conforme a opção escolhida.
- Por **última mensagem:** o mapa é montado a partir de MessageDB (ex.: `getLastIncomingByContact()` → usar `lastIncomingAt` como `date`).
- Por **última compra:** o mapa é montado a partir de PurchaseDB (última compra ACTIVE por chat → usar `purchaseDate` como `date`). Contatos sem compra não entram no mapa e portanto não entram no Retomar.

**Afastamento:** dias desde a data de referência da fonte escolhida (mensagem ou compra).

**Reset e adaptação:** Quando nova compra é detectada ou média entre compras é calculada, o sistema externo deve atualizar `contadorByChat` e `minDistance` antes de invocar o motor. O motor apenas utiliza os valores recebidos (não calcula média nem reseta contador internamente). O motor assume consistência da entrada.

## Régua de afastamento

Dado que o cliente recebeu a primeira mensagem  
E não realizou nova compra  
Quando atingir o próximo momento da régua baseada no tempo mínimo definido  
Então o sistema envia a próxima mensagem  

A régua é construída assim:

- Primeira mensagem: no tempo mínimo de afastamento  
- Segunda mensagem: no dobro desse tempo  
- Terceira mensagem: três vezes e meia esse tempo  
- Quarta mensagem: cinco vezes e meia esse tempo mais o tempo mínimo  

Cada chamada é uma faixa de dias: do marco da chamada até o marco da próxima menos 1 dia.  
(Ex.: tempo mínimo 14 → 1ª faixa: 14 a 27 dias; 2ª faixa: 28 a 48 dias; 3ª faixa: 49 a 76 dias; 4ª faixa: de 77 até 91 dias)

E o sistema nunca envia uma nova mensagem antes de respeitar novamente o mesmo tempo mínimo desde a última mensagem enviada.

---

# Ciclos de Contato

## Conceito

**Ciclos de contato** são as quatro tentativas de retomada por contato: 1ª, 2ª, 3ª e 4ª (última). Cada ciclo corresponde a uma faixa da régua (rangeIndex 0, 1, 2, 3). O sistema controla por chat qual foi o último ciclo já enviado e só oferece para envio contatos cuja faixa de dias coincida com o próximo ciclo desse contato.

## Lógica

### Contador por chat

- **0** = nenhuma mensagem de retomar enviada (próxima é a 1ª).
- **1, 2 ou 3** = último ciclo enviado foi a 1ª, 2ª ou 3ª (próxima é a seguinte).
- **4** = quarto ciclo já enviado sem compra (desistente; contato sai do fluxo até nova compra).

O motor de elegibilidade recebe o mapa **contadorByChat** como entrada e só retorna contatos em que a faixa atual (rangeIndex) é igual ao contador do chat. Assim, quem está na 1ª faixa de dias e com contador 0 aparece na “Primeira tentativa”; quem está na 2ª faixa e com contador 1 aparece na “Segunda tentativa”, e assim por diante.

### Quem lê o contador

- **Motor:** usa `contadorByChat` para filtrar (regra de progressão: rangeIndex = contador).
- **Painel Retomar:** obtém o mapa e monta a lista por ciclo (Primeira, Segunda, Terceira, Última), com contagens e seleção.
- **Atendimento:** exibe “Ciclo atual” (1ª, 2ª, 3ª ou 4ª) para o chat aberto, quando aplicável.

### Quem escreve o contador

- **Painel Retomar:** ao enviar uma mensagem de retomar, atualiza o contador para o número do ciclo enviado (1, 2, 3 ou 4). No 4º ciclo, além de setar 4, move o contato para a etiqueta “Inativos” (comportamento já descrito em Desistência).
- **Sistema externo (ex.: detecção de compra):** ao registrar nova compra do contato, zera o contador desse chat (reset para 0), permitindo reentrada na régua.

O motor não persiste nem altera o contador; apenas consome o valor recebido.

### Ciclo de vida

- Início: contador = 0 → elegível para 1º ciclo quando entrar na 1ª faixa.
- Após enviar 1ª: contador = 1 → elegível para 2ª quando entrar na 2ª faixa.
- Idem para 2ª → 3ª e 3ª → 4ª.
- Após enviar 4ª: contador = 4 → desistente; não aparece mais na saída do motor até reset.
- Nova compra: contador = 0; data de referência atualizada; fluxo reinicia.

### Nota de implementação

- Store simples por conta: chave `retomarContador_${accountId}`, valor mapa `chatId → últimaChamadaEnviada (1–4)`.
- Persistência via bridge (ex.: chrome.storage). Ao enviar mensagem de retomar, o painel chama `setContador(accountId, chatId, chamada)`; não é necessário escanear histórico de mensagens.

### Entrada na Retomada

Dado que existe um número mínimo de afastamento definido  
E o cliente está há pelo menos esse número de dias sem atividade na fonte selecionada  
Então ele se torna elegível para a primeira mensagem  

Dado que o cliente tem menos dias de afastamento que o mínimo definido na fonte selecionada  
Então ele não entra na retomada  

### Primeira Mensagem

Dado que o cliente está elegível  
Quando atinge o tempo mínimo de afastamento  
Então o sistema envia a primeira mensagem  

### Segunda, Terceira e Quarta Mensagem

Dado que a primeira mensagem foi enviada  
E não houve compra  
Quando o próximo marco proporcional é atingido  
Então o sistema envia a próxima mensagem  

E o sistema nunca envia uma nova mensagem antes de respeitar novamente o tempo mínimo definido.  
O sistema usa um contador para marcar qual foi a última chamada que o cliente teve.

**Nota implementação contador:** Store simples: chatId → últimaChamadaEnviada (1–4). Ao enviar mensagem de retomar, atualizar. Mais robusto que contar mensagens (evita escanear histórico). E‑mail mkt faz o contrário: registra cada envio em log e conta depois; aqui um único campo por contato basta.

### Compra (Reset Real)

Dado que o cliente compra em qualquer momento  
Então o ciclo reinicia imediatamente  
E o contador de tentativas volta para zero 

### Adaptação após Segunda Compra

Antes de duas compras: usa perfis padrão (Frequente, Pontual, Sazonal).

Dado que o cliente realizou pelo menos duas compras  
Quando o sistema calcula o intervalo médio entre elas  
Então esse intervalo passa a ser o novo tempo mínimo de afastamento  

E a régua futura passa a seguir esse novo ritmo  

### Resposta sem Compra

Dado que o cliente responde mas não compra  
Então o ciclo não reinicia  
E o sistema continua seguindo a régua normal  

### Desistência

Dado que quatro mensagens foram enviadas  
E não houve compra  
Então o cliente sai da retomada  

Dado que o cliente sai da retomada  
E não houve compra  
Então ele é movido para uma etiqueta de "Inativos"  

O cliente passa para "Inativos" imediatamente após o envio da 4ª mensagem, sem outro gatilho.  

E não receberá novas mensagens até que compre novamente.

### Reentrada

Dado que um cliente que saiu da retomada realiza uma nova compra  
Quando o sistema calcula a média entre suas compras  
Então usa essa média como novo tempo mínimo  
E coloca-o na chamada apropriada (que pode não ser a 1ª)  

Dado que um cliente que saiu da retomada realiza uma nova compra  
Então ele sai da etiqueta "Inativos" e volta ao sistema normalmente  
E o ciclo reinicia  

### Fonte de Compra por IA (a implementar)

A identificação de compra será feita por IA analisando as mensagens.

## Registro de envios, máquina A/B e sugestão IA

### Registro de envios (messageDB)

Cada envio de mensagem do Retomar (por ciclo, com texto A ou B) deve ser registrado para permitir métricas por ciclo e por variante (A/B). A **fonte única de verdade** para esses registros é o **messageDB**.

**O quê gravar:** Após cada envio bem-sucedido a partir do painel de Ciclos de contato, persistir no messageDB uma entrada de mensagem enviada (outgoing) com **metadados do Retomar** associados: ciclo (1–4), variante (A ou B), campanha (tag do ciclo, se houver), conta (`accountId`), e timestamp.

**Onde:** O schema do messageDB deve permitir metadados opcionais por mensagem (ex.: campo `retomarMeta` ou `context` com `{ cycleIndex, variant, campaignLabel, accountId }`). Se o schema atual não tiver esse campo, estendê-lo sem alterar o contrato existente das demais partes do sistema.

**Quem grava:** O fluxo que chama o serviço de envio (ex.: após sucesso de `sendToClient` ou do handler "Enviar" do ciclo) deve, em um único ponto, chamar a gravação no messageDB com esses metadados. Não duplicar essa informação em outro store.

**Nota:** Assim, métricas "Métricas (este ciclo)" e análises A/B podem ser calculadas a partir do messageDB (filtrar por período, ciclo e variante), sem store separado de envios.

### Máquina A/B

A **máquina A/B** é um módulo de responsabilidade única: receber a lista de `chatId` selecionados e os textos A e B, e devolver uma lista pronta para o **serviço de envio já existente**.

**Entrada:** `chatIds: string[]`, `textA: string`, `textB: string`.

**Saída:** Lista de pares `{ chatId, text, variant: 'A' | 'B' }` (ou equivalente), onde cada contato recebe exatamente um texto, com cerca de 50% em A e 50% em B (split determinístico ou aleatório, a definir).

**Comportamento:** O módulo não envia mensagens nem grava em banco; apenas calcula quem recebe qual texto. O painel (ou orquestrador) itera essa lista, chama o serviço de envio existente para cada item e, após cada sucesso, registra o envio no messageDB incluindo o campo `variant`.

**Nota:** O serviço de envio (ex.: `sendMessageService.sendText(chatId, text)`) permanece único; a máquina A/B apenas "prepara o cardápio" para ele.

### Sugestão IA

O botão "Sugerir com IA" no detalhe do ciclo deve preencher o Texto B a partir do Texto A (e do contexto da campanha, quando existir). Isso é feito por um **módulo único de sugestão**, reutilizável, com contrato estável.

**Entrada:** Objeto com `text` (Texto A), `campaign` (tag da campanha do ciclo, opcional), `relationType` (tipo de relação, opcional). No futuro, outros campos de campanha podem ser acrescentados sem quebrar a assinatura.

**Saída:** Texto sugerido (string) para preencher o Texto B.

**Responsabilidade:** O módulo não conhece Retomar, ciclos nem messageDB; apenas chama o provedor de IA (API, chave configurável) e devolve o texto. Quem invoca (painel Retomar ou outro) passa o contexto e exibe o resultado no campo Texto B.

**Nota:** "Cruzar com campanha" significa passar `campaign` (e demais dados de campanha) na entrada desse módulo; a mesma interface serve hoje e no futuro.

---

## **Interface**

### Container Ciclos de Contato

- Bloco colapsável com título "Ciclos de contato".
- À direita do título: ícone de seta (expandir/colapsar) e ícone de engrenagem (configurações desta seção).

### Conteúdo

Quatro linhas em lista vertical, uma por ciclo:

- Primeira tentativa — indicador circular verde + texto "X pessoas".

- Segunda tentativa — mesmo padrão.

- Terceira tentativa — mesmo padrão; pode ter linha secundária (ex.: "Desconto 25%")     com mesmo indicador.

- Última tentativa — mesmo padrão.

Cada linha pode ter uma linha secundária extra (ex.: campanhas ativas).

### Conteúdo expandido (ao clicar no ciclo)

- Inicialmente nenhum ciclo está aberto; só a lista de quatro linhas é exibida.
- Ao clicar em um ciclo, a linha fica em destaque e o detalhe do ciclo aparece logo abaixo dessa linha, empurrando as linhas seguintes para baixo (acordeão). Clicar de novo na linha ou recolher fecha o detalhe.
- **Modo de envio:** três opções (radio): Só A, Só B, A/B
- **Texto A:** campo editável (texto principal).
- **Texto B:** campo editável; botão "Sugerir com IA" preenche a partir do A (e da campanha ativa, se houver). Campanha ativa: tag na linha do ciclo e no painel quando existir.
- **Pessoas do ciclo:** linha de resumo clicável no formato "N pessoas neste ciclo (M selecionados)" com seta (expandir/recolher). Ao expandir, mostra lista de contatos do ciclo com checkbox por linha (mesmo padrão da seção Pessoas); seleção controla quem entra no envio. Clicar de novo recolhe e volta a mostrar só o resumo.
- **Estado vazio:** se N = 0, mostrar "Nenhum contato elegível neste ciclo no momento." e não exibir lista; botão Enviar desativado.
- **Ações:** botões "Enviar para M pessoas" e "Simular"; Enviar desativado se Texto A vazio ou nenhum selecionado.
- **Métricas (este ciclo):** bloco expandível dentro do detalhe. Conteúdo: seletor de período (ex. 7 dias); quando modo A/B, linhas separadas para variante A e B (envios, respostas, compras e taxas); linha "Melhor: texto/horário". Recolher/expandir por clique no título do bloco.

### Estados visuais

- **Linha selecionada/ativa:** fundo verde claro; as demais sem destaque.
- **Contagem:** sempre à direita do nome do ciclo, no formato "N pessoas" (0 ou mais).
- **Ícone:** círculo verde à esquerda do nome em cada linha (e na sublinha quando existir).

### Hierarquia

- Título da seção em evidência.
- Cada ciclo = uma linha clicável; ao clicar, a linha fica em destaque e o detalhe (Texto A/B, IA, Enviar) é inserido logo abaixo dessa linha, empurrando as demais para baixo.
- Engrenagem só para esta seção (ciclos), separada do restante do painel.

---

# Sistema de apoio do módulo retomar integrado à tela de atendimento

## Etiquetas no Atendimento

Dado que estou com o chat aberto no módulo Atendimento  
Quando eu abrir o painel de Etiquetas  
Então devo ver o mesmo painel de etiquetas do módulo Retomar, com paridade total de UI e comportamento (mesma hierarquia visual, tipografia, tokens, estados, menus e ações).

Dado que o chat atual já pertence a uma ou mais etiquetas  
Quando o painel for renderizado  
Então essas etiquetas já aparecem marcadas como ativas para o chat atual.  
E quando não houver nenhuma ativa, o estado inicial deve indicar claramente "nenhuma ativa".

Dado que eu quero classificar manualmente o chat atual  
Quando eu selecionar ou remover uma etiqueta no Atendimento  
Então a associação do chat na etiqueta é persistida no mesmo storage e na mesma conta (`accountId`) do módulo Retomar  
E a mudança aparece imediatamente no Retomar (fonte única de verdade).

Dado que preciso de uma nova etiqueta  
Quando eu clicar em "Nova lista"  
Então consigo criar uma etiqueta customizada com nome e cor, igual ao fluxo do Retomar.

Dado que uma etiqueta customizada existe  
Quando eu abrir o menu da etiqueta  
Então posso ver membros, renomear e excluir, igual ao Retomar.

Dado que a etiqueta é padrão (Bloqueados, CNPJ, Inativos)  
Quando eu tentar renomear ou excluir  
Então o sistema bloqueia a ação, mantendo as mesmas regras do Retomar.

Dado que Atendimento e Retomar usam o mesmo painel de Etiquetas  
Quando evoluirmos layout ou regra desse painel  
Então a implementação deve ser compartilhada por módulo/componente comum (sem duplicar lógica), para não haver divergência entre telas.

## Contador no Atendimento

Dado que o contato comprou e eu abro o chat dele  
E ele voltou a partir de uma mensagem do retomar  
Quando eu quiser consultar quantas mensagens ele já recebeu  
Então verei nessa tela um registro desse número que é fornecido pelo "Algoritmo de busca de contatos".

**Implementação atual do contador:**  

- Store simples em chrome.storage, via bridge, por conta (`accountId`).  
- Chave: `retomarContador_${accountId}` com o mapa `chatId → últimaChamadaEnviada (1–4)`.  
- Ao enviar uma mensagem de Retomar, o painel atualiza esse campo diretamente (sem escanear histórico).
