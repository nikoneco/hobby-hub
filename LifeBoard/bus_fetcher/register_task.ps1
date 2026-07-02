param(
  [int]$IntervalMinutes = 5,
  [string]$TaskName = 'LifeBoard Bus Fetcher',
  [switch]$RunNow
)

$ErrorActionPreference = 'Stop'

if ($IntervalMinutes -lt 1) {
  throw 'IntervalMinutes must be 1 or greater.'
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runner = Join-Path $scriptDir 'run_manual.ps1'
if (-not (Test-Path -LiteralPath $runner)) {
  throw "Runner not found: $runner"
}

$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $runner + '"'
$action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments
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
  -Description 'Fetches LifeBoard bus snapshots and posts them to the GAS web app.' `
  -Force | Out-Null

if ($RunNow) {
  Start-ScheduledTask -TaskPath '\LifeBoard\' -TaskName $TaskName
}

Write-Host ('Registered scheduled task: \LifeBoard\{0}' -f $TaskName)
Write-Host ('Interval: {0} minute(s)' -f $IntervalMinutes)
Write-Host 'Action uses powershell.exe -WindowStyle Hidden.'
