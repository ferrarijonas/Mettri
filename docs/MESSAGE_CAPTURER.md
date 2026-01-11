# Message Capturer - Documentação Técnica

## Visão Geral

O **MessageCapturer** é um módulo dedicado exclusivamente à captura de mensagens do WhatsApp Web. Ele funciona como um "sentinela" que observa o DOM e captura todas as mensagens que aparecem na tela.

## Responsabilidade Única

Este módulo tem uma única responsabilidade: **capturar mensagens**.

- ✅ Observa o DOM para detectar novas mensagens
- ✅ Captura mensagens enviadas e recebidas
- ✅ Envia para MessageProcessor para processamento

- ❌ NÃO processa mensagens (isso é responsabilidade do MessageProcessor)
- ❌ NÃO salva no banco (isso é responsabilidade do MessageDB)
- ❌ NÃO atualiza UI diretamente (delega para IntegratedPanel)

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    WhatsApp Web DOM                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              MessageCapturer (Sentinela)                   │
│  - Observa DOM (MutationObserver)                          │
│  - Intercepta Enter (Input Listener)                        │
│  - Detecta novas mensagens                                  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│            MessageProcessor                                 │
│  - Enriquece dados                                          │
│  - Calcula metadados (responseTime, phase, etc)             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              MessageDB (IndexedDB)                          │
│  - Salva mensagem                                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│          IntegratedPanel                                    │
│  - Atualiza estatísticas                                    │
└─────────────────────────────────────────────────────────────┘
```

## Fluxo de Captura

### Mensagens Recebidas

1. WhatsApp Web recebe mensagem via WebSocket
2. WhatsApp renderiza mensagem no DOM
3. **MutationObserver** detecta novo nó adicionado
4. **MessageCapturer** identifica que é uma mensagem válida
5. Extrai dados básicos (elemento DOM)
6. Chama `MessageProcessor.processAndSave()`
7. MessageProcessor enriquece e salva
8. Painel atualiza estatísticas

### Mensagens Enviadas

1. Usuário digita no campo de input
2. Usuário aperta **Enter**
3. **Input Listener** detecta Enter
4. Aguarda mensagem aparecer no DOM (300ms, 800ms, 1500ms)
5. **MessageCapturer** escaneia DOM para encontrar mensagem
6. Identifica mensagem recém-enviada
7. Chama `MessageProcessor.processAndSave()`
8. MessageProcessor enriquece e salva
9. Painel atualiza estatísticas

## API Pública

### `start()`
Inicia a captura de mensagens.

```javascript
window.MessageCapturer.start();
```

**O que faz:**
- Configura MutationObserver no container de mensagens
- Configura listener no campo de input
- Escaneia mensagens existentes

### `stop()`
Para a captura de mensagens.

```javascript
window.MessageCapturer.stop();
```

**O que faz:**
- Desconecta MutationObserver
- Remove listeners
- Limpa estado interno

### `getStatus()`
Retorna status atual do capturador.

```javascript
const status = window.MessageCapturer.getStatus();
// { running: true, containerFound: true, processedCount: 150 }
```

### `scanForMessages()`
Escaneia manualmente o DOM em busca de mensagens.

```javascript
await window.MessageCapturer.scanForMessages();
```

**Uso:** Útil para forçar uma varredura após mudanças conhecidas.

## Detecção de Mensagens

### Estratégia de Busca

1. **Prioridade 1:** Buscar elementos com `data-id` válido
   - Formato: `true_1234567890@c.us_...` (enviadas)
   - Formato: `false_1234567890@c.us_...` (recebidas)

2. **Prioridade 2:** Buscar containers com `data-testid="msg-container"`

3. **Prioridade 3:** Buscar por estrutura (fallback)

### Validação

Uma mensagem é considerada válida se:
- Tem `data-id` válido do WhatsApp, OU
- Tem estrutura de mensagem (`data-testid="msg-container"`), OU
- Tem conteúdo significativo (> 3 caracteres) e não é elemento parcial

Elementos parciais são filtrados:
- `tail-out` (ícone de cauda)
- `msg-dblcheck` (apenas ícone de check)
- `document-*-icon` (apenas ícone de documento)

## Prevenção de Duplicatas

O MessageCapturer mantém um cache de IDs processados:

```javascript
processedMessageIds = Set([
  'whatsapp_true_1234567890@c.us_...',
  'whatsapp_false_9876543210@c.us_...',
  ...
])
```

- Cache limitado a 500 IDs
- Quando excede, mantém apenas os últimos 250
- Evita processar a mesma mensagem múltiplas vezes

## Dependências

### Requeridos
- `window.MessageProcessor` - Processa e salva mensagens
- `window.WhatsAppAPI` - Obtém informações do chat atual

### Opcionais
- `window.IntegratedPanel` - Atualiza estatísticas no painel

## Logs e Debug

O módulo emite logs informativos:

```
[MessageCapturer] 🚀 Iniciando captura de mensagens...
[MessageCapturer] ✅ Captura ativa
[MessageCapturer] ⏸️ Captura pausada
```

## Tratamento de Erros

- Todos os métodos têm try-catch
- Erros não interrompem a captura
- Erros são logados no console
- Sistema continua funcionando mesmo com falhas

## Performance

- MutationObserver é eficiente (não polling constante)
- Cache de IDs evita processamento duplicado
- Escaneamento só ocorre quando há mudanças no DOM
- Timeouts para mensagens enviadas são necessários (WhatsApp demora para renderizar)

## Limitações Conhecidas

1. **Mensagens enviadas:** Requer múltiplas tentativas (300ms, 800ms, 1500ms) porque o WhatsApp pode demorar para renderizar
2. **Container:** Pode não encontrar o container imediatamente se o WhatsApp ainda não carregou
3. **Estrutura DOM:** Se o WhatsApp mudar a estrutura do DOM, pode precisar ajustar seletores

## Manutenção

### Quando ajustar este módulo:

- ✅ WhatsApp mudou estrutura do DOM
- ✅ Novos tipos de mensagem aparecem (ex: polls, reactions)
- ✅ Problemas de performance na captura
- ✅ Melhorias na detecção de mensagens

### Quando NÃO ajustar:

- ❌ Problemas de processamento de mensagens (isso é MessageProcessor)
- ❌ Problemas de salvamento (isso é MessageDB)
- ❌ Problemas de UI (isso é IntegratedPanel)

## Exemplo de Uso

```javascript
// Inicialização automática (feita pelo Orchestrator)
window.MessageCapturer.start();

// Verificar status
const status = window.MessageCapturer.getStatus();
console.log('Captura ativa:', status.running);
console.log('Container encontrado:', status.containerFound);
console.log('Mensagens processadas:', status.processedCount);

// Forçar escaneamento manual
await window.MessageCapturer.scanForMessages();

// Parar captura (se necessário)
window.MessageCapturer.stop();
```












