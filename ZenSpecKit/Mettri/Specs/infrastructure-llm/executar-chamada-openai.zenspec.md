# Executar chamada OpenAI (`executarChamadaOpenAI`)

Esta feature existe para enviar **`messages`** ao endpoint OpenAI **`/v1/chat/completions`** através do **bridge** da extensão (storage + `netFetch`), e devolver o **texto** do assistente ou **erro explícito**.  
Metáfora: o **telefone** que só liga para a central; quem escreve o guião é o compositor.

---

## Conceito

O programa **não** monta system/user; recebe já prontos.  
**Não** altera estado de negócio (MessageDB, filas). Apenas I/O com o provedor.

---

## Pipeline & fluxos

```
deps + mensagens + hiperparametros  →  executarChamadaOpenAI  →  texto assistant | erro
```

| Programa | Recebe | Faz | Manda para |
| -------- | ------ | --- | ----------- |
| `executarChamadaOpenAI` | `deps`, payload | Lê chave; POST; parse resposta | consumidor |

---

## Lógica

### Contrato — dependência `deps`

Objeto com operações mínimas:

- `storageGet(keys: string[]): Promise<Record<string, unknown>>` — lê chave API em storage local da extensão.
- `netFetch(init: { url, method, headers, body }): Promise<{ ok: boolean, status: number, text: string }>` — sem bypass de CSP fora do bridge.

### Contrato — entrada

- `deps`: conforme acima.
- `messages`: array de `{ role: "system" | "user" | "assistant", content: string }` — pelo menos uma mensagem; tipicamente `system` + `user` vindas do compositor.
- `modelo`: `string` — ex. `gpt-4o-mini` (referência de implementação).
- `temperature`: `number` — opcional; default documentado na implementação.
- `max_tokens`: `number` — opcional; default documentado na implementação.
- `top_p`: `number` — opcional.

### Contrato — chave API

- Chave armazenada sob chave canónica **`mettri:openai:apiKey`** (string) em `chrome.storage.local` via bridge — mesma convenção que implementação atual do Retomar.
- **Se** chave ausente ou não string → falha explícita com mensagem compreensível ao utilizador (não retornar string vazia como sucesso).

### Contrato — saída

- `string` — conteúdo de `choices[0].message.content` após **trim**.

### Erros

- Chave API ausente → erro explícito.
- HTTP `ok === false` → erro explícito incluindo `status` e corpo quando útil.
- JSON de resposta sem `choices[0].message.content` ou content vazio após trim → erro explícito.
- Exceção de rede / parse JSON → erro explícito.

### URL e método

- `POST` para `https://api.openai.com/v1/chat/completions`
- Headers: `Content-Type: application/json`, `Authorization: Bearer <chave>`

### Edge cases

- Resposta com múltiplas `choices` — usar **sempre** `choices[0]` (canónico v1).
- Conteúdo só com espaços → tratar como vazio → erro explícito.

### Critérios de aceitação

- Dado deps mock com resposta 200 e content válido, saída é o texto trimado.
- Dado chave ausente, nunca retorna sucesso silencioso.
- Dado 401/429, erro explícito (não mascarar como sucesso).

### Escopo fora

- Streaming, `tools` no payload, `response_format` JSON mode — futura ZenSpec ou extensão deste contrato.
- Outros provedores (Anthropic, etc.).
- Composição de prompts — [compor-mensagens-llm.zenspec.md](compor-mensagens-llm.zenspec.md).
