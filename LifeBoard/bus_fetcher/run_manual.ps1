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
  $tempBase = Join-Path $env:TEMP ('lifeboard_bus_' + [guid]::NewGuid().ToString('N'))
  $stdoutPath = $tempBase + '.out'
  $stderrPath = $tempBase + '.err'
  $arguments = ('"{0}" {1}' -f $nodeScript, $modeFlag)
  $process = Start-Process -FilePath 'node' -ArgumentList $arguments -WorkingDirectory $repoRoot -NoNewWindow -Wait -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
  $exitCode = $process.ExitCode
  foreach ($path in @($stdoutPath, $stderrPath)) {
    if (-not (Test-Path -LiteralPath $path)) {
      continue
    }
    $text = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8).TrimEnd()
    if (-not $text) {
      continue
    }
    Write-Output $text
    Add-Content -Path $logPath -Encoding UTF8 -Value $text
  }
} catch {
  Add-Content -Path $logPath -Encoding UTF8 -Value ('[{0}] ERROR {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $_.Exception.Message)
  $exitCode = 1
} finally {
  if ($stdoutPath -and (Test-Path -LiteralPath $stdoutPath)) {
    Remove-Item -LiteralPath $stdoutPath -Force
  }
  if ($stderrPath -and (Test-Path -LiteralPath $stderrPath)) {
    Remove-Item -LiteralPath $stderrPath -Force
  }
  Pop-Location
}

Add-Content -Path $logPath -Encoding UTF8 -Value ('[{0}] End manual bus fetch exit={1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $exitCode)
exit $exitCode
