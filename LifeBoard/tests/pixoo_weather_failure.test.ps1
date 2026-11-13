$ErrorActionPreference = 'Stop'
$runnerPath = Join-Path $PSScriptRoot '..\windows_ops\LifeBoard_Runner.ps1'
$parseErrors = $null
$tokens = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($runnerPath, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
# Load production functions without invoking the runner, local settings or tasks.
foreach ($name in @('Invoke-Weather', 'Invoke-Pixoo')) {
  $functionAst = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $true)
  Invoke-Expression $functionAst.Extent.Text
}
function Assert-True($Value, $Message) { if (-not $Value) { throw $Message } }
$lifeBoardDir = 'C:\fake\LifeBoard'
$scriptDir = 'C:\fake'
$weatherFetchStatePath = 'unused'
$DryRun = $false
$NoPreview = $true
$script:weatherFails = $true
$script:renderFails = $false
$script:renderDue = $true
$script:steps = @()
$script:messages = @()
$script:stateWrites = 0
function Test-WeatherFetchDue { return $true }
function Test-PixooRenderDue { return $script:renderDue }
function Test-Path { param($LiteralPath) return $LiteralPath -like '*sync_weathernews_snapshot.js' }
function Add-Log { param($Message) $script:messages += $Message }
function Set-Content { param($LiteralPath, $Encoding, $Value) $script:stateWrites++ }
function Invoke-NodeScript {
  param($ScriptPath, $Arguments, $StepName)
  $script:steps += $StepName
  if ($StepName -eq 'weather-fetch' -and $script:weatherFails) { throw 'Weathernews hourly table was not found' }
  if ($StepName -eq 'pixoo-render' -and $script:renderFails) { throw 'Pixoo unavailable' }
}
Invoke-Pixoo
Assert-True (($script:steps -join ',') -eq 'weather-fetch,pixoo-render') 'Weather failure must still send to Pixoo.'
Assert-True ($script:stateWrites -eq 0) 'Failed weather must not advance its successful-fetch timestamp.'
Assert-True (($script:messages -join '') -match 'WARNING.*continuing Pixoo') 'Weather failure must remain visible in the log.'
$threw = $false
try { Invoke-Weather } catch { $threw = $true }
Assert-True $threw 'Standalone weather mode must report failure.'
$script:steps = @()
Invoke-Weather -ContinueOnError
Invoke-Pixoo -SkipWeatherRefresh
Assert-True (($script:steps -join ',') -eq 'weather-fetch,pixoo-render') 'All mode must refresh weather once and continue rendering.'
$script:renderFails = $true
$threw = $false
try { Invoke-Pixoo } catch { $threw = $true }
Assert-True $threw 'Pixoo delivery errors must propagate.'
$script:weatherFails = $false
$script:renderFails = $false
$script:steps = @()
Invoke-Pixoo
Assert-True (($script:steps -join ',') -eq 'weather-fetch,pixoo-render') 'Successful weather must be followed by rendering.'
Assert-True ($script:stateWrites -eq 1) 'Successful weather must advance its timestamp.'
$script:renderDue = $false
$script:steps = @()
Invoke-Pixoo
Assert-True (($script:steps -join ',') -eq 'weather-fetch') 'Overnight scheduling must still skip rendering between quarter hours.'
Write-Output 'Pixoo weather failure tests: OK'
