@echo off
chcp 65001 >nul
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='java.exe'\" | Where-Object { $_.CommandLine -like '*mind-weave-backend*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; Write-Output 'MindWeave 后端已停止'"
pause
