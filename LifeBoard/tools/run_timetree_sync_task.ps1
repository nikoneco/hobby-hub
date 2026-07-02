$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..\..')
$batPath = Join-Path $scriptDir 'sync_timetree_calendar.local.bat'
$nodeScript = Join-Path $scriptDir 'sync_timetree_calendar.js'
$logDir = Join-Path $repoRoot 'LifeBoard\logs'
$logPath = Join-Path $logDir 'timetree_sync.log'
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

  $tempBase = Join-Path $env:TEMP ('lifeboard_timetree_' + [guid]::NewGuid().ToString('N'))
  $stdoutPath = $tempBase + '.out'
  $stderrPath = $tempBase + '.err'
  $arguments = ('"{0}" --export {1}' -f $nodeScript, $modeFlag)
  $process = Start-Process -FilePath 'node' -ArgumentList $arguments -WorkingDirectory $repoRoot -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
  $exitCode = $process.ExitCode
  foreach ($path in @($stdoutPath, $stderrPath)) {
    if (-not (Test-Path -LiteralPath $path)) {
      continue
    }
    $text = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8).TrimEnd()
    if ($text) {
      Add-Content -Path $logPath -Encoding UTF8 -Value $text
    }
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

Add-Content -Path $logPath -Encoding UTF8 -Value ('[{0}] End TimeTree sync exit={1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $exitCode)
exit $exitCode
