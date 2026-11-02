@echo off
rem Double-click launcher. Bypasses the PowerShell execution policy for this one run only.
rem Pass the same options as the .ps1, e.g.:  Rescue-Backup.cmd -Dest E:\ -AutoResume
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Rescue-Backup.ps1" %*
echo.
pause
