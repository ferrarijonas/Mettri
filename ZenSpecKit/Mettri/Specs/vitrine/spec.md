# Vitrine (módulo de recomendação)

---

## Intenção

`vitrine` existe para escolher, de forma explicável e determinística, o que deve ser priorizado para cada cliente e contexto de conversa.

Metáfora: o catálogo é a prateleira oficial; a vitrine é o vendedor da porta escolhendo o que mostrar agora.

---

## Conceito do módulo

- `vitrine` é um motor de decisão, não um motor de escrita.
- Contrato principal: dados estruturados de recomendação.
- Resultado esperado: lista ordenada de itens/ações recomendadas com motivos auditáveis.
- Recomputável por instante: pode mudar ao longo do dia sem alterar verdade canônica.

---

## O que a Vitrine faz (MVP)

1. Monta candidatos elegíveis a partir de catálogo + promoções + contexto.
2. Pontua candidatos com algoritmo simples de pesos.
3. Aplica guardrails (regras obrigatórias de segurança comercial).
4. Ordena e devolve `topN` recomendações com motivo e validade.

---

## O que a Vitrine não faz

- Não altera `estadoVenda`.
- Não grava pedidos.
- Não redefine preço/estoque canônico.
- Não substitui `Produtos` no match do texto do cliente.
- Não gera **texto de campanha** nem **copy** para canais no MVP do painel (só dados estruturados; redação fica para outros programas ou fase futura).
- Não envia mensagem sozinha em nenhum canal.

---

## Algoritmo base (MVP)

`scoreFinal` por candidato:

- `+ pesoAfinidadeCliente`
- `+ pesoPromoAtiva`
- `+ pesoUrgenciaEstoque`
- `+ pesoIntencaoTurno`
- `- pesoRiscoMargem`
- `- pesoSaturacaoExibicao`

Regras do MVP:

- Mesmo input + mesmo estado -> mesma ordem.
- Empate -> desempate determinístico (`score desc`, `skuId asc`).
- Vocabulário de motivos fechado por versão.

---

## Contratos mínimos

### Entrada canônica (`VitrineEntrada`)

- `accountId: string`
- `chatId: string`
- `instanteIso: string`
- `catalogoSnapshot: CatalogoSnapshotIA`
- `promocoesAtivas: PromoSaida`
- `clienteContexto`: dados mínimos de cliente/cadastro para priorização — **pode incluir** (quando o chamador integrar) sinais vindos do domínio Cadastro: cadastro oficial resumido, última compra, **bandas ou scores RFM** (Recência, Frequência, Monetário) e **proximidade** (`proximidadeScore`/`proximidadeBand`) já calculados no perfil operacional, sempre com `confiancaPerfil` quando aplicável. Fonte canónica de cálculo e persistência: [../cadastro/spec.md](../cadastro/spec.md) (§19–20) e leitura agregada [../cadastro/fornecer-ficha-cliente-para-atendimento.zenspec.md](../cadastro/fornecer-ficha-cliente-para-atendimento.zenspec.md). A vitrine **não recalcula** RFM nem proximidade; só consome o que receber em `clienteContexto`.
- `turnoContexto`: intenção factual do turno atual
- `politicas`: regras comerciais declarativas

### Saída canônica (`VitrineSaida`)

- `generatedAtIso: string`
- `recomendacoes: VitrineItem[]`
- `version: string`

`VitrineItem` mínimo:

- `recommendationId: string`
- `skuId: string`
- `acao: 'oferecer_agora' | 'oferecer_combo' | 'oferecer_desconto_leve'`
- `score: number`
- `motivos: VitrineMotivo[]`
- `validUntilIso: string | null`

`VitrineMotivo` inicial:

- `PROMO_ATIVA`
- `ESTOQUE_BAIXO`
- `MATCH_CATEGORIA_CLIENTE`
- `INTENCAO_COMPRA_AGORA`
- `RISCO_MARGEM`
- `SATURACAO_RECENTE`

### Erros mínimos

- `INVALID_INPUT`
- `MISSING_DEPENDENCY`
- `UPSTREAM_ERROR`

---

## Fronteiras e dependências (costura)

| Origem | O que fornece | Status de costura com `vitrine` |
| --- | --- | --- |
| [../catalogo/spec.md](../catalogo/spec.md) | `CatalogoSnapshotIA` e disponibilidade de produto | Parcial: snapshot existe; contrato dedicado de consumo pela vitrine pendente |
| [../atendimento/produtos-preco-e-estoque.zenspec.md](../atendimento/produtos-preco-e-estoque.zenspec.md) | match textual e confiança por SKU | Pendente: falta contrato explícito de troca com vitrine |
| [../atendimento/promocoes-do-periodo.zenspec.md](../atendimento/promocoes-do-periodo.zenspec.md) | lista factual de promoções ativas | Costurado: `Promo` é sub-chamada dentro de `fornecerVitrineParaPipelineComercial` |
| [../cadastro/spec.md](../cadastro/spec.md) | sinais de cliente, histórico de compra, perfil operacional (incl. RFM opcional) | Parcial: recorte mínimo espelhado em `VitrineEntrada.clienteContexto` (ver contrato acima); implementação do `CustomerProfileDB` e preenchimento no pipeline ainda evoluem |
| [../atendimento/orquestrar-pipeline-comercial-whatsapp.zenspec.md](../atendimento/orquestrar-pipeline-comercial-whatsapp.zenspec.md) | orquestração comercial ponta a ponta | Costurado: `fornecerVitrineParaPipelineComercial` após `Produtos`; perfil factual opcional em `IdentificarCliente` |

Regra de verdade:

- Preço e disponibilidade canônica prevalecem sobre qualquer recomendação da vitrine.

---

## Consumidores da saída

- `comercialPipelineOrchestrator` (quando costurado).
- `SugestaoWhatsApp` como contexto estruturado para redação (quando existir; não é obrigação do painel Vitrine gerar texto).
- UI do módulo **Vitrine** (painel) para inspeção das recomendações e dos canais mínimos.
- Integrações externas via o mesmo contrato (`VitrineSaida`), quando houver API dedicada.

---

## Interface (painel Mettri)

Objetivo: o operador **vê** o mesmo ranking e os mesmos motivos, organizados por **canal mínimo** de exibição. O motor continua **um só**; canais são **visões** (filtro de apresentação ou metadados futuros), não motores paralelos.

Metáfora: um **quadro branco** com colunas — em cada coluna você lê os mesmos cartões (SKU, score, motivos), só muda o rótulo do canal.

### Princípios da UI (MVP)

- Mostrar **dados limpos**: `skuId`, nome do produto (do catálogo), `score`, `motivos`, `validUntilIso`, preço/stock de referência quando vierem do snapshot (sem inventar).
- **Sem** geração de texto de Instagram/WhatsApp/site no painel Vitrine nesta fase.
- **Sem** prometer envio automático; botões futuros podem ser “copiar IDs” / “exportar JSON” / “abrir no canal” (fora do escopo até existir integração).

### Canais mínimos (abas ou secções)

| Canal | Função na UI (MVP) |
| --- | --- |
| **WhatsApp** | Lista das recomendações relevantes para conversa 1:1 (pode exigir `chatId` no contexto). |
| **Instagram** | Mesmo ranking; rótulo do canal para o operador alinhar com posts/stories (sem copy gerada). |
| **Site** | Mesmo ranking; visão “homepage / vitrine genérica” quando não houver `chatId`. |
| **Ofertas do site** | Subvisão ou aba: destaca itens com motivo `PROMO_ATIVA` ou equivalente (ainda dados, não texto promocional). |

**Padrão de mercado (referência conceitual):** em omnichannel costuma haver **um catálogo/recomendação central** e **projeções** por canal (formato, slot, audiência). Aqui a projeção no MVP é só **organização na tela**; cadastro de novos canais, regras por canal e “vitrine física” ficam **fora** até haver spec de governança.

### Pendências de produto (explícitas)

- Como **cadastrar** novos canais ou renomear (admin, JSON, tabela): **TBD**.
- **Vitrine física** (loja, QR, display): tratar como canal futuro `CANAL_FISICO` ou módulo à parte; **TBD**.
- Se cada canal terá **pesos** ou **filtros** próprios: **TBD** (hoje assume-se o mesmo `VitrineSaida` para todos).

### Hierarquia visual sugerida

1. Menu lateral: item **Vitrine**.
2. Barra superior: conta, `Atualizar`, opcional `chatId` quando a visão for “por conversa”.
3. Abas: **WhatsApp** | **Instagram** | **Site** | **Ofertas do site**.
4. Corpo: tabela ou cards com colunas mínimas — `rank`, `skuId`, `nome`, `score`, `motivos`, `validUntil`, `precoRef`, `estoqueRef`.
5. Rodapé opcional: `generatedAtIso`, versão do motor, link “ver JSON”.

### Wireframe ASCII (sem copy gerada)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Vitrine   │  Conta: [ … ▼ ]   Chat (opcional): [ … ]   [ Atualizar ]        │
├─────────────────────────────────────────────────────────────────────────────┤
│  [ WhatsApp ] [ Instagram ] [ Site ] [ Ofertas do site ]                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Gerado: 2026-04-20T18:42:00Z   motor: vitrine v1                            │
├────┬──────────┬────────────────────────┬───────┬─────────────────┬──────────┤
│ #  │ skuId    │ nome (catálogo)        │ score │ motivos         │ válido   │
├────┼──────────┼────────────────────────┼───────┼─────────────────┼──────────┤
│ 1  │ PAO-001  │ Pão francês            │ 8.4   │ ESTOQUE_BAIXO…  │ 21:00    │
│ 2  │ CAFE-12  │ Café 250g              │ 7.1   │ PROMO_ATIVA…    │ —        │
└────┴──────────┴────────────────────────┴───────┴─────────────────┴──────────┘
│  [ Ver JSON da saída ]     (sem campo de “texto sugerido” neste MVP)          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Onde isto “entra” na documentação

- A **interface** do módulo fica **nesta spec-mãe** (`Specs/vitrine/spec.md`), como nos outros domínios (ex.: catálogo, atendimento).
- Detalhe fino de componentes (arquivo `.ts`, classes CSS) fica nas **filhas de implementação** ou numa ZenSpec `vitrine-ui-painel.zenspec.md` se precisarem fatiar.

---

## Critérios de aceitação da spec-mãe

- O módulo define contrato mínimo de entrada e saída.
- O módulo define algoritmo base e guardrails de forma explícita.
- O módulo explicita costuras já prontas e pendentes com cadastro/produtos/promo.
- O módulo lista filhas necessárias para implementação incremental.
- O módulo descreve interface mínima do painel (canais + dados limpos, sem copy gerada).

---

## ZenSpecs filhas (`Specs/vitrine/`)

| Ficheiro | Programa |
| --- | --- |
| [gerar-recomendacoes-vitrine.zenspec.md](gerar-recomendacoes-vitrine.zenspec.md) | `gerarRecomendacoesVitrine` |
| [pontuar-candidato-vitrine.zenspec.md](pontuar-candidato-vitrine.zenspec.md) | `pontuarCandidatoVitrine` |
| [aplicar-guardrails-vitrine.zenspec.md](aplicar-guardrails-vitrine.zenspec.md) | `aplicarGuardrailsVitrine` |
| [fornecer-vitrine-para-pipeline-comercial.zenspec.md](fornecer-vitrine-para-pipeline-comercial.zenspec.md) | `fornecerVitrineParaPipelineComercial` |

Filha opcional (quando for implementar a UI): `vitrine-ui-painel.zenspec.md` — detalhe de eventos, estados de carregamento e exportação JSON.

---

## Escopo fora

- Modelos ML avançados (ranking aprendido) no MVP.
- Perfil psicológico/sensível.
- Autonomia de envio sem portão de negócio.
- **Geração de textos** para redes/canais dentro do painel Vitrine (MVP).
- **Cadastro administrável de canais** e **vitrine física** até spec dedicada.

---

## Histórico de decisões (resumo)

- 2026: `vitrine` definida como motor de recomendação estruturado, explicável, com integração progressiva ao pipeline comercial.
