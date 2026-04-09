# Gerar mensagem baseline de retomada (`suggestRedacaoRetomar`)

Esta feature existe para que o painel **Respostas Agênticas** obtenha **uma string de mensagem** por contato, alinhada ao **baseline de marca** (tom e regras no ficheiro de prompt), sem depender de RAG visível.  
Metáfora: o programa é o **roteirista** que lê o libreto fixo (`.md`) + ficha do cliente e entrega **só a fala**.

---

## Conceito

O baseline é a mensagem **editável** que o utilizador pode enviar. A geração usa **dois insumos**: (1) dados estruturados vindos do `retomarContextResolver` (`clientText`, `attendantText?`) e do painel (`firstName`, `cycleIndex` 1–4); (2) **prompt** externo em `prompts/agente_retomar.md` (secções `## SYSTEM` e `## USER` em **linha própria** — ver edge case de parsing).

O ficheiro `.md` é a **fonte editorial** do SYSTEM e do template USER; o código substitui placeholders e chama o provedor LLM.

---

## Pipeline & fluxos

```
retomarContextResolver  →  montagem user (placeholders)  →  suggestRedacaoRetomar  →  texto baseline
         ↑                           ↑
   messageDB + accountId      prompts/agente_retomar.md
```

| Programa | Recebe | Faz | Manda para |
| -------- | ------ | --- | ----------- |
| `retomarContextResolver` | `chatIds`, `accountId`, `messageDB` | `clientText`, `attendantText?`, `contextText` | próximo passo (montagem + LLM) |
| `buildAgenteRetomarMessages` | fill: `firstName`, `cycleIndex`, `lastIncomingFromClient`, `lastRetomarSentText`, texto do `.md` | Monta `system` + `user` para a API | `suggestRedacaoRetomar` |
| `suggestRedacaoRetomar` | `MettriBridgeClient`, fill (mesmos campos) | Chama OpenAI; devolve string trimada | UI (textarea) |

**Linha do fluxo (este programa):**

```
fill + agente_retomar.md  →  buildAgenteRetomarMessages  →  suggestRedacaoRetomar  →  string
```

---

## Lógica

### Contrato — `buildAgenteRetomarMessages` / preenchimento

**Entrada (fill):**

- `firstName`: `string` — pode ser vazio; na mensagem USER usa-se sentinela `(não informado)` se vazio.
- `cycleIndex`: `number` — inteiro **1–4** (ciclo Retomar); valores fora do intervalo são **clampeados** para 1–4 antes de substituir `{cycleIndex}`.
- `lastIncomingFromClient`: `string` — deve refletir `clientText` do `retomarContextResolver`; se vazio após trim, sentinela `(vazio)` no USER (e o orquestrador do painel **não** deve chamar a LLM se não houver cliente legível — ver resolver).
- `lastRetomarSentText`: `string` — deve refletir `attendantText` do resolver; se vazio após trim, sentinela `(nenhuma ainda)` no USER.

**Saída:**

- `system`: `string` — corpo da secção `## SYSTEM` do `.md` (sem o título).
- `user`: `string` — corpo da secção `## USER` com `{firstName}`, `{cycleIndex}`, `{lastIncomingFromClient}`, `{lastRetomarSentText}` substituídos.

**Erros:**

- Ficheiro `.md` sem secções `## SYSTEM` / `## USER` válidas em **linha própria** → falha explícita ao parsear (não seguir em silêncio).

### Contrato — `suggestRedacaoRetomar`

**Entrada:**

- `bridge`: `MettriBridgeClient` — chave API via storage; `netFetch` para OpenAI.
- Mesmo `fill` que acima.

**Saída:**

- `string` — conteúdo da mensagem assistant; trimado.

**Erros:**

- Chave API ausente → mensagem de erro explícita ao utilizador (não retornar string vazia sem aviso).
- Resposta HTTP não OK ou sem `choices[0].message.content` → throw / erro explícito.

**Config de implementação (referência; não é regra de negócio):**

- Modelo: `gpt-4o-mini`; `temperature` e `max_tokens` conforme código atual (mensagens curtas).

### Regras

- O texto do SYSTEM e o template USER vivem em **`prompts/agente_retomar.md`** (raiz do repositório, ao mesmo nível que `ZenSpecKit/`).
- Cabeçalhos de secção no `.md` devem ser **exatamente** uma linha `## SYSTEM`, `## USER` ou `## OUTPUT`; conteúdo após `## OUTPUT` não é enviado à API. **Não** usar a substring `## USER` dentro de parágrafos (ex. negrito), senão o parser pode falhar — ver edge case.
- Mapeamento painel → fill: `lastIncomingFromClient` ← `clientText`; `lastRetomarSentText` ← `attendantText` ou `''`; `cycleIndex` ← índice da faixa aberta no bloco agêntico **+ 1** (0–3 → 1–4).

### Edge cases

- `chatId` sem mensagem recebida legível no resolver → **não** entra em `suggestRedacaoRetomar`; painel regista aviso por item.
- Falha LLM num item de lote **Gerar** → log/erro por item; outros itens continuam (orquestração no painel).
- `.md` com `## USER` apenas dentro de texto corrido (ex. ``**## USER**``) → parser não deve tratar como secção; se não existir secção real → erro explícito.

### Critérios de aceitação

- Dado fill válido e `.md` válido, `user` não contém `{firstName}` / `{cycleIndex}` / etc. literais não substituídos.
- Dado API key ausente, chamada falha com mensagem clara.
- Dado resolver sem `clientText` para o chat, geração agêntica **não** chama a LLM para esse chat.

### Escopo fora

- Ajuste fino de copy/tom de marca dentro do SYSTEM (revisão de produto no `.md`, não nesta ZenSpec linha a linha).
- RAG, juiz A/B, variantes A/B na mensagem agêntica (envio usa variante fixa **A** no pipeline Retomar — ver spec do módulo).

---

## Interface

Esta ZenSpec não descreve layout; a UI do bloco **Respostas Agênticas** está em `spec.md` → `### Container Respostas Agênticas`.
