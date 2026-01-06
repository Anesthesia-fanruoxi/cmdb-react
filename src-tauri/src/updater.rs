//! 应用在线更新模块
//! 
//! 功能：
//! - 从自建服务器下载更新包
//! - 静默安装（Windows: MSI, Mac: DMG）
//! - 启动时检查待安装更新

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};

/// 下载服务器基础地址
const DOWNLOAD_BASE_URL: &str = "https://ops.hzbxhd.com/client";
/// 待安装更新标记文件
const PENDING_UPDATE_FILE: &str = "pending_update.json";

/// 待安装更新信息
#[derive(Debug, Clone, Serialize, Deserialize)]
struct PendingUpdate {
    file_path: String,
    version: String,
}

/// 版本信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionInfo {
    pub version: String,
    pub release_date: String,
    pub changelog: String,
}

/// 更新状态
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum UpdateStatus {
    Checking,
    Available { info: VersionInfo },
    NotAvailable,
    Downloading { progress: f64, downloaded: u64, total: u64 },
    Downloaded { path: String },
    Installing,
    Error { message: String },
}

/// 获取当前版本
fn get_current_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// 获取下载目录
fn get_download_dir() -> PathBuf {
    dirs::download_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_default())
        .join("cmdb-updates")
}

/// 获取待安装标记文件路径
fn get_pending_file_path() -> PathBuf {
    get_download_dir().join(PENDING_UPDATE_FILE)
}

/// 发送更新状态到前端
fn emit_status(app: &AppHandle, status: UpdateStatus) {
    let _ = app.emit("update-status", &status);
}

/// 标记待安装更新（下载完成后调用）
#[tauri::command]
pub fn mark_pending_update(file_path: String, version: String) -> Result<(), String> {
    let pending = PendingUpdate { file_path, version };
    let json = serde_json::to_string(&pending).map_err(|e| e.to_string())?;
    
    let pending_path = get_pending_file_path();
    fs::create_dir_all(pending_path.parent().unwrap()).ok();
    fs::write(&pending_path, json).map_err(|e| e.to_string())?;
    
    Ok(())
}

/// 检查并执行待安装更新（启动时调用）
/// 返回 true 表示有更新需要安装，主程序应该等待
pub fn check_and_install_pending_update() -> bool {
    let pending_path = get_pending_file_path();
    
    if !pending_path.exists() {
        return false;
    }
    
    // 读取待安装信息
    let content = match fs::read_to_string(&pending_path) {
        Ok(c) => c,
        Err(_) => return false,
    };
    
    let pending: PendingUpdate = match serde_json::from_str(&content) {
        Ok(p) => p,
        Err(_) => return false,
    };
    
    // 检查安装包是否存在
    if !std::path::Path::new(&pending.file_path).exists() {
        let _ = fs::remove_file(&pending_path);
        return false;
    }
    
    // 删除标记文件
    let _ = fs::remove_file(&pending_path);
    
    // 执行静默安装
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        
        let exe_path = std::env::current_exe()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        
        // 创建安装脚本：安装完成后重启应用
        let script = format!(
            r#"@echo off
msiexec /i "{}" /quiet /norestart
timeout /t 1 /nobreak >nul
start "" "{}"
"#,
            pending.file_path, exe_path
        );
        
        let script_path = std::env::temp_dir().join("cmdb_update.bat");
        if fs::write(&script_path, script).is_ok() {
            let _ = std::process::Command::new("cmd")
                .args(["/c", &script_path.to_string_lossy()])
                .creation_flags(CREATE_NO_WINDOW)
                .spawn();
        }
        
        return true;
    }
    
    #[cfg(not(target_os = "windows"))]
    false
}

/// 下载更新（从自建服务器）
#[tauri::command]
pub async fn download_update(app: AppHandle, info: VersionInfo) -> Result<String, String> {
    let (filename, local_filename) = if cfg!(target_os = "windows") {
        ("CMDB-Desktop-windows-x64.msi", format!("cmdb-desktop-{}.msi", info.version))
    } else if cfg!(target_os = "macos") {
        if cfg!(target_arch = "aarch64") {
            ("CMDB-Desktop-macos-arm64.dmg", format!("cmdb-desktop-{}-arm64.dmg", info.version))
        } else {
            ("CMDB-Desktop-macos-intel.dmg", format!("cmdb-desktop-{}-intel.dmg", info.version))
        }
    } else {
        return Err("不支持的操作系统".to_string());
    };
    
    let download_url = format!("{}/{}", DOWNLOAD_BASE_URL, filename);
    let download_dir = get_download_dir();
    fs::create_dir_all(&download_dir).map_err(|e| e.to_string())?;
    let file_path = download_dir.join(&local_filename);
    
    let client = reqwest::Client::new();
    let resp = client.get(&download_url)
        .send()
        .await
        .map_err(|e| format!("下载请求失败: {}", e))?;
    
    if !resp.status().is_success() {
        return Err(format!("下载失败: {}", resp.status()));
    }
    
    let total = resp.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut file = fs::File::create(&file_path).map_err(|e| e.to_string())?;
    let mut stream = resp.bytes_stream();
    
    use futures_util::StreamExt;
    use std::io::Write;
    
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        
        let progress = if total > 0 { (downloaded as f64 / total as f64) * 100.0 } else { 0.0 };
        emit_status(&app, UpdateStatus::Downloading { progress, downloaded, total });
    }
    
    let path_str = file_path.to_string_lossy().to_string();
    emit_status(&app, UpdateStatus::Downloaded { path: path_str.clone() });
    Ok(path_str)
}

/// 安装更新
#[tauri::command]
pub async fn install_update(app: AppHandle, file_path: String) -> Result<(), String> {
    emit_status(&app, UpdateStatus::Installing);
    
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        
        let exe_path = std::env::current_exe()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        
        let script = format!(
            r#"@echo off
msiexec /i "{}" /quiet /norestart
timeout /t 2 /nobreak >nul
start "" "{}"
"#,
            file_path, exe_path
        );
        
        let script_path = std::env::temp_dir().join("cmdb_update.bat");
        std::fs::write(&script_path, script).map_err(|e| e.to_string())?;
        
        std::process::Command::new("cmd")
            .args(["/c", &script_path.to_string_lossy()])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("启动安装程序失败: {}", e))?;
        
        // 优雅退出，让前端有机会保存状态
        app.exit(0);
        Ok(())
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("打开安装包失败: {}", e))?;
        Ok(())
    }
    
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    Err("不支持的操作系统".to_string())
}

/// 获取当前版本号
#[tauri::command]
pub fn get_app_version() -> String {
    get_current_version()
}
