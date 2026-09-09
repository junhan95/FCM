# 데이터베이스 준비 + 첫 실행 설정
#   · 앱 전용 PostgreSQL 인스턴스를 만들고 (없을 때만)
#   · .env 를 쓰고
#   · 스키마·가격 DB·템플릿·관리자 계정을 넣는다
param([switch]$Quiet)

. (Join-Path $PSScriptRoot "lib.ps1")

$AppDir  = Get-AppDir
$DataDir = Get-DataDir
$PgDir   = Join-Path $AppDir "pgsql"
$PgData  = Join-Path $DataDir "pgdata"
$EnvFile = Join-Path $DataDir ".env"
$PgLog   = Join-Path (Get-LogDir) "postgres.log"

# 기본 포트가 이미 쓰이고 있으면(다른 PostgreSQL 등) 비어 있는 포트를 쓴다
$PG_PORT   = if ($env:FCT_PG_PORT) { [int]$env:FCT_PG_PORT } else { 55432 }
$APP_PORT  = 3000
$DB_NAME   = "fct"
$DB_USER   = "fct"

function Pg([string]$exe) { return (Join-Path $PgDir ("bin\" + $exe + ".exe")) }

function Start-Pg {
  if (Test-Port $PG_PORT) { return }
  Write-Log "PostgreSQL 을 시작합니다 (포트 $PG_PORT)"
  Invoke-Native (Pg "pg_ctl") @("-D", "$PgData", "-l", "$PgLog", "-w", "-t", "60", "start") | Out-Null
  Start-Sleep -Seconds 1
  if (-not (Test-Port $PG_PORT)) {
    if (Test-Path $PgLog) { Write-Log "--- postgres 로그 ---"; Get-Content $PgLog -Tail 20 | ForEach-Object { Write-Log $_ } }
    throw "PostgreSQL 이 시작되지 않았습니다. 로그: $PgLog"
  }
}

# 이 데이터 폴더를 쓰는 postmaster 를 내린다 (다시 만들기 전에)
function Stop-Pg {
  if (-not (Test-Path (Join-Path $PgData "postmaster.pid"))) { return }
  Write-Log "쓰고 있던 PostgreSQL 을 내립니다"
  Invoke-Native (Pg "pg_ctl") @("-D", "$PgData", "-m", "immediate", "-w", "-t", "30", "stop") | Out-Null
  Start-Sleep -Seconds 1
}

try {
  Write-Step "데이터베이스를 준비합니다"

  # ---------- 1) 인스턴스 만들기 ----------
  $hasData = Test-Path (Join-Path $PgData "PG_VERSION")
  $hasEnv  = (Test-Path $EnvFile) -and ((Read-EnvFile $EnvFile)["DATABASE_URL"])
  if ($hasData -and -not $hasEnv) {
    Write-Log "설정 파일이 없어 접속 암호를 알 수 없습니다 — 데이터베이스를 다시 만듭니다"
    Stop-Pg
    $hasData = $false
  }

  if (-not $hasData) {
    if (Test-Port $PG_PORT) {
      $PG_PORT = Get-FreePort ($PG_PORT + 1)
      Write-Log "기본 포트가 사용 중이라 $PG_PORT 을 씁니다"
    }
    Write-Log "새 데이터베이스를 만듭니다 — $PgData"
    if (Test-Path $PgData) { Remove-Item $PgData -Recurse -Force }
    New-Item -ItemType Directory -Path $PgData -Force | Out-Null

    $pw = New-Secret 24
    $pwFile = Join-Path $env:TEMP ("pw-" + [Guid]::NewGuid().ToString("N") + ".txt")
    [IO.File]::WriteAllText($pwFile, $pw, (New-Object Text.UTF8Encoding($false)))
    try {
      $code = Invoke-Native (Pg "initdb") @("-D", "$PgData", "-U", $DB_USER, "--auth-local=trust", "--auth-host=scram-sha-256", "--pwfile=$pwFile", "-E", "UTF8", "--locale=C")
      if ($code -ne 0) { throw "initdb 실패 (코드 $code)" }
    } finally { Remove-Item $pwFile -Force -ErrorAction SilentlyContinue }

    # 이 PC 안에서만, 지정한 포트로
    Add-Content -Path (Join-Path $PgData "postgresql.conf") -Value @"

# --- Frankonia Calculation Table ---
listen_addresses = '127.0.0.1'
port = $PG_PORT
"@ -Encoding UTF8

    Start-Pg
    Write-Log "데이터베이스 '$DB_NAME' 생성"
    # TCP 접속은 암호를 요구한다 — 넘겨주지 않으면 입력을 기다리며 멈춘다
    $env:PGPASSWORD = $pw
    try {
      $code = Invoke-Native (Pg "createdb") @("-h", "127.0.0.1", "-p", "$PG_PORT", "-U", $DB_USER, "-w", $DB_NAME)
      if ($code -ne 0) { Write-Log "createdb 코드 $code — 이미 있으면 그대로 씁니다" }
    } finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }

    # ---------- 2) .env ----------
    $secret = New-Secret 32
    $conn = "postgres://$DB_USER`:$pw@127.0.0.1:$PG_PORT/$DB_NAME"
    $lines = @(
      "# Frankonia Calculation Table — 설치 프로그램이 만든 설정",
      "DATABASE_URL=$conn",
      "SESSION_SECRET=$secret",
      "APP_PORT=$APP_PORT",
      "PG_PORT=$PG_PORT",
      "ADMIN_USERNAME=admin",
      "ADMIN_PASSWORD=admin1234"
    )
    [IO.File]::WriteAllLines($EnvFile, $lines, (New-Object Text.UTF8Encoding($false)))
    Write-Log ".env 작성 — $EnvFile"
  } else {
    Write-Log "이미 만들어진 데이터베이스를 씁니다"
    $saved = (Read-EnvFile $EnvFile)["PG_PORT"]
    if ($saved) { $PG_PORT = [int]$saved }
    Start-Pg
  }

  # ---------- 3) 스키마·기초 데이터 ----------
  Start-Pg
  $envs = Read-EnvFile $EnvFile
  if (-not $envs["DATABASE_URL"]) { throw ".env 에 DATABASE_URL 이 없습니다 — $EnvFile" }

  Write-Step "스키마와 기초 데이터를 넣습니다"
  $prev = @{}
  foreach ($k in @("DATABASE_URL","ADMIN_USERNAME","ADMIN_PASSWORD")) {
    $prev[$k] = [Environment]::GetEnvironmentVariable($k)
    [Environment]::SetEnvironmentVariable($k, $envs[$k])
  }
  try {
    Push-Location $AppDir
    $code = Invoke-Native "node" @("scripts\db_setup.cjs")
    Pop-Location
    if ($code -ne 0) { throw "초기 데이터 입력 실패 (코드 $code)" }
  } finally {
    foreach ($k in $prev.Keys) { [Environment]::SetEnvironmentVariable($k, $prev[$k]) }
  }

  Write-Step "준비가 끝났습니다"
  exit 0
} catch {
  Write-Err $_.Exception.Message
  if (-not $Quiet) { Write-Host ""; Write-Host "자세한 내용: $script:LogFile" }
  exit 1
}
