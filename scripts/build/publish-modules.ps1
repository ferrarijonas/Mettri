# Script para publicar atualizações de módulos no GitHub Pages
param(
    [string]$BaseUrl = "https://ferrarijonas.github.io/Mettri",
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Stop"

Write-Host "Publicando atualizações de módulos..." -ForegroundColor Cyan

$packageJson = Get-Content "package.json" | ConvertFrom-Json
$version = $packageJson.version
Write-Host "Versão: $version" -ForegroundColor Gray

if (-not (Test-Path "dist")) {
    Write-Host "ERRO: Pasta dist/ não encontrada! Execute 'npm run build' primeiro." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "dist/modules")) {
    Write-Host "ERRO: Pasta dist/modules/ não encontrada! Execute 'npm run build:modules' primeiro." -ForegroundColor Red
    exit 1
}

$updatesDir = "modules-updates"
if (-not (Test-Path $updatesDir)) { New-Item -ItemType Directory -Path $updatesDir | Out-Null }

$versionDir = Join-Path $updatesDir "v$version"
if (-not (Test-Path $versionDir)) { New-Item -ItemType Directory -Path $versionDir | Out-Null }

Write-Host "`nGerando manifest.json..." -ForegroundColor Yellow

$manifest = @{
    version = $version
    updatedAt = (Get-Date -Format "o")
    modules = @()
}

$moduleFiles = Get-ChildItem "dist/modules" -Filter "*.js"

foreach ($file in $moduleFiles) {
    $moduleId = $file.BaseName
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash([System.Text.Encoding]::UTF8.GetBytes($content))
    $hashString = ($hash | ForEach-Object { $_.ToString("x2") }) -join ""
    
    $destFile = Join-Path $versionDir "$moduleId.js"
    if (-not $DryRun) {
        Copy-Item $file.FullName $destFile -Force
    }
    
    $manifest.modules += @{
        id = $moduleId
        version = $version
        url = "$BaseUrl/v$version/$moduleId.js"
        hash = $hashString
    }
    
    Write-Host "  OK: $moduleId (hash: $($hashString.Substring(0, 8))...)" -ForegroundColor Gray
}

$manifestPath = Join-Path $updatesDir "manifest.json"
$manifest | ConvertTo-Json -Depth 10 | Out-File -FilePath $manifestPath -Encoding UTF8

Write-Host "`nManifest gerado: $manifestPath" -ForegroundColor Green
Write-Host "`nPublicação concluída!" -ForegroundColor Green

Write-Host "`nPróximos passos:" -ForegroundColor Yellow
Write-Host "   1. Faça upload da pasta '$updatesDir' para GitHub Pages (branch gh-pages)" -ForegroundColor Gray
Write-Host "   2. Configure a URL base em src/infrastructure/module-updater.ts se necessário" -ForegroundColor Gray
Write-Host "   3. A extensão verificará atualizações automaticamente" -ForegroundColor Gray

if ($DryRun) {
    Write-Host "`nModo Dry-Run: Nenhum arquivo foi copiado" -ForegroundColor Yellow
}