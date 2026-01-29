# 🎨 Sistema de Temas - Mettri

## Visão Geral

O sistema de temas do Mettri permite **trocar a aparência visual sem modificar o código interno**. É como uma "casca" que envolve toda a UI, separando **estrutura** de **estilo**.

**Metáfora:** Imagine uma casa. A estrutura (paredes, portas, janelas) é o `panel.css`. O tema é a pintura, papéis de parede e decoração que você pode trocar sem quebrar nada.

## Arquitetura

```
┌─────────────────────────────────────┐
│  Theme CSS (wa-web-2026.css)       │  ← Define variáveis CSS (cores, fontes, espaçamentos)
│  └─ Variáveis: --mettri-*           │
└─────────────────────────────────────┘
                  ↓ aplica em
┌─────────────────────────────────────┐
│  Panel CSS (panel.css)              │  ← Usa variáveis CSS para estilizar componentes
│  └─ .mettri-header {                │
│       background: var(--mettri-bg)  │
│     }                               │
└─────────────────────────────────────┘
                  ↓ renderiza
┌─────────────────────────────────────┐
│  Panel HTML (panel.ts)              │  ← Estrutura HTML pura
└─────────────────────────────────────┘
```

## Como Funciona

### 1. Variáveis CSS (Design Tokens)

O tema define **variáveis CSS semânticas** em `src/ui/theme/themes/wa-web-2026.css`:

```css
:root, #mettri-panel {
  --mettri-bg: #FFFFFF;              /* Fundo principal */
  --mettri-bg-secondary: #F7F5F3;    /* Fundo secundário */
  --mettri-text: #0A1014;            /* Texto principal */
  --mettri-text-secondary: #5B6368;  /* Texto secundário */
  --mettri-accent: #1DAA61;          /* Cor de destaque (verde WhatsApp) */
  --mettri-border: rgba(17, 27, 33, 0.1); /* Bordas */
  /* ... mais variáveis */
}
```

### 2. Uso das Variáveis

O `panel.css` **nunca** usa cores hardcoded. Sempre usa variáveis:

```css
/* ✅ CORRETO - usa variável */
.mettri-header {
  background: var(--mettri-accent);
  color: var(--mettri-text-on-accent);
}

/* ❌ ERRADO - cor hardcoded */
.mettri-header {
  background: #1DAA61; /* Nunca faça isso! */
}
```

### 3. Carregamento Dinâmico

O `ThemeLoader` carrega o tema dinamicamente:

```typescript
// Em src/content/main.ts
await ThemeLoader.loadDefault(); // Carrega 'wa-web-2026' (padrão)
```

O tema é injetado como um `<link>` no `<head>`:

```html
<link id="mettri-theme" rel="stylesheet" href="chrome-extension://.../themes/wa-web-2026.css">
```

## Estrutura de Arquivos

```
src/
  ui/
    theme/
      themes/
        wa-web-2026.css     ← Tema WhatsApp Web 2026 (padrão)
        mettri-default.css  ← Tema padrão do Mettri (fallback)
      theme-loader.ts       ← Classe que carrega/remove temas
      index.ts              ← Exporta ThemeLoader
    panel.css               ← CSS estrutural (usa variáveis)
    panel.ts                ← HTML/TS do painel

dist/
  themes/
    wa-web-2026.css         ← Copiado pelo esbuild
    mettri-default.css      ← Copiado pelo esbuild
```

## Como Criar um Novo Tema

### Passo 1: Criar arquivo CSS

Crie `src/ui/theme/themes/nome-do-tema.css`:

```css
:root, #mettri-panel {
  /* Cores principais */
  --mettri-bg: #FFFFFF;
  --mettri-bg-secondary: #F5F5F5;
  --mettri-bg-tertiary: #EAEAEA;
  
  /* Textos */
  --mettri-text: #000000;
  --mettri-text-secondary: #666666;
  --mettri-text-disabled: #999999;
  --mettri-text-on-accent: #FFFFFF;
  
  /* Cores semânticas */
  --mettri-accent: #007BFF;
  --mettri-accent-hover: #0056B3;
  --mettri-accent-active: #004085;
  
  /* Bordas */
  --mettri-border: rgba(0, 0, 0, 0.1);
  
  /* Mensagens */
  --mettri-message-in: #FFFFFF;
  --mettri-message-out: #DCF8C6;
  
  /* Estados */
  --mettri-success-color: #28A745;
  --mettri-success-bg: #D4EDDA;
  --mettri-error-color: #DC3545;
  --mettri-error-bg: #F8D7DA;
  --mettri-warning-color: #FFC107;
  --mettri-warning-bg: #FFF3CD;
  
  /* Sombras */
  --mettri-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --mettri-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --mettri-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  
  /* Overlay */
  --mettri-overlay: rgba(0, 0, 0, 0.5);
  
  /* Tooltip/Toast */
  --mettri-tooltip-bg: rgba(17, 27, 33, 0.9);
  --mettri-tooltip-text: #FFFFFF;
}

/* Suporte a dark mode */
@media (prefers-color-scheme: dark) {
  :root, #mettri-panel {
    --mettri-bg: #111B21;
    --mettri-bg-secondary: #202C33;
    --mettri-text: #E9EDEF;
    --mettri-text-secondary: #8696A0;
    /* ... ajustar outras cores para dark */
  }
}

/* Forçar aplicação no painel (override WhatsApp styles) */
#mettri-panel {
  --mettri-bg: #FFFFFF !important;
  --mettri-accent: #007BFF !important;
  /* ... todas as variáveis com !important */
  
  background: var(--mettri-bg) !important;
  color: var(--mettri-text) !important;
}
```

### Passo 2: Registrar o tema

Adicione o nome do tema em `src/ui/theme/theme-loader.ts`:

```typescript
export type ThemeName = 'wa-web-2026' | 'mettri-default' | 'nome-do-tema';
```

### Passo 3: Usar o tema

```typescript
import { ThemeLoader } from './ui/theme';

// Carregar tema específico
await ThemeLoader.load('nome-do-tema');

// Ou usar como padrão
// await ThemeLoader.loadDefault(); // Carrega 'wa-web-2026'
```

### Passo 4: Build automático

O `esbuild.config.js` já copia automaticamente todos os `.css` de `src/ui/theme/themes/` para `dist/themes/`. Não precisa fazer nada manual!

## Regras Importantes

### ✅ FAÇA:

1. **Sempre use variáveis CSS** no `panel.css`:
   ```css
   .mettri-button {
     background: var(--mettri-accent);
   }
   ```

2. **Defina todas as variáveis** no tema, mesmo que seja igual a outro:
   ```css
   --mettri-bg: #FFFFFF;
   --mettri-accent: #1DAA61;
   /* ... todas as variáveis */
   ```

3. **Use `!important` no bloco `#mettri-panel`** para forçar cores:
   ```css
   #mettri-panel {
     --mettri-bg: #FFFFFF !important;
     background: var(--mettri-bg) !important;
   }
   ```

4. **Mantenha fallbacks** no `panel.css`:
   ```css
   background: var(--mettri-bg, #FFFFFF); /* fallback caso variável não exista */
   ```

### ❌ NÃO FAÇA:

1. **Nunca coloque cores hardcoded** no `panel.css`:
   ```css
   /* ❌ ERRADO */
   .mettri-header {
     background: #1DAA61; /* NUNCA faça isso! */
   }
   ```

2. **Não misture variáveis e valores diretos**:
   ```css
   /* ❌ ERRADO */
   .mettri-card {
     background: var(--mettri-bg);
     border: 1px solid #000000; /* Use var(--mettri-border)! */
   }
   ```

3. **Não esqueça de suportar dark mode**:
   ```css
   /* ✅ CORRETO - sempre inclua dark mode */
   @media (prefers-color-scheme: dark) {
     :root, #mettri-panel {
       /* ... cores para dark */
     }
   }
   ```

## Lista Completa de Variáveis CSS

### Cores de Fundo
- `--mettri-bg` - Fundo principal
- `--mettri-bg-secondary` - Fundo secundário (cards, inputs)
- `--mettri-bg-tertiary` - Fundo terciário (hover, active)

### Cores de Texto
- `--mettri-text` - Texto principal
- `--mettri-text-secondary` - Texto secundário (descrições, timestamps)
- `--mettri-text-disabled` - Texto desabilitado
- `--mettri-text-on-accent` - Texto sobre cor de destaque (geralmente branco)

### Cores de Destaque
- `--mettri-accent` - Cor principal (verde WhatsApp)
- `--mettri-accent-hover` - Cor ao passar mouse
- `--mettri-accent-active` - Cor ao clicar

### Bordas e Divisores
- `--mettri-border` - Cor das bordas

### Mensagens
- `--mettri-message-in` - Background de mensagem recebida
- `--mettri-message-out` - Background de mensagem enviada

### Estados Semânticos
- `--mettri-success-color` - Cor de sucesso
- `--mettri-success-bg` - Background de sucesso
- `--mettri-error-color` - Cor de erro
- `--mettri-error-bg` - Background de erro
- `--mettri-warning-color` - Cor de aviso
- `--mettri-warning-bg` - Background de aviso

### Sombras
- `--mettri-shadow-sm` - Sombra pequena
- `--mettri-shadow-md` - Sombra média
- `--mettri-shadow-lg` - Sombra grande
- `--mettri-shadow-button` - Sombra de botão

### Overlay e Modal
- `--mettri-overlay` - Overlay escuro (modais)

### Tooltip e Toast
- `--mettri-tooltip-bg` - Background de tooltip
- `--mettri-tooltip-text` - Texto de tooltip

## Troubleshooting

### Cores não estão sendo aplicadas

1. **Verifique se o tema foi carregado:**
   ```javascript
   // No console do DevTools
   document.getElementById('mettri-theme') // Deve retornar o <link>
   ```

2. **Verifique variáveis CSS:**
   ```javascript
   const panel = document.getElementById('mettri-panel');
   const style = getComputedStyle(panel);
   console.log(style.getPropertyValue('--mettri-bg'));
   ```

3. **Verifique se há CSS inline sobrescrevendo:**
   ```javascript
   panel.getAttribute('style'); // Deve ser null ou vazio
   ```

### Tema não carrega

1. **Verifique se o arquivo existe em `dist/themes/`**:
   ```bash
   ls dist/themes/
   ```

2. **Verifique o `manifest.json`** (deve ter `web_accessible_resources`):
   ```json
   "web_accessible_resources": [
     {
       "resources": ["themes/*.css"],
       "matches": ["https://web.whatsapp.com/*"]
     }
   ]
   ```

3. **Verifique o `esbuild.config.js`** (deve copiar os temas):
   ```javascript
   // Deve ter código que copia src/ui/theme/themes/*.css para dist/themes/
   ```

## Exemplo Prático

**Cenário:** Criar um tema "dark mode customizado"

1. Criar `src/ui/theme/themes/dark-custom.css` com variáveis escuras
2. Adicionar `'dark-custom'` ao tipo `ThemeName`
3. Usar `await ThemeLoader.load('dark-custom')` quando necessário

O tema será aplicado automaticamente e todos os componentes que usam `var(--mettri-*)` irão se adaptar!

## Documentação Relacionada

- `src/ui/panel.css` - CSS estrutural (usa variáveis)
- `src/ui/theme/theme-loader.ts` - Implementação do carregador
- `src/ui/theme/themes/wa-web-2026.css` - Tema de referência (WhatsApp Web 2026)
