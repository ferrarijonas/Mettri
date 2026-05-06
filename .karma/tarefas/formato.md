# Formato do TAREFAS.md

> O TAREFAS.md é **auto-gerado** pelo Karma na Fase 5. Este arquivo define o formato.
> Fonte: `tarefas/{pendentes,em-andamento,concluidas}/*/SPEC.md`

## Estrutura

```
# Karma

{N} pendentes · {M} concluídas

---

{DOMINIO} · {descrição curta} ({count})
- [ ] `{ID}` {descrição da tarefa}

---

...

Concluídas
- [x] {DOMINIO} — {resumo}
```

## Regras

| Elemento | Formato |
|---|---|
| Domínio | Texto plano (sem negrito, sem heading) |
| Descrição curta | Após `·`, 2-4 palavras |
| Contagem | Entre parênteses, ex: `(7)` |
| Separador | `---` entre domínios |
| Tarefa pendente | `- [ ] \`{ID}\` {descrição}` |
| Tarefa concluída | `- [x] {DOMINIO} — {resumo}` |
| ID da tarefa | Sempre em backtick `` ` `` |

## Exemplo gerado

```
---

RETOMAR · Reativação de clientes (7)
- [ ] `R1` Lista inativos c/ selector
- [ ] `R2` Botão "Gerar msg IA" loading
- [ ] `R3` Botão "Enviar" → WhatsApp

---

Concluídas
- [x] OUVR — spec, código, eventos, sinais, parsing
```
