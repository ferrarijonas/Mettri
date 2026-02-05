# Release v2.0.1 - Refatoração UI e Remoção de Templates

## 🎯 Resumo

Esta versão traz uma refatoração significativa do painel de reativação, removendo o sistema de templates e melhorando a experiência do usuário com uma interface mais limpa e intuitiva.

## ✨ Principais Mudanças

### Remoção do Sistema de Templates

O sistema de templates foi completamente removido para simplificar o fluxo de trabalho. Agora, as mensagens são enviadas diretamente com o texto digitado pelo usuário, sem processamento de placeholders como `{{name}}` ou `{{phone}}`.

**⚠️ BREAKING CHANGE:** Esta é uma mudança breaking. Usuários que dependiam de templates precisarão digitar mensagens completas manualmente.

### Melhorias na Interface

- **Caixa de Mensagem:** Convertida de input de linha única para textarea de 3 linhas, permitindo melhor visualização e edição
- **Botão Enviar:** Corrigido para usar classes Tailwind corretas, garantindo renderização adequada
- **Layout Reorganizado:** Modo teste agora aparece logo abaixo da caixa de mensagem, seguido pelo botão de enviar
- **Campos de Teste:** Aparecem condicionalmente apenas quando o modo teste está ativo, dentro de um container visual que os relaciona ao checkbox
- **Indicador Visual:** Checkmark (✓) dentro dos campos de teste mostra quando os dados estão salvos, de forma sutil e não intrusiva

### Otimizações de Espaçamento

- Blocos principais movidos para cima para melhor aproveitamento do espaço
- Espaçamentos reduzidos entre elementos relacionados
- Botão de enviar posicionado para ser visível sem necessidade de rolagem

## 🔧 Correções Técnicas

- Removido método `phoneToChatId` duplicado e incorreto
- Limpeza de código não utilizado relacionado a templates
- Melhorias na estrutura do código do painel de reativação

## 📦 Instalação

```bash
git checkout v2.0.1
npm install
npm run build
```

## 📝 Arquivos Modificados

- `src/modules/marketing/reactivation/reactivation-panel.ts` - Refatoração completa
- `package.json` - Versão atualizada para 2.0.1
- `manifest.json` - Versão atualizada para 2.0.1

## 🔗 Links

- [Pull Request](#) - Link do PR quando criado
- [Commits](https://github.com/ferrarijonas/Mettri/compare/v2.0.0...v2.0.1)
- [Release Notes Completa](RELEASE_NOTES_v2.0.1.md)

---

**Data:** 05 de Fevereiro de 2026  
**Tag:** `v2.0.1`  
**Branch:** `fix-ui-shadow-dom-isolation`
