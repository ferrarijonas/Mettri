# Script para encontrar extensao WA Web Plus
Write-Host "Procurando extensao WA Web Plus..." -ForegroundColor Cyan

$foundFiles = @()
$searchPaths = @()

# Chrome Extensions
$chromePaths = @(
    "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Extensions",
    "$env:APPDATA\Google\Chrome\User Data\Default\Extensions"
)

# Edge Extensions
$edgePaths = @(
    "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Extensions",
    "$env:APPDATA\Microsoft\Edge\User Data\Default\Extensions"
)

$allPaths = $chromePaths + $edgePaths

Write-Host "`nVerificando diretorios..." -ForegroundColor Yellow

foreach ($path in $allPaths) {
    if (Test-Path $path) {
        Write-Host "  OK: $path" -ForegroundColor Green
        
        try {
            $extensions = Get-ChildItem -Path $path -Directory -ErrorAction SilentlyContinue
            foreach ($ext in $extensions) {
                $manifestPath = Join-Path $ext.FullName "manifest.json"
                if (Test-Path $manifestPath) {
                    try {
                        $manifestContent = Get-Content $manifestPath -Raw -ErrorAction SilentlyContinue
                        if ($manifestContent) {
                            $manifestObj = $manifestContent | ConvertFrom-Json -ErrorAction SilentlyContinue
                            if ($manifestObj) {
                                $name = ""
                                if ($manifestObj.name) { $name = $manifestObj.name }
                                elseif ($manifestObj.short_name) { $name = $manifestObj.short_name }
                                
                                if ($name -match "wa|whatsapp|web.*plus|sync" -or $ext.Name -like "*wa*") {
                                    Write-Host "    ENCONTRADO: $($ext.FullName)" -ForegroundColor Magenta
                                    Write-Host "       Nome: $name" -ForegroundColor Cyan
                                    
                                    $foundFiles += @{
                                        Path = $ext.FullName
                                        Name = $name
                                        Manifest = $manifestPath
                                        Type = "Extension"
                                    }
                                }
                            }
                        }
                    } catch {
                        # Ignorar erros
                    }
                }
            }
        } catch {
            # Ignorar erros
        }
    }
}

# Procurar por arquivos JavaScript
Write-Host "`nProcurando arquivos JavaScript..." -ForegroundColor Yellow

foreach ($file in $foundFiles) {
    if (Test-Path $file.Path) {
        try {
            $jsFiles = Get-ChildItem -Path $file.Path -Recurse -Filter "*.js" -ErrorAction SilentlyContinue | Select-Object -First 100
            foreach ($jsFile in $jsFiles) {
                try {
                    $content = Get-Content $jsFile.FullName -Raw -ErrorAction SilentlyContinue
                    if ($content) {
                        if ($content -match "webpack|bundler|__webpack|require|__d|webpackChunk") {
                            Write-Host "  [JS] $($jsFile.FullName)" -ForegroundColor Green
                        }
                    }
                } catch {
                    # Ignorar
                }
            }
        } catch {
            # Ignorar
        }
    }
}

# Resumo
Write-Host "`n" + ("="*60) -ForegroundColor Cyan
Write-Host "RESUMO" -ForegroundColor Yellow
Write-Host ("="*60) -ForegroundColor Cyan

if ($foundFiles.Count -eq 0) {
    Write-Host "Nenhuma extensao encontrada" -ForegroundColor Red
    Write-Host "`nDicas:" -ForegroundColor Yellow
    Write-Host "   - Verifique se a extensao esta instalada" -ForegroundColor White
    Write-Host "   - Procure manualmente em: chrome://extensions/" -ForegroundColor White
} else {
    Write-Host "Encontradas $($foundFiles.Count) extensao(es):`n" -ForegroundColor Green
    
    foreach ($file in $foundFiles) {
        Write-Host "EXTENSAO: $($file.Name)" -ForegroundColor Cyan
        Write-Host "   Caminho: $($file.Path)" -ForegroundColor White
        Write-Host ""
    }
    
    # Criar relatorio
    $reportPath = Join-Path $PSScriptRoot "wa-web-plus-report.txt"
    $report = "RELATORIO: Extensao WA Web Plus`n"
    $report += "Gerado em: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n"
    $report += "Total encontrado: $($foundFiles.Count)`n`n"
    
    foreach ($file in $foundFiles) {
        $report += "========================================`n"
        $report += "$($file.Type): $($file.Name)`n"
        $report += "========================================`n"
        $report += "Caminho: $($file.Path)`n"
        $report += "Manifest: $($file.Manifest)`n`n"
        
        if (Test-Path $file.Path) {
            $report += "Arquivos principais:`n"
            $jsFiles = Get-ChildItem -Path $file.Path -Filter "*.js" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 30
            foreach ($js in $jsFiles) {
                $relativePath = $js.FullName.Replace($file.Path, ".")
                $report += "  - $relativePath`n"
            }
        }
        $report += "`n"
    }
    
    $report | Out-File -FilePath $reportPath -Encoding UTF8
    Write-Host "Relatorio salvo em: $reportPath" -ForegroundColor Green
}

Write-Host "`nBusca concluida!" -ForegroundColor Green
