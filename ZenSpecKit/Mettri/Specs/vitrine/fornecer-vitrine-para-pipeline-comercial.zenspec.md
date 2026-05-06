# Fornecer vitrine para pipeline comercial (`fornecerVitrineParaPipelineComercial`)

Esta ZenSpec define a costura do módulo `vitrine` com o pipeline comercial de atendimento.

---

## Contrato

### Entrada

- `input`
  - `chatId: string`
  - `accountId: string`
  - `instanteIso: string`
  - `turnoContexto: object`
  - `dependencias`
    - `fornecerCatalogoParaAgentes`
    - **`Promo`** — programa [../atendimento/promocoes-do-periodo.zenspec.md](../atendimento/promocoes-do-periodo.zenspec.md) (sub-chamada neste passo, não etapa isolada no orquestrador)
    - `CadastroReadModel` (ou equivalente)
    - `gerarRecomendacoesVitrine`

### Saída

- `output`
  - `vitrine: VitrineSaida` — [spec.md](spec.md) (`recomendacoes`, …).
  - `warnings: string[]`

### Erros

- `INVALID_INPUT`
- `UPSTREAM_ERROR`

---

## Regras

- **Se** `chatId` vazio **então** retornar `INVALID_INPUT`.
- **Se** catálogo falhar **então** propagar `UPSTREAM_ERROR` (sem inventar fallback oculto).
- **Se** sinal promocional interno falhar **então** aplicar fallback explícito (`promocoesAtivas = []`) e registrar warning da fonte.
- **Se** cadastro não fornecer perfil mínimo **então** continuar com contexto neutro e registrar warning.
- **Se** `gerarRecomendacoesVitrine` retornar sucesso **então** anexar `vitrine` ao pacote do pipeline comercial.

---

## Costura explícita no pipeline

Sequência no [orquestrar-pipeline-comercial-whatsapp.zenspec.md](../atendimento/orquestrar-pipeline-comercial-whatsapp.zenspec.md):

```
comercialPipelineOrchestrator
  -> IdentificarCliente   /* opcional Perfil em perfilFactual */
  -> Produtos
  -> fornecerVitrineParaPipelineComercial   /* Promo + gerarRecomendacoesVitrine aqui dentro */
  -> Venda
  -> ContextoResposta
  -> SugestaoWhatsApp
```

---

## Pendências de costura (evolução)

- `cadastro/spec.md` — contrato mínimo oficial de perfil para consumo do comercial (quando integrado a `clienteContexto` em `VitrineEntrada`).
- `Produtos` — campo padronizado de confiança por SKU para score da vitrine ([gerar-recomendacoes-vitrine.zenspec.md](gerar-recomendacoes-vitrine.zenspec.md)).

---

## Critérios de aceitação

- O pipeline recebe `VitrineSaida` estruturada no mesmo ciclo de geração de sugestão; `clienteContexto` na entrada mapeia `ClienteResolvido` (incl. `perfilFactual` quando existir).
- Falhas de dependências são explícitas, sem sucesso silencioso.
- Warnings de contexto parcial são rastreáveis.
