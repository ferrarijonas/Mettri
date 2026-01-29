# 🎯 Próximas Tarefas - Mettri

> **Data:** 2026-01-14  
> **Baseado em:** `progress.md`

---

## 📊 Status Atual

### ✅ **Já Implementado (mas não marcado no progress.md)**

#### **Bloco 1.6 - Aba de Testes** (14 tarefas)
- ✅ T1-061: Estrutura básica da aba "Testes"
- ✅ T1-062: Campo de número de teste
- ✅ T1-063: Salvar número de teste (chrome.storage)
- ✅ T1-064: module-tester.ts criado
- ✅ T1-065: Função testModule() básica
- ✅ T1-066: Listar todos os módulos (13 níveis hierárquicos)
- ✅ T1-067: Mostrar status de cada módulo (✅/❌)
- ✅ T1-068: Botão [Testar] individual
- ✅ T1-069: Botão [Testar Todos]
- ⏳ **Pendente:** T1-070 a T1-074 (melhorias)

#### **Bloco 1.7 - Histórico Melhorado** (14 tarefas)
- ✅ T1-075: Função groupMessagesByContact()
- ✅ T1-076: Estrutura básica da aba "Histórico"
- ✅ T1-077: Lista de contatos (com contagem)
- ✅ T1-078: Preview da última mensagem
- ✅ T1-079: Busca de contatos
- ✅ T1-080: Clicar em contato (abre histórico)
- ✅ T1-081: Histórico completo do contato
- ✅ T1-082: Organizar mensagens por data/hora
- ✅ T1-083: Mostrar quem enviou (contato/usuário)
- ✅ T1-084: Botão [Exportar para IA]
- ⏳ **Pendente:** T1-085 a T1-088 (melhorias)

---

## 🚀 Próximas Tarefas Prioritárias

### **1. Completar Aba de Testes** (5 tarefas restantes)

#### **T1-070: Botão [Ver] - Detalhes do Módulo**
- **O que fazer:** Mostrar detalhes completos do módulo quando clicar em [Ver]
- **Onde:** `src/ui/test-panel.ts`
- **Como:** Modal ou painel lateral com:
  - Propriedades do módulo
  - Métodos disponíveis
  - Exemplo de uso
  - Status de inicialização

#### **T1-071: Botão [Logs] - Logs Detalhados**
- **O que fazer:** Mostrar logs detalhados de cada teste
- **Onde:** `src/ui/test-panel.ts`, `src/infrastructure/module-tester.ts`
- **Como:** 
  - Coletar logs durante teste
  - Mostrar em painel expansível
  - Filtrar por nível (info, warn, error)

#### **T1-072: Relatório de Testes**
- **O que fazer:** Criar relatório consolidado de todos os testes
- **Onde:** `src/ui/test-panel.ts`
- **Como:**
  - Resumo: X passaram, Y falharam
  - Lista de módulos com status
  - Tempo de execução
  - Última execução

#### **T1-073: Exportar JSON do Relatório**
- **O que fazer:** Botão para exportar relatório em JSON
- **Onde:** `src/ui/test-panel.ts`
- **Como:** Similar ao exportToAI() do histórico
  - Gerar JSON com todos os resultados
  - Download automático

#### **T1-074: Testes E2E da Aba de Testes**
- **O que fazer:** Testes automatizados
- **Onde:** `tests/e2e/test-panel.spec.ts`
- **Como:** Playwright testando:
  - Abrir aba de testes
  - Testar módulo individual
  - Testar todos os módulos
  - Verificar relatório

---

### **2. Completar Aba de Histórico** (4 tarefas restantes)

#### **T1-085: Paginação (Carregar Mais)**
- **O que fazer:** Implementar carregamento incremental
- **Onde:** `src/ui/history-panel.ts`, `src/storage/message-db.ts`
- **Como:**
  - Botão "Carregar mais" no final da lista
  - Carregar 50 mensagens por vez
  - Manter scroll position
  - Indicador de carregamento

#### **T1-086: Filtros Avançados**
- **O que fazer:** Melhorar filtros existentes
- **Onde:** `src/ui/history-panel.ts`
- **Como:**
  - ✅ Filtro de data (já existe)
  - ✅ Filtro de tipo (já existe)
  - ⏳ Filtro por palavra-chave no texto
  - ⏳ Filtro por contato específico
  - ⏳ Filtro por período customizado

#### **T1-087: Melhorar Layout Visual**
- **O que fazer:** Polir UI/UX do histórico
- **Onde:** `src/ui/panel.css`, `src/ui/history-panel.ts`
- **Como:**
  - Melhorar cards de contato
  - Animações suaves
  - Loading states
  - Empty states melhorados
  - Responsividade

#### **T1-088: Testes E2E do Histórico**
- **O que fazer:** Testes automatizados
- **Onde:** `tests/e2e/history-panel.spec.ts`
- **Como:** Playwright testando:
  - Lista de contatos
  - Busca
  - Filtros
  - Visualização detalhada
  - Exportação

---

### **3. Bloco 0.4.5 - Auto-Mapeamento** (URGENTE - 7 tarefas)

> **⚠️ PRIORIDADE CRÍTICA:** Bloqueia captura de mensagens quando seletores quebram

#### **T0-015.4: Criar infrastructure/auto-mapper.ts**
- **O que fazer:** Criar módulo base de auto-mapeamento
- **Como:** Sistema que reconstrói seletores automaticamente

#### **T0-015.5: Atalho de Teclado (Ctrl+Shift+M)**
- **O que fazer:** Ativar auto-mapeamento manualmente
- **Onde:** `src/content/main.ts`

#### **T0-015.6: Hit Test (document.elementFromPoint)**
- **O que fazer:** Encontrar elementos perdidos via coordenadas
- **Onde:** `src/infrastructure/auto-mapper.ts`

#### **T0-015.7: Loop de Validação**
- **O que fazer:** Tentativa/erro até validar 100% dos campos
- **Onde:** `src/infrastructure/auto-mapper.ts`

#### **T0-015.8: Atualização Automática do Config Remoto**
- **O que fazer:** Salvar seletores encontrados automaticamente
- **Onde:** `src/infrastructure/config-updater.ts`

#### **T0-015.9: Integrar com SelectorManager**
- **O que fazer:** Usar seletores encontrados automaticamente
- **Onde:** `src/infrastructure/selector-manager.ts`

#### **T0-015.10: Testes E2E**
- **O que fazer:** Testar auto-mapeamento completo
- **Onde:** `tests/e2e/auto-mapping.spec.ts`

---

### **4. Bloco 1.1 - Módulos Extras** (26 tarefas)

> **Objetivo:** Implementar todos os módulos extras da referência

**Ordem sugerida (por prioridade):**

1. **T1-001: N.Conn** (Conexão) - Base para outras funcionalidades
2. **T1-002: N.SendDelete** (Deletar Mensagens) - Útil para limpeza
3. **T1-004: N.Cmd** (Comandos) - Base para ações
4. **T1-013: N.Presence** (Presença) - Já tem base em PresenceCollection
5. **T1-014: N.ChatState** (Estado do Chat) - Útil para UI

**Critérios para cada módulo:**
- Busca robusta (por nome E características)
- Validação de que módulo existe e funciona
- Teste unitário
- Documentação
- Logs detalhados

**Regra:** Não avançar para próximo módulo sem validar completamente o anterior.

---

## 📋 Ordem Recomendada de Execução

### **Fase 1: Completar Abas (Rápido - 1-2 dias)**
1. ✅ T1-070: Botão [Ver] detalhes (Aba Testes)
2. ✅ T1-071: Botão [Logs] (Aba Testes)
3. ✅ T1-072: Relatório de testes (Aba Testes)
4. ✅ T1-073: Exportar JSON (Aba Testes)
5. ✅ T1-085: Paginação (Aba Histórico)
6. ✅ T1-087: Melhorar layout visual (Aba Histórico)

### **Fase 2: Auto-Mapeamento (Crítico - 3-5 dias)**
7. ✅ T0-015.4: Criar auto-mapper.ts
8. ✅ T0-015.5: Atalho de teclado
9. ✅ T0-015.6: Hit test
10. ✅ T0-015.7: Loop de validação
11. ✅ T0-015.8: Atualização automática
12. ✅ T0-015.9: Integrar com SelectorManager
13. ✅ T0-015.10: Testes E2E

### **Fase 3: Módulos Extras (Médio Prazo - 15-20 dias)**
14. ✅ T1-001: N.Conn
15. ✅ T1-002: N.SendDelete
16. ✅ T1-004: N.Cmd
17. ✅ ... (continuar sequencialmente)

### **Fase 4: Testes E2E (Final - 2-3 dias)**
18. ✅ T1-074: Testes E2E Aba Testes
19. ✅ T1-088: Testes E2E Aba Histórico

---

## 🎯 Trabalho em Paralelo

Agora que temos singleton, vocês podem trabalhar em paralelo:

### **Pessoa 1: Aba de Testes**
- T1-070: Botão [Ver]
- T1-071: Botão [Logs]
- T1-072: Relatório
- T1-073: Exportar JSON

### **Pessoa 2: Aba de Histórico**
- T1-085: Paginação
- T1-086: Filtros avançados
- T1-087: Layout visual

### **Pessoa 3: Auto-Mapeamento** (se disponível)
- T0-015.4 a T0-015.9

---

## 📝 Notas

- **Singleton criado:** ✅ Permite trabalho em paralelo sem conflitos
- **Aba Testes:** 9/14 tarefas concluídas (64%)
- **Aba Histórico:** 10/14 tarefas concluídas (71%)
- **Auto-Mapeamento:** 0/7 tarefas concluídas (0% - URGENTE)

---

**Última atualização:** 2026-01-14
