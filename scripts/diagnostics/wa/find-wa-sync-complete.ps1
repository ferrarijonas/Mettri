# Script completo para encontrar arquivos WA-Sync em TODOS os locais possíveis
# Executa busca profunda no PC

Write-Host "🔍 Buscando arquivos WA-Sync no PC..." -ForegroundColor Cyan
Write-Host "⏳ Isso pode levar alguns minutos..." -ForegroundColor Yellow
Write-Host ""

$foundFiles = @()
$searchPaths = @()

# 1. Todos os navegadores possíveis
$browserPaths = @(
    @{ Name = "Chrome"; Path = "$env:LOCALAPPDATA\Google\Chrome\User Data" },
    @{ Name = "Edge"; Path = "$env:LOCALAPPDATA\Microsoft\Edge\User Data" },
    @{ Name = "Brave"; Path = "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\User Data" },
    @{ Name = "Opera"; Path = "$env:APPDATA\Opera Software\Opera Stable" },
    @{ Name = "Vivaldi"; Path = "$env:LOCALAPPDATA\Vivaldi\User Data" }
)

# 2. Buscar por nome de arquivo diretamente
$targetFiles = @("Store.js", "Init.js", "MessageHandlers.js", "EventListeners.js", "bridge.js")

Write-Host "📍 Fase 1: Buscando em pastas de navegadores..." -ForegroundColor Cyan

foreach ($browser in $browserPaths) {
    $userDataPath = $browser.Path
    
    if (-not (Test-Path $userDataPath)) {
        continue
    }
    
    Write-Host "  🌐 Verificando $($browser.Name)..." -ForegroundColor Gray
    
    # Buscar em todas as pastas dentro de User Data
    $allDirs = Get-ChildItem $userDataPath -Directory -Recurse -Depth 2 -ErrorAction SilentlyContinue
    
    foreach ($dir in $allDirs) {
        if ($dir.Name -eq "Extensions" -or $dir.Name -eq "injected") {
            $searchPaths += $dir.FullName
        }
    }
}

Write-Host "📍 Fase 2: Busca profunda por nome de arquivo..." -ForegroundColor Cyan
Write-Host "  ⚠️  Esta fase pode ser lenta..." -ForegroundColor Yellow

# Buscar diretamente pelos arquivos em locais prováveis
$searchLocations = @(
    "$env:LOCALAPPDATA",
    "$env:APPDATA",
    "$env:USERPROFILE\Downloads",
    "$env:USERPROFILE\Documents"
)

foreach ($location in $searchLocations) {
    if (-not (Test-Path $location)) {
        continue
    }
    
    Write-Host "  🔎 Buscando em: $location" -ForegroundColor Gray
    
    foreach ($targetFile in $targetFiles) {
        try {
            $files = Get-ChildItem -Path $location -Filter $targetFile -Recurse -ErrorAction SilentlyContinue -Depth 5
            
            foreach ($file in $files) {
                # Verificar se está relacionado a WA-Sync ou WhatsApp
                $content = Get-Content $file.FullName -TotalCount 10 -ErrorAction SilentlyContinue
                $isWASync = $content -match "WA-Sync|WA_SYNC|wa-sync|whatsapp|WhatsApp" -or 
                           $file.DirectoryName -match "wa|sync|whatsapp" -or
                           $file.Directory.Name -eq "injected"
                
                if ($isWASync) {
                    $foundFiles += @{
                        File = $file
                        Path = $file.FullName
                        Type = "Direct Search"
                    }
                    Write-Host "    ✅ $targetFile encontrado: $($file.FullName)" -ForegroundColor Green
                }
            }
        } catch {
            # Ignorar erros de acesso negado
        }
    }
}

Write-Host "📍 Fase 3: Verificando pastas de Extensions encontradas..." -ForegroundColor Cyan

foreach ($extPath in $searchPaths) {
    Write-Host "  📂 Verificando: $extPath" -ForegroundColor Gray
    
    # Procurar pelos arquivos específicos
    foreach ($targetFile in $targetFiles) {
        try {
            $files = Get-ChildItem -Path $extPath -Filter $targetFile -Recurse -ErrorAction SilentlyContinue
            
            foreach ($file in $files) {
                $foundFiles += @{
                    File = $file
                    Path = $file.FullName
                    Type = "Extension Folder"
                }
                Write-Host "    ✅ $targetFile encontrado!" -ForegroundColor Green
            }
        } catch {
            # Ignorar erros
        }
    }
}

# Mostrar resultados
Write-Host "`n" + "="*70 -ForegroundColor Cyan
Write-Host "📊 RESULTADOS DA BUSCA" -ForegroundColor Yellow
Write-Host "="*70 -ForegroundColor Cyan

if ($foundFiles.Count -eq 0) {
    Write-Host "`n❌ Nenhum arquivo encontrado via busca automática." -ForegroundColor Red
    Write-Host "`n💡 MÉTODO ALTERNATIVO (mais rápido):" -ForegroundColor Yellow
    Write-Host "   1. Abra Chrome/Edge" -ForegroundColor White
    Write-Host "   2. Vá em: chrome://extensions/ ou edge://extensions/" -ForegroundColor White
    Write-Host "   3. Ative 'Modo do desenvolvedor'" -ForegroundColor White
    Write-Host "   4. Procure WA-Sync e clique em 'Detalhes'" -ForegroundColor White
    Write-Host "   5. Anote o ID da extensão" -ForegroundColor White
    Write-Host "   6. Abra WhatsApp Web com a extensão ativa" -ForegroundColor White
    Write-Host "   7. F12 → Sources → chrome-extension://[ID]/injected/" -ForegroundColor White
} else {
    Write-Host "`n✅ Encontrados $($foundFiles.Count) arquivo(s)!" -ForegroundColor Green
    
    # Agrupar por diretório
    $grouped = $foundFiles | Group-Object { $_.File.DirectoryName }
    
    foreach ($group in $grouped) {
        Write-Host "`n📁 Diretório: $($group.Name)" -ForegroundColor Cyan
        Write-Host "   Tipo: $($group.Group[0].Type)" -ForegroundColor Gray
        
        foreach ($item in $group.Group) {
            $relativePath = $item.Path.Replace($group.Name, "").TrimStart('\')
            Write-Host "   📄 $relativePath" -ForegroundColor White
        }
        
        Write-Host "`n   💡 Para copiar todos os arquivos desta extensão:" -ForegroundColor Magenta
        Write-Host "      New-Item -ItemType Directory -Path '.\wa-sync-reference' -Force" -ForegroundColor Gray
        Write-Host "      Copy-Item '$($group.Name)\*' -Destination '.\wa-sync-reference\' -Recurse" -ForegroundColor Gray
    }
    
    # Salvar lista em arquivo
    $resultsFile = ".\wa-sync-found-files.txt"
    $foundFiles | ForEach-Object { $_.Path } | Out-File $resultsFile -Encoding UTF8
    Write-Host "`nLista salva em: $resultsFile" -ForegroundColor Green
}

Write-Host ""

Write-Host "`n" + "="*70 -ForegroundColor Cyan
```

Agora vou executar o script:
<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
run_terminal_cmd