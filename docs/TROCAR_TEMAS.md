# 🔄 Como Trocar Temas - Guia Rápido

## ✅ Sim, o Sistema Suporta Trocar Temas Facilmente!

O sistema de temas do Mettri foi projetado para **trocar a aparência visual instantaneamente** sem modificar código interno. É como trocar a cor da parede sem quebrar a casa.

## Troca Simples (Uma Linha de Código)

```typescript
import { ThemeLoader } from './ui/theme';

// Trocar para tema VSCode
await ThemeLoader.load('vscode-industrial');

// Voltar para WhatsApp
await ThemeLoader.load('wa-web-2026');

// Usar tema padrão
await ThemeLoader.loadDefault(); // Carrega 'wa-web-2026'
```

## Salvando e Restaurando Temas

### Salvar Tema Atual

```typescript
import { ThemeManager } from './ui/theme';

// Salva o tema atual com um label
await ThemeManager.saveCurrent('wa-web-2026', 'WhatsApp Web 2026');
```

### Restaurar Tema Salvo

```typescript
import { ThemeManager } from './ui/theme';

// Restaura o último tema usado
await ThemeManager.restoreLast();

// Ou restaura um tema específico
await ThemeManager.restore('wa-web-2026');
```

## Exemplo Completo: Toggle Entre Temas

```typescript
import { ThemeLoader, ThemeManager, type ThemeName } from './ui/theme';

let currentTheme: ThemeName = 'wa-web-2026';

async function toggleTheme() {
  // Salva tema atual antes de trocar
  await ThemeManager.saveCurrent(currentTheme);
  
  // Troca para outro tema
  currentTheme = currentTheme === 'wa-web-2026' 
    ? 'vscode-industrial' 
    : 'wa-web-2026';
  
  await ThemeLoader.load(currentTheme);
  
  console.log(`Tema alterado para: ${currentTheme}`);
}

// Usar
toggleTheme(); // Troca instantaneamente!
```

## Temas Disponíveis (Atuais)

1. **`wa-web-2026`** - Tema WhatsApp Web 2026 (padrão)
   - Cores: Branco, verde WhatsApp
   - Estilo: Clean, moderno, familiar

2. **`mettri-default`** - Tema padrão do Mettri
   - Cores: Cores originais do Mettri
   - Estilo: Fallback/referência

3. **`vscode-industrial`** - (A criar)
   - Cores: Escuro, azul VSCode
   - Estilo: Minimalista, industrial, nativo

## Como Funciona Por Baixo dos Panos

1. **ThemeLoader** remove o `<link>` do tema atual
2. Cria um novo `<link>` para o tema desejado
3. Adiciona ao `<head>` da página
4. O CSS do novo tema define as variáveis `--mettri-*`
5. Todos os componentes se atualizam automaticamente

**Resultado:** Mudança instantânea! 🎨

## Verificando Tema Atual

```typescript
import { ThemeLoader } from './ui/theme';

const currentTheme = ThemeLoader.getCurrentTheme();
console.log('Tema atual:', currentTheme); // 'wa-web-2026' | 'vscode-industrial' | null
```

## Criar Novo Tema

Veja `docs/CRIAR_TEMA_VSCODE.md` para criar o tema VSCode/Photoshop/ChatGPT.

## Resumo

✅ **Sim, suporta trocar temas facilmente!**  
✅ **Uma linha de código:** `await ThemeLoader.load('nome-do-tema')`  
✅ **Sem quebrar código interno:** Tudo é CSS, zero lógica afetada  
✅ **Instantâneo:** Mudança visual imediata  

**Metáfora:** É como trocar a capa de um livro - o conteúdo (código) continua igual, só muda a aparência (tema CSS).
