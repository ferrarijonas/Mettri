# 🚀 Como Carregar a Extensão Manualmente

Como o diálogo de seleção de pasta é nativo do Windows e não pode ser controlado automaticamente, siga estes passos:

## Passo a Passo:

1. **Abra o Chrome** (não o browser do Cursor)
2. **Digite na barra de endereços**: `chrome://extensions/`
3. **Ative o "Modo do desenvolvedor"** (toggle no canto superior direito)
4. **Clique em "Carregar sem compactação"** (Load unpacked)
5. **No diálogo que abrir**, navegue até: `C:\Mettri4`
6. **Selecione a pasta** `Mettri4` e clique em "Selecionar pasta"

## ✅ Verificação:

Após carregar, você deve ver:
- A extensão "WhatsApp Copiloto CRM" na lista
- Um ícone verde na barra de ferramentas do Chrome
- Ao clicar no ícone, o popup deve abrir

## 🐛 Se der erro:

1. Verifique se todos os arquivos existem:
   - `manifest.json` ✓
   - `popup/popup.html` ✓
   - `background/service-worker.js` ✓
   - `content/inject.js` ✓
   - `assets/icons/icon16.png` ✓

2. Abra o Console (F12) na página de extensões e veja se há erros

3. Clique na extensão para ver detalhes dos erros

## 📝 Alternativa - Via Linha de Comando:

Se preferir, você pode tentar abrir o Chrome diretamente com a extensão:

```powershell
Start-Process chrome.exe --load-extension="C:\Mettri4"
```

Mas o método manual acima é mais confiável.













