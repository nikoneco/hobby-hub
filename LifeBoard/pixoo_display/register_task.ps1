param(
  [int]$IntervalMinutes = 1,
  [string]$TaskName = 'LifeBoard Pixoo Display',
  [switch]$RunNow
)

$ErrorActionPreference = 'Stop'

if ($IntervalMinutes -lt 1) {
  throw 'IntervalMinutes must be 1 or greater.'
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runner = Join-Path $scriptDir 'run_hidden.vbs'
if (-not (Test-Path -LiteralPath $runner)) {
  throw "Hidden runner not found: $runner"
}

$wscript = Join-Path $env:SystemRoot 'System32\wscript.exe'
$arguments = '//B //Nologo "' + $runner + '"'
$action = New-ScheduledTaskAction -Execute $wscript -Argument $arguments
$trigger = New-ScheduledTaskTrigger `
  -Once `
  -At (Get-Date).AddMinutes(1) `
  -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) `
  -RepetitionDuration (New-TimeSpan -Days 3650)
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
  -Trigger $trigger `
  -Settings $settings `
  -Description 'Pushes the latest LifeBoard snapshot to Pixoo64 without fetching NAVITIME.' `
  -Force | Out-Null

if ($RunNow) {
  Start-ScheduledTask -TaskPath '\LifeBoard\' -TaskName $TaskName
}

Write-Host ('Registered scheduled task: \LifeBoard\{0}' -f $TaskName)
Write-Host ('Interval: {0} minute(s)' -f $IntervalMinutes)
Write-Host 'Action uses wscript.exe to avoid a visible PowerShell window.'
