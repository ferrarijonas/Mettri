Histórico Simples - Mettri

´´´´
Atual: Criar caixa de mensanges em cada um das etapas do ciclo
Relacionadas/dependentes: 
Próximas: Implementar teste A/B no envio das msgs... 

```typescript
Design:
    Redução de redundância
    Grupo semantico
    Agrupamento por objetivo
    Ontológico
```

## 

## 20FEV

- Implementei o novo motor de busca de contatos para retomar conversas.
- Mudar a chamada da msg para última compra ao inves de última msg
- 

## 18FEV

- Sistema de envio funcionando corretamente

- Régua implementada

- Primeira versão da IA que encontra compras nos chats implementada, busca 3 contatos para aprender, depois varre tudo e gera relatório

- Sinal de compra manual implementado em cada contato

- O sistema atual retoma retoma conversar a partir da última msg, agora vai fazer a partir da última compra.

- 

## 11FEV

- Tentando hoje comecar a usar specs para organizar um sistema para criar o código sozinho.
- 

## 10FEV

- Hoje foi o primiero envio certinho do Mettri, que marco! Estou mto feliz e empolgado! 144 pessoas receberam msg 

---

## 09FEV

- Etiquetas estavam criando um modal que gerava scrool na lista, corrigi.
- Etiquetas criadas apareciam no modal, mas não na lista...corrigi 

## 07FEV

- Etiquetas e pessoas funcionando, mas não redondo, precisa sincronizar e ficar mais bonito...
- Metricas já estão mockadas, agora precisa por funcionar..
- Decidi dar o próximo passo fazendo um painel simples com métricas...
- Tentei implementar manipulacao das etiquetas nativas do whatsappweb, e percebi que não consigo pegar todas. Documentei.
- Comecei com a ideia do Studio Mettri, é a forma mais elegante que vejo de uso, como se fosse uma central de anúncios...
- Melhorei o layout da tela das etiquetas, vou usar uma associacao com as etiquetas do zap.
- Módulos voltaram ativa, lista carregada.Vou tomar um caminho de usar essa tela como foco do projeto por enquanto...

## 06FEV

- Troquei o nome do módulo, e isso quebrou mais coisas do que eu poderia ter imaginado..nenhum dos módulos está abrindo...
- Implementando a ideia de listas dentro do painel, para excluir ctts do envio, ou selecionar apenas de uma lista para enviar...
- Hoje comeÃ§o a melhorar o painel de reativaÃ§Ã£o, mudando o nome dele para "Retomar"

## 30JAN

- Hoje comeÃ§o e codar o mÃ³dulo "reativaÃ§Ã£o", vou planejar mto antes de executar. Fazer em partes bem pequenas.
- Novamente, antes de executar ele, vou deixar adiantado os os trÃªs contextos extras desse mÃ³dulo: reativar, responder, divulgar. 
- Pronto, menus implementados, agora vamos testar a lÃ³gica.
- Fiz um bom projeto de como descobrir a Ãºltima msg a partir do MessageDB, e considerar isso como Ãºltima interaÃ§Ã£o.
- No futuro, vamos escolher entre Ãºltima compra, Ãºltima interaÃ§Ã£o...
- Deu certo, ele pegou do banco, tudo certo.
- Achou as pessoas, mas mtas nÃ£o tem como saber o nome dela, aÃ­ entra outro problema...
- PAUSA no reativacao, pra criar o CLIENTES primeiro, para conseguir dali puxar o nome correto pro reativacao usar.
- MÃ³dulo clientes tem funcoes bÃ¡sicas de cadastro, validacao de primeiro nome, e opcao de importar/cruzar nomes por upload de arquivo.
- Para refinar o mÃ³dulo Clientes, preciso criar o MÃ“DULO ATENDIMENTO, que Ã© onde no dia a dia, vamos trabalhar....
- Ao mesmo tempo, o bÃ¡sico do mÃ³dulo cliente estÃ¡ pronto, com muitos nomes encontrados. Vou refinar a ideia da parte de "Importar" clientes...
- Importar vai ser lindo, vai ler qualquer tipo de arquivo, achar os dados que precisa para construir o cadastro certo. 
- Pra ele funcionar com ia tbm, tive que criar um app no cloudfare...
- Essa parte jÃ¡ ficou mais dificil do que parecia..ainda trabalhando no botÃ£o de importar...
- parei ao perceber que apesar de importados e avaliados por ia...agora tem que conectar esses nomes com os nÃºmeros ids corretos.
- Consegui resolver isso, importou os nomes, mas nÃ£o puxou os corretos. Volto a tentar resolver isso...
- Parei no import, nÃ£o estÃ¡ bom, a chamada MCP nÃ£o funcionou, o wizard Ã© pouco...
- Consegui fazer funcionar. Agora volto ao mÃ³dulo reativar.
- Primeiro passo, criar um botÃ£o de teste, com campo para salvar um nÃºmero.
- BotÃ£o criado, mas nÃ£o enviou, vou corrigir.
- Apesar de ter um mÃ³dulo de testes, que envia msg, essa funcao/servico nao pode ser reaproveitada por outros mÃ³dulos
- Sabendo disso, preciso replicar aquela funcao, mas transformando ela num servico, acessivel para todos os modulos...
- Servico pronto, agora mais fÃ¡cil pra outras partes do projeto acessarem o servico de msgs.
- Primeiro teste do Mettri! Funcionou!! Fiz o primeiro envio para meus clientes...um envio leve, com delay, muito bom!

## 29JAN26

- Msg enviada direta pelo Mettri, primeiro passo para comeÃ§ar o projeto do bot.
- Vou subir pro GIT e versionar isso
- Subi, e agora comecei a trabalhar no design, quero melhorar um pouco.
- Quebrou, virou tela cinza, implementou shadow DOM
- Corrigiu com uma msg, ficou lindo, design perfeito.
- Agora senti um problema que Ã© o mÃ³dulo histÃ³rico, estÃ¡ pesando muito tudo, vou pedir para desativar.
- Vou desativar o mÃ³dulo com uma chave, mas vai continuar salvando.
- Descobri que salva num banco do navegador. Quero um banco de verdade. 
- Entendi que o IndexedDB Ã© bem versÃ¡til, vou usar ele e dele, mandar em lotes Jsons pra um servidor no futuro.
- Depois, preciso criar uma API que vai ler esses dados, pra expor na UI do mettri...
- Toogle funcionando para desativar histÃ³rico
- histÃ³rico sendo salvo em arquivo
- Agora vem a prÃ³xima fase, o que serÃ¡? Vou implementar a ideia de reativacao

## 15JAN26

- Decidiu implementar Plugin System para escalar arquitetura
- Problema: panel.ts conhece cada mÃ³dulo diretamente, adicionar mÃ³dulo quebra outros
- SoluÃ§Ã£o: Sistema de 3 camadas (Core/Registry/Modules)
- PanelShell (core): apenas navegaÃ§Ã£o, nÃ£o conhece mÃ³dulos especÃ­ficos
- ModuleRegistry: descobre mÃ³dulos automaticamente via escaneamento
- Modules/: cada mÃ³dulo se registra sozinho, isolado dos outros
- Suporta hierarquia (mÃ³dulos dentro de mÃ³dulos) via parent/child
- Lazy loading automÃ¡tico para performance
- Permite escalar para 100k mÃ³dulos sem degradaÃ§Ã£o
- Atualizou project_concept.md, project_context.md, tech_stack.md, progress.md
- Criou plano de execuÃ§Ã£o simples e robusto
- Fase 1 concluÃ­da: Criou EventBus, ModuleRegistry, PanelShell
- Fase 2 concluÃ­da: Migrou history-panel, test-panel, reactivation-panel para modules/
- Fase 3 concluÃ­da: Refatorou panel.ts para usar Plugin System
- panel.ts agora nÃ£o conhece mÃ³dulos especÃ­ficos, tabs geradas dinamicamente
- EventBus integrado: histÃ³rico atualiza automaticamente quando nova mensagem chega
- Build passando sem erros
- Fase 4 concluÃ­da: Hierarquia visual implementada
- Criou mÃ³dulos pais (clientes, infrastructure, marketing) como containers
- Dropdown tabs para mÃ³dulos com sub-mÃ³dulos funcionando
- CSS atualizado para suportar hierarquia visual
- Lazy loading bÃ¡sico funcionando (mÃ³dulos sÃ³ instanciam quando clicados)
- Para reaproveitar o mÃ³dulo reativar, vou colocar ele dentro do mÃ³dulo "enviar" e criar tbm o "responder" e "divulgar".
- Para fazer isso bem feito, estou dnv separando o front/design totalmente do cÃ³digo
- Isso fez tudo quebrar, mas entendi que estamos em instancias/mundos diferente agora.
- Tenho agora um arquivo que vive no mundo do zap, outro que vive na extensao
- Preciso que eles se comuniquem, e que o design fique preso no mundo da extensÃ£o.
- A ideia de ponte agora mudou, pq ficou muito complexa, vamos de shadow DOM, que separa apenas o visual, e nÃ£o todo JAVA.
- Para usar o shadow DOM, e voltar atrÃ¡s, tudo que criamos de extra precisa ser removido.
- Toda aparte de infra, que chamei de testes quebrou, vou focar em identificar a conta do zap inicialmente
- Parei hoje nessa tentativa de encontrar a conta certa novamente... amanhÃ£ continuo a apartir disso.
- Criei um arquivo Engineering.md com regras para evitar erros promovidos por viez da IA.
- Estou trabalhando para voltar a conectar o painel testes com a realidade do zap, estÃ¡ evoluindo.

## 14JAN26

- Trabalhando na aba histÃ³rico, descobri a partir de uma extensÃ£o outra forma de acessar o bundler
- Encontrou extensÃ£o WA Web Plus (ID: ekcgkejcjdcmonfpmnljobemcbpnkamh)
- Analisou cÃ³digo e descobriu que usa modulesMap do Comet (window.require("__debug")?.modulesMap)
- Descobriu que cria objeto Ct centralizado com todos os mÃ³dulos
- Documentou anÃ¡lise em WA_WEB_PLUS_ANALYSIS.md
- descobri que posso trabalhar com agentes em paralelo em partes diferentes do proejto ao mesmo tempo, isso estÃ¡ acelerando demais o desenvolvimento.

## 2026-01-11 - Sentinela Base

- Adicionou world: "MAIN" no manifest (acesso ao window)
- Criou WhatsAppInterceptors (encontra mÃ³dulos do WhatsApp)
- Criou DataScraper (escuta eventos)
- Implementou busca inteligente por caracterÃ­sticas
- Implementou objeto N (padrÃ£o referÃªncia)
- Acesso a N.Msg funcionando
- Acesso a N.Contact funcionando
- Acesso a N.Label funcionando
- Acesso a N.Chat funcionando
- ValidaÃ§Ã£o com Zod implementada
- Documentou tudo (SENTINELA_ESTADO_ATUAL.md)
- Criou plano completo (SENTINELA_PLANO_IMPLEMENTACAO.md)
- Commit no git com toda documentaÃ§Ã£o
- Criou aba de testes das funÃ§Ãµes do WhatsApp
- Implementou sistema de testes de mÃ³dulos (module-tester.ts)
- Implementou salvamento de nÃºmero de teste (test-config.ts)
- Criou TestPanel com lista hierÃ¡rquica de 13 nÃ­veis de mÃ³dulos
- Integrou aba "Testes" no painel principal
- Adicionou estilos CSS para aba de testes

## 2024-12-23 - Nascimento do Mettri

- Criou projeto base (TypeScript, Manifest V3)
- Criou painel integrado no WhatsApp
- Criou MessageCapturer (captura mensagens)
- Criou MessageDB (salva no IndexedDB)
- Criou painel com tabs (Dashboard, Copiloto, CRM)

---

**Como usar:** Adicione uma linha aqui toda vez que fizer algo importante. Simples assim.