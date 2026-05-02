# Extrator — Sinais

>Programa que extrai sinais da mensagem crua do cliente.

## 1. Propósito

Analisa a mensagem do cliente e extrai valores candidatos para cada campo do perfil operacional, classificando a confiança inicial.

## 2. Input / Output

```typescript
// Input
interface ExtratorInput {
  mensagem: string
  chatId: string
  contextoAnterior?: {
    urgencia?: "alta" | "media" | "baixa"
    etapaVenda?: string
  }
}

// Output
interface ExtratorOutput {
  campos: CampoExtraido[]
  urgencia: "alta" | "media" | "baixa"
  usaLLM: boolean       // true se LLM foi chamado (regex não capturou tudo)
  camposRestantes: string[] // campos com confianca=desconhecido após regex
  metadata: {
    tokens: number
    idioma: "pt-BR"
  }
}
```

## 3. Campos alvos

| Campo | Descrição | Padrão de extração |
|-------|-----------|------------------|
| `preferenciasProduto` | Produtos de interesse | "gosto de", "prefiro", "pedir", "quero" |
| `aversoesProduto` | Produtos rejeitados | "não gosto", "não quero", "sem" |
| `enderecoEntrega` | Endereço mencionado | "endereço", "entregar", "no endereço" |
| `formaPagamentoPreferida` | Forma de pagamento | "pagar com", "via", "PIX", "crédito" |
| `urgenciaEntrega` | Prazo mentioned | "hoje", "agora", "amanhã", "urgente" |
| `observacoesLogisticas` | Restrições logísticas | "portaria", "sem acesso", "andar" |
| `nome` | Nome do cliente | "meu nome é", "é [nome]" |
| `telefone` | Telefone de contato | DDD + 9 dígitos |

## 4. Classificação de confiança

| Nível | Critério |
|-------|----------|
| `alta` | Clareza total, valor único,语义完整 |
| `media` | Contexto claro, possibilidade de variação |
| `baixa` | Múltiplas interpretações possíveis, ambiguidade |
| `desconhecido` | Nenhum sinal detectado |

## 5. Algoritmo

### 5.1 Pré-processamento

```
1. Normalizar mensagem (lowercase, remover acentos)
2. Tokenizar
3. Detectar urgência (palavras-chave)
```

### 5.2 Extraction por campo

Para cada campo, o Extrator:
1. Identifica segmentos relevantes na mensagem
2. Aplica heurísticas de extração
3. Classifica confiança inicial

### 5.3 Detecção de urgência

```
URGENCIA ALTA: "agora", "hoje", "urgente", "já", "é para hoje"
URGENCIA MEDIA: "amanhã", "depois de amanhã", "essa semana"
URGENCIA BAIXA: (default)
```

## 6. Heurísticas de extração por campo

### 6.1 preferenciasProduto

```
Sinais: "gosto de X", "prefiro X", "pedir X", "quero X", "vou pedir X"
Confiança alta: produto catálogo + verbo de intenção
Confiança média: produto catálogo sem verbo
Confiança baixa: produto não identificado mas parece produto
```

### 6.2 aversoesProduto

```
Sinais: "não gosto de X", "não quero X", "sem X", "sem azeitona"
Confiança: proporcional à specificity (sem azeitona > sem nada)
```

### 6.3 enderecoEntrega

```
Sinais: "endereço", "entregar", "no endereço", "no CEP"
Extração: detectar rua/numero/bairro/CEP
Confiança: alta se contém CEP completo
```

### 6.4 formaPagamentoPreferida

```
Sinais: "pagar com PIX", "via transferência", "no débito", "crédito"
Validação: consultar catálogo de formas de pagamento
```

## 7. Formato de saída

```typescript
interface CampoExtraido {
  campo: string
  valor: string | string[]
  confianca: "desconhecido" | "baixa" | "media" | "alta"
  fonte: string        // "mensagem_cliente:linha_10"
  evidencias: string[] // segmentos que suportam a extração
}
```

## 8. Casos de borda

| Cenário | Comportamento |
|--------|---------------|
| Mensagem sem sinais | Retornar array vazio |
| Múltiplos valores para mesmo campo | Retornar todos com confianca calculada |
| Produto inválido (não catálogo) | Retornar com confianca=baixa (deixa Validador filtrar) |
| Urgência contraditória | Usar a maior |

## 9. LLM fallback (regex → LLM)

**Abordagem:** Regex captura padrões óbvios (telefone, CEP, PIX, portaria); LLM preenche campos que o regex não conseguiu (nome, preferências, endereço completo, formas de pagamento contextuais).

### 9.1 Critério de ativação

Chamar LLM **se** pelo menos um campo alvo permaneceu com `confianca = desconhecido` após regex E o texto da mensagem tem >= 10 caracteres.

**Não chamar LLM se:**
- Todos os campos foram capturados por regex com confianca >= media
- Mensagem tem < 10 caracteres (provavelmente "ok", "obrigado", "sim")
- Teto de gasto por cliente foi atingido no dia

### 9.2 Teto de gasto

- Máximo: **$0.10 por cliente por dia** (~100 chamadas com GPT-4o-mini)
- Custo estimado por chamada: **~$0.001** (modelo `gpt-4o-mini`, ~200 tokens)
- Implementação: contador por `chatId` com data, reseta à meia-noite UTC
- **Se** teto atingido **então** `usaLLM = false`; campos restantes permanecem `desconhecido`

### 9.3 Prompt

**System:**
```
Você é um extrator de dados de perfil de cliente a partir de mensagens do WhatsApp.
Extraia os campos solicitados e retorne APENAS um JSON válido.
Não invente informações que não estejam na mensagem.
```

**User:**
```
Mensagem do cliente:
"{mensagem}"

Extraia os seguintes campos opcionais deste JSON:
{
  "nome": "string | null",
  "preferenciasProduto": "string[]" (produtos que o cliente quer ou demonstrou interesse),
  "aversoesProduto": "string[]" (produtos que o cliente rejeitou),
  "enderecoEntrega": "string | null",
  "formaPagamentoPreferida": "string[]",
  "urgenciaEntrega": "string | null" (prazo mencionado: "hoje", "amanhã", "quinta", etc.),
  "observacoesLogisticas": "string[]" (instruções de entrega: portaria, andar, etc.),
  "quantidade": "number | null" (quantidade mencionada de itens),
  "confianca": "baixa" | "media" | "alta"
}

Regras:
- "confianca" geral da extração: alta se informação clara e completa, media se parcial, baixa se incerta.
- Não preencher campos não mencionados (deixar null ou []).
- "preferenciasProduto" inclui produtos mencionados com intenção de compra.
- "observacoesLogisticas" inclui instruções de entrega, horários, portaria, etc.
```

### 9.4 Integração do retorno LLM com extração regex

```
regex → campos com confianca
LLM → campos com confianca

Merge:
  Para cada campo:
    Se regex capturou com confianca >= media
      → usar valor do regex (confianca mantida)
    Se regex não capturou (confianca = desconhecido) E LLM retornou valor não-nulo
      → usar valor do LLM com confianca do LLM -1 nível (penalidade de fallback: alta→media, media→baixa, baixa→desconhecido)
    Se regex capturou com baixa E LLM retornou valor diferente
      → usar valor do LLM com confianca do LLM (LLM é mais confiável que regex ambíguo)
```

### 9.5 Via de chamada

A chamada LLM usa o `MettriBridgeClient.netFetch` para `https://api.openai.com/v1/chat/completions`, modelo `gpt-4o-mini`, temperature 0, max_tokens 300. A chave API é lida de `chrome.storage.local` via `bridge.storageGet(['mettri:openai:apiKey'])`.

### 9.6 Erros

| Condição | Comportamento |
|----------|---------------|
| API key não configurada | `usaLLM = false`, campos restantes permanecem `desconhecido` |
| Timeout ou falha de rede | `usaLLM = false`, log de erro, campos restantes como estão |
| JSON mal formatado na resposta | Tentar extrair JSON com regex `\{.*\}`, se falhar → descartar |
| Teto diário atingido | `usaLLM = false`, log, campos restantes como estão |

## 10. Dependências

- OpenAI API via MettriBridgeClient (mesmo padrão de `ai-suggestion.ts`)
- Chrome storage local para chave API

## 11. Referências

- spec.md (pai): arquitectura geral do Ouvinte
- validador-catalogo.zenspec.md: validação contra catálogo
- ai-suggestion.ts (retomar): padrão de chamada OpenAI via bridge