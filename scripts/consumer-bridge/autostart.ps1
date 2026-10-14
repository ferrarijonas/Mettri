# autostart.ps1 — liga/desliga o consumer-bridge no logon do Windows.
#
#   powershell -ExecutionPolicy Bypass -File autostart.ps1            # instala
#   powershell -ExecutionPolicy Bypass -File autostart.ps1 -Remove    # remove
#
# Cria um atalho em Startup apontando pro pythonw (sem janela). Assim o
# bridge sobe sozinho a cada logon e a extensão só conversa via HTTP.
param([switch]$Remove)

$bridgeDir = $PSScriptRoot
$server = Join-Path $bridgeDir "server.py"
$lnk = Join-Path ([Environment]::GetFolderPath("Startup")) "Mettri Consumer Bridge.lnk"

if ($Remove) {
    if (Test-Path $lnk) { Remove-Item $lnk -Force; Write-Host "Autostart removido." }
    else { Write-Host "Nada para remover." }
    return
}

$pythonw = (Get-Command pythonw -ErrorAction SilentlyContinue).Source
if (-not $pythonw) { throw "pythonw nao encontrado no PATH." }

$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut($lnk)
$s.TargetPath = $pythonw
$s.Arguments = '"' + $server + '"'
$s.WorkingDirectory = $bridgeDir
$s.WindowStyle = 7
$s.Description = "Mettri consumer-bridge (Firebird read-only)"
$s.Save()
Write-Host "Autostart instalado: $lnk"
