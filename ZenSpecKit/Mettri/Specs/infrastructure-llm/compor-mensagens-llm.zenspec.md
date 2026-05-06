# Compor mensagens LLM (`comporMensagensLLM`)

Esta feature existe para transformar **`PromptPlan` + `FatosLLM`** no par **`system`** + **`user`** enviável à API, resolvendo templates e aplicando `append` / `replace`.  
Metáfora: o **montador** junta as folhas do receituário e preenche os espaços em branco com dados do cliente.

---

## Conceito

O compositor **não** escolhe modo nem chama rede.  
Lê `templateId` de cada camada, obtém texto-fonte (ex. parse de `prompts/agente_retomar.md`), aplica **substituição de placeholders** nos templates `user` (e em `system` se o plano incluir placeholders), e aplica **merge** por `role`.

---

## Pipeline & fluxos

```
PromptPlan + FatosLLM  →  comporMensagensLLM  →  { system, user }
```

| Programa | Recebe | Faz | Manda para |
| -------- | ------ | --- | ----------- |
| `comporMensagensLLM` | `PromptPlan`, `FatosLLM` | Resolve templates; merge; substitui placeholders | `executarChamadaOpenAI` |

---

## Lógica

### Contrato — entrada

- `plano`: `PromptPlan` — conforme [resolver-plano-prompt.zenspec.md](resolver-plano-prompt.zenspec.md).
- `fatos`: `FatosLLM` — `Record<string, string>` (valores já normalizados pelo consumidor; sentinelas permitidas quando acordadas).

### Contrato — saída

- `system`: `string` — não vazio após trim **se** o plano define pelo menos uma camada `role=system`.
- `user`: `string` — não vazio após trim **se** o plano define pelo menos uma camada `role=user`.

### Substituição de placeholders

- Formato canónico: `{chave}` no template; substituir por `fatos[chave]`.
- **Se** o template contém `{chave}` e `fatos` não define `chave` → falha explícita (não deixar `{chave}` literal na saída sem erro).
- Chaves em `fatos` não usadas no template → permitido.

### Merge por `role`

- Inicializar `accSystem = ""`, `accUser = ""`.
- Para cada camada em ordem:
  - Resolver texto da camada a partir de `templateId` (ver mapeamento abaixo).
  - Aplicar substituição de placeholders no texto resolvido.
  - **Se** `role === "system"` **e** `merge === "replace"` → `accSystem = texto`; **se** `append` → `accSystem = accSystem + sep + texto` (trim de separador duplo na implementação permitido).
  - Idem para `user` com `accUser`.

Separador `sep` entre appends: `\n\n` (canónico) salvo ZenSpec futura que altere.

### Mapeamento `templateId` v1

| `templateId` | Fonte |
| ------------ | ----- |
| `agente_retomar_md_system` | Corpo exato da secção `## SYSTEM` em `prompts/agente_retomar.md` (cabeçalho `## SYSTEM` em linha própria excluído). |
| `agente_retomar_md_user` | Corpo exato da secção `## USER` (idem). |

Regras de parse de cabeçalhos: mesma convenção que o código legado — linhas exatamente `## SYSTEM`, `## USER` (ver edge cases).

### Fatos mínimos — modo `retomar_baseline` (referência)

Chaves presentes no template `agente_retomar_md_user` v1 (`prompts/agente_retomar.md`):

- `firstName`, `cycleIndex`, `lastRetomarSentText`, `conversationThread`

**Regra:** o conjunto obrigatório de chaves em `fatos` é **exatamente** o conjunto de `{chave}` que aparece no texto resolvido do template; se o editorial acrescentar placeholders, o fornecedor de fatos deve acompanhar.

Valores fora do intervalo (ex. `cycleIndex`) — **clampeamento** recomendado no fornecedor (1–4); comportamento se não clampear: documentar na implementação.

### Erros

- `templateId` desconhecido → falha explícita.
- Ficheiro `.md` inexistente ou sem secção exigida → falha explícita.
- Placeholder sem valor em `fatos` → falha explícita.

### Edge cases

- Plano com zero camadas → falha explícita.
- Secção `## USER` aparece apenas dentro de texto corrido (ex. negrito) → **não** é cabeçalho; parser não encontra secção → erro explícito.
- Template `system` sem placeholders: substituição é no-op.

### Critérios de aceitação

- Dado plano `retomar_baseline` e fatos completos, saída não contém `{firstName}` etc. literais.
- Dado placeholder faltando em `fatos`, operação falha com erro explícito.
- Dado `merge=replace` seguido de `append` no mesmo role, ordem respeitada no resultado final.

### Escopo fora

- Chamada HTTP — [executar-chamada-openai.zenspec.md](executar-chamada-openai.zenspec.md).
- Definição do plano — [resolver-plano-prompt.zenspec.md](resolver-plano-prompt.zenspec.md).
