# Fornecer ficha cliente para atendimento (`fornecerFichaClienteParaAtendimento`)

Esta feature existe para que o painel Atendimento (e o pipeline comercial, quando integrado) obtenham **uma única leitura agregada** por `chatId`: cadastro oficial, compras relevantes e perfil operacional, sem escrever em stores.

Panorama: [spec.md](spec.md) (secções 19–21). Formato Zen: [ZenSpec.md](../../../ZenSpecKit/ZenSpec.md).

---

## Conceito

Lê `ClientDB`, `PurchaseDB` e `CustomerProfileDB` via dependências agrupadas e devolve `FichaClienteAtendimento` somente leitura. Não altera dados.

---

## Pipeline & fluxos

```
chatId + deps  →  fornecerFichaClienteParaAtendimento  →  FichaClienteAtendimento
```

| Programa | Recebe | Faz | Manda para |
| --- | --- | --- | --- |
| `fornecerFichaClienteParaAtendimento` | `chatId`, `deps` | agrega leituras | chamador (UI / orquestrador) |

---

## Lógica

### Linha do fluxo

```
chatId + stores  →  fornecerFichaClienteParaAtendimento  →  ficha
```

### Contrato

**Entrada**

- `chatId`: `string`
- `deps`: `{ getClientByChatId(chatId): Promise<ClientRecord | null>; getLastPurchaseByChatId(chatId): Promise<PurchaseSummary | null>; getOperationalProfile(chatId): Promise<CustomerOperationalProfile | null>; … }` — assinatura única na implementação; tipos alinhados ao código.

**Saída**

- `ficha`: `FichaClienteAtendimento`:
  - `chatId`: `string`
  - `cadastro`: `ClientRecord | null`
  - `ultimaCompra`: resumo alinhado ao `PurchaseDB` (data, valor, itens, `source`) ou `null`
  - `perfilOperacional`: `CustomerOperationalProfile | null` — ver secção 20 em [spec.md](spec.md)
  - `flags`: `{ cadastroUtil: boolean }` — `true` quando existir cadastro com dados úteis (regra fixa por versão)

**Erros**

- `INVALID_INPUT` → `chatId` vazio.
- `STORE_ERROR` → falha em qualquer leitura de `deps`.

### Regras

- **Se** `chatId` inválido **então** `INVALID_INPUT`.
- **Se** uma dependência falhar **então** `STORE_ERROR` (sem retornar ficha parcial mascarada como completa, salvo política única de degradar explicitamente na implementação).
- **Se** não houver perfil operacional **então** `perfilOperacional = null` (não é erro).

### Edge cases (Se X → Y)

- Cliente sem registro em `ClientDB` mas com compras → `cadastro = null`, `ultimaCompra` pode existir; `cadastroUtil = false`.
- Grupo `@g.us` → política única: rejeitar ou retornar vazio conforme produto (documentar na implementação).

### Critérios de aceitação

- Função pura em relação a stores mockadas: mesma resposta para mesma entrada.
- Testes cobrem `chatId` inválido e ausência de dados.

### Escopo fora

- Escrita em qualquer store.
- Montagem de `LlmTurnPackage` (domínio Atendimento / `ContextoResposta`).

### Nota — chip Novo / Contato / Ativo / Recorrente no painel Atendimento

O contrato desta ficha expõe `ultimaCompra` e `perfilOperacional`, mas **não** inclui o histórico bruto de mensagens nem a contagem total de compras. O view-model do painel Atendimento combina a ficha com **MessageDB** (`getMessages(chatId, 1)`) e **PurchaseDB** (`listActiveByChatId` para contar ACTIVE), conforme [spec do painel](../atendimento/spec.md) (secção “Selo no cabeçalho”). Isto mantém `fornecerFichaClienteParaAtendimento` como agregador de cadastro/compra/perfil, sem inflar o contrato da ficha.
