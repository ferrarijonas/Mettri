---
status: obsoleto
---

# Preparar contexto de resposta (`ContextoResposta`)

Esta feature existe para que `SugestaoWhatsApp` receba um **`LlmTurnPackage`** determinístico (blocos system/user + metadados) derivado só de `estadoVenda`, turno e enriquecimento, sem chamar modelo.

---

## Conceito

Projeta o estado do funil e o contexto factual num formato estável para o LLM. Aplica a regra da mãe: **se** confiança de produto for baixa **então** instruções explícitas para não afirmar preço como fato.

Panorama: [spec.md](spec.md) (Comercial). Tipo `EstadoVenda`: [atualizar-contexto-de-venda.zenspec.md](atualizar-contexto-de-venda.zenspec.md).

---

## Pipeline & fluxos

```
estadoVenda + turno + enriquecimento  →  ContextoResposta  →  LlmTurnPackage
```

| Programa | Recebe | Faz | Manda para |
| --- | --- | --- | --- |
| `ContextoResposta` | `estadoVenda`, `turnoCliente`, `enriquecimento` | Monta `LlmTurnPackage` | `SugestaoWhatsApp` (via orquestrador) |

---

## Lógica

### Linha do fluxo

```
EstadoVenda + textoTurno + enriquecimento  →  ContextoResposta  →  LlmTurnPackage
```

### Contrato

**Entrada**

- `estadoVenda`: `EstadoVenda` — canónico; ver filha `Venda`.
- `turnoCliente`: `string` — texto atual do cliente (pós-trim).
- `enriquecimento`: `EnriquecimentoComercial` — [orquestrar-pipeline-comercial-whatsapp.zenspec.md](orquestrar-pipeline-comercial-whatsapp.zenspec.md).

**Saída**

- `pacote`: `LlmTurnPackage`
  - `systemBlock`: `string` — persona + regras + resumo de funil.
  - `userBlock`: `string` — turno + fatos (`cliente` incl. `perfilFactual` se existir, matches de produto, **recomendações e sinais da vitrine** — estrutura estável definida na versão; sem lista `promo` solta).
  - `nextActionHint`: `string` — uma linha, próxima ação sugerida para o modelo (ex.: “perguntar logística”).
  - `flags`: `{ produtoBaixaConfianca: boolean }`
  - `tipoConversa`: `IntencaoTipo` — classificação do turno, para que o LLM adapte o tom (ver [classificar-intencao-conversa.zenspec.md](classificar-intencao-conversa.zenspec.md)).

**Erros**

- `INVALID_INPUT` → `estadoVenda` ausente ou `turnoCliente` vazio quando obrigatório pela política da versão.

### Regras

- R1 — **Se** `enriquecimento.produtos.confiancaMaxima < limiar` **então** `flags.produtoBaixaConfianca = true` e `systemBlock` deve incluir instrução explícita de não afirmar preço/produto sem confirmar.
- R2 — **Se** `enriquecimento.vitrine.recomendacoes.length === 0` **então** `systemBlock` deve instruir a não inventar ofertas ou campanhas; usar apenas fatos do turno, do catálogo e do `cliente`. A vitrine não substitui preço canónico ([../vitrine/spec.md](../vitrine/spec.md)).
- R3 — `userBlock` inclui sempre `estadoVenda` serializado de forma legível (JSON ou texto fixo; uma política única).

### Edge cases (Se X → Y)

- `estadoVenda.pedidoConfirmado === true` → `nextActionHint` orienta confirmação curta e registo (sem implementar `RegistrarPedido` aqui).

### Critérios de aceitação

- Mesmas entradas → mesmo `LlmTurnPackage` na mesma versão.
- Testes cobrem R1 com catálogo vazio e com match fraco.

### Escopo fora

- Chamada HTTP ao provedor de modelo.
- `PortaoEnvio`.
