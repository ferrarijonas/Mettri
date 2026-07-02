# Script para empacotar a extensÃ£o Chrome para distribuiÃ§Ã£o
param([switch]$SkipBuild = $false)
$ErrorActionPreference = "Stop"
Write-Host "ðŸ“¦ Empacotando extensÃ£o Mettri..." -ForegroundColor Cyan
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$version = $packageJson.version
$name = $packageJson.name
Write-Host "VersÃ£o: $version" -ForegroundColor Gray
if (-not $SkipBuild) {
    Write-Host "`nðŸ”¨ Compilando projeto..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) { Write-Host "âŒ Erro na compilaÃ§Ã£o!" -ForegroundColor Red; exit 1 }
    Write-Host "âœ“ CompilaÃ§Ã£o concluÃ­da!" -ForegroundColor Green
} else {
    Write-Host "â­ï¸  Pulando compilaÃ§Ã£o" -ForegroundColor Gray
}
if (-not (Test-Path "dist")) {
    Write-Host "âŒ Pasta dist/ nÃ£o encontrada!" -ForegroundColor Red
    exit 1
}
$zipFileName = "$name-v$version.zip"
$zipPath = Join-Path (Get-Location) $zipFileName
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Write-Host "`nðŸ“¦ Criando arquivo ZIP..." -ForegroundColor Yellow
Compress-Archive -Path "dist\*" -DestinationPath $zipPath -Force
Write-Host "`nâœ… ExtensÃ£o empacotada: $zipPath" -ForegroundColor Green
