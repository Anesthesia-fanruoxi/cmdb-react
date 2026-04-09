@echo off
setlocal enabledelayedexpansion

set "PROCESS_NAME=cmdb-desktop.exe"
set "MSI_DIR=C:\Users\Anesthesia\AppData\Local\Temp\cmdb-updates"
set "EXE_PATH=C:\Program Files\CMDB Desktop\cmdb-desktop.exe"
set "LOG_FILE=C:\Users\Anesthesia\AppData\Local\Temp\cmdb-install.log"

echo [1] Kill process...
tasklist /FI "IMAGENAME eq %PROCESS_NAME%" 2>NUL | find /I "%PROCESS_NAME%" >NUL
if %errorlevel%==0 (
    taskkill /F /IM %PROCESS_NAME% >NUL 2>&1
    timeout /t 2 /nobreak >nul
    echo [OK] Killed
) else (
    echo [OK] Not running
)

echo [2] Find MSI...
set "MSI_FILE="
for %%f in ("%MSI_DIR%\*.msi") do set "MSI_FILE=%%f"
if not defined MSI_FILE (
    echo [ERROR] MSI not found in: %MSI_DIR%
    pause
    exit /b 1
)
echo [OK] Found: %MSI_FILE%

echo [3] Installing...
msiexec /i "%MSI_FILE%" /quiet /norestart REINSTALL=ALL REINSTALLMODE=vomus
set RESULT=%errorlevel%
if %RESULT% neq 0 (
    echo [ERROR] Failed, code: %RESULT%
    echo [INFO] Log: %LOG_FILE%
    pause
    exit /b %RESULT%
)
echo [OK] Done

echo [4] Start app...
timeout /t 3 /nobreak >nul
if exist "%EXE_PATH%" (
    start "" "%EXE_PATH%"
    echo [OK] Started
) else (
    echo [ERROR] Not found: %EXE_PATH%
)

echo Closing in 5s...
timeout /t 5
endlocal
