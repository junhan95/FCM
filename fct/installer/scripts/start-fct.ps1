# 앱 실행 — PostgreSQL 과 앱 서버를 켜고 브라우저를 연다
param([switch]$NoBrowser)

. (Join-Path $PSScriptRoot "lib.ps1")

$AppDir  = Get-AppDir
$DataDir = Get-DataDir
$PgDir   = Join-Path $AppDir "pgsql"
$PgData  = Join-Path $DataDir "pgdata"
$EnvFile = Join-Path $DataDir ".env"
$PgLog   = Join-Path (Get-LogDir) "postgres.log"
$AppLog  = Join-Path (Get-LogDir) "app.log"
$PortFile = Join-Path $DataDir "port.txt"

try {
  # 설정을 고쳤다면 이미 떠 있는 서버는 옛 설정으로 돌고 있으므로 반드시 내린다
  if (Repair-EnvFile $EnvFile) { Stop-AppServer $PortFile }
  $envs = Read-EnvFile $EnvFile
  if (-not $envs["DATABASE_URL"]) {
    # 설치 도중 준비가 끝나지 않은 상태 — 여기서 마저 끝낸다
    Write-Step "첫 실행 준비를 진행합니다 (몇 분 걸릴 수 있습니다)"
    $code = Invoke-Native "powershell.exe" @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $PSScriptRoot "prereqs.ps1"), "-Quiet")
    if ($code -ne 0) { throw "필수 프로그램을 준비하지 못했습니다. 인터넷 연결을 확인하세요." }
    $code = Invoke-Native "powershell.exe" @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $PSScriptRoot "postinstall.ps1"), "-Quiet")
    if ($code -ne 0) { throw "데이터베이스를 준비하지 못했습니다." }
    $envs = Read-EnvFile $EnvFile
    if (-not $envs["DATABASE_URL"]) { throw "설정 파일을 만들지 못했습니다 — $EnvFile" }
  }

  $pgPort = [int]($envs["PG_PORT"]  | ForEach-Object { if ($_) { $_ } else { 55432 } })
  $want   = [int]($envs["APP_PORT"] | ForEach-Object { if ($_) { $_ } else { 3000 } })

  # ---------- PostgreSQL ----------
  if (-not (Test-Port $pgPort)) {
    Write-Log "PostgreSQL 시작 (포트 $pgPort)"
    Invoke-Native (Join-Path $PgDir "bin\pg_ctl.exe") @("-D", "$PgData", "-l", "$PgLog", "-w", "-t", "60", "start") | Out-Null
  }
  if (-not (Test-Port $pgPort)) {
    if (Test-Path $PgLog) { Write-Log "--- postgres 로그 ---"; Get-Content $PgLog -Tail 20 | ForEach-Object { Write-Log $_ } }
    throw "데이터베이스를 시작하지 못했습니다. 로그: $PgLog"
  }

  # ---------- 앱 서버 ----------
  # 지난번에 우리가 띄운 서버가 아직 살아 있으면 그대로 쓴다.
  # (다른 곳에 설치된 FCT 가 같은 포트를 쓰고 있을 수 있으므로, 우리가 적어 둔 포트만 믿는다)
  $already = $false
  $port = $want
  if (Test-Path $PortFile) {
    $mine = [int]((Get-Content $PortFile | Select-Object -First 1) -replace '\D', '')
    if ($mine -gt 0 -and (Test-Port $mine)) {
      try {
        $r = Invoke-RestMethod -Uri "http://127.0.0.1:$mine/api/health" -TimeoutSec 3
        if ($r.app -eq "fct") { $already = $true; $port = $mine }
      } catch {}
    }
  }
  if (-not $already -and (Test-Port $port)) { $port = Get-FreePort ($want + 1) }

  if (-not $already) {
    Write-Log "앱 서버 시작 (포트 $port)"
    $env:DATABASE_URL = $envs["DATABASE_URL"]
    $env:SESSION_SECRET = $envs["SESSION_SECRET"]
    $env:PORT         = "$port"
    $env:HOSTNAME     = "127.0.0.1"
    $env:NODE_ENV     = "production"
    Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $AppDir -WindowStyle Hidden `
      -RedirectStandardOutput $AppLog -RedirectStandardError (Join-Path (Get-LogDir) "app.err.log")
    Set-Content -Path $PortFile -Value $port -Encoding ASCII

    $ok = $false
    for ($i = 0; $i -lt 60; $i++) {
      Start-Sleep -Milliseconds 700
      try {
        $r = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 2
        if ($r.ok) { $ok = $true; break }
      } catch {}
    }
    if (-not $ok) { throw "앱이 시작되지 않았습니다. 로그: $AppLog" }
  } else {
    Write-Log "앱이 이미 실행 중입니다 (포트 $port)"
  }

  if (-not $NoBrowser) { Start-Process "http://localhost:$port" }
  Write-Log "실행 완료 — http://localhost:$port"
  exit 0
} catch {
  Write-Err $_.Exception.Message
  [void][Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms")
  [Windows.Forms.MessageBox]::Show($_.Exception.Message + "`n`n로그: " + $script:LogFile, "Frankonia Calculation Table", "OK", "Error") | Out-Null
  exit 1
}
