# DATA EXPORT FORMAT (v1) — Mettri

Este documento define o **formato canônico** (termo técnico) para exportar mensagens em lote, com compatibilidade futura para **warehouse** e **banco operacional**.

Metáfora: cada mensagem é um **recibo**. O arquivo de export é uma **pilha de recibos**, um por linha.

## Formato do arquivo: JSONL / NDJSON
- **1 linha = 1 evento JSON**
- Extensão recomendada: `.jsonl`
- MIME recomendado: `application/x-ndjson`

## Envelope do evento (schemaVersion = 1)

Cada linha do arquivo é um JSON com o seguinte envelope:

```json
{
  "schemaVersion": 1,
  "eventType": "message",
  "tenantId": "local",
  "instanceId": "5511999999999@c.us",
  "ingestedAt": "2026-01-29T12:34:56.789Z",
  "message": {
    "id": "false_5531..._3A65218D...",
    "chatId": "5531...@c.us",
    "chatName": "João",
    "sender": "João",
    "text": "Oi",
    "timestamp": "2026-01-29T12:34:00.000Z",
    "isOutgoing": false,
    "type": "text"
  }
}
```

### Campos obrigatórios
- **schemaVersion**: número da versão do contrato.
- **eventType**: `"message"` (eventos futuros podem coexistir).
- **tenantId**: identificador da empresa (multi-tenant).
- **instanceId**: identificador da instância/número WhatsApp (ex.: WID).
- **ingestedAt**: quando o Mettri exportou/ingestou este evento (ISO 8601).
- **message**: payload de mensagem (ver abaixo).

## Payload `message` (base: `CapturedMessage`)
Origem: `[src/types/schemas.ts](../src/types/schemas.ts)` (`CapturedMessageSchema`).

Regras:
- **timestamp**: sempre **string ISO 8601** no arquivo (JSON não tem `Date`).
- **isOutgoing**: `true` = você (conta) falou; `false` = cliente falou.

## Ordenação (sequência da conversa)
O export gera linhas em ordem:
1) `message.timestamp` crescente (mais antigo → mais novo)  
2) em empate, `message.id` crescente (tie-break)

Metáfora: `timestamp` é o “relógio”; `id` é a “senha” para desempate.

## Idempotência (evitar duplicatas)
Chave de deduplicação recomendada:
- **`(tenantId, instanceId, message.id)`**

Se você importar o mesmo arquivo duas vezes, basta “ignorar se já existe”.

## Convenção de nomes de arquivo
Padrão recomendado:
- `mettri-batch-<instanceId_sanitizado>-YYYY-MM-DD-<seq>.jsonl`

Exemplo:
- `mettri-batch-5511999999999_c_us-2026-01-29-001.jsonl`

## Estado de export local (cursor)
O export incremental usa um cursor armazenado em `chrome.storage.local`:
- chave: `mettri_export_state_v1`
- campo: `lastCursorIso`

Metáfora: é o “marcador de página” para não exportar a mesma coisa duas vezes.

## Retenção local (IndexedDB)
No Mettri, o armazenamento local é um **cache**:
- **90 dias ou 10.000 mensagens** (o que estourar primeiro)

O objetivo do arquivo `.jsonl` é ser o “arquivo de longo prazo”.

