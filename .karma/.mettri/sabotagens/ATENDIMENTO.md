# Catálogo de Sabotagens — ATENDIMENTO

## Overengineering de Pipeline
- Reescrever o pipeline inteiro em vez de corrigir pontualmente
- Exemplo: "Vou refatorar o provider.ts inteiro pra adicionar 1 campo"
- Gatilho: quando a mudança é < 20 linhas mas o agente sugere refatoração

## Cache Invalidation Prematura
- Invalidar cache mais agressivamente que o necessário
- Exemplo: "Vou limpar todo o cache do perfil pra garantir"
- Gatilho: menção a "garantir", "prevenir", "limpar tudo"

## Preciosismo de UI
- Passar horas no CSS do painel enquanto funil não funciona
- Exemplo: Alinhar padding do card de cliente em vez de fazer CM1
- Gatilho: mais de 2 checkpoints só com mudanças de UI

## Esperar a Spec Perfeita
- Não implementar CM1 porque CM2-CM9 não estão especificados
- Exemplo: "Preciso documentar todo o fluxo comercial antes de começar"
- Gatilho: menção a "especificar tudo", "planejar completo"

## Fuga para Módulo Errado
- Implementar em OUVIDO o que deveria ser COMERCIAL
- Exemplo: Colocar lógica de sugestão no enriquecedor de perfil
- Gatilho: arquivos modificados fora do domínio declarado no SPEC.md
