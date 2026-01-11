# Mettri Sentinela - A Parte Física do Copiloto

## Visão Geral

**Mettri Sentinela** é a parte física do copiloto Mettri. É o módulo responsável por **interagir diretamente com o WhatsApp Web**, executando ações, capturando mensagens e mantendo-se sempre ativo e pronto.

## Filosofia

```
┌─────────────────────────────────────────┐
│         Mettri Copiloto                 │
│                                         │
│  ┌─────────────────┐  ┌─────────────┐ │
│  │   Parte Mental  │  │  Parte Física│ │
│  │   (IA/Cérebro)  │◄─►│  (Sentinela)│ │
│  │                 │  │             │ │
│  │ - Decisões      │  │ - Execução  │ │
│  │ - Sugestões     │  │ - Captura   │ │
│  │ - Análise       │  │ - Ações     │ │
│  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────┘
```

**Mettri Sentinela** é como os "braços e olhos" do copiloto:
- 👁️ **Observa** tudo que acontece no WhatsApp Web
- 🤖 **Executa** ações quando solicitado
- 📡 **Captura** mensagens em tempo real
- 🔄 **Mantém-se sempre ativo** e pronto

## Responsabilidades

### ✅ O que a Sentinela faz:

1. **Execução de Ações**
   - Envia mensagens
   - Abre chats
   - Busca contatos
   - Executa qualquer ação do WhatsApp Web

2. **Captura de Mensagens**
   - Observa DOM em tempo real
   - Captura mensagens enviadas e recebidas
   - Mantém histórico completo

3. **Mapeamento de Ações**
   - Conhece TODAS as ações possíveis
   - Mapeia seletores e métodos
   - Tenta múltiplos métodos para garantir sucesso

4. **Gravação e Histórico**
   - Registra todas as ações executadas
   - Mantém histórico para análise
   - Fornece estatísticas em tempo real

### ❌ O que a Sentinela NÃO faz:

- Não toma decisões (isso é da parte mental)
- Não processa dados (delega para outros módulos)
- Não analisa contexto (apenas executa e captura)

## Arquitetura

```
src/whatsapp/core/  (renomeado para src/mettri/sentinela/)
├── actions-map.js      → Mapeamento de ações
├── action-executor.js  → Executor robusto
└── index.js            → API pública (MettriSentinela)
```

## API Pública

```javascript
// Executar ação
await MettriSentinela.sendMessage('Olá!');
await MettriSentinela.openChat('Nome do Contato');

// Obter informações
const actions = MettriSentinela.getAllActions();
const history = MettriSentinela.getActionHistory();
const stats = MettriSentinela.getStats();

// Controle
MettriSentinela.startRecording();
MettriSentinela.stopRecording();
```

## Sempre Pronto

A Sentinela está **sempre ativa**:
- ✅ Inicia automaticamente quando a extensão carrega
- ✅ Observa DOM continuamente
- ✅ Captura mensagens em tempo real
- ✅ Mantém histórico atualizado
- ✅ Pronta para executar ações a qualquer momento

## Interface Visual

A Sentinela tem sua própria aba no painel:
- **Aba "Sentinela"** (antes "Ações")
- Lista todas as ações disponíveis
- Histórico de execuções
- Estatísticas em tempo real
- Toggle de gravação

## Nomenclatura

- **Mettri Sentinela** = Nome completo do módulo
- **MettriSentinela** = Objeto JavaScript global
- **sentinela/** = Diretório do módulo

## Por que "Sentinela"?

1. **Sempre Vigilante**: Observa tudo que acontece
2. **Sempre Pronta**: Pronta para executar quando necessário
3. **Proteção**: Garante que nada seja perdido
4. **Autonomia**: Funciona independentemente da parte mental

---

**Mettri Sentinela** - Os olhos e braços do copiloto, sempre prontos para agir.











