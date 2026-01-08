/// 生成 Windows 更新脚本内容（已以管理员身份运行）
pub fn get_update_script(exe_name: &str, msi_dir: &str, exe_path: &str) -> String {
    format!(
        r#"@echo off
setlocal enabledelayedexpansion

set "PROCESS_NAME={}"
set "MSI_DIR={}"
set "EXE_PATH={}"

:: Step 1: Kill process if running
tasklist /FI "IMAGENAME eq %PROCESS_NAME%" 2>NUL | find /I "%PROCESS_NAME%" >NUL
if %errorlevel%==0 (
    taskkill /F /IM %PROCESS_NAME% >NUL 2>&1
    timeout /t 2 /nobreak >nul
)

:: Step 2: Find MSI file
set "MSI_FILE="
for %%f in ("%MSI_DIR%\*.msi") do set "MSI_FILE=%%f"
if not defined MSI_FILE exit /b 1

:: Step 3: Uninstall then install
msiexec /x "%MSI_FILE%" /quiet /norestart
timeout /t 3 /nobreak >nul
msiexec /i "%MSI_FILE%" /quiet /norestart
if %errorlevel% neq 0 exit /b %errorlevel%

:: Step 4: Start application
timeout /t 2 /nobreak >nul
if exist "%EXE_PATH%" start "" "%EXE_PATH%"

exit
endlocal
"#,
        exe_name, msi_dir, exe_path
    )
}
