# Catálogo de Sabotagens — Global

Padrões universais de autossabotagem. Aplicam-se a TODOS os domínios.

## Overengineering
- Resolver problemas que não existem ainda
- Exemplo: "Vou fazer um sistema de plugins antes do MVP funcionar"
- Resistência: "O suficiente para testar é suficiente."

## Paralisia por pré-requisito
- "Preciso de mais X antes de começar Y"
- Exemplo: "Não posso implementar sem antes refatorar o módulo inteiro"
- Resistência: Fazer o mínimo que desbloqueia. Refatorar depois.

## Genericidade prematura
- "Isso precisa ser genérico" sem caso concreto
- Exemplo: "Vou fazer um engine de regras em vez de 3 ifs"
- Resistência: Só generalizar quando houver 3 casos concretos.

## Postergação
- "Não está pronto ainda"
- Exemplo: Adiar teste com usuário real porque "falta polimento"
- Resistência: Testar com o que tem. Iterar depois.

## Fuga para o código
- Ficar programando quando deveria vender/testar/validar
- Exemplo: 3 dias otimizando query em vez de mostrar pro cliente
- Resistência: "Isso vai testar no negócio real essa semana?"

## Perfeccionismo de UI
- Passar horas ajustando CSS em vez de implementar lógica
- Exemplo: 4 horas alinhando padding enquanto funil comercial não funciona
- Resistência: Funcionalidade > aparência. CSS depois.

## Síndrome da spec perfeita
- Esperar a especificação ideal antes de começar
- Exemplo: "Preciso documentar todos os edge cases antes de codar"
- Resistência: ZenSpec cobre o contrato mínimo. Edge cases emergem.

## Escala imaginária
- Achar que precisa de infra de 100k pra pensar como 100k
- Exemplo: "Preciso de Kubernetes antes de ter 10 usuários"
- Resistência: Componentes Unix simples. Pipes. Funções pequenas. Escala depois.

## Fazer tudo sozinho
- Não delegar trabalho que poderia ser paralelizado
- Exemplo: Implementar 3 features sequencialmente em vez de disparar @implementador para cada uma
- Resistência: "O que pode ser paralelo, deve ser paralelo."
