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
  Write-Host "Current Node.js $versionText. Node.js 22.12+ is recommended (Vitest 5 / Vite 8)." -ForegroundColor Yellow
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

function Test-Port {
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

$startPort = $Port
while (Test-Port $Port) { $Port++ }
if ($Port -ne $startPort) {
  Write-Host "Port $startPort is busy; using $Port instead." -ForegroundColor Yellow
}

$url = "http://localhost:$Port"

if (-not $NoBrowser) {
  Start-Job -ScriptBlock {
    param($u)
    for ($i = 0; $i -lt 60; $i++) {
      try {
        Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 1 | Out-Null
        Start-Process $u
        return
      } catch {
        Start-Sleep -Seconds 1
      }
    }
  } -ArgumentList $url | Out-Null
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
