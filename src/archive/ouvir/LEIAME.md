# Arquivo de referência — código morto do módulo ouvir/

Estes arquivos faziam parte do pipeline regex antigo do ouvinte,
substituído por 1 chamada DeepSeek (T-034). Mantidos para referência.

- extrator.ts — Pipeline regex antigo (55+ regex para extrair nome, endereço, produto, forma de pagamento, urgência, etc.)
- ambiguidade.ts — Resolução de ambiguidade por reply lookup, último produto do atendente, ou LLM (OpenAI)
- sinais-release.ts — Sinais de release para correção de campo ("mudei de ideia", "na verdade...", etc.)
- decisor-update.ts — Decisor de update (decide se campo vai pra memória ou contexto de venda)
- validador-catalogo.ts — Validação de produtos contra catálogo (busca fuzzy). Apenas o type ValidadorDeps sobreviveu.
- prompts-extracao-sistema.md — Versão antiga do prompt de extração (sem respostaSugerida). A versão atual está em src/modules/ouvir/prompts/extracao-sistema.md
