param([ValidateRange(1024,65535)][int]$Port = 3000, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
function Test-Fct {
  try {
    $health = Invoke-RestMethod "http://127.0.0.1:$Port/api/health" -TimeoutSec 2
    $integrated = (Test-Path '.env') -and (Select-String -Path '.env' -Pattern '^FCM_BRIDGE_SECRET=.' -Quiet)
    if ($integrated -and -not $health.fcmIntegration) { return $false }
    return ($health.app -eq 'fct' -and $health.ok -eq $true)
  } catch { return $false }
}
function Run-Npm([string[]]$Arguments) {
  & npm.cmd @Arguments
  if ($LASTEXITCODE -ne 0) { throw "npm $($Arguments -join ' ') failed." }
}
try {
  if (Test-Fct) {
    Write-Host "FCT is already running: http://127.0.0.1:$Port/"
    if (-not $NoBrowser) { Start-Process "http://127.0.0.1:$Port/" }
    exit 0
  }
  if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) {
    throw "Port $Port is in use. Run scripts/start-local.ps1 -Port 3001 and change the port on the Pages start page."
  }
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22 or later first.' }
  $major = [int]((& node -p 'parseInt(process.versions.node)'))
  if ($major -lt 22) { throw 'Node.js 22 or later is required.' }
  foreach ($file in @('prices.json','templates.json')) {
    if (-not (Test-Path "data/$file")) { throw "Copy the internal data file to data/$file first. See data/README.md." }
  }
  if (-not (Test-Path '.env')) {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $secret = [Convert]::ToBase64String($bytes)
    (Get-Content '.env.example' -Raw -Encoding UTF8).Replace('change-this-to-a-long-random-secret-string', $secret) | Set-Content '.env' -Encoding UTF8
  }
  if (-not (Test-Path 'node_modules')) { Run-Npm @('ci') }
  $pgData = Join-Path $env:LOCALAPPDATA 'fct-pg/data/PG_VERSION'
  $pgAction = if (Test-Path $pgData) { 'start' } else { 'setup' }
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$PSScriptRoot/pg-local.ps1" $pgAction
  if ($LASTEXITCODE -ne 0) { throw 'Local PostgreSQL did not start.' }
  Run-Npm @('run','db:setup')
  Run-Npm @('run','build')
  $nodePath = (Get-Command node).Source
  $server = Start-Process -FilePath $nodePath -ArgumentList "node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port $Port" -WorkingDirectory (Get-Location).Path -WindowStyle Hidden -PassThru -RedirectStandardOutput 'server.log' -RedirectStandardError 'server-error.log'
  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    if ($server.HasExited) { throw 'FCT exited. See server-error.log.' }
    if (Test-Fct) { $ready = $true; break }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) { throw 'FCT startup timed out. See server-error.log.' }
  Write-Host "FCT ready: http://127.0.0.1:$Port/"
  if (-not $NoBrowser) { Start-Process "http://127.0.0.1:$Port/" }
} catch {
  Write-Error $_
  exit 1
}
