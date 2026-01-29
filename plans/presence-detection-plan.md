# Plano: Detecção de Presença Igual à Referência

## Objetivo
Implementar detecção de presença seguindo EXATAMENTE o padrão da referência (reverse.txt linhas 782-809).

## Análise da Referência

### Como a referência faz (reverse.txt):

1. **Escuta eventos reativos** (linha 782):
   ```javascript
   N.PresenceCollection.on("change:isOnline", (t, n) => {
   ```
   - `t`: objeto de presença com `t.id._serialized` e `t.isUser`
   - `n`: status (1 = online, 0 = offline)

2. **Filtra apenas usuários** (linha 783):
   ```javascript
   1 == t.isUser && N.Chat.find(t.id._serialized).then(e => {
   ```
   - Verifica `t.isUser === 1` antes de processar
   - Busca o chat correspondente via `Chat.find(t.id._serialized)`

3. **Determina status** (linha 785):
   ```javascript
   1 == n  // n === 1 significa online
   ```

4. **Obtém informações do chat** (linha 788):
   ```javascript
   contact: e.__x_formattedTitle  // Nome do contato
   ```

5. **Subscreve apenas chat ativo** (linha 1504):
   ```javascript
   N.Presence.subscribePresence(N.Chat.getActive().id._serialized)
   ```

## Plano de Implementação

### Fase 1: Configurar Listener de Eventos (Igual Referência)

**Arquivo**: `src/ui/test-panel.ts`

1. **Configurar listener `change:isOnline`**:
   - Verificar se `PresenceCollection.on()` existe
   - Configurar listener: `PresenceCollection.on("change:isOnline", callback)`
   - Callback recebe `(t, n)` onde:
     - `t`: objeto presença com `t.id._serialized` e `t.isUser`
     - `n`: status (1 = online, 0 = offline)

2. **Filtrar apenas usuários**:
   - Verificar `t.isUser === 1` antes de processar
   - Ignorar se não for usuário

3. **Buscar chat correspondente**:
   - Usar `Chat.find(t.id._serialized)` (igual referência linha 783)
   - Aguardar promise com `.then()`
   - Obter nome via `chat.__x_formattedTitle` ou `chat.formattedTitle`

4. **Determinar status**:
   - Se `n === 1`: online
   - Se `n === 0` ou outro: offline

### Fase 2: Acumular Resultados

**Estratégia para teste funcional**:

1. **Criar estrutura de dados**:
   ```typescript
   const presenceResults = {
     online: new Map<string, { name: string, timestamp: number }>(),
     offline: new Map<string, { name: string, timestamp: number }>()
   };
   ```

2. **No callback do evento**:
   - Extrair `wid` de `t.id._serialized`
   - Buscar chat via `Chat.find(wid)`
   - Obter nome do chat
   - Adicionar ao Map correspondente (online ou offline)
   - Atualizar contadores

3. **Timeout para aguardar eventos**:
   - Aguardar 3-5 segundos para eventos chegarem
   - Após timeout, compilar resultados finais

### Fase 3: Subscrever Presença (Opcional para Teste)

**Nota**: A referência subscreve apenas o chat ativo. Para o teste, podemos:

1. **Opção A (Igual referência)**:
   - Subscrever apenas chat ativo: `Presence.subscribePresence(Chat.getActive().id._serialized)`
   - Mais fiel à referência, mas detecta apenas chat ativo

2. **Opção B (Para teste completo)**:
   - Subscrever múltiplos chats (primeiros 50-100 contatos)
   - Mais dados, mas não é exatamente igual à referência

**Recomendação**: Implementar Opção A primeiro (igual referência), depois avaliar se precisa Opção B.

### Fase 4: Fallback para Estado Atual

**Problema**: Eventos são reativos, mas teste precisa mostrar estado atual.

**Solução híbrida**:

1. **Configurar listener** (prioridade)
2. **Aguardar eventos** por 3-5 segundos
3. **Fallback**: Se poucos resultados, tentar buscar estado atual via:
   - `PresenceCollection.get(wid)` para contatos conhecidos
   - Verificar propriedades do Chat diretamente
   - DOM scraping como último recurso

### Fase 5: Compilar e Exibir Resultados

1. **Após timeout ou eventos suficientes**:
   - Contar total de contatos únicos (online + offline)
   - Listar primeiros 10 online
   - Listar primeiros 5 offline
   - Formatar mensagem de resultado

2. **Limpar listener**:
   - Remover listener após teste
   - Evitar vazamento de memória

## Estrutura de Código

### Função Principal: `performFunctionalTest` para `PresenceCollection`

```typescript
// 1. Configurar listener
const presenceCollection = this.interceptors.PresenceCollection;
const chatModule = this.interceptors.Chat;

// 2. Estrutura de dados
const presenceResults = {
  online: new Map<string, { name: string }>(),
  offline: new Map<string, { name: string }>()
};

// 3. Callback do evento (igual referência)
const eventHandler = async (t: any, n: number) => {
  // Verificar t.isUser === 1 (igual referência linha 783)
  if (t.isUser !== 1) return;
  
  // Buscar chat (igual referência linha 783)
  const wid = t.id?._serialized;
  if (!wid || !chatModule?.find) return;
  
  try {
    const chat = await chatModule.find(wid);
    if (!chat) return;
    
    const name = chat.__x_formattedTitle || chat.formattedTitle || chat.name || wid.split('@')[0];
    
    // n === 1 significa online (igual referência linha 785)
    if (n === 1) {
      presenceResults.online.set(wid, { name });
    } else {
      presenceResults.offline.set(wid, { name });
    }
  } catch (e) {
    // Ignorar erros
  }
};

// 4. Configurar listener
if (typeof presenceCollection.on === 'function') {
  presenceCollection.on('change:isOnline', eventHandler);
}

// 5. Aguardar eventos (3-5 segundos)
await new Promise(resolve => setTimeout(resolve, 5000));

// 6. Compilar resultados
const onlineCount = presenceResults.online.size;
const offlineCount = presenceResults.offline.size;
// ... formatar mensagem

// 7. Limpar listener
if (typeof presenceCollection.off === 'function') {
  presenceCollection.off('change:isOnline', eventHandler);
}
```

## Verificações Necessárias

1. **Verificar se `PresenceCollection.on()` existe**
2. **Verificar se `Chat.find()` existe** (pode ser async)
3. **Verificar formato de `t.id._serialized`**
4. **Verificar `t.isUser`** (deve ser === 1)
5. **Tratar erros** em cada etapa

## Diferenças da Implementação Atual

| Atual | Nova (Igual Referência) |
|-------|-------------------------|
| Busca estática via `.get()` | Escuta eventos `change:isOnline` |
| Itera sobre `Chat._models` | Usa `Chat.find(wid)` quando evento dispara |
| Subscreve todos os chats | Subscreve apenas chat ativo (ou múltiplos para teste) |
| Busca imediata | Aguarda eventos (3-5s) |
| Proativo | Reativo |

## Próximos Passos

1. ✅ Planejar implementação (este documento)
2. ⏳ Implementar listener de eventos
3. ⏳ Implementar busca de chat via `Chat.find()`
4. ⏳ Implementar acumulação de resultados
5. ⏳ Implementar timeout e compilação
6. ⏳ Testar e validar
7. ⏳ Adicionar fallback se necessário

## Notas Importantes

- **Eventos são assíncronos**: Não podemos esperar resultados imediatos
- **Timeout necessário**: Aguardar 3-5 segundos para eventos chegarem
- **Limpar listener**: Sempre remover listener após teste
- **Filtro `t.isUser`**: Crucial para não processar não-usuários
- **`Chat.find()` é async**: Usar `await` ou `.then()`
