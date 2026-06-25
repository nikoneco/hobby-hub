$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..\..')
$batPath = Join-Path $scriptDir 'sync_timetree_calendar.local.bat'
$nodeScript = Join-Path $scriptDir 'sync_timetree_calendar.js'
$logDir = Join-Path $repoRoot 'LifeBoard\logs'
$logPath = Join-Path $logDir 'timetree_sync.log'
$stdoutPath = Join-Path $logDir 'timetree_sync_stdout.tmp'
$stderrPath = Join-Path $logDir 'timetree_sync_stderr.tmp'
$defaultPythonPath = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python310\python.exe'

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Get-BatSetting {
  param(
    [string]$Name
  )
  $pattern = '^set "' + [regex]::Escape($Name) + '=(.*)"$'
  $line = Select-String -Path $batPath -Pattern $pattern | Select-Object -First 1
  if ($line -and $line.Line -match $pattern) {
    return $Matches[1]
  }
  return ''
}

Add-Content -Path $logPath -Encoding UTF8 -Value ''
Add-Content -Path $logPath -Encoding UTF8 -Value ('[{0}] Start TimeTree sync' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))

Push-Location $repoRoot
try {
  $env:TIMETREE_EMAIL = Get-BatSetting 'LIFEBOARD_TIMETREE_EMAIL'
  $env:TIMETREE_PASSWORD = Get-BatSetting 'LIFEBOARD_TIMETREE_PASSWORD'
  $env:TIMETREE_CALENDAR_SELECTION = Get-BatSetting 'LIFEBOARD_TIMETREE_CALENDAR_SELECTION'
  $env:LIFEBOARD_IMPORT_TOKEN = Get-BatSetting 'LIFEBOARD_IMPORT_TOKEN'
  if (Test-Path -LiteralPath $defaultPythonPath) {
    $env:TIMETREE_EXPORTER_COMMAND = ('"{0}" -m timetree_exporter' -f $defaultPythonPath)
  } elseif (Get-Command py.exe -ErrorAction SilentlyContinue) {
    $env:TIMETREE_EXPORTER_COMMAND = 'py -3.10 -m timetree_exporter'
  }
  $syncMode = Get-BatSetting 'SYNC_MODE'
  $modeFlag = if ($syncMode -ieq 'POST') { '--post' } else { '--dry-run' }

  Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
  $process = Start-Process `
    -FilePath 'node' `
    -ArgumentList @($nodeScript, '--export', $modeFlag) `
    -WorkingDirectory $repoRoot `
    -NoNewWindow `
    -Wait `
    -PassThru `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath
  $exitCode = $process.ExitCode
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

Add-Content -Path $logPath -Encoding UTF8 -Value ('[{0}] End TimeTree sync exit={1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $exitCode)
exit $exitCode
