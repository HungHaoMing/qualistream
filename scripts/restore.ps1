param(
  [Parameter(Mandatory=$true)][string]$BackupZip,
  [Parameter(Mandatory=$true)][ValidateSet('RESTORE')][string]$Confirm
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root '.venv\Scripts\python.exe'
if (-not (Test-Path $python)) { throw '尚未安裝 QualiStream 環境。' }
$env:PYTHONPATH = Join-Path $root 'backend'
& $python -m app.backup_cli $BackupZip --confirm $Confirm

