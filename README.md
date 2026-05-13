<div align="center">

# Mettri

### *Plataforma de vendas conversacionais para WhatsApp Web*

[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.0.1-blue)](package.json)

> Construído por IA · Guiado por ZenSpecs · Orquestrado pelo **Karma**

</div>

---

## Sumário

- [O que é o Mettri?](#o-que-é-o-mettri)
- [Como este software é construído](#como-este-software-é-construído)
- [Para quem é](#para-quem-é)
- [O que já existe hoje](#o-que-já-existe-hoje)
- [Como funciona por dentro](#como-funciona-por-dentro)
- [Como começar (instalação)](#como-começar-instalação)
- [Desenvolvimento & testes](#desenvolvimento--testes)
- [Documentação](#documentação)
- [Filosofia do projeto](#filosofia-do-projeto)
- [Roadmap](#roadmap)
- [Licença](#licença)

---

## O que é o Mettri?

Pensa no Mettri como um **gerente de vendas que mora dentro do seu WhatsApp Web**.

- **Problema**: conversas importantes com clientes se perdem, ninguém lembra quem respondeu o quê, quem sumiu, quem deveria ser reativado.
- **Proposta**: o Mettri transforma o WhatsApp em um sistema de **continuidade, contexto e vendas responsáveis**, sem automação agressiva nem spam.

Ele:

- organiza conversas por cliente,
- guarda o **histórico completo** em banco local (nunca apaga),
- sugere ações com IA (mas **sempre com aprovação humana**),
- ajuda a decidir **quando**, **com quem** e **por que** falar.

---

## Como este software é construído

O Mettri não é escrito linha por linha por um desenvolvedor. Todo o código-fonte (`src/`) é gerado por **agentes de IA orquestrados pelo Karma** — um sistema que vive em `.karma/` e segue um pipeline rigoroso:

1. **Especificação** — cada funcionalidade nasce como um **ZenSpec** (contrato formal determinístico) em `ZenSpecKit/`.
2. **Tarefa** — o Karma cria uma SPEC.md com escopo, sabotagens conhecidas e critério de pronto.
3. **Implementação** — o agente `@implementador` lê o briefing, codifica, e valida com lint → type-check → build → testes.
4. **Verificação** — o agente `@avaliador` revisa o diff contra a spec e o catálogo de sabotagens do domínio.
5. **Consolidação** — o agente `@sonhador` extrai aprendizados e alimenta a memória do sistema.

**Resultado**: código TypeScript estrito, validado por testes, com rastreabilidade completa da spec ao deploy. Nenhum `any` escapa. Nenhuma mudança acontece sem contrato.

> Este modelo de desenvolvimento é o produto tanto quanto a extensão em si. O Karma aprende a cada tarefa, e o Mettri evolui sem depender de um time de engenharia.

---

## Para quem é

Mettri é pensado para:

- **Negócios locais** que já vendem pelo WhatsApp (padarias, restaurantes, serviços, comércios);
- **Times pequenos de atendimento** que querem parar de depender de memória;
- Quem quer **vender mais falando menos**, mantendo um ritmo humano de conversa.

---

## O que já existe hoje

Metáfora: cada item abaixo é como uma **ferramenta** numa caixa de ferramentas. Algumas já estão prontas, outras ainda são rascunho.

### Funcionalidades já implementadas

- **Extensão Chrome integrada ao WhatsApp Web**
  - Terceira coluna fixa ao lado das conversas.
  - Carregamento via `dist/` em modo desenvolvedor.

- **Captura e histórico de mensagens**
  - Captura de mensagens via **webpack + DOM** (`MessageCapturer`).
  - Persistência em **IndexedDB** (`MessageDB`).
  - Bancos auxiliares para clientes, pedidos e compras (`client-db`, `order-db`, `purchase-db`).

- **Módulo de Atendimento**
  - Painel integrado de conversas em tempo real.
  - Suporte a respostas normais + sugestões guiadas por IA.

- **Módulo de Clientes**
  - Diretório de clientes com dados estruturados.
  - Histórico de conversas ligado ao cliente.
  - Importação de listas (ex.: `.xlsx`) e mapeamento inteligente de colunas.
  - Sistema de tags, notas e probabilidade de nome (inferência).

- **Módulo de Marketing / Retomar / Reativação**
  - Identificação de **clientes inativos** (dias sem contato).
  - Listas especiais (ex.: "nunca enviar", "exclusivos").
  - Sugestões de mensagens para retomar clientes com contexto.
  - Métricas iniciais de resposta/silêncio.

- **Módulo RAG (Recuperação Aumentada por Geração)**
  - Embeddings, índice vetorial local e orquestradores de consulta.
  - Testes unitários e E2E específicos para RAG com fonte real de dados.

- **Infraestrutura crítica**
  - **Sistema de seletores auto-corrigíveis** com fallback chain.
  - **Configuração remota** para atualizar seletores e regras sem depender da Chrome Web Store.
  - **Interceptação webpack** para acessar módulos internos do WhatsApp de forma robusta.
  - **Arquitetura modular por domínios** (atendimento, clientes, marketing, rag, etc.) com plugin system.

- **Engenharia**
  - Código em **TypeScript** com modo estrito.
  - Lint, format, type-check e suíte de testes (unit + E2E).
  - Regras de engenharia formalizadas em `ENGINEERING_CONTRACT.md`.
  - Validação de dados com **Zod** em toda fronteira do sistema.

### Funcionalidades planejadas (ainda parciais ou não implementadas)

- **Produtos, Pedidos, Entrega e Financeiro** (catálogo, checkout, frete, relatórios);
- **Persona configurável** (tom de voz da marca);
- **Feature flags completas e rollout gradual via config remota**;
- **Bot de suporte com IA** usando "documentação viva";
- **Monetização** (planos, licenças, rate limiting, webhooks).

---

## Como funciona por dentro

Metáfora: imagine um **prédio**:

- o **WhatsApp Web** é o terreno,
- o **Mettri** é um prédio colado nele, com:
  - **porão** (infra, seletores, interceptores),
  - **andares** (módulos de domínio),
  - **fachada** (UI de terceira coluna).

Fluxo simplificado:

1. WhatsApp Web → interceptores webpack + DOM coletam eventos e mensagens.
2. `MessageCapturer` normaliza tudo e grava em bancos locais (IndexedDB).
3. Módulos de domínio (`atendimento`, `clientes`, `marketing`, `rag`, etc.) usam esses dados.
4. A UI (`PanelShell` + módulos) mostra tudo em uma terceira coluna no WhatsApp.
5. Seletores e regras de negócio podem ser atualizados via **config remota**, sem exigir nova versão na Chrome Web Store.

Detalhes completos (com domínios, capacidades e status): veja **`docs/archive/project_concept.md`** e **`docs/archive/project_context.md`**.

---

## Como começar (instalação)

### Pré-requisitos

- Node.js **20+**
- npm **10+**
- Google Chrome (ou Chromium compatível)

### Clonar e instalar

```bash
# Clone o repositório
git clone https://github.com/ferrarijonas/Mettri.git
cd Mettri

# Instale dependências
npm install

# Build da extensão
npm run build
```

### Carregar a extensão no Chrome

1. Abra `chrome://extensions`
2. Ative **Modo do desenvolvedor**
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `dist/`

### Testar no WhatsApp Web

**IMPORTANTE:** o WhatsApp Web detecta quando o navegador está sendo controlado por automação (como Playwright) e pode bloquear.

- ✅ Use **Chrome normal**, aberto manualmente.
- ❌ Não use Playwright / automação para testar a UI do WhatsApp.
- ✅ Use Playwright apenas para **testes estruturais** (manifest, rotas, painéis) ou fluxos específicos preparados.

---

## Desenvolvimento & testes

### Scripts principais (`package.json`)

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Build com watch (desenvolvimento) |
| `npm run build` | Build de produção da extensão |
| `npm run lint` | Verificar regras de lint |
| `npm run type-check` | Verificação de tipos TypeScript (`tsc --noEmit`) |
| `npm run test:unit` | Testes unitários com Vitest |
| `npm run test:e2e` | Testes E2E com Playwright |
| `npm run test:e2e:headed` | Testes E2E com navegador visível |
| `npm run test:rag:browser` | Build + testes E2E focados em RAG |
| `npm run chrome:debug` | Abre Chrome em modo debug |
| `npm run package` | Empacota a extensão para distribuição |
| `npm run build:modules` | Build apenas dos módulos para publicação remota |
| `npm run clean` | Limpa a pasta `dist/` |

---

## Documentação

| Documento | Descrição |
| --- | --- |
| `ENGINEERING_CONTRACT.md` | Contrato de engenharia (regras obrigatórias do projeto) |
| `ZenSpecKit/Mettri/Specs/` | Especificações formais por domínio (atendimento, cadastro, retomar, etc.) |
| `docs/archive/project_concept.md` | Visão conceitual por domínios |
| `docs/archive/project_context.md` | Especificações técnicas e status de implementação |
| `docs/MODULE-UPDATES.md` | Sistema de atualização remota de módulos |
| `docs/DISPLAY_NAME_LOGIC.md` | Lógica de exibição de nomes de clientes |

> Regra de ouro: **primeiro leia a spec, depois mexa no código**.

---

## Filosofia do projeto

- **Human-in-the-loop**: a IA **nunca age sozinha**; sempre precisa de aprovação humana.
- **Histórico imutável**: o histórico de mensagens e interações **nunca é apagado**; é base para IA e reativação.
- **Spec-first**: toda funcionalidade começa com um ZenSpec (contrato formal). Código cumpre contrato.
- **TypeScript estrito e validação forte**: sem `any` solto, com Zod em toda fronteira do sistema.
- **Jidoka**: se algo quebra, para e corrige. Erro não é empurrado pra frente.
- **Arquitetura modular por domínios**: cada parte de negócio vive em seu próprio módulo, com baixo acoplamento.

---

## Roadmap

O projeto evolui por tarefas orquestradas pelo Karma. Cada tarefa (T-XXX) nasce de uma spec, é implementada e verificada por agentes de IA.

**Tier 0 — Fundação** (concluído)
- Captura completa de mensagens + IndexedDB confiável.
- Sistema de seletores com fallback chain + config remota.
- 14 tarefas concluídas (T-003 a T-024), habilitando atendimento, clientes, marketing e RAG.

**Tier 1 — MVP básico**
- Perfil de cliente com histórico utilizável.
- Sugestões contextuais baseadas em histórico.
- Reativação básica + produtos simples.
- Feature flags e monitoramento de seletores.

**Tier 2 — MVP completo**
- Pedidos, vitrine do dia, persona configurável.
- Dashboard com métricas simples.
- Bot de suporte IA com base de conhecimento.

**Tier 3 — Escala**
- Entrega (zonas, frete), financeiro básico, marketing avançado.
- Multi-atendente, rollout gradual, monetização (planos e integrações).

---

## Licença

Distribuído sob licença **MIT**. Veja [`LICENSE`](LICENSE) para detalhes.

---

<p align="center">
  <em>
    Construído com TypeScript estrito, ZenSpecs e Karma.<br>
    <a href=".karma/">Orquestração</a> ·
    <a href="ZenSpecKit/">Especificações</a> ·
    <a href="docs/">Documentação</a>
  </em>
</p>
