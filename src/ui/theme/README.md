# 🎨 Sistema de Temas - Mettri

Sistema modular de temas que permite trocar a aparência visual do Mettri sem quebrar código interno.

## 📋 Conceito

O sistema separa **estrutura** de **visual**:
- **Estrutura** (`panel.css`): Layout, posicionamento, estrutura HTML
- **Visual** (`themes/*.css`): Cores, espaçamentos, tipografia, bordas

É como trocar a **pintura do carro** sem mexer no **motor**.

## 🚀 Como Usar

### Carregar um Tema

```typescript
import { ThemeLoader } from './ui/theme';

// Carregar tema WhatsApp Web 2026 (oficial)
await ThemeLoader.load('wa-web-2026');

// Carregar tema padrão Mettri
await ThemeLoader.load('mettri-default');
```

### Verificar Tema Atual

```typescript
const current = ThemeLoader.getCurrentTheme();
console.log(`Tema atual: ${current}`);
```

### Remover Tema

```typescript
ThemeLoader.remove();
```

## 📁 Estrutura de Arquivos

```
src/ui/
├── theme/
│   ├── README.md              # Esta documentação
│   ├── index.ts               # Exporta ThemeLoader
│   ├── theme-loader.ts        # Carregador de temas
│   └── themes/                # Temas disponíveis
│       ├── wa-web-2026.css    # Tema WhatsApp Web 2026
│       └── mettri-default.css # Tema padrão Mettri
└── panel.css                  # Estrutura (sem cores)
```

## 🎨 Temas Disponíveis

### `wa-web-2026`
Tema oficial do WhatsApp Web 2026. Replica exatamente as cores, espaçamentos e tipografia do WhatsApp Web.

**Características:**
- ✅ Cores oficiais do WhatsApp Design System
- ✅ Espaçamentos idênticos
- ✅ Tipografia Roboto Variable
- ✅ Suporte a dark mode
- ✅ Variáveis CSS semânticas

### `mettri-default`
Tema padrão original do Mettri. Mantido para compatibilidade.

## 🔧 Como Criar um Novo Tema

### Passo 1: Criar Arquivo CSS

Crie um novo arquivo em `src/ui/theme/themes/meu-tema.css`:

```css
:root {
  --mettri-bg: #ffffff;
  --mettri-bg-secondary: #f0f2f5;
  --mettri-text: #111b21;
  --mettri-text-secondary: #667781;
  --mettri-border: #e9edef;
  --mettri-accent: #00a884;
  --mettri-accent-hover: #008f72;
  --mettri-message-in: #ffffff;
  --mettri-message-out: #d9fdd3;
}
```

### Passo 2: Adicionar Tipo TypeScript

Edite `src/ui/theme/theme-loader.ts`:

```typescript
export type ThemeName = 'wa-web-2026' | 'mettri-default' | 'meu-tema';
```

### Passo 3: Usar o Tema

```typescript
await ThemeLoader.load('meu-tema');
```

## 📝 Variáveis CSS Disponíveis

### Variáveis Obrigatórias

Todo tema DEVE definir estas variáveis:

- `--mettri-bg`: Cor de fundo principal
- `--mettri-bg-secondary`: Cor de fundo secundária
- `--mettri-text`: Cor de texto principal
- `--mettri-text-secondary`: Cor de texto secundário
- `--mettri-border`: Cor de bordas
- `--mettri-accent`: Cor de destaque (botões, links)
- `--mettri-accent-hover`: Cor de destaque no hover
- `--mettri-message-in`: Cor de mensagem recebida
- `--mettri-message-out`: Cor de mensagem enviada

### Variáveis Opcionais (wa-web-2026)

O tema `wa-web-2026` expõe muitas variáveis extras:

- Espaçamentos: `--wa-spacing-*`
- Tipografia: `--wa-font-*`
- Bordas: `--wa-radius-*`
- Transições: `--wa-transition-*`
- Cores primitivas: `--wa-*-gray-*`, `--wa-emerald-*`, etc.

## 🎯 Boas Práticas

### ✅ FAZER

- Usar variáveis CSS semânticas (`--mettri-text` em vez de `--mettri-color-#111b21`)
- Definir todas as variáveis obrigatórias
- Testar em light e dark mode
- Documentar variáveis customizadas

### ❌ NÃO FAZER

- Não usar valores hardcoded no CSS (use variáveis)
- Não alterar `panel.css` para mudar cores (use temas)
- Não criar temas sem definir variáveis obrigatórias

## 🔍 Debugging

### Verificar Tema Carregado

```typescript
console.log(ThemeLoader.getCurrentTheme());
```

### Verificar Variáveis CSS

No console do navegador:

```javascript
getComputedStyle(document.documentElement).getPropertyValue('--mettri-bg');
```

### Verificar Arquivo CSS Carregado

No DevTools → Network, procure por `themes/*.css`

## 📚 Referências

- [WhatsApp Web](https://web.whatsapp.com) - Design oficial
- [Design Tokens](https://www.designtokens.org/) - Conceito de design tokens

## ❓ FAQ

**P: Posso usar múltiplos temas ao mesmo tempo?**  
R: Não. Apenas um tema pode estar ativo por vez. Carregar um novo tema remove o anterior automaticamente.

**P: Como trocar tema em runtime?**  
R: Use `ThemeLoader.load('nome-do-tema')`. Não precisa recarregar a página.

**P: O tema funciona com dark mode?**  
R: Sim! Use `@media (prefers-color-scheme: dark)` no seu tema CSS.

**P: Posso criar temas personalizados?**  
R: Sim! Crie um arquivo CSS em `themes/` e adicione o nome ao tipo `ThemeName`.

**P: O tema quebra se eu atualizar o código?**  
R: Não! O sistema foi projetado para ser "casca" separada. Mudanças em `panel.css` (estrutura) não afetam temas.
