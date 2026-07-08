param(
  [switch]$DryRun,
  [switch]$SkipBusFetch,
  [switch]$NoPreview,
  [int]$Brightness = -1
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$lifeBoardDir = Resolve-Path (Join-Path $scriptDir '..')
$repoRoot = Resolve-Path (Join-Path $lifeBoardDir '..')
$busFetcherDir = Join-Path $lifeBoardDir 'bus_fetcher'
$busScript = Join-Path $busFetcherDir 'sync_bus_snapshot.js'
$pixooScript = Join-Path $scriptDir 'pixoo_lifeboard.js'
$localConfig = Join-Path $scriptDir 'pixoo_display.local.ps1'
$busLocalConfig = Join-Path $busFetcherDir 'bus_fetcher.local.ps1'
$timeTreeBat = Join-Path $lifeBoardDir 'tools\sync_timetree_calendar.local.bat'
$logDir = Join-Path $lifeBoardDir 'logs'
$logPath = Join-Path $logDir 'pixoo_manual.log'

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

function Invoke-LoggedNode {
  param(
    [string]$Arguments,
    [string]$StepName
  )

  $tempBase = Join-Path $env:TEMP ('lifeboard_pixoo_' + [guid]::NewGuid().ToString('N'))
  $stdoutPath = $tempBase + '.out'
  $stderrPath = $tempBase + '.err'
  Add-Content -Path $logPath -Encoding UTF8 -Value ('[{0}] {1}: node {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $StepName, $Arguments)
  try {
    $process = Start-Process -FilePath 'node' -ArgumentList $Arguments -WorkingDirectory $repoRoot -NoNewWindow -Wait -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
    foreach ($path in @($stdoutPath, $stderrPath)) {
      if (-not (Test-Path -LiteralPath $path)) {
        continue
      }
      $text = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8).TrimEnd()
      if (-not $text) {
        continue
      }
      [Console]::Out.WriteLine($text)
      Add-Content -Path $logPath -Encoding UTF8 -Value $text
    }
    if ($process.ExitCode -ne 0) {
      throw ('{0} failed with exit code {1}' -f $StepName, $process.ExitCode)
    }
  } finally {
    if (Test-Path -LiteralPath $stdoutPath) {
      Remove-Item -LiteralPath $stdoutPath -Force
    }
    if (Test-Path -LiteralPath $stderrPath) {
      Remove-Item -LiteralPath $stderrPath -Force
    }
  }
}

if (Test-Path -LiteralPath $busLocalConfig) {
  . $busLocalConfig
}
if (Test-Path -LiteralPath $localConfig) {
  . $localConfig
}

if (-not $env:LIFEBOARD_IMPORT_TOKEN) {
  $env:LIFEBOARD_IMPORT_TOKEN = Get-BatSetting -Path $timeTreeBat -Name 'LIFEBOARD_IMPORT_TOKEN'
}

Add-Content -Path $logPath -Encoding UTF8 -Value ''
Add-Content -Path $logPath -Encoding UTF8 -Value ('[{0}] Start Pixoo manual run dryRun={1} skipBusFetch={2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), [bool]$DryRun, [bool]$SkipBusFetch)

Push-Location $repoRoot
try {
  if (-not $SkipBusFetch) {
    $busMode = if ($DryRun) { '--dry-run' } else { '--post' }
    Invoke-LoggedNode -StepName 'bus-fetch' -Arguments ('"{0}" {1}' -f $busScript, $busMode)
  }

  $pixooArgs = @('"{0}"' -f $pixooScript)
  if ($DryRun) {
    # Preview only.
  } else {
    $pixooArgs += '--push'
  }
  if ($NoPreview) {
    $pixooArgs += '--no-preview'
  }
  if ($Brightness -ge 0) {
    $pixooArgs += '--brightness'
    $pixooArgs += [string]$Brightness
  }
  Invoke-LoggedNode -StepName 'pixoo-render' -Arguments ($pixooArgs -join ' ')
  $exitCode = 0
} catch {
  Add-Content -Path $logPath -Encoding UTF8 -Value ('[{0}] ERROR {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $_.Exception.Message)
  Write-Error $_
  $exitCode = 1
} finally {
  Pop-Location
}

Add-Content -Path $logPath -Encoding UTF8 -Value ('[{0}] End Pixoo manual run exit={1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $exitCode)
exit $exitCode
