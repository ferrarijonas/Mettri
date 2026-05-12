# Script para iniciar Chrome em modo debug usando perfil EXISTENTE (Windows)
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

# Usar perfil EXISTENTE do Chrome (onde o usuário já tem WA Web logado)
$UserDataDir = "$env:LOCALAPPDATA\Google\Chrome\User Data"
$RemoteDebuggingPort = 9222

# Tentar Profile 1 primeiro (pode ser alterado para Profile 3 se necessário)
$ProfileDir = "Profile 1"

Write-Host "Iniciando Chrome em modo debug com perfil EXISTENTE..." -ForegroundColor Green
Write-Host "Porta CDP: $RemoteDebuggingPort" -ForegroundColor Gray
Write-Host "User Data Dir: $UserDataDir" -ForegroundColor Gray
Write-Host "Profile: $ProfileDir" -ForegroundColor Gray
Write-Host "" 
Write-Host "ATENCAO: Feche todas as janelas do Chrome antes de continuar!" -ForegroundColor Yellow
Write-Host "Pressione ENTER para continuar ou CTRL+C para cancelar..." -ForegroundColor Cyan
Read-Host

$Arguments = @(
    "--remote-debugging-port=$RemoteDebuggingPort",
    "--user-data-dir=$UserDataDir",
    "--profile-directory=$ProfileDir",
    "--no-first-run",
    "--no-default-browser-check"
)

Start-Process -FilePath $ChromePath -ArgumentList $Arguments

Write-Host "Chrome iniciado na porta $RemoteDebuggingPort com perfil existente" -ForegroundColor Green
Write-Host "Agora faca login no WhatsApp Web se necessario, depois me avise para testar." -ForegroundColor Yellow
