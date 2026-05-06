---
id: "T-003"
titulo: "Normalizar telefone exibido — sem +55, só dígitos limpos"
dominio: "atendimento"
status: "concluido"
prioridade: 3
dependencias: []
bloqueado_por: []
bloqueia: []
tentativas: 0
max_tentativas: 3
criado_em: "2026-05-05T16:42:00-03:00"
iniciado_em: "2026-05-05T17:30:00-03:00"
concluido_em: "2026-05-05T18:25:00-03:00"
claim: "karma-T003-001"
escopo:
  modulos:
    - src/modules/atendimento/dashboard/client-resolver.ts
    - src/modules/atendimento/dashboard/atendimento-panel.ts
    - src/modules/clientes/directory/directory-panel.ts
  nao_tocar:
    - src/storage/
    - src/modules/rag/
    - src/modules/marketing/
    - src/modules/pedidos/
spec_ref: ""
---

## Propósito

Normalizar os telefones exibidos no painel: remover `+55` e formatação visual (espaços, hífens), mostrando apenas os dígitos limpos e contínuos.

Hoje o telefone aparece como `+55 34 99277-5591`. Deve aparecer como `3499277591`.

## Escopo

**Inclui:**

1. Alterar `formatPhoneLabel()` em `client-resolver.ts` para retornar apenas dígitos limpos, sem DDI `+55`, sem formatação:
   - `+55 34 99277-5591` → `3499277591`
   - `+5534992775591` → `3499277591`
   - `5511999999999` → `11999999999`
   - `+1234567890` → `1234567890` (não BR mantém DDI)
   - Telefone com menos de 10 dígitos → `—` (mantido)

2. Regra de ouro: strip `+55` apenas quando o número começar com `55` (Brasil). Números internacionais mantêm o DDI.

3. Atualizar exibição no `atendimento-panel.ts`:
   - O label do telefone (linha 308) já usa `phoneLabel` do provider, então herda a mudança automaticamente
   - Garantir que o `data-text` do botão copiar também copie o número limpo

4. Atualizar exibição no `directory-panel.ts`:
   - `subtitle` do cliente (linha 207) usa `+${c.phoneDigits}` — remover o `+`

5. Testes unitários para `formatPhoneLabel` com casos: BR com 9 dígitos, BR sem 9 dígitos, internacional, número curto

**Não inclui:**
- Alterar dados persistidos (`phoneDigits`, `clientKey`)
- Alterar `digitsOnly()` ou funções de normalização de storage
- Alterar o `data-text` do botão copiar para algo diferente do exibido (copiar o mesmo valor exibido)
- Alterar labels em logs ou debug

## Sabotagens Herdadas

- **"Isso precisa ser genérico" sem caso concreto** — é uma função de 5 linhas, não precisa de configuração de formato.

- **Perfeccionismo de UI** — é uma string. Trocar o retorno e pronto. Não precisa de componente de formatação.

## Memória Herdada

- `formatPhoneLabel()` em `client-resolver.ts:11-32` atualmente formata como `+55 DDD XXXXX-XXXX`
- `buildPhoneLabel(phoneDigits)` é um wrapper público que chama `formatPhoneLabel`
- `atendimento-panel.ts:307-308` usa `phoneLabel` para exibir e copiar
- `directory-panel.ts:207` exibe `+${c.phoneDigits}`
- `digitsOnly()` em `client-db.ts` já extrai só dígitos

## Critério de Pronto

- [ ] `formatPhoneLabel()` retorna dígitos limpos sem `+55` para números BR
- [ ] Números internacionais mantêm DDI
- [ ] Números com < 10 dígitos retornam `—`
- [ ] `data-text` do botão copiar copia o número limpo
- [ ] Diretório de clientes exibe telefone sem `+`
- [ ] Gate-runner passa (lint → typecheck → build → test:unit)
- [ ] Testes unitários para 4+ casos
