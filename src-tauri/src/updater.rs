//! 应用在线更新模块

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};

const DOWNLOAD_BASE_URL: &str = "https://ops.hzbxhd.com/client";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionInfo {
    pub version: String,
    pub release_date: String,
    pub changelog: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum UpdateStatus {
    Downloading { progress: f64, downloaded: u64, total: u64 },
    Downloaded { path: String },
    Installing,
}

fn get_current_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

fn get_download_dir() -> PathBuf {
    std::env::temp_dir().join("cmdb-updates")
}

fn emit_status(app: &AppHandle, status: UpdateStatus) {
    let _ = app.emit("update-status", &status);
}

/// 准备更新（检查 MSI 是否已下载，未下载则下载）
#[tauri::command]
pub async fn prepare_update(app: AppHandle, info: VersionInfo) -> Result<String, String> {
    let download_dir = get_download_dir();
    fs::create_dir_all(&download_dir).map_err(|e| e.to_string())?;

    let existing = fs::read_dir(&download_dir)
        .ok()
        .and_then(|entries| {
            entries
                .filter_map(|e| e.ok())
                .find(|e| e.path().extension().map(|ext| ext == "msi").unwrap_or(false))
                .map(|e| e.path())
        });

    if let Some(msi_path) = existing {
        return Ok(msi_path.to_string_lossy().to_string());
    }

    download_update(app, info).await
}

/// 下载更新包
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
    let resp = client.get(&download_url).send().await
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

/// 安装更新（运行 MSI 安装界面）
#[tauri::command]
pub async fn install_update(app: AppHandle, file_path: String, _install_path: String) -> Result<(), String> {
    emit_status(&app, UpdateStatus::Installing);

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("msiexec")
            .args(["/i", &file_path])
            .spawn()
            .map_err(|e| format!("启动安装程序失败: {}", e))?;

        std::thread::sleep(std::time::Duration::from_millis(500));
        app.exit(0);
        Ok(())
    }

    #[cfg(target_os = "macos")]
    {
        let _ = _install_path;
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

/// 检查文件是否存在
#[tauri::command]
pub fn check_file_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

/// 清理更新下载目录
#[tauri::command]
pub fn clean_update_dir() -> Result<(), String> {
    let download_dir = get_download_dir();
    if download_dir.exists() {
        fs::remove_dir_all(&download_dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}
