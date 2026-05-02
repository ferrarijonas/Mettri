# Resolver plano de prompt (`resolverPlanoPrompt`)

Esta feature existe para, dado um **`ModoLLM`**, devolver um **`PromptPlan`** — ordem e política de junção das camadas — **sem** ler ficheiros nem substituir placeholders.  
Metáfora: o **receituário** diz *quais folhas* entram e *se colam por cima ou no fim*; não escreve a frase final.

---

## Conceito

A **estratégia** de prompt é totalmente determinada pelo modo (+ opções opcionais).  
O compositor downstream só executa o plano + `FatosLLM`.

---

## Pipeline & fluxos

```
ModoLLM (+ opcoes?)  →  resolverPlanoPrompt  →  PromptPlan
```

| Programa | Recebe | Faz | Manda para |
| -------- | ------ | --- | ----------- |
| `resolverPlanoPrompt` | `ModoLLM`, `opcoes?` | Devolve lista ordenada de camadas | `comporMensagensLLM` |

---

## Lógica

### Contrato — entrada

- `modo`: `ModoLLM` — obrigatório; valor registado em [spec.md](spec.md).
- `opcoes`: `Record<string, string | number | boolean>` — opcional; chaves definidas por modo (ex. versão de template).

### Contrato — saída `PromptPlan`

- `camadas`: array ordenado de objetos **CamadaPlano**:

| Campo | Tipo | Obrigatório | Significado |
| ----- | ---- | ----------- | ----------- |
| `id` | `string` | sim | Identificador estável da camada (telemetria, testes). |
| `role` | `system` \| `user` | sim | Mensagem da API a que se aplica. |
| `merge` | `append` \| `replace` | sim | `replace` substitui o acumulado **daquele role** por este bloco (após resolver template); `append` concatena com separador documentado na implementação (ex. `\n\n`). |
| `templateId` | `string` | sim | Chave para resolver texto-fonte no compositor (ficheiro, bundle, etc.). |

**Invariantes:**

- Ordem do array é a ordem de aplicação **por role**: ao processar, o compositor mantém acumuladores separados para `system` e `user`.
- Para um mesmo `role`, sequência `replace` → `append` → `replace` é válida: cada passo atualiza o acumulado daquele role conforme `merge`.

### Erros

- `modo` desconhecido ao resolver → falha explícita.
- `opcoes` inválidas para o modo (ex. chave obrigatória ausente) → falha explícita.

### Plano canónico v1 — `retomar_baseline`

Exatamente **duas** camadas:

1. `{ id: "retomar_system", role: "system", merge: "replace", templateId: "agente_retomar_md_system" }`
2. `{ id: "retomar_user", role: "user", merge: "replace", templateId: "agente_retomar_md_user" }`

**Significado dos `templateId`:**

- `agente_retomar_md_system` — corpo da secção `## SYSTEM` de `prompts/agente_retomar.md` (sem linha de cabeçalho).
- `agente_retomar_md_user` — corpo da secção `## USER` do mesmo ficheiro, com placeholders `{firstName}`, `{cycleIndex}`, `{lastRetomarSentText}`, `{conversationThread}` (revisão editorial v1 de `prompts/agente_retomar.md`).

### Edge cases

- Modo reservado sem plano definido → erro explícito (não devolver plano vazio).
- `opcoes` extra ignoradas: **se** o modo não reconhecer chave → falha explícita **ou** ignorar chaves não listadas no modo — escolher uma política na implementação e documentar; spec exige **determinismo**.

### Critérios de aceitação

- Dado `modo=retomar_baseline`, saída tem exatamente duas camadas na ordem acima com `merge=replace` e `templateId` corretos.
- Dado `modo` inexistente, operação falha com erro explícito.
- Programa não executa HTTP.

### Escopo fora

- Resolução de ficheiro `.md` e substituição — [compor-mensagens-llm.zenspec.md](compor-mensagens-llm.zenspec.md).
- Definição de `SituacaoLLM` — [rotear-modo-llm.zenspec.md](rotear-modo-llm.zenspec.md).
