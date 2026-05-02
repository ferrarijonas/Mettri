# Aplicar guardrails da vitrine (`aplicarGuardrailsVitrine`)

Esta ZenSpec define os filtros obrigatórios para impedir recomendações inválidas ou perigosas.

---

## Contrato

### Entrada

- `input`
  - `candidatosPontuados: VitrineItem[]`
  - `catalogoSnapshot: CatalogoSnapshotIA`
  - `promocoesAtivas: PromoSaida`
  - `politicas: object`
  - `instanteIso: string`

### Saída

- `output`
  - `candidatosValidos: VitrineItem[]`
  - `itensBloqueados: Array<{ skuId: string; reason: string }>`

### Erros

- `INVALID_INPUT`

---

## Regras

- **Se** SKU não existir no catálogo ativo **então** bloquear (`SKU_INEXISTENTE`).
- **Se** produto estiver inativo **então** bloquear (`SKU_INATIVO`).
- **Se** política comercial reprovar item **então** bloquear (`POLITICA_COMERCIAL`).
- **Se** item depender de promo vencida **então** remover motivo `PROMO_ATIVA` ou bloquear conforme política.
- **Se** item permanecer válido **então** manter score original.

---

## Invariantes

- Nenhum item inativo pode sair em `candidatosValidos`.
- Nenhum bloqueio pode apagar rastreabilidade (`itensBloqueados` sempre preenchido quando houver corte).

---

## Edge cases

- Catálogo vazio -> todos candidatos bloqueados por `SKU_INEXISTENTE`.
- Promoção sem `validadeFim` -> tratar como válida apenas se política permitir.

---

## Costura pendente

- Falta convenção única de `politicas` compartilhada com atendimento e catálogo.
