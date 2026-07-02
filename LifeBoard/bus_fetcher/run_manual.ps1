param(
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..\..')
$nodeScript = Join-Path $scriptDir 'sync_bus_snapshot.js'
$localConfig = Join-Path $scriptDir 'bus_fetcher.local.ps1'
$timeTreeBat = Join-Path $repoRoot 'LifeBoard\tools\sync_timetree_calendar.local.bat'
$logDir = Join-Path $repoRoot 'LifeBoard\logs'
$logPath = Join-Path $logDir 'bus_fetcher_manual.log'

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Get-BatSetting {
  param(
    [string]$Path,
    [string]$Name
  )
  if (-not (Test-Path -LiteralPath $Path)) {
    return ''
  }
  $pattern = '^set "' + [regex]::Escape($Name) + '=(.*)"$'
  $line = Select-String -Path $Path -Pattern $pattern | Select-Object -First 1
  if ($line -and $line.Line -match $pattern) {
    return $Matches[1]
  }
  return ''
}

if (Test-Path -LiteralPath $localConfig) {
  . $localConfig
}

if (-not $env:LIFEBOARD_IMPORT_TOKEN) {
  $env:LIFEBOARD_IMPORT_TOKEN = Get-BatSetting -Path $timeTreeBat -Name 'LIFEBOARD_IMPORT_TOKEN'
}

$modeFlag = if ($DryRun) { '--dry-run' } else { '--post' }

Add-Content -Path $logPath -Encoding UTF8 -Value ''
Add-Content -Path $logPath -Encoding UTF8 -Value ('[{0}] Start manual bus fetch mode={1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $modeFlag)

Push-Location $repoRoot
try {
  & node $nodeScript $modeFlag 2>&1 | Tee-Object -FilePath $logPath -Append
  $exitCode = $LASTEXITCODE
} catch {
  Add-Content -Path $logPath -Encoding UTF8 -Value ('[{0}] ERROR {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $_.Exception.Message)
  $exitCode = 1
} finally {
  Pop-Location
}

Add-Content -Path $logPath -Encoding UTF8 -Value ('[{0}] End manual bus fetch exit={1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $exitCode)
exit $exitCode
