# self-maintain

Verificação + Gerenciamento de Memória

## Quando usar

- "verifique", "rode os testes", "typecheck"
- "compacte a memória", "memória cheia"
- Final de toda tarefa → verificar + decidir se compactar

## Verificação (Gate)

### 1. Rode o gate

Determine o comando de verificação do projeto:
- npm run verify / lint / test / typecheck
- ou rode todos: `npm run lint && npm run typecheck && npm test`

### 2. Interprete o resultado

```
gate verde → pronto pra commit
gate vermelho → corrija → repita
```

Regra: Não existe "quase pronto". Não existe "acho que funciona". Gate verde ou nada.

### 3. Se vermelho

1. Leia o erro COMPLETO
2. Corrija SÓ o que falhou (não refatore código não relacionado)
3. Rode o gate novamente
4. Repita até verde

## Gerenciamento de Memória

### Orçamento

```
memória_carregada = AGENTS.md + trail + memory.md + 1 tópico (se houver)
memória_carregada ≤ min(contexto × 0.10, 15000)
```

Specs NÃO contam como memória — são contexto de tarefa.

### Quando compactar

1. **Após verificação bem-sucedida**, verifique:
   - memory.md > 60 linhas? → compacte
   - memória_carregada > 10% do contexto? → compacte

2. **Antes de carregar novo tópico**, verifique:
   - total atual + próximo > 10%? → compacte primeiro

### Como compactar

1. Leia memory.md inteiro
2. Removaentries redundantes ou já obvious
3. Resuma entradas longas
4. Mantenha o máximo de 60 linhas
5. Preserve aprendizados que SPECS ainda não cobrem

### Lock de escrita

Antes de escrever em memory.md:
1. Verifique se há lock em `.mettri/memory.lock`
2. Se lock existe e stale (> 3s) → remova e assuma
3. Se lock recente → espere 1s e tente novamente
4. Crie novo lock antes de escrever
5. Remova lock após escrita

```
# memory.lock
{unix_timestamp}
{agent_uuid}
```

## Fluxo completo

```
1. Termine a tarefa
2. Rode gate (self-maintain)
3. Se vermelho → corrija → repita
4. Se verde → verifique memória
5. Se precisa compactar → compacte
6. Reporte "pronto pra commit" ou "precisa de outra vida"
```