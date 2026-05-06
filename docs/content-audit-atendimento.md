# Content Audit — Painel de Atendimento

> Aplicação do framework `mettri-content-ux` (job analysis, label clarity, grouping, noise, flow).
> Auditado em: 2026-05-02

---

## Seção 1: Cabeçalho do Cliente

### Elementos

| Elemento | Código | Job | Problema |
|----------|--------|-----|----------|
| Nome do cliente | `vm.customer.nome` | Identificar com quem estou falando | ✅ Job claro. Label implícito. |
| "Recorrente" / "Contato" | Chip de tipo | Saber o tipo de relação com o cliente | **Label "Contato" é vago** — "Contato" vs "Recorrente" não deixa claro a diferença. "Contato" parece "não é cliente". O que significa exatamente? |
| "Sem cadastro" | Badge | Saber que cliente não tem ficha preenchida | **Job correto, mas apresentação errada** — está como texto cinza fraco, mas é informação relevante pra decisão (se não tem cadastro, preciso criar). Deveria ser badge visível. |
| Relacionamento (dias/meses) | Texto | Saber há quanto tempo é cliente | ✅ Útil pra contexto |
| Chat ID | Hash técnico | Debug / suporte técnico | **Ruído pro usuário normal** — deveria estar colapsado ou em tooltip |

### Job Analysis

| Elemento | Job | Job do usuário | Próxima ação |
|----------|-----|----------------|-------------|
| Nome | "Saber quem é" | Decidir como abordar | (nenhuma — contexto) |
| Tipo | "Entender relação" | Decidir tom da conversa | (nenhuma — contexto) |
| "Sem cadastro" | "Saber que falta info" | Criar cadastro | **CTA faltando**: deveria ter "Criar cadastro" |
| Chat ID | "Identificar tecnicamente" | (quase nunca) | Colapsar |

### Prioridade de Conteúdo (P/S/T)

| Elemento | P/S/T | Motivo |
|----------|-------|--------|
| Nome do cliente | **P** | É o que identifica a conversa |
| "Sem cadastro" + CTA | **P** | Ação necessária |
| Tipo (Recorrente/Contato) | **S** | Contexto auxiliar |
| Relacionamento há quanto tempo | **S** | Contexto auxiliar |
| Chat ID | **T** | Colapsar |

### Problemas de Label

| Label Atual | Problema | Sugestão |
|-------------|----------|----------|
| "Contato" | Ambíguo — parece "não é cliente" | "Novo" ou "Primeira compra" |
| "Sem cadastro" | Correto mas sem ação | Manter texto, adicionar botão "Criar cadastro" |
| ID do chat | Jargão técnico | Colapsar em "Detalhes técnicos" |

### Problemas de Grouping

- "Sem cadastro" está no mesmo nível visual que metadata, mas é P (ação necessária)
- Chat ID está visível sem necessidade — é T exposto como S

---

## Seção 2: Funil / Progresso "PEDIDO • ——— 20%"

### Elementos

| Elemento | Código | Job |
|----------|--------|-----|
| Label "Pedido" | Cabeçalho da seção | Dizer que aqui é o resumo do pedido |
| Progresso 20% | Barra + percentual | Mostrar quanto do fluxo foi completado |
| Bolinha verde + traço | Dot indicator | Mostrar que pedido tem dados |
| Etapas (Intenção → Confirmação) | Pipeline de estágios | Mostrar etapas do funil de venda |

### Job Analysis

**"PEDIDO • ——— 20%"** — os 20% significam o quê?

| Interpretação possível | Resposta |
|------------------------|----------|
| % do pedido preenchido? | Talvez |
| % do funil completo? | Talvez |
| % de chance de fechar? | Talvez |
| O usuário SABE o que significa? | **Não** — não tem label explicando |

**Problema central**: a barra de progresso não tem **contexto semântico**. O usuário vê 20% e não sabe se é bom ou ruim, se falta muito ou pouco, do que é progresso.

### Prioridade de Conteúdo (P/S/T)

| Elemento | P/S/T | Motivo |
|----------|-------|--------|
| Etapas do funil (com labels) | **P** | Mostrar o que precisa ser feito |
| Progresso % | **S** | Visão geral de quanto falta |
| Label "Pedido" | **S** | Contexto de seção |

**O % sem contexto é ruído**. O que realmente importa são as etapas: o que já foi feito e o que falta.

### Problemas de Label

| Label Atual | Problema | Sugestão |
|-------------|----------|----------|
| "PEDIDO • ——— 20%" | "20%" sem significado | "2 de 7 etapas" ou remover % e mostrar só etapas |
| "Intenção" | Muito genérico | "Tipo da venda" ou "Intenção da conversa" |
| "Upsell" | Jargão de vendas | "Oferecer mais" |
| "Fecho" | Jargão | "Confirmar" |

---

## Seção 3: Resumo do Pedido (Itens, Total, Status)

### Elementos

| Elemento | Código | Job |
|----------|--------|-----|
| Lista de itens | `p.itens` | Mostrar o que foi pedido |
| Endereço | `enderecoValor` | Mostrar onde entregar |
| Pagamento | `pagamentoValor` | Mostrar forma de pagamento |
| Prazo | `prazoValor` | Mostrar prazo |
| Total | `totalCentavos` | Mostrar valor total |
| Status "Aberto" / "Fechado" | `p.status` | Mostrar estado do pedido |
| Botão "Registrar" | `order:register-mock` | Criar/confirmar o pedido |

### Job Analysis

| Elemento | Job do usuário | Problema |
|----------|----------------|----------|
| Itens | "O que foi pedido?" | ✅ |
| Endereço | "Onde entregar?" | ✅ |
| Total | "Quanto custa?" | ✅ |
| "Registrar" | "Quero criar esse pedido" | ✅ mas... |
| "Aberto" + "Total" + "Registrar" na mesma linha | Confuso | **Três jobs diferentes no mesmo espaço**: ver status + ver valor + agir. Cada um exige decisão diferente. |

**Problema de grouping grave**: "Total" (P — informação) + "Aberto" (S — status) + "Registrar" (P — ação) estão na mesma linha. O usuário precisa processar três coisas diferentes ao mesmo tempo.

### Prioridade de Conteúdo (P/S/T)

| Elemento | P/S/T | Motivo |
|----------|-------|--------|
| Total | **P** | Dado financeiro, decisão |
| Registrar | **P** | Ação principal |
| Itens | **P** | O que está sendo comprado |
| Status (Aberto/Fechado) | **S** | Contexto |
| Endereço, Pagamento, Prazo | **S** | Detalhes |
| Badge "novo" | **Ruído** | Se o dado acabou de chegar, o destaque é o dado, não o badge |

### Problemas de Grouping

- "Total" + "Aberto" + "Registrar" na mesma linha → **separar**: Total em destaque, status abaixo, botão abaixo ou no final do card
- Badge "novo" aparece em 4 lugares (itens, endereço, pagamento, prazo) → **ruído visual**. O destaque deveria ser o VALOR que mudou, não um badge genérico

### Problemas de Label

| Label Atual | Problema | Sugestão |
|-------------|----------|----------|
| "Registrar" | Ambíguo — registrar o quê? | "Criar pedido" ou "Confirmar pedido" |
| "Aberto" | Correto mas sem cor de contexto | ✅ label OK |
| Badge "novo" | Genérico — novo o quê? | Remover badge, destacar o próprio valor |

---

## Seção 4: Pendências de Confirmação

(Já corrigido visualmente, mas vamos auditar o conteúdo)

### Elementos

| Elemento | Job |
|----------|-----|
| "Ajustes pendentes" | Dizer que existem correções a revisar |
| Valor atual → valor proposto | Mostrar o antes e o depois |
| Botão "Confirmar" | Aceitar a correção |
| Evidência | Mostrar por que a correção foi sugerida |

### Job Analysis

| Elemento | Job do usuário |
|----------|----------------|
| Produto + valores | "O que mudou nesse item?" |
| Evidência | "Por que mudou?" |
| Confirmar | "Quero aceitar essa mudança" |

✅ Jobs claros. O fix que fizemos melhorou, mas ainda pode ter:
- Evidência: útil pra confiança, mas pode ser colapsada (S → pode expandir pra ver)

### Prioridade de Conteúdo (P/S/T)

| Elemento | P/S/T |
|----------|-------|
| Produto + valor proposto | **P** |
| Botão Confirmar | **P** |
| Valor atual | **S** |
| Evidência | **T** (colapsável) |

---

## Seção 5: Vitrine — "Oferecer também"

### Elementos

| Elemento | Código | Job |
|----------|--------|-----|
| Label "Oferecer também" | Cabeçalho | Sugerir produtos adicionais |
| Lista de produtos | `vm.vitrine` | Mostrar opções |
| Score (8.4) | `item.score` | Relevância do produto |
| Botão "+ add" | Ação | Adicionar ao pedido |
| Preço | `precoCentavos` | Quanto custa |

### Job Analysis

| Elemento | Job do usuário | Problema |
|----------|----------------|----------|
| Produto + preço | "O que posso oferecer?" | ✅ |
| Score "8.4" | "Qual a relevância?" | **Ruído**: score de 0-10 sem contexto. 8.4 é bom comparado a quê? O usuário não toma decisão baseado nisso — escolhe pelo nome + preço. |
| "+ add" | "Adicionar ao pedido" | ✅ label OK |

### Prioridade de Conteúdo (P/S/T)

| Elemento | P/S/T | Motivo |
|----------|-------|--------|
| Produto + preço | **P** | O que o usuário considera |
| Botão "+ add" | **P** | Ação |
| Score | **Ruído** | Ninguém decide compra baseado em score sem contexto |

### Problemas de Label

| Label Atual | Problema | Sugestão |
|-------------|----------|----------|
| "Oferecer também" | Um pouco longo pro card pequeno | "Sugerir" ou "Sugestões" (mais direto) |
| Score numérico (8.4) | Sem contexto | Remover ou substituir por badge texto ("Alta compatibilidade") |

### Problemas de Grouping

- ✅ Produto + preço + ação juntos = grouping por tarefa. Correto.

---

## Seção 6: Próxima Ação

### Elementos

| Elemento | Código | Job |
|----------|--------|-----|
| Label "Próxima ação" | Cabeçalho | Mostrar sugestão do que fazer |
| Texto da ação | `acao.label` | O que fazer |
| Textarea | Sugestão de texto | Texto pra enviar ao cliente |
| Botão "Gerar" | Gerar novo texto | (refazer sugestão) |
| Botão "Enviar" | Enviar pro WhatsApp | Agir |

### Job Analysis

| Elemento | Job do usuário |
|----------|----------------|
| Label "Próxima ação" | "O que devo fazer agora?" |
| Ação label | "Qual o próximo passo?" |
| Textarea | "Que mensagem vou enviar?" |
| Gerar | "Quero outra sugestão" |
| Enviar | "Enviar essa mensagem" |

✅ Jobs todos claros. A seção mais bem resolvida em termos de conteúdo.

### Prioridade de Conteúdo (P/S/T)

| Elemento | P/S/T |
|----------|-------|
| Ação label | **P** (o que fazer) |
| Botão Enviar | **P** (a ação) |
| Textarea | **P** (o conteúdo) |
| Botão Gerar | **S** (alternativa) |

### Problemas de Label

| Label Atual | Sugestão |
|-------------|----------|
| "Próxima ação" | ✅ claro |
| "Gerar" | ✅ direto |
| "Enviar" | ✅ direto |

---

## Seção 7: Campos do Ouvinte (Preferências, Endereço, etc.)

### Elementos

| Elemento | Job |
|----------|-----|
| Lista de campos (Preferências, Aversões, Endereço, etc.) | Mostrar dados conhecidos do cliente |
| Badge de confiança (alta/média/baixa) | Mostrar quanto confiar no dado |
| Badge "novo" | Mostrar que dado foi atualizado |
| Badge "confirmar" / "pendente" | Mostrar que precisa revisão |

### Job Analysis

| Elemento | Job do usuário | Problema |
|----------|----------------|----------|
| Campo + valor | "O que sei sobre o cliente?" | ✅ |
| Badge confiança | "Posso confiar nesse dado?" | ✅ job útil |
| Badge "novo" | "O que mudou?" | **Ruído**: o badge aparece e some em 4s com animação. Se o job é mostrar o que mudou, o badge deveria ficar ou o valor destacado permanentemente. |
| Badge "confirmar" | "Preciso revisar isso" | ✅ mas label "confirmar" ambíguo (confirmar o quê?) |

### Prioridade de Conteúdo (P/S/T)

| Elemento | P/S/T |
|----------|-------|
| Campos com valor | **P** ou **S** (depende do campo) |
| Badge confiança | **S** |
| Badge "confirmar" | **S** (indica ação pendente) |
| Badge "novo" | **Ruído** |
| Badge "pendente" | **S** |

### Problemas de Label

| Label Atual | Problema | Sugestão |
|-------------|----------|----------|
| "Preferências" | ✅ claro | — |
| "Aversões" | 😬 "Aversões" é uma palavra forte e pouco usada | "Evitar" ou "Não gosta" |
| "Urgência" | ✅ | — |
| Badge "novo" | O que é novo? O valor? O campo? | Usar destaque no VALOR, não badge separado |
| Badge "confirmar" | Confirmar o quê? | "Revisar" + mostrar o campo específico |

### Problemas de Grouping

- "Endereço" e "Forma pgto" estão no mesmo bloco que "Preferências" e "Aversões" — são tipos diferentes de dado (logística vs gosto pessoal). Separar em "Dados do cliente" e "Preferências" seria mais lógico.

---

## Seção 8: Histórico / Pedidos Anteriores

### Elementos

| Elemento | Job |
|----------|-----|
| Lista de pedidos | Mostrar histórico de compras |
| Valor do pedido | Quanto foi |
| Status | Se foi concluído ou cancelado |
| Data | Quando foi |

### Job Analysis

| Elemento | Job do usuário | Problema |
|----------|----------------|----------|
| Pedidos anteriores | "O que esse cliente já comprou?" | ✅ |
| Valor | Quanto gastou | ✅ |
| Status | "O pedido foi concluído?" | ✅ |
| Striketrough em cancelados | "Está cancelado" | **Problema**: strikethrough em "2kg Abóbora" confunde com edição. Usar badge "Cancelado" + opacidade |

### Prioridade de Conteúdo (P/S/T)

| Elemento | P/S/T |
|----------|-------|
| Total + Ticket médio | **P** |
| Pedidos recentes | **P** |
| Status | **S** |
| Data | **S** |
| Frequência (1x/mês) | **S** |

---

## Resumo: Problemas de Conteúdo Encontrados

### Labels que não passam no teste de clareza

| Label | Problema | Correção |
|-------|----------|----------|
| "Contato" | Ambíguo | "Novo" ou "Primeira compra" |
| "Aversões" | Palavra forte | "Evitar" ou "Não gosta" |
| "Upsell" | Jargão | "Oferecer mais" |
| "Fecho" | Jargão | "Confirmar" |
| "Intenção" | Genérico demais | "Tipo" |
| "Registrar" | Ambíguo | "Criar pedido" |
| "Oferecer também" | Longo pro espaço | "Sugerir" |

### Problemas de Grouping

| Onde | Problema | Solução |
|------|----------|---------|
| Total + Aberto + Registrar na mesma linha | 3 jobs diferentes | Separar em linhas: Total em destaque, status abaixo, botão no fim |
| Badge "novo" espalhado | Ruído visual | Remover badge, destacar o valor que mudou |
| Score 8.4 sem contexto | Número sem significado | Remover ou substituir por badge texto |
| "Endereço" junto de "Preferências" | Grouping por tipo de dado, não por tarefa | Separar "Dados" de "Preferências" |

### Ruído Identificado

| Elemento | Tipo de Ruído | Ação |
|----------|--------------|------|
| Score 8.4 | Número sem contexto | Remover |
| Badge "novo" com fade | Decoração informacional | Remover badge, destacar valor |
| Chat ID visível | Metadata sem uso | Colapsar |
| Progresso "20%" sem label | Número sem significado | Substituir por "2/7 etapas" |
| "PEDIDO • ———" | Símbolos sem significado | Remover, manter só label "Pedido" |

### Fluxo Quebrado

| Onde | Problema | Fluxo correto |
|------|----------|---------------|
| "Sem cadastro" sem ação | Informa o problema mas não oferece solução | "Sem cadastro → [Criar cadastro]" |
| Pendência sem CTA claro | (já corrigido) | ✅ agora tem botão Confirmar |
| Score sem ação | Mostra número que não leva a decisão | Remover ou transformar em ação |
