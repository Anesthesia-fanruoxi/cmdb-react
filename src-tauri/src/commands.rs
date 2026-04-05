//! Tauri 命令模块
//! 暴露给前端调用的命令

use tauri::{AppHandle, Manager};
use serde::Serialize;
use sysinfo::System;
use std::fs;
use std::path::Path;
use crate::device;
use crate::crypto;
use crate::auth::{self, AutoLoginResult};
use crate::elfk::{self, ExportParams};
use crate::login_history;

/// 系统信息
#[derive(Serialize)]
pub struct SystemInfo {
    pub os_name: String,
    pub os_version: String,
    pub process_memory: u64,
    pub storage_size: u64,
}

/// 获取系统信息（当前进程的资源占用）
#[tauri::command]
pub fn get_system_info(app_handle: AppHandle) -> SystemInfo {
    let mut sys = System::new_all();
    sys.refresh_all();
    
    let os_name = System::name().unwrap_or_else(|| "Unknown".to_string());
    let os_version = System::os_version().unwrap_or_else(|| "".to_string());
    
    // 获取当前进程内存
    let process_memory = if let Some(pid) = sysinfo::get_current_pid().ok() {
        sys.process(pid).map(|p| p.memory()).unwrap_or(0)
    } else {
        0
    };
    
    // 获取应用数据目录大小
    let storage_size = get_app_storage_size(&app_handle);
    
    SystemInfo {
        os_name,
        os_version,
        process_memory,
        storage_size,
    }
}

/// 计算应用数据目录大小
fn get_app_storage_size(app_handle: &AppHandle) -> u64 {
    let app_dir = match app_handle.path().app_data_dir() {
        Ok(dir) => dir,
        Err(_) => return 0,
    };
    
    if !app_dir.exists() {
        return 0;
    }
    
    calculate_dir_size(&app_dir)
}

/// 递归计算目录大小
fn calculate_dir_size(path: &Path) -> u64 {
    let mut size = 0;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            if entry_path.is_file() {
                size += fs::metadata(&entry_path).map(|m| m.len()).unwrap_or(0);
            } else if entry_path.is_dir() {
                size += calculate_dir_size(&entry_path);
            }
        }
    }
    size
}

/// 获取机器码
#[tauri::command]
pub fn get_machine_id() -> Result<String, String> {
    device::get_machine_id()
}

/// 获取硬件指纹
#[tauri::command]
pub fn get_hardware_fingerprint() -> Result<String, String> {
    device::get_hardware_fingerprint()
}

/// 加密数据
#[tauri::command]
pub fn encrypt_data(plaintext: String) -> Result<String, String> {
    crypto::encrypt(&plaintext)
}

/// 解密数据
#[tauri::command]
pub fn decrypt_data(encrypted: String) -> Result<String, String> {
    crypto::decrypt(&encrypted)
}

/// 后台异步保存：加密并写入 tauri-plugin-store 文件，不阻塞 JS 主线程
/// JS 侧直接 invoke 不 await，Rust 在 tokio 后台线程处理
#[tauri::command]
pub async fn save_store_async(
    app_handle: AppHandle,
    file: String,
    plaintext: String,
) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;

    // 加密
    let encrypted = crypto::encrypt(&plaintext)?;

    // 写入 store
    let store = app_handle.store(&file).map_err(|e| e.to_string())?;
    store.set("data", serde_json::Value::String(encrypted));
    store.save().map_err(|e| e.to_string())?;

    Ok(())
}

/// 绑定设备（登录成功后调用，需要双因子验证）
#[tauri::command]
pub async fn bind_device(
    app_handle: AppHandle,
    api_base: String,
    token: String,
    user_name: String,
    totp_code: String,
    version: String,
) -> Result<(), String> {
    auth::bind_device(&app_handle, &api_base, &token, &user_name, &totp_code, &version).await
}

/// 解绑设备（需要双因子验证）
#[tauri::command]
pub async fn unbind_device(
    app_handle: AppHandle,
    api_base: String,
    token: String,
    user_name: String,
    totp_code: String,
) -> Result<(), String> {
    auth::unbind_device(&app_handle, &api_base, &token, &user_name, &totp_code).await
}

/// 自动登录
#[tauri::command]
pub async fn auto_login(
    app_handle: AppHandle,
    api_base: String,
    user_name: String,
    version: String,
) -> AutoLoginResult {
    auth::auto_login(&app_handle, &api_base, &user_name, &version).await
}

/// 清除设备凭证（登出时调用）
#[tauri::command]
pub fn clear_device_credentials(app_handle: AppHandle, user_name: Option<String>) -> Result<(), String> {
    match user_name {
        Some(name) => auth::remove_credentials_for_user(&app_handle, &name),
        None => auth::remove_credentials(&app_handle),
    }
}

/// 检查是否有设备凭证
#[tauri::command]
pub fn has_device_credentials(app_handle: AppHandle, user_name: Option<String>) -> bool {
    match user_name {
        Some(name) => auth::has_credentials_for_user(&app_handle, &name),
        None => auth::load_credentials(&app_handle).is_ok(),
    }
}


/// 导出 ELFK 日志（后端下载到本地）
#[tauri::command]
pub async fn export_elfk_logs(
    app_handle: AppHandle,
    api_base: String,
    token: String,
    params: ExportParams,
) -> Result<String, String> {
    elfk::export_logs(&app_handle, &api_base, &token, params).await
}


// ==================== 登录历史 ====================

/// 添加登录历史
#[tauri::command]
pub fn add_login_history(app_handle: AppHandle, username: String) -> Result<(), String> {
    login_history::add_history(&app_handle, &username)
}

/// 获取登录历史
#[tauri::command]
pub fn get_login_history(app_handle: AppHandle) -> Vec<String> {
    login_history::get_history(&app_handle)
}

/// 获取最后登录用户
#[tauri::command]
pub fn get_last_user(app_handle: AppHandle) -> String {
    login_history::get_last_user(&app_handle)
}

/// 清除登录历史
#[tauri::command]
pub fn clear_login_history(app_handle: AppHandle) -> Result<(), String> {
    login_history::clear_history(&app_handle)
}

// ==================== 文件系统操作 ====================

/// 获取系统默认下载目录
#[tauri::command]
pub fn get_download_dir() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::env;
        let user_profile = env::var("USERPROFILE").map_err(|e| e.to_string())?;
        Ok(format!("{}\\Downloads", user_profile))
    }
    
    #[cfg(target_os = "macos")]
    {
        use std::env;
        let home = env::var("HOME").map_err(|e| e.to_string())?;
        Ok(format!("{}/Downloads", home))
    }
    
    #[cfg(target_os = "linux")]
    {
        use std::env;
        let home = env::var("HOME").map_err(|e| e.to_string())?;
        Ok(format!("{}/Downloads", home))
    }
}

/// 打开文件夹
#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

/// 在文件管理器中显示文件
#[tauri::command]
pub fn show_in_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(target_os = "linux")]
    {
        // Linux 上尝试使用 xdg-open 打开父目录
        let path_obj = Path::new(&path);
        if let Some(parent) = path_obj.parent() {
            std::process::Command::new("xdg-open")
                .arg(parent)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    }
    
    Ok(())
}

/// 使用系统默认程序打开文件
#[tauri::command]
pub fn open_file(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

/// 检查文件是否存在
#[tauri::command]
pub fn file_exists(path: String) -> bool {
    Path::new(&path).exists()
}
