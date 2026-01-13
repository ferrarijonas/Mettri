# Script para iniciar Chrome em modo debug (Windows)
# Uso: .\scripts\start-chrome-debug.ps1

$ChromePath = Get-Command chrome -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $ChromePath) {
    $ChromePath = "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe"
    if (-not (Test-Path $ChromePath)) {
        $ChromePath = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
    }
}

if (-not (Test-Path $ChromePath)) {
    Write-Host "❌ Chrome não encontrado. Por favor, instale o Google Chrome." -ForegroundColor Red
    exit 1
}

$UserDataDir = Join-Path $env:TEMP "mettri-chrome-debug"
$RemoteDebuggingPort = 9222

Write-Host "🚀 Iniciando Chrome em modo debug..." -ForegroundColor Green
Write-Host "   Porta CDP: $RemoteDebuggingPort" -ForegroundColor Gray
Write-Host "   User Data Dir: $UserDataDir" -ForegroundColor Gray
Write-Host ""

# Criar diretório se não existir
if (-not (Test-Path $UserDataDir)) {
    New-Item -ItemType Directory -Path $UserDataDir | Out-Null
}

# Iniciar Chrome com flags de debug
$Arguments = @(
    "--remote-debugging-port=$RemoteDebuggingPort",
    "--user-data-dir=`"$UserDataDir`"",
    "--no-first-run",
    "--no-default-browser-check"
)

Start-Process -FilePath $ChromePath -ArgumentList $Arguments

Write-Host "✅ Chrome iniciado!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Próximos passos:" -ForegroundColor Yellow
Write-Host "   1. Faça login no WhatsApp Web" -ForegroundColor Gray
Write-Host "   2. Carregue a extensão Mettri (chrome://extensions)" -ForegroundColor Gray
Write-Host "   3. Execute: npm run test:cdp" -ForegroundColor Gray
Write-Host ""
