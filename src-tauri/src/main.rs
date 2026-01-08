// Prevents additional console window on Windows, DO NOT REMOVE!!
#![windows_subsystem = "windows"]

mod device;
mod crypto;
mod auth;
mod elfk;
mod commands;
mod updater;
mod window;

use commands::*;
use tauri::Manager;

/// 显示更新窗口
fn show_update_window() {
    use std::io::Write;
    
    // 更新窗口 HTML
    let html = r#"<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>正在更新</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: white;
      user-select: none;
    }
    .spinner {
      width: 50px;
      height: 50px;
      border: 4px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 24px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .title { font-size: 18px; font-weight: 500; margin-bottom: 8px; }
    .subtitle { font-size: 13px; opacity: 0.8; }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <div class="title">正在更新</div>
  <div class="subtitle">请稍候，更新完成后将自动重启...</div>
</body>
</html>"#;
    
    // 写入临时文件
    let html_path = std::env::temp_dir().join("cmdb_update.html");
    if let Ok(mut file) = std::fs::File::create(&html_path) {
        let _ = file.write_all(html.as_bytes());
    }
    
    // 用默认浏览器打开（简单方案）
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        
        // 使用 mshta 显示一个简单窗口
        let hta = format!(r#"<html>
<head>
<title>正在更新</title>
<HTA:APPLICATION ID="update" BORDER="none" BORDERSTYLE="none" CAPTION="no" 
  INNERBORDER="no" MAXIMIZEBUTTON="no" MINIMIZEBUTTON="no" SCROLL="no"
  SHOWINTASKBAR="yes" SINGLEINSTANCE="yes" SYSMENU="no" WINDOWSTATE="normal"/>
<style>
body {{ font-family: 'Segoe UI', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  height: 100%; margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; }}
.spinner {{ width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.3); border-top-color: white;
  border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px; }}
@keyframes spin {{ to {{ transform: rotate(360deg); }} }}
.title {{ font-size: 16px; margin-bottom: 6px; }}
.sub {{ font-size: 12px; opacity: 0.8; }}
</style>
<script>window.resizeTo(300, 180); window.moveTo((screen.width-300)/2, (screen.height-180)/2);</script>
</head>
<body><div class="spinner"></div><div class="title">正在更新</div><div class="sub">请稍候...</div></body>
</html>"#);
        
        let hta_path = std::env::temp_dir().join("cmdb_update.hta");
        if let Ok(mut file) = std::fs::File::create(&hta_path) {
            let _ = file.write_all(hta.as_bytes());
            let _ = std::process::Command::new("mshta")
                .arg(&hta_path)
                .creation_flags(CREATE_NO_WINDOW)
                .spawn();
        }
        
        // 等待安装完成（大约 10 秒）
        std::thread::sleep(std::time::Duration::from_secs(10));
    }
}

fn main() {
    // 启动时检查并执行待安装更新
    let has_pending_update = updater::check_and_install_pending_update();
    
    if has_pending_update {
        // 有待安装更新，显示更新窗口然后退出
        show_update_window();
        return;
    }
    
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let _ = app;
            Ok(())
        })
        .on_window_event(|window, event| {
            // 主窗口关闭时，关闭所有其他窗口
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if window.label() == "main" {
                    // 关闭所有窗口
                    for (_, win) in window.app_handle().webview_windows() {
                        let _ = win.close();
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_machine_id,
            get_hardware_fingerprint,
            get_system_info,
            encrypt_data,
            decrypt_data,
            bind_device,
            unbind_device,
            auto_login,
            clear_device_credentials,
            has_device_credentials,
            export_elfk_logs,
            updater::download_update,
            updater::install_update,
            updater::get_app_version,
            updater::mark_pending_update,
            updater::check_file_exists,
            updater::clean_update_dir,
            window::request_attention,
            window::cancel_attention,
            window::set_window_theme,
            window::bring_window_to_front
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
