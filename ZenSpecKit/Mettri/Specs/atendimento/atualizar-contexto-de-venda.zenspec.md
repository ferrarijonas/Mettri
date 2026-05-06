# Atualizar contexto de venda (`Venda`)

Esta feature existe para que `ContextoResposta` e o resto do pipeline comercial recebam um **`estadoVenda`** determinístico (funil + slots + faltantes + fecho) sem reinterpretar o histórico fora deste programa.

---

## Conceito

`Venda` é a **única fonte de verdade** do objeto **`estadoVenda`** na cadeia comercial. Consome a última janela de mensagens, o estado anterior e o pacote de enriquecimento (`cliente` com opcional `perfilFactual`, `produtos`, `vitrine`). Não chama LLM nem WhatsApp.

Panorama do domínio: [spec.md](spec.md) (secção Comercial).

---

## Pipeline & fluxos

```
enriquecimento + mensagens + estadoVenda_anterior  →  Venda  →  estadoVenda_novo
```

| Programa | Recebe | Faz | Manda para |
| --- | --- | --- | --- |
| `Venda` | `chatId`, `mensagens`, `estadoVenda` anterior, `enriquecimento` | Atualiza funil; recalcula `faltantes`; define `pedidoConfirmado` | `ContextoResposta` (via orquestrador) |

---

## Lógica

### Linha do fluxo

```
mensagens + enriquecimento + estadoAnterior  →  Venda  →  estadoVenda_novo
```

### Contrato

**Entrada**

- `chatId`: `string` — conversa ativa.
- `mensagens`: lista de mensagens normalizadas (texto, sentido, instante) — janela recente; ordenação cronológica crescente.
- `estadoAnterior`: `EstadoVenda | null` — `null` na primeira execução para aquele `chatId` nesta sessão lógica.
- `enriquecimento`: `EnriquecimentoComercial` — tipo canónico na filha [orquestrar-pipeline-comercial-whatsapp.zenspec.md](orquestrar-pipeline-comercial-whatsapp.zenspec.md): `cliente` (perfil factual opcional **embutido**), `produtos`, `vitrine` (promoções e ranking consomem-se aqui).

**Dependência externa (agrupada)**

- Nenhuma obrigatória além das entradas acima; persistência de sessão (se existir) é detalhe de implementação e não altera o contrato de saída por turno.

**Saída**

- `estadoVenda`: `EstadoVenda` — objeto canónico:

`EstadoVenda`:

- `modo`: `'pre_venda' | 'pedido_ativo'`
- `slots`: objeto com chaves opcionais em texto livre (MVP):
  - `itens?`, `logistica?`, `horario?`, `valorForma?`, `upsell?`, `confirmacao?`
- `faltantes`: `string[]` — identificadores estáveis de slot ainda por preencher (ex.: `"itens"`, `"logistica"`).
- `pedidoConfirmado`: `boolean`
- `tipoConversa`: `IntencaoTipo` — classificação do turno, provida por `ClassificarIntencao` (ver [classificar-intencao-conversa.zenspec.md](classificar-intencao-conversa.zenspec.md)).
- `orderId?`: `string` — `orderId` do `OrderRecordV2` associado, se existir (ver [modelo-pedido-unificado.zenspec.md](modelo-pedido-unificado.zenspec.md)).

**Erros**

- `INVALID_INPUT` → `chatId` vazio ou `mensagens` ausente.
- `STATE_CONFLICT` → transição impossível com dados contraditórios explícitos (definir mensagem na implementação).

### Regras

- R1 — **Se** `estadoAnterior` for `null` **então** inicializar `modo = 'pre_venda'`, `slots` vazio, `faltantes` com conjunto inicial mínimo da filha (ex.: `["intencao"]`), `pedidoConfirmado = false`.
- R2 — **Se** `modo = 'pre_venda'` e o turno indicar intenção de pedido (regra textual/heurística na implementação, determinística por versão) **então** `modo = 'pedido_ativo'` e atualizar `faltantes` para o conjunto do funil de pedido.
- R3 — **Se** `modo = 'pedido_ativo'` **então** `faltantes` deve refletir slots obrigatórios ainda vazios (lista derivada de `slots`, não inventada pelo LLM).
- R4 — **`pedidoConfirmado`:** **Se** e somente se todos os slots obrigatórios estiverem preenchidos **e** a última mensagem do cliente ou do atendente fechar o pedido segundo regra fixa da versão (palavra-chave / estado explícito na filha) **então** `pedidoConfirmado = true`; **senão** `false`.
- R5 — **Enriquecimento:** merges não destroem slots já preenchidos; só acrescentam ou refinam quando `Produtos`, `vitrine` ou outras fontes trouxerem dado novo compatível (sem contradizer preço/estoque canónico de `Produtos`).
- R6 — **Determinismo:** mesmas entradas (`chatId`, `mensagens`, `estadoAnterior`, `enriquecimento`) na mesma versão de regras produzem o mesmo `estadoVenda`.

### Edge cases (Se X → Y)

- Janela de mensagens vazia → manter `estadoAnterior` se existir; **se** também não existir **então** estado inicial R1.
- `enriquecimento` vazio (MVP) → `Venda` ainda assim produz `estadoVenda` válido; não falhar só por ausência de catálogo.
- Duas mensagens do cliente no mesmo turno agregado → processar na ordem da lista de entrada.

### Critérios de aceitação

- Toda saída inclui `EstadoVenda` completo com os quatro campos top-level.
- `pedidoConfirmado` nunca `true` sem regra R4 satisfeita.
- Testes chamam a função com a mesma ordem de parâmetros do contrato.

### Escopo fora

- Contrato de `EnriquecimentoComercial` campo-a-campo (definido nas filhas de enriquecimento e no orquestrador).
- UI e `SugestaoWhatsApp`.
