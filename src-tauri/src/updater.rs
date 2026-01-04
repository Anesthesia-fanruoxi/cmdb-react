//! 应用在线更新模块
//! 
//! 功能：
//! - 检查 GitHub Release 版本更新
//! - 从自建服务器下载更新包
//! - 触发安装（Windows: MSI, Mac: DMG）

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter};
use std::time::Duration;

static CHECKING: AtomicBool = AtomicBool::new(false);

/// 下载服务器基础地址
const DOWNLOAD_BASE_URL: &str = "https://ops.hzbxhd.com/client";

/// GitHub Release 响应结构
#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    name: Option<String>,
    body: Option<String>,
    published_at: Option<String>,
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

/// 比较版本号 (返回 true 表示 remote > local)
fn is_newer_version(local: &str, remote: &str) -> bool {
    let parse = |v: &str| -> Vec<u32> {
        v.trim_start_matches('v')
            .split('.')
            .filter_map(|s| s.parse().ok())
            .collect()
    };
    let local_parts = parse(local);
    let remote_parts = parse(remote);
    
    for i in 0..3 {
        let l = local_parts.get(i).unwrap_or(&0);
        let r = remote_parts.get(i).unwrap_or(&0);
        if r > l { return true; }
        if r < l { return false; }
    }
    false
}

/// 获取下载目录
fn get_download_dir() -> PathBuf {
    dirs::download_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_default())
        .join("cmdb-updates")
}

/// 发送更新状态到前端
fn emit_status(app: &AppHandle, status: UpdateStatus) {
    let _ = app.emit("update-status", &status);
}

/// 从 GitHub Release 检查更新
#[tauri::command]
pub async fn check_github_update(app: AppHandle, owner: String, repo: String, token: Option<String>) -> Result<Option<VersionInfo>, String> {
    if CHECKING.swap(true, Ordering::SeqCst) {
        return Err("正在检查更新中".to_string());
    }
    
    emit_status(&app, UpdateStatus::Checking);
    
    let result = async {
        let url = format!("https://api.github.com/repos/{}/{}/releases/latest", owner, repo);
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .user_agent("CMDB-Desktop-Updater")
            .build()
            .map_err(|e| e.to_string())?;
        
        let mut req = client.get(&url);
        if let Some(t) = &token {
            req = req.header("Authorization", format!("Bearer {}", t));
        }
        
        let resp = req.send().await.map_err(|e| format!("请求失败: {}", e))?;
        
        if resp.status() == 404 {
            emit_status(&app, UpdateStatus::NotAvailable);
            return Ok(None);
        }
        
        if !resp.status().is_success() {
            return Err(format!("GitHub 返回错误: {}", resp.status()));
        }
        
        let release: GitHubRelease = resp.json().await
            .map_err(|e| format!("解析失败: {}", e))?;
        
        let current = get_current_version();
        if !is_newer_version(&current, &release.tag_name) {
            emit_status(&app, UpdateStatus::NotAvailable);
            return Ok(None);
        }
        
        let info = VersionInfo {
            version: release.tag_name.clone(),
            release_date: release.published_at.unwrap_or_default(),
            changelog: release.body.unwrap_or_else(|| release.name.unwrap_or_default()),
        };
        
        emit_status(&app, UpdateStatus::Available { info: info.clone() });
        Ok(Some(info))
    }.await;
    
    CHECKING.store(false, Ordering::SeqCst);
    result
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
msiexec /i "{}" /passive /norestart
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
        
        std::process::exit(0);
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
