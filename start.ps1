param(
  [int]$Port = 3000,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host 'Node.js was not found. Install Node.js 22.12+ first: https://nodejs.org/' -ForegroundColor Red
  Read-Host 'Press Enter to exit'
  exit 1
}

$versionText = (node -v).Trim().TrimStart('v')
$version = [version]$versionText
if ($version -lt [version]'22.12.0') {
  Write-Host "Current Node.js $versionText. Node.js 22.12+ is recommended." -ForegroundColor Yellow
}

if (-not (Test-Path (Join-Path $PSScriptRoot 'node_modules'))) {
  Write-Host 'First run: installing dependencies with npm ci (about 2 minutes)...' -ForegroundColor Cyan
  npm ci
  if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
    Write-Host 'npm ci failed. Check the network or use an npm mirror.' -ForegroundColor Red
    Read-Host 'Press Enter to exit'
    exit 1
  }
}

function Test-TcpPort {
  param([int]$p)
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $client.Connect('127.0.0.1', $p)
    $client.Close()
    return $true
  } catch {
    return $false
  } finally {
    if ($client) { $client.Dispose() }
  }
}

function Test-SmartAi {
  param([int]$p)
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$p/api/health" -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -ne 200) { return $false }
    # Only reuse a complete-version instance; an older MVP server is treated as busy.
    return ($response.Content -match '"status"\s*:\s*"ok"' -and $response.Content -match '"policyCount"\s*:\s*[3-9][0-9]')
  } catch {
    return $false
  }
}

$startPort = $Port
$url = $null
for ($candidate = $startPort; $candidate -lt ($startPort + 30); $candidate++) {
  if (Test-SmartAi $candidate) {
    $url = "http://localhost:$candidate"
    Write-Host "Smart AI is already running: $url" -ForegroundColor Green
    if (-not $NoBrowser) { Start-Process $url }
    exit 0
  }
  if (-not (Test-TcpPort $candidate)) {
    $Port = $candidate
    $url = "http://localhost:$Port"
    break
  }
}

if (-not $url) {
  Write-Host 'No free port was found between 3000 and 3029.' -ForegroundColor Red
  Read-Host 'Press Enter to exit'
  exit 1
}

if ($Port -ne $startPort) {
  Write-Host "Port $startPort is busy; using $Port instead." -ForegroundColor Yellow
}

if (-not $NoBrowser) {
  # Poll in a separate hidden PowerShell process. Start-Job can be tied to the
  # console job and may not open the browser reliably on double-click.
  $watcher = @"
`$url = '$url'
for (`$i = 0; `$i -lt 120; `$i++) {
  try {
    `$r = Invoke-WebRequest -Uri "`$url/api/health" -UseBasicParsing -TimeoutSec 2
    if (`$r.StatusCode -eq 200) {
      Start-Process `$url
      break
    }
  } catch { }
  Start-Sleep -Seconds 1
}
"@
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($watcher))
  Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', $encoded | Out-Null
  Write-Host "Browser will open automatically: $url" -ForegroundColor Cyan
}

Write-Host ''
Write-Host '============================================' -ForegroundColor Green
Write-Host " Smart AI is starting: $url" -ForegroundColor Green
Write-Host ' Press Ctrl+C to stop. Close this window when done.' -ForegroundColor Green
Write-Host '============================================' -ForegroundColor Green
Write-Host ''

npm run dev -- -p $Port
if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
  Read-Host 'The dev server stopped with an error. Press Enter to exit'
}
