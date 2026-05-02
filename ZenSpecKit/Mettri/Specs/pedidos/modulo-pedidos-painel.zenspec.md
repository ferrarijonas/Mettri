# Painel do módulo de pedidos (`PedidosPanel`)

Esta feature existe para que o atendente tenha uma **interface visual completa** de todos os pedidos da conta, com filtros, métricas, lista, detalhe expandível e ações — seguindo o mesmo padrão visual do painel de atendimento.

---

## 1. Propósito

Renderizar o painel do módulo `pedidos` no shell direita-do-WhatsApp, com layout responsivo, chips de filtro, cards de pedido colapsáveis e ações inline. O painel é **independente** do chat ativo — mostra todos os pedidos, de todos os clientes.

Panorama: [spec.md](spec.md) (módulo-mãe pedidos).

---

## 2. Conceito

O `PedidosPanel` segue o mesmo padrão de `AtendimentoPanel`: recebe um ViewModel pronto do provider e renderiza HTML no container. Não faz I/O diretamente.

Metáfora: é o **"livro-caixa"** do negócio — todos os pedidos visíveis de relance, com drill-down para detalhes.

---

## 3. Pipeline & fluxos

```
getPedidosViewModel(filtros?, busca?)
       │
       ▼
  PedidosPanel.render(vm)
       │
       ├─ Renderiza barra de filtros
       ├─ Renderiza cards de métricas
       ├─ Renderiza lista de pedidos
       └─ (se expandido) Renderiza detalhe do pedido
```

| Programa | Recebe | Faz | Manda para |
| --- | --- | --- | --- |
| `PedidosPanel` | `container: HTMLElement`, `vm: PedidosViewModel` | Renderiza HTML; vincula eventos de clique (filtros, busca, expandir, ações) | `PedidosDashboardModule` (para dispatch de ações) |

---

## 4. Lógica

### 4.1 ViewModel

Conforme definido em [spec.md](spec.md) §4.1:

```typescript
interface PedidosViewModel {
  kind: 'ready'
  filtroStatus: string
  metricas: { totalAbertos, aguardandoPagamento, totalHojeCentavos, ticketMedioCentavos }
  pedidos: PedidoCardVm[]
  busca: string
}
```

### 4.2 Barra de filtros

Chips horizontais com scroll, cada um representando um status:

```
[Todos] [Aberto] [Draft] [Aguardando] [Completo] [Cancelado]
```

- `[Todos]` ativo por padrão.
- Clique em um chip → dispara `filter:change` com o status correspondente.
- Chip ativo tem `bg-brand/20 text-brand border-brand/30`.
- Chip inativo tem `bg-transparent text-muted border-muted/20`.
- Abaixo dos chips: campo de busca textual (`<input type="search">`).

**Contadores nos chips (MVP)**:

| Chip | Contador |
|---|---|
| Aberto | `lead + draft + open + awaiting_payment` |
| Draft | `draft` |
| Aguardando | `awaiting_payment` |
| Completo | `completed` |
| Cancelado | `cancelled + lost` |

Contador aparece entre parênteses à direita do label: `Aberto (12)`.

### 4.3 Cards de métricas

4 métricas em linha horizontal (2×2 em mobile):

| Métrica | Label | Formato |
|---|---|---|
| Abertos | `totalAbertos` | número inteiro |
| Aguardando pagamento | `aguardandoPagamento` | número inteiro |
| Total hoje | `totalHojeCentavos / 100` | `R$ X,XX` |
| Ticket médio | `ticketMedioCentavos / 100` | `R$ X,XX` |

Cada card: fundo `bg-card`, borda `border`, padding `p-3`, texto centralizado. Valor em destaque (`text-2xl font-bold`), label em `text-xs text-muted`.

### 4.4 Lista de pedidos

Cada pedido renderizado como um card colapsável:

```
┌─────────────────────────────────────────────────────────────┐
│ PED-0042  ○ Aberto    Roberta       2 integral, 1 café     │
│                       01/05 10:15                  R$ 50,00 │
└─────────────────────────────────────────────────────────────┘
```

**Estado colapsado** (linha única):
- Número do pedido (`PED-0042`): `font-mono text-sm`, à esquerda.
- Status: chip colorido (mini, 2 linhas no mobile).
- Nome do cliente: `font-medium`, truncado se >20 caracteres.
- Data: `text-xs text-muted`, formato `DD/MM HH:MM`.
- Resumo dos itens: `text-xs text-muted`, truncado se >30 caracteres.
- Total: `font-mono text-sm font-medium`, alinhado à direita, formato `R$ X,XX`.

**Estado expandido** (ao clicar no card):

```
┌─────────────────────────────────────────────────────────────┐
│ PED-0040  ◉ Draft                                           │
│ Cliente: Ana (55119...)          Criado: 01/05 08:00        │
│                                                              │
│ Itens:                        Funil:                        │
│ 3× Integral 100%  R$ 30,00    ● Produto  ● Endereço  ○ Pgto │
│ Subtotal: R$ 30,00            ○ Prazo  ○ Fechar  40%        │
│ Total: R$ 30,00                                             │
│                                                              │
│ Timeline:                                                    │
│ 08:00 lead → 08:02 draft                                    │
│                                                              │
│ Observações: (se houver)                                    │
│                                                              │
│ Pagamento: (se houver)                                      │
│ ───────────────────────────────────                         │
│ [Marcar como pago]  [Cancelar]  [🔄 Abrir atendimento →]   │
└─────────────────────────────────────────────────────────────┘
```

Regras de renderização:
- **Itens**: cada item em linha `qty× nome R$ total`. Sempre usar `font-mono` para quantidades e preços (`tabular-nums`). Símbolo `×` (U+00D7).
- **Funil**: barra de progresso horizontal com 5 segmentos coloridos (verde=ok, cinza=pendente). Abaixo, labels compactos.
- **Timeline**: lista vertical compacta, cada linha: `HH:MM statusAnterior → statusNovo`. Se tiver motivo, aparece em `text-xs text-muted` abaixo.
- **Ações**: alinhadas à direita, separadas por `|` ou espaçamento.

### 4.5 Ordenação

Por padrão: `updatedAtIso` descendente (mais recente primeiro).

### 4.6 Busca textual

- `input[type=search]` com placeholder "Buscar por cliente ou produto...".
- Filtro aplicado **localmente** (não refaz query no OrderDB).
- Debounce de 300ms antes de aplicar.
- Case-insensitive, sem acento (normalize NFD).
- Se `pedidos.length === 0` após busca → mensagem "Nenhum pedido encontrado para 'termo'."

### 4.7 Paginação

MVP: carregar últimos 50 pedidos, botão "Carregar mais 50" no fim da lista.

---

## 5. Interface

### 5.1 Estados visuais

| Estado | Renderização |
|---|---|
| **Vazio** | Ícone centralizado + texto "Nenhum pedido ainda. Os pedidos criados no atendimento aparecerão aqui." |
| **Carregando** | 4 skeleton cards (barras cinza com `animate-pulse`) |
| **Com dados** | Filtros + métricas + lista |
| **Busca sem resultado** | Ícone de busca + "Nenhum pedido encontrado para 'termo'." |
| **Erro** | Texto "Erro ao carregar pedidos." + botão "[Tentar novamente]" |

### 5.2 Layout completo (wireframe)

```
┌─ 📦 Pedidos ─────────────────────────────────────────────────────────────────┐
│                                                                               │
│  ┌─ Barra de filtros ──────────────────────────────────────────────────────┐ │
│  │  [Todos (12)] [Aberto (8)] [Draft (2)] [Aguardando (1)]                │ │
│  │  [Completo (3)] [Cancelado (1)]                                         │ │
│  │                                                                          │ │
│  │  [🔍 Buscar por cliente ou produto...________________________________] │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ┌─ Métricas ───────────────────────────────────────────────────────────────┐ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                │ │
│  │  │    12    │  │    1     │  │R$ 1.240  │  │  R$ 42   │                │ │
│  │  │ Abertos  │  │ Aguard.  │  │ Total hoje│  │  Ticket   │                │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ┌─ Lista ──────────────────────────────────────────────────────────────────┐ │
│  │                                                                           │ │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │ │
│  │  │ PED-0042 ○ Aberto   Roberta         2 integral, 1 café    R$ 50,00 │ │ │
│  │  │                     01/05 10:15                                     │ │ │
│  │  └─────────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                           │ │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │ │
│  │  │ PED-0041 ◷ Aguard.  Carlos          5 multigrãos, 3 café R$ 112,00 │ │ │
│  │  │                     01/05 09:30                                     │ │ │
│  │  └─────────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                           │ │
│  │  ┌───────── expandido ─────────────────────────────────────────────────┐ │ │
│  │  │ PED-0040 ◉ Draft                                                    │ │ │
│  │  │ Cliente: Ana (55119...)          Criado: 01/05 08:00                │ │ │
│  │  │                                                                      │ │ │
│  │  │ Itens:                          Funil:                              │ │ │
│  │  │ 3× Integral 100%  R$ 30,00      ● Produto  ● Endereço  ○ Pgto      │ │ │
│  │  │ Subtotal: R$ 30,00              ○ Prazo  ○ Fechar  40%             │ │ │
│  │  │ Total: R$ 30,00                                                     │ │ │
│  │  │                                                                      │ │ │
│  │  │ Timeline:                                                            │ │ │
│  │  │ 08:00 lead → 08:02 draft                                            │ │ │
│  │  │                                                                      │ │ │
│  │  │ [Marcar como pago]  [Cancelar]  [🔄 Abrir atendimento →]           │ │ │
│  │  └──────────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                           │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  [Carregar mais]                                                              │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Animações

- Transição de filtro: `opacity` fade 150ms nos cards ao trocar filtro.
- Expandir card: `max-height` transition 200ms ease-in-out.
- Flash verde: quando status do pedido muda para `completed`, o card pisca verde por 1.5s (análogo ao `flash-update` do atendimento).
- Skeleton loading: `animate-pulse` nos placeholders.

---

## 6. Casos de borda

| Cenário | Comportamento |
|---|---|
| Cliente removido do ClientDB | Nome aparece como dígitos do telefone (fallback do chatId) |
| Pedido com itens vazios (lead sem produto) | `itensResumo = "—"`, total = `R$ 0,00` |
| 200+ pedidos | Botão "Carregar mais 50" no fim da lista; loading spinner enquanto carrega |
| Filtro ativo + busca textual ambos aplicados | Interseção: filtra por status primeiro, depois busca textual |
| "Abrir atendimento →" com WhatsApp fechado | Alerta: "Abra o WhatsApp Web primeiro para acessar o atendimento." |
| Cancelar pedido em `completed` | Botão oculto (completed não pode ser cancelado) |
| Pedido `lost` aparece na lista | Mostrado com chip cinza escuro, sem ações disponíveis (só visualização) |

---

## 7. Critérios de aceitação

- Lista renderiza pedidos do OrderDB com nome do cliente resolvido.
- Filtro por status funciona: clique no chip → lista filtrada + métricas recalculadas.
- Busca textual filtra localmente sem nova query.
- Card expandido mostra itens, funil, timeline.
- "Marcar como pago" avança `awaiting_payment → completed`.
- "Cancelar" abre prompt de motivo e avança para `cancelled`.
- "Abrir atendimento →" navega para `atendimento.dashboard` com o chatId.
- Skeleton loading aparece enquanto dados carregam.
- Estado vazio aparece quando OrderDB está vazio.

---

## 8. Dependências

- `PedidosViewModel` (definido em [spec.md](spec.md)).
- `OrderDB` (`advanceStatus`, `listAll`, `getByOrderId`).
- `ClientDB` (resolução de nome).
- `ModuleRegistry` / `emitPanelNavigate` (navegação).
- `EventBus` (`order:status-changed`, `order:item-changed`).

---

## 9. Escopo fora

- Edição inline de itens (MVP: só no atendimento, em draft).
- Drag-and-drop para reordenar.
- Exportação CSV/PDF.
- Filtro por data/intervalo.
- Ordenação por coluna (clique no cabeçalho).
- Modo escuro específico (segue tema global).

---

## 10. Referências

- [spec.md](spec.md): módulo-mãe pedidos.
- [../atendimento/modelo-pedido-unificado.zenspec.md](../atendimento/modelo-pedido-unificado.zenspec.md): contrato `OrderRecordV2`.
- [../atendimento/atendimento-unificado.zenspec.md](../atendimento/atendimento-unificado.zenspec.md): padrão de UI seguido (funil, cores, animações).
