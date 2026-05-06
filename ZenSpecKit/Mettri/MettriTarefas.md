# Mettri

## Atendimento Agêntico

- [x] Pedido onde o cliente não cita o que quer, só diz que quer esse, ou responde msg escrita por mim, tem que entender tbm. 
  
  - [ ] Já está implementado e documentado a fucnao de identificar o repply certo, agora tem que implementar pra isso fazer match com produto

- [ ] Regex tem que ser genérico suficiente pra servir q vários todos tipos de negócio, como os grandes fazem isso? 





- [x] Specs da **infraestrutura de llms**, toda criada, vai precisar costurar tudo depois

- [x] Specs e inicio do **catálogo**, funcionado, já oferencendo saídas úteis consumíveis

- [x] Specs e rascunho visual do **campanhas**, ainda em mock

- [x] Specs e rascunho do **vitrine**, oferecendo saídas consumíveis

- [ ] Melhorias no **cliente/cadastro**, ainda não concluídas, mas mto bem definidas

- [x] Criar o **enriquecedor** que é o sistema que vai ouvir as conversas e gerenciar a memória curta e longa de cada cliente.

Tarefas

- [x] Criar a arquitetura do **ouvinte** que vai ouvir as conversas e manipular os dados 

- [ ] Garantir que o cliente esteja sendo encontrado e cadastrado se não tem mach confiável. Já entender se é um novo cliente e comecar a popular o cadastro...
  
  - [x] Conferir estado do cadastro, se está como eu quero
  
  - [ ] Cliente novo já precisa mostrar que é, com sinal explícito e mostrar que já está automaticamente cadastrado agora, que não achou math com nada...
  
  - [ ] Entender quem vai popular o cadastro, se o que vai ser feito na hora, e tem lógica o que vai ser feito depois de pedido pronto

- [ ] Garantir que **catálogo** esteja redondo, ao menos com preco e descricao e cruzamento com o site

### 

### Métricas no retomar

- [ ] Perfeito, está exportando as frases que foram respondidas, estudar agora o próximo passo, o que vamos fazer com isso, se vira post sobre o painel de métricas e seu potencial ou se alimento o retomar...
- [ ] 

---

# Sierra

### Ligar o Sierra ao PaineldeTestes e lancar

- [x] Ok, painel de testes fechado. Agora precisamos ver o que está quebrado e ligar tudo o que precisar ali.

- [x] Comecar pela inicializacao ao bundle, garantir que está funcionando, com 2 fallbacks e que tudo ali é real, assim como o código do Sierra tbm

- [x] Os fallbaks estavam em mock. Vai implementar código real e responder se pode ligar um a um na inicializacão.

- [x] Pedi para implementar as Specs, depois vai fazer em código.

- [x] Ok, agora criando plano para implementar.

- [x] Plano criado, implementando o acesso ao bundle com 3 verificacoes

- [x] Testando o primeiro botão, conectou primeiro, deu erro depois...já mandei debugar.

- [x] Ele entendeu errado. Trancou no primeiro fallback, pedia clik para cair pro segundo. Quero que seja automático.

- [x] Esse projeto está difícil de explicar entender. Ainda não deixou como eu queria, pedi mais uma revisão, vou aguardar pra ver.

- [x] Ok, agora o layout está como eu quero. Vou comecar a corrigir os problemas, por partes, entender pq não estão funcionando os fallbacks. Um por um, de cima pra baixo. Entender tbm a sequencia correta que a coisa funciona até formar o cliente consumível.

- [x] Entendi que no modo que quero desenvolver, que é um modo debug feito pelo sierra, eu posso estar criando um problema no Sierra mesmo. Pela forma que eu quero que ele arranque. Coisas que eu quero pro Painel, na verdade, vão mexer alterar o funcionamento do sierra, e isso tem que ser feito com cuidado...

- [x] Preciso entender se essa caminho de diagnóstico faz parte do pacote ou se fica pra trás...

- [x] Combinei de usar um caminho que se abre a partir de uma flag. Se diagnostic=true, é feito o caminho completo, senão, roda a versão mais rápida/simples

- [x] Ok, crie um plano para executar, agora está executando isso.

- [x] Está implemetado, mas não exportou corretamente erros úteis para conseuigor se corrigir, está fazendo isso agora....

- [x] A ordem está correta agora, mas ficou com muita explicacao. Pode ficar mais simples primeiro, e depois, entender pq nada do kernel de capacidades funciona. E se as ideias que compreendem ele não estão defasadas, antigas....

- [x] Vou pedir pra simplificar e unificar as sanfonas ...

- [ ] Simplifiquei as sanfonas, achou os problemas, unimos o WaEnrich com o KerneldeCapacidades, agora fazendo últimos ajuste na exibicão

- [ ] 

---

# Mettri

## Agente Retomar

- [ ] Frases estranhas, como Frases sem sentido, frases do tipo, sentimos sua falta por aqui, não combinam comigo.

## Retomar

- [ ] Alguns problemas com arquivo upado, e regras de envio, contornado a última que fixa uma data mínima para envio de msgs entre eu e o cliente, pra ele não receber msgs de fluxos difrentes em dias muito próximos...

- [ ] 

## Máquina de estados

- [x] Conceito: Short-term da conversa atual (último pedido, preferências, resumo) e injetar no contexto do prompt junto do RAG.

- [x] Comecar explorar o conceito para ter o que divulgar...

- [x] Chegamos numa ideia de memória de ponto de funil, eu gosto de pensar nisso, talvez o agente sirva aqui para entender o contexto melhor, e marcar o ponto que estamos num conversa....

- [x] Chegamos num ponto muito empolgante, que estou ha anos tentando aplicar, que é onde aquele cliente está no funil. Isso vai ser mto bom de implementar...

- [x] Entendemos que é uma máquina de estados o que vamos fazer aqui, mudando o nome da tarefa.

- [x] Agora vou comecar a desenhar os programas e partes que farão parte dessa etapa.

- [x] Estamos desenhando a engenharia disso, pq na vdd, isso é a arquitetura do nosso chatbot.

- [x] estou desenhando a engenharia e preparando para criar o bot de atendimento..ou entender onde ele se encaixa ali...

- [x] Ele desenhou a primeira spec que já definir tudo, quase como que o gerente completo, mas ela está feia, um pouco confusa. Precisa revisar toda ela direitinho.

- [ ] Tudo definino, especs definidas, vamos comecar a por em prática, o plano está em 
  
  - `ZenSpecKit/Mettri/MettriComercial-tarefas.md`

- [ ] Precisamos garantir que os macths comecem acontecer. 

- [ ] ---

# Post Rag

- [x] Temos os dados, eles são ruins, e agora? 
- [x] Estou tentando descobriar o tamanho do banco exatament
- [x] Tem conteúdo para um primiero post, mostrando dados de quantidade de vetor X conversas, conversas avaliadas, qtd  primeira avalicaoes do juiz, vou refinar mais
- [x] Encontrou onde e como explorar os dados, agora precisamos confirmar esses dados.
- [x] Levantando os dados que preciso enviar pro modelo.
- [x] Precisa dos resultados do experimento com RAG. Não tem nada lá pra exportar isso, vou precisar criar isso...
- [x] Enviei os arquivos pra ele, vou ver se é o que ele precisa ou se precisa de mais.
- [x] Dados prontos, já tenho o que preciso para um primeiro post...
- [x] Estou ajustando a forma que vamos mostrar os gráficos e como vamos relacionar visualmente posts que estão interligados por tema.
- [x] Já defini como costurar um post no outro, agora vou definir os gráficos
- [ ] Já comecei a imagens, precisa comecar os gráficos e depois postar..
- [ ] ---

### Post avaliacao de resposta

- [ ] Implementada métricas simples

- [ ] Implementada salvamento simples de dados

- [ ] Vou deixar parado um pouco para mostrar mais na próxima semana.

---

### Mettri > posts futuros

- Memória de sessão  
  Short-term da conversa atual (último pedido, preferências, resumo) e injetar no contexto do prompt junto do RAG.

- Tool use  
  Fluxo chamando 1–2 ferramentas reais (ex.: API de cardápio/preço) e usando o retorno na resposta.

- Orquestração  
  Supervisor + intent + agentes especializados (vendas, suporte, etc.) quando RAG + avaliação + tools estiverem estáveis.
