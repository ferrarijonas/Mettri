# Zen Spec Kit

Especificações claras, sem ambiguidade. Spec diz **o quê**; plano e código dizem **como**.

---

## Objetivo

Produzir specs:

- **Determinísticas** — Se X → Y. Sem “talvez”, “melhor”, “adequado”.

- **Auditáveis** — Rastreável de regra a comportamento.

- **Testáveis** — Critérios objetivos.

- **Compatíveis com IA e com equipes** — Formato que qualquer um (ou qualquer modelo) consiga seguir.

---

## Fonte da Verdade

Esta spec é a única fonte válida de comportamento do sistema.

Código, testes e validações devem ser derivados exclusivamente dela.

Se houver divergência entre código e spec, a spec prevalece.

Nada fora desta spec define comportamento.

Alterações no sistema exigem alteração prévia na spec.

---

## Princípios

- **O que está na spec é o sistema. O que não está, não existe.** Comportamento não especificado não é lacuna — é ausência de requisito. Especifique ou não acontece.

- **Duas linhas por explicação.** Se precisar de mais, a regra ou o conceito ainda não está claro o suficiente.

- **Spec ≠ Plano ≠ Código.** Não misturar requisito com arquitetura ou implementação.

- Cada programa do pipeline deve poder ser implementado isoladamente apenas com sua seção. Nenhuma dependência implícita fora do contrato.

- **Ontologia de atores:** Todo sujeito ativo no texto (“X lê”, “X decide”, “X chama”, “X orquestra”) deve ser exatamente um destes:
  
  - um programa do pipeline com seção de Lógica e Contrato,
  
  - uma Interface declarada,
  
  - um sistema externo listado como dependência.  
    Se não se encaixar nessas categorias, esse ator não existe na spec.

- **Programa simples vs. orquestrador:**
  
  - Programa simples: transforma entradas em saídas sem chamar outros programas do pipeline.
  
  - Orquestrador: compõe outros programas, decide ordem, repetição ou tratamento de erro.  
    Ambos são programas de primeira classe: têm nome em `código`, seção de Lógica e Contrato e aparecem no fluxo. Não existe orquestrador implícito.

- **Um comportamento = uma regra ou um estado.** Nada de "o sistema às vezes faz X" sem estar na spec.

- **Um programa, uma razão para mudar.** Cada programa do pipeline muda por um único motivo de negócio — não por dois atores diferentes.

- **Só o necessário.** Não especificar o que não for necessário para contrato, teste ou decisão.

- **Legível sozinha.** A spec deve ser compreensível por quem não participou das discussões orais do projeto.

- **Proibições:** Não inventar regras. Não aceitar ambiguidade. Não deixar comportamento silencioso.

- **Dados antes de dependências.** Nos contratos, parâmetros de dados vêm primeiro; dependências externas (bridge, banco, índices) aparecem depois e agrupadas em um único parâmetro.

---

## Formato Zen

### Estrutura:

Seções: Conceito, Interface (se houver UI), Lógica, `[Nome da feature] com subseções. Sem numeração fixa.

### Intenção por feature:

Antes de qualquer seção de feature, uma linha:

Esta feature existe para que [quem] consiga [fazer o quê] sem precisar de [o quê].

### Pipeline & fluxos:

**1. Linha do fluxo (visão geral):**

```
origem  →  etapa1  →  etapa2  →  destino
```

**2. Tabela imediata abaixo:**

| Programa | Recebe  | Faz       | Manda para   |
| -------- | ------- | --------- | ------------ |
| `nome`   | entrada | o que faz | próximo ou — |

**3. Ao detalhar a Lógica de um programa**, repetir a linha do fluxo só para ele:

```
anterior  →  este_programa  →  próximo
```

Assim não se perde onde o programa está no pipe

### Contratos

Sempre que houver contrato (serviço, motor, API): entradas e saídas explícitas.

Para cada programa do pipeline, a seção deve conter obrigatoriamente:

#### Contrato

Entrada:

- campo: tipo

- campo: tipo

Saída:

- campo: tipo

- campo: tipo

Erros:

- código → condição

Nenhum comportamento pode existir fora do contrato declarado.

- **Assinatura única.** A ordem e o nome dos parâmetros definidos na spec devem ser iguais à assinatura das funções no código e nos testes.

### Nomes de programas

Programas do pipeline aparecem sempre em `código` — em tabelas, fluxos e texto. Consistente, sem variação.

### Histórico de decisão

Regras que já foram contestadas ou substituídas carregam uma linha:

Esta regra substitui `X` porque `Y`.

**Um programa, uma responsabilidade :** Cada programa do pipeline faz uma coisa; nomes e contratos permitem composição — trocar um programa não exige reescrever o resto da spec.

---

#### Antes de gerar (Clarificação)

Identificar antes de escrever:

- Termos vagos ou com dois sentidos possíveis.

- Comportamentos esperados não descritos.

- Dependências externas não especificadas.

- Atores implícitos

Se o comportamento não pode ser determinado → perguntar. Se pode ser especificado agora → especificar.

---

## Depois de gerar (Integridade)

- Toda regra está na forma "Se X → Y"?

- Nenhuma regra implícita fora do texto?

- Nenhum comportamento silencioso (sem regra correspondente)?

- Nenhum conflito entre regras ou seções?

- Toda entrada tem saída rastreável?

- Nenhuma mistura de spec com implementação?

- Todo sujeito ativo no texto existe como programa, Interface ou sistema externo declarado?

- Existe algum ator citado que não possui seção própria ou não aparece no fluxo?

- Para cada fluxo `origem → ... → destino`, está claro quem recebe o gatilho externo e quem devolve o resultado final?

- Todo programa com seção de Lógica tem seção de Contrato e linha de fluxo `anterior → este → próximo`?

- Todo programa aparece como `código` em tabelas, fluxos e texto?

- A spec é compreensível sem conhecimento oral do projeto?

- O escopo fora da spec está explicitado?

- qualquer pessoa que não participou das discussões consegue derivar um caso de teste para cada regra sem fazer perguntas.

- Para cada programa do pipeline, existe teste chamando a função com a mesma assinatura (parâmetros e ordem) descrita na spec?
