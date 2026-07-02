# Script para encontrar TODAS as extensoes relacionadas ao WhatsApp
Write-Host "Procurando TODAS as extensoes relacionadas ao WhatsApp..." -ForegroundColor Cyan

$foundExtensions = @()

# Todos os caminhos possiveis
$allPaths = @(
    "$env:LOCALAPPDATA\Google\Chrome\User Data",
    "$env:APPDATA\Google\Chrome\User Data",
    "$env:LOCALAPPDATA\Microsoft\Edge\User Data",
    "$env:APPDATA\Microsoft\Edge\User Data",
    "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\User Data"
)

Write-Host "`nVerificando todos os perfis..." -ForegroundColor Yellow

foreach ($basePath in $allPaths) {
    if (Test-Path $basePath) {
        Write-Host "  Verificando: $basePath" -ForegroundColor Green
        
        # Procurar em todos os perfis
        $profiles = Get-ChildItem -Path $basePath -Directory -ErrorAction SilentlyContinue | Where-Object { 
            $_.Name -eq "Default" -or $_.Name -like "Profile*" 
        }
        
        foreach ($profile in $profiles) {
            $extensionsPath = Join-Path $profile.FullName "Extensions"
            if (Test-Path $extensionsPath) {
                Write-Host "    Perfil: $($profile.Name)" -ForegroundColor Cyan
                
                try {
                    $extensions = Get-ChildItem -Path $extensionsPath -Directory -ErrorAction SilentlyContinue
                    Write-Host "      Total de extensoes: $($extensions.Count)" -ForegroundColor Gray
                    
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
                                        
                                        $description = ""
                                        if ($manifestObj.description) { $description = $manifestObj.description }
                                        
                                        # Verificar se e relacionado ao WhatsApp
                                        $isWhatsApp = $false
                                        if ($name -match "wa|whatsapp|web.*plus|sync|wabridge|wassistant" -or 
                                            $description -match "wa|whatsapp|web.*plus|sync" -or
                                            $ext.Name -like "*wa*" -or
                                            $ext.Name -like "*whatsapp*") {
                                            $isWhatsApp = $true
                                        }
                                        
                                        if ($isWhatsApp) {
                                            Write-Host "      [ENCONTRADO] $name" -ForegroundColor Magenta
                                            Write-Host "         ID: $($ext.Name)" -ForegroundColor Yellow
                                            Write-Host "         Caminho: $($ext.FullName)" -ForegroundColor White
                                            
                                            $foundExtensions += @{
                                                Name = $name
                                                ID = $ext.Name
                                                Path = $ext.FullName
                                                Manifest = $manifestPath
                                                Description = $description
                                                Profile = $profile.Name
                                                Browser = if ($basePath -like "*Chrome*") { "Chrome" } elseif ($basePath -like "*Edge*") { "Edge" } else { "Brave" }
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
    }
}

# Resumo
Write-Host "`n" + ("="*70) -ForegroundColor Cyan
Write-Host "RESUMO" -ForegroundColor Yellow
Write-Host ("="*70) -ForegroundColor Cyan

if ($foundExtensions.Count -eq 0) {
    Write-Host "Nenhuma extensao relacionada ao WhatsApp encontrada" -ForegroundColor Red
    Write-Host "`nTentando buscar por IDs conhecidos..." -ForegroundColor Yellow
    
    # IDs conhecidos de extensoes do WhatsApp
    $knownIDs = @(
        "ekcgkejcjdcmonfpmnljobemcbpnkamh",
        "nbbihdccfeggojhclmpjgdphhchloiad"
    )
    
    foreach ($basePath in $allPaths) {
        if (Test-Path $basePath) {
            $profiles = Get-ChildItem -Path $basePath -Directory -ErrorAction SilentlyContinue | Where-Object { 
                $_.Name -eq "Default" -or $_.Name -like "Profile*" 
            }
            
            foreach ($profile in $profiles) {
                $extensionsPath = Join-Path $profile.FullName "Extensions"
                if (Test-Path $extensionsPath) {
                    foreach ($id in $knownIDs) {
                        $extPath = Join-Path $extensionsPath $id
                        if (Test-Path $extPath) {
                            Write-Host "  ENCONTRADO POR ID: $id" -ForegroundColor Green
                            Write-Host "     Caminho: $extPath" -ForegroundColor White
                            
                            $manifestPath = Join-Path $extPath "manifest.json"
                            if (Test-Path $manifestPath) {
                                try {
                                    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
                                    Write-Host "     Nome: $($manifest.name)" -ForegroundColor Cyan
                                    $foundExtensions += @{
                                        Name = $manifest.name
                                        ID = $id
                                        Path = $extPath
                                        Manifest = $manifestPath
                                        Description = $manifest.description
                                        Profile = $profile.Name
                                        Browser = if ($basePath -like "*Chrome*") { "Chrome" } elseif ($basePath -like "*Edge*") { "Edge" } else { "Brave" }
                                    }
                                } catch {
                                    # Ignorar
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

if ($foundExtensions.Count -gt 0) {
    Write-Host "`nEncontradas $($foundExtensions.Count) extensao(es):`n" -ForegroundColor Green
    
    foreach ($ext in $foundExtensions) {
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "Nome: $($ext.Name)" -ForegroundColor Yellow
        Write-Host "ID: $($ext.ID)" -ForegroundColor Cyan
        Write-Host "Navegador: $($ext.Browser)" -ForegroundColor White
        Write-Host "Perfil: $($ext.Profile)" -ForegroundColor White
        Write-Host "Caminho: $($ext.Path)" -ForegroundColor Gray
        Write-Host ""
    }
    
    # Criar relatorio detalhado
    $reportPath = Join-Path $PSScriptRoot "all-wa-extensions-report.txt"
    $report = "RELATORIO: Todas as Extensoes do WhatsApp Encontradas`n"
    $report += "Gerado em: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n"
    $report += "Total: $($foundExtensions.Count)`n`n"
    
    foreach ($ext in $foundExtensions) {
        $report += "========================================`n"
        $report += "Nome: $($ext.Name)`n"
        $report += "ID: $($ext.ID)`n"
        $report += "Navegador: $($ext.Browser)`n"
        $report += "Perfil: $($ext.Profile)`n"
        $report += "Caminho: $($ext.Path)`n"
        $report += "Descricao: $($ext.Description)`n`n"
        
        # Listar arquivos importantes
        if (Test-Path $ext.Path) {
            $report += "Arquivos principais:`n"
            $importantFiles = @("manifest.json", "*.js", "*.html")
            foreach ($pattern in $importantFiles) {
                $files = Get-ChildItem -Path $ext.Path -Filter $pattern -Recurse -ErrorAction SilentlyContinue | Select-Object -First 50
                foreach ($file in $files) {
                    $relativePath = $file.FullName.Replace($ext.Path, ".")
                    $report += "  - $relativePath`n"
                }
            }
            $report += "`n"
        }
    }
    
    $report | Out-File -FilePath $reportPath -Encoding UTF8
    Write-Host "Relatorio salvo em: $reportPath" -ForegroundColor Green
} else {
    Write-Host "`nNenhuma extensao encontrada." -ForegroundColor Red
    Write-Host "`nPara analisar manualmente:" -ForegroundColor Yellow
    Write-Host "  1. Abra chrome://extensions/ ou edge://extensions/" -ForegroundColor White
    Write-Host "  2. Ative o 'Modo de desenvolvedor'" -ForegroundColor White
    Write-Host "  3. Procure pela extensao do WhatsApp" -ForegroundColor White
    Write-Host "  4. Anote o ID da extensao" -ForegroundColor White
    Write-Host "  5. Execute: .\analyze-wa-web-plus.ps1 -ExtensionPath 'CAMINHO_DA_EXTENSAO'" -ForegroundColor White
}

Write-Host "`nBusca concluida!" -ForegroundColor Green
