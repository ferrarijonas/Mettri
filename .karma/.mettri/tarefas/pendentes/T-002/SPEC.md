---
id: "T-002"
titulo: "Normalizar nomes de exibição no painel — apenas primeiro nome, capitalizado"
dominio: "atendimento"
status: "pendente"
prioridade: 3
dependencias: []
bloqueado_por: []
bloqueia: []
tentativas: 0
max_tentativas: 3
criado_em: "2026-05-05T16:25:00-03:00"
escopo:
  modulos:
    - src/modules/atendimento/dashboard/client-resolver.ts
    - src/modules/atendimento/dashboard/provider.ts
    - src/modules/clientes/directory/directory-panel.ts
    - src/modules/clientes/name-likelihood.ts
  nao_tocar:
    - src/storage/
    - src/modules/rag/
    - src/modules/marketing/
    - src/modules/pedidos/
spec_ref: ""
---

## Propósito

Normalizar os nomes de exibição dos clientes em todo o painel Mettri, aplicando duas regras:

1. **Apenas o primeiro nome** — "João Silva" → "João", "Maria Clara de Souza" → "Maria"
2. **Primeira letra maiúscula, resto minúscula** — "joÃO" → "João", "MARIA" → "Maria"

Atualmente o displayName retorna o nome completo (firstName + lastName) sem normalização de capitalização. Nomes vindos do WhatsApp frequentemente chegam em CAIXA ALTA, misturados (JoHoN), ou com formatação inconsistente.

## Escopo

**Inclui:**

1. Criar uma função utilitária `normalizeDisplayName(name: string): string` que:
   - Extrai apenas a primeira palavra do nome
   - Capitaliza: primeira letra maiúscula, demais minúsculas
   - Lida com edge cases: string vazia, nome com apóstrofo (ex: D'Ávila → D'ávila), hífen (ex: João-Lucas)
   - Preserva nomes que são siglas curtas (ex: "BC", "MEI") — manter uppercase se for sigla ≤ 4 chars

2. Aplicar a normalização nos pontos de exibição de nome no painel:
   - **Atendimento Panel**: `this.vm.customer.displayName` no header do cliente (atendimento-panel.ts:279)
   - **Diretório de Clientes**: `displayName()` function (directory-panel.ts:82) — aplicar na renderização
   - **Provider**: no `pickStrongDisplayName()` (client-resolver.ts:34) — normalizar o nome antes de retornar
   - **ViewModel**: campo `displayName` no tipo `AtendimentoViewModel` (view-model.ts:134) — documentar que já vem normalizado

3. Testes unitários para `normalizeDisplayName`

**Não inclui:**
- Alterar os dados persistidos no ClientDB (firstName, lastName, fullName)
- Alterar labels de etiquetas (Retomar, Campanhas)
- Alterar nomes em logs internos ou debug
- Tradução de nomes

## Sabotagens Herdadas

- **Perfeccionismo de UI** — normalizar nome é lógica simples, não precisa de 3 camadas de formatação. Uma função pura de ~10 linhas resolve.

- **"Preciso de mais X antes de testar"** — a função pode ser testada isoladamente em 5 minutos. Teste com cases: MAIÚSCULO, minúsculo, MeZcLaDo, com acento, nome único, string vazia.

- **Ficar no código quando deveria testar** — depois de implementar e buildar, teste visualmente no painel com um nome real do WhatsApp. O gate não pega UI.

## Memória Herdada

- `pickStrongDisplayName()` (client-resolver.ts:34) retorna: `firstName + lastName`, ou `fullName`, ou `nickname`, ou `waName`, ou telefone, ou 'Sem nome'
- `displayName()` no directory-panel.ts:82 retorna: `firstName + lastName`, ou `nickname`, ou telefone, ou 'Sem nome'
- `formatPersonToken()` em name-likelihood.ts:75 já faz `t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()` — função similar existe mas só é usada no classificador de nome
- O ViewModel (view-model.ts:134) declara `displayName: string` sem restrição de formato
- Provider.ts:564 constrói displayName com `waName || pickStrongDisplayName(...)` sem normalização posterior

## Critério de Pronto

- [ ] `normalizeDisplayName()` criada em local adequado (ex: `client-resolver.ts` ou utilitário novo)
- [ ] Função extrai apenas o primeiro nome
- [ ] Função capitaliza corretamente (1ª maiúscula, resto minúscula)
- [ ] Edge cases tratados: string vazia, apóstrofo, hífen, siglas curtas
- [ ] `pickStrongDisplayName()` aplica `normalizeDisplayName()` no retorno
- [ ] `displayName()` no directory-panel.ts usa `normalizeDisplayName()` no retorno
- [ ] Header do cliente no atendimento-panel.ts exibe nome normalizado
- [ ] Gate-runner passa (lint → typecheck → build → test:unit)
- [ ] Testes unitários para `normalizeDisplayName` com 5+ casos
