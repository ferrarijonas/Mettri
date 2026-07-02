# Extrai codigo relevante da extensao WA Web Plus
$extPath = "C:\Users\Alice\AppData\Local\Google\Chrome\User Data\Profile 1\Extensions\ekcgkejcjdcmonfpmnljobemcbpnkamh\4.9.2_0"

Write-Host "Extraindo codigo relevante de: $extPath" -ForegroundColor Cyan

# Ler app.js e procurar por padroes
$appJsPath = Join-Path $extPath "app.js"
if (Test-Path $appJsPath) {
    Write-Host "`nAnalisando app.js..." -ForegroundColor Yellow
    
    $content = Get-Content $appJsPath -Raw -Encoding UTF8
    
    # Procurar por padroes relacionados ao bundler
    $patterns = @(
        "webpackChunk",
        "__webpack",
        "require\(",
        "__d\(",
        "modulesMap",
        "findExport",
        "Ct\.find",
        "window\.require",
        "window\.__d",
        "webpackChunkwhatsapp"
    )
    
    $foundPatterns = @()
    foreach ($pattern in $patterns) {
        if ($content -match $pattern) {
            Write-Host "  [ENCONTRADO] $pattern" -ForegroundColor Green
            $foundPatterns += $pattern
        }
    }
    
    if ($foundPatterns.Count -gt 0) {
        # Extrair contexto ao redor dos padroes encontrados
        $output = @()
        $output += "="*80
        $output += "CODIGO EXTRAIDO DA EXTENSAO WA WEB PLUS"
        $output += "="*80
        $output += ""
        
        foreach ($pattern in $foundPatterns) {
            $output += "-"*80
            $output += "PADRAO: $pattern"
            $output += "-"*80
            $output += ""
            
            # Dividir em linhas e procurar contexto
            $lines = $content -split "`n"
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($lines[$i] -match $pattern) {
                    $start = [Math]::Max(0, $i - 5)
                    $end = [Math]::Min($lines.Count - 1, $i + 5)
                    $output += "Linha $($i+1):"
                    for ($j = $start; $j -le $end; $j++) {
                        $marker = if ($j -eq $i) { ">>> " } else { "    " }
                        $output += "$marker$($j+1): $($lines[$j])"
                    }
                    $output += ""
                }
            }
        }
        
        $outputPath = Join-Path $PSScriptRoot "wa-web-plus-extracted-code.txt"
        $output -join "`n" | Out-File -FilePath $outputPath -Encoding UTF8
        Write-Host "`nCodigo extraido salvo em: $outputPath" -ForegroundColor Green
    } else {
        Write-Host "  Nenhum padrao de bundler encontrado em app.js" -ForegroundColor Yellow
        Write-Host "  Tentando buscar em bundle.js..." -ForegroundColor Yellow
        
        $bundleJsPath = Join-Path $extPath "bundle.js"
        if (Test-Path $bundleJsPath) {
            $bundleContent = Get-Content $bundleJsPath -Raw -Encoding UTF8
            foreach ($pattern in $patterns) {
                if ($bundleContent -match $pattern) {
                    Write-Host "  [ENCONTRADO EM BUNDLE.JS] $pattern" -ForegroundColor Green
                }
            }
        }
    }
    
    # Salvar primeiras 10000 linhas para analise manual
    $samplePath = Join-Path $PSScriptRoot "wa-web-plus-app-js-sample.txt"
    $lines = $content -split "`n"
    $sample = $lines[0..[Math]::Min(1000, $lines.Count - 1)] -join "`n"
    $sample | Out-File -FilePath $samplePath -Encoding UTF8
    Write-Host "`nAmostra de app.js (primeiras 1000 linhas) salva em: $samplePath" -ForegroundColor Cyan
}

Write-Host "`nExtracao concluida!" -ForegroundColor Green
