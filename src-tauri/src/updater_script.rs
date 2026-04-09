/// 生成 Windows 更新脚本内容（执行文件替换模式，已以管理员身份运行）
pub fn get_update_script(exe_name: &str, new_exe_path: &str, target_exe_path: &str) -> String {
    let line_process = format!("set \"PROCESS_NAME={}\"", exe_name);
    let line_new_exe = format!("set \"NEW_EXE_PATH={}\"", new_exe_path);
    let line_target_exe = format!("set \"TARGET_EXE_PATH={}\"", target_exe_path);

    let lines = vec![
        "@echo off",
        "chcp 65001 >nul",
        "setlocal enabledelayedexpansion",
        "",
        &line_process,
        &line_new_exe,
        &line_target_exe,
        "set \"LOG_FILE=%TEMP%\\cmdb-updates\\update.log\"",
        "",
        "echo [%date% %time%] 开始执行二进制替换更新... > \"%LOG_FILE%\"",
        "",
        ":: 1. 杀死进程",
        "echo [1/4] 正在关闭进程 %PROCESS_NAME%... >> \"%LOG_FILE%\"",
        "tasklist /FI \"IMAGENAME eq %PROCESS_NAME%\" 2>NUL | find /I \"%PROCESS_NAME%\" >NUL",
        "if %errorlevel%==0 (",
        "    taskkill /F /IM %PROCESS_NAME% >NUL 2>&1",
        "    timeout /t 2 /nobreak >nul",
        ")",
        "",
        ":: 2. 检查新文件是否存在",
        "if not exist \"%NEW_EXE_PATH%\" (",
        "    echo [错误] 找不到新版本文件: %NEW_EXE_PATH% >> \"%LOG_FILE%\"",
        "    exit /b 1",
        ")",
        "",
        ":: 3. 执行替换",
        "echo [2/4] 正在备份并替换执行文件... >> \"%LOG_FILE%\"",
        "if exist \"%TARGET_EXE_PATH%\" (",
        "    move /y \"%TARGET_EXE_PATH%\" \"%TARGET_EXE_PATH%.bak\" >NUL 2>&1",
        ")",
        "copy /y \"%NEW_EXE_PATH%\" \"%TARGET_EXE_PATH%\" >NUL 2>&1",
        "if %errorlevel% neq 0 (",
        "    echo [错误] 文件替换失败，错误码: %errorlevel% >> \"%LOG_FILE%\"",
        "    if exist \"%TARGET_EXE_PATH%.bak\" move /y \"%TARGET_EXE_PATH%.bak\" \"%TARGET_EXE_PATH%\" >NUL 2>&1",
        "    exit /b %errorlevel%",
        ")",
        "",
        ":: 4. 启动新版本",
        "echo [3/4] 更新成功，正在启动... >> \"%LOG_FILE%\"",
        "timeout /t 1 /nobreak >nul",
        "start \"\" \"%TARGET_EXE_PATH%\"",
        "",
        ":: 5. 清理备份",
        "echo [4/4] 清理临时文件... >> \"%LOG_FILE%\"",
        "if exist \"%TARGET_EXE_PATH%.bak\" del /f /q \"%TARGET_EXE_PATH%.bak\" >NUL 2>&1",
        "",
        "echo [%date% %time%] 更新全部完成。 >> \"%LOG_FILE%\"",
        "endlocal",
    ];

    lines.join("\r\n")
}
