# Módulo Pedidos

---

## 1. Propósito

Este módulo existe para dar ao atendente uma **visão global de todos os pedidos** da conta — independente do chat ativo no atendimento. Enquanto o painel de atendimento mostra **o pedido do cliente atual**, o módulo de pedidos mostra **todos os pedidos, de todos os clientes**, com filtros, métricas e ações em lote.

---

## 2. Conceito

O módulo `pedidos` é um **irmão** do módulo `atendimento` — ambos consomem o mesmo `OrderDB` e partilham o mesmo `OrderRecordV2` (ver [modelo-pedido-unificado.zenspec.md](../atendimento/modelo-pedido-unificado.zenspec.md)). A diferença é a **perspectiva**:

| Perspectiva | Atendimento | Pedidos |
|---|---|---|
| Escopo | 1 cliente (chat ativo) | Todos os clientes (conta) |
| Pedido atual | Em destaque, editável | Listado, ações em lote |
| Histórico | Últimos N do cliente | Todos, com filtros e busca |
| Métricas | Ticket médio do cliente | Totais do dia, abertos, etc. |
| Navegação | — (já está no chat) | "Abrir atendimento →" para o chat do cliente |

Metáfora: o módulo de pedidos é o **"balcão de pedidos"** — o lugar onde o gerente olha tudo que está acontecendo, enquanto o atendimento é o **"caixa"** — focado no cliente da vez.

---

## 3. Pipeline & fluxos

```
OrderDB (todos os registros)
       │
       ▼
  PedidosDashboardModule
       │
       ▼
  getPedidosViewModel()  →  PedidosPanel.render(vm)
       │
       ├─ Filtros (status, busca)
       ├─ Métricas (abertos, total dia, ticket médio)
       ├─ Lista de pedidos
       └─ Detalhe do pedido (expandir)
```

| Programa | Recebe | Faz | Manda para |
| --- | --- | --- | --- |
| `PedidosModule` (container) | — | Agrupa submódulos; rota default → `pedidos.dashboard` | `ModuleRegistry` |
| `PedidosDashboardModule` | `eventBus`, container DOM | Renderiza painel completo com filtros + métricas + lista + detalhe | UI (local) |
| `getPedidosViewModel` | `filtros?`, `busca?` | Consulta `OrderDB`, agrupa por status, calcula métricas | `PedidosPanel` |

---

## 4. Lógica

### 4.1 ViewModel

```typescript
interface PedidosViewModel {
  kind: 'ready'

  // Filtros ativos
  filtroStatus: 'todos' | 'lead' | 'draft' | 'open' | 'awaiting_payment' | 'completed' | 'cancelled' | 'lost'

  // Métricas (calculadas sobre o conjunto filtrado)
  metricas: {
    totalAbertos: number          // lead + draft + open + awaiting_payment
    aguardandoPagamento: number
    totalHojeCentavos: number     // soma de pedidos completed hoje
    ticketMedioCentavos: number   // média de pedidos completed (últimos 30d)
  }

  // Lista de pedidos (ordenada por updatedAtIso desc)
  pedidos: PedidoCardVm[]

  // Termo de busca (filtra por nome do cliente ou nome do produto)
  busca: string
}

interface PedidoCardVm {
  orderId: string
  numeroSequencial: number         // "PED-0042"
  clientKey: string
  clienteNome: string              // resolvido do ClientDB, fallback: dígitos do telefone
  chatId: string
  status: OrderStatusUnificado
  itensResumo: string              // "2 integral, 1 café"
  totalCentavos: number
  createdAtIso: string
  updatedAtIso: string
}
```

### 4.2 Filtros

| Filtro | Comportamento |
|---|---|
| `todos` | Exibe todos os pedidos, sem filtro de status |
| `lead` | Só pedidos em intenção inicial |
| `draft` | Só rascunhos em montagem |
| `open` | Só pedidos confirmados |
| `awaiting_payment` | Só aguardando pagamento |
| `completed` | Só concluídos |
| `cancelled` | Só cancelados |
| `lost` | Só perdidos por inatividade |

Busca textual: filtra localmente (no `pedidos[]` já carregado) por:
- `clienteNome` contém o termo (case-insensitive, sem acento)
- OU `itensResumo` contém o termo
- OU `numeroSequencial` formatado como string contém o termo

### 4.3 Métricas

| Métrica | Cálculo |
|---|---|
| `totalAbertos` | `count(pedidos where status in [lead, draft, open, awaiting_payment])` |
| `aguardandoPagamento` | `count(pedidos where status === 'awaiting_payment')` |
| `totalHojeCentavos` | `sum(pedidos where status === 'completed' and createdAtIso.includes(hoje))` |
| `ticketMedioCentavos` | `avg(pedidos where status === 'completed' and createdAtIso >= 30d atrás)` |

### 4.4 Detalhe do pedido (expandido)

Ao clicar em um card da lista, expande para mostrar:

- **Cabeçalho**: `PED-0042 ○ Aberto` com chip de status colorido
- **Cliente**: nome + telefone + link "Abrir atendimento →"
- **Itens**: tabela com `qty × nome R$ unit. R$ total`
- **Totais**: subtotal, entrega, total
- **Funil**: 5 etapas com estado visual
- **Timeline**: lista de transições com data/hora
- **Observações**: se houver
- **Pagamento**: status + método, se preenchido
- **Ações**:
  - `[Marcar como pago]` → `awaiting_payment → completed`
  - `[Cancelar]` → prompt de motivo → `open/draft → cancelled`
  - `[Abrir atendimento →]` → navega para `atendimento.dashboard` com o chatId do cliente

### 4.5 Navegação para atendimento

```typescript
// Ao clicar "Abrir atendimento →"
emitPanelNavigate('atendimento', { focusChatId: pedido.chatId })
```

O módulo de atendimento, ao receber esta navegação, deve:
1. Focar o chat correspondente no WhatsApp
2. Carregar o ViewModel para aquele `chatId`
3. Exibir o pedido em destaque

---

## 5. Interface

```
┌─ METTRI ───────────────────────────────────────────────────────────────────┐
│  [Atendimento]  [Cadastro]  [📦 Pedidos]  [Catálogo]  [Campanhas]  ...    │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─ Filtros ──────────────────────────────────────────────────────────────┐│
│  │  [Todos]  [Aberto]  [Draft]  [Aguardando]  [Completo]  [Cancelado]    ││
│  │  [🔍 Buscar por cliente ou produto...____________________________]     ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  ┌─ Métricas ─────────────────────────────────────────────────────────────┐│
│  │  🟢 12 abertos  │  🟡 3 aguardando  │  💰 R$ 1.240 hoje  │  📊 R$ 42  ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  ┌─ Lista de pedidos ─────────────────────────────────────────────────────┐│
│  │                                                                         ││
│  │  ┌──────────────────────────────────────────────────────────────────┐  ││
│  │  │ PED-0042 ○ Aberto    Roberta       2 integral, 1 café   R$ 50,00 │  ││
│  │  │ 01/05 10:15                                                      │  ││
│  │  └──────────────────────────────────────────────────────────────────┘  ││
│  │                                                                         ││
│  │  ┌──────────────────────────────────────────────────────────────────┐  ││
│  │  │ PED-0041 ◷ Aguard.   Carlos        5 multigrãos, 3 café R$112,00│  ││
│  │  │ 01/05 09:30                                                      │  ││
│  │  └──────────────────────────────────────────────────────────────────┘  ││
│  │                                                                         ││
│  │  ┌──────────────────────────────────────────────────────────────────┐  ││
│  │  │ PED-0040 ◉ Draft     Ana           3 integral           R$ 30,00 │  ││
│  │  │ 01/05 08:00                                                      │  ││
│  │  └──────────────────────────────────────────────────────────────────┘  ││
│  │                                                                         ││
│  │  ─── expandido ──────────────────────────────────────────────────────  ││
│  │  ┌──────────────────────────────────────────────────────────────────┐  ││
│  │  │ PED-0040 ◉ Draft                                                 │  ││
│  │  │ Cliente: Ana (55119...)         Criado: 01/05 08:00              │  ││
│  │  │                                                                   │  ││
│  │  │ Itens:                         Funil:                            │  ││
│  │  │ 3× Integral 100%   R$ 30,00    ● Produto  ● Endereço  ○ Pgto    │  ││
│  │  │                                ○ Prazo  ○ Fechar  40%           │  ││
│  │  │ Subtotal: R$ 30,00                                               │  ││
│  │  │ Total:    R$ 30,00             Timeline:                         │  ││
│  │  │                                 08:00 lead → 08:02 draft          │  ││
│  │  │                                                                   │  ││
│  │  │ [Marcar como pago]  [Cancelar]  [🔄 Abrir atendimento →]        │  ││
│  │  └──────────────────────────────────────────────────────────────────┘  ││
│  │                                                                         ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Estados visuais

| Estado | Descrição |
|---|---|
| **Vazio** | "Nenhum pedido ainda. Os pedidos criados no atendimento aparecerão aqui." |
| **Carregando** | Skeleton cards (3 linhas) enquanto o OrderDB responde |
| **Com dados** | Lista completa com filtros e métricas |
| **Busca sem resultado** | "Nenhum pedido encontrado para 'termo'." |
| **Erro** | "Erro ao carregar pedidos. [Tentar novamente]" |

### Cores dos chips de status

| Status | Cor |
|---|---|
| `lead` | cinza (`bg-gray-500/20 text-gray-400`) |
| `draft` | azul (`bg-blue-500/20 text-blue-400`) |
| `open` | verde (`bg-green-500/20 text-green-400`) |
| `awaiting_payment` | amarelo (`bg-yellow-500/20 text-yellow-400`) |
| `completed` | verde escuro (`bg-emerald-600/20 text-emerald-400`) |
| `cancelled` | vermelho (`bg-red-500/20 text-red-400`) |
| `lost` | cinza escuro (`bg-gray-600/20 text-gray-500`) |

---

## 6. Casos de borda

| Cenário | Comportamento |
|---|---|
| OrderDB vazio (conta nova) | Estado vazio com mensagem amigável |
| 200+ pedidos | Paginação ou scroll infinito (MVP: carregar últimos 50, botão "Carregar mais") |
| Pedido sem cliente nome (ClientDB falhou) | Mostrar dígitos do telefone como fallback |
| Pedido sem itens (só lead) | `itensResumo = "—"` |
| Filtro ativo + busca textual | Ambos aplicados (interseção): filtra por status, depois busca textual |
| Navegação para atendimento com chat fechado | Abre o atendimento, foca o chat (se possível) ou mostra mensagem "Abra o chat da cliente no WhatsApp" |
| Atendente clica "Cancelar" sem preencher motivo | Não permite prosseguir (validação no prompt) |

---

## 7. Critérios de aceitação

- Módulo aparece no menu lateral como "Pedidos" com ícone.
- Lista carrega pedidos do OrderDB ordenados por data (mais recente primeiro).
- Filtros por status funcionam (clique no chip → lista filtrada).
- Busca textual filtra por nome do cliente ou produto.
- Métricas recalculam com o filtro ativo.
- Card expandido mostra itens, funil, timeline e ações.
- "Abrir atendimento →" navega para o módulo de atendimento.
- Pedidos criados no atendimento aparecem automaticamente na lista (mesmo OrderDB).

---

## 8. Dependências

- `OrderDB` (`src/storage/order-db.ts`): leitura e escrita de `OrderRecordV2`.
- `ClientDB` (`src/storage/client-db.ts`): resolução de nome do cliente para exibição.
- `ModuleRegistry` / `PanelNavigation`: registro do módulo e navegação para atendimento.
- `EventBus`: para notificações de mudança (ex.: pedido cancelado no atendimento → atualizar lista).

---

## 9. Escopo fora

- Emissão de nota fiscal.
- Integração com ERP / sistema financeiro.
- Multi-atendente com locking de pedido.
- Exportação de relatório (CSV/PDF).
- Drag-and-drop para reordenar pedidos.
- Notificações push de novos pedidos.

---

## 10. Referências

- [modelo-pedido-unificado.zenspec.md](../atendimento/modelo-pedido-unificado.zenspec.md): contrato de `OrderRecordV2`.
- [classificar-intencao-conversa.zenspec.md](../atendimento/classificar-intencao-conversa.zenspec.md): como os pedidos são criados.
- [bloco-pedidos-no-painel.zenspec.md](../atendimento/bloco-pedidos-no-painel.zenspec.md): visão de pedidos no atendimento.
- [modulo-pedidos-painel.zenspec.md](modulo-pedidos-painel.zenspec.md): UI detalhada do módulo.
- [registrar-pedido-obrigatorio.zenspec.md](../atendimento/registrar-pedido-obrigatorio.zenspec.md): confirmação de pedido.
- [confirmar-pagamento.zenspec.md](../atendimento/confirmar-pagamento.zenspec.md): transição de pagamento.
