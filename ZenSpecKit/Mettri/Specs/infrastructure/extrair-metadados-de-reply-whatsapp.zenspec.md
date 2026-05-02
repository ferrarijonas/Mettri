# Extrair metadados de reply do WhatsApp (`extrairReplyMetadata`)

Esta feature existe para que qualquer programa consumidor (webhook, módulo de análise, retomar, atendimento) consiga identificar quando uma mensagem é uma **resposta direta a uma mensagem anterior**, sem precisar acessar o modelo interno do WhatsApp.

Metáfora: é como o "fio-condutor" do carteiro — cada carta traz anotado a que carta anterior ela responde.

---

## Conceito

O WhatsApp Web anexa metadados de contexto a mensagens que são replies explícitas (quando o usuário "responde" a uma mensagem específica). Esses metadados estão disponíveis como getters no protótipo dos objetos mensagem do Store do WhatsApp (`Msg` collection):

- `quotedStanzaID` — ID de 20 caracteres da mensagem original
- `quotedParticipant` — quem enviou a mensagem original (`{_serialized}`)
- `quotedMsg` — modelo completo da mensagem original (se carregado no Store)
- `quotedRemoteJid` — chat onde está a mensagem original
- `isQuotedMsgAvailable` — true se a quoted msg está no Store

O sistema de captura atual (`MessageCapturer` + `DataScraper`) já recebe o objeto raw do WhatsApp via `Msg.on("add")`. Este programa extrai esses getters e os incorpora ao `CapturedMessage` padronizado, que flui para MessageDB e webhook sem alterar o pipeline existente.

---

## Pipeline & fluxos

```
Msg.on("add") raw msg  →  extrairReplyMetadata  →  CapturedMessage enriquecido  →  MessageDB + Webhook
```

| Programa | Recebe | Faz | Manda para |
| -------- | ------ | --- | ---------- |
| `extrairReplyMetadata` | raw msg do WhatsApp | lê `quotedStanzaID`, `quotedParticipant`, `quotedMsg` do protótipo; produz campos opcionais de reply | `CapturedMessage` (via `MessageCapturer.processInterceptedMessage`) |

---

## Lógica

### `extrairReplyMetadata`

Executado **dentro** de `MessageCapturer.processInterceptedMessage()` a cada mensagem capturada.

#### Contrato

Entrada:

- `msg: any` — objeto raw do WhatsApp (modelo da coleção `Msg`, com getters de protótipo disponíveis)

Saída (campos opcionais injetados em `CapturedMessage`):

- `replyToId: string | undefined` — valor de `msg.quotedStanzaID` quando presente e não vazio
- `quotedText: string | undefined` — `msg.quotedMsg?.body` ou `msg.quotedMsg?.__x_body` quando disponível (truncado em 500 caracteres)
- `quotedSender: string | undefined` — nome do participante da quoted msg, resolvido de `msg.quotedParticipant?._serialized` quando presente

Erros:

- Nenhum: se getters não existirem ou lançarem exceção, campos ficam `undefined` (comportamento seguro)

#### Regras

R1 — **Getter de protótipo**: acessar `quotedStanzaID`, `quotedParticipant`, `quotedMsg` como propriedades do objeto (são getters definidos no protótipo do modelo), não como `__x_*` (que são os backing fields).

R2 — **Somente leitura, sem falha**: Se qualquer getter lançar exceção (objeto parcialmente carregado, protótipo ausente), capturar o erro e deixar o campo como `undefined`. Nunca abortar o fluxo de captura.

R3 — **Campos sempre opcionais**: Os campos de reply no schema Zod e TypeScript são `optional()`. Mensagens sem reply produzem `CapturedMessage` idêntico ao atual (backward compatible). Mensagens com reply produzem o mesmo objeto com campos extras preenchidos.

R4 — **Truncagem de `quotedText`**: Se o texto da quotedMsg exceder 500 caracteres, truncar mantendo string UTF-8 válida. Isso evita payloads excessivos no webhook e no MessageDB sem perder o contexto da reply.

R5 — **Fluxo no ecossistema**: Os campos extras fluem automaticamente para:
   - `MessageDB.saveMessage()` via spread em `messageToDBEntry()` — sem alteração
   - `webhookService.sendMessage()` — sem alteração
   - `onMessage()` callbacks — sem alteração

#### Mapa de extração (raw msg → CapturedMessage)

| Getter do protótipo | Campo CapturedMessage | Tratamento |
|---------------------|----------------------|------------|
| `msg.quotedStanzaID` | `replyToId` | `string` se presente, senão `undefined` |
| `msg.quotedParticipant?._serialized` | `quotedSender` | Extrair nome legível do serialized (ex: `5511999999999@c.us`), senão `undefined` |
| `msg.quotedMsg?.body` | `quotedText` | Truncar em 500 chars; fallback para `msg.quotedMsg?.__x_body` |

#### Edge cases (Se X → Y)

- Mensagem SEM reply (todos os getters `undefined`/vazios) → campos de reply `undefined`, CapturedMessage idêntico ao atual.
- `quotedStanzaID` presente mas `quotedMsg` não carregado (isQuotedMsgAvailable = false) → `replyToId` preenchido, `quotedText` = `undefined`, `quotedSender` preenchido se disponível.
- `quotedParticipant` é objeto sem `_serialized` → `quotedSender` = `undefined`.
- `quotedMsg.body` é string vazia → `quotedText` = `undefined`.
- Getter `quotedStanzaID` lança exceção → todos os campos de reply = `undefined`, fluxo continua normalmente.
- Texto quoted > 500 caracteres → `quotedText` truncado em 500 chars UTF-8 válidos.
- Mensagem é do tipo mídia (imagem/áudio) sem `body` no quotedMsg → `quotedText` = `undefined`, `replyToId` ainda é populado.

#### Critérios de aceitação

- Dado uma mensagem que é reply a outra, `CapturedMessage` gerado contém `replyToId` igual ao `quotedStanzaID` da msg original.
- Dado uma mensagem que NÃO é reply, `CapturedMessage` gerado não contém campos de reply (são `undefined`).
- Dado um erro ao acessar getter de reply, o fluxo de captura não é interrompido e a mensagem é processada sem campos de reply.
- Dado `quotedText` > 500 chars, o valor em `CapturedMessage` tem no máximo 500 caracteres.
- Dado webhook habilitado, mensagens com reply têm os campos extras no payload JSON.

---

## Dependências

- `Msg` collection do WhatsApp Web (acessada via `window.Mettri.Msg` / `whatsappInterceptors.Msg`)
- Getters de protótipo: `quotedStanzaID`, `quotedParticipant`, `quotedMsg` — fornecidos pelo modelo interno do WhatsApp
- Schema: `CapturedMessageSchema` em `src/types/schemas.ts`

---

## Escopo fora

- Rastreamento de ack (delivered/read) da mensagem.
- Resolução do texto quoted quando `isQuotedMsgAvailable = false`.
- Envio de mensagens com reply (quote) — apenas leitura dos metadados.
- Detecção de replies em mensagens do próprio usuário (já funcionaria, mas sem caso de uso definido).
- Histórico de reply chains (árvore de replies).

---

## Nota de alinhamento

Os campos `replyToId`, `quotedText`, `quotedSender` são definidos **nesta spec** e devem ser adicionados ao `CapturedMessageSchema` e `MessageDBEntrySchema` em `src/types/schemas.ts`. O código de extração vive em `src/core/message-capturer.ts` dentro do método `processInterceptedMessage`.

A decisão de produto (quem consome esses metadados, qual ação tomar ao detectar reply) vive nas specs consumidoras (`atendimento/`, `retomar/`, etc.). Esta spec cobre **apenas** a captura e disponibilização dos metadados brutos.
