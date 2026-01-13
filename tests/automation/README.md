# Testes Automatizados via CDP

Sistema de testes automatizados que conecta ao Chrome existente via Chrome DevTools Protocol (CDP) para testar a extensão Mettri no WhatsApp Web.

## Como Funciona

1. Você abre o Chrome manualmente em modo debug (para evitar detecção de automação do WhatsApp)
2. Você faz login no WhatsApp Web manualmente
3. O script conecta ao Chrome via CDP (porta 9222)
4. O script executa testes automatizados e captura screenshots/logs
5. A IA pode analisar os resultados (screenshots, logs, relatórios JSON)

## Requisitos

- Node.js 20+
- Google Chrome instalado
- Extensão Mettri compilada (`npm run build`)

## Uso Rápido

### 1. Iniciar Chrome em Modo Debug

**Windows:**
```powershell
npm run chrome:debug
```

**Linux/Mac:**
```bash
chmod +x scripts/start-chrome-debug.sh
./scripts/start-chrome-debug.sh
```

Ou manualmente:
```bash
chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\temp\chrome-debug"
```

### 2. Fazer Login no WhatsApp Web

1. Abra uma nova aba no Chrome que iniciou
2. Acesse https://web.whatsapp.com
3. Faça login normalmente (escaneie QR code)

### 3. Carregar Extensão Mettri

1. Abra `chrome://extensions`
2. Ative "Modo do desenvolvedor"
3. Clique em "Carregar sem compactação"
4. Selecione a pasta `dist/`

### 4. Executar Testes

```bash
npm run test:cdp
```

## Resultados

Os resultados são salvos em `tests/results/`:

```
tests/results/
  ├── screenshots/    # Screenshots capturados
  ├── logs/           # Logs do console (JSON)
  └── reports/        # Relatórios de testes (JSON)
```

### Screenshots

Screenshots são salvos com timestamp no nome:
- `whatsapp-loaded-2024-01-15T10-30-00-000Z.png`
- `extension-loaded-2024-01-15T10-30-01-000Z.png`

### Logs

Logs são salvos em formato JSON estruturado:
```json
[
  {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "type": "log",
    "message": "Mettri: Inicializando...",
    "location": "https://web.whatsapp.com:443:L10:C5"
  }
]
```

### Relatórios

Relatórios JSON com resultado de cada teste:
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "tests": [
    {
      "name": "whatsapp-loaded",
      "passed": true,
      "screenshot": "tests/results/screenshots/whatsapp-loaded-*.png"
    }
  ],
  "summary": {
    "total": 3,
    "passed": 2,
    "failed": 1
  }
}
```

## Testes Implementados

1. **whatsapp-loaded**: Verifica se o WhatsApp Web carregou completamente
2. **extension-loaded**: Verifica se a extensão Mettri está carregada
3. **console-logs**: Coleta e verifica logs do console

## Análise pela IA

A IA pode analisar os resultados:

1. **Ler screenshots**: Verifica se elementos aparecem corretamente
2. **Ler logs**: Identifica erros no console
3. **Ler relatórios**: Verifica status dos testes

Exemplo de como a IA pode analisar:
```
- Screenshot mostra WhatsApp carregado? ✅
- Screenshot mostra painel Mettri? ✅
- Logs mostram erros? ❌ (erro X encontrado)
```

## Solução de Problemas

### Erro: "Não foi possível conectar ao Chrome"

- Certifique-se de que o Chrome está rodando com `--remote-debugging-port=9222`
- Execute `npm run chrome:debug` novamente
- Verifique se a porta 9222 não está sendo usada por outro processo

### Erro: "Aba do WhatsApp Web não encontrada"

- Abra o WhatsApp Web no Chrome que iniciou em modo debug
- Certifique-se de que a URL contém `web.whatsapp.com`

### WhatsApp não carrega completamente

- O WhatsApp pode detectar automação mesmo via CDP
- Este é um problema conhecido
- Considere testar manualmente para validar funcionalidades críticas

### Extensão não aparece nos testes

- Verifique se a extensão está carregada em `chrome://extensions`
- Verifique se não há erros na extensão
- Os seletores de teste podem precisar ser atualizados conforme a UI da extensão

## Limitações

- Requer Chrome aberto manualmente primeiro
- Requer login manual no WhatsApp
- CDP pode não funcionar se Chrome estiver em modo Incógnito
- WhatsApp pode detectar automação mesmo via CDP (comportamento inconsistente)
- Testes são mais adequados para validação básica do que para testes completos

## Próximos Passos

- Adicionar mais testes específicos
- Melhorar detecção de elementos da extensão
- Adicionar testes de funcionalidades específicas
- Integrar com CI/CD (se CDP funcionar de forma confiável)
