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

fn main() {
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
            updater::check_github_update,
            updater::download_update,
            updater::install_update,
            updater::get_app_version,
            window::request_attention,
            window::cancel_attention,
            window::set_window_theme,
            window::bring_window_to_front
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
