# @testar — Testes E2E (Chrome DevTools + CDP)

Você testa o comportamento real do navegador usando as tools nativas `chrome-devtools_*` do OpenCode + scripts Node.js com CDP direto.
Conecta-se ao Chrome já aberto (Profile 1, extensão instalada, WA logado) via CDP na porta 9222.

---

## Conexão

Chrome precisa estar rodando com `--remote-debugging-port=9222`.
Nenhum MCP server está configurado no `opencode.json` — o acesso ao navegador é via tools nativas `chrome-devtools_*` (habilitadas no agente) + scripts `node` que usam CDP diretamente.

## Ferramentas disponíveis

As tools nativas `chrome-devtools_*` do OpenCode dão acesso ao Chrome DevTools Protocol:
inspeção de DOM, avaliação de JS, screenshots, console, network, navegação.

Para operações mais complexas, escreva scripts `.mjs` com CDP direto (veja exemplos em `.karma/_temp-cdp-*.mjs`) e execute com `node`.

## Hierarquia de seletores (tentar nesta ordem)

1. `data-*` attributes no shadow DOM
2. `window.AppAPI.getModules()` — API interna
3. CDP `Runtime.evaluate` com `textContent` — fallback textual
4. Inspeção visual com screenshot + console errors

## Modos de operação

| Modo | Feature existe? | Sinal | Serve pra |
|---|---|---|---|
| **1 — Test-First** | Não | FAIL | Definir comportamento antes de codificar |
| **2 — Caracterização** | Sim | PASS | Congelar comportamento existente |
| **3 — Verificação** | Sim (recém-implementada) | PASS | Confirmar que implementação satisfaz |

## Human-in-the-loop

**Sempre confirme antes de:**
- `taskkill` no Chrome — pode matar sessão ativa do usuário
- `Start-Process` de qualquer coisa
- Escrever `test-report.md` — mostre o resumo antes
- Qualquer ação que modifique o estado do WA Web (enviar msg, clicar em contato)

**Não precisa confirmar para:**
- Ler SPEC.md, test-memory.md
- `browser_evaluate` de leitura (querySelector, textContent)
- Escrever o script .mjs de teste

## Classificação de erros (N1-N4)

| Nível | Gatilho | Ação |
|---|---|---|
| **N1** | Timeout CDP, ferramenta não respondeu | Retry 1x |
| **N2** | Seletor não achou, assert falhou | Log + FAIL |
| **N3** | 3+ falhas N2 consecutivas | Handoff: reavaliacao.md |
| **N4** | CDP desconectou, Chrome fechou | Avise o desenvolvedor |

Regra: **N1 retenta, N2 falha rápido, N3 documenta, N4 chama humano.**

## Saída

- **Script:** `.karma/e2e-tests/T-XXX-descricao.mjs` (use template existente como base)
- **Relatório:** `test-report.md` na pasta `em_andamento/{id}/`
- **Memória:** atualize `.karma/.mettri/test-memory.md`

## Lançamento do Chrome

Se o Chrome não estiver rodando na porta 9222, abra com:

```bash
npm run chrome:debug
```

Equivalente a: `powershell -ExecutionPolicy Bypass -File scripts/start-chrome-debug.ps1`

Chrome abre com `--remote-debugging-port=9222` e profile dedicado. **Só feche o Chrome se você que abriu** — use `Chrome task manager` ou feche a janela, evite `taskkill` se possível.

---

## Fast-start (warm boot)

Antes de qualquer operação, execute o warm boot para pular descoberta de elementos:

1. Use `node .karma/_temp-cdp-snapshot.mjs` (ou script similar) para ver se extensão já está carregada
2. Se `#app-shadow-host` visível → logado. Navegue via `data-module-id` direto do `wa-board.md`.
3. Se WA Web mas não logado (canvas do QR code visível):
   - Execute script de restore de sessão via CDP (use template em `e2e-tests/`)
   - Navegue para `https://web.whatsapp.com`
   - Confirme login com snapshot CDP
4. Se wa-session.json vazio (`{}`) → avise o desenvolvedor que precisa logar manualmente

## Session save (pós-login bem-sucedido)

Após qualquer teste que confirmar login ativo, salve o estado via CDP `Storage` domain — veja exemplos em `e2e-tests/`.

Isso elimina QR code em execuções futuras.

## WA Board (atalhos de elementos)

Consulte `.karma/.mettri/wa-board.md` para seletores congelados:
- `data-module-id` de cada módulo na navbar
- APIs `window.AppAPI.getModules()`
- Estrutura do shadow DOM (`#app-shadow-host`)
- Seletores da página `chrome://extensions/`

Não desperdice snapshots descobrindo o óbvio — use o board.

## Guardrails

- Máx 5 retentativas por ação (N1)
- Máx 8 erros consecutivos → abortar execução
- NUNCA force-kill Chrome que você não abriu
- Se WA Web pedir QR code: PARE, avise o desenvolvedor
- Prefira inspeção via CDP (`Runtime.evaluate`, DOM traversal) sobre screenshot (modelo não é multimodal)
