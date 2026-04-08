/// 生成 Windows 更新脚本内容（已以管理员身份运行，静默执行）
pub fn get_update_script(exe_name: &str, msi_dir: &str, exe_path: &str) -> String {
    let line_process = format!("set \"PROCESS_NAME={}\"", exe_name);
    let line_msi_dir = format!("set \"MSI_DIR={}\"", msi_dir);
    let line_exe_path = format!("set \"EXE_PATH={}\"", exe_path);

    let lines = vec![
        "@echo off",
        "chcp 65001 >nul",
        "setlocal enabledelayedexpansion",
        "",
        &line_process,
        &line_msi_dir,
        &line_exe_path,
        "",
        ":: 步骤1：关闭进程",
        "tasklist /FI \"IMAGENAME eq %PROCESS_NAME%\" 2>NUL | find /I \"%PROCESS_NAME%\" >NUL",
        "if %errorlevel%==0 (",
        "    taskkill /F /IM %PROCESS_NAME% >NUL 2>&1",
        "    timeout /t 2 /nobreak >nul",
        ")",
        "",
        ":: 步骤2：查找安装包",
        "set \"MSI_FILE=\"",
        "for %%f in (\"%MSI_DIR%\\*.msi\") do set \"MSI_FILE=%%f\"",
        "if not defined MSI_FILE exit /b 1",
        "",
        ":: 步骤3：删除旧版本 exe",
        "if exist \"%EXE_PATH%\" del /f /q \"%EXE_PATH%\"",
        "",
        ":: 步骤4：安装新版本",
        "msiexec /i \"%MSI_FILE%\" /quiet /norestart",
        "if %errorlevel% neq 0 exit /b %errorlevel%",
        "",
        ":: 步骤5：启动程序",
        "timeout /t 2 /nobreak >nul",
        "if exist \"%EXE_PATH%\" start \"\" \"%EXE_PATH%\"",
        "",
        "endlocal",
    ];

    lines.join("\r\n")
}
