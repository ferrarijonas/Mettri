---
id: "T-001"
titulo: "Detector de nova compra — identificar compras a partir da conversa"
dominio: "atendimento (pedidos)"
status: "pendente"
prioridade: 3
dependencias: []
bloqueado_por: []
bloqueia: []
tentativas: 0
max_tentativas: 3
criado_em: "2026-05-05T16:25:00-03:00"
escopo:
  modulos:
    - src/modules/atendimento/comercial/           # pipeline comercial
    - src/modules/atendimento/dashboard/provider.ts # ponto de integração
    - src/storage/purchase-db.ts                    # registro de compra
    - src/storage/order-db.ts                       # criação de lead
  nao_tocar:
    - src/modules/rag/
    - src/modules/marketing/
    - src/modules/catalogo/
    - src/modules/ouvir/
    - src/modules/clientes/
spec_ref: ""
---

## Propósito

Detectar automaticamente quando um cliente está fazendo uma **nova compra** durante a conversa no WhatsApp, e criar os registros necessários (OrderDB + PurchaseDB) sem depender exclusivamente de ação manual.

Atualmente o sistema só detecta `compra_nova` via `classificarIntencao()` no provider do atendimento (verifica só a última mensagem com triggers fixos). Não há um detector dedicado que acompanhe a conversa e registre a compra de forma consistente.

## Escopo

**Inclui:**

1. Criar um módulo/serviço `detectar-nova-compra.ts` em `src/modules/pedidos/` que:
   - Escuta mensagens do cliente capturadas pelo MessageDB
   - Aplica heurísticas para identificar sinais de compra (pedido explícito, confirmação de itens, acordo de valor, etc.)
   - Quando detecta uma nova compra com confiança suficiente, cria/atualiza registros:
     - **OrderDB**: cria um pedido `lead` (se não existir um ativo)
     - **PurchaseDB**: registra a compra como `AI_DETECTED`
     - **CustomerProfileDB**: atualiza `ultimaCompra`
   
2. Integrar o detector no pipeline de atendimento:
   - No `getAtendimentoViewModel()` (provider.ts), após classificar intenção
   - Ou como um listener no EventBus disparado por novas mensagens

3. O detector deve ter:
   - Estado por chatId (não re-detectar a mesma compra)
   - Limite de confiança mínimo para criar registros
   - Logging para auditoria

4. Testes unitários para as heurísticas de detecção

**Não inclui:**
- Refatorar o `classificarIntencao()` existente (convivência pacífica)
- Machine learning ou LLM para detecção
- Detecção de múltiplas compras simultâneas no mesmo chat
- Cancelamento automático de compras

## Sabotagens Herdadas

- **"Preciso de mais X antes de testar"** — o detector não precisa ser perfeito na v1. Pode errar para mais (falso positivo é melhor que falso negativo para não perder venda). Comece com heurísticas simples e valide.

- **Overengineering** — não criar um sistema de plugins/configuração. Três triggers bem escolhidos > arquitetura genérica.

- **Fazer tudo sozinho** — o detector é uma peça. O provider já tem o ponto de integração (`getAtendimentoViewModel`). Só precisa ser chamado.

## Memória Herdada

- `classificarIntencao()` (provider.ts:414) já detecta `compra_nova` com triggers: 'quero', 'queria', 'gostaria', 'vou querer', 'vou pedir', 'pedir', 'quisesse', 'me vê', 'me ve', 'me da', 'me dá', 'manda', 'envia'
- Quando `classificacao.tipo === 'compra_nova' && clientKey` e não há pedidos ativos, já cria um OrderDB lead automaticamente (provider.ts:690-699)
- PurchaseDB já suporta `source: 'AI_DETECTED'` — o detector pode usar esse campo
- CustomerProfileDB tem campo `ultimaCompra` para armazenar o resumo da última compra

## Critério de Pronto

- [ ] `detectar-nova-compra.ts` existe em `src/modules/pedidos/` com função exportada
- [ ] Função recebe parâmetros mínimos (chatId, mensagens recentes, perfil do cliente) e retorna decisão
- [ ] Quando detecta compra, chama OrderDB.createOrder (se não houver lead ativo)
- [ ] Quando detecta compra, chama PurchaseDB.addPurchase com source='AI_DETECTED'
- [ ] Integração no provider.ts aciona o detector no fluxo do view-model
- [ ] Gate-runner passa (lint → typecheck → build → test:unit)
- [ ] Testes unitários para: detecção com trigger positivo, sem trigger, duplicidade (já detectado)
- [ ] Especificar em ZenSpec (ou atualizar spec.md de pedidos)
