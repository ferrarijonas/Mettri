# consumer-bridge

Gateway local **somente-leitura** do banco Firebird do Consumer. Sobe um HTTP
em `127.0.0.1` que executa consultas SQL e devolve JSON. As tools do agente
(`src/modules/harness/tools/consultar-*.ts`) consomem via `bridge.netFetch`.

Por que existe: a extensão roda no navegador e não fala com o Firebird direto.
Este processo local lê o banco (`isql`) e a extensão só faz HTTP.

## Segurança

- Só `SELECT`. Nunca escreve no banco (o desktop usa o mesmo arquivo `.FDB`).
- Bind em `127.0.0.1` e sem CORS. Requisições com `Origin` de página web são
  bloqueadas (403); só a extensão / processos locais passam. Bastante para um
  endpoint local somente-leitura, sem segredo para configurar.
- **Credenciais fora do git**: `config.local.json` (gitignored). Nunca commitar.

## Configurar

1. Copie `config.example.json` para `config.local.json` e preencha
   `db_path` e `password`. Pronto — nada na extensão para configurar.

## Rodar

```bat
python scripts/consumer-bridge/server.py
:: ou, na raiz do repo:
npm run bridge:consumer
```

### Sem dar comando nenhum (autostart)

A extensão **não pode** iniciar processos (nem via HTTP; só Native Messaging,
que exige registro no Windows). O jeito sem comando é subir o bridge sozinho
no logon:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/consumer-bridge/autostart.ps1
```

Cria um atalho em `Startup` apontando pro `pythonw` (sem janela). A partir daí
o bridge sobe a cada logon — nada a fazer. Para remover:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/consumer-bridge/autostart.ps1 -Remove
```

O servidor é idempotente: se a porta já estiver ocupada, sai em silêncio
(não abre dois).

## Rotas

| Rota | Params | Retorno |
|---|---|---|
| `/health` | — | `{ok:true}` |
| `/q/inativos` | `dias`, `limite`, `telefone` | `{clientes:[{nome,telefone,ultimoPedido,diasInativo,ticketMedio}],total}` |
| `/q/estoque` | `periodo` (`hoje`\|`semana`), `busca` | `hoje`: `{hoje:[{nome,estoque}],total}` · `semana`: `{semana:{terca:[...],...},total}` |

Exemplos:
```bat
curl "http://127.0.0.1:8765/q/inativos?dias=30&limite=50"
curl "http://127.0.0.1:8765/q/estoque?periodo=semana"
```

## Estender (mais dados do Firebird)

Adicionar dado novo = uma entrada em `queries.py`:
1. Escreva `sql_<nome>(params)` (só SELECT; valide/converta params aqui).
2. Escreva `transform_<nome>(rows, params)` (rows = lista de dicts, chaves = alias maiúsculo).
3. Registre em `CONSULTAS`.

Depois, uma tool fina em `src/modules/harness/tools/` usando `consultarConsumer('<nome>', {...})`.
Candidatos: `historico_compras` (PEDIDOS+ITENSPEDIDO por contato) e `perfil_cliente` (CONTATOS).
