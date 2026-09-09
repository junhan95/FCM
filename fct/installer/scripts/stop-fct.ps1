# 앱 종료 — 앱 서버와 전용 PostgreSQL 을 내린다
. (Join-Path $PSScriptRoot "lib.ps1")

$AppDir  = Get-AppDir
$DataDir = Get-DataDir
$PgDir   = Join-Path $AppDir "pgsql"
$PgData  = Join-Path $DataDir "pgdata"
$EnvFile = Join-Path $DataDir ".env"
$PortFile = Join-Path $DataDir "port.txt"

$envs = Read-EnvFile $EnvFile
$pgPort = if ($envs["PG_PORT"]) { [int]$envs["PG_PORT"] } else { 55432 }
$port = if (Test-Path $PortFile) { [int](Get-Content $PortFile | Select-Object -First 1) } else { if ($envs["APP_PORT"]) { [int]$envs["APP_PORT"] } else { 3000 } }

Write-Step "앱을 종료합니다"
try {
  $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conns) {
    $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
    if ($p -and $p.ProcessName -eq "node") { Write-Log "앱 서버 종료 (pid $($p.Id))"; Stop-Process -Id $p.Id -Force }
  }
} catch {}

try {
  if (Test-Port $pgPort) {
    Write-Log "PostgreSQL 종료"
    Invoke-Native (Join-Path $PgDir "bin\pg_ctl.exe") @("-D", "$PgData", "-m", "fast", "-w", "-t", "30", "stop") | Out-Null
  }
} catch { Write-Err $_.Exception.Message }

Write-Log "종료 완료"
