# Atualizar perfil operacional do cliente (`atualizarPerfilOperacionalCliente`)

Esta feature existe para que o domínio Cadastro grave ou atualize o **perfil operacional inferido** em `CustomerProfileDB`, derivado de fatos observáveis (mensagens agregadas, compras, regras), sem substituir cadastro oficial.

Panorama: [spec.md](spec.md) (secções 19–20). Formato Zen: [ZenSpec.md](../../../ZenSpecKit/ZenSpec.md).

---

## Conceito

Transforma sinais de entrada (ex.: contagens, janela horária, lista de preferências) num `CustomerOperationalProfile` versionado com `confiancaPerfil` e `modelVersion`. Não classifica traços psicológicos sensíveis.

---

## Pipeline & fluxos

```
chatId + sinais + deps  →  atualizarPerfilOperacionalCliente  →  CustomerProfileDB
```

| Programa | Recebe | Faz | Manda para |
| --- | --- | --- | --- |
| `atualizarPerfilOperacionalCliente` | `chatId`, `sinais`, `deps` | merge determinístico e persistência | — |

---

## Lógica

### Linha do fluxo

```
sinais + profileStore  →  atualizarPerfilOperacionalCliente  →  void | erro
```

### Contrato

**Entrada**

- `chatId`: `string`
- `sinais`: `object` — subconjunto factual, ex.:
  - `frequenciaContato7d?: number`
  - `diasDesdeUltimaCompra?: number | null`
  - `compras90d?: number`
  - `proximidadeScore?: number` (`0..1`)
  - `proximidadeBand?: 'frio' | 'morno' | 'quente'`
  - `janelaAtiva?: 'manha' | 'tarde' | 'noite'`
  - `preferenciasProduto?: string[]`
  - `preferenciasLogistica?: string[]`
   - `sensibilidadeOferta?: 'baixa' | 'media' | 'alta'`
   - `segmentos?: string[]` — vocabulário fechado por versão
   - `nomeConfiavel?: string`
   - `cadastroUtil?: boolean`
   - `sugestoesPendentes?: SugestaoProdutoPendente[]` — produtos inferidos por ambiguidade, aguardando confirmação do atendente
   - `lastRecomputeReason?: 'turn_end' | 'purchase_event' | 'scheduled'`
   - `lastRecomputeAtIso?: string`
- `deps`: `{ getByChatId(chatId): Promise<CustomerOperationalProfile | null>; save(profile: CustomerOperationalProfile): Promise<void>; clock: { nowIso(): string } }`

**Saída**

- `ok: true` quando gravação concluir.

**Tipos auxiliares**

```typescript
interface SugestaoProdutoPendente {
  nome: string              // nome do produto (resolvido)
  qtd: number               // quantidade inferida
  nomeExtraido: string      // nome como apareceu na evidência (ex: "abóbora (2x)")
  confianca: 'alta' | 'media' | 'baixa'
  metodo: 'reply' | 'ultimo_produto' | 'llm'
  evidencia: string         // texto que suporta a resolução
  criadoEm: string          // ISO timestamp
}
```

**Erros**

- `INVALID_INPUT` → `chatId` vazio ou `sinais` inconsistente com regras da versão.
- `STORE_ERROR` → falha em leitura/gravação do perfil.

### Regras

- **Se** `chatId` for inválido **então** `INVALID_INPUT`.
- **Se** sinais forem insuficientes **então** persistir perfil mínimo com `confiancaPerfil` baixo (limiar na implementação).
- **Se** `proximidadeScore` vier preenchido **então** deve estar em `[0,1]`; fora disso → `INVALID_INPUT`.
- **Se** `proximidadeBand` vier preenchida **então** usar vocabulário fechado (`frio`, `morno`, `quente`) da versão.
- **Se** atualização vier do fim de turno (`lastRecomputeReason = 'turn_end'`) **então** reavaliar proximidade com base nos sinais atuais sem bloquear o fluxo de atendimento chamador.
- **Se** campo inferido conflitar com dado oficial em `ClientDB` **então** não sobrescrever dado oficial no mesmo registro; perfil operacional pode omitir ou espelhar só o que for compatível (política única).
- **`updatedAtIso`** e **`modelVersion`** devem refletir a versão corrente da regra de cálculo.
- **Merge de listas**: campos do tipo `string[]` (`preferenciasProduto`) fazem **união** com os valores existentes, não substituição. Novos valores são adicionados; duplicatas removidas via `Set`. Isso permite acumular preferências ao longo de múltiplas mensagens na mesma conversa. **Se** o sinal de entrada não contém o campo ou é vazio após normalização **então** mantém os valores existentes.
- **Merge de `sugestoesPendentes`**: substituição completa (não merge). Cada chamada substitui a lista anterior. **Se** o sinal de entrada não contém `sugestoesPendentes` **então** mantém os valores existentes. **Se** contém array vazio **então** limpa as sugestões pendentes. **Se** mesmo produto já existe em `preferenciasProduto` **então** não adicionar à sugestão (produto já confirmado).

### Edge cases (Se X → Y)

- Primeiro perfil para o `chatId` → criar registro novo.
- Falha parcial de cálculo → degradar `confiancaPerfil`, não falhar silenciosamente sem registro quando a versão exigir persistência mínima.
- Mesmo produto aparece em `preferenciasProduto` e `sugestoesPendentes` → `preferenciasProduto` tem prioridade; remover da sugestão pendente.

### Critérios de aceitação

- Perfil persistido é serializável em JSON e reproduzível com mesmos sinais e mesma versão.
- Testes com mock de `deps`.

### Escopo fora

- LLM obrigatório no cálculo.
- Segmentação por categorias sensíveis.
- CRM externo.
