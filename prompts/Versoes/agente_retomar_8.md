# Gerar mensagem baseline de reativação (`retomarBaselineAgent`)

Esta feature existe para que a padaria consiga reativar clientes via WhatsApp com mensagens curtas, naturais e consistentes, sem depender de interpretação manual do histórico.

---

## Conceito

Gera uma mensagem curta sobre Pão, baseada no contexto já resolvido do cliente (`clientText` e `attendantText`), respeitando o estágio de relacionamento (ciclo) e o estilo de comunicação esperado.

A mensagem não pressiona, não explica demais e não nomeia emoções. Ela aparece e para.

---

## Lógica

### Pipeline

retomarContextResolver → retomarBaselineAgent → mensagem

| Programa               | Recebe                      | Faz           | Manda |
| ---------------------- | --------------------------- | ------------- | ----- |
| `retomarBaselineAgent` | contexto do cliente + ciclo | gera mensagem | saída |

---

## Contrato

Entrada:

- `firstName`: string
- `cycleIndex`: number (1–4)
- `lastRetomarSentText`: string?
- `clientText`: string
- `attendantText`: string?
- `promoAtiva`: string?

Saída:

- `message`: string

Erros:

- `CONTEXTO_INVALIDO` → se `clientText` vazio
- `GERACAO_INVALIDA` → se a mensagem final violar regras

---

## Regras

### Base estrutural

- Se mensagem não contiver "Pão" → inválida
- Se contiver tipo específico de pão ou adjetivo fixo → inválida
- Se "Pão" não estiver com P maiúsculo → inválida

---

### Tamanho

- Se <3 palavras → inválida
- Se >20 palavras → inválida
- Entre 3 e 14 → válida
- 15–20 → válida se natural

---

### Tom

- Se não contiver linguagem informal (ex: “vc”, “pra”, “tá”, “né”) → inválida
- Se linguagem corporativa → inválida
- Se estrutura formal completa → inválida

---

### Voz

- Se nomear emoção → inválida
- Se tentar convencer ou pressionar → inválida
- Se tiver mais de uma intenção → inválida

---

### Intenção (Gesto)

Permitido apenas um:

- Informar

- Perguntar

- Aparecer

- Se tiver mais de um → inválida

---

### Âncora

Possíveis:

- Produto
- Hábito
- Momento
- Nada
- Promo

Regras:

- Se âncora = Nada e vínculo ≠ Reconhecimento → inválida
- Se `promoAtiva` existir → pode influenciar

---

### Vínculo

Classificação implícita (não exposta):

- Reconhecimento
- Vizinhança
- Familiaridade

Regra:

- Se não houver evidência suficiente → usar Reconhecimento

---

### Ciclos (determinístico)

`cycleIndex` é definido externamente pelo motor (rangeIndex + 1).

#### Regras por ciclo:

- Se `cycleIndex = 1` → não pode pressionar nem pedir resposta direta
- Se `cycleIndex = 2` → pode informar ou perguntar
- Se `cycleIndex = 3` → pode usar maior proximidade (sem exagero)
- Se `cycleIndex = 4` → deve encerrar sem expectativa futura

#### Regra de encerramento (ciclo 4):

- Se abrir continuidade → inválida
- Deve permitir fechamento implícito (ex: disponibilidade sem insistência)

---

### Rotação de gesto

- Se `lastRetomarSentText` existir → inferir gesto anterior
- Se gesto atual = anterior → rotacionar:
  - Informar → Perguntar
  - Perguntar → Aparecer
  - Aparecer → Informar

#### Precedência:

- Se rotação conflitar com regra do ciclo → ignorar rotação e respeitar ciclo

---

### Similaridade

- Se estrutura parecida com `lastRetomarSentText` → inválida

---

### Perfil (derivado do contexto)

- Se cliente direto → Informar
- Se cliente pergunta → Perguntar
- Se cliente leve → Aparecer

Se `lastRetomarSentText` vazio → usar perfil como base do gesto

---

### Emoji

- Se cliente não usa → não usar
- Se usa consistentemente → pode usar

---

### Proibições

- Pressupor pedido → inválida
- Soar como confirmação/preparo → inválida
- Indicar posse (“seu Pão”) → inválida
- Repetir estrutura anterior → inválida
- Emoji sem evidência → inválida

---

### Normalização final

- Remover aspas
- Retornar apenas texto

---

## Edge cases

- `clientText` vazio → `CONTEXTO_INVALIDO`
- `attendantText` ausente → válido
- `lastRetomarSentText` vazio → usar perfil direto
- `promoAtiva` ausente → ignorar
- Conflito ciclo vs rotação → ciclo vence

---

## Critérios de aceitação

- Contém "Pão" (P maiúsculo)
- Apenas uma intenção
- Sem emoção explícita
- Entre 3 e 20 palavras
- Compatível com ciclo
- Não repete estrutura anterior
- Linguagem informal presente
- Passa em todas as regras

---

## Escopo fora

- Envio de mensagem
- Persistência
- Retry / múltiplas tentativas
- Leitura direta do histórico bruto
- Aprendizado automático
