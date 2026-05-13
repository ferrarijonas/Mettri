# Instruções para Criar PR e Release no GitHub

## 📋 Criar Pull Request

### Opção 1: Via Interface Web do GitHub

1. Acesse: https://github.com/ferrarijonas/Mettri/compare/main...fix-ui-shadow-dom-isolation
2. Clique em "Create Pull Request"
3. Use o título: `feat: Refatoração UI e Remoção de Templates - v2.0.1`
4. Cole o conteúdo de `.github/PR_TEMPLATE_v2.0.1.md` no corpo do PR
5. Adicione labels: `enhancement`, `breaking-change`, `ui`
6. Clique em "Create Pull Request"

### Opção 2: Via GitHub CLI (se instalado)

```bash
gh pr create --base main --head fix-ui-shadow-dom-isolation --title "feat: Refatoração UI e Remoção de Templates - v2.0.1" --body-file .github/PR_TEMPLATE_v2.0.1.md --label enhancement,breaking-change,ui
```

## 🚀 Criar Release

### Via Interface Web do GitHub

1. Acesse: https://github.com/ferrarijonas/Mettri/releases/new
2. Selecione a tag: `v2.0.1`
3. Título da release: `v2.0.1 - Refatoração UI e Remoção de Templates`
4. Cole o conteúdo de `.github/RELEASE_TEMPLATE_v2.0.1.md` na descrição
5. Marque como "Latest release" se for a versão mais recente
6. Clique em "Publish release"

### Via GitHub CLI (se instalado)

```bash
gh release create v2.0.1 --title "v2.0.1 - Refatoração UI e Remoção de Templates" --notes-file .github/RELEASE_TEMPLATE_v2.0.1.md
```

## 📊 Atualizar Milestones

1. Acesse: https://github.com/ferrarijonas/Mettri/milestones
2. Se houver um milestone relacionado a "UI Improvements" ou "v2.0.1", adicione esta PR/Release
3. Ou crie um novo milestone se necessário

## ✅ Checklist Final

- [ ] Pull Request criado
- [ ] PR revisado e aprovado
- [ ] PR mergeado na branch main
- [ ] Release criada no GitHub
- [ ] Milestones atualizados
- [ ] Notificações enviadas (se necessário)

---

**Nota:** Os templates estão em `.github/PR_TEMPLATE_v2.0.1.md` e `.github/RELEASE_TEMPLATE_v2.0.1.md`
