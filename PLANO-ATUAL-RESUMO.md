# 📋 Plano Atual - Resumo Executivo

> **Data:** 2026-01-11  
> **Status:** Bloqueado em problema de contexto de execução

---

## 🎯 O Que Estamos Seguindo Agora

### **Tier 0 - Fundação**

#### ✅ **Bloco 0.4.6: Interceptação Webpack - Base (CONCLUÍDO)**
- ✅ WhatsAppInterceptors.ts criado
- ✅ DataScraper.ts criado
- ✅ Acesso a módulos principais (Msg, Contact, Label, Chat)
- ✅ Busca inteligente por características
- ✅ Objeto N (padrão referência) implementado
- ✅ Validação Zod implementada

**Status:** Base funcionando, mensagens sendo capturadas via webpack.

---

#### ⚠️ **Bloco 0.4.5: Auto-Mapeamento de Seletores (URGENTE) - BLOQUEADO**

**Por quê é urgente:**
- A captura de mensagens (Bloco 0.5) depende de seletores funcionais
- Sem auto-mapeamento, qualquer mudança no DOM do WhatsApp quebra a captura

**O que precisa ser feito:**
- T0-015.4: Criar `infrastructure/auto-mapper.ts`
- T0-015.5: Implementar atalho de teclado (Ctrl+Shift+M)
- T0-015.6: Implementar hit test (`document.elementFromPoint`)
- T0-015.7: Implementar loop de validação (tentativa/erro)
- T0-015.8: Implementar atualização automática do config remoto
- T0-015.9: Integrar auto-mapper com selector-manager
- T0-015.10: Testes E2E do auto-mapeamento

**Status:** Documentação concluída, implementação pendente.

---

#### 🚨 **PROBLEMA ATUAL: Contexto de Execução**

**O Problema:**
- Content script não acessa `window` real da página
- Bundler (Comet/Webpack) não é encontrado
- `window.require: undefined`
- `window.webpackChunkwhatsapp_web_client: false`

**Evidência:**
- Após 120 tentativas (60 segundos), bundler não aparece
- Logs mostram que propriedades não existem no contexto atual

**Solução Necessária:**
- ✅ Já implementado: `world: "MAIN"` no manifest.json (linha 23)
- ⚠️ **MAS:** Problema persiste - precisa investigar mais

**Próximo Passo:**
1. Confirmar se `world: "MAIN"` está funcionando
2. Se não, implementar injeção de script na página
3. Testar se bundler é encontrado após correção

---

### **Tier 1 - Sentinela (Parte Física do WhatsApp)**

#### 📚 **Bloco 1.7: Histórico Melhorado (PRIORIDADE ALTA)**

**Objetivo:** Melhorar visualização do histórico para agrupar por contato e facilitar análise.

**O Que Vamos Fazer:**

1. **Agrupar Mensagens por Contato**
   - Criar função `groupMessagesByContact()`
   - Contar mensagens por contato
   - Última mensagem de cada contato

2. **Lista de Contatos**
   - Criar aba "Histórico" no painel
   - Mostrar lista de contatos com:
     - Nome do contato
     - Contagem de mensagens
     - Preview da última mensagem
     - Quando foi última mensagem
   - Busca de contatos

3. **Histórico Completo do Contato**
   - Clicar em contato abre histórico completo
   - Mensagens organizadas por data/hora
   - Mostrar quem enviou (contato/usuário)
   - Botão [Exportar para IA] → gera JSON
   - Paginação (carregar mais)

4. **Filtros e Busca**
   - Filtrar por data (hoje, semana, mês, todos)
   - Filtrar por tipo (só recebidas, só enviadas, todas)
   - Ordenar (mais recente, mais antigo, mais mensagens)

**Tarefas (14 tarefas):**
- T1-075: Criar função `groupMessagesByContact()`
- T1-076: Criar estrutura básica da aba "Histórico"
- T1-077: Implementar lista de contatos (com contagem)
- T1-078: Mostrar preview da última mensagem
- T1-079: Implementar busca de contatos
- T1-080: Implementar clicar em contato (abre histórico)
- T1-081: Mostrar histórico completo do contato
- T1-082: Organizar mensagens por data/hora
- T1-083: Mostrar quem enviou (contato/usuário)
- T1-084: Implementar botão [Exportar para IA]
- T1-085: Implementar paginação (carregar mais)
- T1-086: Implementar filtros (data, tipo, ordenação)
- T1-087: Melhorar layout visual do histórico
- T1-088: Testes E2E do histórico melhorado

**Critérios de Sucesso:**
- ✅ Mensagens agrupadas por contato
- ✅ Lista de contatos funcional
- ✅ Histórico completo por contato
- ✅ Exportação para IA funcionando
- ✅ Filtros e busca funcionando

**Estimativa:** 10-14 dias (conforme `PLANO_ABA_TESTES_HISTORICO.md`)

**Status:** Pendente (aguardando resolução do problema de contexto)

---

## 🔄 Fluxo de Trabalho Atual

```
1. PROBLEMA CRÍTICO: Contexto de execução
   ↓
2. Resolver acesso ao bundler (Comet/Webpack)
   ↓
3. Bloco 0.4.5: Auto-Mapeamento (URGENTE)
   ↓
4. Bloco 0.5: Captura de Mensagens (desbloqueado)
   ↓
5. Bloco 1.7: Histórico Melhorado (PRIORIDADE ALTA)
```

---

## 📊 Status Geral

| Bloco | Status | Prioridade | Bloqueado Por |
|-------|--------|------------|---------------|
| 0.4.6 - Webpack Base | ✅ Concluído | - | - |
| 0.4.5 - Auto-Mapeamento | ⚠️ Pendente | 🔴 CRÍTICA | Problema de contexto |
| 0.5 - Captura Mensagens | 🔒 Bloqueado | 🔴 CRÍTICA | Auto-mapeamento |
| 1.7 - Histórico Melhorado | ⏳ Pendente | 🟠 ALTA | Problema de contexto |

---

## 🎯 Próximos Passos Imediatos

1. **Resolver problema de contexto** (CRÍTICO)
   - Verificar se `world: "MAIN"` está funcionando
   - Se não, implementar injeção de script na página
   - Testar se bundler é encontrado

2. **Depois que bundler funcionar:**
   - Implementar Bloco 0.4.5 (Auto-Mapeamento)
   - Desbloquear Bloco 0.5 (Captura)
   - Implementar Bloco 1.7 (Histórico Melhorado)

---

## 📝 Documentos Relacionados

- `progress.md` - Plano completo de tarefas
- `ANALISE-PANORAMA.md` - Análise do problema atual
- `docs/PLANO_ABA_TESTES_HISTORICO.md` - Plano detalhado do histórico
- `HISTORICO_SIMPLES.md` - Histórico simples do projeto

---

**Última atualização:** 2026-01-11
