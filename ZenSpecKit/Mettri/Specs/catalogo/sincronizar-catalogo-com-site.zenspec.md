---
status: obsoleto
---

# Sincronizar catálogo com site (`sincronizarCatalogoComSite`)

Esta feature existe para que o catálogo Mettri reflita automaticamente a disponibilidade e preços do cardápio online do negócio, mantendo-os sincronizados sem trabalho manual.

---

## Conceito

`sincronizarCatalogoComSite` recebe uma URL de cardápio online, raspa os produtos disponíveis, cruza com o catálogo Mettri e sincroniza os campos `ativo` e `precoCentavos`.

É uma operação idempotente: pode rodar várias vezes sem efeito colateral.

Panorama: [spec.md](spec.md).

---

## Lógica

### Linha do fluxo

```
accountId + sourceUrl  →  sincronizarCatalogoComSite  →  sync result
```

### Contrato

**Entrada**

- `input`: `SyncCatalogInput`
  - `accountId: string`
  - `sourceUrl: string`
- `deps`: `CatalogoSyncDeps`
  - `siteScraper.fetchProducts` (via menuScraper genérico)
  - `catalogoRepository.listByAccount`
  - `catalogoRepository.getBySku`
  - `catalogoRepository.update`
  - `catalogoRepository.create`
  - `clock.nowIso`
  - `normalizeName` (função de normalização de texto)

**Saída**

- `saida`: `SyncCatalogOutput`
  - `activated: number`
  - `deactivated: number`
  - `priceUpdated: number`
  - `created: number`
  - `skipped: number`
  - `errors: string[]`

**Erros**

- `INVALID_INPUT` -> `accountId` ou `sourceUrl` vazio.
- `SCRAPER_ERROR` -> falha ao extrair produtos do site.
- `REPOSITORY_ERROR` -> falha ao acessar catálogo.
- `NO_PRODUCTS_FOUND` -> site não retornou nenhum produto.

### Regras

- **Se** `accountId` ou `sourceUrl` for vazio após trim **então** falhar com `INVALID_INPUT`.
- **Se** o scraper não conseguir extrair produtos **então** falhar com `SCRAPER_ERROR`.
- **Se** a extração retornar lista vazia **então** falhar com `NO_PRODUCTS_FOUND`.
- **Se** os produtos forem extraídos com sucesso **então** continuar com Matching.

### Matching (Regras de cruzamento)

Regra de prioridade para identificar que dois produtos são o mesmo:

1. **Por SKU** (prioridade máxima)
   - Se o produto do site tem SKU e existe no catálogo com mesmo SKU → é o mesmo.
2. **Por nome normalizado fuzzy** (85% de similaridade)
   - Se não tem SKU, compara nomes normalizados.
   - Usa algoritmo Levenshtein ou similar.

**Normalização de nome** (para matching):

- Converte para minúsculas
- Remove acentos (á→a, ã→a, ç→c, etc.)
- Remove texto entre parênteses (ex: "(quarta)" → "")
- Remove dias da semana (segunda, terça, quarta, quinta, sexta, sábado, domingo)
- Remove caracteres especiais não alfanuméricos
- Trim
- Example: "Pão francês (quarta)" → "pao frances"

** Cenário de produto diário:**

- "Pão francês (quarta)" e "Pão francês (quinta)" → ambos mapeiam para base "Pão francês"
- O agente, ao atender, verifica o dia atual e mostra o disponível.

### Sync (Regras de atualização)

Para cada produto do site (existente ou novo):

- **Se** match encontrado **então**:
  - Se `site.disponivel = true` e `catalogo.ativo = false` → Ativar
  - Se `site.disponivel = false` e `catalogo.ativo = true` → Desativar
  - Se `site.preco ≠ catalogo.precoCentavos` → Atualizar precoCentavos
- **Se** não há match **e** `site.disponivel = true` → Criar novo produto no catálogo com:
  - `nome = site.nome`
  - `sku = site.sku || gerar uuid`
  - `precoCentavos = site.preco`
  - `ativo = true`

Para cada produto do catálogo (sem match no site):

- **Se** não existe no site **então** → Desativar (foi removido do cardápio)

### Edge cases (Se X -> Y)

- Site retorna produto com preço = 0 ou null → ignora preço, mantém atual.
- Produto do site sem nome → pula produto, registra em `errors`.
- Matching fuzzy retorna múltiplos candidatos → usa o de maior similaridade.
- Timeout no scraper (30s) → falha com `SCRAPER_ERROR`.
- Catálogo vazio → cria todos os produtos ativos do site.

### Critérios de aceitação

- Sync é idempotente: rodar 2x com mesmos dados não causa duplicação.
- Produtos ativados/desativados mantêm seu `productId` original.
- Novas criações geram SKU único se não informado.
- Erros parciais não interrompem o fluxo completo.
- Após sync, o snapshot de agentes refletirá o estado do site.

### Escopo fora

- Exclusão física de produtos do catálogo.
- Sincronização de estoque (apenas ativo/inativo + preço).
- Integração com ERP externo.

---

## Estratégia de execução

| Tipo | Como ativa | Uso de recursos |
|------|------------|----------------|
| Botão | Operador clica no painel | Manual |
| Cron | Job scheduler (ex: 15min) | Background |
| Quick-sync | Antes de atender mensagem | Tempo real |

**Lógica híbrida:**

1. **Cron (bg):** sync completo a cada X minutos.
2. **Quick-sync:** antes de atender, verifica timestamp do último sync. Se > X min, faz sync rápido.
3. **Botão:** manual, qualquer hora.

---

## Interface (painel Mettri)

### Configuração (uma vez)

- Campo: "URL do cardápio online"
- Botão: "Salvar"
- Armazena em `accountConfig.menuUrl`

### Ação de sync

- Botão: "Sincronizar com site"
- States:
  - Carregando: "Sincronizando..."
  - Sucesso: "✓ 3 ativados, 2 preços atualizados, 1 desativado"
  - Erro: banner curto com mensagem

---

## ZenSpecs relacionadas

| Programa | Relação |
|----------|----------|
| `catalogoPanelOrchestrator` | Adicionar comando `SYNC_FROM_SITE` |
| `listarProdutosCatalogo` | Usado para ler catálogo antes do sync |
| `salvarProdutoCatalogo` | Usado para criar novos produtos |
| `alterarDisponibilidadeProdutoCatalogo` | Usado para ativar/desativar |