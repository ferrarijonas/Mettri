# Plano: Revisão Completa dos Testes de Módulos

## Objetivo
Revisar todos os módulos do teste e garantir que estão 1/1 com a referência (reverse.txt) e WA Web Plus.

## Módulos com Testes Funcionais (✅)
1. **Msg** - ✅ Funcionando
2. **Contact** - ✅ Funcionando
3. **Label** - ✅ Funcionando
4. **Chat** - ✅ Funcionando
5. **ChatCollection** - ✅ Funcionando
6. **PresenceCollection** - ✅ Ajustado (eventos reativos + fallback)
7. **GroupMetadata** - ✅ Funcionando
8. **User** - ✅ Funcionando
9. **sendTextMsgToChat** - ✅ Funcionando
10. **addAndSendMsgToChat** - ✅ Funcionando

## Módulos SEM Testes Funcionais (❌)

### Nível 3: Core
- **Conn** - Conexão com servidores

### Nível 4: Mensagens
- **MsgKey** - Cria IDs de mensagem
- **SendDelete** - Envia ou deleta mensagens

### Nível 5: Mídia
- **uploadMedia** - Envia mídia
- **MediaPrep** - Prepara mídia
- **MediaObject** - Objeto de mídia
- **MediaTypes** - Tipos de mídia
- **MediaCollection** - Coleção de mídia
- **UploadUtils** - Utilitários de upload
- **DownloadManager** - Gerenciador de download
- **OpaqueData** - Dados opacos

### Nível 6: Contatos
- **blockContact** - Bloqueia contato
- **VCard** - Cartão de contato
- **UserConstructor** - Construtor de usuário

### Nível 7: Chat/Estado
- **ChatState** - Estado do chat (digitando, etc)
- **Presence** - Presença (diferente de PresenceCollection)
- **createGroup** - Cria grupo
- **getParticipants** - Obtém participantes

### Nível 8: Utilitários
- **WidFactory** - Cria WIDs
- **QueryExist** - Verifica existência
- **USyncQuery** - Query de sincronização
- **USyncUser** - Sincronização de usuário
- **getEphemeralFields** - Campos efêmeros
- **canReplyMsg** - Pode responder mensagem

### Nível 9: Links/Preview
- **genMinimalLinkPreview** - Preview de link
- **findFirstWebLink** - Encontra primeiro link
- **getSearchContext** - Contexto de busca

### Nível 10: Interações
- **sendReactionToMsg** - Envia reação
- **colorIndexToHex** - Cor para hex

### Nível 11: Status
- **StatusUtils** - Utilitários de status
- **Composing** - Digitando
- **ConversationSeen** - Conversa vista
- **Playing** - Tocando
- **StatusState** - Estado de status

### Nível 12: Seletores
- **Classes** - Classes CSS

### Nível 13: Comandos
- **Cmd** - Comandos do WhatsApp

## Como a Referência Usa Cada Módulo

### reverse.txt (linhas 328-367)

```javascript
N.Conn = Ct.findExport("Conn")?.Conn,
N.SendDelete = Ct.findExport("sendDelete")?.SendDelete,
N.MsgKey = Ct.find(t => t.default && t.default.newId)?.default,
N.OpaqueData = Ct.find(t => t.default && t.default.createFromData)?.default,
N.MediaPrep = Ct.findExport("prepRawMedia"),
N.MediaObject = Ct.findExport("getOrCreateMediaObject"),
N.uploadMedia = Ct.findExport("uploadMedia")?.uploadMedia,
N.Cmd = Ct.findExport("Cmd")?.Cmd,
N.MediaTypes = Ct.findExport("msgToMediaType"),
N.VCard = Ct.findExport("vcardFromContactModel"),
N.UserConstructor = Ct.find(t => t.default && t.default.prototype && t.default.prototype.isServer && t.default.prototype.isUser ? t.default : null)?.default,
N.WidFactory = Ct.findExport("createWid"),
N.blockContact = Ct.findExport("blockContact")?.blockContact,
N.UploadUtils = Ct.find(t => t.default && t.default.encryptAndUpload ? t.default : null)?.default,
N.DownloadManager = Ct.findExport("downloadManager")?.downloadManager,
N.QueryExist = Ct.findExport("queryExist"),
N.USyncQuery = Ct.findExport("USyncQuery")?.USyncQuery,
N.USyncUser = Ct.findExport("USyncUser")?.USyncUser,
N.getEphemeralFields = Ct.findExport("getEphemeralFields")?.getEphemeralFields,
N.Presence = Ct.findExport("sendPresenceAvailable"),
N.ChatState = Ct.findExport("sendChatStateComposing"),
N.createGroup = Ct.findExport("createGroup")?.createGroup,
N.canReplyMsg = Ct.findExport("canReplyMsg")?.canReplyMsg,
N.MediaCollection = Ct.find(t => t.default && t.default.prototype && void 0 !== t.default.prototype.processAttachments ? t.default : null)?.default,
N.getParticipants = Ct.findExport("getParticipants")?.getParticipants,
N.genMinimalLinkPreview = Ct.findExport("genMinimalLinkPreview")?.genMinimalLinkPreview,
N.findFirstWebLink = Ct.findExport("findFirstWebLink")?.findFirstWebLink,
N.getSearchContext = Ct.findExport("getSearchContext")?.getSearchContext,
N.sendReactionToMsg = Ct.findExport("sendReactionToMsg")?.sendReactionToMsg,
N.colorIndexToHex = Ct.findExport("colorIndexToHex")?.colorIndexToHex,
N.StatusUtils = Ct.findExport("setMyStatus"),
N.Composing = Ct.findExport("markComposing"),
N.ConversationSeen = Ct.findExport("sendConversationSeen"),
N.Playing = Ct.findExport("markPlayed"),
N.StatusState = Ct.findExport("markStatusRead"),
N.Cmd = Ct.findExport("Cmd")?.Cmd,
```

## Prioridades para Implementar Testes

### Alta Prioridade (Funcionalidades Core)
1. **Cmd** - Comandos (marcar lida, arquivar, etc) - muito usado
2. **Conn** - Conexão (status de conexão)
3. **ChatState** - Estado do chat (digitando, gravando)
4. **Presence** - Presença individual (diferente de PresenceCollection)
5. **createGroup** - Criar grupo
6. **getParticipants** - Participantes de grupo

### Média Prioridade (Utilitários Importantes)
7. **MsgKey** - Criar IDs de mensagem
8. **WidFactory** - Criar WIDs
9. **QueryExist** - Verificar existência
10. **canReplyMsg** - Pode responder
11. **blockContact** - Bloquear contato
12. **VCard** - Cartão de contato

### Baixa Prioridade (Funcionalidades Específicas)
13. **uploadMedia** - Enviar mídia
14. **MediaPrep** - Preparar mídia
15. **MediaObject** - Objeto de mídia
16. **MediaTypes** - Tipos de mídia
17. **MediaCollection** - Coleção de mídia
18. **UploadUtils** - Utilitários
19. **DownloadManager** - Download
20. **OpaqueData** - Dados opacos
21. **UserConstructor** - Construtor
22. **SendDelete** - Deletar mensagem
23. **USyncQuery** - Sincronização
24. **USyncUser** - Sincronização usuário
25. **getEphemeralFields** - Campos efêmeros
26. **genMinimalLinkPreview** - Preview de link
27. **findFirstWebLink** - Encontrar link
28. **getSearchContext** - Contexto de busca
29. **sendReactionToMsg** - Enviar reação
30. **colorIndexToHex** - Cor para hex
31. **StatusUtils** - Utilitários de status
32. **Composing** - Digitando
33. **ConversationSeen** - Conversa vista
34. **Playing** - Tocando
35. **StatusState** - Estado de status
36. **Classes** - Classes CSS

## Estratégia de Implementação

1. **Revisar módulos existentes** - Garantir que estão 1/1 com referência
2. **Implementar testes de alta prioridade** primeiro
3. **Seguir padrão da referência** para cada módulo
4. **Usar mesma estratégia** que funcionou para grupos e presença
