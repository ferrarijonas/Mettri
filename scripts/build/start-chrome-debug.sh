#!/bin/bash
# Script para iniciar Chrome em modo debug (Linux/Mac)
# Uso: ./scripts/start-chrome-debug.sh

# Detectar sistema operacional
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    if [ ! -f "$CHROME_PATH" ]; then
        echo "❌ Chrome não encontrado. Por favor, instale o Google Chrome."
        exit 1
    fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    CHROME_PATH=$(which google-chrome-stable 2>/dev/null || which google-chrome 2>/dev/null || which chromium-browser 2>/dev/null)
    if [ -z "$CHROME_PATH" ]; then
        echo "❌ Chrome não encontrado. Por favor, instale o Google Chrome ou Chromium."
        exit 1
    fi
else
    echo "❌ Sistema operacional não suportado: $OSTYPE"
    exit 1
fi

USER_DATA_DIR="${TMPDIR:-/tmp}/mettri-chrome-debug"
REMOTE_DEBUGGING_PORT=9222

echo "🚀 Iniciando Chrome em modo debug..."
echo "   Porta CDP: $REMOTE_DEBUGGING_PORT"
echo "   User Data Dir: $USER_DATA_DIR"
echo ""

# Criar diretório se não existir
mkdir -p "$USER_DATA_DIR"

# Iniciar Chrome com flags de debug
"$CHROME_PATH" \
    --remote-debugging-port=$REMOTE_DEBUGGING_PORT \
    --user-data-dir="$USER_DATA_DIR" \
    --no-first-run \
    --no-default-browser-check \
    > /dev/null 2>&1 &

echo "✅ Chrome iniciado!"
echo ""
echo "📝 Próximos passos:"
echo "   1. Faça login no WhatsApp Web"
echo "   2. Carregue a extensão Mettri (chrome://extensions)"
echo "   3. Execute: npm run test:cdp"
echo ""
