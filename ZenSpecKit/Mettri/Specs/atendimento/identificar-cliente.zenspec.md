---
status: obsoleto
---

# Identificar cliente (`IdentificarCliente`)

Esta feature existe para que `Produtos`, a vitrine (via `cliente` + `VitrineEntrada.clienteContexto`) e `Venda` recebam **resolução de cliente enriquecida por `chatId`** — identidade operacional **e**, quando disponível, **sinais factuais** (perfil) — sem duplicar leituras.

---

## Conceito

Resolve identidade operacional do chat (pessoa vs grupo, dígitos de telefone se aplicável, registo em `ClientRecord` quando existir). Opcionalmente agrega **etiquetas factuais** via **sub-chamada** ao programa [`Perfil`](perfil-factual-do-cliente.zenspec.md) (mesmo contrato `PerfilSaida`, em campo `perfilFactual`), **não** como passo separado no [orquestrador](orquestrar-pipeline-comercial-whatsapp.zenspec.md).

Não altera `estadoVenda`.

Fonte de verdade do cadastro oficial: domínio Cadastro / `ClientDB` (ver [../cadastro/spec.md](../cadastro/spec.md) secções 4.3 e 19).

Panorama: [spec.md](spec.md) (Comercial).

---

## Pipeline & fluxos

```
chatId + deps [+ mensagens?]  →  IdentificarCliente  →  ClienteResolvido
```

| Programa | Recebe | Faz | Manda para |
| --- | --- | --- | --- |
| `IdentificarCliente` | `chatId`, `deps`, opcionalmente janela de `mensagens` para perfil | Resolve ficha + opcional `perfilFactual` | `Produtos` (via orquestrador) |

---

## Lógica

### Linha do fluxo

```
chatId + clientStore [+ Perfil interno]  →  IdentificarCliente  →  ClienteResolvido
```

### Contrato

**Entrada**

- `chatId`: `string`
- `deps`: `{ getClientRecord(chatId): ClientRecord | null; getFichaAgregada?; … }` — operações de leitura agrupadas (assinatura única na implementação).
- `mensagensRecentes?`: janela opcional — usada **só** se a implementação for calcular `perfilFactual` no mesmo passo.

**Saída**

- `clienteResolvido`: `ClienteResolvido`
  - `chatId`: `string`
  - `isGroup`: `boolean`
  - `phoneDigits`: `string | null`
  - `record`: `ClientRecord | null` — quando não existir, `null` (MVP válido).
  - `perfilFactual?`: [tipo `PerfilSaida`](perfil-factual-do-cliente.zenspec.md) — **omitido** se não houver deps para tags/ficha; produzido por sub-chamada lógica a `Perfil` com `promoSaida: null` no fluxo canónico (promoções tratadas na vitrine).
  - `tipoConversa`: `IntencaoTipo` — classificação do turno atual, provida pelo passo `ClassificarIntencao` (ver [classificar-intencao-conversa.zenspec.md](classificar-intencao-conversa.zenspec.md)).
  - `pedidosAtivos`: `OrderRecordV2[]` — pedidos do cliente com status `open` ou `awaiting_payment` (ver [modelo-pedido-unificado.zenspec.md](modelo-pedido-unificado.zenspec.md)). Vazio se nenhum.

**Erros**

- `INVALID_CHAT` → `chatId` vazio.
- `STORE_ERROR` → falha ao ler dependência.

### Regras

- **Se** `chatId` for de grupo **então** `isGroup = true` e `phoneDigits` pode ser `null`.
- **Se** registo não existir **então** `record = null` (não falhar só por ausência).
- **Se** `perfilFactual` for calculado **então** seguir regras da filha `Perfil` (sem inferência sensível).

### Edge cases (Se X → Y)

- `chatId` inválido → `INVALID_CHAT`.
- Erro de I/O na dependência → `STORE_ERROR` (falha explícita).

### Critérios de aceitação

- Saída sempre inclui `chatId` e `isGroup`.
- Função testável com mock de `deps`.

### Escopo fora

- Criar/editar registo de cliente.
- Match de produto.
