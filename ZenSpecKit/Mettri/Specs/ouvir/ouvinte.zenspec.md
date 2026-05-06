# Ouvinte — Shell

>Programa orquestrador que coordena o fluxo de escuta e enriquecimento.

## 1. Propósito

Programa shell que recebe uma mensagem crua do WhatsApp e orquestra o pipeline de enriquecimento:
1. Identifica o cliente
2. Verifica throttle e cursor
3. Delega para Extrator → Validador → SinaisRelease → DecisorUpdate
4. Persiste via atualizarPerfilOperacionalCliente
5. Emite evento `ouvir:profile-updated` para notificar a UI

## 2. Input / Output

```typescript
// Input: recebe do event bus quando nova mensagem chega
interface OuvinteInput {
  chatId: string
  mensagem: string
  timestamp: number
  turno: number        // 1, 2, 3... (incrementa a cada par cliente+atendente)
  autor: "cliente" | "atendente"
}

// Output: comando para atualizar perfil
interface OuvinteOutput {
  clienteId: string
  atualizacoes: CampoAtualizavel[]
  motivoPulo?: "throttle" | "cursor" | "duplicado" | "mensagem_invalida"
}
```

## 3. Fluxo

```
        ┌─────────────────────────────────────────────────────┐
        │                     OUVINTE                         │
        │                                                     │
        │  1. Valida input (mensagem, autor, chatId)         │
        │  2. Identifica cliente (usa identificar-cliente)  │
        │  3. Verifica throttle                               │
        │  4. Verifica cursor                                 │
         │  5. Chama Extrator                                  │
         │  6. Se extrator não achou produto E msg ambígua:   │
         │     → Chama ResolverReferenciaAmbígua              │
         │  7. Chama ValidadorCatalogo                         │
         │  8. Chama SinaisRelease                             │
         │  9. Chama DecisorUpdate                             │
         │  10. Chama atualizarPerfilOperacionalCliente        │
         │  11. Atualiza cursor                                │
         │  12. Emite 'ouvir:profile-updated'                  │
        └─────────────────────────────────────────────────────┘
```

## 4. Validações de entrada

| Condição | Ação |
|----------|------|
| `autor !== "cliente"` | Pular (só processa mensagens do cliente) |
| `mensagem.length < 3` | Pular (mensagem muito curta) |
| `!chatId` | Erro (chatId obrigatório) |
| Cliente não identificado | Pular, mas registrar em buffer para retry |

## 5. Throttle

Impede processamento excessivo do mesmo cliente em janela curta.

```typescript
interface ThrottleCliente {
  chatId: string
  ultimaInteracao: number
  intervaloMinimo: number  // 5000ms = 5 segundos
  burstCount: number     // contagem em janela de 60s
  maxBurst: number       // 3 mensagens por janela
}
```

**Lógica:**
```
SE (timestamp - ultimaInteracao) < intervaloMinimo
  E burstCount >= maxBurst
  → Pular (agendar retry em intervaloMinimo)
```

## 6. Cursor (deduplicação)

Armazena timestamp da última mensagem processada por cliente.

```typescript
interface CursorCliente {
  chatId: string
  ultimaMensagemProcessada: number   // timestamp
  ultimoTurnoProcessado: number     // turno number — usada para Mutex por turno
  versaoExtrator: string            // "v1.0.0"
}
```

**Lógica:**
```
SE timestamp <= ultimaMensagemProcessada
  → Pular (mensagem já processada)

SE turno === ultimoTurnoProcessado
  → Pular (já processada neste turno — Mutex)
  → Motivo: "duplicado"
```

## 7. Delegação para programas

### 7.1 Extrator
```typescript
// Chama: extrator
// Input: { mensagem, chatId }
// Output: CampoExtraido[]
```

### 7.2 ResolverReferenciaAmbígua

Chamado **apenas quando**:
- `extrator` retornou `preferenciasProduto` vazio (ou só quantidade sem produto)
- Mensagem contém sinais de ambiguidade (quantidade sem nome, pronome, referência vaga)

```typescript
// Chama: resolver-referencia-ambigua
// Input: { mensagem, chatId, msgId, replyToId?, quotedText?, mensagensAnteriores, catalogo }
// Output: ResolverOutput { resolvido, produto?, confianca }
// Se resolvido=true: cria CampoExtraido virtual e injeta no pipeline
// Se resolvido=false: pipeline continua sem preferenciasProduto
```

Ring buffer: o `ouvinte` mantém em memória as últimas 10 mensagens (texto + direção) por `chatId`, atualizado a cada mensagem processada.

### 7.3 ValidadorCatalogo
```typescript
// Chama: validador-catalogo
// Input: { campos: CampoExtraido[] }
// Output: CampoExtraido[] (com confiança ajustada)
```

### 7.3 SinaisRelease
```typescript
// Chama: sinais-release
// Input: { mensagem, camposPerfilAnterior }
// Output: ReleaseSignal[]
```

### 7.4 DecisorUpdate
```typescript
// Chama: decisor-update
// Input: { camposExtraidos, camposPerfilAnterior, urgencia }
// Output: DecisaoUpdate[]
```

## 8. Persistência

Ao final, chama o programa existente:

```typescript
// Chama: atualizar-perfil-operacional-cliente (cadastro/)
// Input: { clienteId, CamposAtualizaveis[] }
```

O programa existente (cadastro/atualizar-perfil-operacional-do-cliente.zenspec.md) é responsável por:
- Verificar se o campo já existe com confiança maior
- Fazer merge dos valores
- Persistir no CustomerProfileDB

## 9. Notificação da UI

Após persistir com sucesso, o Ouvinte emite um evento no EventBus para que a UI reaja:

```typescript
eventBus.emit('ouvir:profile-updated', {
  chatId: string
  camposAtualizados: string[]
  confiancaPerfil: number
})
```

**Se** a persistência falhou **então** não emitir evento (UI não recebe notificação falsa).
**Se** throttle/cursor bloqueou **então** não emitir evento (nada mudou).

O comportamento da UI ao receber este evento está em [enriquecimento-ao-vivo.zenspec.md](./enriquecimento-ao-vivo.zenspec.md).

## 10. Casos de borda

| Cenário | Comportamento |
|--------|---------------|
| Throttle excedido | Agendar retry em 5s, não fazer update agora |
| Cursor indica duplicado | Ignorar silenciosamente |
| Cliente não identificado | Buffer para retry quando identificado |
| Extrator retorna vazio E msg não ambígua | Não fazer update, atualizar cursor |
| Extrator retorna vazio E msg ambígua | Chama ResolverReferenciaAmbígua |
| ResolverReferenciaAmbígua resolveu com alta confiança | Injeta CampoExtraido virtual no pipeline |
| ResolverReferenciaAmbígua não resolveu | Pipeline continua sem preferenciasProduto (comportamento atual) |
| ResolverReferenciaAmbígua usou LLM e bateu teto | Estratégia 3 pula, retorna resolvido: false |
| Validador invalida tudo | Manter campos anteriores |
| Decisor decide não persistir | Atualizar cursor mesmo assim |
| Persistência falhou | Não emitir `ouvir:profile-updated`, log de erro |

## 11. Métricas de rastreamento

| Métrica | Descrição |
|--------|------------|
| `ouvinte.execucoes` | Total de mensagens processadas |
| `ouvinte.pulos.throttle` | Pulados por throttle |
| `ouvinte.pulos.cursor` | Pulados por cursor |
| `ouvinte.atualizacoes` | Total de atualizações realizadas |
| `ouvinte.eventos.emitidos` | Total de `ouvir:profile-updated` emitidos |
| `ouvinte.ambiguidade.tentativas` | Total de tentativas de resolução de ambiguidade |
| `ouvinte.ambiguidade.resolvidos_reply` | Resolvidos via reply lookup |
| `ouvinte.ambiguidade.resolvidos_ultimo_produto` | Resolvidos via último produto do atendente |
| `ouvinte.ambiguidade.resolvidos_llm` | Resolvidos via LLM |
| `ouvinte.ambiguidade.nao_resolvidos` | Não resolvidos (resolvido: false) |
| `ouvinte.erros` | Total de erros |

## 12. Referências

- spec.md (pai): arquitetura geral
- extrator.zenspec.md (extração regex + LLM)
- resolver-referencia-ambigua.zenspec.md (resolução de ambiguidade)
- validador-catalogo.zenspec.md
- sinais-release.zenspec.md
- decisor-update.zenspec.md
- enriquecimento-ao-vivo.zenspec.md (UI ao vivo no Atendimento)
- atualizar-perfil-operacional-do-cliente.zenspec.md (cadastro/)
- identificar-cliente.zenspec.md (atendimento/)