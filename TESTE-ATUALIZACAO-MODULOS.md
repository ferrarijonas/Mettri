# Como testar se a atualização automática está funcionando

Três jeitos de conferir: **servidor**, **extensão** e **teste de ponta a ponta**.

---

## 1. Testar se o GitHub Pages está servindo (servidor)

Isso confirma que o deploy está ok.

1. No GitHub: **Settings → Pages** do repositório.  
   - Source: **Deploy from a branch**  
   - Branch: **gh-pages**  
   - Salve se ainda não estiver assim.

2. Abra no navegador (troque `mettri4`/`Mettri4` se for seu usuário/repo):
   - **Manifest:**  
     `https://ferrarijonas.github.io/Mettri/manifest.json`  
     → Deve abrir um JSON com `version`, `updatedAt`, `modules` (lista com id, version, url, hash).

3. Pegue uma URL de módulo do próprio manifest (ex.: um `url` de um dos `modules`) e abra no navegador.  
   → Deve abrir um arquivo de **JavaScript** (código do módulo).

**Se os dois abrirem certo:** o servidor (GitHub Pages) está funcionando.

---

## 2. Testar na extensão (verificação e botão)

Isso confirma que a extensão fala com o servidor e mostra o resultado.

1. **Build e carregar a extensão**
   - `npm run build`
   - Chrome: `chrome://extensions` → “Carregar sem compactação” → pasta `dist`.

2. **Abrir o painel**
   - Abra o WhatsApp Web e abra o painel da extensão (Mettri).

3. **Abrir Configurações**
   - Clique no ícone de **engrenagem** (configurações) no painel.

4. **Verificar atualizações**
   - Deixe **“Atualizações automáticas”** ligado.
   - Clique em **“Verificar Atualizações Agora”**.
   - O botão deve mostrar algo como:
     - **“Atualização disponível!”** (verde) se houver versão nova no servidor, ou  
     - **“Nenhuma atualização”** se já estiver em dia.
   - Em **“Informações”** devem aparecer:
     - **Versão atual** (da extensão, ex.: 2.0.1).
     - **Versão módulos** (versão que veio do servidor, depois de verificar).
     - **Última verificação** (ex.: “Agora mesmo” ou “X min atrás”).

5. **Console (opcional)**
   - No WhatsApp Web: **F12** → aba **Console**.
   - Ao clicar em “Verificar Atualizações Agora”, procure mensagens como:
     - `[ModuleUpdater] ...` (ex.: “Verificando atualizações”, “Manifest obtido”, etc.).
   - Se der erro de rede (servidor inacessível), deve aparecer aviso no console.

**Se o botão mudar de texto e as informações de versão/última verificação aparecerem:** a extensão está consultando o servidor e exibindo o resultado.

---

## 3. Teste de ponta a ponta (ver atualização “de verdade”)

Aqui você sobe uma versão nova no GitHub e vê a extensão recebendo.

1. **Versão atual**
   - Anote a **Versão atual** nas Configurações da extensão (ex.: 2.0.1).

2. **Subir uma versão nova no servidor**
   - No `package.json`, aumente a versão (ex.: `2.0.1` → `2.0.2`).
   - Rode:
     - `npm run build:modules`
     - `npm run publish-modules`
   - Faça commit e **push** da pasta `modules-updates` (e do que mais mudou) na branch que dispara o workflow (ex.: `main`).
   - Ou rode o workflow à mão: **Actions → “Deploy modules to GitHub Pages” → Run workflow**.
   - Espere o workflow terminar (alguns segundos).

3. **Conferir o servidor**
   - Abra de novo:  
     `https://ferrarijonas.github.io/Mettri/manifest.json`  
   - O campo `version` deve ser a nova (ex.: 2.0.2).

4. **Na extensão (ainda na versão antiga)**
   - Abra o painel → Configurações.
   - Clique em **“Verificar Atualizações Agora”**.
   - Deve aparecer **“Atualização disponível!”** e **Versão módulos** deve ser a nova (ex.: 2.0.2).
   - A extensão baixa e aplica os módulos novos; na próxima vez que você abrir um módulo atualizado, ele já estará na versão nova (sem precisar reinstalar a extensão).

**Se isso acontecer:** o fluxo “você sobe no git → GitHub Pages → extensão recebe” está funcionando de ponta a ponta.

---

## Resumo rápido

| O que testar | Onde | O que ver |
|--------------|------|-----------|
| Servidor     | Navegador: `.../manifest.json` e uma URL de módulo | JSON do manifest e um .js |
| Extensão     | Painel → Configurações → “Verificar Atualizações Agora” | Botão muda; Versão módulos e Última verificação preenchidos |
| Ponta a ponta | Subir 2.0.2 no GitHub → Verificar na extensão 2.0.1 | “Atualização disponível!” e Versão módulos = 2.0.2 |

Se os três passos derem certo, está funcionando como descrito.
