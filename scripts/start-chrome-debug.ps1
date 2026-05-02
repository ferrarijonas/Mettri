# Script para iniciar Chrome em modo debug (Windows)
$ChromePath = Get-Command chrome -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $ChromePath) {
    $ChromePath = "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe"
    if (-not (Test-Path $ChromePath)) {
        $ChromePath = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
    }
}

if (-not (Test-Path $ChromePath)) {
    Write-Host "Chrome nao encontrado. Por favor, instale o Google Chrome." -ForegroundColor Red
    exit 1
}

$UserDataDir = Join-Path $env:TEMP "mettri-chrome-debug"
$RemoteDebuggingPort = 9222

Write-Host "Iniciando Chrome em modo debug..." -ForegroundColor Green
Write-Host "Porta CDP: $RemoteDebuggingPort" -ForegroundColor Gray
Write-Host "User Data Dir: $UserDataDir" -ForegroundColor Gray

if (-not (Test-Path $UserDataDir)) {
    New-Item -ItemType Directory -Path $UserDataDir | Out-Null
}

$Arguments = @(
    "--remote-debugging-port=$RemoteDebuggingPort",
    "--user-data-dir=$UserDataDir",
    "--no-first-run",
    "--no-default-browser-check"
)

Start-Process -FilePath $ChromePath -ArgumentList $Arguments

Write-Host "Chrome iniciado na porta $RemoteDebuggingPort" -ForegroundColor Green
Write-Host "Proximos passos: carregue a extensao em chrome://extensions e faca login no WhatsApp Web" -ForegroundColor Yellow
