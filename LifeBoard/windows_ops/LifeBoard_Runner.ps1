param(
  [ValidateSet('Bus', 'Pixoo', 'TimeTree', 'All')]
  [string]$Mode = 'All',
  [switch]$DryRun,
  [switch]$NoPreview
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Resolve-LifeBoardRepoRoot {
  $candidates = @(
    $scriptDir,
    (Join-Path $scriptDir 'hobby-hub'),
    (Join-Path $scriptDir '趣味HUB'),
    (Join-Path $scriptDir '..')
  )
  foreach ($candidate in $candidates) {
    $resolved = Resolve-Path -LiteralPath $candidate -ErrorAction SilentlyContinue
    if (-not $resolved) {
      continue
    }
    $lifeBoardDir = Join-Path $resolved.Path 'LifeBoard'
    if (Test-Path -LiteralPath $lifeBoardDir) {
      return $resolved.Path
    }
    if ((Test-Path -LiteralPath (Join-Path $resolved.Path 'bus_fetcher')) -and
        (Test-Path -LiteralPath (Join-Path $resolved.Path 'pixoo_display'))) {
      return (Resolve-Path -LiteralPath (Join-Path $resolved.Path '..')).Path
    }
  }
  throw "LifeBoard folder was not found. Put the LifeBoard folder next to this runner or under $scriptDir\hobby-hub."
}

$repoRoot = Resolve-LifeBoardRepoRoot
$lifeBoardDir = Join-Path $repoRoot 'LifeBoard'
$logDir = Join-Path $lifeBoardDir 'logs'
$logPath = Join-Path $logDir 'lifeboard_ops_runner.log'
$busFetchStatePath = Join-Path $logDir 'bus_last_fetch.txt'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Add-Log {
  param([string]$Message)
  Add-Content -Path $logPath -Encoding UTF8 -Value ('[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message)
}

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

function Import-LocalSettings {
  $busLocalConfig = Join-Path $lifeBoardDir 'bus_fetcher\bus_fetcher.local.ps1'
  $pixooLocalConfig = Join-Path $lifeBoardDir 'pixoo_display\pixoo_display.local.ps1'
  $timeTreeBat = Join-Path $lifeBoardDir 'tools\sync_timetree_calendar.local.bat'

  if (Test-Path -LiteralPath $busLocalConfig) {
    . $busLocalConfig
  }
  if (Test-Path -LiteralPath $pixooLocalConfig) {
    . $pixooLocalConfig
  }

  if (-not $env:LIFEBOARD_IMPORT_TOKEN) {
    $env:LIFEBOARD_IMPORT_TOKEN = Get-BatSetting -Path $timeTreeBat -Name 'LIFEBOARD_IMPORT_TOKEN'
  }
  if (-not $env:LIFEBOARD_IMPORT_URL) {
    $env:LIFEBOARD_IMPORT_URL = Get-BatSetting -Path $timeTreeBat -Name 'LIFEBOARD_IMPORT_URL'
  }
}

function Invoke-LoggedProcess {
  param(
    [string]$FilePath,
    [string]$ArgumentList,
    [string]$StepName
  )

  $tempBase = Join-Path $env:TEMP ('lifeboard_ops_' + [guid]::NewGuid().ToString('N'))
  $stdoutPath = $tempBase + '.out'
  $stderrPath = $tempBase + '.err'
  Add-Log "$StepName`: $FilePath $ArgumentList"
  try {
    $process = Start-Process `
      -FilePath $FilePath `
      -ArgumentList $ArgumentList `
      -WorkingDirectory $repoRoot `
      -WindowStyle Hidden `
      -Wait `
      -PassThru `
      -RedirectStandardOutput $stdoutPath `
      -RedirectStandardError $stderrPath

    foreach ($path in @($stdoutPath, $stderrPath)) {
      if (-not (Test-Path -LiteralPath $path)) {
        continue
      }
      $text = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8).TrimEnd()
      if ($text) {
        Add-Content -Path $logPath -Encoding UTF8 -Value $text
      }
    }
    if ($process.ExitCode -ne 0) {
      throw "$StepName failed with exit code $($process.ExitCode)"
    }
  } finally {
    Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
  }
}

function Invoke-NodeScript {
  param(
    [string]$ScriptPath,
    [string[]]$Arguments,
    [string]$StepName
  )
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $node) {
    throw 'node.exe was not found in PATH. Install Node.js LTS on this PC.'
  }
  $quotedArgs = @('"{0}"' -f $ScriptPath) + $Arguments
  Invoke-LoggedProcess -FilePath $node.Source -ArgumentList ($quotedArgs -join ' ') -StepName $StepName
}

function Get-BusFetchIntervalMinutes {
  $now = Get-Date
  $minutes = ($now.Hour * 60) + $now.Minute
  $morningStart = 6 * 60
  $morningEnd = 7 * 60
  if ($minutes -ge $morningStart -and $minutes -lt $morningEnd) {
    return 1
  }
  return 5
}

function Test-BusFetchDue {
  if (-not (Test-Path -LiteralPath $busFetchStatePath)) {
    return $true
  }

  $lastText = (Get-Content -LiteralPath $busFetchStatePath -Raw -ErrorAction SilentlyContinue).Trim()
  if (-not $lastText) {
    return $true
  }

  try {
    $lastFetch = [DateTime]::Parse($lastText, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind)
  } catch {
    return $true
  }

  $interval = Get-BusFetchIntervalMinutes
  $elapsed = (Get-Date) - $lastFetch
  if ($elapsed.TotalMinutes -ge $interval) {
    return $true
  }

  Add-Log ('bus-fetch skip elapsed={0:N1}m interval={1}m' -f $elapsed.TotalMinutes, $interval)
  return $false
}

function Invoke-Bus {
  if (-not (Test-BusFetchDue)) {
    return
  }
  $script = Join-Path $lifeBoardDir 'bus_fetcher\sync_bus_snapshot.js'
  $modeArg = if ($DryRun) { '--dry-run' } else { '--post' }
  Invoke-NodeScript -ScriptPath $script -Arguments @($modeArg) -StepName 'bus-fetch'
  Set-Content -LiteralPath $busFetchStatePath -Encoding ASCII -Value ((Get-Date).ToUniversalTime().ToString('o'))
}

function Invoke-Pixoo {
  $script = Join-Path $lifeBoardDir 'pixoo_display\pixoo_lifeboard.js'
  $args = @()
  if (-not $DryRun) {
    $args += '--push'
  }
  if ($NoPreview -or -not $DryRun) {
    $args += '--no-preview'
  }
  Invoke-NodeScript -ScriptPath $script -Arguments $args -StepName 'pixoo-render'
}

function Invoke-TimeTree {
  $runner = Join-Path $lifeBoardDir 'tools\run_timetree_sync_task.ps1'
  if (-not (Test-Path -LiteralPath $runner)) {
    throw "TimeTree runner not found: $runner"
  }
  $powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  Invoke-LoggedProcess -FilePath $powershell -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}"' -f $runner) -StepName 'timetree-sync'
}

Import-LocalSettings
Add-Log "Start mode=$Mode dryRun=$([bool]$DryRun)"

try {
  if ($Mode -eq 'Bus' -or $Mode -eq 'All') {
    Invoke-Bus
  }
  if ($Mode -eq 'TimeTree' -or $Mode -eq 'All') {
    Invoke-TimeTree
  }
  if ($Mode -eq 'Pixoo' -or $Mode -eq 'All') {
    Invoke-Pixoo
  }
  Add-Log 'End exit=0'
  exit 0
} catch {
  Add-Log ('ERROR ' + $_.Exception.Message)
  Write-Error $_
  exit 1
}
