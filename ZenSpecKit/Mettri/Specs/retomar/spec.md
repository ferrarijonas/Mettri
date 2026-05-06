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
  max: integer
}
```

**Invariantes:**

- Ordenado crescente.
- Não sobreposto.
- As quatro faixas têm **teto finito** na implementação canónica: a 4.ª faixa termina em **8× o tempo base** da régua (mesma família de multiplicadores 1×, 2×, 3,5×, 5,5×). Constante de implementação: `RETOMAR_LAST_BAND_END_MULTIPLIER = 8` em `inactive-days.ts`.
- Valores de referência (tipo de relação → última faixa):
  - **Frequente** (base 21): … **[116, 168]** dias.
  - **Pontual** (base 44): … **[242, 352]** dias.
  - **Sazonal** (base 74): … **[407, 592]** dias.
  - **Personalizado** (intervalo `X`): 4.ª faixa até **`floor(8 × X)`** dias.

**Acima do teto da 4.ª faixa:** nenhuma faixa contém `daysInactive` → contato **EXCLUÍDO** do motor (fim orgânico do funil; campanhas para ultra-inativos, se existirem, são outro fluxo).

**Nota:** Compatível com a estrutura `ReguaRange` de `inactive-days.ts`.

#### 4.5 minDistance

Número inteiro ≥ 1

Representa dias mínimos entre mensagens enviadas.

**Montagem da entrada `lastOutgoingByContact`:** o painel funde MessageDB, `retomarLastOutgoingAt_*` em `chrome.storage` e, quando falta dado para um chat, fallback ao Store do WhatsApp. Ver `elegibilidade-last-outgoing.zenspec.md`.

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
E daysInactive <= range[i].max
```

Então:

```
rangeIndex = i
```

Se nenhuma faixa corresponder (incl. inatividade **acima do teto** da 4.ª faixa) → EXCLUIR.

#### 6.4 Regra de Progressão por Contador

- Se `contadorAtual = 4` → EXCLUIR (já coberto em 6.1; desistente).

**Primeiro contacto Retomar no chat (`contadorAtual = 0`):**

- Não exigir `rangeIndex = 0`. O contato é elegível em **qualquer** `rangeIndex` válido (0–3) calculado em 6.3.
- **Motivo:** importação de listas ou primeira entrada na régua com compra/atividade antiga: a inatividade pode cair logo na 2.ª, 3.ª ou 4.ª faixa; ainda assim a **primeira** mensagem Retomar deve usar o **ciclo/copy correspondente a essa faixa** (coluna “Primeira/Segunda/…” na UI = faixa de dias, não “tentativa número N” isolada do tempo).

**Já houve pelo menos um envio Retomar (`contadorAtual ∈ {1,2,3}`):**

- Se `rangeIndex ≠ contadorAtual` → EXCLUIR.
- **Motivo:** a progressão na régua exige que a faixa de dias atual **coincida** com o último ciclo já enviado antes de oferecer o próximo envio alinhado a essa etapa.

**Resumo:** `contadorAtual = 0` → qualquer faixa válida; `contadorAtual ∈ {1,2,3}` → obrigatório `rangeIndex = contadorAtual`.

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

**Caso 4b — inatividade acima do teto da 4.ª faixa**

- Se `daysInactive` for maior que `ranges[3].max` → EXCLUIR (sem `rangeIndex`).

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

**Cenário 7 — Primeiro Retomar com inatividade já na 3.ª ou 4.ª faixa**

Dado:

- contador = 0
- daysInactive dentro de `range[2]` ou `range[3]` (ex.: lista importada com “Último Pedido” antigo)

Então:

→ contato **retornado** com o `rangeIndex` correspondente (2 ou 3), desde que respeitadas 6.1, 6.5 e demais regras.

### 10. Notas de implementação

**Fonte da data de referência (plugável):**

- O painel expõe um **seletor** para o usuário escolher: "Última mensagem", "Última compra" ou **"Última compra (importar arquivo)"**. O adaptador monta `lastActivityByChat` conforme a opção escolhida.
- Por **última mensagem:** o mapa é montado a partir de MessageDB (ex.: `getLastIncomingByContact()` → usar `lastIncomingAt` como `date`).
- Por **última compra:** o mapa é montado a partir de PurchaseDB (última compra ACTIVE por chat → usar `purchaseDate` como `date`). Contatos sem compra não entram no mapa e portanto não entram no Retomar.
- Por **última compra (importar arquivo):** o mapa é montado a partir do **último ficheiro importado e persistido** para a conta (`accountId`). Enquanto esta opção estiver selecionada, esse snapshot é a **fonte de verdade** para a `referenceDate` de cada contato no Retomar: **não** atualiza sozinho com novas mensagens ou novas compras no app até o utilizador **importar outro ficheiro** (substitui o snapshot). Persistência mínima do snapshot na bridge/storage: **7 dias** (evita reimportar diariamente).
- **Formato do export analisado** (ex.: `Lista_ClientesInativos_*.xlsx`, `Clientes Inativos.xlsx`, folha única): colunas `Nome`, `Telefone`, `Último Pedido` (datetime); colunas extra (ex.: `Cód.`, `Qtd. Pedidos`, `Valor Pedidos`, `Unidade`, `Ticket Médio`) são **ignoradas** pelo motor. **Cabeçalho:** a primeira linha da folha pode ser um **título** (ex.: “Clientes Inativos”); o parser **procura nas primeiras ~40 linhas** a linha cujo cabeçalho contém uma coluna de telefone reconhecível (`Telefone`, `Tel`, `Celular`, `WhatsApp`, etc.) e usa essa linha como cabeçalho. **Identificação:** extrair só dígitos de `Telefone` e resolver `chatId` (ex. `...@c.us`) via **aliases BR** alinhados a `normalizePhoneDigitsWithAliases` / contactos conhecidos no MessageDB (ou cadastro). **Duplicados:** várias linhas com o mesmo telefone → uma entrada por telefone com **`Último Pedido` = data mais recente**; linha com data vazia em grupo duplicado participa só se for a única ou perder para datas válidas. Linhas **sem** `Último Pedido` válido **não** entram no mapa de atividade (nem em “com chat”). **Sem match** de `chatId` → ignorar linha e acumular **avisos** (contagem e exemplos). Script de análise: `scripts/analyze_lista_clientes_inativos_xlsx.py`.

**Afastamento:** dias desde a data de referência da fonte escolhida (mensagem, compra no PurchaseDB ou compra no snapshot importado).

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

Cada chamada é uma faixa de dias: do marco da chamada até o marco da próxima menos 1 dia; a **última** faixa tem **teto** em **8×** o tempo base (não é aberta até infinito).  
(Ex.: tempo mínimo 14 → 1ª: 14–27; 2ª: 28–48; 3ª: 49–76; 4ª: **77–112** dias; acima de 112 → fora da régua automática.)

E o sistema nunca envia uma nova mensagem antes de respeitar novamente o mesmo tempo mínimo desde a última mensagem enviada.

---

# Ciclos de Contato

## Conceito

**Ciclos de contato** são as quatro tentativas de retomada por contato: 1ª, 2ª, 3ª e 4ª (última). Cada uma **alinha-se a uma faixa de dias** na régua (rangeIndex 0, 1, 2, 3). O painel mostra contagens por faixa (rótulos “Primeira …”, “Segunda …”, etc.).

## Lógica

### Contador por chat

- **0** = nenhuma mensagem de retomar enviada (próxima é a 1ª **neste fluxo**).
- **1, 2 ou 3** = último ciclo enviado foi a 1ª, 2ª ou 3ª (próxima é a seguinte).
- **4** = quarto ciclo já enviado sem compra (desistente; contato sai do fluxo até nova compra).

**Motor + contador:**

- Com **contador 0**, o motor aceita **qualquer** `rangeIndex` válido: o contato aparece na **linha do ciclo que corresponde à sua faixa de dias** (ex.: importação com compra há ~130 dias em régua **Frequente** → cai na 4.ª faixa e aparece em “Última tentativa”; acima do **teto** da 4.ª faixa → fora do motor).
- Com **contador 1, 2 ou 3**, o motor **só** inclui o contato se `rangeIndex === contador` (progressão: já recebeu a chamada alinhada à faixa anterior e a inatividade atual está na faixa “esperada” para o próximo passo).

### Quem lê o contador

- **Motor:** usa `contadorByChat` com a regra 6.4 (contador 0 = qualquer faixa; contador 1–3 = `rangeIndex` obrigatoriamente igual ao contador).
- **Painel Retomar:** obtém o mapa e monta a lista por ciclo (Primeira, Segunda, Terceira, Última), com contagens e seleção.
- **Atendimento:** exibe “Ciclo atual” (1ª, 2ª, 3ª ou 4ª) para o chat aberto, quando aplicável.

### Quem escreve o contador

- **Painel Retomar:** ao enviar uma mensagem de retomar, atualiza o contador para o número do ciclo enviado (1, 2, 3 ou 4). No 4º ciclo, além de setar 4, move o contato para a etiqueta “Inativos” (comportamento já descrito em Desistência).
- **Sistema externo (ex.: detecção de compra):** ao registrar nova compra do contato, zera o contador desse chat (reset para 0), permitindo reentrada na régua.

O motor não persiste nem altera o contador; apenas consome o valor recebido.

### Ciclo de vida

- Início: contador = 0 → elegível na **faixa onde `daysInactive` cair** (1.ª a 4.ª), respeitando teto da 4.ª faixa e demais regras do motor.
- Após enviar 1ª: contador = 1 → elegível para envio da 2.ª **quando** `rangeIndex = 1` (e regras de distância mínima).
- Idem para 2ª → 3ª e 3ª → 4ª (`rangeIndex` alinhado ao contador).
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

### Métricas de resposta (este ciclo de produto)

**Objetivo no painel:** mostrar, por ciclo (e por variante A/B quando o modo existir na UI), quantos envios Retomar houve, quantos geraram resposta do cliente, a taxa de resposta e o tempo médio até a primeira resposta.

**Janela padrão:** últimos **7 dias**, contados pelo **timestamp do envio** da mensagem Retomar (metadado `retomarMeta` + hora gravada no messageDB).

**Métricas ativas neste ciclo:** `sentCount`, `respondedCount`, `responseRate`, `avgResponseTimeMinutes`.  
**Regra de resposta (negócio):** conta como respondido um envio que tenha **pelo menos uma mensagem recebida do cliente (incoming)** **depois** desse envio **no mesmo `chatId`**; usa-se **só a primeira** dessas mensagens para o tempo.  
**Regra de tempo:** para cada envio respondido, delta = instante da primeira resposta menos instante do envio; `avgResponseTimeMinutes` é a média desses deltas **em minutos**, apenas sobre envios respondidos.

**Contrato técnico (entradas, saídas, erros, edge cases, critérios de aceitação):** ZenSpec filha  
`ZenSpecKit/Mettri/Specs/retomar/calcular-metricas-retomar.zenspec.md` — programa `retomarMetricsResolver`.  
A spec mãe não duplica assinatura nem regras determinísticas desse programa.

**Exibição quando não há média:** se não houver nenhum envio respondido na janela (`respondedCount === 0`), o painel exibe o tempo médio como **vazio** (rótulo "—" / ausência de número); o valor canônico no contrato é **`null`** para `avgResponseTimeMinutes` nesse caso — **não** usar `0`, para não confundir com "respondeu na hora".

**Desativado neste ciclo (não calcular nem exibir):** taxa de **abertura** (leitura), **engajamento** agregado genérico, **conversão** por compra, e colunas de **compras** nas métricas do bloco — até nova spec.

**Decisão de produto (reações):** métricas por **reação** (emoji, etc.) entram quando o modelo de mensagem passar a **capturar** reação de forma confiável no messageDB; até lá ficam fora do escopo.

### Catálogo de respostas e export diário local (JSONL)

Esta feature existe para não perder o aprendizado do Retomar quando o banco local for limpo/corrompido e para alimentar IA/relatórios com dados estruturados.

**Conceito (negócio):**

- Sempre que houver um envio Retomar que recebeu resposta, gerar um **evento de outcome** (par envio-resposta).
- Persistir esse outcome localmente e exportar para **arquivo JSONL local**, um arquivo por conta.
- O arquivo é append-only (vai crescendo) para manter histórico contínuo.

**Escopo deste ciclo (MVP):**

- Exportar somente outcomes **respondidos** (não exportar envios sem resposta neste ciclo).
- Incluir dados úteis para IA e análise: ids, tempos, ciclo, variante, campanha, conta, `chatId`/número quando disponível e textos com truncagem.
- Formato obrigatório: **JSONL** (1 linha = 1 outcome).
- Um arquivo por conta (`accountId`).
- Agenda automática: dias úteis, na primeira abertura do WhatsApp após 10:00 (hora local), com app ativo.

**Comportamento desejado:**

- Fonte operacional continua no `messageDB` (envios com `retomarMeta` + incoming capturado).
- Export diário escreve no arquivo local os outcomes novos desde o último export.
- Em falha de escrita, não perder o estado no banco operacional; reprocessar no próximo ciclo automático.

**Objetivo de produto:**

- Base “IA friendly” para o agente aprender padrões que funcionam (RAG/few-shot).
- Base pronta para relatório (Excel/BI) sem depender de leitura crua de todo o histórico.

**Contrato técnico (programa):** ZenSpec filha  
`ZenSpecKit/Mettri/Specs/retomar/exportar-outcomes-retomar.zenspec.md` — programa `retomarOutcomeExporter`.

### Máquina A/B

A **máquina A/B** é um módulo de responsabilidade única: receber a lista de `chatId` selecionados e os textos A e B, e devolver uma lista pronta para o **serviço de envio já existente**.

**Entrada:** `chatIds: string[]`, `textA: string`, `textB: string`.

**Saída:** Lista de pares `{ chatId, text, variant: 'A' | 'B' }` (ou equivalente), onde cada contato recebe exatamente um texto, com cerca de 50% em A e 50% em B (split determinístico ou aleatório, a definir).

**Comportamento:** O módulo não envia mensagens nem grava em banco; apenas calcula quem recebe qual texto. O painel (ou orquestrador) itera essa lista, chama o serviço de envio existente para cada item e, após cada sucesso, registra o envio no messageDB incluindo o campo `variant`.

**Nota:** O serviço de envio (ex.: `sendMessageService.sendText(chatId, text)`) permanece único; a máquina A/B apenas "prepara o cardápio" para ele.

### Orquestração de envio em massa (motor natural)

Fila persistida, ritmo conservador (limites hora/dia + atrasos) e **gate** antes de cada envio: confirma contador e **última mensagem nossa lida só no WhatsApp Web** (poka-yoke contra loop). Ver `orquestracao-envio-retomar.zenspec.md`.

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
- **Métricas (este ciclo):** bloco expandível dentro do detalhe. Seletor de período com **padrão 7 dias** (alinhado à janela definida em **Métricas de resposta**). Conteúdo mínimo: `sentCount`, `respondedCount`, `responseRate`, `avgResponseTimeMinutes` conforme `retomarMetricsResolver` (`calcular-metricas-retomar.zenspec.md`). Quando o modo A/B estiver ativo na UI, repetir as **mesmas** quatro métricas **por variante** (A e B). **Não** incluir neste ciclo: compras, conversão, abertura, engajamento agregado, "melhor texto/horário" — até spec futura. Tempo médio sem respostas na janela: exibir vazio (—), valor `null` no contrato. Recolher/expandir por clique no título do bloco.

### Estados visuais

- **Linha selecionada/ativa:** fundo verde claro; as demais sem destaque.
- **Contagem:** sempre à direita do nome do ciclo, no formato "N pessoas" (0 ou mais).
- **Ícone:** círculo verde à esquerda do nome em cada linha (e na sublinha quando existir).

### Hierarquia

- Título da seção em evidência.
- Cada ciclo = uma linha clicável; ao clicar, a linha fica em destaque e o detalhe (Texto A/B, IA, Enviar) é inserido logo abaixo dessa linha, empurrando as demais para baixo.
- Engrenagem só para esta seção (ciclos), separada do restante do painel.

### Container Respostas Agênticas

Esta feature existe para que o utilizador **gere e envie** mensagens de retomada **por contato** (baseline LLM + contexto do histórico) **sem** usar o painel legado Texto A/B do mesmo ciclo, mantendo **independência** do acordeão **Ciclos de contato**.

#### Conceito (negócio)

Segundo bloco colapsável no Retomar: mesma **réua de quatro ciclos** e mesmas **contagens** que o legado, mas o detalhe expandido é só **UI agêntica** (checkbox, textarea, gerar, enviar). O **tom e as regras de copy** do baseline vivem no ficheiro editorial `prompts/agente_retomar.md`; o contrato técnico de geração está na ZenSpec filha `gerar-mensagem-baseline.zenspec.md`.

#### Lógica (pipeline)

```
motor de elegíveis  →  retomarContextResolver  →  suggestRedacaoRetomar (baseline)  →  textarea
                              ↑                           ↑
                        messageDB                  prompts/agente_retomar.md
```

| Programa                                                 | Recebe                                     | Faz                            | Manda para                                |
| -------------------------------------------------------- | ------------------------------------------ | ------------------------------ | ----------------------------------------- |
| `retomarContextResolver`                                 | `chatIds`, `accountId`, `messageDB`        | `clientText`, `attendantText?` | ver `retomar-context-resolver.zenspec.md` |
| `suggestRedacaoRetomar` (+ `buildAgenteRetomarMessages`) | fill derivado do resolver + painel + `.md` | Chama LLM; devolve string      | textarea do painel                        |

**ZenSpecs filhas:** `retomar-context-resolver.zenspec.md` (contexto); `gerar-mensagem-baseline.zenspec.md` (baseline + prompt).

**Regras adicionais (alinhadas ao código):**

- **Ciclo numérico para a LLM:** `cycleIndex` **1–4** = índice da linha aberta no bloco agêntico (0–3) **+ 1**, alinhado ao contador/`retomarMeta.cycleIndex` no envio.
- **Envio agêntico:** variante **A** fixa (sem A/B neste bloco). Mesma fila / `retomarMeta` / contador / 4ª → Inativos que o envio Retomar já descrito no módulo.
- **Simular envio** (modo teste global do painel): **não** dispara envio em massa pelas Respostas Agênticas; UI mostra aviso e **Enviar** fica desativado nesse modo (evita colisão com o fluxo de teste do legado).
- **Remover da vista (Ocultar):** só sessão atual; não altera motor, contador nem MessageDB; o contacto deixa de aparecer na lista **e** o rascunho em memória desse contacto é descartado na implementação atual.
- **Regenerar:** por linha; pode ser usado com o contacto marcado; falha LLM → log/erro explícito, textarea preservada.
- **Contraste dos textareas:** no painel sobre páginas escuras (ex. WhatsApp), os campos de rascunho usam **cores explícitas** no CSS do painel para leitura — detalhe de implementação em `tailwind-input.css` / classes do painel, não altera regras de negócio.

**Dados:** mesma fonte de elegíveis que o motor / mesmo ciclo; contagens alinhadas ao legado.

**Independência:** expandir ou abrir acordeão em **Respostas Agênticas** **não** abre nem altera o acordeão de **Ciclos de contato** (e reciprocamente).

**Escopo fora desta seção:** modelo LLM, temperatura e `max_tokens` numéricos (config de implementação; referência na ZenSpec de baseline).

#### Interface

**Título visível do bloco:** Respostas Agênticas. **Regra:** segundo bloco colapsável no painel Retomar; **não** altera regras nem conteúdo de `### Container Ciclos de Contato` (nem `### Conteúdo`, `### Conteúdo expandido (ao clicar no ciclo)` nem `### Estados visuais`).

- **Indicador do prompt embutido:** logo abaixo do título **Respostas Agênticas**, texto discreto (ex.: tipografia pequena, cor secundária) com o nome do ficheiro `agente_retomar.md` e a **data/hora da última modificação desse ficheiro no momento do build** do bundle (gravada quando o esbuild lê o `.md`, alinhada ao conteúdo embutido). Tooltip ou equivalente pode repetir o instante em ISO (UTC) para conferência.

**Casca:** paridade com `### Container Ciclos de Contato` / `### Conteúdo` / `### Estados visuais` — título + expandir/colapsar; **sem engrenagem** nesta secção (requisito: omitir). **Conteúdo fechado:** quatro linhas verticais (1ª / 2ª / 3ª / Última), contagem **"N pessoas"**, ícone à esquerda, **mesma hierarquia visual que Ciclos de contato**; linha secundária de campanha quando houver paridade com o legado.

**Conteúdo expandido (diferente do legado):**

- **Se** o usuário clicar numa das quatro linhas **então** acordeão: linha em destaque + painel **logo abaixo dessa linha**, empurrando as linhas seguintes (mesmo comportamento que em `### Conteúdo expandido (ao clicar no ciclo)`, linhas 577–578).
- **Dentro desse painel:** só UI agêntica — **sem** Texto A, Texto B, radio Só A / Só B / A/B, **sem** botão legado **"Enviar para M pessoas"** nem **Simular** só deste bloco.
- **Gerar textos para selecionados**; **Enviar** único (rótulo pode incluir contagem qualificada); lista com **checkbox**; **textarea** sob o nome; **Regenerar** por linha; **Ocultar** = remover da vista (sessão).
- **Gerar:** para cada linha marcada, **agente de redação Retomar** (`retomarContextResolver` + `suggestRedacaoRetomar` + `prompts/agente_retomar.md`) preenche o textarea; após gerar, texto **sempre editável**.
- **Enviar:** para cada linha **marcada** com textarea `trim() !== ''`, **mesmo** envio Retomar do painel (contador, distância mínima, `retomarMeta`, 4ª → Inativos). Marcada com textarea vazio: não envia. **Se** nenhuma linha qualificar **então** não chama envio; **Enviar** desativado ou mensagem explícita curta.
- **Falha:** por item; textarea preservada; sem sucesso silencioso. **Gerar** em lote: falha numa linha **não** impede as outras.

**Ordem no painel:** bloco **Respostas Agênticas** **abaixo** de **Ciclos de contato** no layout.

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

---

## Retomar V1 (Sensei) — contexto para baseline e juiz (RAG oculto)

O slice `Retomar V1` usa `retomarContextResolver` para montar o contexto mínimo por chat, que alimenta a geração de mensagem baseline (texto visível na UI) e o “juiz” do experimento oculto (RAG vs baseline).

O contrato técnico de montagem do `contextText` (formato fixo com `Cliente:` e `Atendente:` opcional) é definido na ZenSpec:

- `ZenSpecKit/Mettri/Specs/retomar/retomar-context-resolver.zenspec.md` (`retomarContextResolver` / RT1)

A geração baseline usada nas **Respostas Agênticas** (LLM + ficheiro `prompts/agente_retomar.md`) está em:

- `ZenSpecKit/Mettri/Specs/retomar/gerar-mensagem-baseline.zenspec.md` (`suggestRedacaoRetomar` e `buildAgenteRetomarMessages`)

O cálculo das métricas de resposta do Retomar (painel, janela temporal, taxas) está em:

- `ZenSpecKit/Mettri/Specs/retomar/calcular-metricas-retomar.zenspec.md` (`retomarMetricsResolver`)

O contrato do catálogo/export diário local de outcomes respondidos (JSONL por conta) está em:

- `ZenSpecKit/Mettri/Specs/retomar/exportar-outcomes-retomar.zenspec.md` (`retomarOutcomeExporter`)

Regra de alto nível:

- O texto **enviado e editável na UI é sempre baseline**.
- O RAG fica **oculto**, servindo apenas para avaliação do experimento, conforme o contrato do módulo RAG:
  - `ZenSpecKit/Mettri/Specs/rag/spec.md`
