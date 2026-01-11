# 🚀 Teste Rápido da Extensão

## ✅ Checklist de Teste

### 1. Carregar a Extensão
- [ ] Abra o Chrome (não o browser do Cursor)
- [ ] Vá para `chrome://extensions/`
- [ ] Ative o "Modo do desenvolvedor"
- [ ] Clique em "Carregar sem compactação"
- [ ] Selecione a pasta `C:\Mettri4`
- [ ] A extensão deve aparecer na lista

### 2. Verificar Instalação
- [ ] Ícone verde aparece na barra de ferramentas do Chrome
- [ ] Clique no ícone → popup deve abrir
- [ ] Popup mostra o Dashboard com estatísticas
- [ ] Não há erros visíveis na página de extensões

### 3. Testar no WhatsApp Web
- [ ] Abra `https://web.whatsapp.com`
- [ ] Faça login normalmente
- [ ] Abra o Console (F12 → Console)
- [ ] Você deve ver:
  ```
  WhatsApp Copiloto CRM: Inicializando...
  WhatsApp Copiloto CRM: Todos os módulos carregados
  WhatsApp Copiloto CRM: Sistema inicializado com sucesso!
  ```

### 4. Testar Funcionalidades

#### Dashboard
- [ ] Abra o popup da extensão
- [ ] Veja estatísticas (mesmo que zeros)
- [ ] Veja "Top Contatos"

#### Configurações
- [ ] Vá para aba "Configurações"
- [ ] Veja o modo atual
- [ ] Mude o modo → deve salvar

#### CRM
- [ ] Vá para aba "CRM"
- [ ] Veja contatos mock (se carregados)
- [ ] Veja tags mock
- [ ] Clique em "Sincronizar do WhatsApp"

## 🐛 Se Der Erro

### Erro: "Manifest inválido"
- Verifique se `manifest.json` está correto
- Execute: `python -m json.tool manifest.json`

### Erro: "Arquivo não encontrado"
- Verifique se todos os arquivos existem:
  ```powershell
  Test-Path manifest.json
  Test-Path popup\popup.html
  Test-Path background\service-worker.js
  Test-Path content\inject.js
  ```

### Erro: "Scripts não carregam"
- Abra o Console do WhatsApp Web (F12)
- Veja qual script está falhando
- Verifique os caminhos no `content/inject.js`

### Extensão não aparece
- Verifique se selecionou a pasta correta (`C:\Mettri4`)
- Verifique se o modo do desenvolvedor está ativo
- Recarregue a página de extensões

## 📝 Logs Esperados

No Console do WhatsApp Web, você deve ver:

```
WhatsApp Copiloto CRM: Inicializando...
WhatsApp Copiloto CRM: Todos os módulos carregados
WhatsApp Copiloto CRM: Sistema inicializado com sucesso!
Modo detectado: dom
```

Se aparecer "Modo detectado: mcp", significa que detectou o MCP do Cursor (se disponível).

## 🎯 Próximos Passos Após Teste

1. Testar detecção de mensagens
2. Configurar API key para Copiloto IA
3. Criar regras de auto-responder
4. Testar sincronização de contatos












