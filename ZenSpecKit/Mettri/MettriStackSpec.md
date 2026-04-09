# Mettri Stack Spec

Escolhas técnicas claras, sem ambiguidade. Stack Spec diz **com o quê**; Eng Spec diz **a estrutura**; ZenSpec diz **o comportamento**; código diz **como**.  
Este documento segue o template de `ZenStackSpec.md` e é derivado de `MettriConceptSpec`, `MettriEngSpec` e `package.json`.

---

## 1. Intenção

Esta stack existe para que **devs e agentes de automação** consigam **construir, rodar, testar e empacotar o Mettri como extensão de WhatsApp Web** sem precisar de **ambiente complexo de backend próprio ou ferramentas não documentadas**.

---

## 2. Restrições

| Restrição                               | Imposta por                       | Consequência                                                                                     |
| --------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------ |
| Rodar dentro do navegador (Chrome-like) | WhatsApp Web + modelo de extensão | Stack deve gerar bundles JS compatíveis com extensões; sem servidor Node fixo.                   |
| Execução no contexto do WhatsApp Web    | Plataforma alvo                   | Não é possível controlar versão do WhatsApp; seletores e interceptores precisam ser resilientes. |
| Frontend em TypeScript/JS               | Código existente                  | Linguagem principal da stack é TypeScript; outras linguagens são periféricas.                    |
| Armazenamento local no browser          | Ambiente cliente                  | Uso obrigatório de IndexedDB/local storage; sem dependência obrigatória de DB remoto.            |
| Suporte a Windows/macOS/Linux           | Base de usuários dev              | Comandos e ferramentas precisam funcionar em ambientes multiplataforma.                          |
| Uso de Playwright para E2E              | Suite de testes existente         | Navegador de testes precisa ser compatível com WhatsApp Web e extensão.                          |

---

## 3. Decisões

| Categoria        | Decisão                                     | Alternativa descartada                          | Motivo                                                      |
| ---------------- | ------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| Linguagem        | `TypeScript` estrito para código principal  | `JavaScript` sem tipos                          | Tipagem forte para robustez em domínios complexos.          |
| Bundler/Build    | `esbuild` para bundle da extensão           | `webpack` ou `rollup`                           | Simplicidade e velocidade de build.                         |
| Testes unit      | `vitest`                                    | `jest`                                          | Integração mais leve com stack ESM/TS.                      |
| Testes E2E       | `@playwright/test`                          | `cypress`                                       | Melhor suporte a múltiplos navegadores e automação fina.    |
| Execução TS      | `tsx` para scripts/automation               | `ts-node`                                       | Startup mais rápido e suporte moderno a ESM.                |
| UI/Estilo        | `tailwindcss` + `postcss` + `autoprefixer`  | CSS puro ou frameworks pesados                  | Rapidez para iterar na UI da extensão sem framework grande. |
| Qualidade        | `eslint` + `typescript-eslint` + `prettier` | ESLint isolado ou sem formatter padronizado     | Padronizar estilo e evitar divergências de código.          |
| Testes IndexedDB | `fake-indexeddb` + `jsdom` em testes        | Mocks manuais de storage                        | Simular ambiente de browser sem complexidade manual.        |
| Planilhas        | `xlsx` para importação de clientes          | Formatos proprietários ou parsing manual de CSV | Biblioteca madura e conhecida para planilhas.               |
| Validação        | `zod` para schemas e validação de dados     | Tipos TS puros ou `ajv`                         | Validação runtime clara e próxima dos tipos TS.             |

---

## 4. Dependências

### 4.1 Prod (runtime)

| Pacote | Versão  | Papel                                  | Dev-only? |
| ------ | ------- | -------------------------------------- | --------- |
| `xlsx` | ^0.18.5 | Importar contatos/listas via planilhas | Não       |
| `zod`  | ^3.22.0 | Validação de dados e schemas           | Não       |

### 4.2 Dev/Test/Build

| Pacote                   | Versão   | Papel                                 | Dev-only? |
| ------------------------ | -------- | ------------------------------------- | --------- |
| `typescript`             | ^5.3.0   | Linguagem e checagem de tipos         | Sim       |
| `esbuild`                | ^0.20.0  | Bundler para extensão e módulos       | Sim       |
| `eslint`                 | ^9.0.0   | Linting base                          | Sim       |
| `@eslint/js`             | ^9.0.0   | Regras padrão ESLint                  | Sim       |
| `typescript-eslint`      | ^8.0.0   | Integração ESLint + TS                | Sim       |
| `eslint-config-prettier` | ^9.1.0   | Evitar conflito ESLint/Prettier       | Sim       |
| `prettier`               | ^3.2.0   | Formatador de código                  | Sim       |
| `@types/node`            | ^25.0.6  | Tipos Node.js para tooling            | Sim       |
| `@types/chrome`          | ^0.0.260 | Tipos para APIs de extensão Chrome    | Sim       |
| `tailwindcss`            | ^4.1.18  | Utilitários de estilo                 | Sim       |
| `@tailwindcss/postcss`   | ^4.1.18  | Integração Tailwind + PostCSS         | Sim       |
| `postcss`                | ^8.5.6   | Pipeline de CSS                       | Sim       |
| `autoprefixer`           | ^10.4.23 | Prefixos de compatibilidade em CSS    | Sim       |
| `vitest`                 | ^1.6.1   | Testes unitários                      | Sim       |
| `@vitest/ui`             | ^1.6.1   | UI de testes Vitest                   | Sim       |
| `@playwright/test`       | ^1.40.0  | Testes E2E                            | Sim       |
| `tsx`                    | ^4.21.0  | Execução de TS em scripts             | Sim       |
| `jsdom`                  | ^24.1.3  | Ambiente DOM fake para testes         | Sim       |
| `fake-indexeddb`         | ^5.0.2   | Simulação de IndexedDB em testes      | Sim       |
| `puppeteer-core`         | ^24.34.0 | Suporte eventual a automações com CDP | Sim       |
| `tw-animate-css`         | ^1.4.0   | Animações integradas ao Tailwind      | Sim       |

---

## 5. Scripts

| Comando                    | O que faz                                                              |
| -------------------------- | ---------------------------------------------------------------------- |
| `npm run dev`              | Roda `esbuild` em modo watch para desenvolvimento da extensão.         |
| `npm run build`            | Gera build de produção da extensão.                                    |
| `npm run lint`             | Executa ESLint em `src/`.                                              |
| `npm run lint:fix`         | Executa ESLint com correção automática.                                |
| `npm run format`           | Formata arquivos `ts` e `css` com Prettier.                            |
| `npm run type-check`       | Roda `tsc --noEmit` para checagem de tipos.                            |
| `npm run test:unit`        | Roda testes unitários com Vitest.                                      |
| `npm run test:unit:watch`  | Roda testes unitários em modo watch.                                   |
| `npm run test:e2e`         | Roda testes E2E com Playwright.                                        |
| `npm run test:e2e:headed`  | Roda testes E2E com navegador visível.                                 |
| `npm run test:rag:browser` | Build + testes E2E focados em RAG com navegador real.                  |
| `npm run test:cdp`         | Executa scripts de automação/diagnóstico via CDP (`tests/automation`). |
| `npm run chrome:debug`     | Abre Chrome em modo debug via PowerShell script.                       |
| `npm run package`          | Empacota a extensão para distribuição.                                 |
| `npm run build:modules`    | Build apenas dos módulos, para publicação independente.                |
| `npm run publish-modules`  | Publica módulos via script PowerShell.                                 |
| `npm run clean`            | Remove a pasta `dist/`.                                                |

---

## 6. Pastas

Árvore de primeiro e segundo nível (principais):

```text
.
├── src/
│   ├── content/           # Código que roda no contexto do WhatsApp Web
│   ├── infrastructure/    # Seletores, config remota, interceptores, storage
│   ├── modules/           # Módulos de domínio (atendimento, clientes, marketing, rag…)
│   ├── storage/           # Bancos locais (MessageDB, client-db, purchase-db…)
│   ├── ui/                # Shell da UI, componentes, tema e painel
│   └── types/             # Tipos e contratos compartilhados
├── specs/                 # Especificações por domínio e ZenSpecKit
├── tests/                 # Testes unitários e E2E
├── docs/                  # Documentação complementar (arquitetura, robustez, etc.)
├── wa-sync-reference/     # Código e assets de referência para WA-Sync
├── scripts/               # Scripts auxiliares (build, debug, publish)
├── dist/                  # Saída de builds (extensão pronta)
└── .specify/              # Templates e automações de documentação
```

---

## 7. Escopo fora

| O que não usamos                       | Por quê (uma frase)                                                  |
| -------------------------------------- | -------------------------------------------------------------------- |
| Framework SPA pesado (ex.: React/Next) | Manter bundle leve e acoplado ao contexto de extensão.               |
| Backend obrigatório próprio            | Permitir que o Mettri funcione apenas como extensão + storage local. |
| ORM/server-side DB para core           | Persistência principal é em IndexedDB no cliente.                    |
| Cypress para E2E                       | `@playwright/test` já cobre os requisitos multi-navegador.           |
| Ferramentas de monorepo complexas      | Projeto atual não exige estrutura multi-pacote.                      |
