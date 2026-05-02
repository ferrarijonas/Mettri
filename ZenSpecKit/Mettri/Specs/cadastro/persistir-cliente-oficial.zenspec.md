# Persistir cliente oficial (`persistirClienteOficial`)

Esta feature existe para que o domínio Cadastro grave ou atualize o **cadastro oficial** do cliente em `ClientDB` com validação determinística, sem duplicar regras na UI do Atendimento.

Panorama: [spec.md](spec.md) (secções 19–20). Formato Zen: [ZenSpec.md](../../../ZenSpecKit/ZenSpec.md).

---

## Conceito

Recebe um payload de campos permitidos de `ClientRecord` (ou subconjunto versionado) associado a um `chatId` ou `clientKey` e persiste em `ClientDB`. Não calcula perfil inferido.

---

## Pipeline & fluxos

```
payload validado + deps  →  persistirClienteOficial  →  ClientDB
```

| Programa | Recebe | Faz | Manda para |
| --- | --- | --- | --- |
| `persistirClienteOficial` | entrada, `deps` | valida e `upsert` em `ClientDB` | — |

---

## Lógica

### Linha do fluxo

```
entrada + clientDB  →  persistirClienteOficial  →  void | erro
```

### Contrato

**Entrada**

- `chatId`: `string` — obrigatório para vincular `whatsAppChatId` quando aplicável.
- `recordPatch`: `object` — campos permitidos alinhados ao schema `ClientRecord` do projeto (nome, telefone, endereço, notas, etc.); política única de merge na implementação.
- `deps`: `{ upsert(record: ClientRecord): Promise<void>; … }` — operações agrupadas.

**Saída**

- `ok: true` quando persistência concluir.

**Erros**

- `INVALID_INPUT` → `chatId` vazio após trim ou `recordPatch` inválido para o schema.
- `STORE_ERROR` → falha em `deps.upsert`.

### Regras

- **Se** `chatId` for inválido **então** `INVALID_INPUT` e não gravar.
- **Se** merge resultar em registro que falhe validação do schema **então** `INVALID_INPUT`.
- **Se** persistência falhar **então** `STORE_ERROR` explícito.

### Edge cases (Se X → Y)

- Registro inexistente → criar via `upsert` com chaves exigidas pelo schema.
- Conflito de `clientKey` → política única documentada na implementação (rejeitar ou resolver).

### Critérios de aceitação

- Mesma entrada e mesma versão de schema produzem o mesmo estado em `ClientDB`.
- Testes com mock de `deps`.

### Escopo fora

- `CustomerProfileDB`.
- Pipeline comercial (`IdentificarCliente`, `Perfil`, `Venda`).
