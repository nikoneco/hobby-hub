param(
  [switch]$Push,
  [ValidateSet('command_list', 'frame_by_frame')]
  [string]$Mode = 'command_list',
  [int]$SpeedMs = 650
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$lifeBoardDir = Resolve-Path (Join-Path $scriptDir '..')
$python = Join-Path $scriptDir '.venv\Scripts\python.exe'
$testScript = Join-Path $scriptDir 'test_pixoo_animation.py'
$pixooConfig = Join-Path $lifeBoardDir 'pixoo_display\pixoo_display.local.ps1'

if (-not (Test-Path -LiteralPath $python)) {
  throw "Animation test venv not found: $python"
}
if (Test-Path -LiteralPath $pixooConfig) {
  . $pixooConfig
}

$arguments = @(
  $testScript,
  '--mode', $Mode,
  '--speed-ms', [string]$SpeedMs
)
if ($Push) {
  if (-not $env:PIXOO_IP) {
    throw 'PIXOO_IP is not configured'
  }
  $arguments += @('--push', '--pixoo-ip', $env:PIXOO_IP)
}

& $python @arguments
exit $LASTEXITCODE
