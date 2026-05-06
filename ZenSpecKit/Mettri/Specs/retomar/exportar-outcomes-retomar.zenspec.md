# Exportar outcomes respondidos do Retomar (`retomarOutcomeExporter`)

Esta feature existe para criar uma cópia local robusta e “IA friendly” dos casos de Retomar que tiveram resposta, em formato fácil de analisar e reutilizar.
Metáfora: é o “livro-caixa” diário das tentativas que deram retorno.

---

## Conceito

O Retomar já grava:
- envio outgoing com `retomarMeta` no `messageDB`;
- mensagens incoming do cliente no mesmo `messageDB`.

Este programa transforma esse histórico em eventos de outcome (envio + primeira resposta válida) e exporta para JSONL local por conta.

---

## Pipeline & fluxos

```
messageDB  →  resolver de outcomes  →  retomarOutcomeExporter  →  arquivo JSONL por conta
```

| Programa | Recebe | Faz | Manda para |
| -------- | ------ | --- | ---------- |
| `retomarOutcomeExporter` | `accountId`, janela de export, cursor de último export, writer local | encontra outcomes respondidos ainda não exportados, aplica truncagem, escreve JSONL append-only | arquivo local `retomar-outcomes-{accountId}.jsonl` |

---

## Lógica

### `retomarOutcomeExporter`

#### Contrato

Entrada:

- `accountId: string`
- `since: Date` / `until: Date` (janela da execução atual)
- `maxTextLength: number` (padrão recomendado: 500)
- `messageDB` com operações de leitura necessárias para:
  - listar envios Retomar da conta no intervalo;
  - ler mensagens por chat no intervalo;
- `writer` (adaptador de arquivo local) com operação append texto;
- `exportStateStore` (cursor/idempotência por conta).

Saída:

- `exportedCount: number`
- `skippedCount: number`
- `lastExportedAt: Date`
- `filePath: string`

Erros:

- falha ao ler `messageDB` → erro explícito;
- falha ao escrever arquivo → erro explícito (sem apagar dados operacionais);
- `accountId` inválido → erro explícito.

#### Regras

R1 — Exportar somente outcomes respondidos: cada linha representa um envio Retomar que teve primeira resposta incoming posterior (mesma regra base do cálculo de métricas).  
R2 — Um arquivo por conta: `retomar-outcomes-{accountId}.jsonl`.  
R3 — Formato JSONL obrigatório: uma linha JSON válida por outcome.  
R4 — Append-only: nunca reescrever histórico já válido neste ciclo (exceto manutenção futura fora de escopo).  
R5 — Idempotência: não duplicar outcome já exportado (usar `eventId` estável ou `sendMessageId` como chave canônica no estado por conta).  
R6 — Truncagem: `sendText` e `replyText` truncados para `maxTextLength`, preservando string válida UTF-8.  
R7 — Agenda automática: executar apenas em dias úteis, na primeira abertura após 10:00 (hora local), com app ativa.  
R8 — Reprocessamento seguro: se escrita falhar, manter cursor anterior; tentar de novo na próxima execução.  
R9 — Privacidade operacional: este ciclo permite `chatId`/número para análise de padrão; qualquer anonimização adicional fica para ciclo futuro.

#### Schema JSONL (linha por outcome)

```json
{
  "eventId": "retomar-outcome::<accountId>::<sendMessageId>",
  "accountId": "string",
  "chatId": "string",
  "chatName": "string|null",
  "phoneDigits": "string|null",
  "sendMessageId": "string",
  "replyMessageId": "string",
  "cycleIndex": 1,
  "variant": "A",
  "campaignLabel": null,
  "sentAt": "2026-03-26T13:10:00.000Z",
  "replyAt": "2026-03-26T13:25:00.000Z",
  "responseLagMinutes": 15,
  "sendText": "texto truncado...",
  "replyText": "texto truncado...",
  "exportedAt": "2026-03-26T13:30:00.000Z"
}
```

Campos mínimos obrigatórios para MVP: `eventId`, `accountId`, `chatId`, `sendMessageId`, `replyMessageId`, `cycleIndex`, `variant`, `sentAt`, `replyAt`, `responseLagMinutes`, `sendText`, `replyText`, `exportedAt`.

#### Edge cases (Se X → Y)

- sem outcomes respondidos na janela → `exportedCount = 0`, sem erro.
- primeiro boot sem estado de cursor → exporta outcomes da janela inicial definida pelo scheduler.
- arquivo inexistente → criar e append da primeira linha.
- envio respondido já exportado (reexecução) → ignorar por idempotência.
- reply sem texto útil → exportar `replyText` vazio/truncado, mantendo vínculo temporal.

#### Critérios de aceitação

- Dado 3 envios respondidos novos, exporter grava 3 linhas JSONL válidas no arquivo da conta.
- Dado reexecução sem novos outcomes, exporter não duplica linhas.
- Dado falha de escrita, cursor não avança e dados podem ser exportados na próxima execução.
- Dado texto longo, saída respeita truncagem configurada.

---

## Agendamento (MVP)

- Trigger: primeira abertura ativa do WhatsApp após 10:00, em dia útil local.
- Frequência: no máximo 1 execução automática por dia útil por conta.
- Pode existir ação manual “Exportar agora” no futuro (fora deste contrato mínimo).

---

## Escopo fora

- Upload para nuvem.
- Import automático de volta para reconstruir banco.
- Criptografia de arquivo no MVP.
- Export de envios não respondidos.
- Rotação avançada/compactação de arquivo.

---

## Nota de alinhamento com a spec mãe

A decisão de produto (catálogo, objetivo de IA/relatório, agenda e formato) vive em `ZenSpecKit/Mettri/Specs/retomar/spec.md`.  
Este documento define o contrato técnico do programa `retomarOutcomeExporter`.

