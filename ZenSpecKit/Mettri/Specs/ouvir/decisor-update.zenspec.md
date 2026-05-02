# DecisorUpdate — Decisão de Tipo de Update

>Programa que decide o tipo de persistência (memoria/contexto_venda/contexto_conversa/feedback_atendente) para cada campo.

## 1. Propósito

Determinar como cada campo deve ser persistido:
- **memoria**: Persistente, survives entre atendimentos
- **contexto_venda**: Estado atual da venda, reseta a cada ciclo
- **contexto_conversa**: Efêmero, descartado após atendimento
- **feedback_atendente**: Correção do atendente, recalibra extração

## 2. Input / Output

```typescript
// Input
interface DecisorInput {
  camposExtraidos: CampoValidado[]       // do Extrator + Validador
  camposPerfilAnterior: PerfilCliente  // do CustomerProfileDB
  urgencia: "alta" | "media" | "baixa"
  contextoVenda: EstadoVenda         // do atualizar-contexto-de-venda
  ultimo Feedback?: FeedbackEntry     // feedback anterior do atendente
}

// Output
interface DecisorOutput {
  atualizacoes: DecisaoUpdate[]
}
```

## 3. Tipos de update

| Tipo | Persistência | Escopo | Expiração |
|------|-------------|--------|-----------|
| `memoria` | CustomerProfileDB | Global | Nunca |
| `contexto_venda` | EstadoVenda | Venda atual | Fim do ciclo |
| `contexto_conversa` | ContextoConversa | Conversa atual | Fim do atendimento |
| `feedback_atendente` | FeedbackDB | Re-calibração | Correção futura |

## 4. Matriz de decisão

### 4.1 Por tipo de campo

| Campo | Tipo default | Condição | Override |
|-------|--------------|----------|----------|
| `nome` | memoria | confianca >= media | - |
| `telefone` | memoria | confianca >= media | - |
| `preferenciasProduto` | contexto_venda | urgencia=alta | memoria se confianca=alta |
| `aversoesProduto` | contexto_venda | - | memoria se confianca=alta |
| `enderecoEntrega` | contexto_venda | urgência=alta | memoria se confianca=alta E estável |
| `formaPagamentoPreferida` | memoria | confianca >= media | - |
| `urgenciaEntrega` | contexto_venda | - | (sempre temporário) |
| `observacoesLogisticas` | contexto_venda | urgência=alta | contexto_conversa se ephemeral |

## 4. Modelo de confiança (4 níveis)

| Valor | Significado | Re-processa? |
| --- | --- | --- |
| `desconhecido` | Nunca extraído | Sim, sempre |
| `baixa` | Extraído com dúvida | Sim |
| `media` | Extraído com evidência parcial | Sim |
| `alta` | Confirmado por mais de uma ocorrência ou por `feedback_atendente` | **Não** até sinal de release |

**Regra:** `confianca === 'alta'` → o Ouvinte **não processa** esse campo até que um sinal de release o rebaixe para `baixa`.

### 4.3 Por urgência

| Urgência | Impacto |
|----------|--------|
| `alta` | Força contexto_venda (estado atual) |
| `media` | Mantém decisão por confiança |
| `baixa` | Preferência memoria se confiança alta |

### 4.4 Por sinal de release

| Sinal | Tipo |
|-------|------|
| `invalidar` | contexto_venda (re-extração) + limpar memoria temporariamente |
| `recalcular` | feedback_atendente (para retreino) |

## 5. Regras de conflito

### 5.1 Memória vs Contexto

```
SE campo.existe em memoria
  E novo.confianca >= anterior.confianca
    → Atualizar memoria

SE campo.existe em memoria
  E novo.confianca < anterior.confianca
    → Ignorar (manter anterior)

SE campo.existe apenas em contexto_venda
  E novo.confianca >= media
    → Migrar para memoria
```

### 5.2 feedback_atendente

```
SE tipo = feedback_atendente
  → Sobrescrever qualquer valor anterior
  → Definir confianca = alta (atendente confirmo)
  → Criar entrada em FeedbackDB para retreino
```

## 6. Output para atualizarPerfilOperacionalCliente

```typescript
interface DecisaoUpdate {
  campo: string
  tipo: "memoria" | "contexto_venda" | "contexto_conversa" | "feedback_atendente"
  valor: any
  confianca: number
  prioridade: "alta" | "media" | "baixa"
  condicoes: string[]
}
```

## 7. Casos de borda

| Cenário | Comportamento |
|--------|---------------|
| Todos campos com confianca desconhecido | Não gerar atualizacoes |
| Conflito memoria vs contexto_venda | Regra: maior confiança wins |
| Feedback contradiz extração | Feedback wins (atendente corrige) |
| Urgência alta + confianca baixa | contexto_venda forçado |
| Campo já em memoria com confianca=alta | Não re-sobrescrever (confianca >= alta) |

## 8. Referências

- spec.md (pai): arquitetura geral do Ouvinte
- extrator.zenspec.md: campos extraídos
- validador-catalogo.zenspec.md: campos validados
- sinais-release.zenspec.md: sinais de release
- atualizar-perfil-operacional-do-cliente.zenspec.md (cadastro/)
- atualizar-contexto-de-venda.zenspec.md (atendimento/)