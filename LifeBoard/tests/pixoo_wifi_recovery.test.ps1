$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\windows_ops\Pixoo_WifiRecovery.ps1') -LibraryOnly
function Assert-Equal($Actual, $Expected) {
  if ($Actual -ne $Expected) { throw "Expected $Expected, received $Actual" }
}
$settings = @{ Ssid='test'; RepeaterBssid='11:22:33:44:55:66'; ParentBssid='aa:bb:cc:dd:ee:ff'; InterfaceGuid='11111111-2222-3333-4444-555555555555'; Profile='test'; InterfaceName='Wi-Fi'; PixooIp='127.0.0.1' }
$connection = @{ Ssid='test'; Bssid=$settings.RepeaterBssid }
Assert-Equal (Get-PixooWifiRecoveryDecision $connection $settings $false 11) 'recover'
Assert-Equal (Get-PixooWifiRecoveryDecision $connection $settings $true 11) 'reachable'
Assert-Equal (Get-PixooWifiRecoveryDecision $connection $settings $false 9.99) 'cooldown'
Assert-Equal (Get-PixooWifiRecoveryDecision $connection $settings $false 10) 'recover'
Assert-Equal (Get-PixooWifiRecoveryDecision @{Ssid='other';Bssid=$settings.RepeaterBssid} $settings $false 11) 'not-repeater'
Assert-Equal (Get-PixooWifiRecoveryDecision @{Ssid='test';Bssid=$settings.ParentBssid} $settings $false 11) 'not-repeater'
Assert-Equal (Get-PixooWifiRecoveryDecision @{Ssid='';Bssid=''} $settings $false 11) 'not-repeater'
$interfaceText = @'
    Name : Wi-Fi
    GUID : 11111111-2222-3333-4444-555555555555
    SSID : test
    BSSID : 11:22:33:44:55:66
    Profile : test
'@
Assert-Equal (Get-PixooWifiInterface $interfaceText $settings.InterfaceGuid).Bssid $settings.RepeaterBssid
Assert-Equal (Get-PixooWifiInterface ($interfaceText.Replace('BSSID :','AP BSSID :')) $settings.InterfaceGuid).Ssid 'test'
Assert-Equal (Get-PixooWifiInterface $interfaceText ([guid]::NewGuid())).Bssid ''
Initialize-PixooWifiNative
[LifeBoardWifiNative]::Validate()

# Real separate-process guard startup/cancellation, with no network mutation.
$guardTestDir = Join-Path $env:TEMP ('lifeboard_guard_test_' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $guardTestDir | Out-Null
try {
  $guardConfig = Join-Path $guardTestDir 'test.local.ps1'
  $guardSettings = $settings.Clone()
  $guardSettings.MachineName=$env:COMPUTERNAME
  $entries = $guardSettings.Keys | ForEach-Object { "  '$_' = '$($guardSettings[$_])'" }
  Set-Content -LiteralPath $guardConfig -Value ("@{`r`n" + ($entries -join "`r`n") + "`r`n}")
  $guardId = [guid]::NewGuid().ToString('N')
  Set-Content -LiteralPath (Join-Path $guardTestDir 'wifi_guard_done.txt') -Value $guardId
  $shell=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $guardArgs='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}" -Guard -ConfigPath "{1}" -StateDirectory "{2}" -AttemptId {3}' -f $script:WifiRecoveryScriptPath,$guardConfig,$guardTestDir,$guardId
  $guardProcess=Start-Process -FilePath $shell -ArgumentList $guardArgs -WindowStyle Hidden -PassThru
  if (-not $guardProcess.WaitForExit(10000)) { throw 'Guard cancellation test timed out.' }
  Assert-Equal $guardProcess.ExitCode 0
  Assert-Equal (Get-Content -LiteralPath (Join-Path $guardTestDir 'wifi_guard_ready.txt') -Raw).Trim() $guardId
  Assert-Equal (Test-Path -LiteralPath (Join-Path $guardTestDir 'wifi_recovery.log')) $false
} finally {
  Remove-Item -LiteralPath $guardTestDir -Recurse -Force
}

# No real networking or waits in lifecycle tests; only per-test temp files.
$testDir = Join-Path $env:TEMP ('lifeboard_wifi_test_' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testDir | Out-Null
$script:connects = 0
$script:probes = 0
$script:parent = $false
$script:guardEnabled = $true
function Read-PixooWifiSettings { return $settings }
function netsh.exe {
  if ($args -contains 'connect') { $script:connects++; return }
  if ($script:parent) { return $interfaceText.Replace($settings.RepeaterBssid, $settings.ParentBssid) }
  return $interfaceText
}
function Start-Sleep {}
function Test-PixooWifiHttp { $script:probes++; return $script:parent }
function Start-Process {
  param($FilePath, $ArgumentList, $WindowStyle, [switch]$PassThru)
  if ($script:guardEnabled) {
    $id = [regex]::Match($ArgumentList, '-AttemptId ([0-9a-f]{32})').Groups[1].Value
    Set-Content -LiteralPath (Join-Path $testDir 'wifi_guard_ready.txt') -Value $id
  }
  return @{HasExited=(-not $script:guardEnabled)}
}
function Connect-PixooParentWifi {
  Assert-Equal (Test-Path -LiteralPath (Join-Path $testDir 'wifi_guard_ready.txt')) $true
  Assert-Equal (Test-Path -LiteralPath (Join-Path $testDir 'wifi_guard_armed.txt')) $true
  $script:connects++
  $script:parent=$true
  return 0
}
try {
  Assert-Equal (Invoke-PixooWifiRecovery 'unused' $testDir -CheckOnly) 'recover'
  Assert-Equal $script:connects 0
  $script:guardEnabled=$false
  $threw=$false
  try { Invoke-PixooWifiRecovery 'unused' $testDir } catch { $threw=$true }
  Assert-Equal $threw $true
  Assert-Equal $script:connects 0
  $script:guardEnabled=$true
  Assert-Equal (Invoke-PixooWifiRecovery 'unused' $testDir) 'recovered'
  Assert-Equal $script:connects 1
  $probeCount=$script:probes
  Assert-Equal (Invoke-PixooWifiRecovery 'unused' $testDir) 'not-repeater'
  Assert-Equal $script:probes $probeCount
  $script:parent=$false
  Assert-Equal (Invoke-PixooWifiRecovery 'unused' $testDir) 'cooldown'
  Assert-Equal $script:connects 1
  # Completed guard does nothing; an armed unfinished guard restores profile.
  $id=(Get-Content -LiteralPath (Join-Path $testDir 'wifi_guard_done.txt') -Raw).Trim()
  Invoke-PixooWifiRollbackGuard $settings $testDir $id
  Assert-Equal $script:connects 1
  Set-Content -LiteralPath (Join-Path $testDir 'wifi_guard_done.txt') -Value 'old-attempt'
  Invoke-PixooWifiRollbackGuard $settings $testDir $id
  Assert-Equal $script:connects 2
  Invoke-PixooWifiRollbackGuard $settings $testDir 'not-armed-attempt'
  Assert-Equal $script:connects 2
  Set-Content -LiteralPath (Join-Path $testDir 'wifi_last_attempt.txt') -Value 'corrupt-state'
  Assert-Equal (Invoke-PixooWifiRecovery 'unused' $testDir) 'invalid-state'
  Assert-Equal $script:connects 2
} finally {
  # Exact, explicitly-created test directory only.
  Remove-Item -LiteralPath $testDir -Recurse -Force
}
Write-Output 'Pixoo Wi-Fi recovery tests: OK'
