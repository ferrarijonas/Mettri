# Script para encontrar arquivos da extensão WA-Sync instalada
# Executa: .\scripts\find-wa-sync-files.ps1

$extensionsPath = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Extensions"

Write-Host "🔍 Procurando extensão WA-Sync..." -ForegroundColor Cyan

# Listar todas as extensões
$extensions = Get-ChildItem $extensionsPath -Directory

$foundFiles = @()

foreach ($ext in $extensions) {
    # Procurar em todas as versões da extensão
    $versions = Get-ChildItem $ext.FullName -Directory
    
    foreach ($version in $versions) {
        # Procurar pelos arquivos conhecidos
        $storeJs = Get-ChildItem $version.FullName -Recurse -Filter "Store.js" -ErrorAction SilentlyContinue
        $initJs = Get-ChildItem $version.FullName -Recurse -Filter "Init.js" -ErrorAction SilentlyContinue
        $bridgeJs = Get-ChildItem $version.FullName -Recurse -Filter "bridge.js" -ErrorAction SilentlyContinue
        
        if ($storeJs -or $initJs -or $bridgeJs) {
            Write-Host "`n✅ Encontrada extensão em:" -ForegroundColor Green
            Write-Host "   $($version.FullName)" -ForegroundColor Yellow
            
            # Listar arquivos relevantes
            Write-Host "`n📁 Arquivos encontrados:" -ForegroundColor Cyan
            
            $injectedFiles = Get-ChildItem $version.FullName -Recurse -Filter "*.js" | 
                Where-Object { 
                    $_.Directory.Name -eq "injected" -or 
                    $_.Name -like "*Store*" -or 
                    $_.Name -like "*Init*" -or 
                    $_.Name -like "*Message*" -or 
                    $_.Name -like "*Event*" -or
                    $_.Name -like "*bridge*" -or
                    $_.Name -like "*inject*"
                }
            
            foreach ($file in $injectedFiles) {
                $relativePath = $file.FullName.Replace($version.FullName, "").TrimStart('\')
                Write-Host "   📄 $relativePath" -ForegroundColor White
                $foundFiles += $file
            }
            
            Write-Host "`n💡 Para copiar para o projeto:" -ForegroundColor Magenta
            Write-Host "   Copy-Item '$($version.FullName)\*' -Destination '.\wa-sync-reference\' -Recurse" -ForegroundColor Gray
            
            break
        }
    }
}

if ($foundFiles.Count -eq 0) {
    Write-Host "`n❌ Nenhuma extensão WA-Sync encontrada." -ForegroundColor Red
    Write-Host "`n💡 Alternativas:" -ForegroundColor Yellow
    Write-Host "   1. Instale a extensão WA-Sync primeiro"
    Write-Host "   2. Ou inspecione via DevTools (F12 → Sources → chrome-extension://)"
    Write-Host "   3. Ou procure o código-fonte no GitHub/repositório público"
}
