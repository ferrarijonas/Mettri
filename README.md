<div align="center">

<h1>Mettri</h1>
<h3><em>Plataforma de vendas conversacionais para WhatsApp Web</em></h3>

</div>

> Versão **2.0.1** • Foco em **negócios locais** • Extensão Chrome integrada ao **WhatsApp Web**

---

## Sumário

- [🤔 O que é o Mettri?](#-o-que-é-o-mettri)
- [🧑‍🍳 Para quem é](#-para-quem-é)
- [🌟 O que já existe hoje](#-o-que-já-existe-hoje)
- [🏗️ Como funciona por dentro](#-como-funciona-por-dentro)
- [⚡ Como começar (instalação)](#-como-começar-instalação)
- [🧪 Desenvolvimento & testes](#-desenvolvimento--testes)
- [📚 Documentação](#-documentação)
- [🧠 Filosofia do projeto](#-filosofia-do-projeto)
- [🚧 Roadmap](#-roadmap)
- [🤝 Contribuindo](#-contribuindo)
- [📄 Licença](#-licença)

---

## 🤔 O que é o Mettri?

Pensa no Mettri como um **gerente de vendas que mora dentro do seu WhatsApp Web**.

- **Problema**: conversas importantes com clientes se perdem, ninguém lembra quem respondeu o quê, quem sumiu, quem deveria ser reativado.
- **Proposta**: o Mettri transforma o WhatsApp em um sistema de **continuidade, contexto e vendas responsáveis**, sem automação agressiva nem spam.

Ele:

- organiza conversas por cliente,
- guarda o **histórico completo** em banco local (nunca apaga),
- sugere ações com IA (mas **sempre com aprovação humana**),
- ajuda a decidir **quando**, **com quem** e **por que** falar.

---

## 🧑‍🍳 Para quem é

Mettri é pensado para:

- **Negócios locais** que já vendem pelo WhatsApp (padarias, restaurantes, serviços, comércios);
- **Times pequenos de atendimento** que querem parar de depender de memória;
- Quem quer **vender mais falando menos**, mantendo um ritmo humano de conversa.

---

## 🌟 O que já existe hoje

Metáfora: cada item abaixo é como uma **ferramenta** numa caixa de ferramentas. Algumas já estão prontas, outras ainda são rascunho.

### ✅ Funcionalidades já implementadas (v2.0.1)

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
  - Listas especiais (ex.: “nunca enviar”, “exclusivos”).
  - Sugestões de mensagens para retomar clientes com contexto.
  - Métricas iniciais de resposta/silêncio.

- **Módulo RAG (Recuperação Aumentada por Geração)**
  - Módulos dedicados em `src/modules/rag/*`.
  - Testes unitários e E2E específicos para RAG (fonte real de dados).
  - Infra de embeddings, índice vetorial local e orquestradores de consulta.

- **Infraestrutura crítica**
  - **Sistema de seletores auto‑corrigíveis** com fallback chain.
  - **Configuração remota** para atualizar seletores e regras sem depender da Chrome Web Store.
  - **Interceptação webpack** para acessar módulos internos do WhatsApp de forma robusta.
  - **Arquitetura modular por domínios** (atendimento, clientes, marketing, rag, etc.) com plugin system.

- **Engenharia**
  - Código em **TypeScript** com modo estrito.
  - Lint, format, type‑check e suíte de testes (unit + E2E).
  - Regras de engenharia formalizadas em `ENGINEERING_CONTRACT.md` e `.cursorrules`.
  - Histórico de mudanças rastreado em `HISTORICO_SIMPLES.md` (uma linha por coisa feita).

### 🚧 Funcionalidades planejadas (ainda parciais ou não implementadas)

Algumas capacidades já estão bem definidas em `project_context.md`, mas ainda não estão completas no código:

- **Produtos, Pedidos, Entrega e Financeiro** (catálogo, checkout, frete, relatórios);
- **Persona configurável** (tom de voz da marca);
- **Feature flags completas e rollout gradual via config remota**;
- **Bot de suporte com IA** usando “documentação viva”;
- **Monetização** (planos, licenças, rate limiting, webhooks).

---

## 🏗️ Como funciona por dentro

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

Detalhes completos (com domínios, capacidades e status): veja **`project_context.md`** e **`project_concept.md`**.

---

## ⚡ Como começar (instalação)

### Pré‑requisitos

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

Mais detalhes em `TESTE-RAPIDO.md` (quando disponível).

---

## 🧪 Desenvolvimento & testes

### Scripts principais (`package.json`)

| Comando                        | Descrição simplificada                                      |
| ----------------------------- | ------------------------------------------------------------ |
| `npm run dev`                 | Build com watch (desenvolvimento)                           |
| `npm run build`               | Build de produção da extensão                               |
| `npm run lint`                | Verificar regras de lint                                    |
| `npm run lint:fix`            | Corrigir problemas de lint automaticamente                  |
| `npm run format`              | Formatador (Prettier) nos arquivos `ts` e `css`             |
| `npm run type-check`          | Verificação de tipos TypeScript (`tsc --noEmit`)            |
| `npm run test:unit`           | Testes unitários com Vitest                                 |
| `npm run test:unit:watch`     | Testes unitários em modo watch                              |
| `npm run test:e2e`            | Testes E2E com Playwright                                   |
| `npm run test:e2e:headed`     | Testes E2E com navegador visível                            |
| `npm run test:rag:browser`    | Build + testes E2E focados em RAG com navegador real        |
| `npm run test:cdp`            | Scripts de automação/diagnóstico via CDP                    |
| `npm run chrome:debug`        | Abre Chrome em modo debug (via PowerShell)                  |
| `npm run package`             | Empacota a extensão para distribuição                       |
| `npm run build:modules`       | Build apenas dos módulos (para publish de módulos)          |
| `npm run publish-modules`     | Publica módulos (ex.: via GitHub Pages / config remota)     |
| `npm run clean`               | Limpa a pasta `dist/`                                       |

---

## 📚 Documentação

Pontos de partida recomendados:

| Documento                                      | Descrição                                                     |
| --------------------------------------------- | ------------------------------------------------------------- |
| `project_concept.md`                          | Visão conceitual por domínios (atendimento, clientes, etc.)  |
| `project_context.md`                          | Especificações técnicas, status de implementação e roadmap   |
| `HISTORICO_SIMPLES.md`                        | Linha do tempo simples (uma linha por melhoria)              |
| `ENGINEERING_CONTRACT.md`                     | Contrato de engenharia (regras obrigatórias do projeto)      |
| `docs/MODULE-UPDATES.md`                      | Como funciona o sistema de atualização remota de módulos     |
| `docs/IMPORT_TELEFONE_FALLBACK.md`            | Estratégia de importação de contatos / telefones             |
| `docs/DISPLAY_NAME_LOGIC.md`                  | Lógica de exibição de nomes de clientes                      |
| `specs/`                                      | Especificações por domínio (atendimento, cadastro, retomar…) |

> Regra de ouro: **primeiro leia a spec, depois mexa no código**.

---

## 🧠 Filosofia do projeto

Alguns princípios que guiam o Mettri (explicados em detalhes em `project_concept.md` e `project_context.md`):

- **Human‑in‑the‑loop**: a IA **nunca age sozinha**; sempre precisa de aprovação humana.  
- **Histórico imutável**: o histórico de mensagens e interações **nunca é apagado**; é base para IA e reativação.  
- **Seletores auto‑corrigíveis**: se o WhatsApp mudar o DOM, o foco é **corrigir seletores em menos de 1 minuto**, não “dar sorte”.  
- **TypeScript estrito e validação forte**: sem `any` solto, com validação de dados (ex.: Zod).  
- **Documentação viva**: tudo que funciona deve ser **documentado junto com o código** (specs, exemplos, erros conhecidos).  
- **Arquitetura modular por domínios**: cada parte de negócio vive em seu próprio módulo, com baixo acoplamento.

---

## 🚧 Roadmap

O `project_context.md` descreve um roadmap por **Tiers**. Resumo simplificado:

- **Tier 0 – Fundação**  
  - Captura completa de mensagens + IndexedDB confiável.  
  - Sistema de seletores com fallback chain + config remota.  
  - Documentação básica e troubleshooting inicial.

- **Tier 1 – MVP básico (1 negócio real)**  
  - Perfil de cliente com histórico utilizável.  
  - Sugestões contextuais baseadas em histórico.  
  - Reativação básica + primeiros recursos de produtos simples.  
  - Feature flags e monitoramento de seletores.

- **Tier 2 – MVP completo (produto vendável)**  
  - Pedidos, vitrine do dia, persona configurável.  
  - Dashboard com métricas simples.  
  - Bot de suporte IA com base de conhecimento.

- **Tier 3 – Escala (100k usuários)**  
  - Entrega (zonas, frete), financeiro básico, marketing avançado.  
  - Multi‑atendente, rollout gradual, monetização completa (planos e integrações).

Para ver o detalhamento (por capacidade, status e arquivo), consulte a seção **“Estado Atual vs. Planejado”** em `project_context.md`.

---

## 🤝 Contribuindo

⚠️ Este projeto segue regras obrigatórias definidas em **`ENGINEERING_CONTRACT.md`** e `.cursorrules`.  
Qualquer mudança estrutural deve respeitá‑las.

Passos básicos:

1. Faça um **fork** do repositório.  
2. Crie uma branch a partir da main ou do branch de trabalho:  
   - `git checkout -b feat/minha-feature`  
3. Garanta que os checks passam:  
   - `npm run lint`  
   - `npm run type-check`  
   - `npm run test:unit` (e E2E se aplicável).  
4. Faça commits seguindo **Conventional Commits** (ex.: `feat: adiciona módulo X`).  
5. Abra um **Pull Request** explicando:
   - qual domínio/capacidade foi alterado,  
   - qual spec foi seguida/atualizada (em `specs/` ou `project_context.md`).

O template de PR em `.github/PULL_REQUEST_TEMPLATE.md` ajuda a manter o padrão.

---

## 📄 Licença

Distribuído sob licença **MIT**. Veja [`LICENSE`](LICENSE) para detalhes.

---

## Autor

Mettri é desenvolvido em **TypeScript**, guiado por **especificações vivas** e muita paciência.  
Construa com calma, com propósito e pensando sempre na próxima conversa com o cliente.
