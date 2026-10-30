# deploy.ps1
# Package the Smart AI project and deploy it to an Ubuntu server over SSH.
#
# Package only:
#   powershell -ExecutionPolicy Bypass -File .\deploy\deploy.ps1 -Server 127.0.0.1 -Domain test.example.com -PackageOnly
#
# Deploy (password prompt):
#   powershell -ExecutionPolicy Bypass -File .\deploy\deploy.ps1 -Server 1.2.3.4 -User root -Domain demo.example.com
#
# Deploy with a key:
#   powershell -ExecutionPolicy Bypass -File .\deploy\deploy.ps1 -Server 1.2.3.4 -Domain demo.example.com -KeyPath C:\keys\smartai.pem

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Server,
  [string]$User = 'root',
  [Parameter(Mandatory = $true)][string]$Domain,
  [int]$SshPort = 22,
  [string]$KeyPath = '',
  [string]$Project = '',
  [switch]$PackageOnly
)

$ErrorActionPreference = 'Stop'

$deployDir = $PSScriptRoot
$project = if ($Project) { $Project } else { Split-Path $deployDir -Parent }
$stage = Join-Path $env:TEMP 'smartai-deploy-stage'
$zip = Join-Path $deployDir 'smartai-src.zip'

if ($Domain -notmatch '^[a-zA-Z0-9.-]+$') { throw "Invalid domain: $Domain" }
if ($Server -notmatch '^[a-zA-Z0-9.:-]+$') { throw "Invalid server: $Server" }

Write-Host '==> Staging source (excluding node_modules, .next, .git)'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null

$roboArgs = @(
  $project, $stage, '/E',
  '/XD', 'node_modules', '.next', '.git', 'playwright-report', 'test-results', 'deploy',
  '/XF', '.env', '*.tsbuildinfo',
  '/NFL', '/NDL', '/NJH', '/NJS', '/NP'
)
robocopy @roboArgs | Out-Null

$stageDeploy = Join-Path $stage 'deploy'
New-Item -ItemType Directory -Path $stageDeploy -Force | Out-Null
Copy-Item (Join-Path $deployDir 'docker-compose.prod.yml') $stageDeploy -Force
Copy-Item (Join-Path $deployDir 'Caddyfile') $stageDeploy -Force

# Force LF for the shell script: a CRLF shebang fails on Linux with
# "/usr/bin/env bash^M: bad interpreter".
$bootstrapText = [IO.File]::ReadAllText((Join-Path $deployDir 'bootstrap.sh')) -replace "`r`n", "`n"
[IO.File]::WriteAllText(
  (Join-Path $stageDeploy 'bootstrap.sh'),
  $bootstrapText,
  (New-Object System.Text.UTF8Encoding($false))
)

if (Test-Path $zip) { Remove-Item $zip -Force }

# Use Windows tar (bsdtar) when available: it writes forward-slash zip entries,
# which Linux unzip needs. Compress-Archive on PowerShell 5.1 writes backslashes.
$tar = Get-Command tar.exe -ErrorAction SilentlyContinue
if ($tar) {
  & tar.exe -a -c -f $zip -C $stage .
  if ($LASTEXITCODE -ne 0) { throw 'tar failed to create the zip' }
} else {
  Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -CompressionLevel Optimal
}

$zipMb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host "==> Package: $zip ($zipMb MB)"

if ($PackageOnly) {
  Write-Host '==> PackageOnly: skip upload'
  return
}

foreach ($cmd in 'ssh', 'scp') {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    throw "$cmd not found. Install OpenSSH Client in Windows Optional Features."
  }
}

$sshOpts = @('-p', "$SshPort", '-o', 'StrictHostKeyChecking=accept-new')
$scpOpts = @('-P', "$SshPort", '-o', 'StrictHostKeyChecking=accept-new')
if ($KeyPath) {
  if (-not (Test-Path $KeyPath)) { throw "Key not found: $KeyPath" }
  $sshOpts += @('-i', $KeyPath)
  $scpOpts += @('-i', $KeyPath)
}

Write-Host "==> Uploading package and bootstrap to ${User}@${Server}"
& scp @scpOpts $zip (Join-Path $deployDir 'bootstrap.sh') "${User}@${Server}:/root/"
if ($LASTEXITCODE -ne 0) { throw 'scp failed' }

Write-Host '==> Running bootstrap on the server (5-10 minutes)'
$remote = "DOMAIN='$Domain' bash /root/bootstrap.sh /root/smartai-src.zip"
& ssh @sshOpts "${User}@${Server}" $remote
if ($LASTEXITCODE -ne 0) { throw 'remote bootstrap failed' }

Write-Host ''
Write-Host "==> Done. Open: https://$Domain"
Write-Host "==> Health: curl -fsS https://$Domain/api/health"
Write-Host "==> Logs:   ssh -p $SshPort ${User}@${Server} 'cd /opt/smartai/deploy && docker compose -f docker-compose.prod.yml logs -f --tail=100'"
