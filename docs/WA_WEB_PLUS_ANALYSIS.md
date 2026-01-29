# Análise: WA Web Plus - Como Acessa o Bundler

## Descobertas

### Extensão Encontrada
- **ID**: `ekcgkejcjdcmonfpmnljobemcbpnkamh`
- **Nome**: WA Web Plus by Elbruz Technologies
- **Versão**: 4.9.2
- **Localização**: `C:\Users\Alice\AppData\Local\Google\Chrome\User Data\Profile 1\Extensions\ekcgkejcjdcmonfpmnljobemcbpnkamh\4.9.2_0`

### Arquivos Principais
- `manifest.json` - Configuração da extensão
- `bundle.js` - Código principal (minificado, ~2.4MB)
- `app.js` - Código injetado no WhatsApp Web (minificado, ~2.4MB)
- `worker.js` - Service Worker

### Como Acessa o Bundler

#### 1. Detecção do Bundler (Comet vs Webpack)

```javascript
let t = {}, e = "unknown";

// TENTAR COMET PRIMEIRO
if (window.require && window.__d) {
    t = function() {
        const e = {};
        const t = Object.keys(window.require("__debug")?.modulesMap || {});
        return t.forEach(t => {
            e[t] = () => function(t) {
                try {
                    return window.ErrorGuard.skipGuardGlobal(!0), importNamespace(t)
                } catch(t) {
                    throw t
                } finally {
                    window.ErrorGuard.skipGuardGlobal(!1)
                }
            }(t)
        }), e
    }();
    e = "comet";
}
// SE NÃO FOR COMET, TENTAR WEBPACK
else {
    if (!window.webpackChunkwhatsapp_web_client) 
        throw new Error("Cannot find bundler");
    
    t = function() {
        const n = {};
        const t = window.webpackChunkwhatsapp_web_client;
        const e = Math.random().toString(36).substring(7);
        return t.push([[e], {}, t => {
            for (const e in t.m) 
                n[e] = () => t(e)
        }]), n
    }();
    e = "webpack";
}
```

#### 2. Criação do Objeto `Ct` (Cache de Módulos)

```javascript
const Ct = {};

// Mapear todos os módulos para Ct
Object.entries(t).forEach(([t, e]) => {
    Object.defineProperty(Ct, t, {
        get: e,
        enumerable: !0,
        configurable: !1
    })
});

// Adicionar métodos de busca
Object.setPrototypeOf(Ct, {
    some: function(t) { return !!At(t) },
    find: At,  // Busca por predicado
    filter: St,
    someExport: function(t) { return !!Et(t) },
    findExport: Et,  // Busca por nome de export
    filterExport: function(n) { ... },
    getModules: function() { return t }
});
```

#### 3. Funções de Busca

```javascript
// Busca por predicado (função)
function At(t) {
    if ("function" != typeof t) 
        throw new Error("Missing predicate function");
    
    for (const n in Ct) {
        try {
            var e = Ct[n];
            if (t(e)) return e
        } catch(t) {
            continue
        }
    }
}

// Busca por nome de export
function Et(n) {
    if ("string" != typeof n) 
        throw new Error("Missing predicate export key");
    
    return At(t => {
        const e = [
            ...Object.keys(t?.default || {}),
            ...Object.keys(t || {})
        ];
        return e.includes(n)
    });
}
```

#### 4. Criação do Objeto `N` (Padrão Referência)

```javascript
// N é uma cópia de GroupMetadata.default
N = Object.assign({}, Ct.findExport("GroupMetadata")?.default);

// Adicionar outros módulos ao N
N.Conn = Ct.findExport("Conn")?.Conn;
N.SendDelete = Ct.findExport("sendDelete")?.SendDelete;
N.addAndSendMsgToChat = Ct.findExport("addAndSendMsgToChat")?.addAndSendMsgToChat;
N.MsgKey = Ct.find(t => t.default && t.default.newId)?.default;
N.OpaqueData = Ct.find(t => t.default && t.default.createFromData)?.default;
N.MediaPrep = Ct.findExport("prepRawMedia");
N.MediaObject = Ct.findExport("getOrCreateMediaObject");
N.uploadMedia = Ct.findExport("uploadMedia")?.uploadMedia;
N.Cmd = Ct.findExport("Cmd")?.Cmd;
N.MediaTypes = Ct.findExport("msgToMediaType");
N.VCard = Ct.findExport("vcardFromContactModel");
N.UserConstructor = Ct.find(t => t.default && t.default.prototype && t.default.prototype.isServer && t.default.prototype.isUser ? t.default : null)?.default;
N.WidFactory = Ct.findExport("createWid");
N.blockContact = Ct.findExport("blockContact")?.blockContact;
N.UploadUtils = Ct.find(t => t.default && t.default.encryptAndUpload ? t.default : null)?.default;
N.DownloadManager = Ct.findExport("downloadManager")?.downloadManager;
N.User = Ct.findExport("getMaybeMePnUser");
N.QueryExist = Ct.findExport("queryExist");
N.USyncQuery = Ct.findExport("USyncQuery")?.USyncQuery;
N.USyncUser = Ct.findExport("USyncUser")?.USyncUser;
N.getEphemeralFields = Ct.findExport("getEphemeralFields")?.getEphemeralFields;
N.Presence = Ct.findExport("sendPresenceAvailable");
N.ChatState = Ct.findExport("sendChatStateComposing");
N.createGroup = Ct.findExport("createGroup")?.createGroup;
N.canReplyMsg = Ct.findExport("canReplyMsg")?.canReplyMsg;
N.MediaCollection = Ct.find(t => t.default && t.default.prototype && void 0 !== t.default.prototype.processAttachments ? t.default : null)?.default;
N.sendTextMsgToChat = Ct.findExport("sendTextMsgToChat")?.sendTextMsgToChat;
N.getParticipants = Ct.findExport("getParticipants")?.getParticipants;
N.genMinimalLinkPreview = Ct.findExport("genMinimalLinkPreview")?.genMinimalLinkPreview;
N.findFirstWebLink = Ct.findExport("findFirstWebLink")?.findFirstWebLink;
N.getSearchContext = Ct.findExport("getSearchContext")?.getSearchContext;
N.sendReactionToMsg = Ct.findExport("sendReactionToMsg")?.sendReactionToMsg;
N.colorIndexToHex = Ct.findExport("colorIndexToHex")?.colorIndexToHex;
N.PresenceCollection = Ct.findExport("PresenceCollection")?.PresenceCollection;
N.ChatCollection = Ct.findExport("ChatCollection")?.ChatCollection;
N.StatusUtils = Ct.findExport("setMyStatus");
N.Composing = Ct.findExport("markComposing");
N.ConversationSeen = Ct.findExport("sendConversationSeen");
N.Playing = Ct.findExport("markPlayed");
// ... e mais
```

## Diferenças da Nossa Implementação

### WA Web Plus
1. **Detecta Comet primeiro** (via `window.require && window.__d`)
2. **Usa `modulesMap` do Comet** (via `window.require("__debug")?.modulesMap`)
3. **Usa `importNamespace`** para carregar módulos do Comet
4. **Cria objeto `Ct`** com todos os módulos mapeados
5. **Adiciona métodos** `find`, `findExport`, `filter`, etc. ao `Ct`
6. **Cria objeto `N`** copiando `GroupMetadata.default` e adicionando outros módulos

### Nossa Implementação Atual
1. Detecta Comet e Webpack
2. Usa `findExport` diretamente
3. Não cria objeto `Ct` centralizado
4. Cria objeto `N` mas de forma diferente

## O Que Podemos Melhorar

1. **Adicionar suporte a `modulesMap` do Comet**:
   ```typescript
   if (window.require && window.__d) {
       const debug = window.require("__debug");
       const modulesMap = debug?.modulesMap || {};
       // Mapear todos os módulos
   }
   ```

2. **Criar objeto `Ct` centralizado** (como WA Web Plus):
   ```typescript
   const Ct = {};
   Object.entries(modules).forEach(([id, getter]) => {
       Object.defineProperty(Ct, id, {
           get: getter,
           enumerable: true,
           configurable: false
       });
   });
   ```

3. **Adicionar métodos de busca ao `Ct`**:
   ```typescript
   Object.setPrototypeOf(Ct, {
       find: (predicate) => { ... },
       findExport: (exportName) => { ... },
       filter: (predicate) => { ... },
       // etc
   });
   ```

4. **Usar `importNamespace` para Comet** (se disponível)

## Próximos Passos

1. Implementar suporte completo ao Comet usando `modulesMap`
2. Criar objeto `Ct` centralizado
3. Adicionar métodos de busca ao `Ct`
4. Testar com ambas as versões (Comet e Webpack)
