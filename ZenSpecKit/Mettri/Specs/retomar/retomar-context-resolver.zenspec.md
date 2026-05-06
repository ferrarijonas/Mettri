# Zen Spec Kit — `retomarContextResolver` (RT1)

Esta feature existe para que `retomarBaselineAgent` consiga montar o contexto do cliente (linha `Cliente:` e opcional `Atendente:`) para cada `chatId` sem precisar saber como buscar e filtrar mensagens dentro do `messageDB`.  
Metáfora: `retomarContextResolver` é o detetive que encontra as pistas certas no histórico.

---
## Conceito

O slice `Retomar V1` precisa montar um contexto mínimo por cliente sumido para geração de mensagem baseline e para o “juiz” comparar baseline vs RAG (RAG é escondido na UI nesta fase).  
O contexto do juiz é fixo no formato:
- `Cliente:` última mensagem recebida do cliente (texto legível)
- `Atendente:` última mensagem real de retomar enviada (texto legível)

Regra aceita (quando não existir mensagem real de retomar enviada): se não houver `Atendente:`, o contexto fica **só** com `Cliente:` (sem falhar e sem excluir o contato).

---
## Pipeline & fluxos

```
lista de chatIds + messageDB  →  retomarContextResolver  →  contexts por chatId
```

| Programa | Recebe | Faz | Manda para |
| -------- | ------ | --- | ----------- |
| `retomarContextResolver` | `chatIds`, `accountId` e `messageDB` | Busca última mensagem recebida e última mensagem de retomar enviada; monta `contextText` por chat | `suggestRedacaoRetomar` (Respostas Agênticas), `retomarExperimentOrchestrator` (futuro juiz), etc. |

---
## Lógica

### `retomarContextResolver` com contratos

#### Linha do fluxo

```
lista de chatIds + messageDB  →  retomarContextResolver  →  contextText por chatId
```

#### Contrato

Entrada:
- `chatIds`: `string[]` — lista de chatIds (selecionados como elegíveis por `reactivationEngine`)
- `accountId`: `string` — conta ativa do painel Retomar (para filtrar mensagens de retomar com a mesma conta)
- `messageDB`: `MessageDB` — dependência de leitura do histórico. Usado pelas operações:
  - `getMessages(chatId: string, limit?: number): Promise<CapturedMessage[]>`

Saída:
- `contexts`: `RetomarContext[]`

Onde `RetomarContext` é:
- `chatId`: `string`
- `chatName`: `string`
- `contextText`: `string` — texto no formato:
  - sempre começa com `Cliente: <clientText>`
  - opcionalmente acrescenta `\nAtendente: <attendantText>`
- `clientText`: `string`
- `attendantText?`: `string` (opcional; só existe se houver mensagem real de retomar enviada)

Erros:
- `Erro ao acessar messageDB` → falha explícita.
- `Erro de parâmetro` (ex.: `chatIds` não array / itens vazios) → falha explícita.

#### Regras

R1 — Sem side effects: `retomarContextResolver` só lê `messageDB`.  
R2 — Um contexto por chatId: para cada `chatId` de entrada, tenta montar exatamente 1 contexto.  
R3 — Filtrar mensagem de cliente (`Cliente:`):
  - Considerar apenas mensagens com `isOutgoing === false` e `type === 'text'`.
  - Considerar `text` somente se `text.trim()` não for vazio.
  - Descartar `text` se contiver um “payload técnico” parecido com base64: regex ` /[A-Za-z0-9+/=]{40,}/ `.
  - Escolha: usar a **mais recente** mensagem que passe pelos filtros.
R4 — Filtrar mensagem de retomar (`Atendente:`):
  - Considerar apenas mensagens com `isOutgoing === true` e `type === 'text'`.
  - Exigir que a mensagem tenha `retomarMeta` definido.
  - Exigir que `retomarMeta.accountId === accountId`.
  - Considerar `text` somente se `text.trim()` não for vazio e passar no mesmo critério de legibilidade de R3.
  - Escolha: usar a **mais recente** mensagem que passe pelos filtros.
R5 — Exclusão por ausência de `Cliente:`:
  - Se não existir nenhuma mensagem elegível para `Cliente:` (R3 falha para um chatId), o contexto daquele `chatId` é **excluído** da lista de saída.
R6 — Construção do `contextText`:
  - Sempre produzir `contextText = "Cliente: " + clientText`
  - Se existir `attendantText`, então `contextText += "\nAtendente: " + attendantText`
  - Se não existir `attendantText`, `contextText` contém apenas a linha `Cliente: ...`.
R7 — Ordem de saída:
  - A lista `contexts` preserva a ordem relativa de `chatIds` de entrada, removendo apenas os chatIds excluídos por ausência de `Cliente:`.
R8 — Determinismo:
  - Para as mesmas entradas (`chatIds`, `accountId`) e o mesmo estado de `messageDB`, a saída é idêntica (mesmo texto e mesmo conjunto de chatIds incluídos/excluídos).

#### Edge cases (Se X → Y)

- `messageDB vazio` → `contexts = []`
- `chatId sem mensagens recebidas legíveis` → esse `chatId` é removido da saída
- `chatId tem `Cliente:` mas não tem `Atendente:` (sem mensagem real de retomar enviada)` → `contextText` tem só `Cliente: ...`
- `chatId tem `Atendente:` mas o texto é payload técnico` → `Atendente` é tratado como ausente (context só com `Cliente:`)
- `mensagens ordenadas igual ao retorno de `messageDB.getMessages`` → a mensagem escolhida é sempre a mais recente que passa pelos filtros
- `falha ao ler messageDB` → falha explícita

#### Critérios de aceitação

- Dado `chatIds` e `messageDB` com mensagens válidas, a função retorna `contexts` onde cada item tem `contextText` no formato especificado e `Cliente:` sempre presente.
- Dado `messageDB vazio` → retorna `[]`.
- Dado um `chatId` com nenhuma mensagem recebida legível (R3 não encontra) → esse `chatId` não aparece em `contexts`.
- Dado um `chatId` com `Cliente:` mas sem mensagem real de retomar enviada (`Atendente` ausente) → retorna um contexto com `contextText` contendo somente `Cliente: ...`.

