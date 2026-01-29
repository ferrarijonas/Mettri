# 📊 Como Usar o Monitoramento de Estratégias

## 🚀 Início Rápido

### 1. Consultar Estatísticas

No console do WhatsApp Web (F12 → Console):

```javascript
// Obter relatório completo
const report = StrategyMonitor.getReport();
console.log(report);

// Imprimir relatório formatado
StrategyMonitor.printReport();
```

### 2. Verificar Estratégias Redundantes

```javascript
// Verificar se há estratégias nunca usadas
if (StrategyMonitor.hasRedundantStrategies()) {
  console.log('⚠️ Há estratégias redundantes!');
  
  // Listar todas as estratégias redundantes
  const redundant = StrategyMonitor.getRedundantStrategies();
  console.table(redundant);
}
```

### 3. Estatísticas de um Módulo Específico

```javascript
// Estatísticas do módulo Msg
const msgStats = StrategyMonitor.getModuleStats('Msg');
console.log(msgStats);
```

---

## 📋 Exemplos de Saída

### Relatório Completo

```javascript
StrategyMonitor.printReport();
```

**Saída:**
```
📊 RELATÓRIO DE ESTRATÉGIAS

============================================================
Total de módulos: 10
Total de chamadas: 5000
Estratégias redundantes: 15
============================================================

📦 Msg
   Total de chamadas: 1000
   Estratégia mais usada: 1
   Estratégias nunca usadas: 2, 3, 4

   Estratégias:
   ✅ Estratégia 1: 1000x usado, 100% sucesso
   ❌ Estratégia 2: 0x usado, 0% sucesso
   ❌ Estratégia 3: 0x usado, 0% sucesso
   ❌ Estratégia 4: 0x usado, 0% sucesso

📦 Chat
   Total de chamadas: 800
   Estratégia mais usada: 1
   Estratégias nunca usadas: 2, 3, 4

   Estratégias:
   ✅ Estratégia 1: 800x usado, 100% sucesso
   ❌ Estratégia 2: 0x usado, 0% sucesso
   ...
```

### Relatório JSON

```javascript
const json = StrategyMonitor.export();
console.log(json);
```

**Saída:**
```json
{
  "modules": {
    "Msg": {
      "module": "Msg",
      "totalCalls": 1000,
      "strategies": [
        {
          "strategy": 1,
          "used": 1000,
          "success": 1000,
          "successRate": 100,
          "lastUsed": "2026-01-15T10:30:00.000Z"
        },
        {
          "strategy": 2,
          "used": 0,
          "success": 0,
          "successRate": 0,
          "lastUsed": null
        }
      ],
      "neverUsed": [2, 3, 4],
      "mostUsed": 1
    }
  },
  "summary": {
    "totalModules": 10,
    "totalCalls": 5000,
    "redundantStrategies": 15
  }
}
```

---

## 🔧 Configuração

### Habilitar/Desabilitar Monitoramento

```javascript
// Desabilitar (útil para produção se necessário)
StrategyMonitor.setEnabled(false);

// Habilitar novamente
StrategyMonitor.setEnabled(true);
```

### Modo Debug (Logs Detalhados)

```javascript
// Habilitar logs detalhados
StrategyMonitor.setDebugMode(true);

// Agora cada uso de estratégia será logado:
// [STRATEGY] Msg: estratégia 1 ✅ (total: 1000)
// [STRATEGY] Chat: estratégia 1 ✅ (total: 800)

// Desabilitar logs
StrategyMonitor.setDebugMode(false);
```

---

## 📊 Análise de Dados

### Identificar Estratégias Redundantes

```javascript
const redundant = StrategyMonitor.getRedundantStrategies();
// [
//   { module: 'Msg', strategies: [2, 3, 4] },
//   { module: 'Chat', strategies: [2, 3, 4] },
//   { module: 'MsgKey', strategies: [2, 3, 4, 5] }
// ]
```

### Verificar Taxa de Sucesso

```javascript
const report = StrategyMonitor.getReport();
for (const [moduleName, moduleData] of Object.entries(report.modules)) {
  console.log(`${moduleName}:`);
  for (const strategy of moduleData.strategies) {
    if (strategy.used > 0) {
      console.log(`  Estratégia ${strategy.strategy}: ${strategy.successRate}% sucesso`);
    }
  }
}
```

### Encontrar Estratégia Mais Usada

```javascript
const report = StrategyMonitor.getReport();
for (const [moduleName, moduleData] of Object.entries(report.modules)) {
  console.log(`${moduleName}: estratégia ${moduleData.mostUsed} é a mais usada`);
}
```

---

## 🧹 Manutenção

### Limpar Estatísticas

```javascript
// Limpar todas as estatísticas (útil para resetar após análise)
StrategyMonitor.clear();
```

### Exportar para Análise Externa

```javascript
// Exportar JSON
const json = StrategyMonitor.export();

// Salvar em arquivo (via download)
const blob = new Blob([json], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'strategy-stats.json';
a.click();
```

---

## 🎯 Casos de Uso

### 1. Verificar Robustez Após Atualização do WhatsApp

```javascript
// Antes da atualização
StrategyMonitor.clear();
// ... usar extensão normalmente por alguns dias ...

// Depois da atualização
const report = StrategyMonitor.getReport();
if (report.summary.redundantStrategies > 0) {
  console.log('⚠️ Algumas estratégias nunca foram usadas - pode ser redundância ou problema');
}
```

### 2. Otimizar Código (Remover Redundâncias)

```javascript
// Após coletar dados por 1-2 semanas
const redundant = StrategyMonitor.getRedundantStrategies();

// Se estratégias 2-5 nunca foram usadas para Msg, podemos removê-las
if (redundant.find(r => r.module === 'Msg' && r.strategies.includes(2))) {
  console.log('💡 Pode remover estratégia 2 do getter Msg');
}
```

### 3. Debug de Problemas

```javascript
// Se algo quebrar, verificar qual estratégia estava funcionando
const msgStats = StrategyMonitor.getModuleStats('Msg');
console.log('Última estratégia que funcionou:', msgStats.mostUsed);
console.log('Estratégias que nunca funcionaram:', msgStats.neverUsed);
```

---

## 📝 Notas Importantes

1. **Estatísticas são em memória** - Perdidas ao recarregar página
2. **Monitoramento é passivo** - Não impacta performance
3. **Logs são opcionais** - Use `setDebugMode(true)` apenas para debug
4. **Dados reais** - Coleta de uso real, não simulação

---

## 🔮 Próximos Passos

Após coletar dados por 1-2 semanas:

1. Analisar relatório
2. Identificar estratégias redundantes
3. Remover código redundante
4. Documentar padrões descobertos
5. Otimizar ordem de estratégias (mais usadas primeiro)

---

**Documentação de uso prático do sistema de monitoramento.**
