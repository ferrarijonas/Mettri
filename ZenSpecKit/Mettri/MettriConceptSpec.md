# Mettri Concept Spec

O que o sistema é, pra quem, e onde começa e termina. Concept Spec diz **o porquê**; Eng Spec diz **a estrutura**; Stack Spec diz **com o quê**; ZenSpec diz **o comportamento**; código diz **como**.

---

## Intenção

Este sistema existe para que **pequenos negócios que vendem pelo WhatsApp** consigam **organizar e continuar conversas de venda com responsabilidade** sem precisar de **planilhas, memória humana ou CRMs gigantes e complicados**.

Metáfora: é como ter um **gerente de vendas que mora dentro do seu WhatsApp Web**, que nunca esquece nenhuma conversa importante.

---

## O que é

Mettri é uma **plataforma de vendas conversacionais** que roda como **extensão de navegador colada ao WhatsApp Web**, criando uma terceira coluna com contexto, histórico e ferramentas de venda.  
Ele captura e organiza mensagens, conecta isso a clientes e campanhas e usa IA para sugerir próximos passos, **sempre com aprovação humana**.

Metáfora: é uma **caixa de ferramentas inteligente** acoplada ao WhatsApp – cada módulo é uma ferramenta diferente, mas todas usam o mesmo “banco de memórias” das conversas.

---

## Para quem é (e não é)

- **Para quem é**: negócios locais e times pequenos que **já vendem pelo WhatsApp** (restaurantes, serviços, comércios) e querem vender melhor **sem virar uma operação robótica**.  
- **Para quem não é**: grandes operações de call center, empresas que precisam de CRM corporativo completo, ou quem busca um **bot 100% automático** que fala sozinho com todo mundo.

Metáfora: serve para **lojas de bairro organizadas**, não para **telemarketing gigante**.

---

## Problema

Hoje, quem vende pelo WhatsApp sofre com:

- conversas importantes que somem no meio do histórico;
- falta de visão de **quem está sumido**, quem respondeu, quem precisa de retorno;
- nenhuma ligação clara entre conversa, cliente e vendas;
- tentativas de automatizar tudo com bots que parecem spam, afastam clientes e quebram confiança.

Metáfora: é como tentar gerenciar um **mercado inteiro com post-its colados na parede do quarto** – funciona por um tempo, depois vira bagunça.

---

## Diferencial

| Aspecto                     | Mettri                                                                 | Alternativas comuns                                              |
| --------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Canal principal             | Focado em **WhatsApp Web via extensão**                               | CRMs genéricos fora do WhatsApp                                 |
| Tamanho do time alvo        | **Negócios locais / times pequenos**                                  | Times grandes, operações corporativas                           |
| Uso de IA                   | **Assistiva, sempre com humano** na decisão                          | Bots autônomos que falam sozinhos                                |
| Base de contexto            | **Histórico completo e durável local** (IndexedDB)                    | Histórico parcial, disperso ou só em nuvem                       |
| Arquitetura de produto      | **Módulos por domínio** (atendimento, clientes, marketing, `rag` etc) | Funcionalidades misturadas em um único “bolo”                    |

Metáfora: em vez de te mandar para um **prédio novo** (um CRM separado), o Mettri **constrói um andar extra em cima do seu WhatsApp**.

---

## Promessas

### Escopo inicial (v2.x)

- **Nenhuma conversa importante se perde**: tudo capturado, indexado e ligado a clientes.  
- **Você sabe com quem falar hoje**: listas de inativos, retomadas e prioridades.  
- **Sugestões de mensagem com contexto real**, não respostas genéricas de chatbot.  
- **Controle fica na mão do atendente**: IA nunca envia nada sozinha.  
- **Funciona no navegador comum**, sem exigir infraestrutura pesada do usuário.

### Escopo futuro (planejado)

- Camada de **produtos, pedidos, entrega e financeiro básico** conectados às conversas.  
- **Persona configurável** para o tom de voz da marca.  
- **Bot de suporte** sobre base de conhecimento viva (documentação viva).  
- **Monetização e escala**: multi-atendente, rollout gradual, planos e integrações externas.

Metáfora: começa como um **gerente de vendas muito organizado**, evolui para um **mini-ERP de vendas pelo WhatsApp**, sem perder o lado humano.

---

## Princípios

- **Human‑in‑the‑loop sempre.** IA só sugere, o humano decide.  
  Metáfora: IA é **assistente de cozinha**, não o **chef**.

- **Histórico é sagrado.** Nada que aconteceu com o cliente é descartado.  
  Metáfora: o sistema é um **diário de bordo do navio**, não um caderno que se rasga.

- **WhatsApp primeiro.** As decisões priorizam robustez dentro do WhatsApp Web.  
  Metáfora: é um **exoesqueleto para o WhatsApp**, não um corpo separado.

- **Simplicidade para o usuário final.** Conceitos de negócio claros, sem jargão técnico.  
  Metáfora: interface de **micro-ondas**, não de **painel de avião**.

- **Documentação viva.** Toda capacidade importante deve ter spec clara antes do código.  
  Metáfora: construir com **planta aprovada**, não “puxadinho” improvisado.

- **Arquitetura modular por domínios.** Cada parte de negócio vive em seu próprio módulo (`atendimento`, `clientes`, `marketing`, `rag` etc.), com baixo acoplamento.  
  Metáfora: um **prédio com andares independentes**, não um galpão único.

---

## Fronteiras

O Mettri **não é**:

- um CRM corporativo completo com tudo (financeiro profundo, estoque avançado, ERP full);  
- uma plataforma de disparo em massa / spam;  
- um bot autônomo que fala sozinho com todos os clientes;  
- uma solução de múltiplos canais (é focado em **WhatsApp Web**).

O Mettri **não cobre** (neste conceito base):

- processamento de pagamentos complexo (múltiplos gateways, conciliação bancária completa);  
- logística avançada (roteirização de frota, tracking em tempo real);  
- dashboards de BI pesados reunindo diversas fontes externas.

Metáfora: é um **cérebro de vendas para o WhatsApp**, não o **corpo inteiro da empresa**.

---

## Decisões

- **Foco em WhatsApp Web via extensão** → porque é onde já estão os clientes e atendentes.  
- **Negócios locais e times pequenos como alvo** → porque precisam de poder sem a complexidade de CRMs gigantes.  
- **Histórico local e consistente como base** → porque confiança e contexto dependem de lembrar tudo.  
- **IA assistiva, não autônoma** → porque a relação com o cliente é humana e não pode ser terceirizada totalmente.  
- **Arquitetura modular por domínios** → porque cada parte do negócio (atendimento, clientes, marketing, `rag`) evolui em ritmos diferentes sem quebrar o resto.  
- **Documentação como contrato** → porque specs (`project_concept.md`, `project_context.md`, `specs/*`) devem guiar o código, não correr atrás dele.

---

## Seções opcionais

### Mapa de contexto

`Cliente final` → **WhatsApp Web** → `Mettri (extensão)` → `Atendente / Time de vendas`

Metáfora: o cliente fala com o **loja** (WhatsApp), e o Mettri é o **gerente que sussurra no ouvido do atendente**.

### Origem

Mettri nasce da dor prática de negócios locais que já vendem pelo WhatsApp, mas perdem vendas por falta de continuidade, memória e contexto. A ideia é juntar **organização de CRM**, **fluxos de marketing** e **IA responsável**, sem puxar o usuário para fora do WhatsApp.

### Nome

“Mettri” sugere **métrica, método e meticulosidade** na conversa: acompanhar não só o que foi dito, mas **quando, para quem e com qual efeito**, sempre com foco em conversas humanas que geram vendas responsáveis.

