### Checkpoint 2026-05-05T15:49:23Z
heartbeat: 2026-05-05T15:49:23Z — gate: GREEN — tentativa: 1

### Ações
1. `src/storage/order-db.ts` linha 2: Adicionado `import { catalogoDB } from './catalogo-db';`
2. `src/storage/order-db.ts` `addItem()` (linha ~350): Validação de catálogo via `catalogoDB.getBySku()` após check de duplicata, antes do push
3. `src/storage/order-db.ts` `advanceStatus()` (linha ~318): Validação de todos os itens contra catálogo nas transições `lead→draft` e `draft→open`
4. `src/modules/atendimento/dashboard/dashboard-module.ts` linha 14: Adicionado `import { catalogoDB } from '../../../storage/catalogo-db';`
5. `src/modules/atendimento/dashboard/dashboard-module.ts` handler `order:addItem` (linha ~441): Validação de catálogo com `catalogoDB.getBySku()` antes de chamar `orderDB.addItem()`. Exibe `alert()` se produto não encontrado.

### Resultado
- lint: ✓ (0 erros novos nos arquivos modificados. 12 erros pré-existentes em linhas não tocadas)
- typecheck: ✓ (0 erros nos arquivos modificados. 12 erros pré-existentes em outros arquivos)
- build: ✓ (esbuild completou com sucesso)
- test:unit: ✓ (292/292 passando, 0 falhas)

### Aprendizados
- `order-db.ts` já tinha `currentUserWid` como propriedade privada da classe, usado como `this.currentUserWid || 'default'` para o accountId — mesmo padrão usado por `getCurrentUserWid()`.
- `catalogoDB` em `dashboard-module.ts` usa `getCurrentUserWid()` (método público) em vez de acessar `currentUserWid` diretamente — consistente com a API pública do CatalogoDB.
- Mudanças totalizaram ~25 linhas novas — bem abaixo do limite de 50 linhas, sem overengineering.

### Armadilhas
- **Overengineering evitado**: Resistido o impulso de criar uma interface genérica de validação. Apenas chamada `getBySku()` + throw/alert. Suficiente para o contrato.
- **Fuga para módulo errado evitada**: NÃO toquei em `src/modules/ouvir/validador-catalogo.ts`. A validação é do domínio COMERCIAL (pedidos).
- **Genericidade prematura evitada**: Nenhuma abstração criada. Validação pontual em 3 locais, conforme briefing.
