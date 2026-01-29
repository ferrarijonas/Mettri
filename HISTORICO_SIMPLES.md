# 📝 Histórico Simples - Mettri

> Uma linha por coisa feita. Simples e direto.

---

## 2024-12-23 - Nascimento do Mettri

- Criou projeto base (TypeScript, Manifest V3)
- Criou painel integrado no WhatsApp
- Criou MessageCapturer (captura mensagens)
- Criou MessageDB (salva no IndexedDB)
- Criou painel com tabs (Dashboard, Copiloto, CRM)

## 2026-01-11 - Sentinela Base

- Adicionou world: "MAIN" no manifest (acesso ao window)
- Criou WhatsAppInterceptors (encontra módulos do WhatsApp)
- Criou DataScraper (escuta eventos)
- Implementou busca inteligente por características
- Implementou objeto N (padrão referência)
- Acesso a N.Msg funcionando
- Acesso a N.Contact funcionando
- Acesso a N.Label funcionando
- Acesso a N.Chat funcionando
- Validação com Zod implementada
- Documentou tudo (SENTINELA_ESTADO_ATUAL.md)
- Criou plano completo (SENTINELA_PLANO_IMPLEMENTACAO.md)
- Commit no git com toda documentação
- Criou aba de testes das funções do WhatsApp
- Implementou sistema de testes de módulos (module-tester.ts)
- Implementou salvamento de número de teste (test-config.ts)
- Criou TestPanel com lista hierárquica de 13 níveis de módulos
- Integrou aba "Testes" no painel principal
- Adicionou estilos CSS para aba de testes

14JAN26
- Trabalhando na aba histórico, descobri a partir de uma extensão outra forma de acessar o bundler
- Encontrou extensão WA Web Plus (ID: ekcgkejcjdcmonfpmnljobemcbpnkamh)
- Analisou código e descobriu que usa modulesMap do Comet (window.require("__debug")?.modulesMap)
- Descobriu que cria objeto Ct centralizado com todos os módulos
- Documentou análise em WA_WEB_PLUS_ANALYSIS.md
- descobri que posso trabalhar com agentes em paralelo em partes diferentes do proejto ao mesmo tempo, isso está acelerando demais o desenvolvimento.

15JAN26
- Decidiu implementar Plugin System para escalar arquitetura
- Problema: panel.ts conhece cada módulo diretamente, adicionar módulo quebra outros
- Solução: Sistema de 3 camadas (Core/Registry/Modules)
- PanelShell (core): apenas navegação, não conhece módulos específicos
- ModuleRegistry: descobre módulos automaticamente via escaneamento
- Modules/: cada módulo se registra sozinho, isolado dos outros
- Suporta hierarquia (módulos dentro de módulos) via parent/child
- Lazy loading automático para performance
- Permite escalar para 100k módulos sem degradação
- Atualizou project_concept.md, project_context.md, tech_stack.md, progress.md
- Criou plano de execução simples e robusto
- Fase 1 concluída: Criou EventBus, ModuleRegistry, PanelShell
- Fase 2 concluída: Migrou history-panel, test-panel, reactivation-panel para modules/
- Fase 3 concluída: Refatorou panel.ts para usar Plugin System
- panel.ts agora não conhece módulos específicos, tabs geradas dinamicamente
- EventBus integrado: histórico atualiza automaticamente quando nova mensagem chega
- Build passando sem erros
- Fase 4 concluída: Hierarquia visual implementada
- Criou módulos pais (clientes, infrastructure, marketing) como containers
- Dropdown tabs para módulos com sub-módulos funcionando
- CSS atualizado para suportar hierarquia visual
- Lazy loading básico funcionando (módulos só instanciam quando clicados)
- Para reaproveitar o m��dulo reativar, vou colocar ele dentro do m��dulo "enviar" e criar tbm o "responder" e "divulgar".
- Para fazer isso bem feito, estou dnv separando o front/design totalmente do c��digo
- Isso fez tudo quebrar, mas entendi que estamos em instancias/mundos diferente agora.
- Tenho agora um arquivo que vive no mundo do zap, outro que vive na extensao
- Preciso que eles se comuniquem, e que o design fique preso no mundo da extens?o.
- A ideia de ponte agora mudou, pq ficou muito complexa, vamos de shadow DOM, que separa apenas o visual, e n?o todo JAVA.
- Para usar o shadow DOM, e voltar atr��s, tudo que criamos de extra precisa ser removido.
- Toda aparte de infra, que chamei de testes quebrou, vou focar em identificar a conta do zap inicialmente
- Parei hoje nessa tentativa de encontrar a conta certa novamente... amanh? continuo a apartir disso.
- Criei um arquivo Engineering.md com regras para evitar erros promovidos por viez da IA.
- Estou trabalhando para voltar a conectar o painel testes com a realidade do zap, est�� evoluindo.
-  


---

**Como usar:** Adicione uma linha aqui toda vez que fizer algo importante. Simples assim.
