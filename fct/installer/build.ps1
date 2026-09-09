# Frankonia Calculation Table — 설치 프로그램 만들기 (Windows 에서 실행)
#
#   cd D:\FRANKONIA\FCT\fct-app
#   powershell -ExecutionPolicy Bypass -File installer\build.ps1
#
# 결과: installer\out\FCT-Setup-<버전>.exe
param(
  [switch]$SkipBuild,   # 앱 빌드를 건너뛴다 (.next 가 이미 최신일 때)
  [switch]$PayloadOnly  # 설치 파일 컴파일 없이 payload 만 만든다
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot      # fct-app
$Inst = $PSScriptRoot                          # fct-app\installer
$Payload = Join-Path $Inst "payload"

function Step($m) { Write-Host "`n== $m" -ForegroundColor Cyan }

Push-Location $Root
try {
  # ---------- 1) 앱 빌드 ----------
  if (-not $SkipBuild) {
    if (-not (Test-Path (Join-Path $Root "node_modules"))) {
      Step "의존성 설치 (npm install)"
      & npm install
      if ($LASTEXITCODE -ne 0) { throw "npm install 실패" }
    }
    Step "앱 빌드 (next build — standalone)"
    & npx next build
    if ($LASTEXITCODE -ne 0) { throw "next build 실패" }
  }
  if (-not (Test-Path (Join-Path $Root ".next\standalone\server.js"))) {
    throw ".next\standalone 이 없습니다. next.config 의 output:'standalone' 을 확인하세요."
  }

  # ---------- 2) payload 모으기 ----------
  Step "설치 파일에 넣을 내용 모으기"
  if (Test-Path $Payload) { Remove-Item $Payload -Recurse -Force }
  New-Item -ItemType Directory -Path $Payload -Force | Out-Null

  Copy-Item (Join-Path $Root ".next\standalone\*") $Payload -Recurse -Force
  New-Item -ItemType Directory -Path (Join-Path $Payload ".next") -Force | Out-Null
  Copy-Item (Join-Path $Root ".next\static") (Join-Path $Payload ".next\static") -Recurse -Force
  Copy-Item (Join-Path $Root "public") (Join-Path $Payload "public") -Recurse -Force

  # 개발용 .env 는 절대 넣지 않는다
  Remove-Item (Join-Path $Payload ".env") -Force -ErrorAction SilentlyContinue

  New-Item -ItemType Directory -Path (Join-Path $Payload "data") -Force | Out-Null
  Copy-Item (Join-Path $Root "data\prices.json")    (Join-Path $Payload "data") -Force
  Copy-Item (Join-Path $Root "data\templates.json") (Join-Path $Payload "data") -Force
  New-Item -ItemType Directory -Path (Join-Path $Payload "db") -Force | Out-Null
  Copy-Item (Join-Path $Root "db\schema.sql") (Join-Path $Payload "db") -Force

  # ---------- 3) DB 초기화 스크립트를 단독 실행 가능한 JS 로 ----------
  Step "초기 데이터 스크립트 묶기 (esbuild)"
  New-Item -ItemType Directory -Path (Join-Path $Payload "scripts") -Force | Out-Null
  & npx esbuild "scripts/db_setup.ts" --bundle --platform=node --format=cjs --target=node20 `
      --external:pg --outfile="$($Payload)\scripts\db_setup.cjs"
  if ($LASTEXITCODE -ne 0) { throw "db_setup 묶기 실패" }

  # ---------- 4) 실행·설치 스크립트 ----------
  Copy-Item (Join-Path $Inst "scripts\*") (Join-Path $Payload "scripts") -Recurse -Force
  Copy-Item (Join-Path $Inst "assets")  (Join-Path $Payload "assets")  -Recurse -Force
  Copy-Item (Join-Path $Inst "FCT.vbs")      $Payload -Force
  Copy-Item (Join-Path $Inst "FCT-Stop.vbs") $Payload -Force

  $size = "{0:N1} MB" -f ((Get-ChildItem $Payload -Recurse -File | Measure-Object Length -Sum).Sum / 1MB)
  Write-Host "   payload: $size"
  if ($PayloadOnly) { Write-Host "`npayload 만 만들었습니다: $Payload"; return }

  # ---------- 5) Inno Setup 으로 컴파일 ----------
  Step "설치 프로그램 컴파일"
  $iscc = $null
  foreach ($p in @(
      "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
      "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
      "${env:LOCALAPPDATA}\Programs\Inno Setup 6\ISCC.exe")) {
    if (Test-Path $p) { $iscc = $p; break }
  }
  if (-not $iscc) {
    Write-Host "   Inno Setup 이 없어 설치합니다 (winget)"
    & winget install --id JRSoftware.InnoSetup --silent --accept-package-agreements --accept-source-agreements
    foreach ($p in @("${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe")) {
      if (Test-Path $p) { $iscc = $p; break }
    }
  }
  if (-not $iscc) { throw "Inno Setup(ISCC.exe) 을 찾지 못했습니다. https://jrsoftware.org/isdl.php 에서 설치하세요." }

  & $iscc (Join-Path $Inst "fct.iss")
  if ($LASTEXITCODE -ne 0) { throw "설치 프로그램 컴파일 실패" }

  $exe = Get-ChildItem (Join-Path $Inst "out") -Filter "FCT-Setup-*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  Write-Host ("`n완료 → {0}  ({1:N1} MB)" -f $exe.FullName, ($exe.Length / 1MB)) -ForegroundColor Green
} finally {
  Pop-Location
}
