# 🧪 Guia de Teste Rápido

## 🚀 Testes Automatizados

A suite de testes está disponível na pasta `tests/`. Para executar:

### Opção 1: Servidor Local (Recomendado)
```powershell
# Na pasta C:\Mettri4
npx serve .
# ou
python -m http.server 8080
```
Depois acesse: `http://localhost:8080/tests/`

### Opção 2: Abrir Diretamente
Abra os arquivos HTML diretamente no navegador (alguns testes podem ter limitações).

### Tipos de Testes Disponíveis

| Arquivo | Descrição | Cobertura |
|---------|-----------|-----------|
| `tests/unit-tests.html` | Testes unitários dos módulos | ~25 testes |
| `tests/integration-tests.html` | Testes E2E com simulação | ~8 testes |
| `test-extension.html` | Verificação de arquivos | Validação |

---

## 📋 Passo a Passo para Testar a Extensão

### 1. Preparação
✅ Verifique se os ícones foram criados:
```bash
ls assets/icons/
```
Deve mostrar: `icon16.png`, `icon48.png`, `icon128.png`

### 2. Carregar no Chrome

1. Abra o Chrome
2. Digite na barra de endereços: `chrome://extensions/`
3. **Ative o "Modo do desenvolvedor"** (toggle no canto superior direito)
4. Clique em **"Carregar sem compactação"** (Load unpacked)
5. Selecione a pasta: `C:\Mettri4`
6. ✅ A extensão deve aparecer na lista

### 3. Verificar Instalação

- Procure o ícone verde na barra de ferramentas do Chrome
- Clique no ícone
- ✅ O popup deve abrir mostrando o Dashboard

### 4. Testar no WhatsApp Web

1. Abra uma nova aba: https://web.whatsapp.com
2. Faça login normalmente
3. Abra o Console do Desenvolvedor (F12 → Console)
4. ✅ Você deve ver mensagens como:
   - "WhatsApp Copiloto CRM: Inicializando..."
   - "WhatsApp Copiloto CRM: Todos os módulos carregados"
   - "WhatsApp Copiloto CRM: Sistema inicializado com sucesso!"

### 5. Testar Funcionalidades

#### Dashboard
- Abra o popup da extensão
- ✅ Deve mostrar estatísticas (mesmo que zeros inicialmente)
- ✅ Deve mostrar "Top Contatos"

#### Configurações
- Vá para a aba "Configurações"
- ✅ Deve mostrar o modo atual
- Mude o modo de operação
- ✅ Deve salvar a configuração

#### CRM
- Vá para a aba "CRM"
- ✅ Deve mostrar contatos mock (se carregados)
- ✅ Deve mostrar tags mock
- Clique em "Sincronizar do WhatsApp"
- ✅ Deve tentar sincronizar contatos

### 6. Verificar Logs

No Console do WhatsApp Web (F12), você deve ver:
- ✅ Módulos carregando sem erros
- ✅ Sistema inicializado
- ✅ Observer iniciado

### 🐛 Problemas Comuns

**Extensão não aparece:**
- Verifique se o modo do desenvolvedor está ativo
- Verifique se há erros em `chrome://extensions/` (clique na extensão)

**Scripts não carregam:**
- Abra o Console do WhatsApp Web (F12)
- Verifique erros de carregamento
- Verifique se os caminhos dos arquivos estão corretos

**Ícones não aparecem:**
- Execute: `python create_icons.py`
- Ou use: `generate-icons.html` no navegador

**Popup não abre:**
- Verifique se `popup/popup.html` existe
- Verifique o Console (F12) para erros JavaScript

### ✅ Checklist de Sucesso

- [ ] Extensão aparece em `chrome://extensions/`
- [ ] Ícone aparece na barra de ferramentas
- [ ] Popup abre ao clicar no ícone
- [ ] Dashboard mostra estatísticas
- [ ] Console do WhatsApp Web mostra logs de inicialização
- [ ] Não há erros no Console
- [ ] Testes unitários passam (tests/unit-tests.html)
- [ ] Testes de integração passam (tests/integration-tests.html)

### 🎯 Próximos Testes

Após confirmar que a extensão abre:
1. Testar detecção de mensagens
2. Testar copiloto IA (requer API key)
3. Testar auto-responder
4. Testar sincronização de contatos













