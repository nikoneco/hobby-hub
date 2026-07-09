param(
  [string]$TargetRoot = 'P:\',
  [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $scriptDir '..\..')).Path
$lifeBoardSource = Join-Path $repoRoot 'LifeBoard'
$targetRootResolved = (Resolve-Path -LiteralPath $TargetRoot).Path.TrimEnd('\')
$targetLifeBoard = Join-Path $targetRootResolved 'LifeBoard'

$excludedNames = @(
  'bus_fetcher.local.ps1',
  'pixoo_display.local.ps1',
  'sync_timetree_calendar.local.bat'
)

$excludedDirectories = @(
  'data',
  'logs',
  'gas',
  'windows_ops'
)

function Write-Step {
  param([string]$Message)
  Write-Host ('[LifeBoard deploy] {0}' -f $Message)
}

function Copy-FileSafe {
  param(
    [string]$Source,
    [string]$Destination
  )
  if ($WhatIf) {
    Write-Step ("WHATIF copy file: {0} -> {1}" -f $Source, $Destination)
    return
  }
  $parent = Split-Path -Parent $Destination
  if ($parent -and -not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  Copy-Item -LiteralPath $Source -Destination $Destination -Force
}

function Test-ExcludedFile {
  param([System.IO.FileInfo]$File)
  if ($excludedNames -contains $File.Name) {
    return $true
  }
  if ($File.Name -like '*.log') {
    return $true
  }
  return $false
}

function Copy-DirectorySafe {
  param(
    [string]$SourceDir,
    [string]$DestinationDir
  )
  if (-not (Test-Path -LiteralPath $SourceDir)) {
    throw "Source directory not found: $SourceDir"
  }

  Get-ChildItem -LiteralPath $SourceDir -Recurse -Force | ForEach-Object {
    $relativePath = $_.FullName.Substring($SourceDir.Length).TrimStart('\')
    if (-not $relativePath) {
      return
    }
    $destination = Join-Path $DestinationDir $relativePath

    if ($_.PSIsContainer) {
      if ($excludedDirectories -contains $_.Name) {
        return
      }
      if (-not $WhatIf) {
        New-Item -ItemType Directory -Force -Path $destination | Out-Null
      }
      return
    }

    if (Test-ExcludedFile -File $_) {
      return
    }

    Copy-FileSafe -Source $_.FullName -Destination $destination
  }
}

if (-not (Test-Path -LiteralPath $lifeBoardSource)) {
  throw "LifeBoard source was not found: $lifeBoardSource"
}
Write-Step ("source: {0}" -f $lifeBoardSource)
Write-Step ("target: {0}" -f $targetRootResolved)

Copy-FileSafe `
  -Source (Join-Path $lifeBoardSource 'windows_ops\LifeBoard_Runner.ps1') `
  -Destination (Join-Path $targetRootResolved 'LifeBoard_Runner.ps1')

Copy-FileSafe `
  -Source (Join-Path $lifeBoardSource 'windows_ops\LifeBoard_RunHidden.vbs') `
  -Destination (Join-Path $targetRootResolved 'LifeBoard_RunHidden.vbs')

Copy-FileSafe `
  -Source (Join-Path $lifeBoardSource 'windows_ops\LifeBoard_Task_Setup.ps1') `
  -Destination (Join-Path $targetRootResolved 'LifeBoard_Task_Setup.ps1')

Copy-FileSafe `
  -Source (Join-Path $lifeBoardSource 'README.md') `
  -Destination (Join-Path $targetLifeBoard 'README.md')

foreach ($dirName in @('bus_fetcher', 'pixoo_display', 'tools', 'misaki_png_2021-05-05a')) {
  Copy-DirectorySafe `
    -SourceDir (Join-Path $lifeBoardSource $dirName) `
    -DestinationDir (Join-Path $targetLifeBoard $dirName)
}

Write-Step 'deploy complete'
