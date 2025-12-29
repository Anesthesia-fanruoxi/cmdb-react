// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod device;
mod crypto;
mod auth;
mod elfk;
mod commands;

use commands::*;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_machine_id,
            get_hardware_fingerprint,
            encrypt_data,
            decrypt_data,
            bind_device,
            auto_login,
            clear_device_credentials,
            has_device_credentials,
            export_elfk_logs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
