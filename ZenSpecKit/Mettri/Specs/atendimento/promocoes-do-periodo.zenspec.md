---
status: obsoleto
---

# Promoções do período (`Promo`) — subcomponente interno da `Vitrine`

Esta feature é um **subcomponente interno** da `Vitrine`. Produz `PromoSaida` para **entrada da vitrine** (`promocoesAtivas` em `VitrineEntrada`). **Não** é contrato público do pipeline comercial e **não** existe campo `promo` no `EnriquecimentoComercial` — o LLM e `Venda` consomem sinal promocional via **`VitrineSaida`** e `cliente`.

---

## Conceito

Filtra promoções por conta e instante. Lista vazia é estado válido; o modelo **não** pode inventar campanha fora dela (regra da mãe).

**Papel no orquestrador:** `Promo` **não** é um passo nomeado próprio em [orquestrar-pipeline-comercial-whatsapp.zenspec.md](orquestrar-pipeline-comercial-whatsapp.zenspec.md). É invocado **dentro** de `fornecerVitrineParaPipelineComercial`; a saída `PromoSaida` alimenta a montagem da vitrine (`promocoesAtivas` em `VitrineEntrada`, ver [../vitrine/spec.md](../vitrine/spec.md)).

**Status de exposição:** interno por padrão. Qualquer uso externo direto de `Promo` deve ser tratado como exceção de arquitetura e documentado explicitamente na versão.

Panorama: [spec.md](spec.md) (Comercial).

---

## Pipeline & fluxos

```
conta + instante + regras?  →  Promo  →  PromoSaida
```

| Programa | Recebe | Faz | Consumidor típico |
| --- | --- | --- | --- |
| `Promo` | `accountId`, `instante`, `regrasVitrine?` | Lista promoções ativas | `fornecerVitrineParaPipelineComercial` (sub-chamada; depois `gerarRecomendacoesVitrine`) |

---

## Lógica

### Linha do fluxo

```
accountId + agora + opcionalRegras  →  Promo  →  PromoSaida
```

### Contrato

**Entrada**

- `accountId`: `string`
- `instante`: `string` — ISO-8601 UTC ou política única documentada.
- `regrasVitrine`: `RegrasVitrine | null` — **(opcional)** MVP: `null`.

**Saída**

- `saida`: `PromoSaida` onde `PromoSaida = { promocoes: PromoItem[] }` — pode ser `[]`.

`PromoItem` (mínimo):

- `id`: `string`
- `titulo`: `string`
- `validadeFim?`: `string`

**Erros**

- `INVALID_ACCOUNT` → `accountId` vazio.

### Regras

- **Se** `regrasVitrine` for `null` **então** `saida.promocoes = []` (MVP).
- **Se** existir fonte real na versão **então** preencher `saida.promocoes` só a partir dessa fonte (sem inventar fora da lista).

### Edge cases (Se X → Y)

- Nenhuma promo elegível → `promocoes = []` (não é erro).

### Critérios de aceitação

- Lista sempre definida (nunca `undefined`).
- Determinismo para mesmo `accountId` + `instante` + regras fixas.

### Escopo fora

- CMS externo de marketing.
- Desenho de criativos.
- Priorização de ofertas (isso é [../vitrine/spec.md](../vitrine/spec.md)).
