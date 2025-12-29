//! Tauri 命令模块
//! 暴露给前端调用的命令

use tauri::AppHandle;
use crate::device;
use crate::crypto;
use crate::auth::{self, AutoLoginResult};
use crate::elfk::{self, ExportParams};

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

/// 绑定设备（登录成功后调用，需要双因子验证）
#[tauri::command]
pub async fn bind_device(
    app_handle: AppHandle,
    api_base: String,
    token: String,
    user_name: String,
    totp_code: String,
) -> Result<(), String> {
    auth::bind_device(&app_handle, &api_base, &token, &user_name, &totp_code).await
}

/// 自动登录
#[tauri::command]
pub async fn auto_login(
    app_handle: AppHandle,
    api_base: String,
    user_name: String,
) -> AutoLoginResult {
    auth::auto_login(&app_handle, &api_base, &user_name).await
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
