# ValidadorCatalogo — Validação Contra Catálogo

>Programa que valida valores extraídos contra o catálogo de produtos e formas de pagamento.

## 1. Propósito

Aumentar a confiança de campos extraídos quando correspondem a itens do catálogo, e rejeitar valores inválidos.

## 2. Input / Output

```typescript
// Input
interface ValidadorInput {
  campos: CampoExtraido[]
}

// Output
interface ValidadorOutput {
  campos: CampoValidado[]
}

interface CampoValidado extends CampoExtraido {
  confiancaAjustada: number  // 0.1 - 1.0
  valido: boolean
  normalizado?: string
  catalogoMatch?: {
    tipo: "produto" | "formaPagamento"
    itemId: string
  }
}
```

## 3. Catálogos disponíveis

### 3.1 Catálogo de Produtos

```
Fontes: ProdutoDB (cadastro/spec.md)
Estrutura: { id, nome, categoria, variantes, precos }
```

### 3.2 Formas de Pagamento

```
Fontes: Configuração do sistema
Valores válidos: "PIX", "crédito", "débito", "transferência", "dinheiro", "boleto"
```

## 4. Matriz de validação

| Campo | Fonte catálogo | Comportamento se válido | Comportamento se inválido |
|-------|---------------|-------------------------|-------------------------|
| `preferenciasProduto` | ProdutoDB | confianca += 0.3 | confianca = 0.1, valido = false |
| `aversoesProduto` | ProdutoDB | confianca += 0.2 | confianca = 0.1, valido = false |
| `formaPagamentoPreferida` | FormasPagamento | confianca = 1.0 | confianca = 0.1, valido = false |
| `enderecoEntrega` | - | confianca += 0.1 (CEP válidos) | manter |
| `urgenciaEntrega` | - | (não aplicável) | (não aplicável) |

## 5. Ajuste de confiança

### 5.1 Fómula

```
confiancaAjustada =
  SE valido E confianca >= media
    → min(1.0, confianca + bonusCatalogo)
  SE valido E confianca = baixa
    → 0.4  // promoção para média se válido
  SE invalido
    → 0.1  // rebaixar para mínima
```

### 5.2 Bônus por tipo de match

| Tipo match | Bônus |
|-----------|------|
| Nome exato no catálogo | +0.3 |
| Sinonimo reconhecido | +0.2 |
| Variação grafia | +0.1 |

## 6. Normalização

O Validador também normaliza valores para storage:

| Original | Normalizado |
|----------|-------------|
| "pagar com pix" | "PIX" |
| "no credito" | "crédito" |
| "pepperoni" | "Pizza Pepperoni" (se catálogo tiver) |
| "portuguesa" | "Pizza Portuguesa" |

## 7. Output para SinaisRelease

Os campos validados são passados para o próximo programa:

```
Para cada campo (valido = true):
  → incluir em camposParaRelease

Para cada campo (valido = false):
  → incluir com confianca = 0.1
```

## 8. Casos de borda

| Cenário | Comportamento |
|--------|---------------|
| Produto com variação (ex.: "pizza" → "Pizza") | Normalizar e validar |
| Múltiplos matches no catálogo | Usar o mais específico (categoria > genérico) |
| Catálogo vazio | Retornar campos como estão |
| Campo não validável (ex.: observacoesLogisticas) | Passar adiante |

## 9. Referências

- spec.md (pai): arquitetura geral do Ouvinte
- extrator.zenspec.md: campos extraídos
- sinais-release.zenspec.md: detecção de release
- ProdutoDB (cadastro/spec.md)