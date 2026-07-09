param(
  [string]$PixooIp = '192.168.0.92',
  [int]$BusIntervalMinutes = 1,
  [int]$PixooIntervalMinutes = 1,
  [int]$TimeTreeIntervalMinutes = 60,
  [switch]$SkipTimeTree,
  [switch]$RunNow,
  [switch]$Unregister
)

$ErrorActionPreference = 'Stop'

function Test-IsAdministrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-IsAdministrator)) {
  $setupPath = if ($PSCommandPath) { $PSCommandPath } else { $MyInvocation.MyCommand.Path }
  $powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $adminArgs = @(
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    ('"{0}"' -f $setupPath),
    '-PixooIp',
    ('"{0}"' -f $PixooIp),
    '-BusIntervalMinutes',
    $BusIntervalMinutes,
    '-PixooIntervalMinutes',
    $PixooIntervalMinutes,
    '-TimeTreeIntervalMinutes',
    $TimeTreeIntervalMinutes
  )
  if ($SkipTimeTree) { $adminArgs += '-SkipTimeTree' }
  if ($RunNow) { $adminArgs += '-RunNow' }
  if ($Unregister) { $adminArgs += '-Unregister' }

  Write-Host 'Task registration needs administrator permission. Opening UAC prompt...' -ForegroundColor Yellow
  $process = Start-Process -FilePath $powershell -ArgumentList $adminArgs -Verb RunAs -Wait -PassThru
  if ($null -ne $process.ExitCode) {
    exit $process.ExitCode
  }
  exit 0
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerPath = Join-Path $scriptDir 'LifeBoard_Runner.ps1'
$hiddenRunnerPath = Join-Path $scriptDir 'LifeBoard_RunHidden.vbs'

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
  throw "LifeBoard folder was not found. Put the LifeBoard folder next to this setup script. Example: C:\アプリ運用\LifeBoard"
}

function Read-Default {
  param(
    [string]$Prompt,
    [string]$Default = ''
  )
  if ($Default) {
    $value = Read-Host "$Prompt [$Default]"
    if (-not $value) {
      return $Default
    }
    return $value
  }
  return Read-Host $Prompt
}

function Read-SecretText {
  param([string]$Prompt)
  $secure = Read-Host $Prompt -AsSecureString
  if (-not $secure.Length) {
    return ''
  }
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

function Escape-SingleQuotedPowerShell {
  param([string]$Value)
  return $Value.Replace("'", "''")
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

function Write-LocalSettings {
  param(
    [string]$LifeBoardDir
  )

  $busConfig = Join-Path $LifeBoardDir 'bus_fetcher\bus_fetcher.local.ps1'
  $pixooConfig = Join-Path $LifeBoardDir 'pixoo_display\pixoo_display.local.ps1'
  $timeTreeBat = Join-Path $LifeBoardDir 'tools\sync_timetree_calendar.local.bat'

  $existingImportUrl = ''
  $existingToken = ''
  if (Test-Path -LiteralPath $busConfig) {
    $busText = Get-Content -LiteralPath $busConfig -Raw
    $urlMatch = [regex]::Match($busText, "LIFEBOARD_IMPORT_URL\s*=\s*'([^']*)'")
    $tokenMatch = [regex]::Match($busText, "LIFEBOARD_IMPORT_TOKEN\s*=\s*'([^']*)'")
    if ($urlMatch.Success) { $existingImportUrl = $urlMatch.Groups[1].Value }
    if ($tokenMatch.Success) { $existingToken = $tokenMatch.Groups[1].Value }
  }
  if (-not $existingImportUrl) {
    $existingImportUrl = Get-BatSetting -Path $timeTreeBat -Name 'LIFEBOARD_IMPORT_URL'
  }
  if (-not $existingToken) {
    $existingToken = Get-BatSetting -Path $timeTreeBat -Name 'LIFEBOARD_IMPORT_TOKEN'
  }

  $importUrl = Read-Default -Prompt 'LifeBoard GAS Web App URL' -Default $existingImportUrl
  Write-Host 'LifeBoard import token input is visible so it can be pasted.' -ForegroundColor Yellow
  $tokenPrompt = if ($existingToken) { 'LifeBoard import token (blank keeps current)' } else { 'LifeBoard import token' }
  $tokenInput = Read-Default -Prompt $tokenPrompt
  $importToken = if ($tokenInput) { $tokenInput } else { $existingToken }

  if (-not $importUrl) {
    throw 'LifeBoard GAS Web App URL is required.'
  }
  if (-not $importToken) {
    throw 'LifeBoard import token is required.'
  }

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $busConfig), (Split-Path -Parent $pixooConfig) | Out-Null
  Set-Content -LiteralPath $busConfig -Encoding UTF8 -Value @(
    ('$env:LIFEBOARD_IMPORT_URL = ''{0}''' -f (Escape-SingleQuotedPowerShell $importUrl)),
    ('$env:LIFEBOARD_IMPORT_TOKEN = ''{0}''' -f (Escape-SingleQuotedPowerShell $importToken))
  )
  Set-Content -LiteralPath $pixooConfig -Encoding UTF8 -Value @(
    ('$env:PIXOO_IP = ''{0}''' -f (Escape-SingleQuotedPowerShell $PixooIp)),
    ('$env:LIFEBOARD_IMPORT_URL = ''{0}''' -f (Escape-SingleQuotedPowerShell $importUrl)),
    ('$env:LIFEBOARD_IMPORT_TOKEN = ''{0}''' -f (Escape-SingleQuotedPowerShell $importToken))
  )

  if (-not $SkipTimeTree) {
    $configureTimeTree = 'N'
    if (-not (Test-Path -LiteralPath $timeTreeBat)) {
      $configureTimeTree = Read-Default -Prompt 'Create TimeTree local config? Y/N' -Default 'N'
    }
    if ($configureTimeTree -match '^(Y|y)') {
      $email = Read-Default -Prompt 'TimeTree email'
      $password = Read-SecretText -Prompt 'TimeTree password'
      $selection = Read-Default -Prompt 'TimeTree calendar selection' -Default '1'
      Set-Content -LiteralPath $timeTreeBat -Encoding ASCII -Value @(
        ('set "LIFEBOARD_TIMETREE_EMAIL={0}"' -f $email),
        ('set "LIFEBOARD_TIMETREE_PASSWORD={0}"' -f $password),
        ('set "LIFEBOARD_TIMETREE_CALENDAR_SELECTION={0}"' -f $selection),
        ('set "LIFEBOARD_IMPORT_URL={0}"' -f $importUrl),
        ('set "LIFEBOARD_IMPORT_TOKEN={0}"' -f $importToken),
        'set "SYNC_MODE=POST"'
      )
    }
  }
}

function New-LifeBoardTask {
  param(
    [string]$TaskName,
    [string]$Mode,
    [int]$IntervalMinutes
  )
  if ($IntervalMinutes -lt 1) {
    throw "$TaskName interval must be 1 or greater."
  }
  $wscript = Join-Path $env:SystemRoot 'System32\wscript.exe'
  $arguments = '"{0}" "-Mode" "{1}"' -f $hiddenRunnerPath, $Mode
  if ($Mode -eq 'Pixoo') {
    $arguments += ' "-NoPreview"'
  }
  $action = New-ScheduledTaskAction -Execute $wscript -Argument $arguments
  $triggers = @(
    (New-ScheduledTaskTrigger -AtStartup),
    (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) -RepetitionDuration (New-TimeSpan -Days 3650))
  )
  $settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -Hidden

  Register-ScheduledTask `
    -TaskName $TaskName `
    -TaskPath '\LifeBoard\' `
    -Action $action `
    -Trigger $triggers `
    -Settings $settings `
    -Description ('LifeBoard runner mode: {0}' -f $Mode) `
    -Force | Out-Null

  if ($RunNow) {
    Start-ScheduledTask -TaskPath '\LifeBoard\' -TaskName $TaskName
  }
  Write-Host ('Registered: \LifeBoard\{0} every {1} minute(s), plus startup' -f $TaskName, $IntervalMinutes)
}

if (-not (Test-Path -LiteralPath $runnerPath)) {
  throw "Runner not found: $runnerPath"
}
if (-not (Test-Path -LiteralPath $hiddenRunnerPath)) {
  throw "Hidden runner not found: $hiddenRunnerPath"
}

if ($Unregister) {
  foreach ($name in @('LifeBoard Bus Fetcher', 'LifeBoard Pixoo Display', 'LifeBoard TimeTree Calendar Sync')) {
    Unregister-ScheduledTask -TaskPath '\LifeBoard\' -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host ('Unregistered if present: \LifeBoard\{0}' -f $name)
  }
  exit 0
}

$repoRoot = Resolve-LifeBoardRepoRoot
$lifeBoardDir = Join-Path $repoRoot 'LifeBoard'

Write-Host ('LifeBoard root: {0}' -f $lifeBoardDir)
Write-LocalSettings -LifeBoardDir $lifeBoardDir

New-LifeBoardTask -TaskName 'LifeBoard Bus Fetcher' -Mode 'Bus' -IntervalMinutes $BusIntervalMinutes
New-LifeBoardTask -TaskName 'LifeBoard Pixoo Display' -Mode 'Pixoo' -IntervalMinutes $PixooIntervalMinutes
if (-not $SkipTimeTree) {
  New-LifeBoardTask -TaskName 'LifeBoard TimeTree Calendar Sync' -Mode 'TimeTree' -IntervalMinutes $TimeTreeIntervalMinutes
}

Write-Host ''
Write-Host 'Setup complete.'
Write-Host ('Runner log: {0}' -f (Join-Path $lifeBoardDir 'logs\lifeboard_ops_runner.log'))
Write-Host 'If this PC is dedicated, reboot once and confirm Pixoo updates without touching the console.'
