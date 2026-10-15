param([switch]$TestWorkspace,[switch]$NoBrowser)
$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$python=Join-Path $root '.venv\Scripts\python.exe'
if (!(Test-Path $python)) { throw 'Missing Python environment. See README.md.' }
if ($TestWorkspace) { $env:VOICE_STUDIO_DATA=Join-Path $root 'data\tests\studio' } else { $env:VOICE_STUDIO_DATA=Join-Path $root 'data' }
foreach ($port in @(8765,8766)) {
  if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw "Port $port is already in use. No existing process was stopped. Open http://127.0.0.1:8765 if this studio is running." }
}
foreach ($service in @(@{name='inference';port=8766},@{name='backend';port=8765})) {
  $port=$service.port; $name=$service.name
  if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw "Port $port is already in use. No existing process was stopped." }
  $script=Join-Path $root 'scripts\run_server.py'
  $process=Start-Process $python -ArgumentList @('-u',('"'+$script+'"'),$name) -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root "logs\$name.log") -RedirectStandardError (Join-Path $root "logs\$name-error.log") -PassThru
  $process.Id | Set-Content (Join-Path $root "logs\$name.pid")
}
$ready=$false
for ($attempt=0;$attempt -lt 60;$attempt++) {
  try { $health=Invoke-RestMethod 'http://127.0.0.1:8765/api/health' -TimeoutSec 3; if ($health.status -eq 'ready' -and $health.inference.status -eq 'ready') { $ready=$true; break } } catch {}
  Start-Sleep -Seconds 1
}
if (!$ready) { throw 'Studio did not become ready. Inspect logs\backend-error.log.' }
Write-Host 'Voice Studio: http://127.0.0.1:8765'
Write-Host "Data: $env:VOICE_STUDIO_DATA"
if (!$NoBrowser) { Start-Process 'http://127.0.0.1:8765' }
