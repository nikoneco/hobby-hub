param([switch]$LibraryOnly, [switch]$Guard, [string]$ConfigPath, [string]$StateDirectory, [string]$AttemptId)
$ErrorActionPreference = 'Stop'

function Get-PixooWifiInterface {
  param([string]$Text, [guid]$InterfaceGuid)
  # netsh labels vary by Windows language; GUID/SSID/BSSID are invariant.
  foreach ($block in [regex]::Split($Text, '(?:\r?\n){2,}')) {
    if ($block -notmatch [regex]::Escape($InterfaceGuid.ToString())) { continue }
    $bssid = [regex]::Match($block, '(?im)^\s*(?:AP\s+)?BSSID\s*:\s*([0-9a-f:]{17})\s*$')
    $ssid = [regex]::Match($block, '(?im)^\s*SSID\s*:\s*(.*?)\s*$')
    return @{ Bssid = $bssid.Groups[1].Value.ToLowerInvariant(); Ssid = $ssid.Groups[1].Value }
  }
  return @{ Bssid = ''; Ssid = '' }
}

function Get-PixooWifiRecoveryDecision {
  param($Connection, $Settings, [bool]$Reachable, [double]$ElapsedMinutes)
  if ($Connection.Ssid -ne $Settings.Ssid -or $Connection.Bssid -ne $Settings.RepeaterBssid) { return 'not-repeater' }
  if ($Reachable) { return 'reachable' }
  if ($ElapsedMinutes -lt 10) { return 'cooldown' }
  return 'recover'
}

function Test-PixooWifiHttp {
  param([string]$PixooIp)
  try {
    $reply = Invoke-RestMethod -Uri ('http://{0}/post' -f $PixooIp) -Method Post -ContentType 'application/json' -Body '{"Command":"Channel/GetIndex"}' -TimeoutSec 3
    return ($null -ne $reply.error_code -and $reply.error_code -eq 0)
  } catch { return $false }
}

function Initialize-PixooWifiNative {
  if ('LifeBoardWifiNative' -as [type]) { return }
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class LifeBoardWifiNative {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct Parameters {
    public uint Mode;
    [MarshalAs(UnmanagedType.LPWStr)] public string Profile;
    public IntPtr Ssid;
    public IntPtr Bssids;
    public uint BssType;
    public uint Flags;
  }
  [DllImport("wlanapi.dll")] static extern uint WlanOpenHandle(uint version, IntPtr reserved, out uint negotiated, out IntPtr handle);
  [DllImport("wlanapi.dll", CharSet=CharSet.Unicode)] static extern uint WlanConnect(IntPtr handle, ref Guid id, ref Parameters parameters, IntPtr reserved);
  [DllImport("wlanapi.dll")] static extern uint WlanCloseHandle(IntPtr handle, IntPtr reserved);
  public static void Validate() {
    if(Marshal.SizeOf(typeof(Parameters)) != (IntPtr.Size==8 ? 40 : 24)) throw new Exception("Unexpected WLAN structure size");
    if(Marshal.OffsetOf(typeof(Parameters), "Bssids").ToInt32() != (IntPtr.Size==8 ? 24 : 12)) throw new Exception("Unexpected BSSID offset");
  }
  public static uint Connect(Guid id, string profile, string bssid) {
    Validate();
    IntPtr handle=IntPtr.Zero, list=IntPtr.Zero;
    uint negotiated;
    uint opened=WlanOpenHandle(2,IntPtr.Zero,out negotiated,out handle);
    if(opened!=0) throw new Exception("WlanOpenHandle failed: "+opened);
    try {
      byte[] bytes=new byte[20];
      bytes[0]=128; bytes[1]=1; bytes[2]=20; bytes[4]=1; bytes[8]=1;
      string[] parts=bssid.Split(':');
      if(parts.Length!=6) throw new Exception("Invalid BSSID");
      for(int i=0;i<6;i++) bytes[12+i]=Convert.ToByte(parts[i],16);
      list=Marshal.AllocHGlobal(bytes.Length);
      Marshal.Copy(bytes,0,list,bytes.Length);
      Parameters p=new Parameters {Mode=0,Profile=profile,Ssid=IntPtr.Zero,Bssids=list,BssType=1,Flags=0};
      return WlanConnect(handle,ref id,ref p,IntPtr.Zero);
    } finally {
      if(list!=IntPtr.Zero) Marshal.FreeHGlobal(list);
      WlanCloseHandle(handle,IntPtr.Zero);
    }
  }
}
'@
  [LifeBoardWifiNative]::Validate()
}

function Read-PixooWifiSettings {
  param([string]$Path)
  $settings = & $Path
  if ($settings -isnot [hashtable]) { throw 'Wi-Fi recovery config must return a hashtable.' }
  if ($settings.MachineName -ne $env:COMPUTERNAME) { throw 'Wi-Fi recovery machine does not match.' }
  foreach ($name in @('RepeaterBssid', 'ParentBssid')) {
    if ($settings[$name] -notmatch '^[0-9a-fA-F]{2}(:[0-9a-fA-F]{2}){5}$') { throw "Invalid $name" }
    $settings[$name] = $settings[$name].ToLowerInvariant()
  }
  if ($settings.ParentBssid -eq $settings.RepeaterBssid) { throw 'Parent and repeater BSSID must differ.' }
  [void][guid]::Parse($settings.InterfaceGuid)
  foreach ($name in @('Profile', 'Ssid', 'InterfaceName')) {
    if (-not $settings[$name] -or $settings[$name] -match '["\r\n]') { throw "Invalid $name" }
  }
  $address = [System.Net.IPAddress]::Parse($settings.PixooIp)
  if ($address.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) { throw 'Pixoo requires IPv4.' }
  return $settings
}

function Connect-PixooParentWifi {
  param($Settings)
  Initialize-PixooWifiNative
  return [LifeBoardWifiNative]::Connect([guid]$Settings.InterfaceGuid, $Settings.Profile, $Settings.ParentBssid)
}

function Invoke-PixooWifiRollbackGuard {
  param($Settings, [string]$StateDir, [string]$Id)
  $readyPath = Join-Path $StateDir 'wifi_guard_ready.txt'
  $donePath = Join-Path $StateDir 'wifi_guard_done.txt'
  $armedPath = Join-Path $StateDir 'wifi_guard_armed.txt'
  Set-Content -LiteralPath $readyPath -Encoding ASCII -Value $Id
  for ($i=0; $i -lt 45; $i++) {
    if ((Test-Path -LiteralPath $donePath) -and (Get-Content -LiteralPath $donePath -Raw).Trim() -eq $Id) { return }
    Start-Sleep -Seconds 2
  }
  # Never reconnect if the main process did not reach the network-change step.
  if (-not (Test-Path -LiteralPath $armedPath) -or (Get-Content -LiteralPath $armedPath -Raw).Trim() -ne $Id) { return }
  & netsh.exe wlan connect ('name=' + $Settings.Profile) ('interface=' + $Settings.InterfaceName) | Out-Null
  Add-Content -LiteralPath (Join-Path $StateDir 'wifi_recovery.log') -Encoding UTF8 -Value ('{0} guard fallback requested' -f [DateTimeOffset]::Now.ToString('o'))
}

function Invoke-PixooWifiRecovery {
  param([string]$SettingsPath, [string]$StateDir, [switch]$CheckOnly)
  $settings = Read-PixooWifiSettings $SettingsPath
  $mutex = New-Object System.Threading.Mutex($false, 'Local\LifeBoardPixooWifiRecovery')
  $locked = $false
  try {
    try { $locked = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $locked = $true }
    if (-not $locked) { return 'busy' }
    $connection = Get-PixooWifiInterface (& netsh.exe wlan show interfaces | Out-String) $settings.InterfaceGuid
    if ($connection.Ssid -ne $settings.Ssid -or $connection.Bssid -ne $settings.RepeaterBssid) { return 'not-repeater' }
    $reachable = Test-PixooWifiHttp $settings.PixooIp
    $elapsed = [double]::PositiveInfinity
    $lastPath = Join-Path $StateDir 'wifi_last_attempt.txt'
    if (Test-Path -LiteralPath $lastPath) {
      # Corrupt state fails closed instead of repeatedly reconnecting.
      try { $elapsed = ([DateTimeOffset]::Now - [DateTimeOffset]::Parse((Get-Content -LiteralPath $lastPath -Raw).Trim())).TotalMinutes }
      catch { return 'invalid-state' }
    }
    $decision = Get-PixooWifiRecoveryDecision $connection $settings $reachable $elapsed
    if ($decision -ne 'recover' -or $CheckOnly) { return $decision }
    New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
    $id = [guid]::NewGuid().ToString('N')
    $ready = Join-Path $StateDir 'wifi_guard_ready.txt'
    $done = Join-Path $StateDir 'wifi_guard_done.txt'
    $shell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}" -Guard -ConfigPath "{1}" -StateDirectory "{2}" -AttemptId {3}' -f $script:WifiRecoveryScriptPath, $SettingsPath, $StateDir, $id
    $guardProcess = Start-Process -FilePath $shell -ArgumentList $arguments -WindowStyle Hidden -PassThru
    $guardReady = $false
    for ($i=0; $i -lt 20; $i++) {
      if ((Test-Path -LiteralPath $ready) -and (Get-Content -LiteralPath $ready -Raw).Trim() -eq $id) { $guardReady = $true; break }
      if ($guardProcess.HasExited) { break }
      Start-Sleep -Milliseconds 250
    }
    if (-not $guardReady) { throw 'Independent Wi-Fi rollback guard was not ready; connection unchanged.' }
    Set-Content -LiteralPath $lastPath -Encoding ASCII -Value ([DateTimeOffset]::Now.ToString('o'))
    Set-Content -LiteralPath (Join-Path $StateDir 'wifi_guard_armed.txt') -Encoding ASCII -Value $id
    $code = Connect-PixooParentWifi $settings
    if ($code -ne 0) { throw "Parent AP connection request rejected: $code" }
    for ($i=0; $i -lt 4; $i++) {
      Start-Sleep -Seconds 3
      $current = Get-PixooWifiInterface (& netsh.exe wlan show interfaces | Out-String) $settings.InterfaceGuid
      if ($current.Bssid -eq $settings.ParentBssid -and (Test-PixooWifiHttp $settings.PixooIp)) {
        Set-Content -LiteralPath $done -Encoding ASCII -Value $id
        return 'recovered'
      }
    }
    return 'failed-guard-pending'
  } finally {
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
  }
}

$script:WifiRecoveryScriptPath = $PSCommandPath
if ($LibraryOnly) { return }
if (-not $Guard -or $AttemptId -notmatch '^[0-9a-f]{32}$') { throw 'Use through the LifeBoard runner.' }
$settings = Read-PixooWifiSettings $ConfigPath
Invoke-PixooWifiRollbackGuard -Settings $settings -StateDir $StateDirectory -Id $AttemptId
