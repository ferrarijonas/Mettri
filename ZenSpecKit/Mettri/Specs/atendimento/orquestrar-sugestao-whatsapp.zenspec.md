---
status: obsoleto
---

# Orquestrar sugestão WhatsApp (`SugestaoWhatsApp` + `PortaoEnvio`)

Esta feature existe para que o painel receba um **rascunho de texto** para a próxima mensagem e, só quando permitido, **dispare envio automático** — com **portão** explícito e sem sucesso parcial silencioso.

---

## Conceito

`SugestaoWhatsApp` consome `LlmTurnPackage`, chama o modelo (e opcionalmente o pipeline RAG da [rag/spec.md](../rag/spec.md)). `PortaoEnvio` é avaliado **só** quando o modo automático está ligado; caso contrário o texto fica só na UI.

Panorama: [spec.md](spec.md) (Comercial + Interface).

---

## Pipeline & fluxos

```
LlmTurnPackage + depsLLM  →  SugestaoWhatsApp  →  RascunhoComercial
```

| Programa | Recebe | Faz | Manda para |
| --- | --- | --- | --- |
| `SugestaoWhatsApp` | `pacote`, `persona`, `depsLLM`, `ragOpcional?`, `modoEnvio` | Gera texto; aplica `PortaoEnvio` se automático | UI / serviço de envio |

---

## Lógica

### Linha do fluxo

```
LlmTurnPackage + modelo  →  SugestaoWhatsApp  →  RascunhoComercial
```

### Contrato

**Entrada**

- `pacote`: `LlmTurnPackage` — [preparar-contexto-de-resposta.zenspec.md](preparar-contexto-de-resposta.zenspec.md)
- `persona`: `string` — bloco fixo de tom.
- `depsLLM`: dependência única agrupada (chamada ao modelo; opcional RAG conforme [rag/spec.md](../rag/spec.md)).
- `ragOpcional`: `boolean | RagContextId` — **(opcional)** quando ausente, só LLM “seco”.
- `modoEnvio`: `{ automatico: boolean; optInUsuario: boolean }`

**Saída**

- `resultado`: `RascunhoComercial`
  - `texto`: `string`
  - `enviadoAutomaticamente`: `boolean` — `true` só se automático passou no portão e envio OK.
  - `portaoMotivo?`: `string` — quando automático falhou ou não aplicável.

**Erros**

- `LLM_ERROR` → falha do modelo ou timeout.
- `RAG_ERROR` → falha quando RAG opcional pedido e indisponível.
- `SEND_DENIED` → portão recusou envio automático.

### Regras — `PortaoEnvio`

- P1 — **Se** `modoEnvio.automatico === false` **então** `enviadoAutomaticamente = false`; não chamar envio automático.
- P2 — **Se** `automatico === true` e `optInUsuario === false` **então** tratar como P1 (falha explícita de configuração ou degradar para assistido — uma política única na implementação).
- P3 — **Se** `automatico === true` e `optInUsuario === true` **então** avaliar portão: `pedidoConfirmado`, dados críticos completos, `flags.produtoBaixaConfianca === false`, limiares adicionais versionados; **se** falhar **então** `SEND_DENIED` com `portaoMotivo` e **não** enviar.
- P4 — **Se** portão OK **então** chamar envio via dependência; **se** envio falhar **então** `LLM_ERROR` ou código `SEND_FAILED` explícito (sem texto “como se tivesse ido”).

### Edge cases (Se X → Y)

- `pacote.flags.produtoBaixaConfianca === true` e automático pedido → `SEND_DENIED` (não auto-enviar afirmação de produto).
- `pacote.tipoConversa === 'duvida'` → `PortaoEnvio` nunca permite envio automático (sempre `SEND_DENIED` com motivo `'DUVIDA_NAO_AUTO_ENVIAVEL'`). Dúvidas requerem resposta humana.
- `pacote.tipoConversa === 'suporte_pos_venda'` → `PortaoEnvio` ajusta threshold de confiança (mais restritivo: requer `confianca === 'alta'` para auto-envio).

### Critérios de aceitação

- Modo assistido nunca define `enviadoAutomaticamente = true`.
- Erros sempre com mensagem utilizável na UI (filha ou mãe Interface).

### Escopo fora

- UI detalhada (ver Interface em [spec.md](spec.md)).
- `RegistrarPedido`.
