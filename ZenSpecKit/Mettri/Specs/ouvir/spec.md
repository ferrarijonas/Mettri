# Ouvinte

Esta feature existe para que o Mettri consiga **atualizar o perfil operacional do cliente** a partir do que ele escreve no WhatsApp, sem depender só de cadastro manual — usando um pipeline de programas encadeados.

---

## Conceito

**Ouvinte** é a escuta passiva: quando chega mensagem **do cliente**, o orquestrador `ouvinte` identifica o cliente, aplica regras de frequência e de “já processei isto”, extrai sinais do texto, valida contra catálogo quando couber, trata mudança de ideia (release) e decide **o que** persistir no perfil.

Quem **persiste** é o programa de cadastro `atualizar-perfil-operacional-cliente`; quem **mostra** na UI usa a ficha/atendimento. O detalhe de cada etapa fica nas ZenSpecs filhas, não neste arquivo.

---

## Lógica

### Pipeline (visão geral)

```
mensagem (cliente)  →  `ouvinte`  →  `ouvinte-llm` (1 chamada DeepSeek)  →  `atualizar-perfil-operacional-cliente`
```

| Programa                               | Recebe                                                          | Faz                                                                                       | Manda para                             |
| -------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------- |
| `ouvinte`                              | dados da mensagem + contexto mínimo (chat, tempo, turno, autor) | Identifica cliente; throttle e cursor; carrega profile + catálogo; chama ouvinte-llm      | `ouvinte-llm` ou fim com motivo de pulo |
| `ouvinte-llm`                          | mensagem + catálogo candidatos + profile atual (delta)          | 1 chamada DeepSeek → JSON com só o que mudou                                             | `atualizar-perfil-operacional-cliente` |
| `atualizar-perfil-operacional-cliente` | sinais extraídos + `chatId`                                     | Merge e gravação no perfil (cadastro)                                                     | —                                      |

> ⚠️ Os programas `extrator`, `resolver-referencia-ambigua`, `sinais-release` e `decisor-update` foram substituídos pelo `ouvinte-llm` e não são mais chamados pelo pipeline. O código-fonte foi preservado como legado em `src/modules/ouvir/`. Suas ZenSpecs permanecem para referência histórica.

**Precondição:** MessageDB / identificação de cliente e stores usados pelo cadastro estão disponíveis conforme as specs de **atendimento** e **cadastro**. Se identificação falhar, o comportamento está na ZenSpec `ouvinte.zenspec.md` (ex.: buffer/retry).

**Orquestrador:** apenas `ouvinte` compõe os outros programas; não há orquestrador implícito.

### Termos (domínio)

| Termo                 | Significado                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Campo**             | Atributo do perfil (ex.: `preferenciasProduto`, `enderecoEntrega`).                                                         |
| **Confiança**         | `desconhecido` \| `baixa` \| `media` \| `alta` — quanto o sistema confia no valor extraído.                                 |
| **Sinal de release**  | Trecho que indica que um valor anterior deve ser invalidado ou recalculado.                                                 |
| **Cursor / throttle** | Estado por chat para não reprocessar mensagem antiga nem disparar processamento em rajada excessiva (contratos nas filhas). |

### Integração com o restante do Mettri

- **Quem dispara** o pipeline (evento de mensagem, chat ativo, etc.) está em [Specs/atendimento/spec.md](../atendimento/spec.md); esta spec não define UI nem fila de eventos.
- **chatId → clienteId:** programa `identificar-cliente` (atendimento).
- **Persistência e merge de perfil:** [Specs/cadastro/atualizar-perfil-operacional-do-cliente.zenspec.md](../cadastro/atualizar-perfil-operacional-do-cliente.zenspec.md) e `cadastro/spec.md` onde couber `CustomerProfileDB`.
- **Leitura para tela:** ficha/atendimento consome o perfil já persistido.

### ZenSpecs filhas (contrato e regras por programa)

| Arquivo                                                          | Responsabilidade                                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------ |
| [ouvinte.zenspec.md](./ouvinte.zenspec.md)                       | Shell: entrada/saída, throttle, cursor, métricas, delegação, evento. |
| [ouvinte-llm.zenspec.md](./ouvinte-llm.zenspec.md)               | **Extrai sinais via 1 chamada DeepSeek** (substitui extrator + ambiguidade + sinais-release). |
| [extrator.zenspec.md](./extrator.zenspec.md)                     | ⚠️ Legado — extração por regex (substituído pelo ouvinte-llm). |
| [resolver-referencia-ambigua.zenspec.md](./resolver-referencia-ambigua.zenspec.md) | ⚠️ Legado — resolução de referências ambíguas (substituído pelo ouvinte-llm). |
| [validador-catalogo.zenspec.md](./validador-catalogo.zenspec.md) | Validação/normalização contra catálogo.                      |
| [sinais-release.zenspec.md](./sinais-release.zenspec.md)         | ⚠️ Legado — detecção de invalidação (substituído pelo ouvinte-llm). |
| [decisor-update.zenspec.md](./decisor-update.zenspec.md)         | ⚠️ Legado — tipo de update (substituído pelo ouvinte-llm).  |
| [enriquecimento-ao-vivo.zenspec.md](./enriquecimento-ao-vivo.zenspec.md) | UI: atualização ao vivo do painel de perfil.                |

A **fonte da verdade** do contrato de cada programa é a respectiva `.zenspec.md`; este `spec.md` não duplica assinaturas TypeScript.

---

## Escopo fora desta spec de módulo

- Implementação de IndexedDB (nomes de store) — fica na ZenSpec filha ou no código alinhado à filha.
- **Fora do V1 de produto (ideias, não requisito até virar ZenSpec):** FeedbackDB para retreino, consumo explícito pelo MontadorPrompt — podem ser especificados depois em novas filhas ou roadmap.

### Referências cruzadas

- [Specs/cadastro/spec.md](../cadastro/spec.md) — modelo de perfil operacional.
- [Specs/infrastructure-llm/spec.md](../infrastructure-llm/spec.md) — infra de LLM (chamada OpenAI usada pelo extrator).
- [enriquecimento-ao-vivo.zenspec.md](./enriquecimento-ao-vivo.zenspec.md) — UI de atualização ao vivo no painel de atendimento.
