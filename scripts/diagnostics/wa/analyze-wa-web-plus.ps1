# Script para analisar arquivos da extensão WA Web Plus
# Foca em entender como ela acessa o bundler do WhatsApp

param(
    [string]$ExtensionPath = ""
)

Write-Host "🔬 Analisando extensão WA Web Plus..." -ForegroundColor Cyan

if (-not $ExtensionPath) {
    Write-Host "❌ Por favor, forneça o caminho da extensão" -ForegroundColor Red
    Write-Host "   Exemplo: .\analyze-wa-web-plus.ps1 -ExtensionPath 'C:\Users\...\Extensions\xxxxx'" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $ExtensionPath)) {
    Write-Host "❌ Caminho não encontrado: $ExtensionPath" -ForegroundColor Red
    exit 1
}

Write-Host "`n📂 Analisando: $ExtensionPath`n" -ForegroundColor Yellow

# 1. Ler manifest.json
$manifestPath = Join-Path $ExtensionPath "manifest.json"
if (Test-Path $manifestPath) {
    Write-Host "📋 MANIFEST.JSON" -ForegroundColor Cyan
    Write-Host ("="*60) -ForegroundColor Cyan
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $manifest | ConvertTo-Json -Depth 10 | Write-Host
    Write-Host ""
}

# 2. Procurar arquivos JavaScript que acessam webpack/bundler
Write-Host "🔍 Procurando código de acesso ao bundler..." -ForegroundColor Cyan
Write-Host ("="*60) -ForegroundColor Cyan

$jsFiles = Get-ChildItem -Path $ExtensionPath -Filter "*.js" -Recurse -ErrorAction SilentlyContinue

$bundlerPatterns = @(
    "webpack",
    "__webpack",
    "webpackChunk",
    "require\(",
    "__d\(",
    "bundler",
    "comet",
    "window\.require",
    "window\.__d",
    "findExport",
    "modulesMap",
    "moduleFactory"
)

$foundCode = @()

foreach ($jsFile in $jsFiles) {
    try {
        $content = Get-Content $jsFile.FullName -Raw -ErrorAction SilentlyContinue
        if ($content) {
            foreach ($pattern in $bundlerPatterns) {
                if ($content -match $pattern) {
                    $relativePath = $jsFile.FullName.Replace($ExtensionPath, ".")
                    Write-Host "`n📜 $relativePath" -ForegroundColor Green
                    Write-Host "   Padrão encontrado: $pattern" -ForegroundColor Yellow
                    
                    # Extrair contexto (linhas ao redor)
                    $lines = Get-Content $jsFile.FullName -ErrorAction SilentlyContinue
                    $lineNum = 0
                    foreach ($line in $lines) {
                        $lineNum++
                        if ($line -match $pattern) {
                            $start = [Math]::Max(1, $lineNum - 3)
                            $end = [Math]::Min($lines.Count, $lineNum + 3)
                            Write-Host "   Linha $lineNum :" -ForegroundColor Cyan
                            for ($i = $start; $i -le $end; $i++) {
                                $marker = if ($i -eq $lineNum) { ">>>" } else { "   " }
                                Write-Host "   $marker $i : $($lines[$i-1])" -ForegroundColor $(if ($i -eq $lineNum) { "Yellow" } else { "White" })
                            }
                            Write-Host ""
                        }
                    }
                    
                    $foundCode += @{
                        File = $relativePath
                        Pattern = $pattern
                        Line = $lineNum
                    }
                    break  # Encontrou padrão neste arquivo, passar para próximo
                }
            }
        }
    } catch {
        # Ignorar erros
    }
}

# 3. Procurar por arquivos específicos comuns
Write-Host "`n📁 Arquivos importantes encontrados:" -ForegroundColor Cyan
Write-Host ("="*60) -ForegroundColor Cyan

$importantFiles = @(
    "inject.js",
    "content.js",
    "background.js",
    "service-worker.js",
    "bridge.js",
    "utils.js",
    "store.js",
    "init.js"
)

foreach ($importantFile in $importantFiles) {
    $found = Get-ChildItem -Path $ExtensionPath -Filter $importantFile -Recurse -ErrorAction SilentlyContinue
    if ($found) {
        foreach ($file in $found) {
            $relativePath = $file.FullName.Replace($ExtensionPath, ".")
            Write-Host "  ✓ $relativePath" -ForegroundColor Green
            
            # Mostrar primeiras linhas
            $firstLines = Get-Content $file.FullName -TotalCount 30 -ErrorAction SilentlyContinue
            if ($firstLines) {
                Write-Host "    Primeiras linhas:" -ForegroundColor Yellow
                $firstLines | ForEach-Object { Write-Host "      $_" -ForegroundColor Gray }
                Write-Host ""
            }
        }
    }
}

# 4. Procurar por padrões específicos de acesso ao WhatsApp
Write-Host "`n🎯 Padrões de acesso ao WhatsApp encontrados:" -ForegroundColor Cyan
Write-Host ("="*60) -ForegroundColor Cyan

$whatsappPatterns = @(
    "N\.Msg",
    "N\.Chat",
    "N\.Contact",
    "PresenceCollection",
    "GroupMetadata",
    "findExport",
    "Ct\.find",
    "webpackChunkwhatsapp"
)

foreach ($jsFile in $jsFiles) {
    try {
        $content = Get-Content $jsFile.FullName -Raw -ErrorAction SilentlyContinue
        if ($content) {
            foreach ($pattern in $whatsappPatterns) {
                if ($content -match $pattern) {
                    $relativePath = $jsFile.FullName.Replace($ExtensionPath, ".")
                    Write-Host "`n📜 $relativePath" -ForegroundColor Green
                    Write-Host "   Padrão: $pattern" -ForegroundColor Yellow
                    
                    # Extrair contexto
                    $lines = Get-Content $jsFile.FullName -ErrorAction SilentlyContinue
                    $lineNum = 0
                    $foundLines = @()
                    foreach ($line in $lines) {
                        $lineNum++
                        if ($line -match $pattern) {
                            $foundLines += $lineNum
                        }
                    }
                    
                    # Mostrar primeiras 3 ocorrências
                    foreach ($lineNum in ($foundLines | Select-Object -First 3)) {
                        $start = [Math]::Max(1, $lineNum - 2)
                        $end = [Math]::Min($lines.Count, $lineNum + 2)
                        Write-Host "   Linha $lineNum :" -ForegroundColor Cyan
                        for ($i = $start; $i -le $end; $i++) {
                            $marker = if ($i -eq $lineNum) { ">>>" } else { "   " }
                            Write-Host "   $marker $i : $($lines[$i-1])" -ForegroundColor $(if ($i -eq $lineNum) { "Yellow" } else { "White" })
                        }
                    }
                    Write-Host ""
                    break
                }
            }
        }
    } catch {
        # Ignorar erros
    }
}

# 5. Gerar relatório
$reportPath = Join-Path $PSScriptRoot "wa-web-plus-analysis.txt"
$report = @"
ANÁLISE: Extensão WA Web Plus
Gerado em: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Caminho: $ExtensionPath

ARQUIVOS ENCONTRADOS COM CÓDIGO DE BUNDLER:
$($foundCode | ConvertTo-Json -Depth 3)

"@

$report | Out-File -FilePath $reportPath -Encoding UTF8
Write-Host "`n📄 Relatório salvo em: $reportPath" -ForegroundColor Green
Write-Host "`n✅ Análise concluída!" -ForegroundColor Green
