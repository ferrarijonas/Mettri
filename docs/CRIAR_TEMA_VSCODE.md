# 🎨 Criando Tema VSCode/Photoshop/ChatGPT Style

## Objetivo

Criar um tema minimalista, industrial, que pareça nativo do sistema operacional, inspirado em:
- **VSCode** - Interface escura, clean, focada em produtividade
- **Photoshop** - Tons neutros, cinzas sofisticados
- **ChatGPT** - Minimalismo extremo, tipografia clara

## Características do Design

### Paleta de Cores (Proposta)

**Base (Fundo):**
- Fundo principal: `#1E1E1E` (quase preto, VSCode-style)
- Fundo secundário: `#252526` (cards, inputs)
- Fundo terciário: `#2D2D30` (hover, active)

**Textos:**
- Texto principal: `#CCCCCC` (cinza claro, alta legibilidade)
- Texto secundário: `#969696` (descrições, timestamps)
- Texto desabilitado: `#5A5A5A`

**Acentos:**
- Accent principal: `#007ACC` (azul VSCode, ou `#0E639C`)
- Accent hover: `#005A9E`
- Accent active: `#094771`

**Bordas:**
- Bordas: `#3E3E42` (sutis, quase invisíveis)

**Mensagens:**
- Mensagem recebida: `#2D2D30` (fundo secundário)
- Mensagem enviada: `#0E639C` (azul suave, com opacidade)

**Estados:**
- Success: `#4EC9B0` (verde-água VSCode)
- Error: `#F48771` (vermelho suave)
- Warning: `#CE9178` (laranja suave)

## Passos para Criar o Tema

### 1. Criar arquivo do tema

Criar: `src/ui/theme/themes/vscode-industrial.css`

### 2. Definir variáveis CSS

```css
:root, #mettri-panel {
  /* Cores principais - Base escura industrial */
  --mettri-bg: #1E1E1E;
  --mettri-bg-secondary: #252526;
  --mettri-bg-tertiary: #2D2D30;
  
  /* Textos - Alto contraste para legibilidade */
  --mettri-text: #CCCCCC;
  --mettri-text-secondary: #969696;
  --mettri-text-disabled: #5A5A5A;
  --mettri-text-on-accent: #FFFFFF;
  
  /* Cores semânticas - Azul VSCode como accent */
  --mettri-accent: #007ACC;
  --mettri-accent-hover: #005A9E;
  --mettri-accent-active: #094771;
  
  /* Bordas - Sutis, quase invisíveis */
  --mettri-border: #3E3E42;
  
  /* Mensagens - Estilo minimalista */
  --mettri-message-in: #2D2D30;
  --mettri-message-out: rgba(14, 99, 156, 0.2);
  
  /* Estados - Cores VSCode */
  --mettri-success-color: #4EC9B0;
  --mettri-success-bg: rgba(78, 201, 176, 0.1);
  --mettri-error-color: #F48771;
  --mettri-error-bg: rgba(244, 135, 113, 0.1);
  --mettri-warning-color: #CE9178;
  --mettri-warning-bg: rgba(206, 145, 120, 0.1);
  
  /* Sombras - Mínimas, sutis */
  --mettri-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --mettri-shadow-md: 0 2px 4px rgba(0, 0, 0, 0.4);
  --mettri-shadow-lg: 0 4px 8px rgba(0, 0, 0, 0.5);
  --mettri-shadow-button: 0 1px 3px rgba(0, 0, 0, 0.3);
  
  /* Overlay - Escuro */
  --mettri-overlay: rgba(0, 0, 0, 0.7);
  
  /* Tooltip/Toast - Fundo escuro */
  --mettri-tooltip-bg: #1E1E1E;
  --mettri-tooltip-text: #CCCCCC;
}

/* Forçar aplicação no painel */
#mettri-panel {
  --mettri-bg: #1E1E1E !important;
  --mettri-bg-secondary: #252526 !important;
  --mettri-bg-tertiary: #2D2D30 !important;
  --mettri-text: #CCCCCC !important;
  --mettri-text-secondary: #969696 !important;
  --mettri-text-disabled: #5A5A5A !important;
  --mettri-text-on-accent: #FFFFFF !important;
  --mettri-accent: #007ACC !important;
  --mettri-accent-hover: #005A9E !important;
  --mettri-accent-active: #094771 !important;
  --mettri-border: #3E3E42 !important;
  --mettri-message-in: #2D2D30 !important;
  --mettri-message-out: rgba(14, 99, 156, 0.2) !important;
  --mettri-success-color: #4EC9B0 !important;
  --mettri-success-bg: rgba(78, 201, 176, 0.1) !important;
  --mettri-error-color: #F48771 !important;
  --mettri-error-bg: rgba(244, 135, 113, 0.1) !important;
  --mettri-warning-color: #CE9178 !important;
  --mettri-warning-bg: rgba(206, 145, 120, 0.1) !important;
  --mettri-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3) !important;
  --mettri-shadow-md: 0 2px 4px rgba(0, 0, 0, 0.4) !important;
  --mettri-shadow-lg: 0 4px 8px rgba(0, 0, 0, 0.5) !important;
  --mettri-shadow-button: 0 1px 3px rgba(0, 0, 0, 0.3) !important;
  --mettri-overlay: rgba(0, 0, 0, 0.7) !important;
  --mettri-tooltip-bg: #1E1E1E !important;
  --mettri-tooltip-text: #CCCCCC !important;
  
  background: var(--mettri-bg) !important;
  color: var(--mettri-text) !important;
}

/* Suporte a light mode (opcional - pode manter escuro sempre) */
@media (prefers-color-scheme: light) {
  /* Manter escuro mesmo em light mode para manter consistência industrial */
  :root, #mettri-panel {
    --mettri-bg: #1E1E1E;
    /* ... manter todas as cores escuras */
  }
}
```

### 3. Registrar no ThemeLoader

Editar `src/ui/theme/theme-loader.ts`:

```typescript
export type ThemeName = 'wa-web-2026' | 'mettri-default' | 'vscode-industrial';
```

### 4. Trocar tema "com uma virada de chave"

```typescript
import { ThemeLoader } from './ui/theme';

// Trocar para tema VSCode
await ThemeLoader.load('vscode-industrial');

// Voltar para WhatsApp
await ThemeLoader.load('wa-web-2026');

// Ou usar ThemeManager para salvar/restaurar
import { ThemeManager } from './ui/theme';
await ThemeManager.saveCurrent('wa-web-2026', 'WhatsApp Web 2026');
await ThemeManager.restore('vscode-industrial');
```

## Checklist de Implementação

- [ ] Criar `src/ui/theme/themes/vscode-industrial.css`
- [ ] Adicionar `'vscode-industrial'` ao tipo `ThemeName`
- [ ] Testar todas as cores em componentes principais
- [ ] Verificar contraste de texto (acessibilidade)
- [ ] Testar em light/dark mode (se necessário)
- [ ] Verificar sombras e bordas (devem ser sutis)
- [ ] Testar mensagens (in/out)
- [ ] Verificar estados (success, error, warning)

## Diferenças Visuais Esperadas

| Elemento | WhatsApp Web 2026 | VSCode Industrial |
|----------|-------------------|-------------------|
| Fundo | Branco (#FFFFFF) | Preto (#1E1E1E) |
| Header | Verde (#1DAA61) | Azul (#007ACC) |
| Texto | Preto/Cinza escuro | Cinza claro (#CCCCCC) |
| Cards | Cinza claro | Cinza médio (#252526) |
| Bordas | Cinza claro | Quase invisível (#3E3E42) |
| Mensagens | Verde claro | Azul suave transparente |

## Próximos Passos

Após criar o tema, você pode:

1. **Salvar tema atual:**
   ```typescript
   await ThemeManager.saveCurrent('wa-web-2026', 'WhatsApp Web 2026');
   ```

2. **Trocar para novo tema:**
   ```typescript
   await ThemeLoader.load('vscode-industrial');
   ```

3. **Criar atalho/botão na UI** para trocar temas (opcional)

## Notas de Design

- **Minimalismo**: Remover qualquer elemento visual desnecessário
- **Industrial**: Cores neutras, cinzas sofisticados
- **Nativo**: Parecer parte do sistema operacional
- **Produtividade**: Foco em legibilidade e eficiência visual
