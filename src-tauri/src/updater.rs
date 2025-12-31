//! 应用在线更新模块
//! 
//! 功能：
//! - 定时检查 GitHub Release 版本更新
//! - 下载更新包
//! - 触发安装（Windows: MSI, Mac: DMG）

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

static CHECKING: AtomicBool = AtomicBool::new(false);

/// GitHub Release 响应结构
#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    name: Option<String>,
    body: Option<String>,
    published_at: Option<String>,
    assets: Vec<GitHubAsset>,
}

#[derive(Debug, Deserialize)]
struct GitHubAsset {
    id: u64,
    name: String,
    size: u64,
    browser_download_url: String,
}

/// 版本信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionInfo {
    pub version: String,
    pub release_date: String,
    pub changelog: String,
    pub mandatory: bool,
    pub windows: Option<PlatformAsset>,
    pub macos_intel: Option<PlatformAsset>,
    pub macos_arm: Option<PlatformAsset>,
}

/// 平台资源
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformAsset {
    pub url: String,
    pub api_url: String,  // GitHub API 下载地址
    pub size: u64,
    pub sha256: String,
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

/// 检查更新（兼容旧接口）
#[tauri::command]
pub async fn check_update(app: AppHandle, update_url: String) -> Result<Option<VersionInfo>, String> {
    if CHECKING.swap(true, Ordering::SeqCst) {
        return Err("正在检查更新中".to_string());
    }
    
    emit_status(&app, UpdateStatus::Checking);
    
    let result = async {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .map_err(|e| e.to_string())?;
        
        let resp = client.get(&update_url)
            .send()
            .await
            .map_err(|e| format!("请求失败: {}", e))?;
        
        if !resp.status().is_success() {
            return Err(format!("服务器返回错误: {}", resp.status()));
        }
        
        let info: VersionInfo = resp.json()
            .await
            .map_err(|e| format!("解析版本信息失败: {}", e))?;
        
        let current = get_current_version();
        if is_newer_version(&current, &info.version) {
            emit_status(&app, UpdateStatus::Available { info: info.clone() });
            Ok(Some(info))
        } else {
            emit_status(&app, UpdateStatus::NotAvailable);
            Ok(None)
        }
    }.await;
    
    CHECKING.store(false, Ordering::SeqCst);
    result
}

/// 从 GitHub Release 检查更新（支持私有仓库）
#[tauri::command]
pub async fn check_github_update(app: AppHandle, owner: String, repo: String, token: Option<String>) -> Result<Option<VersionInfo>, String> {
    if CHECKING.swap(true, Ordering::SeqCst) {
        return Err("正在检查更新中".to_string());
    }
    
    emit_status(&app, UpdateStatus::Checking);
    
    let result = async {
        let url = format!("https://api.github.com/repos/{}/{}/releases/latest", owner, repo);
        eprintln!("[更新检查] URL: {}", url);
        eprintln!("[更新检查] Token: {}", if token.is_some() { "已配置" } else { "未配置" });
        
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .user_agent("CMDB-Desktop-Updater")
            .build()
            .map_err(|e| e.to_string())?;
        
        let mut req = client.get(&url);
        // 添加 Token 认证（支持私有仓库，提高 API 限额）
        if let Some(t) = &token {
            req = req.header("Authorization", format!("Bearer {}", t));
        }
        
        let resp = req.send()
            .await
            .map_err(|e| format!("请求 GitHub 失败: {}", e))?;
        
        eprintln!("[更新检查] 响应状态: {}", resp.status());
        
        if resp.status() == 404 {
            emit_status(&app, UpdateStatus::NotAvailable);
            return Ok(None);
        }
        
        if !resp.status().is_success() {
            return Err(format!("GitHub 返回错误: {}", resp.status()));
        }
        
        let release: GitHubRelease = resp.json()
            .await
            .map_err(|e| format!("解析 Release 信息失败: {}", e))?;
        
        let current = get_current_version();
        eprintln!("[更新检查] 本地版本: {}, 远程版本: {}", current, release.tag_name);
        
        if !is_newer_version(&current, &release.tag_name) {
            eprintln!("[更新检查] 无需更新");
            emit_status(&app, UpdateStatus::NotAvailable);
            return Ok(None);
        }
        
        eprintln!("[更新检查] 发现新版本!");
        
        // 从 assets 中匹配各平台安装包
        let find_asset = |keyword: &str| -> Option<PlatformAsset> {
            release.assets.iter()
                .find(|a| a.name.to_lowercase().contains(keyword))
                .map(|a| PlatformAsset {
                    url: a.browser_download_url.clone(),
                    api_url: format!("https://api.github.com/repos/{}/{}/releases/assets/{}", owner, repo, a.id),
                    size: a.size,
                    sha256: String::new(),
                })
        };
        
        let info = VersionInfo {
            version: release.tag_name.clone(),
            release_date: release.published_at.unwrap_or_default(),
            changelog: release.body.unwrap_or_else(|| release.name.unwrap_or_default()),
            mandatory: false,
            windows: find_asset("windows").or_else(|| find_asset(".msi")),
            macos_intel: find_asset("intel").or_else(|| find_asset("x64.dmg")),
            macos_arm: find_asset("arm64").or_else(|| find_asset("aarch64")),
        };
        
        emit_status(&app, UpdateStatus::Available { info: info.clone() });
        Ok(Some(info))
    }.await;
    
    CHECKING.store(false, Ordering::SeqCst);
    result
}

/// 下载更新
#[tauri::command]
pub async fn download_update(app: AppHandle, info: VersionInfo, token: Option<String>) -> Result<String, String> {
    let (asset, arch_suffix) = if cfg!(target_os = "windows") {
        (info.windows.ok_or("没有 Windows 版本")?, "x64")
    } else if cfg!(target_os = "macos") {
        // 检测 Mac 架构：arm64 (M系列) 或 x86_64 (Intel)
        if cfg!(target_arch = "aarch64") {
            (info.macos_arm.ok_or("没有 macOS Apple Silicon 版本")?, "aarch64")
        } else {
            (info.macos_intel.ok_or("没有 macOS Intel 版本")?, "x64")
        }
    } else {
        return Err("不支持的操作系统".to_string());
    };
    
    let download_dir = get_download_dir();
    fs::create_dir_all(&download_dir).map_err(|e| e.to_string())?;
    
    let filename = if cfg!(target_os = "windows") {
        format!("cmdb-desktop-{}-{}.msi", info.version, arch_suffix)
    } else {
        format!("cmdb-desktop-{}-{}.dmg", info.version, arch_suffix)
    };
    let file_path = download_dir.join(&filename);
    
    let client = reqwest::Client::new();
    
    // 私有仓库使用 API URL 下载
    let download_url = if token.is_some() { &asset.api_url } else { &asset.url };
    
    let mut req = client.get(download_url)
        .header("User-Agent", "CMDB-Desktop-Updater")
        .header("Accept", "application/octet-stream");
    
    // 私有仓库需要 Token 认证
    if let Some(t) = &token {
        req = req.header("Authorization", format!("Bearer {}", t));
    }
    
    let resp = req.send()
        .await
        .map_err(|e| format!("下载请求失败: {}", e))?;
    
    if !resp.status().is_success() {
        return Err(format!("下载失败: {}", resp.status()));
    }
    
    let total = resp.content_length().unwrap_or(asset.size);
    let mut downloaded: u64 = 0;
    
    let mut file = fs::File::create(&file_path).map_err(|e| e.to_string())?;
    let mut stream = resp.bytes_stream();
    
    use futures_util::StreamExt;
    use std::io::Write;
    
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        
        let progress = (downloaded as f64 / total as f64) * 100.0;
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
        // Windows: 使用 msiexec 安装 MSI
        std::process::Command::new("msiexec")
            .args(["/i", &file_path, "/passive", "/norestart"])
            .spawn()
            .map_err(|e| format!("启动安装程序失败: {}", e))?;
        
        // 退出当前应用，让安装程序接管
        std::process::exit(0);
    }
    
    #[cfg(target_os = "macos")]
    {
        // macOS: 打开 DMG 文件，用户手动拖拽安装
        std::process::Command::new("open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("打开安装包失败: {}", e))?;
        
        // macOS 不自动退出，让用户手动操作
        Ok(())
    }
    
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Err("不支持的操作系统".to_string())
    }
}

/// 获取当前版本号
#[tauri::command]
pub fn get_app_version() -> String {
    get_current_version()
}

/// 启动定时检查更新任务（GitHub Release）
#[allow(dead_code)]
pub fn start_github_update_checker(app: AppHandle, owner: String, repo: String, interval_hours: u64) {
    tauri::async_runtime::spawn(async move {
        let interval = Duration::from_secs(interval_hours * 3600);
        
        // 启动后延迟 30 秒再首次检查
        tokio::time::sleep(Duration::from_secs(30)).await;
        
        loop {
            let _ = check_github_update(app.clone(), owner.clone(), repo.clone(), None).await;
            tokio::time::sleep(interval).await;
        }
    });
}

/// 启动定时检查更新任务（旧接口）
#[allow(dead_code)]
pub fn start_update_checker(app: AppHandle, update_url: String, interval_hours: u64) {
    tauri::async_runtime::spawn(async move {
        let interval = Duration::from_secs(interval_hours * 3600);
        
        // 启动后延迟 30 秒再首次检查
        tokio::time::sleep(Duration::from_secs(30)).await;
        
        loop {
            let _ = check_update(app.clone(), update_url.clone()).await;
            tokio::time::sleep(interval).await;
        }
    });
}
