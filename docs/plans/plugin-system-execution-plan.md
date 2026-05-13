# Plugin System - Plano de Execução

> **Objetivo:** Implementar sistema de módulos desacoplados e auto-descobríveis para permitir escalabilidade sem acoplamento.

---

## 🎯 Visão Geral

**Problema Atual:**
- `panel.ts` conhece cada módulo diretamente
- Adicionar/remover módulo exige editar `panel.ts`
- Risco de quebrar outros módulos ao alterar um
- Não escala para muitos módulos

**Solução:**
- **PanelShell (Core)**: Apenas navegação, não conhece módulos específicos
- **ModuleRegistry**: Descobre módulos automaticamente
- **Modules/**: Cada módulo se registra sozinho, isolado

---

## 📋 Fase 1: Fundação (Core + Registry)

### 1.1 Criar Estrutura Base

**Arquivos a criar:**
```
src/ui/core/
├── module-registry.ts      ← Descobre e gerencia módulos
├── panel-shell.ts          ← Navegação pura (não conhece módulos)
└── event-bus.ts            ← Comunicação entre módulos
```

**Tarefas:**
1. ✅ Criar `src/ui/core/module-registry.ts`
   - Interface `ModuleDefinition`
   - Classe `ModuleRegistry` com métodos:
     - `register(module: ModuleDefinition): void`
     - `getModule(id: string): ModuleDefinition | null`
     - `getTopLevelModules(): ModuleDefinition[]`
     - `getSubModules(parentId: string): ModuleDefinition[]`
     - `discoverModules(): Promise<void>`

2. ✅ Criar `src/ui/core/panel-shell.ts`
   - Classe `PanelShell` que:
     - Recebe `ModuleRegistry` no construtor
     - Gera HTML de tabs dinamicamente
     - Gerencia troca de abas
     - NÃO conhece módulos específicos

3. ✅ Criar `src/ui/core/event-bus.ts`
   - Classe `EventBus` simples:
     - `on(event: string, handler: Function): void`
     - `emit(event: string, data: any): void`
     - `off(event: string, handler: Function): void`

**Critérios:**
- ✅ TypeScript strict (sem `any`)
- ✅ Testes unitários básicos
- ✅ Documentação JSDoc

---

## 📋 Fase 2: Migração dos Painéis Existentes

### 2.1 Criar Estrutura de Módulos

**Estrutura de pastas:**
```
src/modules/
├── clientes/
│   ├── history/
│   │   ├── history-module.ts
│   │   └── history-panel.ts      ← Move de ui/
│   └── clientes-module.ts
├── infrastructure/
│   └── tests/
│       ├── tests-module.ts
│       └── test-panel.ts         ← Move de ui/
└── marketing/
    └── reactivation/
        ├── reactivation-module.ts
        └── reactivation-panel.ts ← Move de ui/
```

### 2.2 Migrar Histórico

**Tarefas:**
1. ✅ Criar `src/modules/clientes/history/history-module.ts`
   ```typescript
   export const HistoryModule: ModuleDefinition = {
     id: 'clientes.history',
     name: 'Histórico',
     parent: 'clientes',
     icon: '📜',
     dependencies: ['core.message-db'],
     panel: HistoryPanel,
     lazy: true
   };
   ```

2. ✅ Mover `src/ui/history-panel.ts` → `src/modules/clientes/history/history-panel.ts`
3. ✅ Criar `src/modules/clientes/history/index.ts` que exporta `HistoryModule`
4. ✅ Testar que histórico funciona após migração

### 2.3 Migrar Testes

**Tarefas:**
1. ✅ Criar `src/modules/infrastructure/tests/tests-module.ts`
2. ✅ Mover `src/ui/test-panel.ts` → `src/modules/infrastructure/tests/test-panel.ts`
3. ✅ Testar que testes funcionam após migração

### 2.4 Migrar Reativação

**Tarefas:**
1. ✅ Criar `src/modules/marketing/reactivation/reactivation-module.ts`
2. ✅ Mover `src/ui/reactivation-panel.ts` → `src/modules/marketing/reactivation/reactivation-panel.ts`
3. ✅ Testar que reativação funciona após migração

**Critérios:**
- ✅ Cada módulo funciona isoladamente
- ✅ Nenhuma funcionalidade quebrada
- ✅ Testes passando

---

## 📋 Fase 3: Integração com PanelShell

### 3.1 Refatorar panel.ts

**Tarefas:**
1. ✅ Modificar `src/ui/panel.ts`:
   - Remover imports diretos de painéis
   - Remover propriedades `historyPanel`, `testPanel`, `reactivationPanel`
   - Criar instância de `ModuleRegistry`
   - Criar instância de `PanelShell`
   - Chamar `registry.discoverModules()` no `init()`
   - Usar `panelShell` para gerar HTML e gerenciar tabs

2. ✅ Atualizar `switchTab()`:
   - Usar `registry.getModule(tabId)` para obter módulo
   - Carregar módulo lazy se necessário
   - Renderizar painel do módulo

3. ✅ Remover métodos específicos:
   - `initializeHistoryPanel()`
   - `initializeTestPanel()`
   - `initializeReactivationPanel()`

**Critérios:**
- ✅ Panel.ts não conhece módulos específicos
- ✅ Tabs geradas dinamicamente
- ✅ Funcionalidades existentes funcionando

---

## 📋 Fase 4: Hierarquia e Lazy Loading

### 4.1 Implementar Hierarquia

**Tarefas:**
1. ✅ Atualizar `ModuleRegistry.getSubModules()`:
   - Retornar módulos filhos de um parent
   - Ordenar por `id` alfabeticamente

2. ✅ Atualizar `PanelShell`:
   - Detectar módulos com `parent`
   - Renderizar como sub-menu ou sub-tabs
   - Exemplo: Marketing → Reativação, Testes A/B, Imagens

3. ✅ Testar hierarquia:
   - Criar módulo pai `marketing` (sem UI própria)
   - Criar sub-módulos `marketing.reactivation`, `marketing.ab-tests`
   - Verificar que renderiza corretamente

### 4.2 Implementar Lazy Loading

**Tarefas:**
1. ✅ Atualizar `ModuleRegistry`:
   - Armazenar `modulePath` em `ModuleDefinition`
   - `loadModule(id: string): Promise<ModuleDefinition>`:
     - Importar dinamicamente: `await import(modulePath)`
     - Retornar módulo carregado

2. ✅ Atualizar `PanelShell.switchTab()`:
   - Verificar se módulo está carregado
   - Se `lazy: true` e não carregado, chamar `registry.loadModule()`
   - Renderizar após carregar

3. ✅ Testar lazy loading:
   - Verificar que módulo não carrega até clicar na tab
   - Verificar que carrega apenas uma vez (cache)

**Critérios:**
- ✅ Módulos lazy só carregam quando necessário
- ✅ Hierarquia renderiza corretamente
- ✅ Performance mantida (bundle inicial pequeno)

---

## 📋 Fase 5: Event Bus e Dependências

### 5.1 Implementar Event Bus

**Tarefas:**
1. ✅ Atualizar `EventBus`:
   - Suportar namespaced events: `'module:event'`
   - Exemplo: `'history:contact-selected'`, `'reactivation:message-sent'`

2. ✅ Integrar com `PanelShell`:
   - Passar `EventBus` para cada módulo ao renderizar
   - Módulos podem emitir/listen eventos

3. ✅ Exemplo de uso:
   ```typescript
   // Em history-panel.ts
   eventBus.emit('history:contact-selected', { contactId: '123' });
   
   // Em reactivation-panel.ts
   eventBus.on('history:contact-selected', (data) => {
     // Atualizar UI com contato selecionado
   });
   ```

### 5.2 Implementar Resolução de Dependências

**Tarefas:**
1. ✅ Atualizar `ModuleRegistry`:
   - Validar dependências ao registrar módulo
   - Verificar que dependências existem
   - Ordenar módulos por dependências (topological sort)

2. ✅ Atualizar `discoverModules()`:
   - Carregar módulos na ordem correta
   - Se dependência faltar, logar erro mas não quebrar

**Critérios:**
- ✅ Event Bus permite comunicação entre módulos
- ✅ Dependências validadas
- ✅ Módulos carregam na ordem correta

---

## 📋 Fase 6: Testes e Documentação

### 6.1 Testes Unitários

**Tarefas:**
1. ✅ `tests/unit/module-registry.test.ts`:
   - Testar `register()`, `getModule()`, `getTopLevelModules()`
   - Testar `discoverModules()` com módulos mock
   - Testar resolução de dependências

2. ✅ `tests/unit/panel-shell.test.ts`:
   - Testar geração de HTML dinâmico
   - Testar `switchTab()` com módulos lazy
   - Testar hierarquia (sub-módulos)

3. ✅ `tests/e2e/plugin-system.spec.ts`:
   - Testar descoberta automática de módulos
   - Testar que adicionar módulo novo não quebra existentes
   - Testar lazy loading em ação

### 6.2 Documentação

**Tarefas:**
1. ✅ Atualizar `docs/PLUGIN_SYSTEM.md`:
   - Arquitetura completa
   - Como criar novo módulo
   - Como usar Event Bus
   - Exemplos de código

2. ✅ Atualizar `README.md`:
   - Seção sobre arquitetura modular
   - Link para documentação

**Critérios:**
- ✅ Testes cobrem casos principais
- ✅ Documentação completa e clara
- ✅ Exemplos funcionais

---

## ✅ Critérios de Conclusão

### Funcionalidade
- ✅ ModuleRegistry descobre módulos automaticamente
- ✅ PanelShell não conhece módulos específicos
- ✅ Módulos se registram sozinhos
- ✅ Suporta hierarquia (módulos dentro de módulos)
- ✅ Lazy loading funcionando
- ✅ Isolamento total entre módulos

### Qualidade
- ✅ TypeScript strict (sem `any`)
- ✅ Testes unitários passando
- ✅ Testes E2E passando
- ✅ Documentação atualizada
- ✅ Lint sem warnings

### Performance
- ✅ Bundle inicial pequeno (lazy loading)
- ✅ Módulos carregam rápido quando necessário
- ✅ Sem degradação com muitos módulos

---

## 🚀 Ordem de Execução Recomendada

1. **Fase 1** (Fundação) - Base sólida
2. **Fase 2** (Migração) - Mover painéis existentes
3. **Fase 3** (Integração) - Refatorar panel.ts
4. **Fase 4** (Hierarquia/Lazy) - Features avançadas
5. **Fase 5** (Event Bus/Deps) - Comunicação e dependências
6. **Fase 6** (Testes/Docs) - Garantir qualidade

**Regra:** Não avançar para próxima fase sem validar completamente a anterior.

---

## 📝 Notas Importantes

- **Isolamento é crítico**: Módulos não devem conhecer outros módulos
- **Descoberta automática**: Não editar `panel.ts` para adicionar módulo
- **Performance**: Lazy loading é essencial para muitos módulos
- **Hierarquia**: Permite organizar módulos naturalmente (ex: Marketing → Reativação)
- **Event Bus**: Comunicação assíncrona, não acoplamento direto

---

> **Este plano garante implementação gradual e segura do Plugin System, sem quebrar funcionalidades existentes.**
