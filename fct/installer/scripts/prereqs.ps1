# 필수 프로그램 자동 설치
#   1) Node.js  — 앱 서버를 실행한다 (없으면 공식 LTS MSI 를 조용히 설치)
#   2) PostgreSQL — 이 앱 전용으로 설치 폴더 안에만 둔다 (시스템 서비스를 건드리지 않는다)
param([switch]$Quiet)

. (Join-Path $PSScriptRoot "lib.ps1")

$AppDir  = Get-AppDir
$PgDir   = Join-Path $AppDir "pgsql"
$NodeMin = 20

# ---------- Node.js ----------
function Get-NodeVersion {
  try {
    $v = & node --version 2>$null
    if ($v -match 'v(\d+)\.') { return [int]$Matches[1] }
  } catch {}
  return 0
}

function Install-Node {
  Write-Step "Node.js 를 설치합니다"
  $url = $null
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $idx = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json" -TimeoutSec 30
    $lts = $idx | Where-Object { $_.lts -ne $false } | Select-Object -First 1
    if ($lts) { $url = "https://nodejs.org/dist/$($lts.version)/node-$($lts.version)-x64.msi" }
  } catch {
    Write-Log "최신 LTS 목록을 못 읽었습니다 — 고정 버전을 씁니다"
  }
  if (-not $url) { $url = "https://nodejs.org/dist/v22.20.0/node-v22.20.0-x64.msi" }

  $msi = Join-Path $env:TEMP "node-lts-x64.msi"
  if (-not (Download-File $url $msi)) { throw "Node.js 설치 파일을 내려받지 못했습니다. 인터넷 연결을 확인하세요." }
  Write-Log "설치 중… (잠시 걸립니다)"
  $p = Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn /norestart" -Wait -PassThru
  if ($p.ExitCode -ne 0 -and $p.ExitCode -ne 3010) { throw "Node.js 설치 실패 (코드 $($p.ExitCode))" }
  # 새로 깔린 경로를 이 세션에도 반영
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
  Remove-Item $msi -ErrorAction SilentlyContinue
}

# ---------- PostgreSQL (앱 전용) ----------
$PG_URLS = @(
  "https://get.enterprisedb.com/postgresql/postgresql-16.9-1-windows-x64-binaries.zip",
  "https://get.enterprisedb.com/postgresql/postgresql-16.8-1-windows-x64-binaries.zip",
  "https://get.enterprisedb.com/postgresql/postgresql-16.4-1-windows-x64-binaries.zip",
  "https://get.enterprisedb.com/postgresql/postgresql-15.13-1-windows-x64-binaries.zip"
)

function Install-Postgres {
  Write-Step "PostgreSQL 을 설치합니다 (이 앱 전용 · 시스템 설정은 건드리지 않습니다)"
  $zip = Join-Path $env:TEMP "pgsql-binaries.zip"
  $ok = $false
  foreach ($u in $PG_URLS) { if (Download-File $u $zip 2) { $ok = $true; break } }
  if (-not $ok) { throw "PostgreSQL 설치 파일을 내려받지 못했습니다. 인터넷 연결을 확인하세요." }

  $tmp = Join-Path $env:TEMP ("pgx-" + [Guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $tmp -Force | Out-Null
  Write-Log "압축을 푸는 중…"
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [IO.Compression.ZipFile]::ExtractToDirectory($zip, $tmp)
  $src = Join-Path $tmp "pgsql"
  if (-not (Test-Path $src)) { throw "압축 안에서 pgsql 폴더를 찾지 못했습니다." }
  if (Test-Path $PgDir) { Remove-Item $PgDir -Recurse -Force }
  Move-Item $src $PgDir
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item $zip -ErrorAction SilentlyContinue
}

# ---------- 실행 ----------
try {
  Write-Step "필수 프로그램을 확인합니다"

  $nv = Get-NodeVersion
  if ($nv -ge $NodeMin) {
    Write-Log "Node.js v$nv — 이미 설치되어 있습니다"
  } else {
    Install-Node
    $nv = Get-NodeVersion
    if ($nv -lt $NodeMin) { throw "Node.js 를 확인하지 못했습니다. 설치 후 PC 를 다시 시작한 뒤 다시 시도하세요." }
    Write-Log "Node.js v$nv 설치 완료"
  }

  if (Test-Path (Join-Path $PgDir "bin\pg_ctl.exe")) {
    Write-Log "PostgreSQL — 이미 준비되어 있습니다"
  } else {
    Install-Postgres
    Write-Log "PostgreSQL 준비 완료"
  }

  Write-Step "필수 프로그램 확인 끝"
  exit 0
} catch {
  Write-Err $_.Exception.Message
  if (-not $Quiet) { Write-Host ""; Write-Host "자세한 내용: $script:LogFile" }
  exit 1
}
