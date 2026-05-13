# Importar Clientes (Internacional) — Mettri

Metáfora: o botão **Importar** é um **funil com tradutor**.
Ele recebe arquivos “de toda sorte”, traduz para um formato único e só então salva no `ClientDB`.

## Objetivo (AGORA)
- **Identidade**: telefone(s) e e-mail(s) (quando existirem).
- **Nome**: `fullName` e, quando der com confiança, `firstName/lastName`.
- **Endereço**: `addressFreeform` (texto livre).
- **Não estragar dados**: import preenche vazios por padrão e não sobrescreve dados já editados.

Futuro (não entra no MVP): pedidos (`orders[]`), itens, valores, recorrência.

## Pipeline (como funciona)
1) **Detectar tipo** do arquivo (`csv/tsv/xlsx/json/vcf`).
2) **Parsear para tabela** (headers + linhas).
3) **Prévia** + **Mapeamento** (você diz “essa coluna é telefone”, etc.).
4) Converter para `CanonicalClient` (modelo canônico).
5) **Merge** no `ClientDB` (regras de segurança).

## Modelo canônico (a “língua única”)
Arquivo: `src/modules/clientes/import/canonical.ts`

Campos principais:
- `phones[]`: lista (cada item tem `raw`, e às vezes `digits/e164`).
- `emails[]`
- `fullName`, `firstName`, `lastName`, `nickname`
- `addressFreeform`
- `source` (nome do arquivo + data)
- `confidence` (0..1 por campo)

## Regras de merge (para não destruir cadastro)
Metáfora: dados editados por você são **caneta**, dados automáticos são **lápis**.

- **Padrão**: **não sobrescreve** campos já preenchidos.
- Telefones e e-mails: **união** (acumula, não apaga).
- Endereço: salva como **texto livre** (`addressFreeform`).

Código: `src/modules/clientes/import/merge-into-clientdb.ts`

## Formatos suportados
- **CSV/TSV**: suportado agora (com detecção de separador e aspas).
- **XLSX**: opcional. No MVP, se não houver parser disponível, o sistema pede para exportar como CSV/TSV.
  - Metáfora: XLSX é uma “caixa fechada”; CSV é “papel aberto”.
- **JSON/VCF**: esqueleto preparado, expansão futura.

## IA / MCP (futuro-proof)
Metáfora: a IA é um **professor de tradução**, não o “piloto automático”.

Uso recomendado:
- IA sugere **mapeamento** (qual coluna vira qual campo).
- Sempre mostrar **prévia** e deixar você confirmar.
- Quando confiança for baixa: **não importar automático**.

Config (atual):
- A UI tenta MCP se `chrome.storage.local.mettri_import_mcp_enabled === true`.
- Implementação MCP hoje é um **stub** (ponto de encaixe), em:
  - `src/modules/clientes/import/mapping-suggester.ts`

Privacidade:
- Preferência: enviar só **headers + ~20 linhas de amostra** (não o arquivo inteiro).

## Perfis de importação (para não mapear toda vez)
Metáfora: “lembrar a receita” do mesmo tipo de planilha.

- O Mettri salva um `ImportProfile` por “assinatura” do cabeçalho.
- Chave: `mettri_import_profile_v1_<headersSignature>` em `chrome.storage.local`.

