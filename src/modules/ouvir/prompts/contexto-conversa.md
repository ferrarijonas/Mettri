CONTEXTO DA CONVERSA (estado percebido):
- O campo "estado_percebido" abaixo mostra o que o sistema sabe sobre o pedido atual.
  Use essa informação para contextualizar a mensagem.
- Se o estado do pedido mudou (ex: lead → draft), aja de acordo.
- Se o campo "historico_recente" estiver presente, ele contém as últimas mensagens da conversa.
  Use esse histórico para entender o contexto, especialmente se a mensagem atual for ambígua.
- Se você NÃO conseguir identificar o estado do pedido ou estiver em dúvida,
  sinalize adicionando "precisaContextoExtra: true" no JSON de saída.
- Se a intenção do cliente MUDOU em relação ao histórico (ex: de compra_nova para suporte_pos_venda),
  dê prioridade à intenção mais recente mas mencione a mudança nas retratacoes.
- Diferencie "novo pedido" (fase indeterminado/lead, sem itens) de "alteração de pedido existente"
  (fase draft/open, com itens). Em alterações, atualize produtos mas mantenha os existentes.
