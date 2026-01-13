# Handoff: Refatoração Storage e Core - Para Engenheiro Júnior

> **Data:** Janeiro 2026  
> **Contexto:** Refatoração completa do sistema de captura e armazenamento de mensagens

---

## O Que Foi Feito (Resumo Executivo)

Refatoramos completamente como as mensagens são capturadas, validadas e armazenadas. Agora o sistema segue padrões profissionais com:

1. **Validação rigorosa** - Todos os dados são validados com Zod antes de serem salvos
2. **Fonte única da verdade** - IndexedDB é o único lugar onde mensagens são armazenadas
3. **Type safety** - Eliminamos tipos fracos como `Record<string, unknown>`
4. **Testes unitários** - 46 testes garantem que tudo funciona

---

## Problemas Que Foram Resolvidos

### Antes (Problemas)

```
❌ Mensagens eram salvas em 3 lugares diferentes:
   - message-capturer.ts → chrome.runtime.sendMessage
   - service-worker.ts → chrome.storage.local
   - message-db.ts → IndexedDB
   
❌ Dados eram aceitos sem validação
❌ Uso de Record<string, unknown> (tipo fraco)
❌ Dados corrompidos podiam ser salvos
```

### Depois (Solução)

```
✅ Mensagens são salvas APENAS no IndexedDB
✅ Todos os dados são validados com Zod antes de salvar
✅ Tipos específicos em vez de Record<string, unknown>
✅ Dados corrompidos são rejeitados e logados
```

---

## Arquitetura Atual (Como Funciona Agora)

### Fluxo de Captura de Mensagem

```
1. WhatsApp Web (DOM)
   ↓
2. message-capturer.ts extrai dados do DOM
   ↓
3. Valida com CapturedMessageSchema (Zod)
   ↓
4. messageDB.saveMessage() → IndexedDB
   ↓
5. panel.ts lê diretamente do messageDB
```

**Importante:** Não há mais comunicação via `chrome.runtime.sendMessage` para mensagens. Tudo é direto.

### Arquivos Principais

#### `src/types/schemas.ts` - Fonte da Verdade dos Tipos

Este arquivo define TODOS os tipos e validações:

- `CapturedMessageSchema` - Valida mensagens capturadas
- `MessageDBEntrySchema` - Valida formato de storage (timestamp como string)
- `SelectorsConfigSchema` - Valida config de seletores
- `messageToDBEntry()` - Converte Date → string ISO
- `dbEntryToMessage()` - Converte string ISO → Date

**Regra de Ouro:** Se você precisar criar ou modificar tipos de mensagens, faça AQUI primeiro.

#### `src/storage/message-db.ts` - Banco de Dados

Classe que gerencia IndexedDB:

- `saveMessage()` - Valida entrada, converte, valida formato, salva
- `getMessages()` - Recupera, valida cada entrada, converte, ordena
- `getMessagesByDateRange()` - Mesma lógica com filtro de data
- Métodos privados `validateMessage()` e `validateDBEntry()` fazem validação Zod

**Importante:** Todos os métodos validam dados. Se dados corrompidos chegarem, são rejeitados.

#### `src/core/message-capturer.ts` - Captura de Mensagens

Captura mensagens do DOM do WhatsApp:

- Valida `selectorsConfig` ao importar (linha 8)
- Extrai dados do DOM
- Valida com `CapturedMessageSchema` antes de criar mensagem
- Salva diretamente no `messageDB` (sem intermediário)

**Importante:** Não usa mais `chrome.runtime.sendMessage`. Tudo é direto.

#### `src/background/service-worker.ts` - Apenas Configurações

Agora gerencia APENAS configurações:

- `GET_SETTINGS` - Retorna configurações do usuário
- Não gerencia mais mensagens (removido `SAVE_MESSAGE` e `GET_MESSAGES`)

**Importante:** Service worker não toca em dados de negócio, apenas configurações.

---

## Como Trabalhar com Este Código

### 1. Adicionar Novo Campo em Mensagem

**Passo 1:** Atualizar `src/types/schemas.ts`

```typescript
export const CapturedMessageSchema = z.object({
  // ... campos existentes ...
  novoCampo: z.string().optional(), // Adicione aqui
});
```

**Passo 2:** O TypeScript vai inferir o tipo automaticamente

**Passo 3:** Atualizar testes em `tests/unit/schemas.test.ts`

**Passo 4:** Rodar testes: `npm run test:unit`

### 2. Adicionar Novo Método no MessageDB

**Exemplo:** Adicionar `getMessagesByChat()`

```typescript
public async getMessagesByChat(chatId: string): Promise<CapturedMessage[]> {
  const db = await this.ensureReady();
  
  return new Promise((resolve, reject) => {
    // ... lógica do IndexedDB ...
    
    request.onsuccess = () => {
      const messages = request.result
        .map((rawEntry: unknown): CapturedMessage | null => {
          try {
            // SEMPRE validar antes de converter
            const validatedEntry = this.validateDBEntry(rawEntry);
            return dbEntryToMessage(validatedEntry);
          } catch (error) {
            console.error('Mettri: Erro ao processar mensagem:', error);
            return null;
          }
        })
        .filter((msg): msg is CapturedMessage => msg !== null);
      
      resolve(messages);
    };
  });
}
```

**Regras:**
- Sempre use `validateDBEntry()` antes de converter
- Sempre use `dbEntryToMessage()` para converter
- Sempre filtre mensagens inválidas (retornam null)

### 3. Modificar Extração de Dados do DOM

**Arquivo:** `src/core/message-capturer.ts`

**Método:** `extractMessage()`

**Importante:** Depois de extrair dados, SEMPRE valide:

```typescript
const messageData = {
  // ... dados extraídos ...
};

// SEMPRE validar antes de criar mensagem
try {
  const validatedMessage = CapturedMessageSchema.parse(messageData);
  // ... usar mensagem validada ...
} catch (error) {
  // Logar erro, não salvar mensagem inválida
  console.error('Mettri: Dados inválidos:', error);
}
```

### 4. Adicionar Novo Tipo de Mensagem

**Exemplo:** Adicionar tipo 'location'

**Passo 1:** Atualizar schema:

```typescript
type: z.enum(['text', 'image', 'audio', 'video', 'document', 'sticker', 'location'], {
  errorMap: () => ({ message: 'Tipo de mensagem inválido' }),
}),
```

**Passo 2:** Atualizar testes

**Passo 3:** Rodar testes

---

## Validação Zod - Como Funciona

### Por Que Zod?

Zod valida dados em **runtime** (quando o código executa), não apenas em compile time. Isso garante que:

- Dados corrompidos não são salvos
- Dados inválidos são detectados imediatamente
- Erros são claros e específicos

### Exemplo de Validação

```typescript
// Dados válidos
const message = {
  id: 'msg-123',
  chatId: 'chat-456',
  // ... outros campos ...
};

const result = CapturedMessageSchema.safeParse(message);
if (result.success) {
  // Usar result.data (mensagem validada)
} else {
  // result.error contém detalhes do erro
  console.error('Erros:', result.error.issues);
}
```

### Erros Comuns

**Erro:** "ID da mensagem não pode ser vazio"
- **Causa:** Campo `id` está vazio ou undefined
- **Solução:** Garantir que `id` sempre tenha valor

**Erro:** "Tipo de mensagem inválido"
- **Causa:** Campo `type` não está no enum válido
- **Solução:** Usar apenas: 'text', 'image', 'audio', 'video', 'document', 'sticker'

**Erro:** "Timestamp deve ser uma data ISO 8601 válida"
- **Causa:** Timestamp não está no formato ISO (ex: "2026-01-15T10:30:00.000Z")
- **Solução:** Usar `date.toISOString()` para converter

---

## Testes - Como Executar e Adicionar

### Executar Testes

```bash
# Executar todos os testes
npm run test:unit

# Executar em modo watch (re-executa ao salvar)
npm run test:unit:watch
```

### Estrutura de Testes

```
tests/
├── setup.ts              # Setup global (fake-indexeddb)
├── fixtures/
│   └── test-data.ts      # Dados de teste reutilizáveis
└── unit/
    ├── schemas.test.ts          # 26 testes - Schemas Zod
    ├── message-db.test.ts       # 14 testes - MessageDB
    └── message-capturer.test.ts # 6 testes - MessageCapturer
```

### Adicionar Novo Teste

**Exemplo:** Testar novo campo em mensagem

```typescript
// tests/unit/schemas.test.ts
describe('CapturedMessageSchema', () => {
  it('deve aceitar novoCampo quando fornecido', () => {
    const message = { ...validMessage, novoCampo: 'valor' };
    const result = CapturedMessageSchema.safeParse(message);
    expect(result.success).toBe(true);
  });
});
```

---

## Regras de Ouro (Não Quebrar)

### 1. IndexedDB é a Única Fonte da Verdade

❌ **NUNCA** salve mensagens em `chrome.storage.local`  
❌ **NUNCA** use `chrome.runtime.sendMessage` para mensagens  
✅ **SEMPRE** use `messageDB.saveMessage()` diretamente

### 2. Sempre Valide com Zod

❌ **NUNCA** aceite dados sem validação  
❌ **NUNCA** use `Record<string, unknown>` sem validar  
✅ **SEMPRE** valide antes de salvar ou usar

### 3. Use Tipos dos Schemas

❌ **NUNCA** crie interfaces duplicadas  
✅ **SEMPRE** importe tipos de `src/types/schemas.ts`

### 4. Teste Suas Mudanças

❌ **NUNCA** faça mudanças sem testar  
✅ **SEMPRE** rode `npm run test:unit` antes de commitar

---

## Comandos Úteis

```bash
# Verificar tipos
npm run type-check

# Executar lint
npm run lint

# Executar testes unitários
npm run test:unit

# Executar testes E2E
npm run test:e2e

# Build da extensão
npm run build
```

---

## Onde Encontrar Coisas

| O Que Você Precisa | Onde Está |
|-------------------|-----------|
| Tipos de mensagens | `src/types/schemas.ts` |
| Banco de dados | `src/storage/message-db.ts` |
| Captura de mensagens | `src/core/message-capturer.ts` |
| Service worker | `src/background/service-worker.ts` |
| Testes unitários | `tests/unit/` |
| Dados de teste | `tests/fixtures/test-data.ts` |

---

## Dúvidas Comuns

### "Preciso adicionar um novo campo na mensagem. Por onde começo?"

1. Abra `src/types/schemas.ts`
2. Adicione o campo no `CapturedMessageSchema`
3. O TypeScript vai inferir automaticamente
4. Atualize testes em `tests/unit/schemas.test.ts`
5. Rode `npm run test:unit`

### "Como sei se minha validação está funcionando?"

Rode os testes! Se a validação estiver errada, os testes vão falhar com mensagens claras.

### "Posso usar `any` ou `Record<string, unknown>`?"

**NÃO.** Use sempre tipos específicos e valide com Zod. Se precisar de um tipo genérico, crie um schema Zod para ele.

### "Onde vejo os logs de validação?"

No console do navegador (F12). Erros de validação aparecem como:
```
Mettri: Falha ao validar mensagem: [...]
Mettri: Dados corrompidos no IndexedDB: [...]
```

---

## Próximos Passos Sugeridos

1. **Ler o código:** Comece por `src/types/schemas.ts` para entender os tipos
2. **Rodar testes:** Execute `npm run test:unit` para ver como funciona
3. **Explorar:** Abra `src/storage/message-db.ts` e veja como validação funciona
4. **Perguntar:** Se tiver dúvidas, pergunte! É melhor perguntar do que quebrar algo

---

## Documentação Relacionada

- `project_context.md` - Especificações completas do projeto
- `tech_stack.md` - Stack tecnológica
- `c:\Users\Alice\.cursor\plans\refatoração_storage_e_core_para_padrão_sênior_2026_d703678c.plan.md` - Plano original da refatoração

---

> **Lembre-se:** O código agora é mais seguro e confiável. Se você seguir as regras de ouro, não vai quebrar nada. Se tiver dúvidas, pergunte antes de fazer mudanças grandes!
