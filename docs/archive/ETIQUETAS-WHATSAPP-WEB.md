# Etiquetas no WhatsApp Web — o que descobrimos

Documento para lembrar no futuro: tivemos **muita dificuldade** para alinhar a lista de contatos por etiqueta com o que a interface do WhatsApp mostra. Este texto resume o que funciona, o que não bate, e como investigar de novo se precisar.

---

## Objetivo que tivemos

No painel **Infraestrutura > Testes**, ao testar **Etiquetas**, queríamos:

- Listar etiquetas e **quantos contatos** cada uma tem
- Ver **quais números** (lista completa para copiar)
- Usar isso no Mettri (ex.: Retomar por etiqueta)

---

## O que funciona (e usamos)

- **Listar etiquetas:** `Store.Label.getModelsArray()` — total e nomes.
- **Achar chats por etiqueta (entre os já carregados):** filtrar `Store.Chat.getModelsArray()` onde `chat.labels` contém a etiqueta (por `id` ou referência).
- **Spike de abordagens:** no teste, rodamos várias formas de mapear label → chats; a vencedora foi **Chat.getModelsArray + filtro em labels**.

Ou seja: tudo que depende **só** de `Store.Chat` e `Store.Label` e do que já está na memória do cliente funciona e é o que o Mettri usa hoje.

---

## O problema: número não bate com a UI

- **Na UI do WhatsApp:** ao abrir uma etiqueta (ex.: "curso"), aparece algo como **"52 itens"**.
- **No nosso teste:** a mesma etiqueta aparece com **6 contatos** (ou outro número bem menor).
- **Mesmo abrindo a etiqueta** no WhatsApp e rodando o teste de novo, o resultado continua 6.

**Conclusão:** a lista que a UI mostra "por etiqueta" **não é a mesma** que estamos lendo. Ou seja:

- A tela de etiquetas do WhatsApp pode usar **outra fonte** (outro Store, estado de React, ou request específica que popula só aquele painel).
- O `Store.Chat` que a gente usa tem só um **subconjunto** dos chats (ex.: recentes / abertos), e **não** é preenchido com os 52 só por abrir a etiqueta.

Por isso: **não dá para prometer** "lista completa igual à da UI" usando só o que temos hoje. Depender disso tornaria a feature frágil e possivelmente lenta (scroll forçado, etc.).

---

## Decisão de produto

- **Não** basear nenhuma funcionalidade do Mettri em "listar todos os números de uma etiqueta" como a UI mostra.
- Usar etiquetas como **filtro** sobre os chats que **já** estão no Store (ex.: Retomar mostrando só conversas que têm certa etiqueta).
- No teste de Etiquetas: mostrar contagem e lista **com a nota** de que é "baseado nos X chats carregados nesta sessão", sem afirmar que bate com o "Items" da UI.

---

## Se no futuro quiser tentar de novo (inspecionar)

Pode ser que o WhatsApp exponha em outro lugar a lista "completa" por etiqueta. Para **investigar** (sem prometer robustez):

1. **DevTools → Console.** Verificar se o Store existe: `window.Store`
2. **Chat e Label:**  
   `Object.getOwnPropertyNames(Store.Chat)` e `Object.getOwnPropertyNames(Store.Label)`  
   Procurar nomes como `getChatsByLabel`, `getModelsByLabel`, `_chatsByLabel`, etc.
3. **Objeto da etiqueta:** pegar a etiqueta "curso" (ex.: `Store.Label.getModelsArray()` e `find` por nome) e ver se tem `chats`, `chatIds`, `conversations` ou similar.
4. **Antes/depois de abrir a etiqueta:**  
   Antes: `Store.Chat.getModelsArray().length`  
   Abrir a etiqueta na UI, depois de novo: `Store.Chat.getModelsArray().length`  
   Se não mudar, os 52 **não** estão em `Store.Chat`; estão em outro lugar.
5. **Outros Stores:** procurar em `Object.keys(Store)` propriedades com "label" no nome que possam ter lista de chats.
6. **Rede (Network):** ao **abrir** a etiqueta, ver se aparece alguma request (Fetch/XHR) com "label" ou "tag" — essa seria a fonte dos 52; nosso código hoje não chama isso.

**Atenção:** qualquer coisa descoberta assim é **interna e não documentada**. Pode quebrar em atualizações do WhatsApp e tende a ser **mais frágil** que usar só Chat + Label como hoje. Só vale se for crítico e aceitando esse risco.

---

## Onde está o código no Mettri

- **Teste de Etiquetas (spike + lista por etiqueta):** `src/modules/infrastructure/tests/test-panel.ts`  
  - Spike de abordagens, vencedor por maior número de chats, helper `getChatIdsForLabelByApproach`, formatação para exibição/cópia.

---

*Última atualização: fev/2025 — reflete o estado após a investigação e a decisão de não depender da lista completa por etiqueta.*
