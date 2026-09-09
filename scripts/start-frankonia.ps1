param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
Set-Location $repo
& node scripts/configure-local.mjs
if ($LASTEXITCODE -ne 0) { throw 'Local configuration failed.' }
Set-Location (Join-Path $repo 'fcm')
if (-not (Test-Path node_modules)) { & npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' } }
$pgAction = if (Test-Path (Join-Path $env:LOCALAPPDATA 'fcm-pg/data/PG_VERSION')) { 'start' } else { 'setup' }
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/pg-local.ps1 $pgAction
if ($LASTEXITCODE -ne 0) { throw 'FCM PostgreSQL failed.' }
& npm.cmd run db:migrate
if ($LASTEXITCODE -ne 0) { throw 'FCM migration failed.' }
# Seed only an empty database; the legacy seed script clears existing data.
& node --env-file=.env -e "const{Client}=require('pg');(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL_APP});await c.connect();const r=await c.query('select count(*)::int n from app_user');await c.end();process.exit(r.rows[0].n===0?10:0)})().catch(()=>process.exit(1))"
if ($LASTEXITCODE -eq 10) { & npm.cmd run db:seed; if ($LASTEXITCODE -ne 0) { throw 'Initial FCM setup failed.' } }
elseif ($LASTEXITCODE -ne 0) { throw 'Cannot check FCM accounts.' }
$running = $false
try { $health = Invoke-RestMethod http://127.0.0.1:3002/api/health -TimeoutSec 2; $running = $health.app -eq 'fcm' -and $health.fcmIntegration } catch {}
if (-not $running) {
  if (Get-NetTCPConnection -State Listen -LocalPort 3002 -ErrorAction SilentlyContinue) { throw 'Port 3002 is in use by another app.' }
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'FCM build failed.' }
  $process = Start-Process node -ArgumentList 'node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3002' -WorkingDirectory (Get-Location).Path -WindowStyle Hidden -PassThru -RedirectStandardOutput server.log -RedirectStandardError server-error.log
  $ready = $false
  for ($i=0;$i -lt 60;$i++) {
    if ($process.HasExited) { throw 'FCM exited; check fcm/server-error.log.' }
    try { $health = Invoke-RestMethod http://127.0.0.1:3002/api/health -TimeoutSec 2; if ($health.app -eq 'fcm') { $ready=$true; break } } catch {}
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) { throw 'FCM startup timed out.' }
}
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'fct/scripts/start-local.ps1') -Port 3001 -NoBrowser
if ($LASTEXITCODE -ne 0) { throw 'FCT startup failed.' }
Write-Host 'Frankonia ready: http://127.0.0.1:3002/login'
if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:3002/login' }
