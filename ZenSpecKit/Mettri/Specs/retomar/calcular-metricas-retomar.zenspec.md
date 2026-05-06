# Calcular métricas de resposta do Retomar (`retomarMetricsResolver`)

Esta feature existe para que o **painel Retomar** consiga exibir contagens e taxas de resposta por janela de tempo (e opcionalmente por ciclo) **sem** embutir regras de leitura do `messageDB` na UI.  
Metáfora: `retomarMetricsResolver` é o **balanço** que some só as vendas (envios) que batem com o recibo certo e mede quanto tempo o cliente demorou a “devolver” a primeira vez.

---

## Conceito

O Retomar regista cada envio no `messageDB` com `retomarMeta` (conta, ciclo, variante, etc.).  
Este programa agrega esses envios num intervalo `[since, until]`, cruza com mensagens **recebidas** do mesmo `chatId` e devolve números prontos para o painel: quantos envios, quantos tiveram primeira resposta, taxa percentual e tempo médio até essa primeira resposta.  
Não interpreta compra, abertura nem reação — só **envio Retomar** vs **primeira mensagem incoming** posterior.

---

## Pipeline & fluxos

```
messageDB (leituras agregadas)  →  retomarMetricsResolver  →  painel Retomar
```

| Programa | Recebe | Faz | Manda para |
| -------- | ------ | --- | ---------- |
| `retomarMetricsResolver` | `accountId`, `since`, `until`, `messageDB` e opcionalmente `cycleIndex` | Filtra envios Retomar na janela; por envio, encontra primeira incoming no mesmo chat; calcula contagens, taxa e média em minutos | UI do painel (bloco Métricas), gráficos futuros, etc. |

**Operações esperadas sobre `messageDB` (dependência abstraída):**

- Leitura de envios Retomar na janela (equivalente conceitual a `getRetomarSends`): mensagens outgoing com `retomarMeta` definido, filtradas por `retomarMeta.accountId`, `sentAt` dentro de `[since, until]` e, se `cycleIndex` vier preenchido, `retomarMeta.cycleIndex === cycleIndex`.
- Leitura do histórico por chat (equivalente a `getMessagesPorChat` / `getMessages(chatId)`): lista ordenável de mensagens do chat para localizar a primeira incoming após cada envio.

A implementação pode usar uma ou várias queries desde que o resultado seja determinístico e equivalente às regras abaixo.

---

## Lógica

### `retomarMetricsResolver`

#### Linha do fluxo

```
messageDB  →  retomarMetricsResolver  →  métricas agregadas
```

#### Contrato

Entrada:

- `accountId`: `string` — conta ativa; só entram envios com `retomarMeta.accountId === accountId`.
- `since`: `number` — início da janela (epoch ms ou contrato unificado do messageDB; ver nota).
- `until`: `number` — fim da janela **inclusivo** no mesmo domínio de `since` (envio entra se `since <= sentAt <= until`).
- `cycleIndex`: `number | undefined` — se **omitido**, agrega todos os ciclos; se **definido** (1–4), restringe a envios com `retomarMeta.cycleIndex === cycleIndex`.
- `messageDB`: `MessageDB` — dependência de leitura; sem escrita.

Saída:

- `sentCount`: `number` — inteiro ≥ 0, quantidade de envios Retomar que entram na janela e nos filtros acima.
- `respondedCount`: `number` — inteiro ≥ 0, subconjunto dos envios contados em `sentCount` que possuem **pelo menos uma** mensagem **incoming** (`isOutgoing === false`) **depois** desse envio no mesmo `chatId`, segundo a ordenação R2.
- `responseRate`: `number` — percentual `respondedCount / sentCount * 100`, arredondamento **não** prescrito na UI; na camada de programa usar número em ponto flutuante. **Se `sentCount === 0` → `responseRate = 0`** (evita divisão por zero).
- `avgResponseTimeMinutes`: `number | null` — média dos tempos de resposta **somente** dos envios em `respondedCount`; cada tempo = `(primeiraIncoming.timestamp - envio.timestamp)` convertido para **minutos** (fração permitida). **Se `respondedCount === 0` → `null`** (não usar `0`).

**Unidade de tempo:** timestamps das mensagens no mesmo referencial (ex. ms desde epoch). Conversão para minutos: `(tResposta - tEnvio) / 60000`.

Erros:

- Falha ao ler `messageDB` (rede, I/O, exceção) → **falha explícita** (propagar erro; sem valores parciais silenciosos).
- `since > until` → falha explícita.
- `cycleIndex` definido e fora de 1–4 → falha explícita.

#### Regras

R1 — **Só leitura:** nenhum efeito colateral em `messageDB`.  
R2 — **Ordem total no chat:** construir ordem determinística entre mensagens do mesmo `chatId`: primeiro por `timestamp` crescente; se empate, desempate por `messageId` (ou id estável do registo) **lexicograficamente crescente**. Toda referência a “antes/depois” usa esta ordem.  
R3 — **Conjunto de envios:** mensagens outgoing com `type` compatível com envio Retomar gravado pelo painel, `retomarMeta` presente, `retomarMeta.accountId === accountId`, `sentAt` (timestamp do envio) com `since <= sentAt <= until`, e filtro opcional de `cycleIndex`. Cada registo de envio válido conta **uma** vez em `sentCount`.  
R4 — **Primeira resposta após o envio:** para cada envio E, a primeira mensagem incoming na ordenação R2 que apareça **estritamente depois** de E é a resposta usada. Se não existir incoming depois de E → esse envio não entra em `respondedCount`.  
R5 — **Múltiplos envios no mesmo chat na janela:** cada envio é avaliado **individualmente**; um mesmo chat pode contribuir com vários envios e várias respostas.  
R6 — **Taxa:** `responseRate = sentCount === 0 ? 0 : (respondedCount / sentCount) * 100`.  
R7 — **Média:** `avgResponseTimeMinutes = respondedCount === 0 ? null : média aritmética dos deltas em minutos só dos envios respondidos`.  
R8 — **Determinismo:** mesmas entradas e mesmo estado de `messageDB` → mesma saída.

#### Edge cases (Se X → Y)

- `sentCount === 0` → `respondedCount = 0`, `responseRate = 0`, `avgResponseTimeMinutes = null`.
- Vários envios no mesmo `chatId` na janela → cada um avaliado em separado; a “primeira incoming depois” é relativa **àquele** envio.
- Várias incoming após o mesmo envio → só a **primeira** na ordem R2 entra no delta.
- Incoming **antes** do envio na ordem R2 → ignoradas para esse envio; só conta incoming **depois**.
- Empate de timestamp entre envio e incoming → desempate R2 decide quem vem primeiro; incoming só conta se estiver **depois** do envio na ordem.
- Mensagem sem `timestamp` válido → falha explícita ou exclusão do registo conforme contrato do messageDB; **não** inventar timestamp.

#### Critérios de aceitação

- Dado um único envio na janela e uma incoming depois dele com delta de 120_000 ms → `sentCount = 1`, `respondedCount = 1`, `responseRate = 100`, `avgResponseTimeMinutes = 2`.
- Dado um envio na janela e nenhuma incoming depois → `sentCount = 1`, `respondedCount = 0`, `responseRate = 0`, `avgResponseTimeMinutes = null`.
- Dado `sentCount = 0` → `responseRate = 0` e `avgResponseTimeMinutes = null`.
- Dado dois envios no mesmo chat e uma incoming só depois do segundo → primeiro envio não respondido, segundo respondido; contagens refletem isso.
- Dado erro de leitura do `messageDB` → exceção ou erro explícito, sem retorno “sucesso” com zeros silenciosos.

---

## Escopo fora

- `openRate` (leitura / visto).
- Reações (emoji etc.) até existirem no modelo de mensagem.
- Engajamento agregado (cliques, links) não especificado aqui.
- Conversão por compra ou atribuição de receita.
- Persistência de agregados (este programa só calcula sob demanda).
- Arredondamento visual da taxa ou da média na UI (responsabilidade da camada de apresentação).

---

## Nota de alinhamento com a spec mãe

Regras de negócio e o que o painel mostra ou oculta neste ciclo estão em `ZenSpecKit/Mettri/Specs/retomar/spec.md` (secção **Métricas de resposta** e bullet **Métricas (este ciclo)** na Interface). Em conflito, a spec mãe prevalece para produto; esta filha prevalece para contrato técnico do programa.
