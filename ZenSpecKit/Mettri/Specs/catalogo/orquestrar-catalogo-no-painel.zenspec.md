# Orquestrar catálogo no painel (`catalogoPanelOrchestrator`)

Esta feature existe para que a UI de Catálogo tenha uma única porta de entrada para operações de listar, salvar e alterar disponibilidade sem lógica implícita espalhada.

---

## Conceito

`catalogoPanelOrchestrator` recebe uma intenção da UI e chama o programa correto.  
Ele não decide regra de produto; só roteia e propaga falhas de forma explícita.

Panorama: [spec.md](spec.md).

---

## Lógica

### Linha do fluxo

```
ação da UI  →  catalogoPanelOrchestrator  →  programa alvo  →  resultado para UI
```

### Contrato

**Entrada**

- `input`: `CatalogoCommandInput`
  - `accountId: string`
  - `command: "LIST" | "SAVE" | "SET_ACTIVE" | "SYNC_FROM_SITE"`
  - `payload?: unknown`
- `deps`: `CatalogoOrchestratorDeps`
  - `listarProdutosCatalogo`
  - `salvarProdutoCatalogo`
  - `alterarDisponibilidadeProdutoCatalogo`
  - `sincronizarCatalogoComSite`

**Saída**

- `output`: `CatalogoCommandOutput`
  - `ok: boolean`
  - `data?: unknown`
  - `errorCode?: string`
  - `message?: string`

**Erros**

- `INVALID_COMMAND` -> comando não suportado.
- `INVALID_INPUT` -> `accountId` vazio ou payload inválido.
- `UPSTREAM_ERROR` -> erro propagado da operação chamada.

### Regras

- **Se** `command = "LIST"` **então** chamar `listarProdutosCatalogo` com `accountId`.
- **Se** `command = "SAVE"` **então** chamar `salvarProdutoCatalogo` com payload tipado.
- **Se** `command = "SET_ACTIVE"` **então** chamar `alterarDisponibilidadeProdutoCatalogo`.
- **Se** `command = "SYNC_FROM_SITE"` **então** chamar `sincronizarCatalogoComSite` com payload (sourceUrl).
- **Se** o programa chamado falhar **então** devolver `ok = false` com `errorCode` explícito.
- **Se** o programa chamado tiver sucesso **então** devolver `ok = true` e `data` serializável.

### Edge cases (Se X -> Y)

- `command` ausente -> `INVALID_COMMAND`.
- `payload` ausente para `SAVE` -> `INVALID_INPUT`.
- `payload` ausente para `SET_ACTIVE` -> `INVALID_INPUT`.
- `payload` ausente para `SYNC_FROM_SITE` -> `INVALID_INPUT`.

### Critérios de aceitação

- Uma ação de UI chama exatamente um programa de domínio por execução.
- Nenhuma falha fica silenciosa para a UI.

### Escopo fora

- Validação profunda de campos de produto (vive em `salvarProdutoCatalogo`).
