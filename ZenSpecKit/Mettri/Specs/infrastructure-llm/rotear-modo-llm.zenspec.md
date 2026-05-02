# Rotear modo LLM (`rotearModoLLM`)

Esta feature existe para traduzir **situação de produto** num **`ModoLLM`** estável, sem conhecer templates nem HTTP.  
Metáfora: o **porteiro** lê o crachá e diz qual **sala** (modo) a visita deve usar.

---

## Conceito

O programa é **puro** relativamente a prompts: só valida campos do descritor e aplica **tabela** domínio + subfluxo (+ flags) → modo.  
Quem conhece botões de UI e nomes de painel é o **chamador**; este programa só exige contrato `SituacaoLLM`.

---

## Pipeline & fluxos

```
SituacaoLLM  →  rotearModoLLM  →  ModoLLM
```

| Programa | Recebe | Faz | Manda para |
| -------- | ------ | --- | ----------- |
| `rotearModoLLM` | `SituacaoLLM` | Valida; mapeia para `ModoLLM` | `resolverPlanoPrompt` |

**Linha do fluxo:**

```
SituacaoLLM  →  rotearModoLLM  →  ModoLLM | erro
```

---

## Lógica

### Contrato — entrada `SituacaoLLM`

- `dominio`: `string` — obrigatório; não vazio após trim.
- `subfluxo`: `string` — obrigatório; não vazio após trim.
- `flags`: `Record<string, string | boolean>` — opcional; chaves e valores definidos pelo consumidor.

### Contrato — saída

- `ModoLLM`: `string` — um dos modos **registados** abaixo.

### Erros

- `dominio` ou `subfluxo` ausente / só espaços → falha explícita.
- Combinação **não mapeada** → falha explícita (não devolver modo default silencioso).
- Combinação **ilegal** (ex. duas flags mutuamente exclusivas definidas como verdadeiras) → falha explícita.

### Tabela canónica v1

| `dominio` | `subfluxo` | Condição (flags) | `ModoLLM` |
| --------- | ---------- | ---------------- | --------- |
| `retomar` | `respostas_agenticas` | — | `retomar_baseline` |

**Modos reservados** (sem linha obrigatória até ZenSpec do consumidor):

- `retomar` + `variacao_copy` → reservado (ex. Texto A → B).
- `atendimento` + `sugestao_rag` → reservado.
- `atendimento` + `contexto` → reservado (MontadorPrompt).
- `comercial` + `rascunho_pipeline` → reservado.

Implementação pode lançar “não implementado” ou falhar conforme política do chamador até existir linha na tabela.

### Edge cases

- `flags` com chave desconhecida: **se** a tabela v1 ignora flags extra → não falhar; **se** no futuro uma linha exigir flag obrigatória → falhar com erro explícito.
- `dominio`/`subfluxo` com maiúsculas misturadas: normalizar para comparação (ex. lowercase) **ou** exigir canónico exato — documentar na implementação; spec exige comportamento **determinístico**.

### Critérios de aceitação

- Dado `dominio=retomar`, `subfluxo=respostas_agenticas`, saída é exatamente `retomar_baseline`.
- Dado `dominio=inventado`, `subfluxo=x`, saída é erro explícito.
- Não há chamada a rede nem leitura de ficheiro dentro deste contrato.

### Escopo fora

- Definição de `PromptPlan` — [resolver-plano-prompt.zenspec.md](resolver-plano-prompt.zenspec.md).
- Fatos do cliente — montados pelo módulo de produto antes do compositor.
