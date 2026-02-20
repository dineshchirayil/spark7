@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ACTION=%~1"
set "API_PORT=%~2"
set "CLIENT_PORT=%~3"

if "%API_PORT%"=="" set "API_PORT=3000"
if "%CLIENT_PORT%"=="" set "CLIENT_PORT=5173"

if /I "%ACTION%"=="start" goto :start
if /I "%ACTION%"=="stop" goto :stop
if /I "%ACTION%"=="restart" goto :restart

echo Usage: %~nx0 ^<start^|stop^|restart^> [apiPort] [clientPort]
echo Example: %~nx0 start 3000 5173
exit /b 1

:restart
call :stop
call :start
exit /b %errorlevel%

:start
echo Stopping listeners on ports %API_PORT% and %CLIENT_PORT%...
call :killPort %API_PORT%
call :killPort %CLIENT_PORT%

echo Starting backend on port %API_PORT%...
start "POS Server :%API_PORT%" cmd /k "cd /d ""%~dp0"" && set PORT=%API_PORT% && npm run dev:server"

echo Starting frontend on port %CLIENT_PORT%...
start "POS Client :%CLIENT_PORT%" cmd /k "cd /d ""%~dp0"" && set VITE_API_URL=http://localhost:%API_PORT%/api && npm run dev:client -- --port %CLIENT_PORT%"

echo Application launch triggered.
exit /b 0

:stop
echo Stopping listeners on ports %API_PORT% and %CLIENT_PORT%...
call :killPort %API_PORT%
call :killPort %CLIENT_PORT%
echo Stop complete.
exit /b 0

:killPort
set "TARGET_PORT=%~1"
set "FOUND=0"

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%TARGET_PORT% .*LISTENING"') do (
  set "FOUND=1"
  echo Stopping PID %%P on port %TARGET_PORT%...
  taskkill /F /PID %%P >nul 2>&1
)

if "!FOUND!"=="0" (
  echo No listener found on port %TARGET_PORT%.
)

exit /b 0
