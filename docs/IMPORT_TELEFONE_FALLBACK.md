# Import: Telefone com fallback (múltiplas colunas)

## Problema identificado

Arquivo `Lista-Clientes 30-01-26 2052.xlsx` (2878 linhas):
- **Celular** preenchido em apenas 44 linhas
- **Fone Principal** preenchido em 2817 linhas
- 2774 linhas tinham só Fone Principal (Celular vazio)

O mapeamento usado apenas "Celular" → 44 importados, ~2800 pulados.

## Solução

Suporte a **Telefone 2 (fallback)**:
- Novo campo opcional no wizard
- Ordem: usa Telefone, se vazio usa Telefone 2
- Inferência automática: sugere Fone Principal + Celular (ou similar)

### Padrão internacional (E.164)

- Máx 15 dígitos, só números
- `digitsOnly` extrai dígitos de qualquer formato
- `normalizePhoneDigitsWithAliases` gera variantes BR (55, DDD, com/sem 9)

## Uso

1. Importar → selecionar arquivo
2. Mapear **Telefone** → coluna principal (ex.: Fone Principal)
3. Mapear **Telefone 2 (fallback)** → coluna alternativa (ex.: Celular)
4. O sistema usa a primeira não vazia

## Sinônimos adicionados

Para inferência: `fone`, `fone principal`, `telefone principal`.
