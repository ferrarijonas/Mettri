# 🧪 Plano: Aba de Testes e Histórico Melhorado

> Plano detalhado para implementar aba de verificação/testes e melhorar visualização do histórico.

---

## 📋 Índice

1. [Aba de Testes](#aba-de-testes)
2. [Histórico Melhorado](#histórico-melhorado)
3. [Ordem de Implementação](#ordem-de-implementação)
4. [Critérios de Validação](#critérios-de-validação)

---

## 🧪 Aba de Testes

### Objetivo

Criar uma aba no painel do Mettri que:
- Lista todos os módulos (Msg, Contact, Label, Chat, Conn, etc.)
- Mostra status de cada módulo (✅ funcionando, ❌ não funciona)
- Permite testar módulos individualmente
- Permite testar todos de uma vez
- Mostra detalhes do que cada módulo encontrou
- Salva número de teste para usar sempre

### Funcionalidades

#### 1. Configuração de Número de Teste

**Onde:** No topo da aba de testes

**Interface:**
```
┌─────────────────────────────────────┐
│  📱 Número de Teste:                │
│  [5511999999999] [Salvar] [Limpar]  │
│  ✅ Salvo: 5511999999999            │
└─────────────────────────────────────┘
```

**Funcionalidade:**
- Campo de texto para digitar número
- Botão [Salvar] → salva no chrome.storage.local
- Botão [Limpar] → remove número salvo
- Mostra número salvo abaixo (se tiver)
- Número salvo é usado automaticamente em todos os testes

**Arquivo:** `src/ui/test-panel.ts` (novo)

#### 2. Lista de Módulos

**Onde:** Corpo principal da aba

**Interface:**
```
┌─────────────────────────────────────────────────────┐
│  📦 Módulos da Sentinela                            │
├─────────────────────────────────────────────────────┤
│  ✅ N.Msg              [Testar] [Ver] [Logs]       │
│  ✅ N.Contact          [Testar] [Ver] [Logs]       │
│  ✅ N.Label            [Testar] [Ver] [Logs]       │
│  ✅ N.Chat             [Testar] [Ver] [Logs]       │
│  ⏳ N.Conn              [Testar] [Ver] [Logs]       │
│  ❌ N.SendDelete        [Testar] [Ver] [Logs]       │
│  ❌ N.uploadMedia       [Testar] [Ver] [Logs]       │
│  ... (todos os 25 módulos)                          │
├─────────────────────────────────────────────────────┤
│  [🔄 Testar Todos] [📊 Ver Relatório]              │
└─────────────────────────────────────────────────────┘
```

**Status:**
- ✅ = Funcionando (teste passou)
- ⏳ = Testando agora
- ❌ = Não funciona (teste falhou)
- ⚪ = Ainda não testado

**Botões:**
- [Testar] = Testa apenas aquele módulo
- [Ver] = Mostra detalhes (o que encontrou, estrutura, etc.)
- [Logs] = Mostra logs detalhados daquele módulo

**Arquivo:** `src/ui/test-panel.ts`

#### 3. Sistema de Testes

**Função Principal:** `testModule(moduleName: string)`

**O que faz:**
1. Tenta encontrar o módulo (via WhatsAppInterceptors)
2. Verifica se tem métodos esperados
3. Testa se funciona (tenta usar)
4. Retorna resultado:
   ```typescript
   {
     status: 'success' | 'error' | 'not-found',
     module: any,
     methods: string[],
     error?: string,
     logs: string[]
   }
   ```

**Arquivo:** `src/infrastructure/module-tester.ts` (novo)

#### 4. Relatório de Testes

**Onde:** Modal ou seção expandida

**Interface:**
```
┌─────────────────────────────────────┐
│  📊 Relatório de Testes              │
├─────────────────────────────────────┤
│  Total: 30 módulos                  │
│  ✅ Funcionando: 4                  │
│  ❌ Não funciona: 0                 │
│  ⚪ Não testado: 26                 │
│                                     │
│  Última execução: há 2 minutos     │
│                                     │
│  [Exportar JSON] [Copiar Logs]     │
└─────────────────────────────────────┘
```

**Arquivo:** `src/ui/test-panel.ts`

---

## 📚 Histórico Melhorado

### Objetivo

Melhorar visualização do histórico para:
- Agrupar mensagens por contato
- Mostrar lista de contatos (não só mensagens)
- Permitir clicar em contato para ver histórico completo
- Organizar por data/hora
- Facilitar análise posterior com IA

### Funcionalidades

#### 1. Lista de Contatos

**Onde:** Aba "Histórico" - visão principal

**Interface:**
```
┌─────────────────────────────────────┐
│  📚 Histórico de Conversas          │
├─────────────────────────────────────┤
│  🔍 [Buscar contato...]             │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐ │
│  │ 👤 Jonas | Cursos              │ │
│  │    15 mensagens • há 2 horas  │ │
│  │    Última: "Hj tem pão?"      │ │
│  └───────────────────────────────┘ │
│  ┌───────────────────────────────┐ │
│  │ 👤 Guilherme MORADA COLINA    │ │
│  │    8 mensagens • há 1 dia     │ │
│  │    Última: "Olá!"             │ │
│  └───────────────────────────────┘ │
│  ... (todos os contatos)            │
└─────────────────────────────────────┘
```

**Funcionalidade:**
- Lista todos os contatos que têm mensagens
- Mostra contagem de mensagens
- Mostra última mensagem (preview)
- Mostra quando foi última mensagem
- Clicar abre histórico completo daquele contato

**Arquivo:** `src/ui/history-panel.ts` (novo)

#### 2. Histórico de um Contato

**Onde:** Aba "Histórico" - visão detalhada

**Interface:**
```
┌─────────────────────────────────────┐
│  ← Voltar    Jonas | Cursos         │
├─────────────────────────────────────┤
│  [📤 Exportar para IA] [🤖 Analisar]│
├─────────────────────────────────────┤
│  📅 Hoje, 14:30                      │
│  👤 Jonas: "Bom-dia, Jonas!"        │
│  👤 Jonas: "Feliz 2026."            │
│  👤 Jonas: "Hj tem pão?"            │
│                                     │
│  📅 Ontem, 10:15                    │
│  👤 Jonas: "Olá!"                   │
│  🤖 Você: "Olá! Como posso ajudar?" │
│                                     │
│  📅 10/01/2026, 09:00               │
│  👤 Jonas: "Primeira mensagem"     │
│                                     │
│  [Carregar mais...]                 │
└─────────────────────────────────────┘
```

**Funcionalidade:**
- Mostra todas as mensagens daquele contato
- Organizado por data (hoje, ontem, data específica)
- Mostra quem enviou (contato ou você)
- Botão [Exportar para IA] → gera JSON para análise
- Botão [Analisar] → abre análise com IA (futuro)
- Paginação (carregar mais mensagens)

**Arquivo:** `src/ui/history-panel.ts`

#### 3. Busca e Filtros

**Funcionalidade:**
- Buscar contato por nome
- Filtrar por data (hoje, semana, mês, todos)
- Filtrar por tipo (só recebidas, só enviadas, todas)
- Ordenar (mais recente, mais antigo, mais mensagens)

**Arquivo:** `src/ui/history-panel.ts`

---

## 🎯 Ordem de Implementação

### Fase 1: Aba de Testes - Base (2-3 dias)

1. **Criar estrutura básica**
   - Criar `src/ui/test-panel.ts`
   - Adicionar aba "Testes" no painel principal
   - Criar interface básica (lista de módulos)

2. **Sistema de número de teste**
   - Campo de texto para número
   - Botões Salvar/Limpar
   - Salvar no chrome.storage.local
   - Mostrar número salvo

3. **Sistema de testes básico**
   - Criar `src/infrastructure/module-tester.ts`
   - Função `testModule()` básica
   - Testar módulos principais (Msg, Contact, Label, Chat)

4. **Interface de status**
   - Mostrar ✅/❌ para cada módulo
   - Botões [Testar] funcionando
   - Atualizar status em tempo real

**Critérios:**
- [ ] Aba "Testes" aparece no painel
- [ ] Número de teste pode ser salvo
- [ ] Módulos principais aparecem na lista
- [ ] Botão [Testar] funciona
- [ ] Status atualiza (✅/❌)

### Fase 2: Aba de Testes - Completa (2-3 dias)

5. **Testar todos os módulos**
   - Listar todos os 25+ módulos
   - Botão [Testar Todos] funcionando
   - Mostrar progresso (X/30 testados)

6. **Ver detalhes**
   - Botão [Ver] mostra estrutura do módulo
   - Botão [Logs] mostra logs detalhados
   - Modal ou seção expandida

7. **Relatório**
   - Contadores (funcionando, não funciona, não testado)
   - Última execução
   - Exportar JSON
   - Copiar logs

**Critérios:**
- [ ] Todos os módulos listados
- [ ] [Testar Todos] funciona
- [ ] [Ver] e [Logs] funcionam
- [ ] Relatório completo

### Fase 3: Histórico - Lista de Contatos (2-3 dias)

8. **Agrupar mensagens por contato**
   - Criar função `groupMessagesByContact()`
   - Contar mensagens por contato
   - Última mensagem de cada contato

9. **Lista de contatos**
   - Criar `src/ui/history-panel.ts`
   - Adicionar aba "Histórico" no painel
   - Mostrar lista de contatos
   - Preview da última mensagem

10. **Busca básica**
    - Campo de busca
    - Filtrar contatos por nome

**Critérios:**
- [ ] Mensagens agrupadas por contato
- [ ] Lista de contatos aparece
- [ ] Preview da última mensagem
- [ ] Busca funciona

### Fase 4: Histórico - Detalhes do Contato (2-3 dias)

11. **Histórico completo do contato**
    - Clicar em contato abre histórico
    - Mostrar todas as mensagens
    - Organizar por data/hora
    - Mostrar quem enviou

12. **Botões de ação**
    - [Exportar para IA] → gera JSON
    - [Analisar] → preparar para IA (futuro)
    - [Voltar] → volta para lista

13. **Paginação**
    - Carregar mais mensagens
    - Scroll infinito ou botão

**Critérios:**
- [ ] Clicar em contato abre histórico
- [ ] Mensagens organizadas por data
- [ ] [Exportar para IA] funciona
- [ ] Paginação funciona

### Fase 5: Histórico - Filtros e Melhorias (1-2 dias)

14. **Filtros avançados**
    - Filtrar por data
    - Filtrar por tipo (recebida/enviada)
    - Ordenar (recente, antigo, mais mensagens)

15. **Melhorias visuais**
    - Melhorar layout
    - Adicionar ícones
    - Melhorar preview de mensagens

**Critérios:**
- [ ] Filtros funcionam
- [ ] Ordenação funciona
- [ ] Visual melhorado

---

## ✅ Critérios de Validação

### Aba de Testes

- [ ] Aba aparece no painel
- [ ] Número de teste pode ser salvo
- [ ] Todos os módulos listados
- [ ] Status atualiza corretamente (✅/❌)
- [ ] [Testar] funciona para cada módulo
- [ ] [Testar Todos] funciona
- [ ] [Ver] mostra detalhes
- [ ] [Logs] mostra logs
- [ ] Relatório completo

### Histórico

- [ ] Lista de contatos aparece
- [ ] Mensagens agrupadas corretamente
- [ ] Preview da última mensagem
- [ ] Busca funciona
- [ ] Clicar em contato abre histórico
- [ ] Mensagens organizadas por data
- [ ] [Exportar para IA] funciona
- [ ] Paginação funciona
- [ ] Filtros funcionam

---

## 📁 Arquivos a Criar/Modificar

### Novos Arquivos

1. `src/ui/test-panel.ts` - Aba de testes completa
2. `src/infrastructure/module-tester.ts` - Sistema de testes
3. `src/ui/history-panel.ts` - Aba de histórico
4. `src/storage/test-config.ts` - Salvar número de teste

### Arquivos a Modificar

1. `src/ui/panel.ts` - Adicionar abas "Testes" e "Histórico"
2. `src/storage/message-db.ts` - Adicionar função `groupMessagesByContact()`
3. `src/ui/panel.css` - Estilos para novas abas

---

## 🚀 Próximos Passos

1. **Criar estrutura básica** da aba de testes
2. **Implementar sistema de número de teste**
3. **Implementar função `testModule()` básica**
4. **Testar com módulos principais**
5. **Depois:** Histórico melhorado

---

**Estimativa Total:** 10-14 dias  
**Prioridade:** ALTA (facilita desenvolvimento dos módulos extras)
