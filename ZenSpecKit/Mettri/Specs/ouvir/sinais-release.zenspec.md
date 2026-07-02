---
status: obsoleto
---

# SinaisRelease — Sinais de Liberação

>Programa que detecta expressões do cliente que indicam mudança de ideia, invalidando campos anteriores.

## 1. Propósito

Quando o cliente diz expressões como "na verdade", "mudei de ideia", os campos anteriores perdem confiança e devem ser reavaliados.

## 2. Input / Output

```typescript
// Input
interface SinaisReleaseInput {
  mensagem: string
  camposPerfilAnterior: {
    [campo: string]: {
      valor: any
      confianca: number
    }
  }
}

// Output
interface SinaisReleaseOutput {
  sinais: ReleaseSignal[]
  // Campos que devem ter confiança reduzida
}
```

## 3. Tabela de sinais de release

| Campo | Sinal | Nova confiança |justificativa |
|-------|-------|----------------|-------------|
| `preferenciasProduto` | "na verdade" | baixa | Cliente corrigiu |
| `preferenciasProduto` | "mudei de ideia" | baixa | Mudança explícita |
| `preferenciasProduto` | "em vez disso" |baixa | Substituição |
| `preferenciasProduto` | "não, eu disse" |baixa | Autocorreção |
| `preferenciasProduto` | "esquece" |desconhecido | Cancelamento |
| `aversoesProduto` | "na verdade" | baixa | Correção |
| `enderecoEntrega` | "mudei de endereço" |baixa | Novo endereço |
| `enderecoEntrega` | "outro endereço" |baixa | Substituição |
| `enderecoEntrega` | "não, é" |baixa | Correção |
| `formaPagamentoPreferida` | "vou pagar de outro jeito"|baixa | Mudança |
| `formaPagamentoPreferida` | "em vez de" |baixa | Substituição |
| `urgenciaEntrega` | "né, |baixa | Não era urgente |

## 4. Algoritmo

### 4.1 Detecção

```
PARA CADA sinal na tabela:
  SEmensagem contém sinal
    → criar ReleaseSignal(campo, sinal, novaConfianca)
```

### 4.2 Aplicação de confiança

```
PARA CADA ReleaseSignal:
  SEconfiancaAnterior > novaConfianca
    → aplicar novaConfianca
  SENÃO
    → manter confiancaAnterior (já está baixa)
```

## 5. Comportamento por força do sinal

| Tipo de sinal | Force |
|--------------|-------|
| "esquece" | RESET (desconhecido) |
| "na verdade", "mudei de ideia" | DOWNGRADE (baixa) |
| "não, eu disse" | DOWNGRADE (baixa) |
| "em vez disso" | REPLACE (próxima mensagem substitui) |

## 6. Casos de borda

| Cenário | Comportamento |
|--------|---------------|
| Múltiplos sinais na mesma mensagem | Aplicar o mais forte |
| Campo não existe no perfil anterior | Ignorar sinal |
| Confiança já é "desconhecido" | Manter |

## 7. Output para DecisorUpdate

O output inclui:
- Lista de campos com confiança modificada
- Flag indicando se cada campo deve ser reextraído

```
Para campos com release:
  → Tipo update = "memoria" (re-save após reextração)
  → Flag reextrair = true

Para campos sem release:
  → DecisorUpdate decide tipo normalmente
```

## 8. Referências

- spec.md (pai): arquitetura geral do Ouvinte
- extrator.zenspec.md: campos extraídos
- decisor-update.zenspec.md: decisão de update