# 🧪 Como Testar Temas

## Método 1: Via Console do DevTools (Mais Rápido)

### Passo 1: Abrir WhatsApp Web
1. Abra o WhatsApp Web no navegador
2. Faça login normalmente

### Passo 2: Abrir DevTools
- Pressione `F12` ou `Ctrl+Shift+I` (Windows/Linux)
- Ou `Cmd+Option+I` (Mac)

### Passo 3: Vá na aba Console
Clique na aba "Console" no DevTools

### Passo 4: Aplicar Tema VSCode

**Opção A - Script Completo:**
```javascript
// Cole e execute este código no console:
(async function() {
  try {
    await window.ThemeLoader.load('vscode-industrial');
    console.log('✅ Tema VSCode aplicado!');
  } catch (error) {
    console.error('❌ Erro:', error);
  }
})();
```

**Opção B - Uma Linha:**
```javascript
await ThemeLoader.load('vscode-industrial');
```

**Opção C - Usando o Script:**
1. Abra o arquivo `scripts/apply-vscode-theme.js`
2. Cole todo o conteúdo no console
3. Pressione Enter

### Passo 5: Voltar para WhatsApp

```javascript
await ThemeLoader.load('wa-web-2026');
```

---

## Método 2: Modificar Código Temporariamente

Se quiser que o tema VSCode seja aplicado automaticamente:

### Editar `src/content/main.ts`

```typescript
// Linha ~272
// ANTES:
await ThemeLoader.loadDefault(); // Carrega 'wa-web-2026'

// DEPOIS:
await ThemeLoader.load('vscode-industrial'); // Carrega tema VSCode
```

Depois:
```bash
npm run build
```

E recarregue a extensão no Chrome.

---

## Método 3: Criar Botão na UI (Futuro)

Você pode adicionar um botão no painel para trocar temas:

```typescript
// Em src/ui/panel.ts
const themeButton = document.createElement('button');
themeButton.textContent = 'Tema VSCode';
themeButton.onclick = async () => {
  await ThemeLoader.load('vscode-industrial');
};
```

---

## Verificações

### ✅ Verificar se tema foi aplicado:

```javascript
// No console do DevTools
const themeLink = document.getElementById('mettri-theme');
console.log('Link do tema:', themeLink?.href);

const panel = document.getElementById('mettri-panel');
console.log('Tema no painel:', panel?.getAttribute('data-theme'));

const style = getComputedStyle(panel);
console.log('Background:', style.backgroundColor);
console.log('Fonte:', style.fontFamily);
console.log('--mettri-bg:', style.getPropertyValue('--mettri-bg'));
```

### ✅ Listar temas disponíveis:

```javascript
// Se ThemeManager estiver disponível
if (window.ThemeManager) {
  console.log('Temas disponíveis:', window.ThemeManager.getAvailableThemes());
}
```

---

## Troubleshooting

### ❌ "ThemeLoader não está disponível"

**Solução:**
1. Recarregue a página do WhatsApp Web
2. Recarregue a extensão no Chrome (`chrome://extensions/`)
3. Verifique se o build foi feito: `npm run build`

### ❌ "Tema não mudou visualmente"

**Verifique:**
1. O link do tema foi carregado?
   ```javascript
   document.getElementById('mettri-theme')?.href
   ```

2. As variáveis CSS estão aplicadas?
   ```javascript
   getComputedStyle(document.getElementById('mettri-panel')).getPropertyValue('--mettri-bg')
   ```

3. Há CSS do WhatsApp sobrescrevendo?
   - Inspecione o painel no DevTools
   - Veja se há estilos `!important` do WhatsApp

### ❌ "Fontes não mudaram"

O tema VSCode usa fontes monospace. Se não mudou:
1. Verifique se `font-family` está sendo aplicada
2. Certifique-se de que as fontes estão instaladas no sistema (SF Mono, Monaco, Consolas)

---

## Comandos Rápidos

```javascript
// Aplicar VSCode
await ThemeLoader.load('vscode-industrial');

// Aplicar WhatsApp
await ThemeLoader.load('wa-web-2026');

// Ver tema atual
ThemeLoader.getCurrentTheme();

// Verificar painel
document.getElementById('mettri-panel')?.getAttribute('data-theme');
```

---

## Dicas

1. **Teste em modo anônimo** para evitar cache
2. **Limpe o cache** do navegador se necessário
3. **Recarregue a extensão** após fazer build (`npm run build`)
4. **Use DevTools** para inspecionar elementos e ver estilos aplicados
