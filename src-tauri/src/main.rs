// Prevents additional console window on Windows, DO NOT REMOVE!!
#![windows_subsystem = "windows"]

mod device;
mod crypto;
mod auth;
mod elfk;
mod commands;
mod tray;

use commands::*;
use tauri::Manager;
use tray::setup_tray;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // 设置系统托盘
            setup_tray(app)?;
            
            // 监听主窗口关闭事件 - 最小化到托盘而不是退出
            let main_window = app.get_webview_window("main").unwrap();
            let app_handle = app.handle().clone();
            main_window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    // 阻止默认关闭行为，改为隐藏窗口
                    api.prevent_close();
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = window.hide();
                    }
                }
            });
            Ok(())
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
            tray::set_tray_icon_flash,
            tray::stop_tray_icon_flash
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
