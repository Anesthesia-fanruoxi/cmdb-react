// Prevents additional console window on Windows, DO NOT REMOVE!!
#![windows_subsystem = "windows"]

mod device;
mod crypto;
mod auth;
mod elfk;
mod commands;
mod updater;
mod updater_checker;
mod window;
mod login_history;

use commands::*;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // 启动定时检查更新任务
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                updater_checker::start_update_checker(handle);
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            // 主窗口关闭时，关闭所有子窗口（跳过主窗口自身防止重入死锁）
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if window.label() == "main" {
                    for (label, win) in window.app_handle().webview_windows() {
                        if label != "main" {
                            let _ = win.close();
                        }
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
            save_store_async,
            bind_device,
            unbind_device,
            auto_login,
            clear_device_credentials,
            has_device_credentials,
            export_elfk_logs,
            add_login_history,
            get_login_history,
            get_last_user,
            clear_login_history,
            get_download_dir,
            open_folder,
            show_in_folder,
            open_file,
            file_exists,
            updater::download_update,
            updater::install_update,
            updater::get_app_version,
            updater::check_file_exists,
            updater::clean_update_dir,
            updater::prepare_update,
            window::request_attention,
            window::cancel_attention,
            window::set_window_theme,
            window::bring_window_to_front
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
