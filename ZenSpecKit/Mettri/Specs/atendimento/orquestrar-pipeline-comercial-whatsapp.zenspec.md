# Orquestrar pipeline comercial WhatsApp (`comercialPipelineOrchestrator`)

Esta feature existe para que exista **uma única sequência** que lê o **MessageDB**, corre os programas na ordem declarada abaixo, agrega o **pacote** e devolve **estado + rascunho** à UI — com **abort explícito** se qualquer etapa falhar.

---

## Conceito

`comercialPipelineOrchestrator` é o **shell** Unix da feature Comercial ([spec.md](spec.md)). Não contém regras de funil (isso é `Venda`); não chama o LLM diretamente (isso é `SugestaoWhatsApp`); só **invoca**, **mergeia** saídas e **propaga** erros.

**Nota de produto — promoções e perfil:** não existem `promo` nem `perfil` como **chaves separadas** no `EnriquecimentoComercial`. **Promoções** entram como sinal **interno** ao montar a vitrine. **Sinais factuais de cliente** (o que antes era o passo `Perfil`) vêm **embutidos** em `ClienteResolvido` quando a implementação os obtiver — ver [identificar-cliente.zenspec.md](identificar-cliente.zenspec.md).

---

## Tipos canónicos (pacote acumulado)

Definições partilhadas pelas filhas e pela mãe:

- `ClienteResolvido` — saída de `IdentificarCliente`; pode incluir **`perfilFactual`** (antes `PerfilSaida`) embutido — ver [identificar-cliente.zenspec.md](identificar-cliente.zenspec.md).
- `ProdutosSaida` — saída de `Produtos` ([produtos-preco-e-estoque.zenspec.md](produtos-preco-e-estoque.zenspec.md)).
- `VitrineSaida` — [../vitrine/spec.md](../vitrine/spec.md) (`recomendacoes`, `generatedAtIso`, …).
- `EnriquecimentoComercial`:

```text
{
  cliente: ClienteResolvido
  produtos: ProdutosSaida
  vitrine: VitrineSaida
}
```

- `vitrine` reflete a execução do passo `fornecerVitrineParaPipelineComercial` (internamente: sub-chamadas `Promo`, `gerarRecomendacoesVitrine`, etc.).

- `EstadoVenda` — [atualizar-contexto-de-venda.zenspec.md](atualizar-contexto-de-venda.zenspec.md).
- `LlmTurnPackage` — [preparar-contexto-de-resposta.zenspec.md](preparar-contexto-de-resposta.zenspec.md).
- `RascunhoComercial` — [orquestrar-sugestao-whatsapp.zenspec.md](orquestrar-sugestao-whatsapp.zenspec.md).

---

## Programa único (orquestrador)

| Programa | Recebe | Faz | Manda para |
| --- | --- | --- | --- |
| `comercialPipelineOrchestrator` | `input`: `ComercialOrchestratorInput` | Executa passos 1–10 abaixo (10 opcional e assíncrono) | `ComercialOrchestratorOutput` |

`ComercialOrchestratorInput`:

- `chatId`: `string`
- `mensagens`: lista normalizada (mesmo significado que em `Venda`)
- `estadoAnterior`: `EstadoVenda | null`
- `accountId`: `string`
- `instante`: `string` (ISO UTC)
- `persona`: `string`
- `modoEnvio`: ver `SugestaoWhatsApp`
- `deps`: objeto agrupando `MessageDB`, stores de cliente/catálogo, `depsLLM`, serviço de envio, `regrasVitrine?`, `gerarRecomendacoesVitrine`, etc. (assinatura única na implementação)

`ComercialOrchestratorOutput`:

- `enriquecimento`: `EnriquecimentoComercial`
- `estadoVenda`: `EstadoVenda`
- `rascunho`: `RascunhoComercial`
- `orderRecord?`: `OrderRecord` — **só** se o passo opcional `RegistrarPedido` tiver corrido com sucesso

---

## Ordem (por execução)

0. **`ClassificarIntencao`** ([classificar-intencao-conversa.zenspec.md](classificar-intencao-conversa.zenspec.md)) — classifica o tipo de conversa (`compra_nova` / `suporte_pos_venda` / `orcamento` / `duvida` / `outro`). **Se** `compra_nova` **então** auto-cria `OrderRecordV2` com status `lead` via `OrderDB.createOrder`. **Se** `suporte_pos_venda` **então** carrega `orderRelacionada` para o enriquecimento.
1. Validar `ComercialOrchestratorInput` — **se** inválido **então** abortar com erro explícito (não correr sub-etapas).
2. `IdentificarCliente`(`chatId`, `mensagens?`, deps.cliente) → `cliente` — pode aplicar **sub-chamada lógica a `Perfil`** para preencher `perfilFactual` em `ClienteResolvido` quando `deps` permitirem (não é passo separado). `ClienteResolvido` inclui `tipoConversa` e `pedidosAtivos`.
3. `Produtos`(`textoUltimoCliente`, `cliente`, `deps.catalogo`) → `produtos`.
4. `fornecerVitrineParaPipelineComercial`([contrato](../vitrine/fornecer-vitrine-para-pipeline-comercial.zenspec.md)) — monta `VitrineEntrada` a partir de catálogo, **`Promo` interno** (`promocoesAtivas`), `ProdutosSaida`, **`cliente`** (incl. `perfilFactual` para `clienteContexto`), turno → `gerarRecomendacoesVitrine` → devolve **`vitrine`** (`VitrineSaida`) + `warnings` opcionais.
5. Montar `enriquecimento` com chaves exatamente: `cliente`, `produtos`, `vitrine` (campos dos passos 2–4).
6. `Venda`(`chatId`, `mensagens`, `estadoAnterior`, `enriquecimento`) → `estadoVenda`.
7. `ContextoResposta`(`estadoVenda`, `textoUltimoCliente`, `enriquecimento`) → `pacote`.
8. `SugestaoWhatsApp`(`pacote`, `persona`, `depsLLM`, …) → `rascunho`.
9. **Opcional** — **Se** `estadoVenda.pedidoConfirmado` e `orderDraft` mínimo disponível **então** `RegistrarPedido` ([registrar-pedido-obrigatorio.zenspec.md](registrar-pedido-obrigatorio.zenspec.md)) transicionando `draft → open` no `OrderRecordV2`; **se** falhar **então** erro explícito no output (não mascarar como sucesso de rascunho).
10. **Opcional (tail assíncrono, sem bloquear UI):** montar sinais do turno (`chatId`, `mensagens`, `estadoVenda`, `enriquecimento`, `orderRecord?`) e chamar `atualizarPerfilOperacionalCliente` do domínio Cadastro para atualizar `CustomerProfileDB`.

**Abort:** **Se** qualquer passo 1–8 lançar erro controlado **então** não executar passos seguintes; devolver erro único no contrato da implementação (ex.: `{ ok: false, code, message }`) sem preencher campos posteriores com dados falsos. Passo 0 não aborta — `ClassificarIntencao` sempre devolve um tipo válido (fallback `outro`).

---

## Regras de propagação

- R1 — Erro em `Produtos` / passo `fornecerVitrineParaPipelineComercial` em MVP **não** deve impedir `Venda` **salvo** política da versão; recomenda-se **não obrigar** na versão inicial.
- R2 — Erro em `Venda` ou `ContextoResposta` ou `SugestaoWhatsApp` → **abort total** do rascunho.
- R3 — Erro no passo 10 (atualização de perfil operacional) **não** invalida `rascunho` nem `orderRecord`; tratar como falha explícita observável (log/métrica), sem sucesso silencioso no monitoramento.

---

## Edge cases (Se X → Y)

- `mensagens` vazias → abort antes de LLM ou estado inicial conforme [atualizar-contexto-de-venda.zenspec.md](atualizar-contexto-de-venda.zenspec.md).
- `RegistrarPedido` opcional falha → `rascunho` pode ser válido mas `orderRecord` ausente + erro associado (política única).
- Falha de atualização do perfil no tail assíncrono → resposta ao atendente permanece válida; retry fica a cargo da política do domínio Cadastro.

---

## Critérios de aceitação

- Uma única função `comercialPipelineOrchestrator(input, deps)` na implementação espelha a ordem acima.
- Testes de integração cobrem abort no passo 7 e ausência do passo opcional `RegistrarPedido`.

---

## Alinhamento (costura com a mãe e filhas)

- Diagrama da mãe: **sem** passos nomeados `Promo` nem `Perfil`; estes existem como **lógica interna** (`Promo` na vitrine; `Perfil` opcional em `IdentificarCliente`).
- `EstadoVenda` é bit-a-bit o tipo da filha [atualizar-contexto-de-venda.zenspec.md](atualizar-contexto-de-venda.zenspec.md).
- `LlmTurnPackage` e `RascunhoComercial` seguem as filhas [preparar-contexto-de-resposta.zenspec.md](preparar-contexto-de-resposta.zenspec.md) e [orquestrar-sugestao-whatsapp.zenspec.md](orquestrar-sugestao-whatsapp.zenspec.md).
- `OrderRecord` no output opcional segue [registrar-pedido-obrigatorio.zenspec.md](registrar-pedido-obrigatorio.zenspec.md).
- Vitrine: [../vitrine/fornecer-vitrine-para-pipeline-comercial.zenspec.md](../vitrine/fornecer-vitrine-para-pipeline-comercial.zenspec.md), [../vitrine/spec.md](../vitrine/spec.md).

## Escopo fora

- UI ([spec.md](spec.md) Interface).
- `Pagamentos` (invocação paralela por outro gatilho).

---

## Implementação de referência (opcional)

- A definir em `src/` quando existir o slice — não bloqueia esta spec.
