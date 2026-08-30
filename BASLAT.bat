@echo off
rem SOZUM SOZ launcher - starts a local server and opens the app in the browser.
rem Works on any Windows without installing anything (uses built-in PowerShell).
setlocal
set "ROOT=%~dp0"
set "PORT=8000"

rem Start a tiny static server (hidden) on 127.0.0.1:8000 if not already running.
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%ROOT%server.ps1" -Root "%ROOT%" -Port %PORT%

rem Wait until the server answers (max ~15s).
for /l %%i in (1,1,30) do (
  powershell -NoProfile -Command "$c=New-Object Net.Sockets.TcpClient; try{$c.Connect('127.0.0.1',%PORT%); exit 0}catch{exit 1}" >nul 2>&1
  if not errorlevel 1 goto open
  timeout /t 1 /nobreak >nul
)

:open
start "" "http://127.0.0.1:%PORT%/index.html"