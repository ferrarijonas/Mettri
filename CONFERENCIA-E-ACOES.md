# Conferência feita + o que só você pode fazer

## O que já foi conferido e ajustado

- **Repositório real:** `ferrarijonas/Mettri` (não mettri4). Todas as URLs foram atualizadas para `https://ferrarijonas.github.io/Mettri`.
- **module-updater.ts:** `baseUrl` padrão = `https://ferrarijonas.github.io/Mettri`.
- **scripts/publish-modules.ps1:** BaseUrl padrão = `https://ferrarijonas.github.io/Mettri`. Manifest em `modules-updates/` já foi gerado com essas URLs.
- **manifest.json (extensão):** `content_security_policy` atualizado com `https://*.github.io` em `connect-src` (necessário para a extensão poder baixar o manifest e os módulos).
- **Build:** `npm run build` executado com sucesso; a pasta `dist/` está pronta.
- **GitHub Pages:** A URL `https://ferrarijonas.github.io/Mettri/manifest.json` ainda não responde (404/not found). Ou a branch `gh-pages` não existe, ou o Pages ainda não está configurado.

---

## Ações que só você pode fazer

### 1. Fazer push das alterações

Inclua pelo menos:

- `manifest.json` (CSP)
- `src/infrastructure/module-updater.ts` (baseUrl)
- `modules-updates/` (manifest.json + pasta `v2.0.1/`)
- `.github/workflows/deploy-modules.yml`
- `TESTE-ATUALIZACAO-MODULOS.md` e este arquivo (opcional)

Exemplo:

```bash
git add manifest.json src/infrastructure/module-updater.ts modules-updates/ .github/workflows/deploy-modules.yml TESTE-ATUALIZACAO-MODULOS.md CONFERENCIA-E-ACOES.md
git commit -m "fix: URLs para ferrarijonas/Mettri, CSP github.io, workflow deploy"
git push origin main
```

(Se você usar outra branch como padrão, troque `main`.)

---

### 2. Habilitar GitHub Pages (uma vez)

1. No GitHub: repositório **ferrarijonas/Mettri** → **Settings** → **Pages**.
2. Em **Source**: escolha **Deploy from a branch**.
3. **Branch:** `gh-pages` (se não existir, o workflow vai criar no primeiro deploy).
4. **Folder:** `/ (root)`.
5. Salve (**Save**).

---

### 3. Garantir que o deploy rode

- Se você der **push na branch `main`** (com os arquivos acima), o workflow **Deploy modules to GitHub Pages** só roda se houver mudança em:
  - `src/modules/**`
  - `package.json`
  - `.github/workflows/deploy-modules.yml`
- Como você está fazendo push do **workflow** e do **modules-updates**, o deploy pode não disparar só por isso (o `paths` não inclui `modules-updates/`). Para ter certeza:
  - Opção A: **Rodar o workflow à mão:** **Actions** → **Deploy modules to GitHub Pages** → **Run workflow**.
  - Opção B: Incluir no commit alguma alteração em `package.json` ou em `src/modules/**` (por exemplo um comentário) e dar push.

Depois que o workflow terminar, a branch `gh-pages` será criada/atualizada e o site ficará em:

**https://ferrarijonas.github.io/Mettri/**

---

### 4. Conferir que está funcionando

1. Abra no navegador: **https://ferrarijonas.github.io/Mettri/manifest.json**  
   - Deve abrir um JSON com `version`, `modules`, etc.
2. Abra o painel da extensão no WhatsApp Web → **Configurações** (engrenagem) → **Verificar Atualizações Agora**.  
   - Deve aparecer “Nenhuma atualização” ou “Atualização disponível!” e as informações de versão/última verificação.

Quando esses dois passos derem certo, está tudo conferido e funcionando.
