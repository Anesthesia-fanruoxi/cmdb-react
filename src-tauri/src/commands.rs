//! Tauri 命令模块
//! 暴露给前端调用的命令

use tauri::{AppHandle, Manager};
use serde::Serialize;
use sysinfo::System;
use std::fs;
use std::path::Path;
use std::collections::HashMap;
use std::sync::{Arc, Condvar, Mutex, OnceLock};
use std::thread;
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

/// 后台异步保存：加密并写入 tauri-plugin-store 文件，不阻塞 JS 主线程。
///
/// `async fn` 本身不会自动把同步加密和文件 IO 移出 tokio worker；如果直接在
/// 命令体内调用 `crypto::encrypt` / `store.save`，它们仍会占用运行时线程。这里
/// The command only enqueues the latest snapshot.
///
/// It returns an ACK immediately; encryption and disk IO happen on a worker.
/// This keeps the IPC request short instead of holding it during persistence.
/// Asynchronous store persistence. The command only enqueues the latest snapshot;
/// a dedicated worker performs encryption and disk IO, then the command returns.
/// This keeps the IPC request short and coalesces repeated updates for each file.
struct StoreSaveQueue {
    app_handle: AppHandle,
    state: Mutex<StoreSaveQueueState>,
    wake: Condvar,
}

struct StoreSaveQueueState {
    pending: HashMap<String, String>,
    in_flight: usize,
}

static STORE_SAVE_QUEUE: OnceLock<Arc<StoreSaveQueue>> = OnceLock::new();

fn get_store_save_queue(app_handle: &AppHandle) -> &'static Arc<StoreSaveQueue> {
    STORE_SAVE_QUEUE.get_or_init(|| {
        let queue = Arc::new(StoreSaveQueue {
            app_handle: app_handle.clone(),
            state: Mutex::new(StoreSaveQueueState {
                pending: HashMap::new(),
                in_flight: 0,
            }),
            wake: Condvar::new(),
        });

        let worker_queue = Arc::clone(&queue);
        thread::Builder::new()
            .name("store-save-worker".to_string())
            .spawn(move || store_save_worker(worker_queue))
            .expect("failed to start store save worker");

        queue
    })
}

fn store_save_worker(queue: Arc<StoreSaveQueue>) {
    loop {
        let (file, plaintext) = {
            let mut state = queue.state.lock().expect("store save queue poisoned");
            while state.pending.is_empty() {
                state = queue.wake.wait(state).expect("store save queue poisoned");
            }

            let file = state
                .pending
                .keys()
                .next()
                .cloned()
                .expect("pending store save is not empty");
            let plaintext = state
                .pending
                .remove(&file)
                .expect("pending store save payload is missing");
            state.in_flight += 1;
            (file, plaintext)
        };

        let result = persist_store_snapshot(&queue.app_handle, &file, &plaintext);

        if let Err(error) = result {
            eprintln!("[Storage] save failed for {file}: {error}");
        }

        let mut state = queue.state.lock().expect("store save queue poisoned");
        state.in_flight = state.in_flight.saturating_sub(1);
        queue.wake.notify_all();
    }
}

fn persist_store_snapshot(
    app_handle: &AppHandle,
    file: &str,
    plaintext: &str,
) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;

    let encrypted = crypto::encrypt(plaintext)?;
    let store = app_handle.store(file).map_err(|e| e.to_string())?;
    store.set("data", serde_json::Value::String(encrypted));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

/// Enqueue a snapshot and return an immediate ACK.
#[tauri::command]
pub fn save_store_async(
    app_handle: AppHandle,
    file: String,
    plaintext: String,
) -> Result<(), String> {
    let queue = get_store_save_queue(&app_handle);
    let mut state = queue.state.lock().map_err(|_| "store save queue poisoned".to_string())?;

    // Keep only the latest snapshot for each file.
    state.pending.insert(file, plaintext);
    queue.wake.notify_one();
    Ok(())
}

/// Wait until all queued snapshots have reached disk.
#[tauri::command]
pub fn flush_store_save_queue(app_handle: AppHandle) -> Result<(), String> {
    let Some(queue) = STORE_SAVE_QUEUE.get() else {
        return Ok(());
    };

    // Keep the argument so this remains a normal Tauri command.
    let _ = app_handle;
    let mut state = queue.state.lock().map_err(|_| "store save queue poisoned".to_string())?;
    while !state.pending.is_empty() || state.in_flight > 0 {
        state = queue.wake.wait(state).map_err(|_| "store save queue poisoned".to_string())?;
    }
    Ok(())
}

/// 判断 app_data_dir 下相对路径是否存在（文件或目录），不创建任何文件。
#[tauri::command]
pub fn store_path_exists(app_handle: AppHandle, path: String) -> Result<bool, String> {
    if path.is_empty() || path.contains("..") {
        return Err("invalid store path".to_string());
    }
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用目录失败: {e}"))?;
    Ok(app_dir.join(&path).exists())
}

/// 物理删除 app_data_dir 下的 store 文件。
/// 文件不存在时视为成功；绝不会创建空文件（与 store.clear()+save 不同）。
#[tauri::command]
pub fn delete_store_file(app_handle: AppHandle, file: String) -> Result<(), String> {
    if file.is_empty() || file.contains("..") {
        return Err("invalid store file path".to_string());
    }

    // Drop any queued writes for this file so a late flush cannot recreate it.
    if let Some(queue) = STORE_SAVE_QUEUE.get() {
        if let Ok(mut state) = queue.state.lock() {
            state.pending.remove(&file);
        }
    }

    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用目录失败: {e}"))?;
    let path = app_dir.join(&file);

    if path.is_file() {
        fs::remove_file(&path).map_err(|e| format!("删除 {file} 失败: {e}"))?;
    }

    Ok(())
}

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
