/// 生成 Windows 更新脚本内容（已以管理员身份运行，静默执行）
pub fn get_update_script(exe_name: &str, msi_dir: &str, exe_path: &str) -> String {
    // 从 exe_path 获取安装目录，确保末尾是 CMDB Desktop 子目录
    let install_dir = {
        let parent = std::path::Path::new(exe_path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| r"C:\Program Files\CMDB Desktop".to_string());
        // 如果父目录末尾不是 CMDB Desktop，则追加，防止指向盘根或其他目录
        if parent.to_lowercase().ends_with("cmdb desktop") || parent.to_lowercase().ends_with("cmdb-desktop") {
            parent
        } else {
            format!(r"{}\CMDB Desktop", parent)
        }
    };
    
    // 预先格式化变量行
    let line_process = format!("set \"PROCESS_NAME={}\"", exe_name);
    let line_msi_dir = format!("set \"MSI_DIR={}\"", msi_dir);
    let line_exe_path = format!("set \"EXE_PATH={}\"", exe_path);
    let line_install_dir = format!("set \"INSTALL_DIR={}\"", install_dir);
    
    let lines = vec![
        "@echo off",
        "chcp 65001 >nul",
        "setlocal enabledelayedexpansion",
        "",
        &line_process,
        &line_msi_dir,
        &line_exe_path,
        &line_install_dir,
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
        ":: 步骤3：删除旧版本程序文件（只删 exe，不删整个目录）",
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
