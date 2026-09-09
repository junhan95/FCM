# Frankonia Calculation Table — 설치·실행 공용 함수
# (PowerShell 5.1 에서도 한글이 깨지지 않도록 이 파일은 BOM 이 있는 UTF-8 로 저장한다)

$ErrorActionPreference = "Stop"

# 설치 폴더 = 이 스크립트의 상위 폴더
function Get-AppDir {
  return (Split-Path -Parent (Split-Path -Parent $PSCommandPath))
}
function Get-DataDir {
  $d = Join-Path $env:ProgramData "FrankoniaCT"
  if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
  return $d
}
function Get-LogDir {
  $d = Join-Path (Get-DataDir) "logs"
  if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
  return $d
}

$script:LogFile = Join-Path (Get-LogDir) ("fct-" + (Get-Date -Format "yyyyMMdd") + ".log")

function Write-Log([string]$msg, [string]$level = "INFO") {
  $line = "{0} [{1}] {2}" -f (Get-Date -Format "HH:mm:ss"), $level, $msg
  try { Add-Content -Path $script:LogFile -Value $line -Encoding UTF8 } catch {}
  if ($level -eq "ERROR") { Write-Host $line -ForegroundColor Red }
  elseif ($level -eq "STEP") { Write-Host $line -ForegroundColor Cyan }
  else { Write-Host $line }
}
function Write-Step([string]$m) { Write-Log $m "STEP" }
function Write-Err([string]$m) { Write-Log $m "ERROR" }

# 포트가 열려 있는지 (127.0.0.1 기준)
function Test-Port([int]$port) {
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $r = $c.BeginConnect("127.0.0.1", $port, $null, $null)
    $ok = $r.AsyncWaitHandle.WaitOne(400, $false)
    if ($ok) { $c.EndConnect($r) | Out-Null }
    $c.Close()
    return $ok
  } catch { return $false }
}

# 비어 있는 포트를 찾는다
function Get-FreePort([int]$from, [int]$tries = 20) {
  for ($p = $from; $p -lt ($from + $tries); $p++) { if (-not (Test-Port $p)) { return $p } }
  return $from
}

function Download-File([string]$url, [string]$dest, [int]$retries = 3) {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  for ($i = 1; $i -le $retries; $i++) {
    try {
      Write-Log "내려받는 중 ($i/$retries): $url"
      $wc = New-Object System.Net.WebClient
      $wc.Headers.Add("User-Agent", "FCT-Installer")
      $wc.DownloadFile($url, $dest)
      if ((Get-Item $dest).Length -gt 0) { return $true }
    } catch {
      Write-Log ("실패: " + $_.Exception.Message) "ERROR"
      Start-Sleep -Seconds 2
    }
  }
  return $false
}

# 프로그램마다 출력 인코딩이 달라(node 는 UTF-8, PostgreSQL 은 시스템 코드페이지)
# UTF-8 로 먼저 읽어 보고, 아니면 시스템 기본 인코딩으로 읽는다.
function Read-TextFile([string]$path) {
  # pg_ctl 이 띄운 서버가 이 파일을 계속 붙들고 있을 수 있어, 공유 모드로 연다
  $bytes = $null
  try {
    $fs = New-Object IO.FileStream($path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
    try {
      $bytes = New-Object byte[] $fs.Length
      [void]$fs.Read($bytes, 0, $bytes.Length)
    } finally { $fs.Dispose() }
  } catch { return @() }
  try {
    $utf8 = New-Object Text.UTF8Encoding($false, $true)
    return $utf8.GetString($bytes) -split "`r?`n"
  } catch {
    return [Text.Encoding]::Default.GetString($bytes) -split "`r?`n"
  }
}

# 외부 실행 파일 실행.
#   · pg_ctl 은 서버를 자식으로 띄우는데, 그 서버가 출력 파이프를 그대로 물고 있어서
#     PowerShell 파이프( | )로 받으면 서버가 죽을 때까지 영영 기다리게 된다.
#     그래서 출력은 파이프가 아니라 임시 파일로 받는다.
#   · PostgreSQL 도구는 정상 진행 상황도 표준 오류로 내보내므로 두 출력을 모두 로그로 옮긴다.
# 돌려주는 값은 종료 코드.
function Invoke-Native {
  param([string]$Exe, [string[]]$ArgList, [int]$TimeoutSec = 300)
  $out = [IO.Path]::GetTempFileName()
  $errf = [IO.Path]::GetTempFileName()
  try {
    # 공백이 든 인자는 따옴표로 묶는다 (Start-Process 는 알아서 해 주지 않는다)
    $quoted = @()
    foreach ($a in $ArgList) {
      if ($a -match '[\s]' -and $a -notmatch '^".*"$') { $quoted += ('"' + $a + '"') } else { $quoted += $a }
    }
    $sp = @{ FilePath = $Exe; NoNewWindow = $true; PassThru = $true;
             RedirectStandardOutput = $out; RedirectStandardError = $errf }
    if ($quoted.Count) { $sp["ArgumentList"] = $quoted }
    # -Wait 는 손자 프로세스까지 기다린다. pg_ctl 이 띄운 서버는 계속 돌아야 하므로
    # 부른 프로그램 하나만 기다린다.
    $p = Start-Process @sp
    # Handle 을 한 번 만져 둬야 나중에 ExitCode 를 읽을 수 있다 (PowerShell 의 오래된 버릇)
    $null = $p.Handle
    if (-not $p.WaitForExit($TimeoutSec * 1000)) {
      Write-Log "$Exe 이(가) $TimeoutSec 초 안에 끝나지 않아 중단합니다" "ERROR"
      try { $p.Kill() } catch {}
      return 124
    }
    foreach ($f in @($out, $errf)) {
      if ((Test-Path $f) -and (Get-Item $f).Length -gt 0) {
        foreach ($line in (Read-TextFile $f)) { if ($line -and $line.Trim()) { Write-Log $line } }
      }
    }
    $code = $p.ExitCode
    if ($null -eq $code) { $code = 0 }
    return [int]$code
  } finally {
    Remove-Item $out, $errf -Force -ErrorAction SilentlyContinue
  }
}

# .env 파일을 읽어 해시로 돌려준다
function Read-EnvFile([string]$path) {
  $h = @{}
  if (-not (Test-Path $path)) { return $h }
  foreach ($line in Get-Content $path) {
    if ($line -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$') {
      $h[$Matches[1]] = $Matches[2].Trim('"').Trim("'")
    }
  }
  return $h
}

# 예전 설치본은 세션 키를 AUTH_SECRET 이라는 틀린 이름으로 적었다.
# 앱은 SESSION_SECRET 을 읽으므로, 있으면 이름만 고쳐 주고 없으면 새로 만든다.
function Repair-EnvFile([string]$path) {
  if (-not (Test-Path $path)) { return $false }
  $lines = @(Get-Content $path)
  $has = $lines | Where-Object { $_ -match '^\s*SESSION_SECRET\s*=\s*\S' }
  if ($has) { return $false }
  $old = $lines | Where-Object { $_ -match '^\s*AUTH_SECRET\s*=\s*(\S+)' }
  if ($old) {
    $lines = $lines | ForEach-Object { $_ -replace '^\s*AUTH_SECRET\s*=', 'SESSION_SECRET=' }
  } else {
    $lines += ("SESSION_SECRET=" + (New-Secret 32))
  }
  [IO.File]::WriteAllLines($path, $lines, (New-Object Text.UTF8Encoding($false)))
  Write-Log "설정 파일의 세션 키 항목을 고쳤습니다 — $path"
  return $true
}

# 우리가 띄워 둔 앱 서버를 내린다 (기록해 둔 포트를 듣고 있는 node 만)
function Stop-AppServer([string]$portFile) {
  if (-not (Test-Path $portFile)) { return }
  $port = [int](((Get-Content $portFile | Select-Object -First 1) -replace '\D', ''))
  if ($port -le 0) { return }
  try {
    foreach ($c in (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)) {
      $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
      if ($p -and $p.ProcessName -eq "node") {
        Write-Log "설정이 바뀌어 앱 서버를 다시 시작합니다 (pid $($p.Id))"
        Stop-Process -Id $p.Id -Force
        Start-Sleep -Milliseconds 800
      }
    }
  } catch {}
}

function New-Secret([int]$bytes = 32) {
  $b = New-Object byte[] $bytes
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  return ([Convert]::ToBase64String($b) -replace '[^A-Za-z0-9]', '')
}
