Option Explicit

Dim shell
Dim fso
Dim scriptDir
Dim runner
Dim powershell
Dim command
Dim exitCode

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
runner = fso.BuildPath(scriptDir, "run_timetree_sync_task.ps1")
powershell = shell.ExpandEnvironmentStrings("%SystemRoot%") & "\System32\WindowsPowerShell\v1.0\powershell.exe"
command = Chr(34) & powershell & Chr(34) & " -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File " & Chr(34) & runner & Chr(34)

exitCode = shell.Run(command, 0, True)
WScript.Quit exitCode
