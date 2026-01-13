# 🛡️ Sentinela - Plano de Implementação Completo

> Plano detalhado para implementar todos os módulos, funcionalidades e melhorias necessárias para equiparar a referência.

---

## 📋 Estrutura do Plano

Este plano está organizado em **fases**, cada uma com:
- **Objetivo claro**
- **Critérios de sucesso**
- **Testes obrigatórios**
- **Validação antes de avançar**

**Regra de Ouro:** Não avançar para próxima fase sem validar completamente a anterior.

---

## 🎯 Fase 1: Módulos Extras (Prioridade ALTA)

### Objetivo
Implementar todos os módulos extras que a referência usa, um por um, com busca robusta, validação e testes.

### Critérios de Sucesso
- ✅ Módulo encontrado (por nome OU por características)
- ✅ Módulo validado (tem métodos esperados)
- ✅ Teste unitário passando
- ✅ Documentação atualizada
- ✅ Logs detalhados funcionando

### Ordem de Implementação

#### 1.1 N.Conn (Conexão)
**Referência:** Linha 309
```typescript
N.Conn = Ct.findExport("Conn")?.Conn
```

**Implementação:**
- Buscar por `findExport("Conn")`
- Validar que tem propriedade `Conn`
- Teste: Verificar que `N.Conn` existe e é objeto válido

**Critérios:**
- [ ] Getter implementado
- [ ] Busca robusta (nome + características)
- [ ] Teste unitário
- [ ] Validação funcionando
- [ ] Logs detalhados

---

#### 1.2 N.SendDelete (Deletar Mensagens)
**Referência:** Linha 310
```typescript
N.SendDelete = Ct.findExport("sendDelete")?.SendDelete
```

**Implementação:**
- Buscar por `findExport("sendDelete")`
- Validar que tem propriedade `SendDelete`
- Teste: Verificar que `N.SendDelete` é função

**Critérios:**
- [ ] Getter implementado
- [ ] Busca robusta
- [ ] Teste unitário
- [ ] Validação funcionando
- [ ] Logs detalhados

---

#### 1.3 N.uploadMedia (Enviar Mídia)
**Referência:** Linha 316
```typescript
N.uploadMedia = Ct.findExport("uploadMedia")?.uploadMedia
```

**Implementação:**
- Buscar por `findExport("uploadMedia")`
- Validar que tem propriedade `uploadMedia`
- Teste: Verificar que `N.uploadMedia` é função

**Critérios:**
- [ ] Getter implementado
- [ ] Busca robusta
- [ ] Teste unitário
- [ ] Validação funcionando
- [ ] Logs detalhados

---

#### 1.4 N.Cmd (Comandos)
**Referência:** Linha 317
```typescript
N.Cmd = Ct.findExport("Cmd")?.Cmd
```

**Implementação:**
- Buscar por `findExport("Cmd")`
- Validar que tem propriedade `Cmd`
- Validar métodos esperados: `markChatUnread`, `archiveChat`, `openChatAt`, `closeChat`, `chatInfoDrawer`
- Teste: Verificar que `N.Cmd` tem métodos esperados

**Critérios:**
- [ ] Getter implementado
- [ ] Busca robusta
- [ ] Validação de métodos esperados
- [ ] Teste unitário
- [ ] Logs detalhados

---

#### 1.5 N.MediaTypes (Tipos de Mídia)
**Referência:** Linha 318
```typescript
N.MediaTypes = Ct.findExport("msgToMediaType")
```

**Implementação:**
- Buscar por `findExport("msgToMediaType")`
- Teste: Verificar que `N.MediaTypes` é função

**Critérios:**
- [ ] Getter implementado
- [ ] Busca robusta
- [ ] Teste unitário
- [ ] Validação funcionando
- [ ] Logs detalhados

---

#### 1.6 N.UserConstructor (Construtor de Usuário)
**Referência:** Linha 320
```typescript
N.UserConstructor = Ct.find(t => 
  t.default && 
  t.default.prototype && 
  t.default.prototype.isServer && 
  t.default.prototype.isUser ? t.default : null
)?.default
```

**Implementação:**
- Buscar por características (tem `prototype.isServer` e `prototype.isUser`)
- Teste: Verificar que `N.UserConstructor` é função construtora

**Critérios:**
- [ ] Getter implementado
- [ ] Busca por características funcionando
- [ ] Teste unitário
- [ ] Validação funcionando
- [ ] Logs detalhados

---

#### 1.7 N.blockContact (Bloquear Contato)
**Referência:** Linha 322
```typescript
N.blockContact = Ct.findExport("blockContact")?.blockContact
```

**Critérios:**
- [ ] Getter implementado
- [ ] Busca robusta
- [ ] Teste unitário
- [ ] Validação funcionando
- [ ] Logs detalhados

---

#### 1.8 N.UploadUtils (Utilitários de Upload)
**Referência:** Linha 323
```typescript
N.UploadUtils = Ct.find(t => 
  t.default && 
  t.default.encryptAndUpload ? t.default : null
)?.default
```

**Critérios:**
- [ ] Getter implementado
- [ ] Busca por características
- [ ] Teste unitário
- [ ] Validação funcionando
- [ ] Logs detalhados

---

#### 1.9 N.DownloadManager (Gerenciador de Download)
**Referência:** Linha 324
```typescript
N.DownloadManager = Ct.findExport("downloadManager")?.downloadManager
```

**Critérios:**
- [ ] Getter implementado
- [ ] Busca robusta
- [ ] Teste unitário
- [ ] Validação funcionando
- [ ] Logs detalhados

---

#### 1.10 N.QueryExist (Verificar se Existe)
**Referência:** Linha 326
```typescript
N.QueryExist = Ct.findExport("queryExist")
```

**Critérios:**
- [ ] Getter implementado
- [ ] Busca robusta
- [ ] Teste unitário
- [ ] Validação funcionando
- [ ] Logs detalhados

---

#### 1.11 N.USyncQuery / N.USyncUser (Sincronização)
**Referência:** Linhas 327-328
```typescript
N.USyncQuery = Ct.findExport("USyncQuery")?.USyncQuery
N.USyncUser = Ct.findExport("USyncUser")?.USyncUser
```

**Critérios:**
- [ ] Ambos getters implementados
- [ ] Busca robusta
- [ ] Teste unitário
- [ ] Validação funcionando
- [ ] Logs detalhados

---

#### 1.12 N.Presence (Presença)
**Referência:** Linha 330
```typescript
N.Presence = Ct.findExport("sendPresenceAvailable")
```

**Critérios:**
- [ ] Getter implementado
- [ ] Busca robusta
- [ ] Teste unitário
- [ ] Validação funcionando
- [ ] Logs detalhados

---

#### 1.13 N.ChatState (Estado do Chat)
**Referência:** Linha 331
```typescript
N.ChatState = Ct.findExport("sendChatStateComposing")
```

**Validação:** Verificar métodos esperados: `sendChatStateComposing`, `sendChatStateRecording`

**Critérios:**
- [ ] Getter implementado
- [ ] Busca robusta
- [ ] Validação de métodos esperados
- [ ] Teste unitário
- [ ] Logs detalhados

---

#### 1.14 N.createGroup (Criar Grupo)
**Referência:** Linha 332
```typescript
N.createGroup = Ct.findExport("createGroup")?.createGroup
```

**Critérios:**
- [ ] Getter implementado
- [ ] Busca robusta
- [ ] Teste unitário
- [ ] Validação funcionando
- [ ] Logs detalhados

---

#### 1.15 N.getParticipants (Participantes do Grupo)
**Referência:** Linha 336
```typescript
N.getParticipants = Ct.findExport("getParticipants")?.getParticipants
```

**Critérios:**
- [ ] Getter implementado
- [ ] Busca robusta
- [ ] Teste unitário
- [ ] Validação funcionando
- [ ] Logs detalhados

---

#### 1.16 N.genMinimalLinkPreview (Preview de Links)
**Referência:** Linha 337
```typescript
N.genMinimalLinkPreview = Ct.findExport("genMinimalLinkPreview")?.genMinimalLinkPreview
```

**Critérios:**
- [ ] Getter implementado
- [ ] Busca robusta
- [ ] Teste unitário
- [ ] Validação funcionando
- [ ] Logs detalhados

---

#### 1.17 N.findFirstWebLink (Encontrar Links)
**Referência:** Linha 338
```typescript
N.findFirstWebLink = Ct.findExport("findFirstWebLink")?.findFirstWebLink
```

**Critérios:**
- [ ] Getter implementado
- [ ] Busca robusta
- [ ] Teste unitário
- [ ] Validação funcionando
- [ ] Logs detalhados

---

#### 1.18 N.getSearchContext (Contexto de Busca)
**Referência:** Linha 339
```typescript
N.getSearchContext = Ct.findExport("getSearchContext")?.getSearchContext
```

**Critérios:**
- [ ] Getter implementado
- [ ] Busca robusta
- [ ] Teste unitário
- [ ] Validação funcionando
- [ ] Logs detalhados

---

#### 1.19 N.sendReactionToMsg (Enviar Reação)
**Referência:** Linha 340
```typescript
N.sendReactionToMsg = Ct.findExport("sendReactionToMsg")?.sendReactionToMsg
```

**Critérios:**
- [ ] Getter implementado
- [ ] Busca robusta
- [ ] Teste unitário
- [ ] Validação funcionando
- [ ] Logs detalhados

---

#### 1.20 N.colorIndexToHex (Cores)
**Referência:** Linha 341
```typescript
N.colorIndexToHex = Ct.findExport("colorIndexToHex")?.colorIndexToHex
```

**Critérios:**
- [ ] Getter implementado
- [ ] Busca robusta
- [ ] Teste unitário
- [ ] Validação funcionando
- [ ] Logs detalhados

---

#### 1.21 N.StatusUtils (Status)
**Referência:** Linha 344
```typescript
N.StatusUtils = Ct.findExport("setMyStatus")
```

**Validação:** Verificar métodos esperados: `setMyStatus`, `getStatus`

**Critérios:**
- [ ] Getter implementado
- [ ] Busca robusta
- [ ] Validação de métodos esperados
- [ ] Teste unitário
- [ ] Logs detalhados

---

#### 1.22 N.Composing (Digitando)
**Referência:** Linha 345
```typescript
N.Composing = Ct.findExport("markComposing")
```

**Validação:** Verificar métodos esperados: `markComposing`, `markRecording`

**Critérios:**
- [ ] Getter implementado
- [ ] Busca robusta
- [ ] Validação de métodos esperados
- [ ] Teste unitário
- [ ] Logs detalhados

---

#### 1.23 N.ConversationSeen (Visto)
**Referência:** Linha 346
```typescript
N.ConversationSeen = Ct.findExport("sendConversationSeen")
```

**Critérios:**
- [ ] Getter implementado
- [ ] Busca robusta
- [ ] Teste unitário
- [ ] Validação funcionando
- [ ] Logs detalhados

---

#### 1.24 N.Playing (Tocando)
**Referência:** Linha 347
```typescript
N.Playing = Ct.findExport("markPlayed")
```

**Critérios:**
- [ ] Getter implementado
- [ ] Busca robusta
- [ ] Teste unitário
- [ ] Validação funcionando
- [ ] Logs detalhados

---

#### 1.25 N.StatusState (Estado de Status)
**Referência:** Linha 348
```typescript
N.StatusState = Ct.findExport("markStatusRead")
```

**Critérios:**
- [ ] Getter implementado
- [ ] Busca robusta
- [ ] Teste unitário
- [ ] Validação funcionando
- [ ] Logs detalhados

---

### Validação da Fase 1

**Antes de avançar para Fase 2:**
- [ ] Todos os 25 módulos implementados
- [ ] Todos os testes unitários passando
- [ ] Documentação completa
- [ ] Logs detalhados funcionando
- [ ] Validação de métodos esperados para módulos que precisam

---

## 🎯 Fase 2: Seletores CSS Dinâmicos (Prioridade ALTA)

### Objetivo
Implementar busca dinâmica de seletores CSS do webpack, com fallback para seletores fixos.

### Referência
Linhas 349-367 do `reverse.txt`

### Implementação

#### 2.1 Busca Dinâmica do Webpack
```typescript
// Buscar seletores do webpack (linha 349)
N.Classes = Object.entries(Ct.getModules())?.filter(
  ([t]) => t.includes(Mt("c2Nzcw==")) // "css" em base64
);

// Processar seletores encontrados (linhas 350-353)
N.Classes?.reduce((t, e) => 
  e && Array.isArray(e) && 2 === e.length ? {
    ...t,
    [e[0]]: e[1]()?.default
  } : t, 
  {}
);
```

**Critérios:**
- [ ] Função `Mt()` (base64 decode) implementada
- [ ] Busca de módulos CSS do webpack funcionando
- [ ] Processamento de seletores funcionando
- [ ] Teste unitário
- [ ] Logs detalhados

#### 2.2 Fallback para Seletores Fixos
```typescript
// Fallback (linhas 354-367)
N.Classes = {
  recentMessages: ["_ak8k"],
  contactNames: ["_ak8q", "webp header ._ao3e", "_ahxy", "_ahxt"],
  contactPhotos: ["_ak8h img", "webp header img"],
  chatItem: ['#pane-side div[role="row"]'],
  conversationMessages: ["message-in", "message-out"],
  textMessageComposerContainer: "._ak1r > div",
  messageActionButtonsContainer: "._amj_",
  messageReactionButtonsContainer: "x1c4vz4f xs83m0k xdl72j9 x1g77sc7 xeuugli x2lwn1j xozqiw3 x1oa3qoh x12fk4p8 xexx8yu x1im30kd x18d9i69 x1djpfga",
  messageReactionButtonsButton: "x78zum5 x6s0dn4 xl56j7k xexx8yu xyri2b x18d9i69 x1c1uobl x1f6kntn xk50ysn x7o08j2 xtvhhri x12s1jxh xkdsq27 xwwtwea x1gfkgh9 x23j0i4 xd7y6wv x1280gxy x1c9tyrk xeusxvb x1pahc9y x1ertn4p xx43kwn",
  sidebarButton: ["header > header div:has(> .html-span:first-of-type)", "header > header div:has(>button)"],
  chatButton: ["#main header div:has(> .html-span:first-of-type)[data-tab]", "#main header div:has(> button:first-of-type)", ".x1hm9lzh"],
  container: [".two > div:nth-of-type(5)"]
};
```

**Critérios:**
- [ ] Fallback implementado
- [ ] Múltiplos seletores por elemento (fallback chain)
- [ ] Teste unitário
- [ ] Validação funcionando
- [ ] Logs detalhados

#### 2.3 Integração com SelectorManager
**Critérios:**
- [ ] `N.Classes` integrado com `SelectorManager`
- [ ] Atualização automática quando webpack muda
- [ ] Teste E2E
- [ ] Validação funcionando

### Validação da Fase 2

**Antes de avançar para Fase 3:**
- [ ] Busca dinâmica funcionando
- [ ] Fallback funcionando
- [ ] Integração com SelectorManager funcionando
- [ ] Testes E2E passando
- [ ] Logs detalhados funcionando

---

## 🎯 Fase 3: Métodos Auxiliares (Prioridade MÉDIA)

### Objetivo
Adicionar métodos auxiliares no `N.Chat` e `N.ChatCollection` para garantir compatibilidade.

### Referência
Linhas 368-375 do `reverse.txt`

### Implementação

#### 3.1 N.Chat._find
```typescript
N.Chat && !N.Chat._find && (N.Chat._find = t => {
  var e = N.Chat.get(t);
  return e ? Promise.resolve(e) : Promise.resolve({ id: t });
});
```

**Critérios:**
- [ ] Método `_find` adicionado se não existir
- [ ] Teste unitário
- [ ] Validação funcionando
- [ ] Logs detalhados

#### 3.2 N.ChatCollection.findImpl
```typescript
N.ChatCollection && 
  void 0 === N.ChatCollection.findImpl && 
  void 0 !== N.ChatCollection._find && 
  (N.ChatCollection.findImpl = N.ChatCollection._find);
```

**Critérios:**
- [ ] Método `findImpl` adicionado se necessário
- [ ] Teste unitário
- [ ] Validação funcionando
- [ ] Logs detalhados

### Validação da Fase 3

**Antes de avançar para Fase 4:**
- [ ] Métodos auxiliares implementados
- [ ] Testes unitários passando
- [ ] Validação funcionando
- [ ] Logs detalhados funcionando

---

## 🎯 Fase 4: Eventos Extras (Prioridade MÉDIA)

### Objetivo
Implementar todos os eventos extras que a referência escuta.

### Referência
Linhas 744-1049 do `reverse.txt`

### Implementação

#### 4.1 N.Label.on("add remove")
**Referência:** Linha 744
```typescript
N.Label.on("add remove", function() {
  // Atualizar labels
});
```

**Critérios:**
- [ ] Listener implementado
- [ ] Callback configurado
- [ ] Teste unitário
- [ ] Validação funcionando
- [ ] Logs detalhados

#### 4.2 N.Msg.on("change") - Melhorias
**Referência:** Linha 759
```typescript
N.Msg.on("change", (t, e) => {
  // Detectar mensagens deletadas
  // Backup de mensagens
});
```

**Melhorias:**
- Detectar mensagens deletadas (`__x_type === "revoked"`)
- Fazer backup antes de deletar
- Armazenar em `deletedMsgs`

**Critérios:**
- [ ] Listener melhorado
- [ ] Detecção de mensagens deletadas
- [ ] Backup funcionando
- [ ] Teste unitário
- [ ] Validação funcionando
- [ ] Logs detalhados

#### 4.3 N.Chat.on("change:id") - Melhorias
**Referência:** Linha 775
```typescript
N.Chat.on("change:id", (e, t) => {
  // Atualizar UI quando muda de chat
  // Limpar mensagens deletadas do chat anterior
});
```

**Critérios:**
- [ ] Listener melhorado
- [ ] Atualização de UI funcionando
- [ ] Limpeza de mensagens deletadas
- [ ] Teste unitário
- [ ] Validação funcionando
- [ ] Logs detalhados

### Validação da Fase 4

**Antes de considerar completo:**
- [ ] Todos os eventos extras implementados
- [ ] Testes unitários passando
- [ ] Testes E2E passando
- [ ] Validação funcionando
- [ ] Logs detalhados funcionando

---

## 🎯 Fase 5: Testes e Validação Final (Prioridade ALTA)

### Objetivo
Garantir que tudo funciona corretamente e está robusto.

### Testes Obrigatórios

#### 5.1 Testes Unitários
- [ ] Todos os getters de módulos
- [ ] Busca por características
- [ ] Validação com Zod
- [ ] Métodos auxiliares
- [ ] Seletores CSS dinâmicos

#### 5.2 Testes E2E
- [ ] Captura de mensagens em tempo real
- [ ] Eventos disparando corretamente
- [ ] Seletores CSS funcionando
- [ ] Módulos extras funcionando

#### 5.3 Testes de Robustez
- [ ] WhatsApp muda nome de módulo → busca por características funciona
- [ ] WhatsApp muda seletores CSS → fallback funciona
- [ ] Estrutura de mensagem muda → Zod detecta e loga

### Validação Final

**Critérios:**
- [ ] Todos os testes passando
- [ ] Documentação completa
- [ ] Logs detalhados funcionando
- [ ] Código sem warnings
- [ ] TypeScript strict mode

---

## 📊 Métricas de Progresso

### Fase 1: Módulos Extras
- **Total:** 25 módulos
- **Implementados:** 0/25
- **Progresso:** 0%

### Fase 2: Seletores CSS Dinâmicos
- **Total:** 3 sub-tarefas
- **Implementadas:** 0/3
- **Progresso:** 0%

### Fase 3: Métodos Auxiliares
- **Total:** 2 métodos
- **Implementados:** 0/2
- **Progresso:** 0%

### Fase 4: Eventos Extras
- **Total:** 3 eventos
- **Implementados:** 0/3
- **Progresso:** 0%

### Fase 5: Testes e Validação
- **Total:** 3 tipos de testes
- **Implementados:** 0/3
- **Progresso:** 0%

---

## 🚀 Próximos Passos Imediatos

1. **Criar estrutura de testes** para módulos extras
2. **Implementar primeiro módulo** (N.Conn) como prova de conceito
3. **Validar processo** antes de implementar os outros 24
4. **Documentar padrão** para implementação dos demais

---

**Última atualização:** 2026-01-11  
**Status:** 🟡 Planejado - Aguardando início da implementação
