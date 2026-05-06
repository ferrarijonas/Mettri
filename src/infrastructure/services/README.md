# Services (WhatsApp)

Serviços de acesso ao WhatsApp Web, usáveis por qualquer módulo da extensão.

## Serviços disponíveis

### Envio de mensagens
- `sendMessageService.sendText(chatId, text)` – envia mensagem de texto no WhatsApp

### Captura de mensagens
- `MessageCapturer` – captura mensagens em tempo real via `Msg.on("add")`
- `DataScraper` – intercepta eventos de mensagens, presença e mudança de chat
- `capturedMessage` expõe `replyToId`, `quotedText`, `quotedSender` quando a mensagem capturada é uma **resposta (reply)** a uma mensagem anterior

### Webhook (WA-Sync)
- `webhookService.sendMessage(message, eventType)` – exporta mensagens capturadas em tempo real

## Metadados de Reply

Desde a versão com a spec `extrair-metadados-de-reply-whatsapp.zenspec.md`, toda `CapturedMessage` pode conter:

| Campo | Tipo | Origem | Descrição |
|-------|------|--------|-----------|
| `replyToId` | `string \| undefined` | `msg.quotedStanzaID` | ID da mensagem original sendo respondida |
| `quotedText` | `string \| undefined` | `msg.quotedMsg.body` | Texto da mensagem original (truncado em 500 chars) |
| `quotedSender` | `string \| undefined` | `msg.quotedParticipant._serialized` | Quem enviou a mensagem original |

Esses campos são opcionais e só aparecem quando a mensagem é um reply explícito.
Fluem automaticamente para MessageDB e Webhook sem alteração no pipeline.
