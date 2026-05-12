# Jonas Ferrari

**Engenheiro de Software | IA Aplicada • Agentes • Sistemas em Produção**

34 93618-6847 | Uberlândia, MG | contato@jonasferrari.com.br  
[GitHub](https://github.com/ferrarijonas) | [LinkedIn](https://www.linkedin.com/in/jonas-ferrari-077b1226/) | [Instagram](https://www.instagram.com/jonasferrari/)

Engenheiro de software com formação em Design. Construo sistemas com TypeScript, automação e IA: agentes guiados por contratos formais, com autocorreção, memória e quase autonomos. Transformo problemas operacionais em sistemas reais.

---

## Projetos

### Mettri – CRM Conversacional para WhatsApp Web (2024–2026)

**TypeScript, Git, Chrome Extension API, IndexedDB, OpenAI API, esbuild, Zod**

- Plataforma de CRM conversacional como extensão Chrome, integrada nativamente ao WhatsApp Web via interceptação webpack (~48k linhas TypeScript, 25+ módulos, 6 bancos IndexedDB)
- Arquitetura modular com plugin system, RAG local no navegador (embeddings + índice vetorial), sistema de seletores auto-corrigíveis e human-in-the-loop
- Módulo de reativação de clientes com identificação de inativos, variantes A/B, rate limiter e métricas
- TypeScript strict, validação Zod, testes unitários (Vitest) + E2E (Playwright)

### Karma – Agent Harness (2026)

**TypeScript, OpenCode API, DeepSeek, Claude, ChatGPT, Git**

- Orquestrador multi-agente com painel de tarefas organizado por domínio. Tarefas só nascem como SPEC, contratos, critérios de validação e aprendizado de ciclos anteriores
- Proteção de domínios: um agente por vez em cada domínio
- Agentes usam Git: branch por tarefa, commit com ID, merge automático ao concluir
- Agentes especializados por papel com permissões separadas: implementação, revisão adversarial e consolidação de aprendizado
- O sistema registra padrões de erro do humano e ajusta o comportamento dos agentes a cada ciclo
- Trail entre sessões para continuidade, memória de aprendizado cross-tarefa e gate de qualidade (lint → type-check → build → testes)

### Automação Comercial com IA (2020–2024)

**Python, ChatGPT API, AWS Lambda, WhatsApp API**

- Evolução de chatbot Dialogflow para sistema de automação inteligente via API do ChatGPT integrado ao WhatsApp
- Arquitetura serverless com AWS Lambda para raspagem de site e estruturação de catálogo
- Sistema de disparo automatizado de mensagens personalizadas com régua de relacionamento
- Em produção com clientes reais e resolução autônoma

### Consolidação Financeira com IA – Pão de Verdade (2025)

**Python, OpenAI API, Pandas, Classificação Híbrida, Auditoria**

- Sistema de consolidação financeira real para negócio próprio, integrando extratos de três bancos em um relatório único
- Classificador híbrido: regras determinísticas para + de 60% das transações (custo zero) + IA para casos ambíguos 
- Memória de classificações que aprende com correções do usuário e reduz intervenção manual ao longo do tempo
- Geração de relatórios de auditoria, controle de duplicatas e exportação para Excel/Google Sheets com validação de totais
- 100% de precisão validada com dados reais em produção

### Modelagem de Regimes com Cadeias Semi-Markov (2025)

**Python, K-Means, Inferência Bayesiana, Análise de Séries Temporais**

- Pipeline completo de dados: extração, limpeza, janelamento temporal e K-Means para descobrir regimes latentes a partir de dados reais não estruturados
- Modelo semi-Markov com dinâmica temporal oculta: probabilidade de transição sensível a tempo de permanência, padrões por hora/dia e múltiplos fatores contextuais
- Sistema de inferência combinando ângulo de tendência, memória do processo (Hurst), gradiente de volume e divergência — tudo integrado por combinação Bayesiana
- Geração de sinais e alertas em tempo real com calibração via otimização
  Estratégia de decisão construída sobre o modelo com validação estatística rigorosa

## Abordagem Técnica & Diferenciais

**Método: especificação → contrato → validação**
Especificação antes do código. O que o sistema deve fazer, como validar, o que não tocar. Tudo definido antes da primeira linha.

**Human-in-the-loop**
IA executa, eu aprovo. Automação com portão. Decisões de negócio e segurança não são delegadas. Quem é dono sabe. 

**Ferramental de IA**
Cursor, OpenCode, DeepSeek, Claude, ChatGPT. Uso agentes com pipeline próprio para implementar, revisar e testar. Eles registram padrões de erro e ajustam o comportamento a cada ciclo.

**Stack**
TypeScript (strict), Python, Git | Node.js, esbuild, Tailwind CSS | Zod, IndexedDB | OpenAI API, RAG vetorial | AWS Lambda, GitHub Actions | Chrome Extension API, webpack interception

**Do problema ao sistema**
Diagnóstico → modelagem → construção → evolução. Ciclo completo, sozinho, com validação em cada etapa.

**Qualidade como cultura**
TypeScript strict, Zod, Playwright, Gate obrigatório: lint → type-check → build → testes. Construo o que eu mesmo consigo depurar e manter.

**Design como diferencial técnico**
Formação em Design fundamenta decisões de UX, interface e arquitetura de informação. Não é gosto — é método.

**Idiomas**
Português (nativo) | Espanhol (fala, leitura) | Inglês (leitura e escrita)

## Certificações e cursos

- Microsoft Learn – **Fundamentos de IA no Azure (AI-901)**
- Microsoft Learn – **Aplicações e agentes de IA no Azure**  

## Formação

**Engenharia de Software** – Universidade Anhanguera (cursando)

**Design** – Universidade Feevale (RS)  
2008–2014

## Experiência Profissional

### Pão de Verdade | Forneria Artesanal

**Fundador e Gestor** (2019–atual)

- Montei uma padaria artesanal do zero — produção, finanças, equipe, cliente
- Automatizei tudo que me incomodava: consolidação financeira, pedidos, processos
- O negócio me ensinou a resolver problema real com código, não com slide

### CNX Marketing + Design

**Fundador e Gestor** (2012–2017)

- Liderei uma equipe de 5 pessoas, remota, atendendo grandes contas do turismo
- Aprendi a alinhar escopo, prazo e expectativa direto com o cliente
- Organizei processos internos para parar de depender de herói e começar a depender de método

### Grupo SkyTeam

**Analista de Comunicação e Design** (2010–2012)

- Padronizei a identidade visual em 17 unidades — mesma cara, mesma informação
- Criei campanhas recorrentes que a equipe de vendas esperava, não improvisava
- Aprendi a falar com diretoria e chão de loja na mesma reunião

### Via Zen – Associação de Prática Zen Budista

**Residente e Cozinheiro** (2017–2019)

- Dois anos de rotina comunitária: cozinha para dezenas de pessoas, horta, cuidado diário com animais
- Aprendi a fazer com o que tem, não com o que falta

### Ki-sola

**Técnico em Modelagem / Protótipos** (2003–2010)

- Construía protótipos antes da linha de produção — meu trabalho evitava erro em escala
- Lia desenho técnico e traduzia em modelo físico funcional
- Ponte entre engenharia e chão de fábrica por 7 anos

### Calçados Crysalis

**Operador de Produção** (2000–2003)

- Meu primeiro emprego, aos 17 — fábrica com TPS, 5S, Kaizen
- Aprendi que qualidade não se inspeciona no final, se constrói no processo
- Meta clara, rotina clara, melhoria todo dia

---

## Sobre

Gaúcho, pai. Busco times onde arquitetura e entrega andam juntas — startups de IA em crescimento, produto real, decisões que importam.
