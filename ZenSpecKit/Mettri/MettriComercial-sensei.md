# Mettri — Sensei slice Comercial (WhatsApp)

**Modo de execução:** `UI-first/Vertical slice`

Ordem macro para implementar **Comercial no WhatsApp (funil + estado da conversa)**: painel como peça principal da terceira coluna, orquestrador explícito `comercialPipelineOrchestrator`, cadeia `IdentificarCliente` → `SugestaoWhatsApp`, e gatilhos de `RegistrarPedido` / `Pagamentos` conforme ZenSpecs filhas.

---

## 1. Entradas

| Tipo       | Ficheiro                                                                                              | Papel                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Conceito   | [Specs/atendimento/spec.md](Specs/atendimento/spec.md) + [MettriConceptSpec.md](MettriConceptSpec.md) | Spec mãe do slice + fronteiras Mettri                                                |
| Engenharia | [MettriEngSpec.md](MettriEngSpec.md)                                                                  | Componentes globais (quando conflitar, a ZenSpec do slice prevalece para este fluxo) |
| Stack      | [MettriStackSpec.md](MettriStackSpec.md)                                                              | Pastas, build, testes                                                                |

**ZenSpecs filhas (contrato + ordem):** pasta [Specs/atendimento/](Specs/atendimento/) — ficheiros `*.zenspec.md` do pipeline comercial e orquestrador.

**RAG (consumo):** [Specs/rag/spec.md](Specs/rag/spec.md) — não redefinir; só integrar onde `SugestaoWhatsApp` permitir.

---

## 2. Estado atual do slice

> Regra: cada revisão **acrescenta** ou **corrige** esta secção; não apagar o histórico útil.

| Item                                       | Estado    |
| ------------------------------------------ | --------- |
| Spec mãe Comercial + Interface + costura   | Escrita   |
| 10 ZenSpecs filhas em `Specs/atendimento/` | Escritas  |
| `comercialPipelineOrchestrator` em código  | Por fazer |
| Bloco UI Comercial no `atendimento-panel`  | Por fazer |
| Testes unitários / integração do pipeline  | Por fazer |

---

## 3. Saídas deste Sensei

| Nome           | Ficheiro                                                 | Escala                           |
| -------------- | -------------------------------------------------------- | -------------------------------- |
| Sensei (macro) | [MettriComercial-sensei.md](MettriComercial-sensei.md)   | Fases, componentes, tabela macro |
| ZenTarefas     | [MettriComercial-tarefas.md](MettriComercial-tarefas.md) | Top 10 e fila do dia             |

---

## 4. Componentes-alvo

| Nome                             | Tipo                | Fonte principal                                                                                                          | Depende de                                                   |
| -------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `comercialPipelineOrchestrator`  | Orquestrador        | [orquestrar-pipeline-comercial-whatsapp.zenspec.md](Specs/atendimento/orquestrar-pipeline-comercial-whatsapp.zenspec.md) | `messageDB` (leitura), deps agrupadas                        |
| `IdentificarCliente`             | Componente          | [identificar-cliente.zenspec.md](Specs/atendimento/identificar-cliente.zenspec.md)                                       | `clientDB` / stores                                          |
| `Produtos`                       | Componente          | [produtos-preco-e-estoque.zenspec.md](Specs/atendimento/produtos-preco-e-estoque.zenspec.md)                             | Catálogo opcional                                            |
| `Promo`                          | Sub-programa        | [promocoes-do-periodo.zenspec.md](Specs/atendimento/promocoes-do-periodo.zenspec.md)                                     | Chamado **dentro** de `fornecerVitrineParaPipelineComercial`, não como etapa isolada no orquestrador |
| `Perfil`                         | Sub-programa        | [perfil-factual-do-cliente.zenspec.md](Specs/atendimento/perfil-factual-do-cliente.zenspec.md)                           | Chamado **dentro** de `IdentificarCliente` → `perfilFactual`; não é passo do orquestrador |
| `fornecerVitrineParaPipelineComercial` | Componente   | [Specs/vitrine/fornecer-vitrine-para-pipeline-comercial.zenspec.md](Specs/vitrine/fornecer-vitrine-para-pipeline-comercial.zenspec.md) | Catálogo, `Promo` interno, `ProdutosSaida`, `ClienteResolvido`, `gerarRecomendacoesVitrine` |
| `Venda`                          | Componente          | [atualizar-contexto-de-venda.zenspec.md](Specs/atendimento/atualizar-contexto-de-venda.zenspec.md)                       | Mensagens, `estadoVenda` anterior, `EnriquecimentoComercial` |
| `ContextoResposta`               | Componente          | [preparar-contexto-de-resposta.zenspec.md](Specs/atendimento/preparar-contexto-de-resposta.zenspec.md)                   | `Venda`                                                      |
| `SugestaoWhatsApp`               | Componente + portão | [orquestrar-sugestao-whatsapp.zenspec.md](Specs/atendimento/orquestrar-sugestao-whatsapp.zenspec.md)                     | LLM, RAG opcional, envio                                     |
| `RegistrarPedido`                | Componente          | [registrar-pedido-obrigatorio.zenspec.md](Specs/atendimento/registrar-pedido-obrigatorio.zenspec.md)                     | Persistência pedido                                          |
| `Pagamentos`                     | Componente          | [confirmar-pagamento.zenspec.md](Specs/atendimento/confirmar-pagamento.zenspec.md)                                       | Pedido gravado                                               |
| `comercialAtendimentoPanelBlock` | UI                  | [spec.md — Interface Comercial](Specs/atendimento/spec.md)                                                               | `comercialPipelineOrchestrator`, view-model                  |

---

## 5. Fases (UI-first / vertical slice)

| Fase | Objetivo                                                                   | Critério de pronto                                                                                     |
| ---- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1    | Casca do bloco Comercial na 3.ª coluna + mocks de `estadoVenda` / rascunho | Layout da [Interface](Specs/atendimento/spec.md) navegável; dados marcados como **provisórios**        |
| 2    | `comercialPipelineOrchestrator` mínimo + `Venda` real + espelho na UI      | Um gatilho “Gerar rascunho” corre a cadeia até `ContextoResposta` (LLM mock ou stub) e atualiza o ecrã |
| 3    | `SugestaoWhatsApp` real (LLM) + envio assistido + erros                    | Paridade de espírito com bloco RAG; falhas explícitas na UI                                            |
| 4    | `RegistrarPedido` + testes e2e mínimos + `Pagamentos` opcional             | Pedido persiste quando `pedidoConfirmado` + draft válido; testes verdes nos programas críticos         |

---

## 6. Tarefas macro (por fase)

| ID     | Fase | Tipo   | Tarefa                                                       | Origem              | Saída                                                        | Paralelo? |
| ------ | ---- | ------ | ------------------------------------------------------------ | ------------------- | ------------------------------------------------------------ | --------- |
| CM-Z0  | 0    | Doc    | ZenSpecs filhas comercial + orquestrador + costura           | spec mãe            | `Specs/atendimento/*.zenspec.md`                             | Não       |
| CM-T1  | 1    | Código | Bloco UI `comercialAtendimentoPanelBlock` (casca)            | Interface spec      | `src/modules/atendimento/...` + estilos                      | Não       |
| CM-T2  | 1    | Teste  | Teste de render mínimo do bloco (estados vazio/loading)      | CM-T1               | `tests/...`                                                  | Sim       |
| CM-T3  | 2    | Código | Implementar `comercialPipelineOrchestrator` conforme filha   | CM-Z0               | `src/.../comercial-pipeline.ts` (nome livre alinhado à spec) | Não       |
| CM-T4  | 2    | Código | Implementar `Venda` (`estadoVenda`) + testes unitários       | CM-Z0               | `src/...` + `tests/unit/.../venda.test.ts`                   | Não       |
| CM-T5  | 2    | Código | Ligar orquestrador ao bloco UI (gerar rascunho)              | CM-T1, CM-T3, CM-T4 | fluxo feliz mock LLM                                         | Não       |
| CM-T6  | 3    | Código | `SugestaoWhatsApp` + `PortaoEnvio` + integração RAG opcional | filhas + rag spec   | `src/...`                                                    | Não       |
| CM-T7  | 3    | Teste  | Testes portão (automático recusado / assistido ok)           | CM-T6               | `tests/...`                                                  | Sim       |
| CM-T8  | 4    | Código | `RegistrarPedido` persistência + gatilho desde UI            | filha               | `src/...`                                                    | Não       |
| CM-T9  | 4    | Código | `Pagamentos` paralelo (stub ou real mínimo)                  | filha               | `src/...`                                                    | Sim       |
| CM-T10 | 4    | Teste  | Integração: orquestrador + fecho + persistência              | CM-T3–T9            | `tests/integration/...`                                      | Não       |

**Nota:** CM-Z0 reflete o estado **já concluído** neste repositório; mantém-se na tabela para rastreio e para replanejamentos futuros.

**Trio ZenSpec → Código → Teste:** para cada componente da secção 4, após CM-Z0 as tarefas de código e teste devem citar a filha correspondente na coluna Origem/Saída.

---

## 7. Registro de mudanças

| Data                    | O quê |
| ----------------------- | ----- |
| 2026-04-20              | Pipeline comercial: `Promo` dentro da vitrine; `Perfil` embutido em `IdentificarCliente`; orquestrador `IdentificarCliente → Produtos → fornecerVitrine → Venda → …`; `EnriquecimentoComercial` = `cliente` + `produtos` + `vitrine`. |

---

## 8. Escopo fora deste Sensei

- Slice Retomar (ver [MettriSenseiSpec.md](MettriSenseiSpec.md)).
- Roadmap comercial da empresa (prioridades de negócio).
- Estimativas e alocação de pessoas.
