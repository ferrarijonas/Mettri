# Lógica de Exibição de Nome no Atendimento

## O que funciona (aprovado)

Quando o contato tem **display name cadastrado no WhatsApp** (ex.: ~Nome, nome no perfil), o painel exibe corretamente esse nome.

### Fluxo

1. **getWhatsAppName(chatId)** – Busca o nome no modelo do WhatsApp:
   - Chat ativo (`Chat.getActive`) → `active`, `active.contact`
   - Chat (`Chat.get` / `Chat.find`) → `chat`, `chat.contact`
   - Contato (`Contact.get`) → objeto do contato
   - Campos priorizados: `formattedShortNameWithNonContact`, `formattedShortName`, `formattedTitle`, `formattedName`, `name`, `pushName`, `pushname`, `notifyName`, `displayName`, etc.

2. **resolveClientByChatId** – Busca cadastro no ClientDB:
   - `getByWhatsAppChatId(chatId)`
   - Se não achar: `getByPhoneDigits` / `getByKey` com aliases (normalização 9/sem 9, +55)
   - Para **@lid**: se `phoneDigits` for null, usa `getPhoneForLid(chatId)` para obter telefone do Contact

3. **displayName** – Prioridade:
   ```
   waName || pickStrongDisplayName(record, waName, phoneDigits)
   ```
   - `waName` = nome do WhatsApp (display name nativo)
   - `pickStrongDisplayName`: cadastro (firstName, fullName, nickname) → waName → telefone → "Sem nome"

### Arquivos

- `src/modules/atendimento/dashboard/provider.ts` – `getWhatsAppName`, `extractDisplayNameFromContact`, `getPhoneFromContactForLid`
- `src/modules/atendimento/dashboard/client-resolver.ts` – `pickStrongDisplayName`, `resolveClientByChatId` (aceita `getPhoneForLid`)

---

## Bug 1: Aparece "Pão de Verdade" para quem não tem ✅ Resolvido

**Print:** Chat com Jonas (+55 34 9197-7818), mas o painel mostra "Pão Verdade" em vez de "Jonas".

**Causa confirmada:** Record incorreto no ClientDB (nome do negócio no lugar do cliente).

**Solução:** Botão **Resetar** no painel Cadastro (Clientes). Limpa todo o ClientDB. Após resetar, reimporte os dados corretamente.

---

## Bug 2: Aparece "Sem nome" para quem não tem ✅ Resolvido

**Print:** Chat com +55 34 9196-5598 (Sílvia), identificador `208452697763900@lid`, "Sem cadastro", painel mostrava "Sem nome".

**Causa:** ChatId é **@lid** → `phoneDigits = null` (não extraímos do ID). Sem cadastro e sem waName → "Sem nome".

**Solução:** Fallback implementado. Para contatos @lid sem cadastro, não temos nem `phoneDigits` nem `waName`. A regra desejada (“sem nome → exibe número”) não se aplica — ver seção Fallback abaixo.


**Caso Sílvia:** O nome estava no texto da mensagem, não no perfil. Com o fallback, o número passa a aparecer se o Contact tiver esse dado.

---

## Fallback para @lid (implementado)

### Implementação

A função `getPhoneFromContactForLid(chatId)` em `provider.ts` tenta extrair o telefone do Contact quando o chat é @lid:

1. **Chat ativo** (`Chat.getActive`) → `active`, `active.contact`
2. **Chat** (`Chat.get` / `Chat.find`) → `chat`, `chat.contact`
3. **Contact** (`Contact.get`) com wid/chatId

**Campos verificados:** `phoneNumber`, `formattedPhoneNumber`, `pn`, `formattedPhone`, `__x_phoneNumber`, `__x_formattedPhoneNumber`, `__x_pn`.

O resultado é passado para `resolveClientByChatId` via `getPhoneForLid`. Se retornar 10+ dígitos, é normalizado e usado como `phoneDigits`, permitindo exibir o número em vez de "Sem nome".

### Referência (pesquisa 2025/2026)

**Baileys 6.8.0:** Contact com `id` LID pode ter `phoneNumber`.  
**whatsapp-web.js:** `getContactLidAndPhone` existe mas tem bugs (issue #3857).  
**APIs (Wawp):** Endpoints de mapeamento LID↔telefone; não aplicáveis a extensão.
