# Retomar — orquestração de envio em massa (motor natural)

Contrato do **pipeline de envio** do painel Retomar: fila, ritmo conservador (não agressivo), e **poka-yoke** contra loop antes de cada disparo.

## Objetivo

- Enviar em massa **sem** rajadas que pareçam bot (atrasos + teto hora/dia).
- **Evitar loop** (mesma pessoa de novo antes do tempo): um cheque imediato no **WhatsApp Web** (modelo interno do chat), não só dados guardados pela extensão.

**Fora deste documento:** motor de elegibilidade da lista; merge MessageDB/storage para **montar** elegíveis (`elegibilidade-last-outgoing.zenspec.md`).

## Programa único (orquestrador)

| Programa | Recebe | Faz | Manda para |
| -------- | ------ | --- | ---------- |
| `retomarSendOrchestrator` (impl.: `RetomarPanel.processQueue`) | Fila de `chatId`, `pendingChamadaIndex`, `RateLimiter`, pausa/teste | Por item: lista bloqueada → **gate** (contador + última nossa **só via WA** + respiro mín.) → limite hora/dia → pausa aleatória opcional → `sendText` → persistências | `sendMessageService`, storage, messageDB |

**Gate** (`verifyRetomarPreSend` + `evaluateRetomarSendGate`): lê **contador** no storage; para `@c.us` obtém **apenas** do Store/modelo WA a data da última mensagem **nossa**; aplica `minDistance` em dias de calendário. Se não conseguir ler no WA → **recusa** (mensagem clara: abrir conversa / tentar de novo).

## Ordem (por item)

1. Lista bloqueada → pular.  
2. Gate recusa → pular.  
3. Rate limit → esperar (não avançar fila).  
4. Pausa aleatória opcional.  
5. Enviar; sucesso → `recordSent` e fluxo atual de contador / espelhos.  
6. Atraso entre mensagens; avançar fila.

Antes de falhar com **"Chat não encontrado"**, o `sendMessageService` pode executar o fallback **`ensureChatLoaded`**: `QueryExist` **opcional** por variante de WID (alias); em seguida **`Chat.find`** + **`Cmd.openChatAt`** + **espera** + **`Chat.get`**, para **materializar** o chat na memória do WA Web.

## Resolução de chat (fallback)

- Aciona quando as **6 estratégias base** de resolução falham.
- Com `QueryExist`: **pula** variantes cujo retorno é `false`.
- Se **todas** as variantes retornam `false` → erro **claro**: o número **não está** no WhatsApp.
- Se `QueryExist` estiver **indisponível** → mesma tentativa de materialização **sem** pré-checagem.
- `resolveChatModelForRetomar` usa o **mesmo caminho** para leituras do **gate** e de **last-outgoing**.
- **Respostas Agênticas** podem chamar `ensureChatLoaded` **antes** de `retomarContextResolver`, para o chat existir no WA (ajuda a **captura**; **não** substitui o MessageDB).

## Rate limiting (implementação)

- Máximo **120** envios por **hora** e **800** por **dia** (ajustável no código; política: conservador sem travar operação pequena/média).
- Entre mensagens: atraso aleatório **2–11 s**.
- A cada **10** envios: chance de pausa longa **10–40 s**.

## Regras puras do gate (`evaluateRetomarSendGate`)

- Índice de ciclo 0–3.
- `contador === 4` → recusar.
- `contador > 0` e índice da fila ≠ contador → recusar (fila desalinhada).
- Com data da última nossa **vinda do WA**: se `daysSince < minDistance` → recusar.

## Modo teste

- Fluxo de teste do painel não usa este gate da mesma forma que produção (comportamento já definido no painel).

## Escopo fora

- WhatsApp Business Platform / Cloud API.

## Implementação de referência

- `src/infrastructure/services/send-message.ts` (`sendMessageService`, `ensureChatLoaded`, `resolveChatModelForRetomar`)
- `src/modules/marketing/retomar/retomar-panel.ts`
- `src/modules/marketing/retomar/rate-limiter.ts`
- `src/modules/marketing/retomar/retomar-send-gate.ts`

## Critérios de aceitação

- Antes de cada envio `@c.us`, leitura no WA; falha de leitura → não envia (poka-yoke).
- Respiro mínimo respeitado com base nessa data.
- Limites hora/dia aplicados com fila longa.
