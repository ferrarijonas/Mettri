# WhatsApp Copiloto CRM (Extensão Chrome MV3)

MVP de extensão para **WhatsApp Web** com:

- **Copiloto IA (OpenAI)** via *service worker* (segredo fora do DOM)
- **Auto-responder** baseado em regras simples
- **CRM local** (contatos, tags, histórico e analytics) em `chrome.storage.local`

## Como carregar no Chrome

1. Abra `chrome://extensions`
2. Ative **Developer mode**
3. Clique **Load unpacked**
4. Selecione a pasta: `whatsapp-copilot-crm/`
5. Abra `https://web.whatsapp.com/`

## Onde fica o quê

- `manifest.json`: registro MV3, permissões e content scripts
- `background/service-worker.js`: OpenAI + config (`GET_CONFIG` / `SET_CONFIG`)
- `content/inject.js`: boot + bridge para o popup (`GET_CONTEXT`)
- `src/core/whatsapp-api.js`: seletores DOM + `sendMessage()` + leitura básica
- `src/core/dom-observer.js`: `MutationObserver` para novas mensagens
- `src/core/message-handler.js`: integra CRM + bot + copiloto
- `src/storage/local-storage.js`: abstração `chrome.storage` (Promise-based)
- `popup/`: dashboard/config

## Notas importantes (antifrágil)

- **Seletores do WhatsApp Web mudam**. Quando falhar, os logs indicam **quais seletores** foram tentados (ver `src/core/whatsapp-api.js`).
- **Sem “mock” de `chat_id` do WhatsApp**: quando o DOM não expõe um id estável, o contexto retorna `chatId: null` e o CRM/autoresposta degradam com logs.
- **Mock data (demo)**: apenas se não existir dado real (`src/mock/mock-data.js`).

