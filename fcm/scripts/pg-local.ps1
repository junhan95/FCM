<#
.SYNOPSIS
  Docker 없이 로컬 PostgreSQL 을 띄운다 (Windows · 관리자 권한 불필요).

.DESCRIPTION
  docker-compose.yml 이 표준 경로이지만, Docker Desktop 을 설치할 수 없는
  환경을 위한 대안이다. PostgreSQL 바이너리를 npm 패키지로 받아
  %LOCALAPPDATA%\fcm-pg 에 두고 포트 5433 으로 실행한다.

  저장소 폴더는 건드리지 않는다 — 데이터와 바이너리 모두 사용자 프로필에 둔다.

.EXAMPLE
  .\scripts\pg-local.ps1 setup    # 최초 1회: 바이너리 내려받고 DB 초기화
  .\scripts\pg-local.ps1 start    # 서버 기동 (재부팅 후 매번)
  .\scripts\pg-local.ps1 status
  .\scripts\pg-local.ps1 stop
#>
param(
  [Parameter(Position = 0)]
  [ValidateSet('setup', 'start', 'stop', 'status', 'reset')]
  [string]$Command = 'status'
)

$ErrorActionPreference = 'Stop'
$Root = Join-Path $env:LOCALAPPDATA 'fcm-pg'
$Bin  = Join-Path $Root 'node_modules\@embedded-postgres\windows-x64\native\bin'
$Data = Join-Path $Root 'data'
$Log  = Join-Path $Root 'pg.log'
$Port = 5433
$Pw   = 'devonly'

function Test-Running {
  if (-not (Test-Path (Join-Path $Bin 'pg_ctl.exe'))) { return $false }
  & (Join-Path $Bin 'pg_ctl.exe') -D $Data status *> $null
  return $LASTEXITCODE -eq 0
}

function Invoke-Setup {
  New-Item -ItemType Directory -Path $Root -Force | Out-Null
  $pkg = Join-Path $Root 'package.json'
  if (-not (Test-Path $pkg)) {
    '{"name":"fcm-pg-runtime","private":true}' | Set-Content $pkg -Encoding utf8
  }
  Write-Host '▸ PostgreSQL 바이너리 내려받는 중…'
  Push-Location $Root
  try { & cmd /c 'npm install @embedded-postgres/windows-x64 --no-audit --no-fund' | Out-Null }
  finally { Pop-Location }
  if (-not (Test-Path (Join-Path $Bin 'initdb.exe'))) { throw '바이너리를 찾지 못했습니다.' }

  if (Test-Path (Join-Path $Data 'PG_VERSION')) {
    Write-Host '  데이터 디렉터리가 이미 있습니다 (reset 으로 초기화 가능)'
  } else {
    Write-Host '▸ 데이터 디렉터리 초기화'
    $pwFile = Join-Path $env:TEMP 'fcm-pgpw.txt'
    $Pw | Set-Content $pwFile -Encoding ascii -NoNewline
    try {
      & (Join-Path $Bin 'initdb.exe') -D $Data -U postgres --pwfile=$pwFile `
        --auth=scram-sha-256 --encoding=UTF8 --locale=C | Out-Null
    } finally { Remove-Item $pwFile -Force -ErrorAction SilentlyContinue }
  }
  Invoke-Start
  Write-Host '▸ fcm 데이터베이스 생성'
  # psql 이 함께 오지 않으므로 프로젝트의 pg 드라이버로 만든다.
  $repo = Split-Path $PSScriptRoot -Parent
  $js = @'
const {Client}=require("pg");
(async()=>{const c=new Client({connectionString:"postgres://postgres:devonly@127.0.0.1:5433/postgres"});
await c.connect();
const r=await c.query("select 1 from pg_database where datname=$1",["fcm"]);
if(r.rowCount===0){await c.query("create database fcm");console.log("  fcm 생성됨")}
else{console.log("  fcm 이미 존재")}
await c.end()})().catch(e=>{console.error(e.message);process.exit(1)})
'@
  $tmp = Join-Path $repo '.tmp-createdb.cjs'
  $js | Set-Content $tmp -Encoding utf8
  try { Push-Location $repo; & node $tmp } finally { Pop-Location; Remove-Item $tmp -Force }
  Write-Host ''
  Write-Host '완료. 다음을 실행하십시오:'
  Write-Host '  npm run db:migrate'
  Write-Host '  npm run db:seed'
}

function Invoke-Start {
  if (Test-Running) { Write-Host "이미 실행 중입니다 (포트 $Port)"; return }
  # 반드시 분리된 프로세스로 띄운다. 호출한 셸이 종료되면 함께 죽는 것을 막는다.
  Start-Process -FilePath (Join-Path $Bin 'pg_ctl.exe') `
    -ArgumentList '-D', "`"$Data`"", '-l', "`"$Log`"", '-o', "`"-p $Port -c listen_addresses=127.0.0.1`"", 'start' `
    -WindowStyle Hidden
  Start-Sleep -Seconds 6
  if (-not (Test-Running)) { throw "PostgreSQL failed: $Log" }
}

function Invoke-Stop {
  if (-not (Test-Running)) { Write-Host '실행 중이 아닙니다'; return }
  & (Join-Path $Bin 'pg_ctl.exe') -D $Data -m fast stop | Out-Null
  Write-Host '중지됨'
}

function Invoke-Status {
  if (Test-Running) {
    Write-Host "실행 중 — 127.0.0.1:$Port  (프로세스 $((Get-Process postgres).Count)개)"
  } else {
    Write-Host '중지 상태'
    if (-not (Test-Path (Join-Path $Data 'PG_VERSION'))) {
      Write-Host '데이터 디렉터리가 없습니다. 먼저 setup 을 실행하십시오.'
    }
  }
}

switch ($Command) {
  'setup'  { Invoke-Setup }
  'start'  { Invoke-Start }
  'stop'   { Invoke-Stop }
  'status' { Invoke-Status }
  'reset'  {
    Invoke-Stop
    if (Test-Path $Data) { Remove-Item $Data -Recurse -Force; Write-Host '데이터 삭제됨' }
    Invoke-Setup
  }
}
