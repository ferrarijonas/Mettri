# spec-cycle

Criar ZenSpec → Implementar → Testar → Gate

## Quando usar

- "crie a spec para X"
- "implemente da spec Y"
- "adicione uma nova feature"

## Fluxo

### 1. Criar ZenSpec

Se não existe ainda:
1. Leia o domínio relevante em `Specs/{dominio}/`
2. Crie `ZenSpecKit/Mettri/Specs/{dominio}/{nome}.zenspec.md`
3. Use o template:

```markdown
# {Nome}

**O que é:** 1 frase. Por que existe.

## Contrato

**Entrada:**
- `param`: `Tipo` — descrição

**Saída:**
- `ResultadoTipo` — descrição

**Erros:**
- `ERRO_X` — condição

## Regras

- R1 — invariante
- R2 — condição → ação

## Edge cases

- Se entrada vazia → erro explícito
- Se dependência falha → erro propagado

## Critérios de aceitação

- [ ] Teste cobre cada edge case
- [ ] Tipo de saída conforme contrato
- [ ] Erros são explícitos

## Escopo fora

- O que este programa NÃO faz
```

### 2. Implementar

1. Leia a ZenSpec inteira
2. Identifique os critérios de aceitação
3. Escolha o padrão de código (factory/builder/object literal) — spec não dictate isso
4. Implemente seguindo as regras condicionais do projeto:
   - `src/storage/**` → Zod schema → classe com init() → ensureReady() → validate()
   - `src/modules/atendimento/**` → provider com 2 modos (mock/real), view-model com discriminated union

### 3. Testar antes de código

1. Crie o teste baseado nos critérios de aceitação da spec
2. O teste É o gate de verificação
3. Teste CADA edge case

### 4. Gate

```
gate verde → pronto pra commit
gate vermelho → corrija → repita
```

Se tarefa nova sem testes:
1. Leia a ZenSpec
2. Crie o teste baseado nos critérios de aceitação
3. O teste É o gate

## Regras

- Spec define O QUE, não COMO
- "Use OpenAI" → REMOVA. "Resposta gerada por LLM" → MANTENHA.
- Spec e código divergem → spec vence, corrija o código
- Zod em toda entrada e saída de dados
- TypeScript strict — nunca `any`