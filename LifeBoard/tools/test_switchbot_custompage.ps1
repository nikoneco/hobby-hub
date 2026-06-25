param(
  [string]$Token = $env:SWITCHBOT_TOKEN,
  [string]$Secret = $env:SWITCHBOT_SECRET,
  [string]$DeviceId = $env:DAILY_STATION_DEVICE_ID,
  [string]$Text,
  [ValidateSet("customPage", "customQuote", "cancelCustom")]
  [string]$Command = "customPage",
  [switch]$Clear
)

$ErrorActionPreference = "Stop"

function ConvertFrom-SecureStringToPlainText {
  param([securestring]$SecureString)
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)
  try {
    [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

function Get-Utf8ByteLength {
  param([string]$Value)
  [Text.Encoding]::UTF8.GetByteCount($Value)
}

if (-not $Token) {
  $Token = Read-Host "SwitchBot Token"
}

if (-not $Secret) {
  $secureSecret = Read-Host "SwitchBot Secret" -AsSecureString
  $Secret = ConvertFrom-SecureStringToPlainText -SecureString $secureSecret
}

if (-not $DeviceId) {
  $DeviceId = Read-Host "Daily Station deviceId"
}

if ($Clear) {
  $Text = ""
} elseif (-not $PSBoundParameters.ContainsKey("Text")) {
  $Text = "PC direct test $(Get-Date -Format 'M/d H:mm:ss') | JR normal | Bus 3 stops away"
}

$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()
$nonce = [guid]::NewGuid().ToString()
$stringToSign = "$Token$timestamp$nonce"
$hmac = [Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($Secret))
$signatureBytes = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($stringToSign))
$sign = [Convert]::ToBase64String($signatureBytes)

$headers = @{
  Authorization = $Token
  sign = $sign
  t = $timestamp
  nonce = $nonce
}

$body = @{
  command = $Command
  parameter = $Text
  commandType = "command"
} | ConvertTo-Json -Compress

$uri = "https://api.switch-bot.com/v1.1/devices/$DeviceId/commands"

Write-Host "[SwitchBot] POST $uri"
Write-Host "[SwitchBot] command=$Command bytes=$(Get-Utf8ByteLength $Text)"
Write-Host "[SwitchBot] text=$Text"

$response = Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType "application/json; charset=utf-8" -Body $body
$response | ConvertTo-Json -Depth 10
