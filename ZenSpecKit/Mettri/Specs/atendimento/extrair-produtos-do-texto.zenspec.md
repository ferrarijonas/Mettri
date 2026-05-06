# Extrair produtos do texto (`extrairProdutosDeTexto`)

Esta feature existe para que o **pedido automático** possa escanear o histórico de mensagens e extrair menções a produtos, complementando os dados do Ouvinte (que só processa mensagens incoming em tempo real). Varre **todas** as direções (incoming e outgoing).

Panorama: [atendimento-unificado.zenspec.md](atendimento-unificado.zenspec.md) (secção 4.3).

---

## Conceito

Transforma o texto de uma mensagem em zero ou mais strings de menção a produto. Espelha a lógica do Ouvinte (`extrator.ts:extractPreferenciasProduto`), mas com fallbacks adicionais para capturar padrões que o Ouvinte não cobre (ex: mensagens outgoing do atendente simulando pedidos, mensagens sem verbo de intenção).

---

## Pipeline & fluxos

```
texto da mensagem  →  extrairProdutosDeTexto  →  string[]
```

| Programa | Recebe | Faz | Manda para |
| --- | --- | --- | --- |
| `extrairProdutosDeTexto` | `texto: string` | Aplica regex em 5 tiers; retorna lista de menções | `buildPedidoAuto` (provider.ts) |

---

## Lógica

### Tiers de extração (em ordem)

#### Tier 1 — Intenção de compra explícita

Padrões com verbo de compra (mesmos do Ouvinte):

| Padrão | Exemplo |
|---|---|
| `(gosto de\|gostaria de\|quero\|vou querer\|vou pedir\|pedir\|quisesse\|queria)\s+(.+?)(?:\.\|,\|;\|$\| para\| pra\| por favor\|\?)` | `"quero dois pães"` → `"dois pães"` |
| `(você tem\|vocês tem\|tu tem\|vende\|tem como)\s+(.+?)(?:\.\|,\|;\|\?\|$)` | `"você tem integral?"` → `"integral"` |
| `(quanto é\|qual o preço\|qual é o valor\|preço do\|preço da\|valor do\|valor da)\s+(.+?)` | `"quanto é o pão?"` → `"o pão"` |
| `(.+?)(?:está disponível\|tá disponível\|tem disponível\|tem em estoque)\s*(?:\?\|\.\|$)` | `"integral está disponível?"` → `"integral"` |

**Se** match **então** split por ` e ` (múltiplos produtos) e retorna.

#### Tier 2 — Lista com "número + nome" e conectivo "e"

```
/(\d+\s+[a-zà-ú\s]+?(?:\s+e\s+\d+\s+[a-zà-ú\s]+?)+)/i
```

Exemplo: `"1 100% integral e 5 Multigrãos"` → `["1 100% integral", "5 Multigrãos"]`

#### Tier 3 — Frase curta com conectivo "e"

**Se** o texto contém ` e ` e tem menos de 80 caracteres **então** split por ` e ` e retorna cada parte.

Exemplo: `"pão integral e café"` → `["pão integral", "café"]`

#### Tier 4 — "Número + (de) + produto" simples

```
/^(\d+)\s+(?:de\s+)?(.{3,50})$/i
```

Captura mensagens que são puramente uma especificação de quantidade + produto, sem verbo.

Exemplos:
| Entrada | qty | nome |
|---|---|---|
| `10 de abobra` | 10 | `abobra` |
| `5 integral` | 5 | `integral` |
| `2 pão de queijo` | 2 | `pão de queijo` |

#### Tier 5 — Mensagem curta sem pontuação

**Se** o texto tem menos de 60 caracteres, não contém pontuação (`.?!,:;`) e tem ≤6 palavras **então** retorna o texto inteiro como menção.

Exemplo: `"pão de abóbora"` → `["pão de abóbora"]`

Contra-exemplo: `"Bom dia, tudo bem?"` → descartado (tem pontuação).

---

### Normalização pós-extração

As menções retornadas são cruas — o parse de quantidade e o match de catálogo são feitos depois, em `buildPedidoAuto`, via `parseQuantidade()` e `buscarProdutoCatalogo()`.

---

### Edge cases (Se X → Y)

- Texto vazio ou <4 caracteres → retorna `[]`.
- Texto com verbo de intenção mas produto genérico ("quero uma coisa") → extrai `"uma coisa"` → sem match no catálogo → filtrado no pedido.
- Texto ambíguo com múltiplos matches → retorna o primeiro match dos tiers 1-2; tiers inferiores só executam se os superiores não casaram.

### Critérios de aceitação

- `"dois de abobora"` → `["dois de abobora"]` (Tier 1)
- `"1 100% integral e 5 Multigrãos"` → `["1 100% integral", "5 Multigrãos"]` (Tier 2)
- `"10 de abobra"` → `["abobra"]` (Tier 4)
- `"Bom dia!"` → `[]` (descartado)
- `"pão de queijo"` → `["pão de queijo"]` (Tier 5)

### Escopo fora

- Parse de quantidade (feito em `parseQuantidade` separadamente).
- Match de catálogo (feito em `buscarProdutoCatalogo` separadamente).
- Extração de outros campos (endereço, pagamento, etc.) — isso é responsabilidade do Ouvinte.
