param(
  [int]$IntervalMinutes = 60,
  [switch]$Unregister
)

$ErrorActionPreference = 'Stop'

$intervalTaskName = 'LifeBoard TimeTree Calendar Sync'
$logonTaskName = 'LifeBoard TimeTree Calendar Sync Logon'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..\..')
$runnerPath = Join-Path $scriptDir 'run_timetree_sync_hidden.vbs'
$wscriptPath = Join-Path $env:SystemRoot 'System32\wscript.exe'
$startupPath = Join-Path ([Environment]::GetFolderPath('Startup')) 'LifeBoard_TimeTree_Sync.vbs'

function Invoke-Schtasks {
  param(
    [string[]]$Arguments
  )
  & schtasks.exe @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "schtasks failed with exit code $LASTEXITCODE"
  }
}

function ConvertTo-VbsString {
  param(
    [string]$Value
  )
  return $Value.Replace('"', '""')
}

if ($Unregister) {
  Unregister-ScheduledTask -TaskPath '\LifeBoard\' -TaskName 'TimeTree Calendar Sync' -Confirm:$false -ErrorAction SilentlyContinue
  schtasks.exe /Delete /TN "\$intervalTaskName" /F 2>$null | Out-Null
  schtasks.exe /Delete /TN "\$logonTaskName" /F 2>$null | Out-Null
  Remove-Item -LiteralPath $startupPath -Force -ErrorAction SilentlyContinue
  Write-Host "Unregistered scheduled tasks: $intervalTaskName, $logonTaskName"
  Write-Host "Removed startup helper: $startupPath"
  exit 0
}

if (-not (Test-Path -LiteralPath $runnerPath)) {
  throw "Hidden runner script not found: $runnerPath"
}

$taskRun = ('"{0}" //B //Nologo "{1}"' -f $wscriptPath, $runnerPath)

Invoke-Schtasks @(
  '/Create',
  '/TN', "\$intervalTaskName",
  '/TR', $taskRun,
  '/SC', 'MINUTE',
  '/MO', [string]$IntervalMinutes,
  '/F',
  '/RL', 'LIMITED'
)

$logonTaskRegistered = $false
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
  & schtasks.exe @(
    '/Create',
    '/TN', "\$logonTaskName",
    '/TR', $taskRun,
    '/SC', 'ONLOGON',
    '/F',
    '/RL', 'LIMITED'
  ) 2>$null
  $logonTaskExitCode = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $previousErrorActionPreference
}
if ($logonTaskExitCode -eq 0) {
  $logonTaskRegistered = $true
} else {
  Write-Warning "Logon scheduled task could not be created. Startup helper will be used instead."
}

if (-not $logonTaskRegistered) {
  $vbs = @(
    'Set shell = CreateObject("WScript.Shell")',
    ('shell.Run "{0}", 0, False' -f (ConvertTo-VbsString $taskRun))
  )
  Set-Content -LiteralPath $startupPath -Value $vbs -Encoding Unicode
}

Write-Host "Registered scheduled task: $intervalTaskName"
if ($logonTaskRegistered) {
  Write-Host "Registered scheduled task: $logonTaskName"
} else {
  Write-Host "Registered startup helper: $startupPath"
}
Write-Host "Interval minutes: $IntervalMinutes"
Write-Host "Runner: $runnerPath"
Write-Host "Action uses wscript.exe to avoid a visible PowerShell window."
Write-Host ('Log: {0}' -f (Join-Path $repoRoot 'LifeBoard\logs\timetree_sync.log'))
