$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$venv = Join-Path $root '.venv'
if (-not (Test-Path $venv)) { py -3.12 -m venv $venv }
& (Join-Path $venv 'Scripts\python.exe') -m pip install --upgrade pip
& (Join-Path $venv 'Scripts\python.exe') -m pip install -r (Join-Path $root 'backend\requirements.txt')
Push-Location $root
try { npm.cmd install } finally { Pop-Location }
Write-Host 'QualiStream 安裝完成。'
