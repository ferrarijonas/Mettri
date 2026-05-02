# Perfil factual do cliente (`Perfil`)

Esta feature existe para produzir **`PerfilSaida`** — etiquetas factuais simples sobre o cliente — para serem **embutidas** em `ClienteResolvido.perfilFactual` quando [`IdentificarCliente`](identificar-cliente.zenspec.md) as obtiver, ou para montar `clienteContexto` na vitrine. **Não** é passo nomeado no [orquestrador comercial](orquestrar-pipeline-comercial-whatsapp.zenspec.md).

---

## Conceito

Agrega sinais a partir de `clienteResolvido`, histórico recente opcional e `promoSaida` opcional. Não altera mensagens.

Persistência de campos enriquecidos segue o domínio Cadastro quando existir fluxo de escrita ([../cadastro/spec.md](../cadastro/spec.md)); no MVP pode ser só em memória.

Panorama: [spec.md](spec.md) (Comercial).

---

## Pipeline & fluxos

```
cliente + historico? + promoSaida?  →  Perfil  →  PerfilSaida
```

| Programa | Recebe | Faz | Consumidor típico |
| --- | --- | --- | --- |
| `Perfil` | `clienteResolvido`, `historicoRecente?`, `promoSaida?` | Lista de tags factuais | `IdentificarCliente` (sub-chamada) ou montagem de `VitrineEntrada.clienteContexto` |

---

## Lógica

### Linha do fluxo

```
ClienteResolvido + sinais  →  Perfil  →  PerfilSaida
```

### Contrato

**Entrada**

- `clienteResolvido`: `ClienteResolvido` — [identificar-cliente.zenspec.md](identificar-cliente.zenspec.md)
- `historicoRecente`: `MensagemNormalizada[] | null` — **(opcional)** janela curta; `null` em MVP.
- `promoSaida`: `PromoSaida | null` — **(opcional)**; no fluxo canónico do orquestrador costuma ser **`null`** (promoções entram na vitrine).

**Saída**

- `saida`: `PerfilSaida` — `PerfilSaida = { tags: string[] }` — ex.: `"novo"`, `"recorrente"`, `"promo_ativa"` (vocabulário fechado na implementação + documentado). **Nota:** tags aqui são **perfil factual / promo**, não precisam espelhar o chip **Novo / Contato / Recorrente** do cabeçalho do painel — esse chip segue regra própria (compra + captura em MessageDB); o **Ouvinte** alimenta perfil a partir de mensagens, mas o bit “já há conversa capturada” vem do armazenamento de mensagens, não do extrator isolado.
- **Evolução compatível (não obrigatória no MVP atual):**
  - `facts?`: objeto factual opcional (ver versão anterior da spec para campos).
  - `segmentos?`: `string[]`
  - `confiancaPerfil?`: `number` em `[0,1]`

**Erros**

- `INVALID_INPUT` → `clienteResolvido.chatId` vazio.

### Regras

- **Se** `historicoRecente` for `null` **então** `saida.tags` mínimas só de `clienteResolvido` e, **se** `promoSaida` existir, de `promoSaida.promocoes.length`.
- **Se** `promoSaida` for `null` **então** não derivar tag `"promo_ativa"` apenas da lista Promo neste passo (ofertas seguem pela vitrine).

### Edge cases (Se X → Y)

- Histórico vazio com `historicoRecente = []` → tratar como “sem mensagens” (não como erro).

### Critérios de aceitação

- Saída sempre é `saida.tags` (pode ser `[]`).

### Escopo fora

- Scoring de CRM.
- Perfil psicológico ou inferência não explicável.
