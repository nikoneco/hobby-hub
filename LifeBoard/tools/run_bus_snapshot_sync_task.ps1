param(
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..\..')
$batPath = Join-Path $scriptDir 'sync_timetree_calendar.local.bat'
$nodeScript = Join-Path $scriptDir 'sync_bus_snapshot.js'
$logDir = Join-Path $repoRoot 'LifeBoard\logs'
$logPath = Join-Path $logDir 'bus_snapshot_sync.log'
$stdoutPath = Join-Path $logDir 'bus_snapshot_sync_stdout.tmp'
$stderrPath = Join-Path $logDir 'bus_snapshot_sync_stderr.tmp'

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Get-BatSetting {
  param(
    [string]$Name
  )
  if (-not (Test-Path -LiteralPath $batPath)) {
    return ''
  }
  $pattern = '^set "' + [regex]::Escape($Name) + '=(.*)"$'
  $line = Select-String -Path $batPath -Pattern $pattern | Select-Object -First 1
  if ($line -and $line.Line -match $pattern) {
    return $Matches[1]
  }
  return ''
}

Add-Content -Path $logPath -Encoding UTF8 -Value ''
Add-Content -Path $logPath -Encoding UTF8 -Value ('[{0}] Start bus snapshot sync' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))

Push-Location $repoRoot
try {
  $env:LIFEBOARD_IMPORT_TOKEN = Get-BatSetting 'LIFEBOARD_IMPORT_TOKEN'
  $modeFlag = if ($DryRun) { '--dry-run' } else { '--post' }

  Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
  & node $nodeScript $modeFlag > $stdoutPath 2> $stderrPath
  $exitCode = $LASTEXITCODE
  if (Test-Path -LiteralPath $stdoutPath) {
    Add-Content -Path $logPath -Encoding UTF8 -Value (Get-Content -LiteralPath $stdoutPath -Raw)
  }
  if (Test-Path -LiteralPath $stderrPath) {
    Add-Content -Path $logPath -Encoding UTF8 -Value (Get-Content -LiteralPath $stderrPath -Raw)
  }
} catch {
  Add-Content -Path $logPath -Encoding UTF8 -Value ('[{0}] ERROR {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $_.Exception.Message)
  $exitCode = 1
} finally {
  Pop-Location
}

Add-Content -Path $logPath -Encoding UTF8 -Value ('[{0}] End bus snapshot sync exit={1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $exitCode)
exit $exitCode
