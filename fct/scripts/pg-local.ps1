<#
  FCT 로컬 PostgreSQL 관리 스크립트 (Windows, 관리자 권한 불필요)
  - PostgreSQL 바이너리를 npm 패키지(@embedded-postgres)로 받아 %LOCALAPPDATA%\fct-pg 에 설치
  - 포트 5434 (FCM 의 5433 과 충돌 방지), 슈퍼유저 fct / 비밀번호 fct

  사용법:
    .\scripts\pg-local.ps1 setup    # 최초 1회: 바이너리 설치 + 클러스터 초기화 + fct 계정/DB 생성
    .\scripts\pg-local.ps1 start
    .\scripts\pg-local.ps1 stop
    .\scripts\pg-local.ps1 status
#>
param([Parameter(Position = 0)][string]$Cmd = "status")

$ErrorActionPreference = "Stop"
$Root = Join-Path $env:LOCALAPPDATA "fct-pg"
$Data = Join-Path $Root "data"
$Port = 5434
$DbUser = "fct"
$DbPass = "fct"
$DbName = "fct"
$Pkg = "@embedded-postgres/windows-x64"

function Get-Bin {
  $bin = Join-Path $Root "node_modules\$Pkg\native\bin"
  if (-not (Test-Path $bin)) { throw "PostgreSQL 바이너리가 없습니다. 먼저 'setup' 을 실행하세요." }
  return $bin
}

switch ($Cmd) {
  "setup" {
    New-Item -ItemType Directory -Force -Path $Root | Out-Null
    Push-Location $Root
    if (-not (Test-Path "package.json")) { Set-Content -Path "package.json" -Value '{"name":"fct-pg","private":true}' }
    cmd /c "npm.cmd install $Pkg --no-audit --no-fund > install.log 2>&1"
    Pop-Location
    $bin = Get-Bin
    if (-not (Test-Path $Data)) {
      $pwFile = Join-Path $Root "pw.txt"
      Set-Content -Path $pwFile -Value $DbPass -NoNewline
      & "$bin\initdb.exe" -D $Data -U $DbUser --pwfile=$pwFile -E UTF8 -A scram-sha-256 | Out-Null
      Remove-Item $pwFile
      Add-Content -Path (Join-Path $Data "postgresql.conf") -Value "`nport = $Port`nlisten_addresses = 'localhost'"
    }
    $ctl = Start-Process -FilePath "$bin\pg_ctl.exe" -ArgumentList "-D `"$Data`" -l `"$(Join-Path $Root 'pg.log')`" -w -t 60 start" -WindowStyle Hidden -PassThru
    # Wait only for pg_ctl; Start-Process -Wait also waits for the PostgreSQL server.
    $ctl.WaitForExit()
    if ($ctl.ExitCode -ne 0) { throw "PostgreSQL 시작 실패 (exit $($ctl.ExitCode))" }
    Write-Host "완료. .env 의 DATABASE_URL 을 다음으로 설정하세요:"
    Write-Host "  postgresql://$DbUser`:$DbPass@localhost:$Port/$DbName"
    Write-Host "(fct 데이터베이스는 'npm run db:setup' 이 자동 생성합니다)"
  }
  "start" {
    $bin = Get-Bin
    & "$bin\pg_ctl.exe" -D $Data status | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Host "PostgreSQL already running."; exit 0 }
    # 호출한 셸이 끝나도 서버가 살아 있도록 별도 프로세스로 시작
    $ctl = Start-Process -FilePath "$bin\pg_ctl.exe" -ArgumentList "-D `"$Data`" -l `"$(Join-Path $Root 'pg.log')`" -w -t 60 start" -WindowStyle Hidden -PassThru
    $ctl.WaitForExit()
    if ($ctl.ExitCode -ne 0) { throw "PostgreSQL 시작 실패 (exit $($ctl.ExitCode))" }
    & "$bin\pg_ctl.exe" -D $Data status
  }
  "stop" {
    $bin = Get-Bin
    & "$bin\pg_ctl.exe" -D $Data stop
  }
  "status" {
    $bin = Get-Bin
    & "$bin\pg_ctl.exe" -D $Data status
  }
  default { Write-Host "사용법: pg-local.ps1 setup|start|stop|status" }
}
