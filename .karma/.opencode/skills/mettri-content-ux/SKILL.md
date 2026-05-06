---
name: mettri-content-ux
description: Content-first UX audit — job analysis, label clarity, grouping logic, noise detection, flow audit. Always before visual design.
---

# Mettri Content UX — Conteúdo Primeiro

Antes de qualquer cor, fonte, ou componente visual, esta skill analisa o **conteúdo, propósito e fluxo** de cada elemento.

O pipeline é: **Conteúdo → Hierarquia → Visual**. Esta skill é o primeiro passo.

## Princípio Central

Conteúdo não é decoração. Cada texto, label, seção e ação existe para que o usuário faça algo. Se o propósito não está claro, não adianta deixar bonito.

## 1. Framework de Job Analysis

Para CADA elemento da tela, responda:

```
┌─────────────────────────────────────────────────────┐
│ JOB ANALYSIS                                        │
│                                                     │
│ Elemento: "Compra nova"                             │
│                                                     │
│ 1. O que o USUÁRIO faz com isso?                    │
│    → (ex: identifica o tipo de conversa)            │
│                                                     │
│ 2. O que o USUÁRIO deveria ENTENDER?                │
│    → (ex: "essa venda é nova, não reposição")       │
│                                                     │
│ 3. Qual a PRÓXIMA AÇÃO depois de ver isso?          │
│    → (ex: decidir se usa o fluxo de compra nova)    │
│                                                     │
│ 4. Se esse elemento SUMIR, o que se perde?          │
│    → (ex: perde o contexto do tipo de venda)        │
│                                                     │
│ 5. Esse elemento AJUDA ou ATRAPALHA o job?          │
│    → (ex: o label "Compra nova" é claro o bastante?)│
└─────────────────────────────────────────────────────┘
```

### Regras de Job Analysis

- **Job ≠ Feature**: "mostrar o progresso" não é um job — "entender quanto falta pra fechar" é
- **Job é do usuário, não do sistema**: o sistema "exibe dados", mas o usuário "decide a próxima ação"
- **Um elemento, um job**: se um botão faz duas coisas, está errado
- **Elemento sem job identificável**: candidato a remoção

## 2. Checklist de Clareza de Label

Todo texto visível na interface deve passar por este checklist:

```
□ É linguagem do USUÁRIO, não do sistema?
   Ex: "Intenção: compra_nova" → ❌ (jargão técnico)
       "Tipo: Nova compra"    → ✅

□ O label descreve o CONTEÚDO ou o CONTÊINER?
   Ex: "Pedido" como seção → OK se tem dados do pedido
       "Informações" como seção → ❌ (muito genérico)

□ Dá pra confundir com outro label?
   Ex: "Registrar" vs "Cadastrar" na mesma tela → ❌

□ O tamanho é adequado pro espaço?
   Ex: "Oferecer também" em card pequeno → cortar para "Sugestões"

□ Tem jargão ou termo interno?
   Ex: "Upsell", "Logística", "Fecho" → ❌ se usuário não entende
```

### Anti-padrões de Label

| Anti-padrão | Exemplo | Substituir por |
|-------------|---------|---------------|
| Nome técnico | `compra_nova`, `suporte_pos_venda` | "Nova compra", "Suporte" |
| Genérico | "Informações", "Dados" | "Endereço", "Pagamento" |
| Ação vs Estado | "Registrar" para status | "Criar pedido" para ação, "Registrado" para estado |
| Duplicado | "Salvar" e "Gravar" na mesma tela | Unificar pra "Salvar" |
| Muito longo | "Preferências de produto do cliente" | "Preferências" |

## 3. Regras de Grouping Lógico

Informação agrupada errado é informação perdida.

### Como agrupar

1. **Por tarefa**: tudo que o usuário precisa pra fazer UMA coisa fica junto
2. **Por frequência**: o que é usado mais vezes fica mais acessível
3. **Por relacionamento**: dados que se explicam mutuamente ficam perto

### Anti-padrões de Grouping

```
□ Dado financeiro misturado com ação (ex: "Total" + "Registrar")
   → Separar: dado em cima, ação abaixo

□ Status misturado com metadado (ex: "Aberto" + "ID #1234")
   → Agrupar status com dados de contexto, ID com metadados

□ Label de seção confuso (ex: "PEDIDO • ——— 20%")
   → O que os 20% significam? Progresso do quê?

□ Funil visual sem label claro (ex: bolinha verde + traço laranja)
   → Cada etapa precisa de label, não só cor

□ Ação primária sem destaque (ex: "Confirmar" do mesmo tamanho que "Cancelar")
   → Ação primária tem label mais forte, posição mais óbvia
```

### Teste do Grouping

Pegue cada grupo. Leia em voz alta: "Esse grupo é sobre ____". Se você hesitar, o agrupamento está errado.

## 4. Noise vs Signal

Ruído é informação que está na tela mas não ajuda o usuário a fazer o job.

### Fontes Comuns de Ruído

| Tipo | Exemplo | Solução |
|------|---------|---------|
| Dado redundante | Mesmo valor em 2 lugares | Remover duplicata |
| Label óbvio | "Nome:" antes de input de nome | Remover label se contexto basta |
| Metadata sem uso | IDs, timestamps que ninguém consulta | Colapsar, mover pra tooltip |
| Números sem contexto | Score "8.4" sem escala | Adicionar referência ou remover |
| Decoração informacional | Status "Aberto" + ícone + cor + badge | Usar UMA representação |

### Sinal vs Ruído Checklist

```
□ Essa informação muda alguma decisão do usuário?
   Se não → é ruído

□ Essa informação está no nível de detalhe certo?
   Se tem mais dado que o necessário → é ruído

□ Essa informação compete com a principal?
   Se sim → ou reduz destaque ou remove

□ O usuário já sabe isso?
   Se sim → não precisa repetir
```

## 5. Flow Audit

Antes de desenhar, mapeie o fluxo:

```
ESTADO ATUAL (o que o usuário vê)
       ↓
PERGUNTA (o que o usuário quer saber)
       ↓
OPÇÃO (o que o usuário pode fazer)
       ↓
AÇÃO (o que o usuário faz)
       ↓
PRÓXIMO ESTADO (o que o usuário vê depois)

Cada interrupção neste fluxo é um problema de conteúdo.
```

### Regras de Fluxo

- **Uma ação principal por estado**: se o usuário pode fazer 3 coisas ao mesmo tempo, precisa de guia
- **CTA óbvia**: o próximo passo deve ser a coisa mais fácil de encontrar na tela
- **Feedback claro**: depois da ação, o estado muda visivelmente
- **Dead end detection**: se o usuário faz algo e não tem próximo estado, adicionar

## 6. Hierarquia de Conteúdo (antes da visual)

Classifique cada elemento em P/S/T por **conteúdo**, não por visual:

### Primário (P) — Conteúdo
O que responde: "O que eu preciso SABER ou FAZER agora?"

- A ação que o usuário veio realizar
- O dado crítico pro momento
- O estado que muda a decisão

### Secundário (S) — Conteúdo
O que responde: "Que contexto me ajuda a entender o primário?"

- Dados de suporte
- Labels de agrupamento
- Informação complementar

### Terciário (T) — Conteúdo
O que responde: "Detalhe técnico que raramente preciso."

- IDs, timestamps
- Metadados de auditoria
- Diagnóstico / debug

**IMPORTANTE**: A hierarquia visual (P/S/T do `mettri-ux-hierarchy`) deve ser DERIVADA desta classificação de conteúdo, não independente.

## 7. Regras de Ouro do Conteúdo

1. **Conteúdo primeiro, visual depois** — nunca o contrário
2. **Cada elemento responde "qual seu job?"** — sem resposta = sem elemento
3. **Labels em português do usuário** — sem jargão técnico, sem inglês desnecessário
4. **Uma ação principal por seção** — o usuário nunca deve hesitar entre 2 CTAs igualmente fortes
5. **Agrupar por tarefa, não por tipo de dado** — dados financeiros perto da ação de pagar, não num bloco de "financeiro"
6. **Progresso precisa de significado** — "20%" sem contexto é ruído. "20% do pedido preenchido" é sinal
7. **Se o usuário precisa pensar pra entender, o conteúdo falhou**
8. **Números sem unidade ou referência são ruído** — "8.4" vira ruído se não tem "de 10"

## 8. Regra: ASCII Design Primeiro

**Antes de qualquer código, o design final deve ser representado em ASCII.**

O ASCII design é a ponte entre a decisão de conteúdo e a implementação. Ele força clareza:
- Se não dá pra desenhar em ASCII, o layout não está resolvido
- Se o ASCII ficou confuso, o conteúdo precisa ser revisto
- Se o ASCII está claro, a implementação é direta

### Formato do ASCII Design

```
┌──────────────────────────────────────────┐
│ Cabeçalho da seção                       │
├──────────────────────────────────────────┤
│ [P] Elemento primário                    │
│ [S] Elemento secundário  [AÇÃO]          │
│ [T] elemento terciário                   │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│ Próxima seção...                         │
└──────────────────────────────────────────┘
```

Marcar cada elemento com:
- `[P]` = primário (conteúdo)
- `[S]` = secundário
- `[T]` = terciário (colapsado)
- `[AÇÃO]` = o que o usuário pode fazer
- `>` = fluxo direcional

### Regras do ASCII Design

1. Cada seção deve caber em ~60 colunas de largura
2. O ASCII deve ser legível sem cores — hierarquia só por posição e caracteres
3. Se uma seção não pode ser desenhada em ASCII, ela é muito complexa → simplificar
4. O ASCII final substitue o mock inicial — se aprovado, vamos direto pra implementação com tokens

### Exemplo de Uso

```
ANTES (atual):
┌─────────────────────────────────────┐
│ Pedido • —— 20%                     │
│ Total R$ 214,00  Aberto  Registrar │
└─────────────────────────────────────┘

DEPOIS (proposto):
┌─────────────────────────────────────┐
│ Pedido                              │
│ [P] Total: R$ 214,00                │
│ [S] Status: Aberto                  │
│ [P] [Criar pedido] →               │
└─────────────────────────────────────┘
```

## 9. Pipeline

```
┌──────────────────────────────────────────────────────────┐
│ PIPE COMPLETO (use esta ordem)                           │
│                                                          │
│ 1. mettri-content-ux (CONTEÚDO)                          │
│    ├── job analysis de cada elemento                     │
│    ├── label clarity check                               │
│    ├── grouping audit                                    │
│    ├── noise vs signal                                   │
│    ├── flow audit                                        │
│    └── hierarquia de conteúdo P/S/T                      │
│          ↓                                               │
│ 2. ASCII DESIGN (APROVAÇÃO)                              │
│    ├── desenhar cada seção em ASCII                      │
│    ├── marcar P/S/T/Ação                                 │
│    └── aprovar antes de prosseguir                       │
│          ↓                                               │
│ 3. mettri-ux-hierarchy (HIERARQUIA VISUAL)               │
│    ├── P/S/T visual DERIVADO do conteúdo                 │
│    └── layout, espaçamento, densidade                    │
│          ↓                                               │
│ 4. mettri-design-system (VISUAL)                         │
│    ├── cores, tipografia, componentes                    │
│    └── aplicar tokens                                    │
│          ↓                                               │
│ 5. DESIGN.md (DOCUMENTAÇÃO)                              │
│    └── decisões de conteúdo + visual                     │
└──────────────────────────────────────────────────────────┘
```
