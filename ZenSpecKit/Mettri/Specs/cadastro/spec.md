# Cadastro

Panorama Zen: [ZenSpec.md](../../../ZenSpecKit/ZenSpec.md).

Este domínio é a **fonte de verdade** do cliente e do perfil operacional interno; ver secções **19–21**. O módulo Atendimento consome esses dados por leitura (ver [../atendimento/spec.md](../atendimento/spec.md)).

---

# 1. Intenção

Permitir que um usuário execute um processo explícito e auditável que:

1. Analisa uma amostra determinística de conversas existentes no `MessageDB`.

2. Gera um “conceito de mapeamento” aprovado explicitamente pelo usuário.

3. Processa conversas selecionadas.

4. Registra compras válidas no `PurchaseDB`.

5. Produz relatório final auditável com contadores consistentes.

6. **(Evolução)** Mantém ficha de cliente e perfil operacional sob contrato único (`ClientDB`, `PurchaseDB`, `CustomerProfileDB`), consumíveis pelo Atendimento e pelo pipeline comercial.

### Objetivo mensurável

Após execução completa e não cancelada:

- Para cada compra detectada com `date` válida:
  
  - Existe exatamente um registro correspondente em `PurchaseDB`.

- O relatório final contém:
  
  - `totalChatsProcessed`
  
  - `totalPurchasesPersisted`
  
  - `totalErrors`

- `totalPurchasesPersisted ≥ 0`

- Nenhuma compra é registrada sem `purchaseDate` válido.

---

## 2. Escopo

Inclui:

- Seleção determinística de amostra de 3 contatos.

- Extração de conceito via OpenAI.

- Aprovação explícita do conceito.

- Processamento em massa de chats.

- Persistência de compras detectadas.

- Progresso e relatório final.

- Cancelamento explícito.

- **Ownership de dados de cliente** (cadastro oficial, compras, perfil operacional inferido) e contratos das ZenSpecs filhas em `Specs/cadastro/` (secção 21).

Não inclui:

- Alterações automáticas sem aprovação.

- Correção automática de dados inválidos retornados pela IA.

- Execução automática em background.

- Garantia de completude semântica da detecção.

---

## 3. Non-goals

- Não substituir fluxo manual de registro.

- Não editar compras já existentes.

- Não deduzir compras implícitas sem evidência textual.

- Não corrigir datas ambíguas.

- Não persistir conceito automaticamente para uso futuro fora da sessão ativa.

- Não tornar o Atendimento fonte de verdade de `ClientDB` ou `CustomerProfileDB` (escrita via programas do Cadastro; ver secção 19).

---

## 4. Entidades Envolvidas

### 4.1 MessageDB

Fonte de mensagens por `chatId`.

### 4.2 PurchaseDB

Destino das compras detectadas e histórico transacional usado no perfil operacional (compras manuais e `AI_DETECTED`).

### 4.3 ClientDB

Fonte de verdade do **cadastro oficial** do cliente (identidade, nomes, telefones, endereço, notas). Leitura/escrita via programas do domínio Cadastro ou fluxos que delegam a eles.

### 4.4 CustomerProfileDB

Armazenamento do **perfil operacional inferido** (`CustomerOperationalProfile`, secção 20): segmentos, confiança, preferências derivadas de fatos. Não substitui `ClientDB`; em conflito prevalece dado oficial.

### 4.5 API key e canal de rede (OpenAI)

- **Chave API OpenAI:** informada pelo usuário na UI (estado inicial); opcionalmente persistida em `chrome.storage.local` (chave `mettri:openai:apiKey`). Não é persistida fora da sessão sem ação explícita de "Salvar chave".
- **Chamadas à API:** o painel roda no contexto MAIN da página (content script); a CSP do WhatsApp bloqueia `fetch` direto para `api.openai.com`. As requisições são feitas via **bridge** (MettriBridge, `net.fetch`) → **service worker** (NET_FETCH). O service worker executa o `fetch` e devolve a resposta.
- **Headers no Worker:** a Fetch API em `WorkerGlobalScope` exige que os valores dos headers sejam **ISO-8859-1**. No handler NET_FETCH do background, os valores são sanitizados (remover code points > 255) antes do `fetch`.
- **Modelo:** `gpt-4o-mini` (ou equivalente configurável).
- **Persistência da chave:** ao acionar "Salvar chave", o painel grava `mettri:openai:apiKey` via bridge; se o bridge estiver indisponível ou ocorrer erro, o painel mantém a chave apenas em memória e exibe feedback visual de falha.

### 4.6 MappingSession

Objeto de controle do processo.

Campos obrigatórios:

- `status`: ENUM (ver seção 8)
- `selectedSampleChatIds`: string[3]
- `conceptText`: string | null
- `totalChatsToProcess`: number
- `totalChatsProcessed`: number
- `totalPurchasesPersisted`: number
- `totalErrors`: number
- `cancelRequested`: boolean

---

## 5. Entradas

### 5.1 Para carregar amostra

- Lista de contatos com:
  
  - `chatId`
  
  - `messageCount`

### 5.2 Para análise da amostra

- Exatamente 3 `chatId`

- Para cada `chatId`:
  
  - Até 50 mensagens
  
  - Ordenadas por timestamp ascendente

### 5.3 Para mapeamento em massa

- Lista de todos `chatId` com `messageCount ≥ 1`

- Para cada `chatId`:
  
  - Até 150 mensagens
  
  - Ordenadas por timestamp ascendente

- `conceptText` aprovado

---

## 6. Saídas

### 6.1 Conceito

Objeto:

- `conceptText`: string
- `examplePayloads`: array

### 6.2 Resultado final

- `totalChatsProcessed`: number
- `totalPurchasesPersisted`: number
- `totalErrors`: number
- `cancelled`: boolean

---

## 7. Regras

### 7.1 Seleção da amostra

1. Obter todos os contatos com `messageCount ≥ 1`.

2. Ordenar por `messageCount` descendente.

3. Selecionar os 6 primeiros.

4. Se total < 3 → bloquear processo.

5. Inicialmente selecionar os 3 primeiros.

6. Se usuário desmarcar um:
   
   - Substituir pelo próximo da lista não selecionado.
   
   - Manter exatamente 3 selecionados.

---

### 7.2 Análise da amostra

Se `selectedSampleChatIds.length ≠ 3` → bloquear.

Para cada chat:

- Buscar até 50 mensagens.

- Montar transcript determinístico.

- Enviar à OpenAI com instrução fixa.

Se OpenAI retornar erro → `status = ERROR_SAMPLE`.

Se resposta válida → armazenar `conceptText`.

---

### 7.3 Aprovação

Somente após evento explícito de aprovação:

Se `conceptText != null` AND usuário confirma →  
`status = CONCEPT_APPROVED`.

Sem esse estado → mapeamento em massa é proibido.

---

### 7.4 Mapeamento em massa

Pré-condições:

- `status = CONCEPT_APPROVED`

- `cancelRequested = false`

Para cada `chatId`:

1. Se `cancelRequested = true` → interromper loop.

2. Buscar até 150 mensagens.

3. Montar transcript.

4. Enviar para OpenAI solicitando formato:
- `purchases`: array de `{ date: ISO-8601 string, value: number | null, items: string[] | null, notes: string | null }`
5. Se resposta inválida → incrementar `totalErrors` e continuar.

6. Para cada item:
   
   - Se `date` inválida → incrementar `totalErrors`.
   
   - Se válida → chamar `addPurchase`.

7. Incrementar `totalChatsProcessed`.

---

### 7.5 Persistência

Para cada compra válida:

- `addPurchase({ chatId, purchaseDate: Date(date), value: value ≥ 0 ? value : undefined, items, notes, source: 'AI_DETECTED' })`

O PurchaseDB aceita `source: 'MANUAL' | 'AI_DETECTED'`; compras mapeadas por este fluxo usam `AI_DETECTED` para auditoria.

Se `addPurchase` falhar → incrementar `totalErrors`.

---

### 7.6 Cancelamento

Se usuário acionar cancelamento:

- `cancelRequested = true`

- Não processar novos chats.

- Compras já persistidas permanecem.

- Resultado final deve indicar `cancelled = true`.

---

## 8. Estados

- IDLE
- SAMPLE_LOADING
- SAMPLE_READY
- SAMPLE_ANALYZING
- CONCEPT_READY
- CONCEPT_APPROVED
- MAPPING_RUNNING
- CANCELLED
- COMPLETED
- ERROR_SAMPLE
- ERROR_MAPPING

---

## 9. Eventos

- LOAD_SAMPLE
- SELECT_SAMPLE
- ANALYZE_SAMPLE
- APPROVE_CONCEPT
- REFUSE_CONCEPT
- START_MAPPING
- CANCEL_MAPPING
- SAMPLE_ANALYSIS_FAILED
- MAPPING_FAILED
- MAPPING_FINISHED

---

## 10. Invariantes

1. Nunca registrar compra sem `purchaseDate` válido.

2. `selectedSampleChatIds.length = 3` quando em análise.

3. `totalChatsProcessed ≤ totalChatsToProcess`.

4. `totalPurchasesPersisted ≥ 0`.

5. Cancelamento não remove compras já persistidas.

6. Nenhum chat é processado mais de uma vez por execução.

7. Toda falha incrementa `totalErrors`.

---

## 11. Edge Cases

- Menos de 3 chats → processo bloqueado.

- OpenAI retorna JSON inválido → erro contabilizado.

- OpenAI retorna purchases vazio → apenas contabiliza chat processado.

- Falha de rede → erro contabilizado.

- Cancelamento durante chamada OpenAI → resultado ignorado.

- Chat sem mensagens → não incluído.

- `value < 0` → ignorar campo.

- `items` não array → ignorar campo.

- **Bridge indisponível** (painel em MAIN world sem `window.MettriBridge`) → exibir mensagem orientando aguardar sincronização e tentar novamente.

- **Header com caractere não ISO-8859-1** (ex.: chave API colada com caractere invisível) → no service worker, sanitizar valores dos headers (code points ≤ 255) antes do `fetch`; se a chave ficar inválida, a API pode responder 401.

---

## 12. Critérios de Aceitação

1. Não é possível iniciar mapeamento sem aprovação explícita.

2. Cancelamento interrompe novos chats.

3. Resultado final sempre contém contadores coerentes.

4. Nenhuma compra sem `purchaseDate` válido é persistida.

5. Cada chat é processado no máximo uma vez por execução.

6. Erros não interrompem execução total.

7. Estados seguem transições válidas.

---

## 13. Integrity Report

### Ambiguidade detectada

Nenhuma.

### Regras implícitas

Todas formalizadas.

### Estados silenciosos

Não há.

### Conflitos

Nenhum identificado.

### Falta de rastreabilidade

Cada ação altera estado ou contador.

### Violação de determinismo

Nenhuma.

### Violação de separação de camadas

Core definido sem UI.

---

## 14. Interface visual (UI)

Título da seção: **Mapear compras já existentes**.

A seção pode ficar no topo da área de Cadastro ou em uma aba dedicada (ex.: "Cadastro" com sub-abas "Clientes" | "Mapear compras já existentes"), conforme layout geral do produto.

### 14.1 Estado 1 — Inicial

```
┌─────────────────────────────────────────────────────────────────┐
│  Mapear compras já existentes                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Use uma amostra de conversas para o sistema aprender como       │
│  seus clientes pedem e quais dados usar no registro de compras.  │
│                                                                  │
│  ┌──────────────────────────────────────┐                       │
│  │  Carregar amostra de contatos         │                       │
│  └──────────────────────────────────────┘                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

- Texto explicativo curto.
- **Campo para chave API OpenAI** (opcional; permite salvar em storage para não digitar de novo) e botão "Salvar chave".
- Ao clicar em "Salvar chave":
  - Se campo vazio → exibir mensagem de erro abaixo do botão (sem chamar storage).
  - Se bridge indisponível ou `storage.set` falhar → exibir mensagem de erro clara ("aguarde o painel ficar sincronizado" ou texto derivado da falha).
  - Se gravação bem-sucedida → exibir mensagem de sucesso abaixo do botão ("Chave salva com sucesso neste navegador.").
- Um botão: **"Carregar amostra de contatos"**.

### 14.2 Estado 2 — Amostra carregada (escolher 3)

```
┌─────────────────────────────────────────────────────────────────┐
│  Mapear compras já existentes                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Selecione 3 contatos com mais conversas para análise.            │
│  Se desmarcar um, outro contato entra no lugar.                  │
│                                                                  │
│  ☑ Maria Silva (124 msgs)                                        │
│  ☑ João Santos (98 msgs)                                         │
│  ☑ Ana Costa (87 msgs)                                           │
│                                                                  │
│  ┌──────────────────────────────────────┐                       │
│  │  Analisar amostra                     │                       │
│  └──────────────────────────────────────┘                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

- Lista com checkbox por contato; exibir `chatName` e quantidade de mensagens.
- Manter sempre 3 itens na lista; ao desmarcar, o próximo do pool (4º, 5º…) aparece no lugar do desmarcado.
- Botão **"Analisar amostra"** habilitado quando exatamente 3 estiverem selecionados.

### 14.3 Estado 3 — Analisando

```
┌─────────────────────────────────────────────────────────────────┐
│  Mapear compras já existentes                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Analisando 3 conversas… (cerca de 30 msgs de cada)              │
│  ████████████████░░░░░░░░                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

- Mensagem de progresso e barra indeterminada ou determinada (se a API permitir).
- Sem botões de ação até concluir.

### 14.4 Estado 4 — Relatório

```
┌─────────────────────────────────────────────────────────────────┐
│  Mapear compras já existentes                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Como seus clientes costumam pedir                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Clientes pedem por item e quantidade; às vezes mandam     │   │
│  │ áudio. Valor combinado no chat ou enviado depois.         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Dados que usaremos no registro de compra                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • Data: da mensagem onde o pedido ficou claro             │   │
│  │ • Valor: quando mencionado em R$                            │   │
│  │ • Itens: lista do que foi pedido                          │   │
│  │ • Notas: opcional                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Exemplo (1 de 3 analisadas):                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ { "date": "2025-02-10", "value": 45, "items": ["X", "Y"] }│   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌────────────────────┐  ┌────────────────────────────┐         │
│  │ Refazer amostra    │  │ Está bom, mapear em todos   │         │
│  └────────────────────┘  │ os chats                    │         │
│                          └────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

- Bloco **"Como seus clientes costumam pedir"**: texto retornado pela OpenAI.
- Bloco **"Dados que usaremos no registro de compra"**: resumo (data, valor, itens, notas) e, se disponível, 1–2 exemplos em JSON no formato addPurchase.
- Dois botões: **"Refazer amostra"** (volta ao estado 2) e **"Está bom, mapear em todos os chats"** (dispara mapeamento em massa).

### 14.5 Estado 5 — Mapeando todos os chats

```
┌─────────────────────────────────────────────────────────────────┐
│  Mapear compras já existentes                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Mapeando compras em todos os chats…                              │
│  Conversas analisadas: 12 / 47                                   │
│  ████████████░░░░░░░░░░░░░░░░                                    │
│                                                                  │
│  [ Cancelar ]                                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

- Contador "Conversas analisadas: X / Y" e barra de progresso.
- Botão **"Cancelar"** para interromper (não adicionar mais compras; as já persistidas permanecem).

### 14.6 Estado 6 — Concluído

```
┌─────────────────────────────────────────────────────────────────┐
│  Mapear compras já existentes                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Mapeamento concluído.                                            │
│                                                                  │
│  • 47 conversas analisadas                                      │
│  • 23 compras registradas                                        │
│  • 0 erros                                                       │
│                                                                  │
│  ┌──────────────────────────────────────┐                       │
│  │  Mapear de novo                      │                       │
│  └──────────────────────────────────────┘                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

- Resumo: total de conversas analisadas, total de compras registradas, quantidade de erros (ex.: datas inválidas, falha de API).
- Botão **"Mapear de novo"** retorna ao estado 1 (ou estado 2 se quiser reutilizar amostra).

---

## 15. Regras e validações (UI)

- **Amostra:** mínimo 3 contatos selecionados para "Analisar amostra"; cada um deve ter ao menos 1 mensagem no MessageDB.
- **Conceito:** não rodar "Mapear em todos os chats" sem que o usuário tenha aprovado o relatório (estado 4 → "Está bom, mapear em todos os chats").
- **addPurchase:** mesmo contrato do spec de atendimento: `chatId` e `purchaseDate` obrigatórios; `purchaseDate` deve ser `Date` válido; `value` se presente deve ser ≥ 0.
- **Datas inválidas:** se a IA retornar data que não parseia para `Date` válido, não chamar addPurchase para esse item; registrar em contador de erros e seguir.
- **API key:** se ausente ou inválida, exibir mensagem clara e não chamar OpenAI.
- **Salvar chave:** "Salvar chave" nunca falha silenciosamente; sempre exibe mensagem de sucesso ou de erro abaixo do botão correspondente.

---

## 16. Edge cases (UI)

- Nenhum contato com mensagens → ao carregar amostra, exibir "Nenhum contato com mensagens no banco" e não exibir lista.
- Menos de 3 contatos no total → exibir os disponíveis e desabilitar "Analisar amostra" até haver 3 (ou permitir 1 ou 2, conforme decisão de produto).
- Falha na chamada OpenAI (conceito) → exibir erro e permitir "Tentar de novo" ou "Carregar amostra de contatos" de novo.
- Falha em um chat durante mapeamento em massa → registrar erro, incrementar contador de erros, seguir para o próximo chat.
- Usuário cancela no meio do mapeamento → parar loop; compras já gravadas permanecem; exibir "Mapeamento cancelado. X compras foram registradas até o momento."

---

## 17. Onde implementar (referência)

- **UI da seção:** módulo em `src/modules/cadastro/purchase-mapping/` (panel com 6 estados), exposto como submódulo de Cadastro; navbar com botão Cadastro → `cadastro.purchase-mapping`.
- **Lógica:** `src/modules/cadastro/purchase-mapping/mapping-service.ts` usa `messageDB`, `purchaseDB` e, para OpenAI, **bridge** (`window.MettriBridge.netFetch`) em vez de `fetch` direto (painel em MAIN world). O bridge envia `NET_FETCH` ao service worker; o background executa o `fetch` e sanitiza headers para ISO-8859-1 antes de chamar a API.
- **PurchaseDB:** schema em [src/storage/purchase-db.ts](src/storage/purchase-db.ts) com `source: 'MANUAL' | 'AI_DETECTED'`; compras deste fluxo usam `source: 'AI_DETECTED'`.
- **Navegação:** botão Cadastro na barra lateral; título da seção "Mapear compras já existentes".

---

## 18. Critérios de aceitação (resumo)

- Usuário consegue carregar amostra, ver 3 contatos (com substituição ao desmarcar), analisar e ver relatório.
- Usuário consegue aprovar o relatório e rodar "Mapear em todos os chats" com progresso visível.
- Compras detectadas são persistidas via `purchaseDB.addPurchase` e ficam consultáveis como "última compra" (ex.: atendimento).
- Erros de API ou de parse são tratados sem quebrar o fluxo; resultado final exibe totais e erros.
- Cancelamento interrompe o mapeamento; compras já salvas permanecem.

---

## 19. Cliente (fonte de verdade no Cadastro)

Esta feature existe para que o sistema tenha uma ficha única e auditável do cliente, sem espalhar escrita de dados por múltiplos módulos.

### Conceito

`cadastro` é o domínio dono dos dados de cliente.  
`atendimento` consome e exibe, mas não vira fonte de verdade.

### Lógica

#### Pipeline & fluxos

```
UI Cadastro / importações / mapeamento  →  CadastroClienteOrchestrator  →  ClientDB / PurchaseDB / CustomerProfileDB
```

| Programa | Recebe | Faz | Manda para |
| --- | --- | --- | --- |
| `CadastroClienteOrchestrator` | intenção (upsert cliente, compra, perfil) + `deps` agrupadas | roteia para `persistirClienteOficial`, `atualizarPerfilOperacionalCliente` ou gravação de compra conforme regra | stores canónicas |
| `persistirClienteOficial` | payload validado + `deps` | grava/atualiza `ClientDB` | — |
| `atualizarPerfilOperacionalCliente` | sinais + `deps` | grava/atualiza `CustomerProfileDB` | — |
| `fornecerFichaClienteParaAtendimento` | `chatId` + `deps` | lê stores e devolve visão agregada | chamador (ex.: provider Atendimento) |

Contratos fechados (entrada, saída, erros) vivem **só** nas ZenSpecs filhas da secção 21; a spec mãe não duplica campos finos.

#### Contrato agregado (visão de domínio)

Objeto lógico `FichaClienteAtendimento` (saída de `fornecerFichaClienteParaAtendimento`): agrega cadastro oficial (`ClientDB`), últimas compras relevantes (`PurchaseDB`) e `CustomerOperationalProfile` quando existir. Campos alinhados à secção 20 e à filha [fornecer-ficha-cliente-para-atendimento.zenspec.md](fornecer-ficha-cliente-para-atendimento.zenspec.md).

Erros comuns:

- `INVALID_INPUT` → `chatId` ou payload obrigatório inválido.
- `STORE_ERROR` → falha em persistência ou leitura de dependência.

#### Ownership (onde cada dado mora)

- `ClientDB`:
  - identidade e cadastro base (`nomeConfiavel`, telefones, aliases, endereço, notas).
- `PurchaseDB`:
  - compras (`MANUAL` e `AI_DETECTED`) e sinais transacionais.
- `CustomerProfileDB` (novo, interno):
  - perfil operacional inferido (não psicológico), com versionamento e `confidence`.

#### Regras

- **Se** um campo for cadastral oficial **então** gravar em `ClientDB`.
- **Se** um campo representar compra/valor/data de compra **então** gravar em `PurchaseDB`.
- **Se** um campo for inferido de comportamento/preferência **então** gravar em `CustomerProfileDB`.
- **Ritmo de atualização do perfil:** preferir atualização incremental no **fim do turno** (`turn_end`) e permitir reprocessamento assíncrono por evento de compra (`purchase_event`) ou agendado (`scheduled`), sem travar a resposta do Atendimento.
- **Se** `atendimento` editar dado de cliente **então** deve chamar ação de `cadastro` (nunca gravar direto em store local da UI de atendimento).
- **Se** `confidence` do perfil inferido estiver abaixo do limiar da versão **então** mostrar como sugestão interna, sem afirmação categórica ao cliente.
- **Se** houver conflito entre dado oficial e inferido **então** prevalece o oficial (`ClientDB`), mantendo trilha de auditoria.

#### Edge cases (Se X -> Y)

- `chatId` vazio -> rejeitar com `INVALID_INPUT`.
- Cliente sem cadastro, mas com histórico de mensagens -> criar perfil parcial com `cadastroUtil = false`.
- Perfil sem sinais suficientes -> persistir estado mínimo com `confidence` baixo.
- Falha ao gravar perfil inferido -> não bloquear gravação de cadastro oficial.

#### Critérios de aceitação

- Atendimento consegue montar a ficha do cliente só por leitura do domínio Cadastro.
- Um mesmo `chatId` mantém consistência entre dados oficiais e dados inferidos.
- Campos inferidos podem evoluir sem quebrar contratos de compra/cadastro oficial.

### Escopo fora

- Perfil psicológico.
- Classificação sensível (saúde, religião, política, etnia, etc.).
- Decisão automática irreversível sem validação humana.

---

## 20. Contrato inicial de perfil operacional (interno)

Metáfora: é um "painel de bordo" do cliente, não um diagnóstico da pessoa.

`CustomerOperationalProfile`:

- `chatId: string`
- `segmentos: string[]`
- `confiancaPerfil: number` (`0..1`)
- `nomeConfiavel?: string`
- `cadastroUtil?: boolean`
- `comportamento?: { janelaAtiva?: 'manha' | 'tarde' | 'noite'; frequenciaContato7d?: number }`
- `historico?: { diasDesdeUltimaCompra?: number | null; compras90d?: number; ticketMedioFaixa?: 'baixo' | 'medio' | 'alto' }`
- `preferenciasProduto?: string[]`
- `preferenciasLogistica?: string[]`
- `sensibilidadeOferta?: 'baixa' | 'media' | 'alta'`
- `proximidade?: { score?: number; banda?: 'frio' | 'morno' | 'quente'; lastRecomputeReason?: 'turn_end' | 'purchase_event' | 'scheduled'; lastRecomputeAtIso?: string }`
- `rfm?: { recenciaDias?: number; frequencia30d?: number; monetario30d?: number; bandaRecencia?: string; bandaFrequencia?: string; bandaMonetario?: string; score?: number }`
- `updatedAtIso: string`
- `modelVersion: string`

Regra de uso: este perfil é interno e explicável; cada campo deve ser rastreável a fatos observáveis (mensagens, compras, cadastro e regras versionadas).

**Metodologia de apoio (opcional, não obrigatória no MVP):** enriquecimento por **RFM** (Recência, Frequência, Monetário) e scores de propensão versionados; sempre com `confiancaPerfil` e rastreio da regra que produziu o número.

---

## 21. ZenSpecs filhas (`Specs/cadastro/`)

| Ficheiro | Programa |
| --- | --- |
| [persistir-cliente-oficial.zenspec.md](persistir-cliente-oficial.zenspec.md) | `persistirClienteOficial` |
| [atualizar-perfil-operacional-do-cliente.zenspec.md](atualizar-perfil-operacional-do-cliente.zenspec.md) | `atualizarPerfilOperacionalCliente` |
| [fornecer-ficha-cliente-para-atendimento.zenspec.md](fornecer-ficha-cliente-para-atendimento.zenspec.md) | `fornecerFichaClienteParaAtendimento` |

Orquestração: `CadastroClienteOrchestrator` compõe estes programas conforme gatilho; contrato do orquestrador pode ser filha futura se necessário.
