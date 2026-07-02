# Script simplificado para encontrar arquivos WA-Sync
Write-Host "Buscando arquivos WA-Sync..." -ForegroundColor Cyan

$foundFiles = @()
$targetFiles = @("Store.js", "Init.js", "MessageHandlers.js", "EventListeners.js", "bridge.js")

# Buscar em Extensions de todos os navegadores
$browserPaths = @(
    "$env:LOCALAPPDATA\Google\Chrome\User Data",
    "$env:LOCALAPPDATA\Microsoft\Edge\User Data",
    "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\User Data"
)

foreach ($basePath in $browserPaths) {
    if (-not (Test-Path $basePath)) { continue }
    
    Write-Host "Verificando: $basePath" -ForegroundColor Yellow
    
    # Procurar todas as pastas Extensions
    $extensionsDirs = Get-ChildItem $basePath -Recurse -Directory -Filter "Extensions" -ErrorAction SilentlyContinue -Depth 3
    
    foreach ($extDir in $extensionsDirs) {
        Write-Host "  Encontrada pasta Extensions: $($extDir.FullName)" -ForegroundColor Gray
        
        # Procurar pelos arquivos dentro
        foreach ($targetFile in $targetFiles) {
            $files = Get-ChildItem -Path $extDir.FullName -Filter $targetFile -Recurse -ErrorAction SilentlyContinue
            
            foreach ($file in $files) {
                $foundFiles += $file.FullName
                Write-Host "    ENCONTRADO: $($file.FullName)" -ForegroundColor Green
            }
        }
    }
}

# Mostrar resultados
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "RESULTADOS" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

if ($foundFiles.Count -eq 0) {
    Write-Host "`nNenhum arquivo encontrado automaticamente." -ForegroundColor Red
    Write-Host "`nALTERNATIVA: Use DevTools (F12 -> Sources -> chrome-extension://)" -ForegroundColor Yellow
} else {
    Write-Host "`nEncontrados $($foundFiles.Count) arquivo(s):" -ForegroundColor Green
    foreach ($file in $foundFiles) {
        Write-Host "  - $file" -ForegroundColor White
    }
    
    # Salvar lista
    $foundFiles | Out-File ".\wa-sync-found-files.txt" -Encoding UTF8
    Write-Host "`nLista salva em: .\wa-sync-found-files.txt" -ForegroundColor Green
}
