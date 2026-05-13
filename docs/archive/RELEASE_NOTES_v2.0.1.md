# Release Notes - Versão 2.0.1

**Data:** 05 de Fevereiro de 2026

## 🎯 Resumo

Esta versão traz uma refatoração significativa do painel de reativação, removendo o sistema de templates e melhorando a experiência do usuário com uma interface mais limpa e intuitiva.

## ✨ Principais Mudanças

### Remoção do Sistema de Templates

O sistema de templates foi completamente removido para simplificar o fluxo de trabalho. Agora, as mensagens são enviadas diretamente com o texto digitado pelo usuário, sem processamento de placeholders como `{{name}}` ou `{{phone}}`.

**Impacto:** Esta é uma mudança breaking. Usuários que dependiam de templates precisarão digitar mensagens completas manualmente.

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

## 📝 Arquivos Modificados

- `src/modules/marketing/reactivation/reactivation-panel.ts` - Refatoração completa
- `package.json` - Versão atualizada para 2.0.1
- `manifest.json` - Versão atualizada para 2.0.1

## 🚀 Próximos Passos

- Monitorar feedback dos usuários sobre a remoção de templates
- Considerar adicionar funcionalidade de templates simplificada se houver demanda
- Continuar otimizando a interface baseado no uso real

---

**Nota:** Esta versão está na branch `fix-ui-shadow-dom-isolation` e será mergeada após testes.
