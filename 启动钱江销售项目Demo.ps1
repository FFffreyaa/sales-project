$ErrorActionPreference = "Stop"

$demoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeExe = "C:\Users\fengwensheng\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$vinextCli = Join-Path $demoRoot "node_modules\vinext\dist\cli.js"
$wranglerCli = Join-Path $demoRoot "node_modules\wrangler\bin\wrangler.js"
$viteCli = Join-Path $demoRoot "node_modules\vite\bin\vite.js"
$salesPort = 3000
$labPort = 3010
$salesUrl = "http://127.0.0.1:$salesPort/"
$labUrl = "http://127.0.0.1:$labPort/"

foreach ($path in @($nodeExe, $vinextCli, $wranglerCli, $viteCli)) {
  if (-not (Test-Path -LiteralPath $path)) { throw "Required runtime or dependency is missing: $path" }
}

function Test-Url([string]$Url, [string]$Pattern) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 2
    return $response.StatusCode -eq 200 -and $response.Content -match $Pattern
  } catch { return $false }
}

function Test-PortInUse([int]$Port) {
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $connection = $client.ConnectAsync("127.0.0.1", $Port)
    return $connection.Wait(250) -and $client.Connected
  } catch { return $false } finally { $client.Dispose() }
}

$salesReady = Test-Url $salesUrl "QJ"
$labReady = Test-Url $labUrl "本地集成测试台"
if ($salesReady -and $labReady) {
  Write-Host "Sales Project App and Integration Lab are already running."
  Start-Process $salesUrl
  Start-Process $labUrl
  exit 0
}
if (-not $salesReady -and (Test-PortInUse $salesPort)) { throw "Port 3000 is occupied by another program. Close it and retry." }
if (-not $labReady -and (Test-PortInUse $labPort)) { throw "Port 3010 is occupied by another program. Close it and retry." }

$env:WRANGLER_WRITE_LOGS = "false"
$env:WRANGLER_LOG_PATH = Join-Path $demoRoot ".wrangler\wrangler.log"
$env:CI = "true"

Push-Location $demoRoot
try {
  Write-Host "Applying local D1 migrations..."
  & $nodeExe $wranglerCli "d1" "migrations" "apply" "DB" "--config" "wrangler.jsonc" "--local" "--persist-to" ".wrangler\state"
  if ($LASTEXITCODE -ne 0) { throw "D1 migration failed." }
  Write-Host "Building sales project application..."
  & $nodeExe $vinextCli "build"
  if ($LASTEXITCODE -ne 0) { throw "Sales application build failed." }
  Write-Host "Building integration lab..."
  & $nodeExe $viteCli "build" "--config" "integration-lab\vite.config.ts"
  if ($LASTEXITCODE -ne 0) { throw "Integration lab build failed." }
} finally { Pop-Location }

if (-not $salesReady) {
  $salesArgs = @("node_modules\wrangler\bin\wrangler.js", "dev", "--config", "dist\server\wrangler.json", "--local", "--persist-to", ".wrangler\state", "--port", [string]$salesPort)
  $salesProcess = Start-Process -FilePath $nodeExe -ArgumentList $salesArgs -WorkingDirectory $demoRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $demoRoot ".demo-server.out.log") -RedirectStandardError (Join-Path $demoRoot ".demo-server.err.log") -PassThru
  Set-Content -LiteralPath (Join-Path $demoRoot ".demo-server.pid") -Value $salesProcess.Id -Encoding ascii
}
if (-not $labReady) {
  $labArgs = @("node_modules\vite\bin\vite.js", "--config", "integration-lab\vite.config.ts", "--host", "127.0.0.1", "--port", [string]$labPort, "--strictPort")
  $labProcess = Start-Process -FilePath $nodeExe -ArgumentList $labArgs -WorkingDirectory $demoRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $demoRoot ".integration-lab.out.log") -RedirectStandardError (Join-Path $demoRoot ".integration-lab.err.log") -PassThru
  Set-Content -LiteralPath (Join-Path $demoRoot ".integration-lab.pid") -Value $labProcess.Id -Encoding ascii
}

for ($attempt = 0; $attempt -lt 50; $attempt++) {
  Start-Sleep -Milliseconds 500
  $salesReady = Test-Url $salesUrl "QJ"
  $labReady = Test-Url $labUrl "本地集成测试台"
  if ($salesReady -and $labReady) { break }
}
if (-not $salesReady -or -not $labReady) { throw "Startup failed. Check .demo-server.err.log and .integration-lab.err.log." }

Write-Host "Sales Project App: $salesUrl"
Write-Host "Integration Lab: $labUrl"
Start-Process $salesUrl
Start-Process $labUrl
