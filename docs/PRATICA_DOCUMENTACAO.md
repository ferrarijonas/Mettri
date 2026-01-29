# 📝 Prática de Documentação - Como Anotar o Que Fazemos

> Explicação simples de como documentar o que fazemos no projeto.

---

## 🎯 Por Que Documentar?

**Imagine:** Você volta ao projeto depois de 1 mês. Como você vai lembrar o que fez?

**Solução:** Anotar tudo que fazemos em um lugar simples.

---

## 📁 Onde Documentar?

### 1. `HISTORICO_SIMPLES.md` (Este arquivo!)

**Para que serve:** Anotar tudo que foi feito, de forma simples.

**Como usar:**
- Toda vez que fizer algo importante, adicione uma linha
- Uma linha = uma coisa feita
- Poucas palavras, bem simples

**Exemplo:**
```markdown
## 2026-01-11 - Sentinela Base

- Adicionou world: "MAIN" no manifest
- Criou WhatsAppInterceptors
- Acesso a N.Msg funcionando
- Criou aba de testes
```

**Regra:** Simples! Uma linha, poucas palavras.

---

### 2. `CHANGELOG.md` (Mais Detalhado)

**Para que serve:** Versões e mudanças importantes (para releases).

**Quando usar:** Quando fizer algo grande (nova versão, feature importante).

**Exemplo:**
```markdown
## [2.0.1] - 2026-01-11

### Adicionado
- Interceptação Webpack funcionando
- Acesso aos módulos principais
```

---

### 3. `progress.md` (Tarefas)

**Para que serve:** Lista de tarefas e status.

**Quando usar:** Sempre que criar/atualizar tarefas.

**Exemplo:**
```markdown
| T1-001 | Implementar N.Conn | Concluido | - |
```

---

## ✍️ Como Anotar (Passo a Passo)

### Passo 1: Fazer algo importante

Exemplo: "Implementei N.Conn funcionando"

### Passo 2: Abrir `HISTORICO_SIMPLES.md`

### Passo 3: Adicionar uma linha

```markdown
## 2026-01-11 - Sentinela Base

- Adicionou world: "MAIN" no manifest
- Criou WhatsAppInterceptors
- Acesso a N.Msg funcionando
- Implementou N.Conn funcionando  ← NOVA LINHA
```

### Passo 4: Salvar

Pronto! Agora você tem um histórico de tudo que foi feito.

---

## 📋 Exemplos de Como Anotar

### ✅ Bom (Simples)

```markdown
- Criou WhatsAppInterceptors
- Acesso a N.Msg funcionando
- Implementou aba de testes
- Histórico agrupado por contato
```

### ❌ Ruim (Muito Detalhado)

```markdown
- Criou WhatsAppInterceptors.ts na pasta src/infrastructure/ com 850 linhas de código, implementando findExport, find, filter, busca por características, validação com Zod, logs detalhados, etc...
```

**Por quê ruim?** Muito detalhado. Histórico simples deve ser simples!

---

## 🎯 Regra de Ouro

**Uma linha = Uma coisa feita**

**Poucas palavras = Fácil de ler**

**Simples = Funciona sempre**

---

## 📝 Template

```markdown
## YYYY-MM-DD - Nome da Feature

- Fez isso
- Fez aquilo
- Fez mais isso
```

---

**Lembre-se:** Histórico simples é para você lembrar rápido. Não precisa ser perfeito, só precisa existir!
