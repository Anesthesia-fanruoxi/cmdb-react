@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ============================================================
echo   CMDB Desktop 自动更新脚本
echo ============================================================
echo.

:: 配置（写死的值）
set "PROCESS_NAME=cmdb-desktop.exe"
set "MSI_DIR=C:\Users\Anesthesia\AppData\Local\Temp\cmdb-updates"
set "EXE_PATH=C:\Program Files\CMDB Desktop\cmdb-desktop.exe"

echo [INFO] 进程名: %PROCESS_NAME%
echo [INFO] 安装包目录: %MSI_DIR%
echo [INFO] 程序路径: %EXE_PATH%
echo.

:: ============================================================
:: 步骤1：检查并关闭进程
:: ============================================================
echo [步骤1] 检查进程...
tasklist /FI "IMAGENAME eq %PROCESS_NAME%" 2>NUL | find /I "%PROCESS_NAME%" >NUL
if %errorlevel%==0 (
    echo [INFO] 发现进程正在运行，正在关闭...
    taskkill /F /IM %PROCESS_NAME% >NUL 2>&1
    timeout /t 2 /nobreak >nul
    echo [OK] 进程已关闭
) else (
    echo [OK] 进程未运行
)
echo.

:: ============================================================
:: 步骤2：查找安装包
:: ============================================================
echo [步骤2] 查找安装包...
set "MSI_FILE="
for %%f in ("%MSI_DIR%\*.msi") do (
    set "MSI_FILE=%%f"
)

if not defined MSI_FILE (
    echo [ERROR] 未找到安装包！
    echo [INFO] 目录: %MSI_DIR%
    pause
    exit /b 1
)

echo [OK] 找到安装包: %MSI_FILE%
echo.

:: ============================================================
:: 步骤3：执行安装
:: ============================================================
echo [步骤3] 开始安装...
echo [INFO] 执行: msiexec /i "%MSI_FILE%" /quiet /norestart
msiexec /i "%MSI_FILE%" /quiet /norestart
set INSTALL_RESULT=%errorlevel%

if %INSTALL_RESULT%==0 (
    echo [OK] 安装成功！
) else (
    echo [ERROR] 安装失败，错误码: %INSTALL_RESULT%
    pause
    exit /b %INSTALL_RESULT%
)
echo.

:: ============================================================
:: 步骤4：启动程序
:: ============================================================
echo [步骤4] 启动程序...
timeout /t 2 /nobreak >nul
if exist "%EXE_PATH%" (
    start "" "%EXE_PATH%"
    echo [OK] 程序已启动
) else (
    echo [ERROR] 程序不存在: %EXE_PATH%
)
echo.

echo ============================================================
echo   更新完成！
echo ============================================================
echo.
echo 窗口将在 5 秒后关闭...
timeout /t 5

endlocal
