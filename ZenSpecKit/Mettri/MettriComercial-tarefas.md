# Mettri — ZenTarefas slice Comercial (WhatsApp)

Planeamento **micro** derivado de [MettriComercial-sensei.md](MettriComercial-sensei.md). O Sensei macro muda pouco; **este ficheiro** é o do dia a dia.

---

## Legenda do slice

O atendente abre o WhatsApp no Mettri. O bloco **Comercial** (abaixo do RAG, na terceira coluna) mostra **onde a conversa está no funil** e um **rascunho** da próxima mensagem. Um botão dispara o `**comercialPipelineOrchestrator`**, que corre a cadeia em ordem Unix; a UI não reinventa o funil. Quando o negócio fecha, `**RegistrarPedido`** grava; **Pagamentos** é outra fila.

```text
UI → comercialPipelineOrchestrator → IdentificarCliente (Perfil opcional embutido) → Produtos → fornecerVitrineParaPipelineComercial (Promo interno) → Venda → ContextoResposta → SugestaoWhatsApp → ecrã
```

---

## Último movimento

ZenSpecs filhas + Interface na spec mãe já criadas em `Specs/atendimento/`. Próximo passo natural: **Fase 1** — casca UI no painel.

---

## Pipeline (onde estamos hoje)

```text
Concept/Spec mãe → ZenSpecs filhas → Sensei Comercial → Código → Testes
```

---

## Agora (Top 10)

- CM-Z0 — ZenSpecs do comercial e orquestrador escritas e costuradas  
  ↳ Pasta `ZenSpecKit/Mettri/Specs/atendimento/*.zenspec.md` + tabela costura em [spec.md](Specs/atendimento/spec.md)
- [>] CM1 — Ver o funil e o rascunho no painel (mesmo com dados mock)  
  ↳ Código UI `comercialAtendimentoPanelBlock` — [spec.md Interface](Specs/atendimento/spec.md) + `src/modules/atendimento/dashboard/atendimento-panel.ts` (layout abaixo do RAG)
- CM2 — Estados vazio / loading / erro visíveis no bloco  
  ↳ Teste ou story mínima de render + mensagens de erro explícitas (critério Interface)
- CM3 — Botão “Gerar rascunho” chama um único orquestrador  
  ↳ Implementar `comercialPipelineOrchestrator` stub — [orquestrar-pipeline-comercial-whatsapp.zenspec.md](Specs/atendimento/orquestrar-pipeline-comercial-whatsapp.zenspec.md)
- CM4 — Funil real: `Venda` atualiza `estadoVenda` e o resumo no ecrã  
  ↳ Código + testes `Venda` — [atualizar-contexto-de-venda.zenspec.md](Specs/atendimento/atualizar-contexto-de-venda.zenspec.md)
- CM5 — Enriquecimento vazio não quebra a cadeia  
  ↳ Teste integração leve: `Produtos` + `fornecerVitrineParaPipelineComercial` (vitrine mínima) até `ContextoResposta` (`cliente` sem `perfilFactual` OK)
- CM6 — LLM devolve texto e preenche o textarea  
  ↳ `SugestaoWhatsApp` — [orquestrar-sugestao-whatsapp.zenspec.md](Specs/atendimento/orquestrar-sugestao-whatsapp.zenspec.md) + deps LLM
- CM7 — Enviar no WhatsApp no modo assistido (igual espírito ao RAG)  
  ↳ Reutilizar padrão `sendMessage` / chat ativo; sem auto-envio sem `PortaoEnvio`
- CM8 — Pedido gravado quando fechado com dados mínimos  
  ↳ `RegistrarPedido` + UI — [registrar-pedido-obrigatorio.zenspec.md](Specs/atendimento/registrar-pedido-obrigatorio.zenspec.md)
- CM9 — Portão de envio automático coberto por teste  
  ↳ Testes `PortaoEnvio` — filha `SugestaoWhatsApp` regras P1–P4

---

## Pausado

---

## Próximo

- CM10 — `Pagamentos` mínimo em paralelo ao fluxo de rascunho  
  ↳ [confirmar-pagamento.zenspec.md](Specs/atendimento/confirmar-pagamento.zenspec.md)
- CM11 — Preencher catálogo real quando existir fonte  
  ↳ [produtos-preco-e-estoque.zenspec.md](Specs/atendimento/produtos-preco-e-estoque.zenspec.md)
- CM12 — Atualizar [MettriComercial-sensei.md](MettriComercial-sensei.md) secção “Estado atual” após cada fase fechada  
  ↳ Registo honesto do slice

---

## Ganchos rápidos (issues)

| Sugestão de título issue                 | Corpo                  |
| ---------------------------------------- | ---------------------- |
| `CM1 — Bloco Comercial no painel (mock)` | Colar linha `↳` de CM1 |

Tags sugeridas: `fase/1`, `tipo/Código`, `slice/comercial`.