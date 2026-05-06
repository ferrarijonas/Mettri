# Catálogo no Mettri

Esta feature existe para que o operador mantenha uma lista simples de produtos disponíveis e para que os agentes consumam essa lista sem inventar preço, estoque ou disponibilidade.

---

## Conceito

`catalogo` é o domínio que guarda os produtos válidos da conta no Mettri.  
Ele nasce no painel (menu próprio) e vira fonte de verdade para os fluxos de agente.

Metáfora: o catálogo é a "prateleira oficial da loja"; agente não pega produto fora da prateleira.

Panorama comercial relacionado: [../atendimento/spec.md](../atendimento/spec.md).

---

## Lógica

### Pipeline & fluxos

```
UI (menu Catálogo)  →  catalogoPanelOrchestrator  →  operações de catálogo  →  CatalogoDB  →  fornecerCatalogoParaAgentes
```

| Programa                                | Recebe                                        | Faz                                                | Manda para                                                                                   |
| --------------------------------------- | --------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `catalogoPanelOrchestrator`             | intenção de UI, `accountId`, payload opcional | valida comando e roteia para operação de domínio   | `listarProdutosCatalogo` / `salvarProdutoCatalogo` / `alterarDisponibilidadeProdutoCatalogo` / `sincronizarCatalogoComSite` |
| `listarProdutosCatalogo`                | `accountId`, filtro opcional                  | lê produtos da conta ordenados                     | UI                                                                                           |
| `salvarProdutoCatalogo`                 | `ProductInput`                                | cria ou atualiza produto com validações            | `CatalogoDB`                                                                                 |
| `alterarDisponibilidadeProdutoCatalogo` | `productId`, `ativo`                          | altera disponibilidade sem apagar Histórico lógico | `CatalogoDB`                                                                                 |
| `sincronizarCatalogoComSite`           | `accountId`, `sourceUrl`                     | raspa site e sincroniza ativo + preço     | `CatalogoDB`                                                                                 |
| `menuScraper`                         | `url`                                           | detecta plataforma + extrai produtos              | `sincronizarCatalogoComSite`                                                                  |
| `fornecerCatalogoParaAgentes`           | `accountId`                                   | devolve snapshot IA-friendly dos produtos ativos   | `Produtos` (pipeline comercial)                                                              |

### Modelo canônico

`CatalogProduct`:

- `productId: string`
- `accountId: string`
- `sku: string`
- `nome: string`
- `descricao: string | null`
- `precoCentavos: number`
- `estoqueDisponivel: number | null`
- `ativo: boolean`
- `updatedAt: string` (ISO)
- `version: number`

### Regras globais

- **Se** `ativo = false` **então** o produto não pode aparecer no snapshot de agentes.
- **Se** `precoCentavos < 0` **então** rejeitar operação com erro explícito.
- **Se** `nome` ou `sku` vier vazio após `trim` **então** rejeitar operação com erro explícito.
- **Se** `productId` existir para a conta **então** `salvarProdutoCatalogo` atualiza; **se não** existir, cria.
- **Se** um agente pedir catálogo e não houver produtos ativos **então** retornar lista vazia determinística (`[]`), sem erro silencioso.
- **Se** `estoqueDisponivel = null` **então** interpretar como "estoque não controlado" (produto ainda pode ser ofertado).

### Contrato IA-friendly (obrigatório)

Todo programa desta pasta deve:

- ter entrada e saída explícitas no contrato da ZenSpec filha;
- usar nomes estáveis de campos (sem aliases dinâmicos);
- falhar com código de erro explícito (ex.: `INVALID_INPUT`, `NOT_FOUND`);
- produzir payload serializável em JSON simples (sem classe ou método).

### Edge cases (Se X -> Y)

- Produto duplicado por `sku` na mesma conta -> rejeitar com `DUPLICATE_SKU`.
- `estoqueDisponivel` negativo -> rejeitar com `INVALID_STOCK`.
- Conta sem catálogo inicial -> listar retorna `[]`.
- Produto desativado e reativado -> mantém `productId`, incrementa `version`.
- Produto com `ativo = false` -> some da visão de agentes e não entra em `CatalogoSnapshotIA`.

### Critérios de aceitação

- Operador consegue criar produto, ver na lista e desativar sem remover fisicamente o registro.
- Snapshot de agentes retorna apenas produtos `ativos` da conta.
- Com mesma entrada e mesmo estado, a saída de cada programa é idêntica entre execuções.

### Escopo fora

- Sincronização com ERP externo.
- Regras fiscais e tributárias.
- Sugestão automática de preço por IA.
- Controle de permissões por dono/role do catálogo (planejado para fase futura).

---

## Interface (painel Mettri)

### Hierarquia visual

1. Menu lateral: item `Catálogo`.
2. Card principal: "Produtos".
3. Tabela simples: Nome, SKU, Preço, Estoque, Status.
4. Ações: `Novo produto`, `Editar`, `Ativar/Desativar`.

### Estados visuais

- Carregando: tabela com skeleton simples.
- Vazio: "Nenhum produto cadastrado."
- Erro: banner curto com ação de tentar novamente.

### Interações

- `Novo produto` abre formulário mínimo (`nome`, `sku`, `preço`; estoque opcional).
- `Salvar` dispara `catalogoPanelOrchestrator`.
- `Ativar/Desativar` dispara `alterarDisponibilidadeProdutoCatalogo`.
- `URL do cardápio` salva a URL do site de cardápio na conta (`command = "SAVE_URL"`).
- `Sincronizar com site` dispara `sincronizarCatalogoComSite` (`command = "SYNC_FROM_SITE"`).

### ZenSpecs filhas (`Specs/catalogo/`)

| Ficheiro                                                                                                       | Programa                                |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| [orquestrar-catalogo-no-painel.zenspec.md](orquestrar-catalogo-no-painel.zenspec.md)                           | `catalogoPanelOrchestrator`             |
| [listar-produtos-do-catalogo.zenspec.md](listar-produtos-do-catalogo.zenspec.md)                               | `listarProdutosCatalogo`                |
| [salvar-produto-do-catalogo.zenspec.md](salvar-produto-do-catalogo.zenspec.md)                                 | `salvarProdutoCatalogo`                 |
| [alterar-disponibilidade-de-produto.zenspec.md](alterar-disponibilidade-de-produto.zenspec.md)                 | `alterarDisponibilidadeProdutoCatalogo` |
| [fornecer-snapshot-de-catalogo-para-agentes.zenspec.md](fornecer-snapshot-de-catalogo-para-agentes.zenspec.md) | `fornecerCatalogoParaAgentes`           |
| [carregar-seed-inicial-do-catalogo.zenspec.md](carregar-seed-inicial-do-catalogo.zenspec.md)                   | `carregarSeedInicialCatalogo`           |
| [sincronizar-catalogo-com-site.zenspec.md](sincronizar-catalogo-com-site.zenspec.md)                     | `sincronizarCatalogoComSite`           |
| [scraper-menu-generico.zenspec.md](scraper-menu-generico.zenspec.md)                        | `menuScraper`               |
