Dada a mensagem, os produtos do catálogo e o perfil já conhecido,
extraia APENAS o que é NOVO ou MUDOU.

O perfil abaixo mostra APENAS campos ainda VAZIOS (não preenchidos).
Extraia esses campos se a mensagem tiver info para preenchê-los.

REGRAS DE CATÁLOGO:
- Produtos SÓ podem vir da lista "catalogo" abaixo
- Se um item mencionado NÃO está na lista, IGNORE completamente
- Se a lista "catalogo" estiver vazia, extraia produtos livremente
- Erro de digitação é aceitável (ex: "brigadeiro" → "Brigadeiro")

CAMPOS:
- nome: extraia se vazio e aparente na msg
- endereco: extraia se vazio e houver indícios
- formaPagamento: extraia se vazio; se preenchido, só se msg mencionar OUTRA forma
- produtos: SEMPRE extraia (append), SÓ da lista do catálogo.
  Retorne o nome EXATO como está no catálogo, não o que o cliente digitou.
  Ex: cliente disse "multigrãos" → catálogo tem "Pão Multigrãos" → retorne "Pão Multigrãos"
- urgencia: SEMPRE extraia (sobrescreve)
  "alta" → hoje/agora/urgente
  "normal" → amanhã/essa semana
  "baixa" → sem prazo mencionado
- aversoes: SÓ extrair se msg tem "sem X", "não gosto de X", "menos X"
- observacoesLogisticas: SÓ extrair se msg tem info de entrega
  (portaria, apto, horário, deixar com, observação)
- retratacoes: se msg contradiz pedido/campo anterior
  (ex: "mudei de ideia", "na verdade...", "quero trocar")
- intencao: classifique a intenção da mensagem. Sempre extraia.
  "compra_nova" → cliente quer comprar (ex: "quero 2 paes", "me ve uma coca")
  "suporte_pos_venda" → cliente tem pedido em andamento e reclama/ajuda (ex: "faltou", "atrasou", "estragado", "trocar")
  "orcamento" → cliente pedindo preço (ex: "quanto é", "qual o valor", "preço")
  "outro" → nenhum dos acima (ex: "obrigado", "ok", "pode deixar")
- respostaSugerida: gere uma confirmação curta se intencao for "compra_nova" e houver produtos extraídos.
  Siga o tom e estilo definidos. Exatamente 1 linha, entre 3 e 24 palavras, sem explicações.
  Se intencao não for "compra_nova", deixe null.

EXEMPLO:
{
  "produtos": [{"nome": "Brigadeiro", "quantidade": 2, "confianca": "alta"}],
  "urgencia": "alta",
  "aversoes": [{"nome": "Coca-Cola", "confianca": "alta"}],
  "retratacoes": ["cancelar pedido anterior"],
  "observacoesLogisticas": ["apto 42, portaria 123"],
  "intencao": "compra_nova",
  "respostaSugerida": "João, 2 brigadeiros saindo do forno agora. R$ 10,00 certinho?"
}

Use EXATAMENTE:
- urgencia (não urgente), valores: "alta" | "normal" | "baixa" | null
- produtos (não produto), cada item: { nome, quantidade, confianca }
- formaPagamento (não metodoPagamento)
- aversoes (não retratacao_aversao), array de { nome, confianca }
- retratacoes: array de strings
- observacoesLogisticas: array de strings
- intencao: "compra_nova" | "suporte_pos_venda" | "orcamento" | "outro"
- respostaSugerida: string | null

Se nada a extrair → {} (objeto vazio).
Só JSON, sem markdown, sem explicações.
