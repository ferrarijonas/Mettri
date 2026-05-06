# Resolver referência ambígua (`ResolverReferenciaAmbígua`)

>Programa que resolve referências ambíguas a produtos em mensagens do cliente.

## 1. Propósito

Quando o cliente diz "quero dois" (quantidade sem produto) ou "quero dois desses" (pronome/dêixis), o `extrator` não consegue extrair `preferenciasProduto` porque a mensagem não contém o nome do produto explicitamente. Este programa usa **contexto conversacional** para inferir a qual produto o cliente se refere, usando 3 estratégias em ordem de prioridade: reply lookup → último produto do atendente → LLM.

## 2. Input / Output

```typescript
// Input
interface ResolverInput {
  mensagem: string
  chatId: string
  msgId: string
  replyToId?: string          // quotedStanzaID, se presente
  quotedText?: string         // texto da mensagem original, se disponível
  mensagensAnteriores: Array<{
    text: string
    isOutgoing: boolean
    msgId: string
  }>                          // últimas 10 mensagens (ring buffer)
  catalogo: Array<{
    productId: string
    nome: string
    precoCentavos: number
  }>
}

// Output
interface ResolverOutput {
  resolvido: boolean
  produto?: {
    nome: string
    qtd: number
    nomeExtraido: string      // nome como apareceu na evidência
    confianca: 'alta' | 'media' | 'baixa'
    metodo: 'reply' | 'ultimo_produto' | 'llm'
    evidencia: string         // texto que suporta a resolução
  }
}
```

## 3. Pipeline

```
extrator (vazio ou só quantidade)  →  ResolverReferenciaAmbígua  →  validador-catalogo
```

| Programa | Recebe | Faz | Manda para |
| -------- | ------ | --- | ---------- |
| `ResolverReferenciaAmbígua` | mensagem, replyToId, quotedText, ring buffer, catálogo | Tenta resolver produto por reply → último produto → LLM | `validador-catalogo` (se resolvido) ou skip (se não) |

## 4. Lógica

### 4.1 Ativação

O `ouvinte` chama este programa **apenas** quando:
- `extrator` retornou `preferenciasProduto` vazio OU
- `extrator` retornou quantidade sem produto correspondente

E a mensagem contém sinais de ambiguidade:
- Quantidade sem nome: `/^(quero|queria|vou querer|manda|pedi|pode ser)\s+(\d+|dois|duas|tres|tres|quatro|cinco|meia|uma)\s*(desses?|disso|deles?|unidades?)?/i`
- Pronome isolado: `/^(esse|essa|isso|aquele|aquela|desse|dessa|esse mesmo|esse aí)/i`
- Referência vaga: `/^(quero|queria|vou querer)\s+(de novo|também|igual|o mesmo|outro|mais um|mais uma)/i`

**Se** a mensagem não contém nenhum sinal de ambiguidade **então** não chamar o programa (retorna `resolvido: false`).

### 4.2 Estratégia 1 — Reply lookup (prioridade máxima)

**Se** `replyToId` está presente e não vazio **então**:

1. Buscar no `messageDB` a mensagem com `id === replyToId` no mesmo `chatId`
2. **Se** encontrada **então** executar `extrairProdutosDeTexto()` no texto dela
3. **Se** extraiu pelo menos um produto **então**:
   - Usar `parseQuantidade()` para separar nome + qtd
   - Validar contra `catalogo` via `buscarProdutoCatalogo()`
   - **Se** match no catálogo **então** retornar com `confianca: 'alta'`, `metodo: 'reply'`, `evidencia: textoDaMsgOriginal`
   - **Se** sem match no catálogo **então** retornar com `confianca: 'media'`, `metodo: 'reply'`
4. **Se** não encontrada ou sem produto extraível **então** cair para estratégia 2

### 4.3 Estratégia 2 — Último produto do atendente

**Se** `mensagensAnteriores` contém pelo menos uma mensagem `isOutgoing: true` (do atendente) **então**:

1. Percorrer `mensagensAnteriores` da mais recente para a mais antiga
2. Para cada mensagem do atendente, executar `extrairProdutosDeTexto()`
3. **Se** extraiu pelo menos um produto **então**:
   - Validar contra `catalogo` via `buscarProdutoCatalogo()`
   - **Se** match no catálogo **então** retornar com `confianca: 'alta'`, `metodo: 'ultimo_produto'`
   - **Se** sem match no catálogo **então** retornar com `confianca: 'baixa'`, `metodo: 'ultimo_produto'`
4. **Se** nenhuma mensagem do atendente contém produto **então** cair para estratégia 3

### 4.4 Estratégia 3 — LLM com contexto (último recurso)

**Se** as estratégias 1 e 2 falharam **então**:

1. Verificar orçamento de LLM (mesmo teto do `extrator`: 100 chamadas/dia/chat)
2. Montar prompt com as últimas 10 mensagens formatadas como `Atendente: ...` / `Cliente: ...` + a mensagem atual
3. Chamar GPT-4o-mini (mesma via do `extrator`: `MettriBridgeClient.netFetch`)
4. **Se** LLM retornou nome de produto **então** validar contra `catalogo`
5. **Se** match **então** retornar com `confianca: 'media'`, `metodo: 'llm'`
6. **Se** sem match **então** retornar com `confianca: 'baixa'`, `metodo: 'llm'`
7. **Se** LLM falhou ou retornou indeterminado **então** retornar `resolvido: false`

#### Prompt do LLM

**System:**
```
Você é um assistente que ajuda a resolver referências ambíguas em conversas de WhatsApp.
Dada uma conversa entre Atendente e Cliente, e a última mensagem do Cliente que contém
uma referência ambígua (ex: "quero dois", "quero desse", "esse mesmo"), responda com
o nome do produto mais provável que o cliente está pedindo.
Responda APENAS com o nome do produto, ou "INDETERMINADO" se não for possível saber.
```

**User:**
```
Conversa:
{últimas 10 mensagens, uma por linha, formato "Atendente: ..." ou "Cliente: ..."}

Mensagem ambígua do cliente: "{mensagemAtual}"

Qual produto o cliente quer? Responda apenas o nome do produto ou "INDETERMINADO".
```

### 4.5 Merge da quantidade

Independente da estratégia:

1. Extrair quantidade da `mensagem` usando `parseQuantidade()` ou regex direto
2. **Se** não encontrou quantidade explícita **então** `qtd: 1` (padrão)
3. Combinar com o produto resolvido → `{ nome, qtd: N, nomeExtraido: `${nome} (Nx)``

### 4.6 Saída para o pipeline

**Se** `resolvido: true` **então** o `ouvinte` cria um `CampoExtraido` virtual:
```typescript
{
  campo: 'preferenciasProduto',
  valor: [`${produto.nome} (${produto.qtd}x)`],
  confianca: produto.confianca,  // 'alta' | 'media' | 'baixa'
  fonte: `ambiguidade:${produto.metodo}`,
  evidencias: [produto.evidencia],
}
```

Este campo virtual entra no pipeline normalmente (`validador-catalogo` → `sinais-release` → `decisor-update` → `atualizar-perfil-operacional-cliente`).

Além disso, o `ouvinte` armazena o resultado da ambiguidade separadamente como `sugestaoProdutoPendente` no perfil operacional, para que a UI exiba o bloco de sugestão separado (não adicionado automaticamente ao pedido).

**Se** `resolvido: false` **então** o pipeline continua sem `preferenciasProduto` (comportamento atual).

## 5. Casos de borda

| Cenário | Comportamento |
|---------|---------------|
| `replyToId` presente mas mensagem replied não contém produto | Cai para estratégia 2 (último produto do atendente) |
| Atendente mencionou 2 produtos na mesma mensagem ("tem abóbora e multigrãos") | Usar o primeiro mencionado, marcar `confianca: 'baixa'` |
| Cliente respondeu a uma mensagem antiga (fora da janela de 10) | Ainda faz reply lookup no MessageDB (não se limita ao ring buffer) |
| LLM retornou "INDETERMINADO" | `resolvido: false`, pipeline continua sem produto |
| Teto de LLM atingido | Estratégia 3 pula, retorna `resolvido: false` |
| `replyToId` presente mas `quotedText` vazio (msg de mídia) | Tenta mesmo assim extrair produto do quotedText; se vazio, cai para estratégia 2 |
| Produto resolvido não existe no catálogo | `confianca: 'baixa'`, mas ainda passa para o validador decidir |
| Mensagem tem "quero dois" sem reply e sem atendente no buffer | Estratégias 1 e 2 falham → LLM (estratégia 3) |
| Ring buffer vazio (primeira mensagem do chat) | Estratégia 2 pula direto → LLM |

## 6. Dependências

- `messageDB.getMessages(chatId, limit)` — lookup de mensagem replied
- `extrairProdutosDeTexto()` (provider.ts) — extração de produtos de texto
- `parseQuantidade()` (provider.ts) — separação qtd + nome
- `buscarProdutoCatalogo()` (provider.ts) — fuzzy match contra catálogo
- `MettriBridgeClient.netFetch` — chamada OpenAI (mesma do extrator)
- Ring buffer in-memory no `ouvinte` (últimas 10 mensagens por chatId)
- `replyToId` e `quotedText` do `CapturedMessage` (fornecido pelo `extrair-metadados-de-reply-whatsapp`)

## 7. Referências

- [spec.md](spec.md): arquitetura geral do Ouvinte
- [ouvinte.zenspec.md](ouvinte.zenspec.md): shell orquestrador
- [extrator.zenspec.md](extrator.zenspec.md): extração de sinais
- [validador-catalogo.zenspec.md](validador-catalogo.zenspec.md): validação contra catálogo
- [extrair-metadados-de-reply-whatsapp.zenspec.md](../infrastructure/extrair-metadados-de-reply-whatsapp.zenspec.md): captura de replyToId/quotedText
- [extrair-produtos-do-texto.zenspec.md](../atendimento/extrair-produtos-do-texto.zenspec.md): extração de produtos de texto
