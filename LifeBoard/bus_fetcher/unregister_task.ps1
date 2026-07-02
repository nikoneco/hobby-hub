param(
  [string]$TaskName = 'LifeBoard Bus Fetcher'
)

$ErrorActionPreference = 'Stop'

Unregister-ScheduledTask -TaskPath '\LifeBoard\' -TaskName $TaskName -Confirm:$false
Write-Host ('Unregistered scheduled task: \LifeBoard\{0}' -f $TaskName)
