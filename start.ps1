$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$python = Join-Path $root '.venv\Scripts\python.exe'
if (-not (Test-Path $python)) { throw '尚未安裝環境，請先執行 scripts\install.ps1' }
Push-Location $root
try {
  & $python -m alembic -c backend\alembic.ini upgrade head
  if (-not (Test-Path 'dist')) { npm.cmd run build }
  $env:PYTHONPATH = (Join-Path $root 'backend')
  & $python -m uvicorn app.main:app --host 127.0.0.1 --port 8080
} finally { Pop-Location }
