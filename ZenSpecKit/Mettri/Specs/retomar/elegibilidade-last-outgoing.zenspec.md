# Retomar — fonte da “última mensagem enviada” para `minDistance`

Contrato para montar o mapa `lastOutgoingByContact` consumido pelo motor em `eligible-contacts-engine` (distância mínima entre mensagens nossas).

## Objetivo

Evitar enviar Retomar “cedo demais” quando o MessageDB não tem histórico capturado ou foi limpo.

## Fontes (por ordem de merge)

1. **MessageDB** — varredura das mensagens guardadas; qualquer outgoing `@c.us`.
2. **`chrome.storage`** — chave `retomarLastOutgoingAt_${accountId}`: mapa `chatId → ISO` atualizado após **cada envio Retomar com sucesso** (espelho na “gaveta”).
3. **WhatsApp Store (fallback)** — só para `chatId` em `lastActivityByChat` que **não** têm entrada após considerar (1) e (2); no máximo **200** chats por carga; usa o modelo `Chat` / coleção de mensagens para achar a última mensagem **fromMe**.

## Regra de merge

Por `chatId`, a data efetiva é o **máximo** (mais recente) entre todas as fontes que tiverem valor válido.

## O que o motor não faz

O motor **não** lê storage nem WA; só recebe o mapa já fundido.

## Relação com o envio (momento T)

O merge acima vale só para **carregar elegíveis**. Na **fila de envio**, a última mensagem nossa para o respiro mínimo vem **somente** do modelo interno do WhatsApp para aquele chat (poka-yoke). Ver `orquestracao-envio-retomar.zenspec.md`.

## Limitações

- Fallback WA depende de APIs internas do cliente Web; falhas são ignoradas por contacto.
- Apenas `chatId` terminados em `@c.us` entram no fallback WA.
- `retomarMeta` nas mensagens do MessageDB serve métricas/export; a regra de `minDistance` não depende só disso.
