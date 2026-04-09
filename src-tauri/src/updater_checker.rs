//! 定时检查更新模块

use std::fs;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const VERSION_API: &str = "https://api.hzbxhd.com/api/app/version/list";
const DOWNLOAD_BASE_URL: &str = "https://ops.hzbxhd.com/client";
const CHECK_INTERVAL_SECS: u64 = 60;

#[derive(serde::Deserialize)]
struct VersionResponse {
    code: i32,
    data: Option<VersionData>,
}

#[derive(serde::Deserialize)]
struct VersionData {
    version: String,
    description: Option<String>,
}

#[derive(Clone, serde::Serialize)]
pub struct UpdateNotification {
    pub version: String,
    pub changelog: String,
    pub msi_path: String,
}

fn get_download_dir() -> std::path::PathBuf {
    std::env::temp_dir().join("cmdb-updates")
}

fn get_current_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

fn is_newer_version(local: &str, remote: &str) -> bool {
    let parse = |v: &str| -> Vec<i32> {
        v.trim_start_matches('v')
            .split('.')
            .map(|s| s.parse().unwrap_or(0))
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

fn clean_download_dir() {
    let dir = get_download_dir();
    if dir.exists() {
        if let Err(e) = fs::remove_dir_all(&dir) {
            eprintln!("[更新检查] 清理目录失败: {}", e);
        }
    }
}

async fn download_msi(version: &str) -> Result<String, String> {
    let download_dir = get_download_dir();
    fs::create_dir_all(&download_dir).map_err(|e| e.to_string())?;

    let filename = "CMDB-Desktop-windows-x64.msi";
    let local_filename = format!("cmdb-desktop-{}.msi", version);
    let download_url = format!("{}/{}", DOWNLOAD_BASE_URL, filename);
    let file_path = download_dir.join(&local_filename);

    if file_path.exists() {
        return Ok(file_path.to_string_lossy().to_string());
    }

    let client = reqwest::Client::new();
    let resp = client.get(&download_url).send().await
        .map_err(|e| format!("下载请求失败: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("下载失败: {}", resp.status()));
    }

    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    fs::write(&file_path, &bytes).map_err(|e| e.to_string())?;

    Ok(file_path.to_string_lossy().to_string())
}

async fn check_and_download() -> Option<UpdateNotification> {
    let client = reqwest::Client::new();
    let resp = client
        .get(VERSION_API)
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .ok()?;

    let result: VersionResponse = resp.json().await.ok()?;
    if result.code != 200 { return None; }

    let data = result.data?;
    let current = get_current_version();

    if !is_newer_version(&current, &data.version) {
        return None;
    }

    let msi_path = download_msi(&data.version).await.ok()?;

    Some(UpdateNotification {
        version: data.version,
        changelog: data.description.unwrap_or_else(|| "新版本可用".to_string()),
        msi_path,
    })
}

pub fn start_update_checker(app: AppHandle) {
    println!("[更新检查] 启动定时检查，间隔 {} 秒", CHECK_INTERVAL_SECS);

    let rt = tokio::runtime::Runtime::new().unwrap();

    std::thread::sleep(Duration::from_secs(3));
    println!("[更新检查] 启动时首次检查...");

    match rt.block_on(check_and_download()) {
        Some(info) => {
            println!("[更新检查] 发现新版本 {}，弹框提示", info.version);
            let _ = app.emit("update-available", &info);
        }
        None => {
            println!("[更新检查] 无更新，清理目录");
            clean_download_dir();
        }
    }

    loop {
        std::thread::sleep(Duration::from_secs(CHECK_INTERVAL_SECS));
        println!("[更新检查] 定时检查...");

        match rt.block_on(check_and_download()) {
            Some(info) => {
                println!("[更新检查] 发现新版本 {}，静默提示", info.version);
                let _ = app.emit("update-available-silent", &info);
            }
            None => {
                println!("[更新检查] 无更新，清理目录");
                clean_download_dir();
            }
        }
    }
}
