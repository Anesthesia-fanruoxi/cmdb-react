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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // 更新检查由前端触发，不在这里启动定时任务
            // 前端会在登录后调用 check_update 并传入正确的 URL
            let _ = app;
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
            updater::check_update,
            updater::check_github_update,
            updater::download_update,
            updater::install_update,
            updater::get_app_version,
            window::request_attention,
            window::cancel_attention
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
